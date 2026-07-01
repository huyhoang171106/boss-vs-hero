# LOOPHOLE

> **Write the Rules. Watch Them Break.**

You are the **Boss**. An AI-controlled **Hero** named **Glimmer** will attempt to beat you — every single time. Your weapon? The rules of the arena itself.

Place traps, hazards, and distortions across the battlefield. Then watch Glimmer learn, adapt, and try to outsmart your defenses. When it fails, it remembers. When it succeeds, it never forgets.

---

## What Is This?

LOOPHOLE is an **endless asymmetric strategy game** where you design the dungeon and an evolving AI tries to survive it.

- **No traditional controls.** You don't fight — you *design*.
- **No end.** Glimmer adapts across attempts. The game escalates as the AI learns.
- **No two runs are the same.** An adaptive AI + evolving strategy = unique encounters every time.

---

## How to Play

### The Arena

The battlefield is a side-scrolling arena with **6 connected zones**:

```
LeftPlatform → LeftWalkway → CenterPlatform → RightWalkway → RightPlatform
                                                              ↓
                                                            Pit (death)
```

Glimmer starts on the **LeftPlatform** and must survive **20 seconds** to reach the Boss (CenterPlatform). If it dies, it tries again — but smarter.

### Your Turn: Design Phase

Between attempts, you enter **Design Mode** to place rules on the 3 platform zones (LeftPlatform, CenterPlatform, RightPlatform):

| Rule | What It Does | Counter |
|------|-------------|---------|
| **Flame Vent** | Periodic fire bursts. Standing in an active vent = damage. | Dash to dodge |
| **Spike Wall** | Retractable spikes triggered by proximity or cooldown. | Jump to avoid |
| **Sentry Orb** | Fires a homing projectile toward Glimmer's current zone. | Dash or Jump |
| **Gravity Well** | Reverses Glimmer's next movement — traps it in a zone. | Wait it out |
| **Temporal Rift** | Rewinds time by 3 seconds when Glimmer enters the zone. | None (pure delay) |

Each rule has a **cooldown parameter** (in seconds) — lower = more frequent, harder to dodge.

### Synergies

Place two rules in the same zone to create **synergies**:

- **Flame Vent + Spike Wall** → **Molten Spikes**: Double damage when both trigger. The deadliest combo.


### Environmental Events

Every 7-11 seconds during an attempt, a **random environmental event** triggers, forcing you to adapt your strategy in real-time:

| Event | Effect | Duration |
|-------|--------|----------|
| **⚡ Speed Surge** | Glimmer moves 2x faster — traps fire more frequently | 4s |
| **💥 Amplify** | All traps deal 2x damage — devastating combos | 4s |
| **🛡️ Shield Pulse** | Glimmer gains a temporary shield — must break it first | 4s |
| **⭐ Bonus Zone** | One zone glows gold — traps there deal 3x damage | 4s |
| **🐌 Slow Field** | Glimmer moves 50% slower — traps have more time to trigger | 4s |

Events create **dynamic tension** — the arena changes mid-attempt, and you must use your abilities strategically to capitalize (or survive).
### Glimmer's Abilities (Unlocked Through Deaths)

Glimmer isn't helpless. As it dies, it **evolves**:

| Ability | Unlocks After | Effect |
|---------|---------------|--------|
| **Dash** | 2 deaths | Dodge through Flame Vents (3s cooldown) |
| **Shield** | More deaths | Absorbs one hit before breaking |
| **Double Jump** | Later | Skips a zone mid-movement |

---

## The AI: Glimmer's Strategy Tree

Glimmer doesn't follow a script. It uses a **Strategy Tree** — a memory-based decision system that balances exploration and exploitation:

### Strategies

| Strategy | Behavior | Risk |
|----------|----------|------|
| **Rush** | Sprints toward the Boss, ignores danger | High |
| **Explore** | Tests new paths and timings | Medium |
| **Sneak** | Avoids known-dangerous zones | Low |
| **Observe** | Waits and watches rule patterns | Low |
| **Pattern** | Uses memory to predict and exploit timing gaps | Medium |

### How Glimmer Learns

1. **Zone Beliefs**: Glimmer tracks which zones it considers "safe" or "dangerous" based on past damage.
2. **Memory Heatmap**: Each zone accumulates damage/safe/dodge scores. Hot zones get avoided.
3. **Strategy Scoring**: Successful strategies get boosted. Failed ones get deprioritized.
4. **Curiosity Factor**: After encountering new rules, Glimmer becomes more exploratory.
5. **Failure Streaks**: Repeated deaths make Glimmer more cautious — it switches to safer strategies.

