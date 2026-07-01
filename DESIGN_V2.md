# DEADLOCK — Design Document V2

## Elevator Pitch
"Place one trap the hero can see. Manually time its activation. The hero tries to bait you into firing at nothing."

## Why This Game Is Unique

**It's a real-time mind game between player and AI.**

Unlike tower defense: You have ONE trap, not many. Placement is strategic, not defensive.

Unlike rhythm games: Timing is psychological, not musical. You're reading the AI's intentions.

Unlike puzzle games: The puzzle adapts. The AI learns your strategy and counters it.

Unlike strategy games: The core skill is READ-AND-REACT, not planning.

**The mechanic that has never existed:**
- AI that sees your trap and tries to bait your activation
- Player who must read AI intention and time perfectly
- Both sides adapting to each other in real-time
- One trap creating infinite mind games

## Core Mechanic: BLINK

**The entire game revolves around one interaction:**

```
Player places trap → Hero sees it → Both stare → Player activates → Hit or miss
```

That's it. One mechanic. Infinite depth.

### The Arena

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  ZONE 1 │────│  ZONE 2 │────│  ZONE 3 │────│  ZONE 4 │────│  ZONE 5 │
│ (Start) │    │         │    │ (Boss)  │    │         │    │  (End)  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     ↑                                                              ↑
     │                                                              │
   Hero                                                          Boss
  Start                                                           Zone
