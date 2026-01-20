/**
 * Workflow Visualization Types
 *
 * These interfaces define the contract for external services to emit workflow events
 * that will be visualized in Slack threads.
 */

/**
 * A workflow session links a sessionId to a specific Slack thread.
 * External services must start a session before emitting events.
 */
export interface WorkflowSession {
  /** Unique session identifier */
  sessionId: string;
  /** Slack channel ID */
  channelId: string;
  /** Original message timestamp (thread parent) */
  threadTs: string;
  /** Visualization message timestamp (set by service after first message) */
  messageTs?: string;
}

/**
 * Event types that can be emitted during a workflow
 */
export type WorkflowEventType =
  | "workflow:start"
  | "workflow:complete"
  | "workflow:error"
  | "agent:start"
  | "agent:complete"
  | "agent:error"
  | "tool:call"
  | "tool:result"
  | "step:start"
  | "step:complete"
  | "progress:update";

/**
 * Status of a workflow step or agent
 */
export type WorkflowStatus = "pending" | "running" | "done" | "error";

/**
 * Data payload for workflow events.
 * All fields are optional to allow flexibility.
 */
export interface WorkflowEventData {
  /** Name of the agent (for agent events) */
  agentName?: string;
  /** Name of the tool (for tool events) */
  toolName?: string;
  /** Human-readable message */
  message?: string;
  /** Current status */
  status?: WorkflowStatus;
  /** Progress information */
  progress?: {
    current: number;
    total: number;
  };
  /** Duration in milliseconds */
  duration?: number;
  /** Error message (for error events) */
  error?: string;
  /** Step name (for step events) */
  stepName?: string;
  /** Tool input (for tool:call events) */
  toolInput?: unknown;
  /** Tool output (for tool:result events) */
  toolOutput?: unknown;
  /** Allow arbitrary additional data */
  [key: string]: unknown;
}

/**
 * A workflow event emitted by external services.
 */
export interface WorkflowEvent {
  /** Session ID this event belongs to */
  sessionId: string;
  /** Type of event */
  type: WorkflowEventType | string; // Allow custom event types
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event data payload */
  data: WorkflowEventData;
}

/**
 * Internal UI state for rendering Slack blocks
 */
export interface WorkflowUIState {
  /** Workflow title/description */
  title: string;
  /** Overall workflow status */
  status: "running" | "completed" | "failed";
  /** List of steps/agents */
  steps: WorkflowStep[];
  /** Overall progress */
  progress?: {
    current: number;
    total: number;
  };
  /** When the workflow started */
  startTime: Date;
  /** Current turn number (for multi-turn workflows) */
  turn?: number;
  /** Last error message */
  lastError?: string;
}

/**
 * A single step in the workflow visualization
 */
export interface WorkflowStep {
  /** Step/agent name */
  name: string;
  /** Current status */
  status: WorkflowStatus;
  /** Duration in milliseconds (when completed) */
  duration?: number;
  /** Additional message */
  message?: string;
  /** Start time */
  startTime?: Date;
}
