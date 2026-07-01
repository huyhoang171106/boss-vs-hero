/**
 * Loop Engineering Extension for Pi
 *
 * Implements an 8-component loop for systematic AI coding:
 * 1. Goal       - Clear objective with Definition of Done
 * 2. Planner    - Read project, plan, break into tasks
 * 3. Executor   - Small, targeted diffs
 * 4. Verifier   - Build, test, lint after each step
 * 5. Reflector  - Self-critique: bugs, edge cases, security
 * 6. Memory     - Persist decisions, architecture, bug history
 * 7. Stop       - Know when to stop
 * 8. Priority   - Auto-prioritize reflector-generated tasks
 *
 * Usage:
 *   /loop <goal>          - Start a new loop with a goal
 *   /loop-status          - Show current loop status
 *   /loop-stop            - Force stop the loop
 *   /loop-memory          - Show memory entries
 *
 * The LLM uses tools: loop_plan, loop_execute, loop_verify,
 * loop_reflect, loop_memory, loop_task, loop_status
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  type LoopState,
  type LoopTask,
  type Priority,
  type VerificationStep,
  type MemoryEntry,
  createEmptyState,
  checkStopConditions,
  sortTasksByPriority,
  getNextTask,
  PRIORITY_LABELS,
} from "./types.js";
import {
  formatState,
  formatWidget,
  formatTask,
  formatMemory,
  formatVerification,
  addMemory,
  addTask,
  completeTask,
  failTask,
  reprioritizeTask,
} from "./utils.js";
import { Text } from "@earendil-works/pi-tui";

// ── Schema Constants ─────────────────────────────────────────────

const PrioritySchema = Type.Union(
  [
    Type.Literal("critical"),
    Type.Literal("high"),
    Type.Literal("medium"),
    Type.Literal("low"),
    Type.Literal("style"),
  ],
  { description: "Task priority level" }
);

const TaskStatusSchema = Type.Union(
  [
    Type.Literal("pending"),
    Type.Literal("in_progress"),
    Type.Literal("completed"),
    Type.Literal("failed"),
    Type.Literal("skipped"),
  ],
  { description: "Task status" }
);

const MemoryCategorySchema = Type.Union(
  [
    Type.Literal("decision"),
    Type.Literal("architecture"),
    Type.Literal("bug"),
    Type.Literal("context"),
    Type.Literal("constraint"),
  ],
  { description: "Memory entry category" }
);

// ── Type Guards ──────────────────────────────────────────────────

function isAssistantMessage(m: any): m is { role: "assistant"; content: Array<{ type: string; text?: string }> } {
  return m?.role === "assistant" && Array.isArray(m?.content);
}

function getTextContent(message: any): string {
  if (!isAssistantMessage(message)) return "";
  return message.content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text ?? "")
    .join("\n");
}

// ── Main Extension ───────────────────────────────────────────────

export default function loopEngineeringExtension(pi: ExtensionAPI): void {
  let state: LoopState = createEmptyState();
  let lastTaskId: number | null = null;

  // ── State Persistence ──────────────────────────────────────────

  function persistState(): void {
    pi.appendEntry("loop-engineering", {
      ...state,
      // Don't persist in-progress tasks as in_progress
      tasks: state.tasks.map((t) => ({
        ...t,
        status: t.status === "in_progress" ? "pending" : t.status,
      })),
    });
  }

  function restoreState(ctx: ExtensionContext): void {
    const entries = ctx.sessionManager.getEntries();
    const loopEntries = entries.filter(
      (e: any) => e.type === "custom" && e.customType === "loop-engineering"
    );

    if (loopEntries.length > 0) {
      const last = loopEntries[loopEntries.length - 1] as any;
      if (last.data) {
        state = {
          ...createEmptyState(),
          ...last.data,
        };
      }
    }
  }

  // ── UI Updates ─────────────────────────────────────────────────

  function updateUI(ctx: ExtensionContext): void {
    // Status bar
    if (state.phase !== "idle") {
      const completed = state.tasks.filter((t) => t.status === "completed").length;
      const total = state.tasks.length;
      ctx.ui.setStatus(
        "loop",
        ctx.ui.theme.fg(
          state.phase === "completed"
            ? "success"
            : state.phase === "failed"
              ? "error"
              : "accent",
          `🔄 Loop: ${state.phase} (${completed}/${total} tasks)`
        )
      );
    } else {
      ctx.ui.setStatus("loop", undefined);
    }

    // Widget
    const widgetLines = formatWidget(state);
    if (widgetLines.length > 0) {
      ctx.ui.setWidget("loop-engineering", widgetLines);
    } else {
      ctx.ui.setWidget("loop-engineering", undefined);
    }
  }

  // ── Commands ───────────────────────────────────────────────────

  pi.registerCommand("loop", {
    description: "Start a new loop with a goal (e.g., /loop Implement JWT auth)",
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        if (state.phase !== "idle") {
          // Show status if loop is running
          ctx.ui.notify(formatState(state), "info");
          return;
        }
        ctx.ui.notify("Usage: /loop <goal>\nExample: /loop Implement JWT refresh token", "warning");
        return;
      }

      // Start new loop
      state = createEmptyState();
      state.goal = args.trim();
      state.phase = "planning";
      state.startedAt = Date.now();
      state.lastActivityAt = Date.now();

      // Ask for Definition of Done
      const dod = await ctx.ui.input(
        "Definition of Done (comma-separated):",
        "e.g., Tests pass, Coverage >90%, Build succeeds"
      );

      if (dod?.trim()) {
        state.definitionOfDone = dod.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        state.definitionOfDone = ["All tests pass", "Build succeeds"];
      }

      persistState();
      updateUI(ctx);
      ctx.ui.notify(
        `🔄 Loop started!\n\n` +
        `🎯 Goal: ${state.goal}\n` +
        `📏 DoD: ${state.definitionOfDone.join(", ")}\n\n` +
        `The agent will now plan before coding. Use /loop-status to check progress.`,
        "info"
      );

      // Inject context for the agent
      pi.sendMessage(
        {
          customType: "loop-engineering",
          content:
            `[LOOP ENGINEERING ACTIVE]\n` +
            `Goal: ${state.goal}\n` +
            `Definition of Done:\n${state.definitionOfDone.map((d) => `  - ${d}`).join("\n")}\n\n` +
            `Follow the loop protocol:\n` +
            `1. PLAN: Use loop_planner to read the project and create tasks\n` +
            `2. EXECUTE: Use loop_execute to work on tasks one at a time\n` +
            `3. VERIFY: Use loop_verify after each task\n` +
            `4. REFLECT: Use loop_reflect to find issues\n` +
            `5. MEMORY: Use loop_memory to record decisions\n` +
            `6. Check loop_status for stop conditions`,
          display: true,
        },
        { triggerTurn: true }
      );
    },
  });

  pi.registerCommand("loop-status", {
    description: "Show current loop status",
    handler: async (_args, ctx) => {
      if (state.phase === "idle") {
        ctx.ui.notify("No active loop. Start one with /loop <goal>", "info");
        return;
      }
      ctx.ui.notify(formatState(state), "info");
    },
  });

  pi.registerCommand("loop-stop", {
    description: "Force stop the current loop",
    handler: async (_args, ctx) => {
      if (state.phase === "idle") {
        ctx.ui.notify("No active loop.", "info");
        return;
      }
      state.phase = "stopped";
      state.lastActivityAt = Date.now();
      persistState();
      updateUI(ctx);
      ctx.ui.notify("🛑 Loop stopped.", "warning");
    },
  });

  pi.registerCommand("loop-memory", {
    description: "Show loop memory entries",
    handler: async (_args, ctx) => {
      if (state.phase === "idle") {
        ctx.ui.notify("No active loop.", "info");
        return;
      }
      ctx.ui.notify(formatMemory(state), "info");
    },
  });

  pi.registerCommand("loop-auto-repeat", {
    description: "Toggle auto-repeat mode (restart loop when all tasks complete)",
    handler: async (_args, ctx) => {
      if (state.phase === "idle") {
        ctx.ui.notify("No active loop. Start one with /loop <goal>", "info");
        return;
      }
      state.autoRepeat = !state.autoRepeat;
      persistState();
      updateUI(ctx);
      ctx.ui.notify(
        state.autoRepeat
          ? "🔄 Auto-repeat ON: Loop will restart when all tasks complete"
          : "🔄 Auto-repeat OFF",
        "info"
      );
    },
  });

  pi.registerCommand("loop-never-stop", {
    description: "Toggle never-stop mode (ignore all stop conditions)",
    handler: async (_args, ctx) => {
      if (state.phase === "idle") {
        ctx.ui.notify("No active loop. Start one with /loop <goal>", "info");
        return;
      }
      state.neverStop = !state.neverStop;
      persistState();
      updateUI(ctx);
      ctx.ui.notify(
        state.neverStop
          ? "🛑 Never-stop ON: Loop will ignore all stop conditions"
          : "🛑 Never-stop OFF",
        "info"
      );
    },
  });

  // ── Tools ──────────────────────────────────────────────────────

  // Tool 1: loop_planner
  pi.registerTool({
    name: "loop_planner",
    label: "Loop Planner",
    description:
      "Read the project and create a plan with tasks. Must be called before executing. " +
      "Analyze the project structure, find relevant files, identify dependencies, " +
      "and break the goal into small, actionable tasks.",
    promptSnippet: "Plan tasks for the current loop goal",
    promptGuidelines: [
      "Use loop_planner at the start of a loop to read the project and create tasks before writing any code.",
      "Use loop_planner to add new tasks discovered during reflection.",
    ],
    parameters: Type.Object({
      action: Type.Union(
        [
          Type.Literal("plan"),
          Type.Literal("add_task"),
          Type.Literal("replan"),
        ],
        { description: "plan=initial plan, add_task=add single task, replan=revise plan" }
      ),
      tasks: Type.Optional(
        Type.Array(
          Type.Object({
            text: Type.String({ description: "Task description" }),
            priority: Type.Optional(PrioritySchema),
          }),
          { description: "Tasks to add" }
        )
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (state.phase === "idle") {
        return {
          content: [{ type: "text", text: "No active loop. Start with /loop <goal>" }],
          details: { error: "no_active_loop" },
        };
      }

      state.phase = "planning";
      state.lastActivityAt = Date.now();
      onUpdate?.({
        content: [{ type: "text", text: "Planning..." }],
      });

      if (params.action === "plan" || params.action === "replan") {
        // Clear existing tasks if replanning
        if (params.action === "replan") {
          state.tasks = state.tasks.filter((t) => t.status === "completed" || t.status === "in_progress");
        }
      }

      // Add provided tasks
      if (params.tasks) {
        for (const task of params.tasks) {
          addTask(state, task.text, task.priority ?? "medium", "plan");
        }
      }

      state.phase = "executing";
      persistState();
      updateUI(ctx);

      const taskList = state.tasks
        .filter((t) => t.status === "pending")
        .map((t) => formatTask(t, 0))
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              `Plan created. ${state.tasks.filter((t) => t.status === "pending").length} tasks ready.\n\n` +
              `Tasks:\n${taskList}\n\n` +
              `Next: Use loop_execute to start working on the highest priority task.`,
          },
        ],
        details: {
          tasks: state.tasks.map((t) => ({ id: t.id, text: t.text, priority: t.priority, status: t.status })),
        },
      };
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("loop_planner ")) + theme.fg("muted", args.action);
      if (args.tasks) {
        text += theme.fg("dim", ` (${args.tasks.length} tasks)`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as any;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }
      const text = result.content[0];
      return new Text(text?.type === "text" ? text.text : "", 0, 0);
    },
  });

  // Tool 2: loop_execute
  pi.registerTool({
    name: "loop_execute",
    label: "Loop Execute",
    description:
      "Start working on the next task. Marks the task as in_progress. " +
      "Only modify necessary files with small diffs. Match project style.",
    promptSnippet: "Start executing the next task in the loop",
    promptGuidelines: [
      "Use loop_execute to pick up the next task and start working on it.",
      "After completing a task's code changes, call loop_verify before moving to the next task.",
    ],
    parameters: Type.Object({
      task_id: Type.Optional(Type.Number({ description: "Specific task ID to execute (default: next highest priority)" })),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (state.phase === "idle") {
        return {
          content: [{ type: "text", text: "No active loop. Start with /loop <goal>" }],
          details: { error: "no_active_loop" },
        };
      }

      state.phase = "executing";
      state.iterationCount++;
      state.lastActivityAt = Date.now();

      // Find task to execute
      let task: LoopTask | null = null;
      if (params.task_id !== undefined) {
        task = state.tasks.find((t) => t.id === params.task_id && t.status === "pending") ?? null;
      } else {
        task = getNextTask(state);
      }

      if (!task) {
        // Check stop conditions
        const stopCheck = checkStopConditions(state);
        if (stopCheck.shouldStop) {
          state.phase = "completed";
          persistState();
          updateUI(ctx);
          return {
            content: [
              {
                type: "text",
                text: `No more tasks. ${stopCheck.reason}\n\nLoop completed! 🎉`,
              },
            ],
            details: { completed: true, reason: stopCheck.reason },
          };
        }
        return {
          content: [{ type: "text", text: "No pending tasks. Use loop_reflect to generate more or loop_planner to add tasks." }],
          details: { no_tasks: true },
        };
      }

      // Mark as in_progress
      task.status = "in_progress";
      lastTaskId = task.id;
      persistState();
      updateUI(ctx);

      return {
        content: [
          {
            type: "text",
            text:
              `Executing task #${task.id}: ${task.text}\n\n` +
              `Priority: ${PRIORITY_LABELS[task.priority]}\n` +
              `Iteration: ${state.iterationCount}/${state.maxIterations}\n\n` +
              `Now implement this task. Keep changes minimal and focused.`,
          },
        ],
        details: {
          task: { id: task.id, text: task.text, priority: task.priority },
          iteration: state.iterationCount,
        },
      };
    },

    renderCall(args, theme) {
      const taskId = args.task_id ?? "next";
      return new Text(
        theme.fg("toolTitle", theme.bold("loop_execute ")) + theme.fg("muted", `task #${taskId}`),
        0,
        0
      );
    },

    renderResult(result, _, theme) {
      const text = result.content[0];
      return new Text(text?.type === "text" ? text.text : "", 0, 0);
    },
  });

  // Tool 3: loop_verify
  pi.registerTool({
    name: "loop_verify",
    label: "Loop Verify",
    description:
      "Run verification steps (build, test, lint, type check). " +
      "Must be called after each task execution. If verification fails, fix the issues.",
    promptSnippet: "Verify the current task implementation",
    promptGuidelines: [
      "Use loop_verify after completing code changes for a task to run build, test, and lint checks.",
      "If loop_verify reports failures, fix them before calling loop_verify again.",
    ],
    parameters: Type.Object({
      steps: Type.Array(
        Type.Object({
          name: Type.String({ description: "Verification step name (e.g., 'Build', 'Unit Tests')" }),
          command: Type.String({ description: "Command to run (e.g., 'npm run build')" }),
        }),
        { description: "Verification steps to run" }
      ),
      files_modified: Type.Optional(
        Type.Array(Type.String(), { description: "Files that were modified in this task" })
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (state.phase === "idle") {
        return {
          content: [{ type: "text", text: "No active loop." }],
          details: { error: "no_active_loop" },
        };
      }

      state.phase = "verifying";
      state.lastActivityAt = Date.now();
      onUpdate?.({ content: [{ type: "text", text: "Running verifications..." }] });

      // Track modified files
      if (params.files_modified) {
        for (const file of params.files_modified) {
          if (!state.filesModified.includes(file)) {
            state.filesModified.push(file);
          }
        }
      }

      // Run verification steps
      const results: VerificationStep[] = [];
      let allPassed = true;

      for (const step of params.steps) {
        const startTime = Date.now();
        try {
          const result = await pi.exec("bash", ["-c", step.command], {
            signal,
            timeout: 60000,
          });

          const passed = result.code === 0;
          const duration = Date.now() - startTime;

          results.push({
            name: step.name,
            command: step.command,
            passed,
            output: passed ? undefined : (result.stderr || result.stdout).slice(0, 500),
            duration,
          });

          if (!passed) allPassed = false;
        } catch (err: any) {
          results.push({
            name: step.name,
            command: step.command,
            passed: false,
            output: err.message?.slice(0, 500) ?? "Command failed",
            duration: Date.now() - startTime,
          });
          allPassed = false;
        }
      }

      state.verifications = results;

      // Complete the current task if all passed
      if (allPassed && lastTaskId !== null) {
        completeTask(state, lastTaskId);
        state.phase = "executing";
      } else if (!allPassed && lastTaskId !== null) {
        state.phase = "executing"; // Go back to executing to fix
      }

      persistState();
      updateUI(ctx);

      const summary = formatVerification(results);

      return {
        content: [
          {
            type: "text",
            text:
              `${allPassed ? "✅ All verifications passed!" : "❌ Some verifications failed."}\n\n` +
              `${summary}\n\n` +
              (allPassed
                ? `Task #${lastTaskId} completed. Use loop_reflect to check for issues, or loop_execute for the next task.`
                : `Fix the failures and call loop_verify again with the same steps.`),
          },
        ],
        details: {
          allPassed,
          results,
          taskId: lastTaskId,
        },
      };
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("loop_verify ")) +
          theme.fg("muted", `${args.steps.length} steps`),
        0,
        0
      );
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as any;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      const icon = details.allPassed ? "✅" : "❌";
      let text = `${icon} Verification ${details.allPassed ? "passed" : "failed"}`;

      if (expanded && details.results) {
        for (const step of details.results) {
          const stepIcon = step.passed ? "✅" : "❌";
          text += `\n  ${stepIcon} ${step.name}`;
          if (step.duration) text += ` (${step.duration}ms)`;
          if (!step.passed && step.output) {
            text += `\n     ${step.output.slice(0, 100)}`;
          }
        }
      }

      return new Text(text, 0, 0);
    },
  });

  // Tool 4: loop_reflect
  pi.registerTool({
    name: "loop_reflect",
    label: "Loop Reflect",
    description:
      "Self-critique the current implementation. Check for bugs, edge cases, " +
      "race conditions, null issues, memory leaks, duplicates, performance, " +
      "security, and UX problems. Generates new tasks for any issues found.",
    promptSnippet: "Reflect on the implementation and find issues",
    promptGuidelines: [
      "Use loop_reflect after each verification to self-critique and find hidden issues.",
      "loop_reflect generates new tasks that are auto-prioritized by the priority engine.",
    ],
    parameters: Type.Object({
      checks: Type.Array(
        Type.Object({
          category: Type.String({ description: "Check category (e.g., 'bugs', 'edge_cases', 'security')" }),
          found: Type.Boolean({ description: "Was an issue found?" }),
          description: Type.Optional(Type.String({ description: "Description of the issue found" })),
          severity: Type.Optional(PrioritySchema),
        }),
        { description: "Reflection check results" }
      ),
      notes: Type.Optional(Type.String({ description: "Additional notes from reflection" })),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (state.phase === "idle") {
        return {
          content: [{ type: "text", text: "No active loop." }],
          details: { error: "no_active_loop" },
        };
      }

      state.phase = "reflecting";
      state.lastActivityAt = Date.now();
      onUpdate?.({ content: [{ type: "text", text: "Reflecting..." }] });

      const issues: Array<{ category: string; description: string; priority: Priority }> = [];

      for (const check of params.checks) {
        if (check.found && check.description) {
          const priority = check.severity ?? "medium";
          addTask(state, `[${check.category}] ${check.description}`, priority, "reflector");
          issues.push({ category: check.category, description: check.description, priority });
        }
      }

      // Check stop conditions
      const stopCheck = checkStopConditions(state);
      state.phase = "executing";
      persistState();
      updateUI(ctx);

      let responseText: string;
      if (issues.length === 0) {
        responseText =
          "✅ No issues found during reflection.\n\n" +
          (stopCheck.shouldStop
            ? `🛑 ${stopCheck.reason}\nLoop can be stopped.`
            : "Continue with next task or stop if Definition of Done is satisfied.");
      } else {
        const issueList = issues
          .map((i) => `  ${i.priority === "critical" ? "🔴" : i.priority === "high" ? "🟠" : "🟡"} [${i.category}] ${i.description}`)
          .join("\n");

        responseText =
          `🔍 Found ${issues.length} issue(s):\n\n${issueList}\n\n` +
          `New tasks added and prioritized. Use loop_execute to address them.`;
      }

      if (params.notes) {
        responseText += `\n\n📝 Notes: ${params.notes}`;
      }

      return {
        content: [{ type: "text", text: responseText }],
        details: {
          issues,
          totalTasks: state.tasks.filter((t) => t.status === "pending").length,
          stopCheck,
        },
      };
    },

    renderCall(args, theme) {
      const issues = args.checks.filter((c) => c.found).length;
      return new Text(
        theme.fg("toolTitle", theme.bold("loop_reflect ")) +
          theme.fg("muted", `${args.checks.length} checks, ${issues} issues`),
        0,
        0
      );
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as any;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      const icon = details.issues.length === 0 ? "✅" : "🔍";
      let text = `${icon} ${details.issues.length} issue(s) found`;

      if (expanded && details.issues) {
        for (const issue of details.issues) {
          const priIcon = issue.priority === "critical" ? "🔴" : issue.priority === "high" ? "🟠" : "🟡";
          text += `\n  ${priIcon} [${issue.category}] ${issue.description}`;
        }
      }

      return new Text(text, 0, 0);
    },
  });

  // Tool 5: loop_memory
  pi.registerTool({
    name: "loop_memory",
    label: "Loop Memory",
    description:
      "Record decisions, architecture choices, bug history, context, and constraints. " +
      "Memory persists across loop iterations for the current session.",
    promptSnippet: "Record a memory entry for the current loop",
    promptGuidelines: [
      "Use loop_memory to record important decisions, architecture notes, or constraints during the loop.",
    ],
    parameters: Type.Object({
      action: Type.Union(
        [
          Type.Literal("add"),
          Type.Literal("list"),
          Type.Literal("get"),
        ],
        { description: "add=record entry, list=all entries, get=by key" }
      ),
      key: Type.Optional(Type.String({ description: "Memory key (for add/get)" })),
      value: Type.Optional(Type.String({ description: "Memory value (for add)" })),
      category: Type.Optional(MemoryCategorySchema),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (state.phase === "idle") {
        return {
          content: [{ type: "text", text: "No active loop." }],
          details: { error: "no_active_loop" },
        };
      }

      state.lastActivityAt = Date.now();

      switch (params.action) {
        case "add": {
          if (!params.key || !params.value) {
            return {
              content: [{ type: "text", text: "Error: key and value required for add" }],
              details: { error: "missing_params" },
            };
          }
          addMemory(state, params.key, params.value, params.category ?? "context");
          persistState();
          return {
            content: [{ type: "text", text: `Memory saved: ${params.key} = ${params.value}` }],
            details: { added: { key: params.key, value: params.value, category: params.category } },
          };
        }

        case "list": {
          return {
            content: [{ type: "text", text: formatMemory(state) }],
            details: { memory: state.memory },
          };
        }

        case "get": {
          if (!params.key) {
            return {
              content: [{ type: "text", text: "Error: key required for get" }],
              details: { error: "missing_key" },
            };
          }
          const entry = state.memory.find((m) => m.key === params.key);
          if (!entry) {
            return {
              content: [{ type: "text", text: `No memory entry for key: ${params.key}` }],
              details: { found: false },
            };
          }
          return {
            content: [{ type: "text", text: `${entry.key} = ${entry.value} (${entry.category})` }],
            details: { entry },
          };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown action: ${params.action}` }],
            details: { error: "unknown_action" },
          };
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("loop_memory ")) + theme.fg("muted", args.action);
      if (args.key) text += ` ${theme.fg("accent", args.key)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result, _, theme) {
      const text = result.content[0];
      return new Text(text?.type === "text" ? text.text : "", 0, 0);
    },
  });

  // Tool 6: loop_task
  pi.registerTool({
    name: "loop_task",
    label: "Loop Task",
    description:
      "Manage individual tasks: add new tasks, complete, fail, skip, or reprioritize. " +
      "Use this for fine-grained task management during the loop.",
    promptSnippet: "Manage tasks in the loop",
    promptGuidelines: [
      "Use loop_task to add individual tasks, mark tasks complete/failed, or reprioritize.",
      "Use loop_task to reprioritize a task when reflection reveals a critical issue.",
    ],
    parameters: Type.Object({
      action: Type.Union(
        [
          Type.Literal("add"),
          Type.Literal("complete"),
          Type.Literal("fail"),
          Type.Literal("skip"),
          Type.Literal("reprioritize"),
          Type.Literal("list"),
        ],
        { description: "Task action" }
      ),
      task_id: Type.Optional(Type.Number({ description: "Task ID (for complete/fail/skip/reprioritize)" })),
      text: Type.Optional(Type.String({ description: "Task text (for add)" })),
      priority: Type.Optional(PrioritySchema),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (state.phase === "idle") {
        return {
          content: [{ type: "text", text: "No active loop." }],
          details: { error: "no_active_loop" },
        };
      }

      state.lastActivityAt = Date.now();

      switch (params.action) {
        case "list": {
          const tasks = state.tasks.map((t) => formatTask(t, 0)).join("\n");
          return {
            content: [{ type: "text", text: tasks || "No tasks." }],
            details: { tasks: state.tasks },
          };
        }

        case "add": {
          if (!params.text) {
            return {
              content: [{ type: "text", text: "Error: text required for add" }],
              details: { error: "missing_text" },
            };
          }
          const task = addTask(state, params.text, params.priority ?? "medium", "user");
          persistState();
          updateUI(ctx);
          return {
            content: [{ type: "text", text: `Added task #${task.id}: ${task.text}` }],
            details: { task },
          };
        }

        case "complete": {
          if (params.task_id === undefined) {
            return {
              content: [{ type: "text", text: "Error: task_id required" }],
              details: { error: "missing_task_id" },
            };
          }
          if (completeTask(state, params.task_id)) {
            persistState();
            updateUI(ctx);
            return {
              content: [{ type: "text", text: `Task #${params.task_id} completed ✅` }],
              details: { completed: true },
            };
          }
          return {
            content: [{ type: "text", text: `Task #${params.task_id} not found` }],
            details: { error: "not_found" },
          };
        }

        case "fail": {
          if (params.task_id === undefined) {
            return {
              content: [{ type: "text", text: "Error: task_id required" }],
              details: { error: "missing_task_id" },
            };
          }
          if (failTask(state, params.task_id)) {
            persistState();
            updateUI(ctx);
            return {
              content: [{ type: "text", text: `Task #${params.task_id} marked as failed ❌` }],
              details: { failed: true },
            };
          }
          return {
            content: [{ type: "text", text: `Task #${params.task_id} not found` }],
            details: { error: "not_found" },
          };
        }

        case "skip": {
          if (params.task_id === undefined) {
            return {
              content: [{ type: "text", text: "Error: task_id required" }],
              details: { error: "missing_task_id" },
            };
          }
          const skipTask = state.tasks.find((t) => t.id === params.task_id);
          if (skipTask) {
            skipTask.status = "skipped";
            persistState();
            updateUI(ctx);
            return {
              content: [{ type: "text", text: `Task #${params.task_id} skipped ⏭️` }],
              details: { skipped: true },
            };
          }
          return {
            content: [{ type: "text", text: `Task #${params.task_id} not found` }],
            details: { error: "not_found" },
          };
        }

        case "reprioritize": {
          if (params.task_id === undefined || !params.priority) {
            return {
              content: [{ type: "text", text: "Error: task_id and priority required" }],
              details: { error: "missing_params" },
            };
          }
          if (reprioritizeTask(state, params.task_id, params.priority)) {
            persistState();
            updateUI(ctx);
            return {
              content: [{ type: "text", text: `Task #${params.task_id} reprioritized to ${params.priority}` }],
              details: { reprioritized: true },
            };
          }
          return {
            content: [{ type: "text", text: `Task #${params.task_id} not found` }],
            details: { error: "not_found" },
          };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown action: ${params.action}` }],
            details: { error: "unknown_action" },
          };
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("loop_task ")) + theme.fg("muted", args.action);
      if (args.task_id !== undefined) text += ` ${theme.fg("accent", `#${args.task_id}`)}`;
      if (args.text) text += ` ${theme.fg("dim", `"${args.text}"`)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as any;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }
      const text = result.content[0];
      return new Text(text?.type === "text" ? text.text : "", 0, 0);
    },
  });

  // Tool 7: loop_status
  pi.registerTool({
    name: "loop_status",
    label: "Loop Status",
    description:
      "Check current loop status, progress, and stop conditions. " +
      "Use this to decide whether to continue or stop the loop.",
    promptSnippet: "Check loop status and stop conditions",
    promptGuidelines: [
      "Use loop_status periodically to check if the loop should stop based on stop conditions.",
    ],
    parameters: Type.Object({}),

    async execute(_toolCallId, _params, signal, onUpdate, ctx) {
      if (state.phase === "idle") {
        return {
          content: [{ type: "text", text: "No active loop." }],
          details: { idle: true },
        };
      }

      const stopCheck = checkStopConditions(state);
      const pending = state.tasks.filter((t) => t.status === "pending").length;
      const completed = state.tasks.filter((t) => t.status === "completed").length;
      const total = state.tasks.length;

      let text = formatState(state);
      text += "\n\n";

      if (stopCheck.shouldStop) {
        text += `🛑 STOP RECOMMENDED: ${stopCheck.reason}`;
      } else {
        text += `✅ Continue: ${pending} tasks remaining`;
        if (state.definitionOfDone.length > 0) {
          text += `\n📏 Verify Definition of Done before stopping.`;
        }
      }

      return {
        content: [{ type: "text", text }],
        details: {
          phase: state.phase,
          tasks: { pending, completed, total },
          iteration: state.iterationCount,
          maxIterations: state.maxIterations,
          stopCheck,
        },
      };
    },

    renderCall(_args, theme) {
      return new Text(theme.fg("toolTitle", theme.bold("loop_status")), 0, 0);
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as any;
      if (!details || details.idle) {
        return new Text(theme.fg("dim", "No active loop"), 0, 0);
      }

      const icon = details.stopCheck?.shouldStop ? "🛑" : "✅";
      return new Text(
        `${icon} ${details.phase} | Tasks: ${details.tasks.completed}/${details.tasks.total} | Iter: ${details.iteration}/${details.maxIterations}`,
        0,
        0
      );
    },
  });

  // ── Events ─────────────────────────────────────────────────────

  // Restore state on session start
  pi.on("session_start", async (_event, ctx) => {
    restoreState(ctx);
    updateUI(ctx);
  });

  // Clean up on session shutdown
  pi.on("session_shutdown", async () => {
    if (state.phase !== "idle" && state.phase !== "completed" && state.phase !== "stopped") {
      state.phase = "stopped";
      persistState();
    }
  });

  // Inject loop context before agent starts
  pi.on("before_agent_start", async (event) => {
    if (state.phase === "idle") return;

    const currentTask = state.tasks.find((t) => t.status === "in_progress") ?? getNextTask(state);

    let contextMsg =
      `[LOOP ENGINEERING ACTIVE]\n` +
      `Goal: ${state.goal}\n` +
      `Phase: ${state.phase}\n` +
      `Iteration: ${state.iterationCount}/${state.maxIterations}\n`;

    if (state.definitionOfDone.length > 0) {
      contextMsg += `\nDefinition of Done:\n${state.definitionOfDone.map((d) => `  - ${d}`).join("\n")}`;
    }

    if (currentTask) {
      contextMsg += `\n\nCurrent Task: #${currentTask.id} - ${currentTask.text}`;
      contextMsg += `\nPriority: ${currentTask.priority}`;
    }

    const pending = state.tasks.filter((t) => t.status === "pending").length;
    const completed = state.tasks.filter((t) => t.status === "completed").length;
    contextMsg += `\n\nProgress: ${completed}/${state.tasks.length} tasks done, ${pending} pending`;

    if (state.memory.length > 0) {
      const recentMemory = state.memory.slice(-5);
      contextMsg += `\n\nRecent Memory:\n${recentMemory.map((m) => `  - ${m.key}: ${m.value}`).join("\n")}`;
    }

    if (state.autoRepeat || state.neverStop) {
      contextMsg += `\n\n⚙️  Active Modes:`;
      if (state.neverStop) contextMsg += `\n  - 🛑 NEVER STOP: Ignore all stop conditions`;
      if (state.autoRepeat) contextMsg += `\n  - 🔄 AUTO REPEAT: Restart when all tasks complete`;
    }

    contextMsg += `\n\nLoop Protocol:\n` +
      `1. Work on the current task with minimal, focused changes\n` +
      `2. After code changes, call loop_verify with your verification steps\n` +
      `3. After verification passes, call loop_reflect to check for issues\n` +
      `4. Use loop_memory to record important decisions\n` +
      `5. Use loop_execute to move to the next task\n` +
      `6. Use loop_status to check stop conditions\n` +
      `7. Use /loop-auto-repeat to toggle auto-repeat mode\n` +
      `8. Use /loop-never-stop to toggle never-stop mode`;

    return {
      message: {
        customType: "loop-engineering-context",
        content: contextMsg,
        display: false,
      },
    };
  });

  // Update progress after each turn
  pi.on("turn_end", async (event, ctx) => {
    if (state.phase === "idle") return;
    if (!isAssistantMessage(event.message)) return;

    const text = getTextContent(event.message);

    // Check for [DONE:n] markers (same as plan-mode)
    const doneRegex = /\[DONE:(\d+)\]/g;
    let match;
    while ((match = doneRegex.exec(text)) !== null) {
      const taskId = parseInt(match[1], 10);
      completeTask(state, taskId);
    }

    state.lastActivityAt = Date.now();
    persistState();
    updateUI(ctx);
  });

  // Auto-reflect after agent finishes a prompt
  pi.on("agent_end", async (event, ctx) => {
    if (state.phase === "idle" || state.phase === "completed" || state.phase === "stopped") return;

    // Don't auto-reflect if we're in a reflection or verification phase
    if (state.phase === "reflecting" || state.phase === "verifying") return;

    // Check stop conditions
    const stopCheck = checkStopConditions(state);
    if (stopCheck.shouldStop) {
      state.phase = "completed";
      persistState();
      updateUI(ctx);

      pi.sendMessage(
        {
          customType: "loop-engineering-complete",
          content: `✅ Loop completed!\n\n🎯 Goal: ${state.goal}\n📏 ${stopCheck.reason}\n\n📊 Summary:\n  - Tasks: ${state.tasks.filter((t) => t.status === "completed").length}/${state.tasks.length} completed\n  - Iterations: ${state.iterationCount}\n  - Files modified: ${state.filesModified.length}`,
          display: true,
        },
        { triggerTurn: false }
      );
    }

    // Auto-repeat: when all tasks complete, prompt for more tasks
    if (state.autoRepeat) {
      const allTasksDone = state.tasks.length > 0 && state.tasks.every(
        (t) => t.status === "completed" || t.status === "skipped"
      );
      if (allTasksDone) {
        // Reset task statuses for next round
        state.tasks = [];
        state.iterationCount = 0;
        state.phase = "planning";
        persistState();
        updateUI(ctx);

        pi.sendMessage(
          {
            customType: "loop-engineering-repeat",
            content: `🔄 Auto-repeat: All tasks complete. Starting new round...\n\n🎯 Goal: ${state.goal}\n\nUse loop_planner to add new tasks for the next iteration.`,
            display: true,
          },
          { triggerTurn: true }
        );
      }
    }
  });
}