```

- **5 zones** in a line
- Hero starts at Zone 1 (left)
- Boss zone is Zone 3 (center)
- Hero must reach Zone 5 (right) to win
- Player places ONE trap on ANY zone (except Zone 1)
- Hero sees the trap and knows its type

### Why Hero Must Cross

The hero's goal is to reach Zone 5. The ONLY way is through the zones. The trap blocks ONE zone, but the hero must cross it to reach the end.

**The hero has options:**
1. **Wait** — Stand still, observe trap timing
2. **Dash** — Quick movement through trap zone (if hero has Dash ability)
3. **Jump** — Jump over trap (if hero has Jump ability)
4. **Bait** — Fake approach to make player activate early
5. **Rush** — Sprint through, take damage if necessary

**The player's trap:**
- Blocks ONE zone
- Can be activated manually (SPACE)
- Has a 2s cooldown after activation
- Hero sees the trap and knows its type
- Hero must find a way through or around

### Why One Trap Is Enough

The depth doesn't come from quantity. It comes from:

1. **Position** — Which zone you block determines the hero's path
2. **Type** — Fire/Ice/Spike/Void each have different properties
3. **Timing** — When you activate determines if you catch the hero
4. **Mind games** — Hero fakes to bait your activation
5. **Memory** — Hero remembers what worked and adapts

**One trap × position × type × timing × psychology = hundreds of unique challenges**

## Core Gameplay Loop

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│   │  PLACE   │───→│  STARE   │───→│  ACTIVATE │     │
│   │  TRAP    │    │          │    │  (skill)  │     │
│   └──────────┘    └────┬─────┘    └────┬─────┘     │
│        ↑               │               │            │
│        │               ▼               ▼            │
│   ┌────┴─────┐    ┌──────────┐    ┌──────────┐     │
│   │  REVIEW  │←───│  RESULT  │←───│  HERO    │     │
│   │          │    │          │    │  REACTS  │     │
│   └──────────┘    └──────────┘    └──────────┘     │
│                                                     │
│   Player adapts. Hero adapts. Arms race forever.    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Phase 1: PLACE (Design)
- Player places ONE trap on ONE zone
- Choose type (Fire/Ice/Spike/Void)
- Hero sees the trap placement (visible information)
- Hero knows trap type and approximate timing

### Phase 2: STARE (Mind Game)
- Hero approaches from left
- Player holds activation button (SPACE)
- Hero fakes movements to bait activation
- Player reads hero's intention (visible arrow)
- Both sides wait for the other to commit

### Phase 3: ACTIVATE (Skill)
- Player presses SPACE to activate trap
- If hero is in trap zone → HIT → damage
- If hero is not in trap zone → MISS → 2s cooldown
- Hero advances during cooldown
- Multiple activations per attempt (limited by cooldown)

### Phase 4: HERO REACTS (AI)
- Hero evaluates what happened
- If hit: "Trap activated at [time]. I was in [zone]. Avoid this timing."
- If miss: "Player activated too early/late. I can exploit this timing."
- Hero updates its strategy for next attempt
- Hero's memory persists across attempts

### Phase 5: RESULT
- If hero reaches boss zone → hero wins (no score)
- If hero takes 3 damage → hero dies (score awarded)
- Score based on: efficiency (fewer activations) + speed (time to kill)

### Phase 6: REVIEW
- Player sees hero's thought process
- Player sees hero's memory heatmap
- Player sees what hero learned
- Player redesigns for next attempt

## Trap Types

### Fire
- **Damage**: High (2 HP)
- **Activation**: Instant
- **Duration**: 2 seconds
- **Hero counter**: Dash through during cooldown
- **Visual**: Pillar of flame

### Ice  
- **Damage**: Low (1 HP)
- **Activation**: Instant
- **Duration**: 4 seconds (creates slippery zone)
- **Effect**: Hero slides uncontrollably for 2 seconds
- **Hero counter**: Jump over before it activates
- **Visual**: Frozen ground

### Spike
- **Damage**: High (2 HP)
- **Activation**: Delayed (0.5s after button press)
- **Duration**: 1 second
- **Hero counter**: Move during delay window
- **Visual**: Ground spikes erupt

### Void
- **Damage**: None
- **Activation**: Instant
- **Duration**: 3 seconds (creates teleporter)
- **Effect**: Hero teleports to random zone
- **Hero counter**: Avoid the zone entirely
- **Visual**: Purple portal

## Hero AI: "Glimmer"

### How Glimmer Thinks

Glimmer doesn't follow scripts. It has:

1. **Zone Memory** — Remembers damage per zone
2. **Timing Memory** — Remembers when traps activated
3. **Pattern Detection** — Notices player habits
4. **Strategy Selection** — Chooses approach based on memory
5. **Visible Intent** — Shows next move to player

### Glimmer's Abilities

Glimmer starts with no abilities. It unlocks them through deaths:

| Ability | Unlocks After | Effect |
|---------|---------------|--------|
| **Dash** | 2 deaths | Quick movement through trap zone (3s cooldown) |
| **Shield** | 5 deaths | Absorbs one hit before breaking |
| **Double Jump** | 9 deaths | Jump over trap zone |

### Glimmer's Strategies

| Strategy | Behavior | When Used |
|----------|----------|-----------|
| **Rush** | Sprint through, ignore trap | When HP full, no memory of trap |
| **Bait** | Fake approach, retreat, approach again | When trap seen, testing player reaction |
| **Wait** | Stand still, observe trap timing | When trap is unfamiliar |
| **Feint** | Quick movement in one direction, reverse | When player activates early often |
| **Dash** | Quick movement through trap zone | When trap has cooldown, timing known |

### The Mind Game

**Example 1: The Bait**
1. Player places Fire on Zone 3
2. Hero approaches Zone 2
3. Player holds activation, waiting for hero to enter Zone 3
4. Hero fakes movement to Zone 3, then retreats to Zone 2
5. Player activates trap, misses (hero is at Zone 2)
6. Hero knows: "Player activates when I approach Zone 3"
7. Next attempt: Hero rushes through Zone 3 before player can react
8. Player must change timing to catch hero

**Example 2: The Double Bluff**
1. Player places Ice on Zone 3
2. Hero knows Ice activates at ~2.5s
3. Player waits 4s, hero thinks it's safe
4. Player activates Ice at 4s, hero is frozen
5. Hero learns: "Player changes timing, must be unpredictable"

**Example 3: The Adaptation**
1. Player uses Fire 5 times, always activates at 2s
2. Hero learns: "avoid Zone 3 after 2s"
3. Player moves trap to Zone 4, activates at 1s
4. Hero gets hit because memory was wrong
5. Hero learns: "Player changes position, must watch carefully"

### Visible Intent System

Glimmer's NEXT MOVE is always shown as a glowing arrow. This creates:

1. **Informed decisions** — Player sees where hero is going
2. **Mind games** — Hero can CHANGE its mind based on player action
3. **Skill expression** — Reading intent + timing activation
4. **Surprise** — Hero sometimes does unexpected things

### Glimmer's Memory

After each attempt, Glimmer remembers:

```
Zone: Zone 3
- Damage taken: 3 times
- Best strategy: Wait, then dash
- Player activates at: ~2.5s average
- Last successful approach: Feint left, dash right
```

This memory persists across attempts. Glimmer gets smarter.

## Scoring

### Efficiency Score
- Base: 100 points per kill
- Multiplier: 1.0 / activations used (min 0.2)
- Meaning: Fewer activations = better

### Speed Score
- Base: 100 points
- Multiplier: Attempt duration / time to kill
- Meaning: Faster kills = better

### Streak Bonus
- Consecutive kills without hero winning
- Multiplier: 1.0 + (streak * 0.1) (max 2.0)
- Meaning: Consistency rewards

### Total Score
```
Total = Base × Efficiency × Speed × Streak
```

## Progression: Knowledge-Based

### What Unlocks (NOT numbers)
- **New trap types** — At kill milestones
- **New hero abilities** — As Glimmer adapts
- **New arena zones** — As player proves mastery
- **New AI behaviors** — As game evolves

### Unlock Table
| Kills | Player Unlock | Hero Unlock |
|-------|---------------|-------------|
| 0 | Fire, Ice | — |
| 3 | Spike | Dash |
| 6 | Void | Shield |
| 9 | — | Double Jump |
| 12 | Second trap slot | — |
| 15 | Arena modification | Faster reaction |
| 20 | Third trap slot | +1 HP |

### Why This Works
- Player earns NEW MECHANICS, not +10 damage
- Hero earns NEW ABILITIES, not +5 HP
- Both sides evolve, creating arms race
- Every kill feels meaningful

## Emergent Gameplay

### Example 1: The Bait-and-Switch
- Player places Fire on left
- Hero approaches left, fakes, goes right
- Player activates Fire, misses
- Hero reaches center
- **Story:** "Hero tricked me into wasting my shot!"

### Example 2: The Double Bluff
- Player places Ice on center
- Hero knows Ice activates at ~2.5s
- Player waits 4s, hero thinks it's safe
- Player activates Ice at 4s, hero is frozen
- **Story:** "I changed my timing to catch it off guard!"

### Example 3: The Adaptation
- Player uses Fire 5 times, always activates at 2s
- Hero learns "avoid left after 2s"
- Player moves trap to right, activates at 1s
- Hero gets hit because memory was wrong
- **Story:** "I changed my pattern to surprise it!"

### Example 4: The Monster Creation
- Player develops strategy: place Void, let hero teleport, catch it at destination
- Hero learns: avoid Void zones entirely
- Player must find new strategy
- Hero has "learned" to counter player's best move
- **Story:** "I created a monster that knows my tricks!"

## Technical Architecture

```
src/
├── game/
│   ├── simulation/
│   │   ├── Types.ts          — Core types, config
│   │   ├── ArenaState.ts     — Game state
│   │   ├── TrapSystem.ts     — Trap placement, activation, effects
│   │   └── DamageSystem.ts   — Damage calculation
├── ai/
│   ├── GlimmerAI.ts          — Main AI brain
│   ├── MemorySystem.ts       — Zone + timing memory
│   ├── StrategySelector.ts   — Strategy selection
│   └── IntentPredictor.ts    — Visible intent system
├── render/
│   ├── scenes/
│   │   └── ArenaScene.ts     — Phaser scene
│   └── adapters/
│       └── RenderBridge.ts   — Simulation → Phaser
├── ui/
│   ├── DesignPanel.ts        — Trap placement UI
│   ├── ReviewPanel.ts        — Post-attempt analysis
│   └── HUD.ts                — Controls, score, timer
└── audio/
    └── AudioManager.ts       — Procedural audio
