const timelineEl = document.getElementById("timeline");
const logEl = document.getElementById("log");
const runIdEl = document.getElementById("run-id");
const currentStepEl = document.getElementById("current-step");
const lastEventEl = document.getElementById("last-event");
const eventCountEl = document.getElementById("event-count");
const logCountEl = document.getElementById("log-count");
const statusValueEl = document.getElementById("status-value");

const agentLaneEl = document.getElementById("agent-lane");

const stepOrder = [
  "po_draft",
  "dev_research",
  "po_refine",
  "dev_plan",
  "implementation",
  "qa",
  "synthesis",
];

const agentLabels = {
  po_draft: "PO",
  po_refine: "PO",
  dev_research: "DEV R",
  dev_plan: "DEV",
  implementation: "IMPL",
  qa: "QA",
  synthesis: "ORCH",
};

const state = {
  events: [],
  runId: null,
  currentStep: null,
};

const formatTime = (iso) => {
  const date = new Date(iso);
  return date.toLocaleTimeString("ko-KR", { hour12: false });
};

const renderTimeline = () => {
  const items = state.events.slice(-5).reverse();
  timelineEl.innerHTML = items
    .map(
      (entry) => `
      <div class="timeline-item">
        <strong>${entry.message}</strong>
        <span>${formatTime(entry.timestamp)}</span>
      </div>`
    )
    .join("");
};

const renderLog = () => {
  logEl.innerHTML = state.events
    .slice(-120)
    .map(
      (entry) => `
      <div class="log-entry">
        <div class="meta">${formatTime(entry.timestamp)} · ${entry.message}</div>
        <code>${JSON.stringify(entry.data ?? {}, null, 0)}</code>
      </div>`
    )
    .join("");
  logEl.scrollTop = logEl.scrollHeight;
};

const renderAgents = () => {
  agentLaneEl.innerHTML = stepOrder
    .map((step) => {
      const activeIndex = state.currentStep
        ? stepOrder.indexOf(state.currentStep)
        : -1;
      const progress = activeIndex >= 0 ? (stepOrder.indexOf(step) <= activeIndex ? 100 : 20) : 0;
      return `
      <div class="agent-row">
        <div class="agent-tag">${agentLabels[step]}</div>
        <div class="agent-bar">
          <div class="agent-progress" style="width:${progress}%"></div>
        </div>
      </div>`;
    })
    .join("");
};

const updateSummary = () => {
  const last = state.events[state.events.length - 1];
  if (!last) {
    statusValueEl.textContent = "대기 중";
    return;
  }

  lastEventEl.textContent = formatTime(last.timestamp);
  eventCountEl.textContent = state.events.length;
  logCountEl.textContent = String(state.events.length);
  if (state.currentStep) {
    currentStepEl.textContent = state.currentStep;
    statusValueEl.textContent = "실행 중";
  }
};

const setRunId = (entry) => {
  if (entry?.data?.requestId) {
    state.runId = entry.data.requestId;
    runIdEl.textContent = `RUN: ${state.runId.slice(0, 8)}`;
  }
};

const updateStep = (entry) => {
  const match = entry.message.match(/workflow\.step\.([a-z_]+)\./);
  if (match) {
    state.currentStep = match[1];
  }
};

const ingestEntry = (entry) => {
  state.events.push(entry);
  setRunId(entry);
  updateStep(entry);
  renderTimeline();
  renderLog();
  renderAgents();
  updateSummary();
};

const init = () => {
  const eventSource = new EventSource("/events");

  eventSource.addEventListener("init", (event) => {
    const entries = JSON.parse(event.data || "[]");
    state.events = entries;
    if (entries.length > 0) {
      setRunId(entries[0]);
      updateStep(entries[entries.length - 1]);
    }
    renderTimeline();
    renderLog();
    renderAgents();
    updateSummary();
  });

  eventSource.addEventListener("log", (event) => {
    ingestEntry(JSON.parse(event.data));
  });
};

init();
