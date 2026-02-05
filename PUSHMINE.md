# Pushmine (Draft Ruleset v0.1)

## Concept
A fast, deterministic, 2-player abstract game played on a grid. Players normally take turns “pushing” a row or column to insert their stone. If you ever push an opponent’s stone off the board, you earn a Mine. Mines are a limited special move that trade tempo for tactical disruption.

Recommended starting config:
- Board: 5×5
- Win condition: 4-in-a-row (orthogonal or diagonal)
- Mines: earned only via opponent ejection; placed as a full turn; neutral; single-use

---

## Components
- Board: 5×5 grid
- Stones: two colors/sides (unlimited supply)
- Mines: neutral tokens (not owned once placed), stored in a player’s inventory until used

---

## Turn Structure
On your turn, choose exactly ONE action:

A) **Push a line (normal move)**
- Choose a row or column.
- Choose a side to push from (one of the two ends of that row/column).
- Insert one of your stones at the chosen entry cell (stones only enter at the edge of the board where the "push" originates).
- The entire line shifts by 1 in the push direction.
- If the line was full, the far-end cell’s contents would be pushed off the board (ejected).
- Example: X and O represent player pieces. Lowercase e represents empty cells.
  - Start of player X turn: Row 2 looks like X e e O O.
  - Player X pushes and inserts from the left side.
  - End of turn: Row 2 looks like X X e e O. The entire row shifted.
  - Since an O was pushed off the board by player X, X gains a mine (see Mine Mechanics below). 

B) **Place a Mine (special move)**
- Only if you have ≥1 Mine in inventory.
- Place a Mine on any **empty** cell on the board.
- This ends your turn (no push occurs).

---

## Win Condition
After each turn (after a push or mine placement), check:
- If either player has any sequence of **4 of their stones** in a straight line:
  - horizontal, vertical, or diagonal
- If yes: the player wins immediately.
- If both players have a sequence of 4 in a line after a turn, award the win to whichever player did **not** play the turn (punishes the active player for creating a sequence for their opponent).

Draw condition:
- Allow indefinite play and detect repetition in metrics (see playtests).

---

## Mine Mechanics (Detailed)
### Earning Mines
- You earn **1 Mine** whenever your **push action** ejects an **opponent stone** off the far edge.
- You do **not** earn a Mine if:
  - you eject your own stone
  - a Mine detonates and removes a stone
- (If multiple opponent stones could be ejected in a single push due to interactions, define earnings as: **max 1 Mine per push**. With the “push stops at mine” rule below, this should be naturally enforced.)

### Mine Behavior (on pushes)
Mines are immovable hazards on the board:
- Mines **cannot be moved** by pushes.
- When a row with a Mine is pushed, the Mine does not move and the push stops immediately at the Mine's position.
  - Cells "after" the Mine in the push direction do not change.
  - No further ejection from the board occurs on this turn.
- When a pushed line would move a stone into a cell containing a Mine:
  - The incoming stone is **destroyed** (removed from the game).
  - The Mine is also **destroyed** (removed from the board).
  - The push still **stops immediately** at that point.

Mines are neutral:
- They destroy **either player’s** stone the same way, regardless of who placed the Mine.

### Mine Placement Constraints
- Mines may be placed only on **empty** cells.
- Mines are not “pieces” for win conditions and do not block line checks except by their interaction with pushes.

---

## Implementation Constraints / Clarifications (Recommended)
- A turn is always exactly one action: either Push OR Place Mine.
- Pushing is allowed from either end of any row/column (total legal pushes per turn = 5 rows * 2 sides + 5 cols * 2 sides = 20).
- **No Immediate Undo:** you may not perform the exact opposite push on the same row/column as the previous push (prevents mirror back-and-forth).
- Win check happens after the action resolves (including any mine detonation effects).

---

## Playtest Metrics to Track
Track these per game (and optionally per turn):
- **Game length**: number of turns (ply) to resolution
- **Outcome**: win (P1/P2) vs draw
- **Mines earned** (per player)
- **Mines placed** (per player)
- **Mines detonated** (count; and whose stone was destroyed when detonated)
- **Ejections**: opponent ejections vs self ejections
- **Mine impact proxy**:
  - count of mine placements that reduce opponent’s “immediate win next turn” options to zero
  - or count of turns where a mine detonation prevents an imminent 4-in-a-row threat
