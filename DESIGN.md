## Performance Architecture

### Hot Path Optimization
The simulation runs at 60fps. Every allocation in the hot path causes GC pressure that causes frame drops.

**Optimizations applied:**
1. **Pooled arrays** — `RuleEngine._previewBuf` and `_candidatesBuf` reuse arrays across frames instead of allocating `ZoneId[]` per tick
2. **Module-scope constants** — `SYNERGY_COLORS` (RenderBridge) and `PERSONALITY_PREFIX` (GlimmerAI) hoisted from per-frame object literals to module scope
3. **Zero-alloc zone thought** — `getZoneThought()` iterates rules directly instead of `.map()` allocation
4. **Cached rules map** — `getRulesInZone()` uses a dirty-flagged `Map` cache, rebuilt only when rule states change
5. **Pooled TickEvent** — The `_events` object is reset each frame, avoiding per-frame spread/copy

**Design principle:** The simulation (`RuleEngine`, `ArenaState`, `GlimmerAI`) is pure data/logic with zero Phaser dependency. Rendering (`RenderBridge`) is disposable view state that syncs from simulation truth.

# LOOPHOLE Design Document

## Core Concept
Asymmetric strategy game where you design traps and an AI hero tries to survive.

## Key Mechanic 1: Trap Drafting
Each attempt, you draw a random hand of 4 trap cards. You must decide which cards to place and where. You can spend Influence to reroll your hand for different options.

### Why This Exists
The previous version let players place any trap anywhere with no constraints. This led to a dominant "center stack" strategy — every attempt looked the same. Trap drafting forces adaptation: you work with what you're given, not what you want.

### Design Principles
1. **Scarcity Creates Decisions**: Limited hand = every placement matters
2. **Adaptation Over Optimization**: Random hands prevent rote memorization
3. **Reroll as Strategic Choice**: Spend Influence now or save for abilities?

## Key Mechanic 2: Zone-Dependent Behavior
The same trap type behaves differently on Platforms vs Walkways:

| Trap | Platform | Walkway |
|------|----------|---------|
| FlameVent | Standard eruption (1.5s) | Brief burst (0.75s) |
| SpikeWall | Standard (2s) | Extended (3s) |
| SentryOrb | Standard speed | 1.5x faster projectile |
| GravityWell | Pulls hero | Pulls + 0.5s freeze |
| TemporalRift | Steals 3s | Steals 2s |

Additionally, all walkway traps receive a **1.5x damage bonus** (narrow passages = harder to dodge).

### Why This Exists
Without zone differentiation, every zone is interchangeable. Zone-dependent behavior creates a spatial puzzle: which trap goes where? Walkways are dangerous (high damage, burst effects) but platforms offer sustained defense and combo opportunities.

## Key Mechanic 3: Visible AI Adaptation
Glimmer (the AI hero) remembers which zones hurt it. After each death, the hero avoids dangerous zones. This is shown to the player via:
- 😰 emoji on zones the hero fears (in DesignPanel)
- Intent indicator during combat showing hero's strategy
- Review panel showing the hero's memory after each attempt

### Why This Exists
Without visible adaptation, the AI feels like a scripted NPC. When the player sees the hero actively avoiding traps they placed, it creates a cat-and-mouse dynamic: the player baits, the hero adapts, the player counters.

## Key Mechanic 4: Stack Penalty + Diminishing Returns
Placing 2+ traps in the same zone applies a **0.6x damage penalty** to all traps in that zone. Additionally, 3+ traps apply diminishing returns: **0.7x at 3 traps, 0.5x at 4+ traps**. This discourages the "dump everything on center" strategy.

### Why This Exists
The previous version had no stack penalty. Players stacked all traps on center for guaranteed kills. The stack penalty forces spread: placing traps across multiple zones is now objectively better than dumping on one. Diminishing returns further punish over-stacking.

## Synergies (Preserved from Previous Version)
When two different trap types occupy the same zone, they create synergy effects:

| Synergy | Traps | Effect | Damage Multiplier |
|---------|-------|--------|-------------------|
| Molten Spikes | FlameVent + SpikeWall | 2x damage | 2.0x |
| Fireball | FlameVent + SentryOrb | 1.5x + projectile | 1.5x |
| Impale | SpikeWall + GravityWell | 2.5x + pull | 2.5x |
| Time Bolt | SentryOrb + TemporalRift | 1.5x + slow | 1.5x |
| Black Hole | GravityWell + TemporalRift | Pull + freeze | N/A |

