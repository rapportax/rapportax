/**
 * Typed EventEmitter for workflow visualization events.
 *
 * External packages can import and use this emitter to send workflow events
 * when running in the same process as obligation-bot.
 */

import { EventEmitter } from "events";
import type { WorkflowSession, WorkflowEvent } from "./types";

/**
 * Event map defining the typed events supported by WorkflowVizEmitter
 */
export interface WorkflowVizEventMap {
  "session:start": WorkflowSession;
  "session:end": { sessionId: string };
  "workflow:event": WorkflowEvent;
}

/**
 * Typed EventEmitter for workflow visualization.
 * Provides type-safe emit and on methods.
 */
export class WorkflowVizEmitter {
  private emitter = new EventEmitter();

  /**
   * Emit a typed event
   */
  emit<K extends keyof WorkflowVizEventMap>(
    event: K,
    payload: WorkflowVizEventMap[K],
  ): boolean {
    return this.emitter.emit(event, payload);
  }

  /**
   * Subscribe to a typed event
   */
  on<K extends keyof WorkflowVizEventMap>(
    event: K,
    listener: (payload: WorkflowVizEventMap[K]) => void,
  ): this {
    this.emitter.on(event, listener);
    return this;
  }

  /**
   * Subscribe to a typed event (once)
   */
  once<K extends keyof WorkflowVizEventMap>(
    event: K,
    listener: (payload: WorkflowVizEventMap[K]) => void,
  ): this {
    this.emitter.once(event, listener);
    return this;
  }

  /**
   * Remove a listener
   */
  off<K extends keyof WorkflowVizEventMap>(
    event: K,
    listener: (payload: WorkflowVizEventMap[K]) => void,
  ): this {
    this.emitter.off(event, listener);
    return this;
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof WorkflowVizEventMap>(event?: K): this {
    this.emitter.removeAllListeners(event);
    return this;
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends keyof WorkflowVizEventMap>(event: K): number {
    return this.emitter.listenerCount(event);
  }
}

/**
 * Singleton instance for cross-package communication within the same process.
 * External services can import this to emit workflow events.
 *
 * @example
 * ```typescript
 * import { workflowVizEvents } from '@rapportax/obligation-bot/workflow-viz';
 *
 * workflowVizEvents.emit('session:start', {
 *   sessionId: 'abc123',
 *   channelId: 'C12345',
 *   threadTs: '1234567890.123456',
 * });
 *
 * workflowVizEvents.emit('workflow:event', {
 *   sessionId: 'abc123',
 *   type: 'agent:start',
 *   timestamp: new Date().toISOString(),
 *   data: { agentName: 'PO Agent', status: 'running' },
 * });
 * ```
 */
export const workflowVizEvents = new WorkflowVizEmitter();
