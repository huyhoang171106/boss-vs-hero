/**
 * Loop Engineering Extension - Types
 *
 * Implements the 8-component loop for AI coding agents:
 * Goal, Planner, Executor, Verifier, Reflector, Memory, Stop Condition, Priority Engine
 */

// ── Priority Levels ──────────────────────────────────────────────
export type Priority = "critical" | "high" | "medium" | "low" | "style";

export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  style: 4,
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "🔴 CRITICAL (crash/security/data loss)",
  high: "🟠 HIGH (security/performance bug)",
  medium: "🟡 MEDIUM (functional bug)",
  low: "🔵 LOW (UX/improvement)",
  style: "⚪ STYLE (code style/refactor)",
};

// ── Loop Phase ───────────────────────────────────────────────────
export type LoopPhase =
  | "idle"
  | "planning"
  | "executing"
  | "verifying"
  | "reflecting"
  | "completed"
  | "failed"
  | "stopped";

export const PHASE_LABELS: Record<LoopPhase, string> = {
  idle: "⏳ Idle",
  planning: "📝 Planning",
  executing: "⚡ Executing",
  verifying: "🔍 Verifying",
  reflecting: "🪞 Reflecting",
  completed: "✅ Completed",
  failed: "❌ Failed",
  stopped: "🛑 Stopped",
};

// ── Task ─────────────────────────────────────────────────────────
export interface LoopTask {
  id: number;
  text: string;
  priority: Priority;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  createdAt: number;
  completedAt?: number;
  source: "plan" | "reflector" | "user";
  verification?: string;
}

// ── Verification ─────────────────────────────────────────────────
export interface VerificationStep {
  name: string;
  command: string;
  passed: boolean;
  output?: string;
  duration?: number;
}

// ── Memory Entry ─────────────────────────────────────────────────
export interface MemoryEntry {
  key: string;
  value: string;
  timestamp: number;
  category: "decision" | "architecture" | "bug" | "context" | "constraint";
}

// ── Loop State ───────────────────────────────────────────────────
export interface LoopState {
  goal: string;
  definitionOfDone: string[];
  phase: LoopPhase;
  tasks: LoopTask[];
  completedTasks: number[];
  memory: MemoryEntry[];
  verifications: VerificationStep[];
  iterationCount: number;
  maxIterations: number;
  startedAt: number;
  lastActivityAt: number;
  errors: string[];
  filesModified: string[];
  autoRepeat: boolean;  // Auto-restart loop when all tasks complete
  neverStop: boolean;   // Ignore all stop conditions, keep going forever
}

// ── Default State ────────────────────────────────────────────────
export function createEmptyState(): LoopState {
  return {
    goal: "",
    definitionOfDone: [],
    phase: "idle",
    tasks: [],
    completedTasks: [],
    memory: [],
    verifications: [],
    iterationCount: 0,
    maxIterations: 50,
    startedAt: 0,
    lastActivityAt: 0,
    errors: [],
    filesModified: [],
    autoRepeat: false,
    neverStop: false,
  };
}

// ── Stop Conditions ──────────────────────────────────────────────
export interface StopCheckResult {
  shouldStop: boolean;
  reason?: string;
}

export function checkStopConditions(state: LoopState): StopCheckResult {
  // Never stop mode: ignore all stop conditions
  if (state.neverStop) {
    return { shouldStop: false };
  }

  // Auto-repeat mode: don't stop on task completion, will auto-restart
  if (state.autoRepeat) {
    // Still check max iterations and errors
    if (state.iterationCount >= state.maxIterations) {
      return {
        shouldStop: true,
        reason: `Max iterations (${state.maxIterations}) reached.`,
      };
    }
    const recentErrors = state.errors.slice(-3);
    if (recentErrors.length >= 3) {
      return {
        shouldStop: true,
        reason: "3 consecutive errors. Loop may be stuck.",
      };
    }
    return { shouldStop: false };
  }

  // All tasks completed
  const allTasksDone = state.tasks.length > 0 && state.tasks.every(
    (t) => t.status === "completed" || t.status === "skipped"
  );
  if (allTasksDone && state.definitionOfDone.length > 0) {
    // Check if Definition of Done is satisfied
    // (the agent should verify this, but we can check task completion)
    return {
      shouldStop: true,
      reason: "All tasks completed. Verify Definition of Done is satisfied.",
    };
  }

  // Max iterations reached
  if (state.iterationCount >= state.maxIterations) {
    return {
      shouldStop: true,
      reason: `Max iterations (${state.maxIterations}) reached.`,
    };
  }

  // Too many consecutive errors
  const recentErrors = state.errors.slice(-3);
  if (recentErrors.length >= 3) {
    return {
      shouldStop: true,
      reason: "3 consecutive errors. Loop may be stuck.",
    };
  }

  return { shouldStop: false };
}

// ── Priority Sorting ─────────────────────────────────────────────
export function sortTasksByPriority(tasks: LoopTask[]): LoopTask[] {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority];
    const pb = PRIORITY_ORDER[b.priority];
    if (pa !== pb) return pa - pb;
    // Same priority: pending first, then by creation time
    if (a.status !== b.status) {
      if (a.status === "pending") return -1;
      if (b.status === "pending") return 1;
    }
    return a.createdAt - b.createdAt;
  });
}

export function getNextTask(state: LoopState): LoopTask | null {
  const pending = state.tasks.filter((t) => t.status === "pending");
  if (pending.length === 0) return null;
  const sorted = sortTasksByPriority(pending);
  return sorted[0];
}
