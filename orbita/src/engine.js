import { loadState, mutateState, logActivity } from "./store.js";
import { requiresApproval } from "./policy.js";

export function status() {
  const state = loadState();
  return {
    assistant: "F.R.I.D.A.Y.",
    module: "ORBITA",
    status: "ONLINE",
    project: state.project,
    counts: {
      investors: state.investors.length,
      openTasks: state.tasks.filter(t => t.status !== "done").length,
      pendingApprovals: state.approvals.filter(a => a.status === "pending").length,
      activityEvents: state.activity.length
    },
    timestamp: new Date().toISOString()
  };
}

export function addInvestor(input) {
  const investor = {
    id: crypto.randomUUID(),
    name: input.name,
    organization: input.organization || null,
    email: input.email || null,
    website: input.website || null,
    thesis: input.thesis || null,
    stage: input.stage || "discovered",
    notes: input.notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  mutateState(state => state.investors.push(investor));
  logActivity("investor_added", { investorId: investor.id });
  return investor;
}

export function addTask(input) {
  const task = {
    id: crypto.randomUUID(),
    title: input.title,
    type: input.type || "general",
    status: "open",
    priority: input.priority || "normal",
    dueAt: input.dueAt || null,
    createdAt: new Date().toISOString()
  };

  mutateState(state => state.tasks.push(task));
  logActivity("task_created", { taskId: task.id });
  return task;
}

export function requestAction(action, details = {}) {
  if (!requiresApproval(action)) {
    logActivity("action_authorized", { action, details });
    return { status: "authorized", action, details };
  }

  const approval = {
    id: crypto.randomUUID(),
    action,
    details,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  mutateState(state => state.approvals.push(approval));
  logActivity("approval_requested", { approvalId: approval.id, action });

  return {
    status: "approval_required",
    approval
  };
}

export function listApprovals() {
  return loadState().approvals.filter(a => a.status === "pending");
}

export function listInvestors() {
  return loadState().investors;
}

export function listTasks() {
  return loadState().tasks;
}

export function heartbeat() {
  logActivity("heartbeat", { worker: "orbita" });
  return status();
}
