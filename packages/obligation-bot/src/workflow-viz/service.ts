/**
 * WorkflowVisualizationService
 *
 * Manages workflow sessions and updates Slack messages in real-time
 * based on workflow events from external services.
 */

import type {
  WorkflowSession,
  WorkflowEvent,
  WorkflowUIState,
  WorkflowStep,
} from "./types";
import { buildWorkflowBlocks, buildCompletionBlocks, SlackBlock } from "./blocks";

export interface WorkflowVizConfig {
  botToken: string;
}

interface SlackChatPostResponse {
  ok: boolean;
  ts?: string;
  error?: string;
}

interface SlackChatUpdateResponse {
  ok: boolean;
  error?: string;
}

/**
 * Service that receives workflow events and visualizes them in Slack threads.
 */
export class WorkflowVisualizationService {
  /** Active sessions mapped by sessionId */
  private sessions = new Map<string, WorkflowSession>();
  /** UI state for each session */
  private states = new Map<string, WorkflowUIState>();
  /** Debounce timers for message updates */
  private updateTimers = new Map<string, NodeJS.Timeout>();
  /** Update debounce interval in ms */
  private readonly debounceMs = 500;

  constructor(private config: WorkflowVizConfig) {}

  /**
   * Start a new workflow visualization session.
   * This creates a new message in the specified Slack thread.
   */
  async startSession(session: WorkflowSession): Promise<void> {
    console.log(
      `[workflow-viz] Starting session ${session.sessionId} in channel ${session.channelId}`,
    );

    // Store session
    this.sessions.set(session.sessionId, { ...session });

    // Initialize UI state
    const initialState: WorkflowUIState = {
      title: "Agent Workflow",
      status: "running",
      steps: [],
      startTime: new Date(),
    };
    this.states.set(session.sessionId, initialState);

    // Post initial message to Slack
    await this.postInitialMessage(session.sessionId);
  }

  /**
   * End a workflow session and clean up resources.
   */
  async endSession(sessionId: string): Promise<void> {
    console.log(`[workflow-viz] Ending session ${sessionId}`);

    // Clear any pending update timer
    const timer = this.updateTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.updateTimers.delete(sessionId);
    }

    // Final update before cleanup
    await this.updateSlackMessage(sessionId);