## Balance Numbers
- **Hero HP**: 2 (down from 3 — faster kills, more tension)
- **Attempt Duration**: 25s (extended from 15s — more time for Boss Powers and drama)
- **Deploy Timer**: 1.5s (down from 3s — less dead time between placement and activation)
- **Starting Influence**: 3 (enables reroll + 1 ability on first attempt)
- **Influence Max**: 10 (up from 8 — more ability usage per attempt)
- **Hand Size**: 4 cards per attempt
- **Reroll Cost**: 1 Influence
- **Walkway Damage Bonus**: 1.5x
- **Stack Penalty**: 0.6x at 2+ traps in same zone
- **Combo Window**: 1.5s between hits
- **Environmental Events**: Every 5-9 seconds
### Escalation Config
- **Unlock Thresholds**: SentryOrb at 3 kills, GravityWell at 6, TemporalRift at 9
- **AI HP Scaling**: +1 HP per 5 kills
- **AI Reaction Scaling**: -25ms per 3 kills (min 100ms)
- **Research Points**: 1 per kill

## Key Mechanic 6: Path Reveal + Active Abilities
During each attempt, the AI's predicted path is shown as a ghost trail. The player can activate abilities using Influence to manipulate traps and the AI's movement.

### Path Reveal (Always Active)
The AI's next 3 moves are shown as fading ghost circles. The player can see WHERE the AI is going BEFORE it moves. This transforms trap placement from guesswork into informed strategy.

### Active Abilities
| Ability | Key | Cost | Cooldown | Effect |
|---------|-----|------|----------|--------|
| **Telekinesis** | Q | 1 | 2s | Move one trap to an adjacent zone. 0.5s channel. |
| **Freeze** | W | 2 | 5s | Stops time for 2s. Reposition one existing trap. |
| **Misdirect** | E | 4 | 9s | Reverses hero's next 3 moves. Massive combo potential. |
| **Scan** | S | 1 | 4s | Reveals AI's FULL remaining path (not just 3 moves). |

### Why This Exists
The previous version had two critical flaws:
1. **Watching phase was passive** — player had no agency during combat
2. **Trap placement was guesswork** — player didn't know where AI would walk

Path Reveal solves #2: the player sees the AI's planned path and places traps strategically.
Telekinesis solves #1: the player can move traps during combat to adapt to AI movement.

### Design Principles
1. **Informed Decisions**: Every trap placement is based on visible AI intent
2. **Active Watching**: Player adjusts traps in real-time as AI moves
3. **Skill Expression**: Timing + prediction + resource management
4. **Combo Setup**: Telekinesis enables multi-trap combos by positioning traps on the AI's escape route

### Balance Notes
- Starting influence (3) allows Scan + Telekinesis on first attempt
- Telekinesis (1⚡, 2s cooldown) is cheap and accessible — encourages active play
- Scan (1⚡, 4s cooldown) shows full path — rewards prediction
- Ghost trail always visible — no ability needed to see basic path
- All abilities gated by cooldowns — no spam possible
## Key Mechanic 7: Visible AI Personality
Each attempt, Glimmer adopts one of 4 personalities that visibly affects movement patterns:

| Personality | Behavior | Counter-Strategy |
|-------------|----------|------------------|
| **Aggressive** | Rushes through danger when full HP. Charges toward traps. | Place traps on ghost trail path. Telekinesis to block escape. |
| **Cautious** | Avoids known-dangerous zones. Sneaks carefully. Waits to observe. | Use Misdirect to reverse it into traps it's avoiding. |
| **Adaptive** | Balanced approach. Learns from memory. Switches strategies. | Change trap placement each attempt. Don't repeat patterns. |
| **Desperate** | Panics when low HP (≤1). Moves randomly 60% of the time. | Spread traps across all zones. Random movement = random deaths. |

### Why This Exists
The previous version showed "Personality: Aggressive" in the UI but players couldn't tell the difference in behavior. Now:
- **Thought bubble** shows personality-specific emoji (⚔️🛡️🧠💀) and strategy text
- **Intent indicator** shows personality description with color-coded border (RUSHING/EVADE/LEARNING/PANIC)
- **HUD** shows personality name with description ("Aggressive — Rushes through danger")
- **Strategy overrides** ensure each personality produces clearly different movement patterns

