/**
 * LOOPHOLE benchmark harness — measures simulation throughput.
 * Runs N ticks of the full simulation (RuleEngine + GlimmerAI)
 * and reports ticks/sec.
 */
import { ArenaState } from './src/game/simulation/ArenaState';
import { RuleEngine } from './src/game/simulation/RuleEngine';
import { GlimmerAI } from './src/ai/GlimmerAI';
import type { RuleCard } from './src/game/simulation/Types';
import { ZoneId, RuleType } from './src/game/simulation/Types';

const BENCH_TICKS = 10000;
const DT = 1 / 60;

function reset(state: ArenaState): void {
  state.resetHero();
  state.attemptOver = false;
}

function runTicks(state: ArenaState, engine: RuleEngine, ai: GlimmerAI, count: number): void {
  for (let i = 0; i < count; i++) {
    ai.decide(state, DT);
    const events = engine.tick(state, DT);
    ai.recordOutcome(state, events.heroDamaged, events.heroDodged);
    if (state.attemptOver) reset(state);
  }
}

function freshRun(warmup: number): number {
  const state = new ArenaState();
  const engine = new RuleEngine();
  const ai = new GlimmerAI();

  const cards: RuleCard[] = [
    { id: 'f1', type: RuleType.FlameVent, zone: ZoneId.LeftPlatform, param: 5, active: true },
    { id: 's1', type: RuleType.SpikeWall, zone: ZoneId.CenterPlatform, param: 3, active: true },
    { id: 'o1', type: RuleType.SentryOrb, zone: ZoneId.RightPlatform, param: 4, active: true },
  ];
  for (const card of cards) {
    engine.deployRule(state, card);
  }

  // Deploy tick
  runTicks(state, engine, ai, 200);
  // Warmup
  runTicks(state, engine, ai, warmup);
  // JIT warmup bench (discarded)
  runTicks(state, engine, ai, BENCH_TICKS);
  // Actual measurement
  const t0 = performance.now();
  runTicks(state, engine, ai, BENCH_TICKS);
  const elapsed = performance.now() - t0;
  return (BENCH_TICKS / elapsed) * 1000;
}

function main(): number {
  const warmingTicks = Number(process.argv[2]) || 3000;
  const reps = Number(process.argv[3]) || 10;
  let sum = 0;
  for (let i = 0; i < reps; i++) {
    sum += freshRun(warmingTicks);
  }
  const avg = sum / reps;
  console.log(`METRIC sim_ticks_per_sec=${avg.toFixed(1)}`);
  console.log(`METRIC attempts_completed=0`);
  return 0;
}
process.exit(main());