- **Repetition signals**:
  - repeated board states (hash frequency)
  - longest cycle detected (optional)

---

## What to Watch for in Playtests
- **Slog risk**: games commonly exceed a target length (e.g., 60–90 ply) without resolution.
- **Denial dominance**: mines plus “push stops” make it too easy to indefinitely parry threats.
- **Mine irrelevance**: mines are earned but rarely placed, or placed but rarely matter.
- **Cheap wins** (5×5 + 4-in-row):
  - games end abruptly from “accidental” alignments more often than feels fair/fun
- **Snowballing**:
  - the player who earns the first mine tends to win disproportionately often (even though mine placement costs tempo)

---

## AI Opponent Outline

### Core primitives (useful for all difficulties)
- Generate legal actions:
  - Push actions (20)
  - Mine placements (empty cells) if inventory > 0
- Apply action → next state
- Win check after action
- Tactical detectors:
  - “Immediate win” moves for the current player
  - “Immediate win next turn” opportunities for the opponent (after you act)
  - Mine detonation forecasting on each push (where it would stop / what gets removed)

### Evaluation Heuristic (baseline)
Combine lightweight features:
- +Large bonus for terminal win / -Large for terminal loss
- Threat scoring:
  - number of open-ended 3-in-a-row (with extendability to 4) for you minus opponent
  - number of immediate winning pushes available next turn for opponent (big negative)
- Mine value signals:
  - inventory value (small positive, diminishing returns)
  - mines on board that can be detonated to delete a key stone (contextual)
- Mobility/pressure:
  - how many pushes preserve or increase your threats vs reduce opponent threats

### Difficulty scaling
**Easy**
- Random among legal pushes, but:
  - always take an immediate winning move if available
  - avoid “obvious blunders”:
    - if a mine placement is available that prevents opponent’s immediate win next turn, consider it
    - avoid pushes that give opponent an immediate win next turn (if detectable in 1-ply)

**Medium**
- Shallow search + tactics:
  - minimax/negamax with alpha-beta to depth ~2 full turns (4 ply)
  - include mine placement actions in the tree
  - prioritize ordering:
    - winning moves first
    - moves that block opponent immediate wins
    - mine placements that create favorable interruptions
  - apply the Easy-mode tactical checks (take immediate win, or block opponent immediate win with pushes or mines)
  - if multiple actions share the best score, pick randomly among them to avoid deterministic openings

**Hard**
- Deeper search + caching:
  - depth ~3 full turns (6 ply), possibly iterative deepening with time budget
  - transposition table keyed by:
    - board contents + mine positions + mine inventories + side to move
  - improved eval:
    - recognize forks (two simultaneous 4-threats)
    - assign higher value to mine placements that “freeze” a critical lane without gifting tempo
  - optional: repetition avoidance (penalize returning to recently seen states)
  - apply the Easy-mode tactical checks (take immediate win, or block opponent immediate win with pushes or mines)
  - if multiple actions share the best score, pick randomly among them to avoid deterministic openings

---

## Notes / Tweaks to Keep in the Back Pocket

### Variant: 4×4 board (blitz mode)
- Board: 4×4, win still 4-in-a-row
- Expected: sharper, mines higher leverage, defense stronger
- Watch for: drawish cycles, repeated-state loops, overpowered mine stabilization

### Mine Decay (if slog/denial shows up)
Two clean decay models:
A) **Disappear**
- A mine vanishes after N full turns (e.g., after each player takes 3 turns) if not detonated.

B) **Dud**
- After N full turns, mine becomes a permanent immovable “blocker” that:
  - still stops pushes (optional)
  - but does NOT destroy pieces (or does nothing except occupy a cell)
- Alternative: mine is movable, but does not contribute to either player's lines.
- Use only if you want mines to shift from tactical nuke to positional constraint.


---

## Implementation Progress

### Implemented
- Built a playable 5×5 Pushmine game with full push + mine mechanics, local play vs. AI (easy/medium/hard), and UI controls for starting player and difficulty.
- Added board UI with edge arrows for push moves, mine placement on empty cells when available, win/draw handling, and gameplay metric tracking for playtest evaluation.
- Enforced the “no immediate undo” rule to prevent mirrored push-back cycles.

### Questions

### Problems Identified

### Planned Changes
