/**
 * Slack Block Kit UI builder for workflow visualization.
 */

import type { WorkflowUIState, WorkflowStatus, WorkflowStep } from "./types";

export type SlackBlock = Record<string, unknown>;

/**
 * Status emoji mapping
 */
const STATUS_EMOJI: Record<WorkflowStatus, string> = {
  pending: ":white_circle:",
  running: ":large_blue_circle:",
  done: ":white_check_mark:",
  error: ":x:",
};

/**
 * Workflow status emoji
 */
const WORKFLOW_STATUS_EMOJI: Record<
  "running" | "completed" | "failed",
  string
> = {
  running: ":hourglass_flowing_sand:",
  completed: ":white_check_mark:",
  failed: ":x:",
};

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Build a progress bar string
 */
function buildProgressBar(current: number, total: number, width = 10): string {
  const percentage = Math.min(current / total, 1);
  const filled = Math.round(percentage * width);
  const empty = width - filled;
  const filledChar = "\u2588"; // Full block
  const emptyChar = "\u2591"; // Light shade
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

/**
 * Calculate elapsed time since start
 */
function getElapsedTime(startTime: Date): string {
  const elapsed = Date.now() - startTime.getTime();
  return formatDuration(elapsed);
}

/**
 * Build step text with status and optional duration
 */
function buildStepText(step: WorkflowStep): string {
  const emoji = STATUS_EMOJI[step.status];
  let text = `${emoji} ${step.name}`;

  if (step.status === "running") {
    text += " _(running...)_";
  } else if (step.duration !== undefined) {
    text += ` (${formatDuration(step.duration)})`;
  }

  if (step.message) {
    text += `\n     _${step.message}_`;
  }

  return text;
}

/**
 * Build Slack blocks for workflow visualization
 *
 * @example Output:
 * ```
 * :hourglass_flowing_sand: Agent Workflow
 *
 * Task: 사용자 인증 기능 구현
 *
 * Turn 3/10 [████░░░░░░] 30%
 *
 * :white_check_mark: PO Agent (1.2s)
 * :large_blue_circle: Developer Agent (running...)
 * :white_circle: QA Agent
 * :white_circle: Implementation Agent
 *
 * _Elapsed: 5.3s | Session: abc123_
 * ```
 */
export function buildWorkflowBlocks(
  state: WorkflowUIState,
  sessionId?: string,
): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  // Header with status emoji
  const statusEmoji = WORKFLOW_STATUS_EMOJI[state.status];
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `${statusEmoji} ${state.title}`,
      emoji: true,
    },
  });

  // Task description (if provided in title)
  if (state.title.length > 30) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Task:* ${state.title}`,
      },
    });
  }

  // Progress section (if available)
  if (state.progress && state.progress.total > 0) {
    const { current, total } = state.progress;
    const percentage = Math.round((current / total) * 100);
    const progressBar = buildProgressBar(current, total);

    let progressText = `*Turn ${current}/${total}* [${progressBar}] ${percentage}%`;
    if (state.turn !== undefined) {
      progressText = `*Turn ${state.turn}* [${progressBar}] ${percentage}%`;
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: progressText,
      },
    });
  }

  // Divider
  blocks.push({ type: "divider" });

  // Steps/Agents list
  if (state.steps.length > 0) {
    const stepsText = state.steps.map(buildStepText).join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: stepsText,
      },
    });
  }

  // Error message (if failed)
  if (state.status === "failed" && state.lastError) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:warning: *Error:* ${state.lastError}`,
      },
    });
  }

  // Footer with elapsed time
  const elapsed = getElapsedTime(state.startTime);
  let footerText = `_Elapsed: ${elapsed}_`;
  if (sessionId) {
    footerText += ` _| Session: ${sessionId.slice(0, 8)}_`;
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: footerText,
      },
    ],
  });

  return blocks;
}

/**
 * Build a simple status message for workflow completion
 */
export function buildCompletionBlocks(
  state: WorkflowUIState,
  sessionId?: string,
): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  const statusEmoji =
    state.status === "completed" ? ":white_check_mark:" : ":x:";
  const statusText =
    state.status === "completed" ? "Workflow Completed" : "Workflow Failed";

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `${statusEmoji} ${statusText}`,
      emoji: true,
    },
  });

  // Summary of steps
  const completedSteps = state.steps.filter((s) => s.status === "done").length;
  const totalSteps = state.steps.length;
  const totalDuration = state.steps.reduce(
    (acc, s) => acc + (s.duration ?? 0),
    0,
  );

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        `*Summary*\n` +
        `Steps: ${completedSteps}/${totalSteps} completed\n` +
        `Total time: ${formatDuration(totalDuration)}`,
    },
  });

  // Show failed step if any
  const failedStep = state.steps.find((s) => s.status === "error");
  if (failedStep) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:x: Failed at: *${failedStep.name}*${failedStep.message ? `\n_${failedStep.message}_` : ""}`,
      },
    });
  }

  // Footer
  const elapsed = getElapsedTime(state.startTime);
  let footerText = `_Completed in: ${elapsed}_`;
  if (sessionId) {
    footerText += ` _| Session: ${sessionId.slice(0, 8)}_`;
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: footerText,
      },
    ],
  });

  return blocks;
}