```

## What Makes This "Never Seen Before"

1. **One trap + manual activation** — No game does this
2. **Hero sees your trap** — No hidden information mind games
3. **Hero fakes to bait you** — AI as psychological opponent
4. **Both adapt simultaneously** — Arms race, not one-sided
5. **Visible intent** — Into the Breach meets real-time
6. **Memory-based learning** — AI gets genuinely smarter
7. **One mechanic, infinite depth** — No feature bloat

## Why Streamers Would Love It

1. **Visible AI thinking** — Viewers see Glimmer's thoughts
2. **Mind games** — "Will it bait? Will it feint?"
3. **Skill expression** — Perfect timing = perfect catch
4. **"I created a monster"** — AI adapts to player's strategy
5. **Easy to explain** — "Place trap, time activation, catch hero"
6. **Endless stories** — Every attempt creates narrative
7. **Chat interaction** — "Activate NOW!" / "Wait for it!"

## Why It's Highly Replayable

1. **AI remembers everything** — No two games are the same
2. **Different trap configs** — Position × type × timing
3. **Hero adaptation** — Must constantly evolve strategy
4. **Skill ceiling** — Timing precision is infinite
5. **Emergent stories** — Every attempt creates narrative
6. **No grinding** — Each game is meaningful

## The ONE Mechanic

**BLINK: Place a visible trap. Time its activation. The hero tries to make you miss.**

That's it. That's the entire game.

Everything else is emergent from this one mechanic.