    // Clean up after a delay to allow final updates
    setTimeout(() => {
      this.sessions.delete(sessionId);
      this.states.delete(sessionId);
    }, 5000);
  }

  /**
   * Handle an incoming workflow event.
   * Updates the UI state and schedules a Slack message update.
   */
  async handleEvent(event: WorkflowEvent): Promise<void> {
    const { sessionId, type, data } = event;

    console.log(`[workflow-viz] Event: ${type} for session ${sessionId}`);

    const state = this.states.get(sessionId);
    if (!state) {
      console.warn(
        `[workflow-viz] No state found for session ${sessionId}, ignoring event`,
      );
      return;
    }

    // Update state based on event type
    this.updateState(state, type, data);

    // Schedule debounced Slack update
    this.scheduleUpdate(sessionId);
  }

  /**
   * Get the current state for a session (for debugging/HTTP API).
   */
  getState(sessionId: string): WorkflowUIState | undefined {
    return this.states.get(sessionId);
  }

  /**
   * Get a session by ID.
   */
  getSession(sessionId: string): WorkflowSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if a session exists.
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Update UI state based on event type.
   */
  private updateState(
    state: WorkflowUIState,
    type: string,
    data: WorkflowEvent["data"],
  ): void {
    switch (type) {
      case "workflow:start":
        state.status = "running";
        if (data.message) {
          state.title = data.message;
        }
        break;

      case "workflow:complete":
        state.status = "completed";
        break;

      case "workflow:error":
        state.status = "failed";
        state.lastError = data.error ?? data.message;
        break;

      case "agent:start":
      case "step:start":
        this.handleStepStart(state, data);
        break;

      case "agent:complete":
      case "step:complete":
        this.handleStepComplete(state, data);
        break;

      case "agent:error":
        this.handleStepError(state, data);
        break;

      case "tool:call":
        this.handleToolCall(state, data);
        break;

      case "tool:result":
        // Could update the current step with tool result info
        break;

      case "progress:update":
        if (data.progress) {
          state.progress = data.progress;
        }
        if (data.status === "running") {
          state.turn = data.progress?.current;
        }
        break;

      default:
        // Handle custom event types - just log
        console.log(`[workflow-viz] Custom event type: ${type}`);
        break;
    }
  }

  /**
   * Handle step/agent start event
   */
  private handleStepStart(
    state: WorkflowUIState,
    data: WorkflowEvent["data"],
  ): void {
    const name = data.agentName ?? data.stepName ?? "Unknown Step";

    // Check if step already exists
    const existingStep = state.steps.find((s) => s.name === name);
    if (existingStep) {
      existingStep.status = "running";
      existingStep.startTime = new Date();
      existingStep.message = data.message;
    } else {
      // Add new step
      const step: WorkflowStep = {
        name,
        status: "running",
        startTime: new Date(),
        message: data.message,
      };
      state.steps.push(step);
    }
  }

  /**
   * Handle step/agent complete event
   */
  private handleStepComplete(
    state: WorkflowUIState,
    data: WorkflowEvent["data"],
  ): void {
    const name = data.agentName ?? data.stepName;
    if (!name) return;

    const step = state.steps.find((s) => s.name === name);
    if (step) {
      step.status = "done";
      if (data.duration !== undefined) {
        step.duration = data.duration;
      } else if (step.startTime) {
        step.duration = Date.now() - step.startTime.getTime();
      }
      step.message = data.message;
    }
  }

  /**
   * Handle step/agent error event
   */
  private handleStepError(
    state: WorkflowUIState,
    data: WorkflowEvent["data"],
  ): void {
    const name = data.agentName ?? data.stepName;
    if (!name) return;

    const step = state.steps.find((s) => s.name === name);
    if (step) {
      step.status = "error";
      step.message = data.error ?? data.message;
      if (step.startTime) {
        step.duration = Date.now() - step.startTime.getTime();
      }
    }

    // Also update workflow status
    state.status = "failed";
    state.lastError = data.error ?? data.message;
  }

  /**
   * Handle tool call event - update current running step
   */
  private handleToolCall(
    state: WorkflowUIState,
    data: WorkflowEvent["data"],
  ): void {
    const runningStep = state.steps.find((s) => s.status === "running");
    if (runningStep && data.toolName) {
      runningStep.message = `Calling ${data.toolName}...`;
    }
  }

  /**
   * Schedule a debounced Slack message update.
   */
  private scheduleUpdate(sessionId: string): void {
    // Clear existing timer
    const existingTimer = this.updateTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new update
    const timer = setTimeout(() => {
      this.updateSlackMessage(sessionId).catch((err) => {
        console.error(`[workflow-viz] Error updating Slack message:`, err);
      });
      this.updateTimers.delete(sessionId);
    }, this.debounceMs);

    this.updateTimers.set(sessionId, timer);
  }

  /**
   * Post the initial visualization message to Slack.
   */
  private async postInitialMessage(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const state = this.states.get(sessionId);
    if (!session || !state) return;

    const blocks = buildWorkflowBlocks(state, sessionId);
    const response = await this.slackChatPostMessage(
      session.channelId,
      blocks,
      session.threadTs,
    );

    if (response.ok && response.ts) {
      session.messageTs = response.ts;
    }
  }

  /**
   * Update the Slack message with current state.
   */
  private async updateSlackMessage(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const state = this.states.get(sessionId);
    if (!session || !state) return;

    // If no message posted yet, post initial
    if (!session.messageTs) {
      await this.postInitialMessage(sessionId);
      return;
    }

    // Use completion blocks if workflow is done
    const blocks =
      state.status === "running"
        ? buildWorkflowBlocks(state, sessionId)
        : buildCompletionBlocks(state, sessionId);

    await this.slackChatUpdate(
      session.channelId,
      session.messageTs,
      blocks,
    );
  }

  /**
   * Post a message to Slack.
   */
  private async slackChatPostMessage(
    channel: string,
    blocks: SlackBlock[],
    threadTs?: string,
  ): Promise<SlackChatPostResponse> {
    const body: Record<string, unknown> = {
      channel,
      blocks,
      text: "Workflow Progress", // Fallback text
    };

    if (threadTs) {
      body.thread_ts = threadTs;
    }

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[workflow-viz] Slack postMessage failed: ${response.status}`);
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const result = (await response.json()) as SlackChatPostResponse;
    if (!result.ok) {
      console.error(`[workflow-viz] Slack postMessage error: ${result.error}`);
    }
    return result;
  }

  /**
   * Update an existing Slack message.
   */
  private async slackChatUpdate(
    channel: string,
    ts: string,
    blocks: SlackBlock[],
  ): Promise<SlackChatUpdateResponse> {
    const body = {
      channel,
      ts,
      blocks,
      text: "Workflow Progress", // Fallback text
    };

    const response = await fetch("https://slack.com/api/chat.update", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[workflow-viz] Slack update failed: ${response.status}`);
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const result = (await response.json()) as SlackChatUpdateResponse;
    if (!result.ok) {
      console.error(`[workflow-viz] Slack update error: ${result.error}`);
    }
    return result;
  }
}
