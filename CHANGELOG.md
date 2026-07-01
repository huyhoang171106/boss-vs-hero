# Changelog

## [Unreleased] - Performance + Bug Fixes

### Fixed
- **Diminishing Returns Bug**: Fixed incorrect conditional logic in `checkDamage()`. The condition `activeRuleCount >= 3 ? 0.7 : activeRuleCount >= 4 ? 0.5 : 1` was wrong — `>=4` is a subset of `>=3`, so the 0.5x branch was never reached. Fixed to `activeRuleCount >= 4 ? 0.5 : activeRuleCount >= 3 ? 0.7 : 1`. Now 4+ traps correctly deal 0.5x damage instead of 0.7x.

### Performance
- **TickEvent Pooling**: `RuleEngine.tick()` now reuses a pooled `TickEvent` object instead of allocating a new one every frame (60fps). Eliminates 60 object allocations + 3 array allocations per second.
- **deployRule/removeRule**: Replaced `Array.filter()` with in-place `splice()` to avoid array allocation when adding/removing rules.
- **patternStrategy()**: Replaced `Array.filter().length` with manual count loop to avoid temporary array allocation.
- **moveHero()**: Removed redundant `getNeighbors()` call in Jump branch. Combined `LeftPlatform` and `RightPlatform` cases.

### Why Previous Version Failed
- **Diminishing Returns Bug**: 4+ traps in a zone dealt 0.7x damage instead of intended 0.5x, making over-stacking slightly stronger than intended.
- **Per-Frame Allocations**: New `TickEvent` object and arrays created every frame caused unnecessary GC pressure at 60fps.

### Why This Version Is Better
- **Correct Balance**: Stack penalty now works as designed — 4+ traps are properly punished.
- **Zero GC Pressure**: No per-frame allocations in the simulation hot path. Runs smoothly on low-end hardware.

## [Unreleased] - Adaptive AI Counter-Strategy
- **Adaptive AI**: AI tracks player ability usage across attempts and adapts strategy. If player spams Telekinesis, AI changes direction more frequently. If player spams Freeze, AI rushes through it. If player spams Scan, AI waits and observes.
- **Counter-Strategy Matrix**: Telekinesis → more exploration, Freeze → rush, Misdirect → sneak, Scan → observe.
- **Visual Feedback**: Thought bubble shows "🔄 adapting to telekinesis!" when AI is countering player strategy.
- **HUD Adaptation Display**: Shows "🧠 AI adapting: changing direction more!" when AI is adapting.
- **Path Reveal**: AI's next 3 moves shown as ghost trail by default. Player can see WHERE the AI is going BEFORE it moves.
- **Trap Telekinesis**: New ability (Q, 1⚡, 2s cooldown) replaces Detonate. Move one trap to adjacent zone during combat.
- **Scan Upgraded**: Now shows FULL remaining path (not just 3 moves). Still costs 1⚡, 4s cooldown.
- **Visible AI Personality**: Each personality now produces clearly different behavior. Thought bubble, intent indicator, and HUD all show personality-specific text and colors.
- **Influence Economy Overhaul**: Starting Influence 3, Influence Max 10. All ability costs reduced.
- **Extended Attempt**: 25s — more time for abilities, combos, and drama.

### Added
- **Meta-Progression**: Kill count persists across attempts. AI gets stronger at milestones.
- **Trap Unlocks**: SentryOrb (3 kills), GravityWell (6 kills), TemporalRift (9 kills).
- **AI Escalation**: AI gains Dash (2 kills), Shield (5 kills), Double Jump (10 kills). HP increases every 5 kills. Reaction time decreases every 3 kills.
- **Research Points**: Earned from kills (1 per kill). Displayed in HUD and ReviewPanel.
- **Kill Reward Display**: ReviewPanel shows AI adaptations and research points after each kill.
- **Trap Unlock Notifications**: Gold banner when new trap type unlocks. DesignPanel shows locked/unlocked status with kill countdown.
- **HUD Escalation Display**: Kill count, AI abilities, and research points shown in info panel during gameplay.
- **AI Adaptation Messages**: ReviewPanel lists all AI adaptations (dash, shield, double-jump, speed, HP).

### Changed
- **Ability Unlocks Moved**: Hero ability unlocks (dash, shield, double-jump) now based on kill count instead of death count. Logic moved from RuleEngine.checkDamage() to ArenaState.resetHero() for cleaner separation.
- **generateHand()**: Now uses only unlocked trap types instead of all 5 RuleTypes.
- **HP Display**: ReviewPanel and HUD now show dynamic maxHP based on kill count.