The AI has a **reaction delay** (300ms) so it's not frame-perfect — it makes human-like mistakes.

### Visible AI Intent

Glimmer's **next move is always shown** — a glowing arrow on the target zone indicates where it plans to go. This creates the **Into the Breach** dynamic: you can see what the AI intends and decide whether to let it happen or counter with an ability.

The hero's current **strategy** is also displayed (⚔️ Aggressive, 🛡️ Cautious, 🧠 Adaptive, 💀 Desperate), so you can predict its behavior patterns.

### After Each Attempt

The **Review Panel** shows you:
- What Glimmer was thinking at each moment
- Which zones it believes are safe/dangerous
- Its memory heatmap across all attempts
- The path it took through the arena

This intel helps you redesign your defenses for the next attempt.

---

## Game Loop

```
┌─────────────────────────────────────────────┐
│                                             │
│   ┌──────────┐    ┌──────────┐              │
│   │  DESIGN  │───→│  LAUNCH  │              │
│   │  PHASE   │    │          │              │
│   └──────────┘    └────┬─────┘              │
│        ↑               │                    │
│        │               ▼                    │
│   ┌────┴─────┐    ┌──────────┐              │
│   │  REVIEW  │←───│  BATTLE  │              │
│   │  PHASE   │    │  (20s)   │              │
│   └──────────┘    └──────────┘              │
│                                             │
│   Glimmer adapts. Rules persist.            │
│   The arena gets harder. Forever.           │
│                                             │
└─────────────────────────────────────────────┘
```

1. **Design Phase**: Place and configure rules on zones
2. **Battle Phase**: Watch Glimmer attempt to survive your gauntlet (20 seconds)
3. **Review Phase**: Analyze Glimmer's path, thoughts, and memory
4. **Repeat**: Adjust your design. Glimmer keeps its memory. The cycle continues.

---

## Tech Stack

- **TypeScript** — Strict, zero-any, hot-path optimized
- **Phaser 4** — 2D rendering and game loop
- **Vite** — Instant dev server and bundling
- **Web Audio API** — Procedural audio (no asset files needed)

### Architecture

```
src/
├── game/simulation/     Pure simulation (zero rendering dependency)
│   ├── Types.ts         All types, enums, config, zone graph
│   ├── ArenaState.ts    Mutable state + zone safety cache
│   └── RuleEngine.ts    Tick-based rule processing + damage resolution
├── ai/
│   └── GlimmerAI.ts     Strategy Tree + memory system
├── render/
│   ├── scenes/
│   │   └── ArenaScene.ts   Phaser scene (thin orchestrator)
│   └── adapters/
│       └── RenderBridge.ts  Simulation → Phaser scene graph
├── ui/
│   ├── DesignPanel.ts   Rule placement interface
│   ├── ReviewPanel.ts   Post-attempt analysis
│   └── HUD.ts           Controls, speed, timer, HP
├── audio/
│   └── AudioManager.ts  Procedural sounds via Web Audio API
└── main.ts              Boot + layout
```

- **Simulation-first**: The game logic is a pure function of state. Rendering is a disposable view layer.
- **Zero allocations on hot paths**: Pre-computed index maps, zone-rule caches, inlined loops.
- **No asset files**: All audio is procedurally generated via Web Audio API oscillators.

---

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run benchmark (measures simulation throughput)
npx tsx benchmark.ts
```

### Controls

| Key | Action |
|-----|--------|
| `Space` | Toggle pause / Skip to next attempt |
| `1` / `2` / `3` / `4` | Set game speed (1x / 2x / 4x / 8x) |
| `Tab` | Toggle Design Mode |
| `R` | Toggle Review Panel |

Mute is toggled via the HUD button (bottom bar).

---

## Configuration

Core constants in `src/game/simulation/Types.ts`:

```typescript
GAME_CONFIG = {
  HERO_MAX_HP: 3,           // Glimmer starts with 3 HP
  HERO_DASH_COOLDOWN: 3,    // Seconds between dashes
  GLIMMER_REACTION_MS: 300, // AI reaction delay
  ATTEMPT_DURATION: 20,     // Seconds to survive
  RULE_DEPLOY_TIME: 3,      // Seconds to deploy a rule
  FLAME_DURATION: 1.5,      // How long flames stay active
  SPIKE_DURATION: 2,        // How long spikes stay up
  ORB_SPEED: 120,           // Sentry orb projectile speed
}
```

---

## License

MIT
