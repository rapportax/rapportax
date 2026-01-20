/**
 * HTTP API handlers for workflow visualization.
 *
 * Allows external services (running in different processes) to send
 * workflow events via HTTP POST requests.
 */

import type { Router, Request, Response } from "express";
import { Router as createRouter } from "express";
import type { WorkflowVisualizationService } from "./service";
import type { WorkflowSession, WorkflowEvent } from "./types";

/**
 * Create an Express router with workflow visualization endpoints.
 *
 * Endpoints:
 * - POST /workflow/session - Start a new session
 * - POST /workflow/event - Send a workflow event
 * - GET /workflow/session/:sessionId - Get session state (debugging)
 * - DELETE /workflow/session/:sessionId - End a session
 */
export function createWorkflowVizRouter(
  service: WorkflowVisualizationService,
): Router {
  const router = createRouter();

  // Parse JSON body
  router.use((req, res, next) => {
    if (req.headers["content-type"]?.includes("application/json")) {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          (req as Request & { body: unknown }).body = JSON.parse(body);
          next();
        } catch {
          res.status(400).json({ ok: false, error: "Invalid JSON" });
        }
      });
    } else {
      next();
    }
  });

  /**
   * POST /workflow/session
   * Start a new workflow visualization session.
   *
   * Body: { sessionId, channelId, threadTs }
   */
  router.post("/workflow/session", async (req: Request, res: Response) => {
    try {
      const body = (req as Request & { body: unknown }).body as Partial<WorkflowSession>;

      // Validate required fields
      if (!body.sessionId || !body.channelId || !body.threadTs) {
        res.status(400).json({
          ok: false,
          error: "Missing required fields: sessionId, channelId, threadTs",
        });
        return;
      }

      const session: WorkflowSession = {
        sessionId: body.sessionId,
        channelId: body.channelId,
        threadTs: body.threadTs,
      };

      await service.startSession(session);

      res.json({
        ok: true,
        sessionId: session.sessionId,
        message: "Session started",
      });
    } catch (error) {
      console.error("[workflow-viz] Error starting session:", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * POST /workflow/event
   * Send a workflow event to update the visualization.
   *
   * Body: { sessionId, type, timestamp, data }
   */
  router.post("/workflow/event", async (req: Request, res: Response) => {
    try {
      const body = (req as Request & { body: unknown }).body as Partial<WorkflowEvent>;

      // Validate required fields
      if (!body.sessionId || !body.type) {
        res.status(400).json({
          ok: false,
          error: "Missing required fields: sessionId, type",
        });
        return;
      }

      // Check if session exists
      if (!service.hasSession(body.sessionId)) {
        res.status(404).json({
          ok: false,
          error: `Session not found: ${body.sessionId}`,
        });
        return;
      }

      const event: WorkflowEvent = {
        sessionId: body.sessionId,
        type: body.type,
        timestamp: body.timestamp ?? new Date().toISOString(),
        data: body.data ?? {},
      };

      await service.handleEvent(event);

      res.json({ ok: true });
    } catch (error) {
      console.error("[workflow-viz] Error handling event:", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /workflow/session/:sessionId
   * Get the current state of a session (for debugging).
   */
  router.get("/workflow/session/:sessionId", (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const state = service.getState(sessionId);
    const session = service.getSession(sessionId);

    if (!state || !session) {
      res.status(404).json({
        ok: false,
        error: `Session not found: ${sessionId}`,
      });
      return;
    }

    res.json({
      ok: true,
      session,
      state,
    });
  });

  /**
   * DELETE /workflow/session/:sessionId
   * End a session.
   */
  router.delete(
    "/workflow/session/:sessionId",
    async (req: Request, res: Response) => {
      const { sessionId } = req.params;

      if (!service.hasSession(sessionId)) {
        res.status(404).json({
          ok: false,
          error: `Session not found: ${sessionId}`,
        });
        return;
      }

      await service.endSession(sessionId);

      res.json({
        ok: true,
        message: "Session ended",
      });
    },
  );

  return router;
}
