/**
 * Workflow Visualization Module
 *
 * This module provides real-time workflow visualization in Slack threads.
 * External services can emit workflow events either via:
 *
 * 1. EventEmitter (same process / monorepo packages):
 *    ```typescript
 *    import { workflowVizEvents } from '@rapportax/obligation-bot/workflow-viz';
 *
 *    workflowVizEvents.emit('session:start', {
 *      sessionId: 'abc123',
 *      channelId: 'C12345',
 *      threadTs: '1234567890.123456',
 *    });
 *
 *    workflowVizEvents.emit('workflow:event', {
 *      sessionId: 'abc123',
 *      type: 'agent:start',
 *      timestamp: new Date().toISOString(),
 *      data: { agentName: 'PO Agent', status: 'running' },
 *    });
 *    ```
 *
 * 2. HTTP API (different process / external service):
 *    ```bash
 *    POST http://localhost:3000/workflow/session
 *    { "sessionId": "abc123", "channelId": "C12345", "threadTs": "1234567890.123456" }
 *
 *    POST http://localhost:3000/workflow/event
 *    { "sessionId": "abc123", "type": "agent:start", "data": { "agentName": "PO Agent" } }
 *    ```
 *
 * @module workflow-viz
 */

// Types - the contract that external services must follow
export type {
  WorkflowSession,
  WorkflowEvent,
  WorkflowEventType,
  WorkflowEventData,
  WorkflowStatus,
  WorkflowUIState,
  WorkflowStep,
} from "./types";

// EventEmitter for same-process communication
export { WorkflowVizEmitter, workflowVizEvents } from "./emitter";
export type { WorkflowVizEventMap } from "./emitter";

// Service (used internally, but exported for advanced use cases)
export {
  WorkflowVisualizationService,
  type WorkflowVizConfig,
} from "./service";

// Block builders (for custom UI needs)
export { buildWorkflowBlocks, buildCompletionBlocks } from "./blocks";
export type { SlackBlock } from "./blocks";