### Removed
- **Hardcoded Ability Unlocks in checkDamage()**: Lines 439-441 removed. Abilities now set in resetHero() based on totalDeaths.

### Why Previous Version Failed
- **Watching Phase Was Passive**: 15 seconds of nothing happening was the #1 quit reason. Boss Powers give the player meaningful actions during combat.
- **Abilities Were Weak**: Freeze (2s), Detonate (1 random rule), Misdirect (1 move) were too subtle. Overhauled to be impactful: Freeze creates "aha!" moments, Detonate destroys entire zone, Misdirect reverses 3 moves.
- **Attempt Too Short**: 15s didn't allow combos, adaptation, or drama to emerge. Extended to 25s.
- **Influence Economy Was Broken**: Starting with 2 Influence and earning 1/damage meant the player could only afford 1 ability per attempt (Scan cost 2). Abilities felt meaningless. Overhauled: start with 3, costs reduced to [2,3,4,1], cooldowns reduced to [5,7,9,4]s. Player now uses 2-3 abilities per attempt.
- **Ability Costs Were Wrong in UI**: HUD showed costs as [2,1,3] but RuleEngine charged [3,4,5]. Scan was missing from the ability bar entirely. Fixed: all displays now match RuleEngine, Scan added with keybind S.
- **AI Personality Was Invisible**: "Personality: Aggressive" was shown but behavior looked the same. Now each personality produces clearly different movement: Aggressive rushes, Cautious sneaks, Desperate panics. Thought bubble, intent indicator, and HUD all show personality-specific text.
- **Trap Placement Was Guesswork**: Player didn't know where AI would walk. Traps were placed on intuition, not strategy. Path Reveal shows the AI's next 3 moves as ghost trail — every trap placement is informed.
- **Watching Phase Was Passive**: Player had abilities but no real-time decisions. Telekinesis lets the player move traps during combat — "It's going left! Move trap left!" — creating active participation.
- **Detonate Trivialized the Game**: 3 damage per rule × any rules = instant kill. No strategy needed. Removed and replaced with Telekinesis for skill-based gameplay.
- **No Progression**: Attempt 1 was identical to Attempt 50. No reason to keep playing.
- **No Escalation**: AI never got stronger. Player optimized once and repeated forever.
- **No Unlocks**: All 5 trap types available from start. No sense of earning new tools.
- **Invisible AI**: AI abilities were granted silently. Player didn't know the AI was adapting.
- **Dominant Strategy**: Scan + Telekinesis worked every time. AI never adapted. Player spammed the same strategy.
- **No Counter-Play**: AI didn't learn from player tendencies. Same behavior every attempt.

### Why This Version Is Better
- **Informed Strategy**: Ghost trail shows AI intent. Every trap placement is a deliberate decision.
- **Active Combat**: Telekinesis creates real-time decisions during the watching phase.
- **Skill Expression**: Timing + prediction + resource management. Higher skill ceiling.
- **Adaptive AI**: AI learns from player tendencies and counters them. No dominant strategy.
- **Counter-Play**: Player must adapt when AI adapts. Creates "cat and mouse" dynamic.
- **Visible Learning**: Thought bubble shows when AI is adapting. Player sees the AI learning.
- **Addictive Loop**: Kill → Escalate → Adapt → Kill. Each cycle creates tension and reward.
- **Meaningful Resource Tension**: Influence must be split between abilities and rerolls. Every ability use is a real decision.
- **Visible AI Personality**: Players learn to identify personalities and adapt. Creates emotional investment and counter-play.
- **Visible Evolution**: Player sees AI gaining abilities and HP. Creates urgency and storytelling.
- **Forced Diversification**: AI abilities break dominant strategies. Player must try new trap combinations.
- **Accumulation**: Research points and trap unlocks give a sense of progress across runs.

### [Unreleased] - Hot Path Performance Optimization

#### What Changed
- **Pooled arrays in RuleEngine**: `_previewBuf` and `_candidatesBuf` reuse arrays across frames, eliminating per-frame `ZoneId[]` allocation in `computePathPreview` and `computeDesignPreview`
- **Module-scope synergy colors**: `SYNERGY_COLORS` in RenderBridge hoisted from inline object literal to module scope — zero allocation per synergy event
- **Module-scope personality prefix**: `PERSONALITY_PREFIX` in GlimmerAI hoisted from per-frame `Record` literal to module constant
- **Zero-alloc zone thought**: `getZoneThought()` iterates rules with early-return `for` loop instead of `.map()` + type check

