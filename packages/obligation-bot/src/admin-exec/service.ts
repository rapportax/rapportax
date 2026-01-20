import { randomUUID } from "crypto";
import type { AdminExecRequest, ContextObject, TodoCandidate } from "../types";
import type { AdminExecRequestRepository, DecisionLogRepository } from "../storage/interfaces";
import { getOrgSummary, getUserDetail, executeAdminAction, verifyAdminToken } from "./api";
import { resolveAdminEndpoint, type AdminEndpoint } from "./endpoints";
import { OpenAIAdminPlanner } from "./planner";
import { getToolDefinition } from "./registry";
import { validatePlan } from "./guard";

export interface AdminExecServiceConfig {
  adminApiBaseUrl: string;
  openaiModel: string;
  openaiBaseUrl?: string;
}

export interface AdminExecServiceDeps {
  requestRepository: AdminExecRequestRepository;
  decisionLogRepository: DecisionLogRepository;
}

export class AdminExecService {
  private readonly planner: OpenAIAdminPlanner;

  constructor(
    private readonly config: AdminExecServiceConfig,
    private readonly deps: AdminExecServiceDeps,
  ) {
    this.planner = new OpenAIAdminPlanner({
      model: config.openaiModel,
      baseURL: config.openaiBaseUrl,
    });
  }

  async verifyToken(token: string): Promise<boolean> {
    return verifyAdminToken({ baseUrl: this.config.adminApiBaseUrl }, token);
  }

  async createExecutionRequest(
    candidate: TodoCandidate,
    token: string,
    requestedByUserId: string,
  ): Promise<AdminExecRequest | null> {
    const context = buildContextFromCandidate(candidate);
    const target = await this.planner.extractTarget(context);

    if (target.targetType === "unknown") {
      await this.deps.decisionLogRepository.append(
        {
          actor: "AI",
          action: "HOLD",
          reason: "Admin target unknown",
          timestamp: new Date(),
        },
        candidate.id,
      );
      return null;
    }

    let state: unknown = null;
    if (target.targetType === "user" && target.userId) {
      const response = await getUserDetail({ baseUrl: this.config.adminApiBaseUrl }, token, target.userId);
      state = response.body;
    }

    if (target.targetType === "org" && target.orgId) {
      const response = await getOrgSummary({ baseUrl: this.config.adminApiBaseUrl }, token, target.orgId);
      state = response.body;
    }

    const plan = await this.planner.decidePlan(context, target, state);
    if (plan.actionType === "none") {
      await this.deps.decisionLogRepository.append(
        {
          actor: "AI",
          action: "HOLD",
          reason: plan.rationale.join(" | "),
          timestamp: new Date(),
        },
        candidate.id,
      );
      return null;
    }

    const tool = getToolDefinition(plan.actionType);
    const validation = validatePlan(plan, tool);
    if (!validation.ok) {
      await this.deps.decisionLogRepository.append(
        {
          actor: "AI",
          action: "HOLD",
          reason: `Admin plan invalid: ${validation.errors.join(" | ")}`,
          timestamp: new Date(),
        },
        candidate.id,
      );
      return null;
    }

    const request: AdminExecRequest = {
      id: randomUUID(),
      candidateId: candidate.id,
      status: "PENDING_APPROVAL",
      actionType: plan.actionType,
      requestedByUserId,
      targetUserId: plan.params.userId,
      targetOrgId: plan.params.orgId,
      payload: plan.payload,
      rationale: plan.rationale.join(" | "),
    };

    await this.deps.requestRepository.create(request);
    await this.deps.decisionLogRepository.append(
      {
        actor: "AI",
        action: "HOLD",
        reason: `Admin exec pending: ${plan.actionType}`,
        timestamp: new Date(),
      },
      candidate.id,
    );

    return request;
  }

  async approveAndExecute(requestId: string, token: string): Promise<void> {
    const request = await this.deps.requestRepository.getById(requestId);
    if (!request) {
      return;
    }

    const tool = getToolDefinition(request.actionType);
    const validation = validatePlan(
      {
        actionType: request.actionType,
        params: {
          userId: request.targetUserId ?? "",
          orgId: request.targetOrgId ?? "",
        },
        payload: request.payload ?? {},
        rationale: [],
      },
      tool,
    );

    if (!validation.ok) {
      await this.deps.requestRepository.updateStatus(requestId, "FAILED");
      await this.deps.decisionLogRepository.append({
        actor: "HUMAN",
        action: "HOLD",
        reason: `Admin exec invalid: ${validation.errors.join(" | ")}`,
        timestamp: new Date(),
      });
      return;
    }

    await this.deps.requestRepository.updateStatus(requestId, "APPROVED");

    const endpoint = resolveAdminEndpoint(request.actionType as AdminEndpoint, {
      userId: request.targetUserId ?? "",
      orgId: request.targetOrgId ?? "",
    });

    const response = await executeAdminAction(
      { baseUrl: this.config.adminApiBaseUrl },
      token,
      endpoint,
      request.payload,
    );

    if (!response.ok) {
      await this.deps.requestRepository.updateStatus(requestId, "FAILED");
      await this.deps.decisionLogRepository.append({
        actor: "HUMAN",
        action: "HOLD",
        reason: "Admin exec failed",
        timestamp: new Date(),
      });
      return;
    }

    await this.deps.requestRepository.updateStatus(requestId, "EXECUTED");
    await this.deps.decisionLogRepository.append({
      actor: "HUMAN",
      action: "CREATE",
      reason: `Admin exec executed: ${request.actionType}`,
      timestamp: new Date(),
    });
  }

  async reject(requestId: string): Promise<void> {
    await this.deps.requestRepository.updateStatus(requestId, "REJECTED");
  }
}

function buildContextFromCandidate(candidate: TodoCandidate): ContextObject {
  return {
    event: {
      source: candidate.source as ContextObject["event"]["source"],
      eventId: candidate.id,
      timestamp: new Date().toISOString(),
      payload: null,
    },
    normalizedText: candidate.title,
    metadata: {},
  };
}
