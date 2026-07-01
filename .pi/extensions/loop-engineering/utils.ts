/**
 * Loop Engineering Extension - Utilities
 */

import type { LoopState, LoopTask, MemoryEntry, VerificationStep, Priority } from "./types.js";

// ── Formatting ───────────────────────────────────────────────────

export function formatTask(task: LoopTask, index: number): string {
  const statusIcon =
    task.status === "completed"
      ? "✅"
      : task.status === "in_progress"
        ? "🔄"
        : task.status === "failed"
          ? "❌"
          : task.status === "skipped"
            ? "⏭️"
            : "⬜";

  const priorityIcon =
    task.priority === "critical"
      ? "🔴"
      : task.priority === "high"
        ? "🟠"
        : task.priority === "medium"
          ? "🟡"
          : task.priority === "low"
            ? "🔵"
            : "⚪";

  return `${statusIcon} ${priorityIcon} #${task.id} ${task.text}`;
}

export function formatState(state: LoopState): string {
  const lines: string[] = [];

  lines.push(`🎯 Goal: ${state.goal || "(not set)"}`);
  lines.push(`📋 Phase: ${state.phase}`);
  lines.push(`🔄 Iteration: ${state.iterationCount}/${state.maxIterations}`);
  lines.push("");

  if (state.definitionOfDone.length > 0) {
    lines.push("📏 Definition of Done:");
    for (const item of state.definitionOfDone) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
  }

  if (state.tasks.length > 0) {
    const pending = state.tasks.filter((t) => t.status === "pending").length;
    const inProgress = state.tasks.filter((t) => t.status === "in_progress").length;
    const completed = state.tasks.filter((t) => t.status === "completed").length;
    const failed = state.tasks.filter((t) => t.status === "failed").length;

    lines.push(`📊 Tasks: ${completed} done, ${inProgress} active, ${pending} pending, ${failed} failed`);
    lines.push("");

    // Show next task
    const nextTask = state.tasks.find((t) => t.status === "in_progress") ||
      state.tasks.filter((t) => t.status === "pending").sort((a, b) => {
        const prio: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, style: 4 };
        return (prio[a.priority] ?? 5) - (prio[b.priority] ?? 5);
      })[0];

    if (nextTask) {
      lines.push(`▶️  Next: ${formatTask(nextTask, 0)}`);
    }
  }

  if (state.memory.length > 0) {
    lines.push("");
    lines.push(`🧠 Memory: ${state.memory.length} entries`);
  }

  if (state.autoRepeat || state.neverStop) {
    lines.push("");
    const modes: string[] = [];
    if (state.neverStop) modes.push("🛑 NEVER STOP");
    if (state.autoRepeat) modes.push("🔄 AUTO REPEAT");
    lines.push(`⚙️  Modes: ${modes.join(", ")}`);
  }

  if (state.filesModified.length > 0) {
    lines.push("");
    lines.push(`📝 Files modified: ${state.filesModified.length}`);
  }

  if (state.errors.length > 0) {
    lines.push("");
    lines.push(`⚠️  Errors: ${state.errors.length}`);
  }

  return lines.join("\n");
}

export function formatWidget(state: LoopState): string[] {
  const lines: string[] = [];

  if (state.phase === "idle") {
    return [];
  }

  // Compact status line
  const phaseEmoji =
    state.phase === "planning"
      ? "📝"
      : state.phase === "executing"
        ? "⚡"
        : state.phase === "verifying"
          ? "🔍"
          : state.phase === "reflecting"
            ? "🪞"
            : state.phase === "completed"
              ? "✅"
              : state.phase === "failed"
                ? "❌"
                : "🛑";

  const pending = state.tasks.filter((t) => t.status === "pending").length;
  const completed = state.tasks.filter((t) => t.status === "completed").length;
  const total = state.tasks.length;

  lines.push(
    `${phaseEmoji} ${state.phase.toUpperCase()} | ` +
    `Tasks: ${completed}/${total} | ` +
    `Iter: ${state.iterationCount}/${state.maxIterations}` +
    (pending > 0 ? ` | Next: #${state.tasks.find((t) => t.status === "pending")?.id ?? "?"}` : "")
  );

  if (state.goal) {
    lines.push(`🎯 ${state.goal.slice(0, 80)}${state.goal.length > 80 ? "..." : ""}`);
  }

  return lines;
}

// ── Memory Helpers ───────────────────────────────────────────────

export function addMemory(
  state: LoopState,
  key: string,
  value: string,
  category: MemoryEntry["category"]
): void {
  // Upsert: update if exists, otherwise add
  const existing = state.memory.find((m) => m.key === key);
  if (existing) {
    existing.value = value;
    existing.timestamp = Date.now();
    existing.category = category;
  } else {
    state.memory.push({ key, value, timestamp: Date.now(), category });
  }
}

export function getMemoryByCategory(
  state: LoopState,
  category: MemoryEntry["category"]
): MemoryEntry[] {
  return state.memory.filter((m) => m.category === category);
}

export function formatMemory(state: LoopState): string {
  if (state.memory.length === 0) return "No memory entries.";

  const grouped: Record<string, MemoryEntry[]> = {};
  for (const entry of state.memory) {
    const cat = entry.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(entry);
  }

  const lines: string[] = [];
  const categoryLabels: Record<string, string> = {
    decision: "📋 Decisions",
    architecture: "🏗️ Architecture",
    bug: "🐛 Bug History",
    context: "📌 Context",
    constraint: "🚧 Constraints",
  };

  for (const [cat, entries] of Object.entries(grouped)) {
    lines.push(categoryLabels[cat] ?? cat);
    for (const entry of entries) {
      lines.push(`  • ${entry.key}: ${entry.value}`);
    }
  }

  return lines.join("\n");
}

// ── Verification Helpers ─────────────────────────────────────────

export function formatVerification(steps: VerificationStep[]): string {
  if (steps.length === 0) return "No verifications run.";

  const lines: string[] = [];
  for (const step of steps) {
    const icon = step.passed ? "✅" : "❌";
    const duration = step.duration ? ` (${step.duration}ms)` : "";
    lines.push(`${icon} ${step.name}${duration}`);
    if (!step.passed && step.output) {
      lines.push(`   ${step.output.slice(0, 200)}`);
    }
  }

  return lines.join("\n");
}

// ── Task Helpers ─────────────────────────────────────────────────

export function addTask(
  state: LoopState,
  text: string,
  priority: Priority = "medium",
  source: LoopTask["source"] = "plan"
): LoopTask {
  const task: LoopTask = {
    id: state.tasks.length > 0 ? Math.max(...state.tasks.map((t) => t.id)) + 1 : 1,
    text,
    priority,
    status: "pending",
    createdAt: Date.now(),
    source,
  };
  state.tasks.push(task);
  return task;
}

export function completeTask(state: LoopState, taskId: number): boolean {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  task.status = "completed";
  task.completedAt = Date.now();
  state.completedTasks.push(taskId);
  return true;
}

export function failTask(state: LoopState, taskId: number): boolean {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  task.status = "failed";
  return true;
}

export function reprioritizeTask(
  state: LoopState,
  taskId: number,
  newPriority: Priority
): boolean {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  task.priority = newPriority;
  return true;
}