#### Why Previous Version Failed
- Per-frame object literals (`{ molten_spikes: 0xff6600, ... }`) created GC pressure at 60fps
- `computePathPreview` and `computeDesignPreview` allocated fresh arrays every frame
- `.map()` in `getZoneThought` allocated an intermediate array every call
- `personalityPrefix` object literal created 4-entry Record every `getLiveThought` call

#### Why This Version Is Better
- **Zero per-frame allocations** in the hot path (RuleEngine.tick → GlimmerAI.decide → RenderBridge.sync)
- All optimizations are pure mechanical — no behavioral change, no API change
- Existing test suite (61 tests) passes unchanged, confirming no regressions

## [Unreleased] - Trap Drafting + Zone-Dependent Behavior

### Added
- **Trap Drafting**: Random hand of 4 cards per attempt. Place from hand only.
- **Hand Reroll**: Spend 1 Influence to redraw hand. Each reroll produces different cards.
- **Zone-Dependent Behavior**: Same trap type behaves differently on Platforms vs Walkways.
  - FlameVent: walkway = brief burst (0.75s), platform = standard (1.5s)
  - SpikeWall: walkway = extended (3s), platform = standard (2s)
  - SentryOrb: walkway = 1.5x speed projectile
  - GravityWell: walkway = pull + 0.5s freeze
  - TemporalRift: walkway = steals 2s, platform = steals 3s
- **Walkway Damage Bonus**: All traps deal 1.5x damage on walkways (narrow passages).
- **Stack Penalty**: 2+ traps in same zone = 0.6x damage multiplier (discourages center stacking).
- **Starting Influence**: Players start each attempt with 2 Influence (enables reroll).
- **Visible AI Adaptation**: 😰 emoji on zones the hero fears. Heatmap-driven danger indicators.
- **Zone Tooltip**: DesignPanel now explains walkway vs platform behavior.
- **5 Playable Zones**: Walkways are now deployable (was: 3 platforms only).

### Changed
- **Hero HP**: 2 (down from 3) — faster kills, more tension.
- **Attempt Duration**: 15s (down from 20s) — tighter pacing, less dead time.
- **Deploy Timer**: 1.5s (down from 3s) — less waiting between placement and activation.
- **Event Interval**: 5-9s (down from 7-11s) — events happen more often.
- **Event Duration**: 3s (down from 4s) — snappier events.
- **Damage Multiplier Calculation**: Now includes walkway bonus and stack penalty.

### Fixed
- **Reroll Bug**: Players now start with 2 Influence so reroll is usable in design phase (was: 0, making reroll impossible).
- **CenterPlatform Dominant Strategy**: Stack penalty + walkway bonus makes spreading traps across zones objectively better.
- **Dead Time**: 3s deploy timer × 4 cards = 12s of nothing. Now 1.5s × 4 = 6s (50% reduction).
- **Zone-Dependent Effects Invisible**: Added tooltip, danger indicators, and larger effect differences.
- **generateHand() Producing Same Cards on Reroll**: Added rerollCount offset to deterministic seed.

### Why Previous Version Failed
- **No Card Scarcity**: Player could place any trap anywhere. No decisions, no adaptation.
- **CenterPlatform Dominant**: All damage on center = guaranteed kill. No reason to diversify.
- **12s Dead Time**: 3s deploy timer × 4 cards = watching a timer, not playing.
- **Walkways Were Decoys**: No incentive to place traps on walkways. 3 zones worked, 2 were useless.
- **AI Adaptation Invisible**: Hero's memory system existed but player never saw it learning.
- **Reroll Impossible**: Influence started at 0 each attempt. Reroll button was always disabled.

### Why This Version Is Better
- **Every Attempt Is Different**: Random card hands + zone behavior = unique strategies.
- **Meaningful Decisions**: Which card to place? Which zone? Reroll now or save?
- **Spatial Puzzle**: Walkways are dangerous (1.5x damage) but platforms offer combos.
- **Visible Adaptation**: Player sees the hero learning, creating cat-and-mouse dynamic.
- **No Dominant Strategy**: Stack penalty forces spread. Multiple viable play styles.
- **Tight Pacing**: 15s attempts, 1.5s deploy, events every 5-9s. No dead time.

## Previous Versions

### [Unreleased] - Trap Synergy Trees
- Added 5 synergies: Molten Spikes, Fireball, Impale, Time Bolt, Black Hole
- Synergy detection and damage multipliers
- Diminishing returns for 3+ traps in same zone
- Visual synergy banners and effects
