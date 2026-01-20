/**
 * Test script for workflow visualization
 *
 * Usage:
 *   npx tsx scripts/test-workflow-viz.ts <channel_id> <thread_ts>
 *
 * Prerequisites:
 *   - Set SLACK_BOT_TOKEN in .env or environment
 *   - Get channel_id and thread_ts from a Slack message link
 *
 * To get thread_ts from Slack:
 *   1. Right-click a message in Slack
 *   2. Click 'Copy link'
 *   3. URL format: https://xxx.slack.com/archives/CHANNEL_ID/p1234567890123456
 *      - CHANNEL_ID is after /archives/
 *      - thread_ts: add a dot before last 6 digits (p1234567890123456 -> 1234567890.123456)
 */

import { config } from "dotenv";
config();

import {
  WorkflowVisualizationService,
  workflowVizEvents,
} from "../src/workflow-viz";

// Configuration
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL_ID = process.argv[2];
const THREAD_TS = process.argv[3];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testWithService() {
  if (!BOT_TOKEN) {
    console.error("Error: SLACK_BOT_TOKEN is required");
    process.exit(1);
  }

  if (!CHANNEL_ID || !THREAD_TS) {
    console.log("\nUsage:");
    console.log("  npx tsx scripts/test-workflow-viz.ts <channel_id> <thread_ts>");
    console.log("\nExample:");
    console.log("  npx tsx scripts/test-workflow-viz.ts C08XXXXXX 1737012345.678901");
    console.log("\nTo get thread_ts from Slack:");
    console.log("  1. Right-click a message in Slack");
    console.log("  2. Click 'Copy link'");
    console.log("  3. URL: https://xxx.slack.com/archives/CHANNEL_ID/p1234567890123456");
    console.log("     - CHANNEL_ID is after /archives/");
    console.log("     - thread_ts: p1234567890123456 -> 1234567890.123456");
    process.exit(1);
  }

  console.log("Testing WorkflowVisualizationService...\n");
  console.log(`Channel: ${CHANNEL_ID}`);
  console.log(`Thread: ${THREAD_TS}`);

  const service = new WorkflowVisualizationService({ botToken: BOT_TOKEN });
  const sessionId = `test-${Date.now()}`;

  // Start session
  console.log("\n1. Starting session...");
  await service.startSession({
    sessionId,
    channelId: CHANNEL_ID,
    threadTs: THREAD_TS,
  });
  await sleep(1000);

  // Workflow start
  console.log("2. Sending workflow:start...");
  await service.handleEvent({
    sessionId,
    type: "workflow:start",
    timestamp: new Date().toISOString(),
    data: { message: "Testing Multi-Agent Workflow" },
  });
  await sleep(1500);

  // Agent 1 start
  console.log("3. Sending agent:start (PO Agent)...");
  await service.handleEvent({
    sessionId,
    type: "agent:start",
    timestamp: new Date().toISOString(),
    data: { agentName: "PO Agent", status: "running" },
  });
  await sleep(2000);

  // Progress update
  console.log("4. Sending progress:update...");
  await service.handleEvent({
    sessionId,
    type: "progress:update",
    timestamp: new Date().toISOString(),
    data: { progress: { current: 1, total: 4 } },
  });
  await sleep(1500);

  // Agent 1 complete
  console.log("5. Sending agent:complete (PO Agent)...");
  await service.handleEvent({
    sessionId,
    type: "agent:complete",
    timestamp: new Date().toISOString(),
    data: { agentName: "PO Agent", duration: 2000 },
  });
  await sleep(1000);

  // Agent 2 start
  console.log("6. Sending agent:start (Developer Agent)...");
  await service.handleEvent({
    sessionId,
    type: "agent:start",
    timestamp: new Date().toISOString(),
    data: { agentName: "Developer Agent", status: "running" },
  });
  await sleep(1500);

  // Tool call
  console.log("7. Sending tool:call...");
  await service.handleEvent({
    sessionId,
    type: "tool:call",
    timestamp: new Date().toISOString(),
    data: { toolName: "code_search" },
  });
  await sleep(2000);

  // Progress update
  console.log("8. Sending progress:update...");
  await service.handleEvent({
    sessionId,
    type: "progress:update",
    timestamp: new Date().toISOString(),
    data: { progress: { current: 2, total: 4 } },
  });
  await sleep(1000);

  // Agent 2 complete
  console.log("9. Sending agent:complete (Developer Agent)...");
  await service.handleEvent({
    sessionId,
    type: "agent:complete",
    timestamp: new Date().toISOString(),
    data: { agentName: "Developer Agent", duration: 3500 },
  });
  await sleep(1000);

  // Workflow complete
  console.log("10. Sending workflow:complete...");
  await service.handleEvent({
    sessionId,
    type: "workflow:complete",
    timestamp: new Date().toISOString(),
    data: { message: "All agents completed successfully" },
  });
  await sleep(1500);

  console.log("\nTest completed! Check the Slack thread for visualization.");
}

async function testWithEventEmitter() {
  if (!BOT_TOKEN || !CHANNEL_ID || !THREAD_TS) {
    return;
  }

  console.log("\n\nTesting via EventEmitter...\n");

  // Initialize service and connect to emitter (simulating socket-app.ts)
  const service = new WorkflowVisualizationService({ botToken: BOT_TOKEN });

  workflowVizEvents.on("session:start", (session) => {
    service.startSession(session);
  });

  workflowVizEvents.on("workflow:event", (event) => {
    service.handleEvent(event);
  });

  const sessionId = `emitter-test-${Date.now()}`;

  // Emit events
  workflowVizEvents.emit("session:start", {
    sessionId,
    channelId: CHANNEL_ID,
    threadTs: THREAD_TS,
  });

  await sleep(1000);

  workflowVizEvents.emit("workflow:event", {
    sessionId,
    type: "workflow:start",
    timestamp: new Date().toISOString(),
    data: { message: "EventEmitter Test Workflow" },
  });

  await sleep(1500);

  workflowVizEvents.emit("workflow:event", {
    sessionId,
    type: "agent:start",
    timestamp: new Date().toISOString(),
    data: { agentName: "Test Agent", status: "running" },
  });

  await sleep(2000);

  workflowVizEvents.emit("workflow:event", {
    sessionId,
    type: "agent:complete",
    timestamp: new Date().toISOString(),
    data: { agentName: "Test Agent", duration: 2000 },
  });

  await sleep(1000);

  workflowVizEvents.emit("workflow:event", {
    sessionId,
    type: "workflow:complete",
    timestamp: new Date().toISOString(),
    data: {},
  });

  await sleep(1500);

  console.log("EventEmitter test completed!");
}

// Run tests
testWithService()
  .then(() => testWithEventEmitter())
  .then(() => {
    console.log("\nAll tests completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