### Design Principles
1. **Read the AI**: Players learn to identify personalities and adapt their strategy
2. **Counter-play**: Each personality has a clear counter-strategy
3. **Emotional investment**: Visible adaptation creates "I outsmarted the AI!" moments
4. **Replayability**: Different personalities = different experiences each attempt

## Key Mechanic 8: Adaptive AI Counter-Strategy
The AI learns from player ability usage and adapts its strategy. If the player uses Telekinesis often, the AI changes direction more frequently to bait Telekinesis. If the player uses Freeze, the AI rushes through it. If the player uses Scan, the AI waits and observes.

### How It Works
1. **Track player ability usage**: AI counts how many times each ability is used across all attempts
2. **Analyze tendencies**: If one ability is used >30% of the time, AI detects a pattern
3. **Adjust strategy weights**: AI increases weight of counter-strategies
4. **Visual feedback**: Thought bubble shows "🔄 adapting to telekinesis!" when AI is countering

### Counter-Strategy Matrix
| Player Tendency | AI Counter | Why It Works |
|-----------------|------------|--------------|
| Telekinesis spam | More exploration (direction changes) | Bait Telekinesis then change direction |
| Freeze spam | Rush strategy | Freeze doesn't stop rush |
| Misdirect spam | Sneak strategy | Sneaking avoids zones, harder to misdirect |
| Scan spam | Observe strategy | Scan reveals nothing if AI doesn't move |

### Why This Exists
The previous version had a dominant strategy: Scan + Telekinesis. The AI never adapted, so the same strategy worked every time. Now the AI learns from player tendencies and counters them, forcing the player to adapt.

### Design Principles
1. **No dominant strategy**: AI counters whatever the player spams
2. **Player adaptation**: Player must change strategy when AI adapts
3. **Visible learning**: Thought bubble shows when AI is adapting
4. **Skill expression**: Higher skill ceiling — player must read AI and adapt
## Balance Numbers

## Architecture
- **Simulation**: ArenaState + RuleEngine (pure data, no rendering)
- **AI**: GlimmerAI with zone beliefs, memory, 4 personalities
- **Rendering**: ArenaScene + RenderBridge (Phaser)
- **UI**: DesignPanel, ReviewPanel, HUD (DOM)
- **Drafting**: ArenaState.generateHand() (deterministic seed), DesignPanel (card selection + zone deployment)
## Key Mechanic 5: Escalating Arms Race
The game now has meta-progression: kill count persists across attempts, the AI gets stronger at milestones, and new trap types unlock.

### Escalation Milestones
| Kills | AI Adaptation | Player Unlock |
|-------|---------------|---------------|
| 0-1 | 2HP, no abilities | FlameVent, SpikeWall |
| 2 | Gains Dash | — |
| 3 | — | **SentryOrb** unlocked |
| 5 | Gains Shield | **GravityWell** unlocked |
| 7 | Faster reaction (-75ms) | — |
| 9 | Faster reaction (-150ms) | **TemporalRift** unlocked |
| 10 | Gains Double Jump, +1HP | All influence abilities |
| 15 | +1HP (total 4), faster reaction | — |
| 20 | +1HP (total 5), faster reaction | — |

### Why This Exists
The original game was flat: Attempt 1 = Attempt 50. No escalation, no progression, no reason to keep playing. The Escalating Arms Race creates an addictive loop:
1. **Kill → Reward** → AI gets harder, new traps unlock
2. **Escalate → Challenge** → Player must adapt strategy
3. **Adapt → Kill** → Back to step 1

This draws from successful roguelite design: visible AI evolution (like Into the Breach), unlock progression (like Slay the Spire), and escalating difficulty (like Vampire Survivors).

### Design Principles
1. **Visible Escalation**: Player sees AI gaining abilities (dash, shield, double-jump) and HP increasing
2. **Unlock Progression**: New trap types at milestones give the player new tools to match the growing challenge
3. **Forced Adaptation**: AI abilities break dominant strategies, forcing the player to diversify
4. **Research Points**: Earned from kills, displayed in HUD, creating a sense of accumulation

### AI Scaling Details
- **Reaction Time**: Starts at 300ms, reduces by 25ms per 3 kills (min 100ms)
- **Max HP**: Starts at 2, +1 per 5 kills
- **Abilities**: Dash at 2 kills, Shield at 5, Double Jump at 10
- **Memory**: AI remembers which zones hurt it (existing system, now more impactful with faster reaction)

