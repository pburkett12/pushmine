const BOARD_SIZE = 5;
const WIN_LENGTH = 4;

const boardEl = document.getElementById("board");
const difficultyEl = document.getElementById("difficulty");
const firstPlayerEl = document.getElementById("firstPlayer");
const restartBtn = document.getElementById("restart");
const turnStatusEl = document.getElementById("turnStatus");
const actionHintEl = document.getElementById("actionHint");

const ui = {
  p1Mines: document.getElementById("p1Mines"),
  p2Mines: document.getElementById("p2Mines"),
  outcome: document.getElementById("outcome"),
  turnCount: document.getElementById("turnCount"),
  p1MinesEarned: document.getElementById("p1MinesEarned"),
  p2MinesEarned: document.getElementById("p2MinesEarned"),
  p1MinesPlaced: document.getElementById("p1MinesPlaced"),
  p2MinesPlaced: document.getElementById("p2MinesPlaced"),
  minesDetonated: document.getElementById("minesDetonated"),
  p1Detonated: document.getElementById("p1Detonated"),
  p2Detonated: document.getElementById("p2Detonated"),
  p1OppEject: document.getElementById("p1OppEject"),
  p1SelfEject: document.getElementById("p1SelfEject"),
  p2OppEject: document.getElementById("p2OppEject"),
  p2SelfEject: document.getElementById("p2SelfEject"),
  p1MineImpact: document.getElementById("p1MineImpact"),
  p2MineImpact: document.getElementById("p2MineImpact"),
  repeatHigh: document.getElementById("repeatHigh"),
  longestCycle: document.getElementById("longestCycle"),
};

const PLAYER_NAMES = {
  P1: "Player 1",
  P2: "Player 2",
};

let gameState = null;
let aiBusy = false;

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function initialMetrics() {
  return {
    turns: 0,
    outcome: "In progress",
    minesEarned: { P1: 0, P2: 0 },
    minesPlaced: { P1: 0, P2: 0 },
    minesDetonated: 0,
    stonesDetonated: { P1: 0, P2: 0 },
    ejections: {
      opponent: { P1: 0, P2: 0 },
      self: { P1: 0, P2: 0 },
    },
    mineImpact: { P1: 0, P2: 0 },
    repetition: {
      counts: new Map(),
      lastSeen: new Map(),
      mostRepeated: 1,
      longestCycle: 0,
    },
  };
}

function resetGame() {
  const first = firstPlayerEl.value;
  gameState = {
    board: createEmptyBoard(),
    currentPlayer: first,
    inventories: { P1: 0, P2: 0 },
    aiPlayer: "P2",
    humanPlayer: "P1",
    lastPush: null,
    lastAction: null,
    metrics: initialMetrics(),
    gameOver: false,
  };
  aiBusy = false;
  updateRepetitionMetrics();
  render();
  maybeTriggerAi();
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function otherPlayer(player) {
  return player === "P1" ? "P2" : "P1";
}

function serializeBoard(board) {
  return board
    .map((row) =>
      row
        .map((cell) => {
          if (cell === null) return "_";
          return cell === "M" ? "M" : cell === "P1" ? "1" : "2";
        })
        .join("")
    )
    .join("/");
}

function boardHash(state) {
  return `${serializeBoard(state.board)}|${state.currentPlayer}|${state.inventories.P1}-${state.inventories.P2}`;
}

function updateRepetitionMetrics() {
  const { repetition, turns } = gameState.metrics;
  const hash = boardHash(gameState);
  const count = (repetition.counts.get(hash) || 0) + 1;
  repetition.counts.set(hash, count);
  repetition.mostRepeated = Math.max(repetition.mostRepeated, count);
  if (repetition.lastSeen.has(hash)) {
    const cycleLen = turns - repetition.lastSeen.get(hash);
    repetition.longestCycle = Math.max(repetition.longestCycle, cycleLen);
  }
  repetition.lastSeen.set(hash, turns);
}

function render() {
  renderBoard();
  renderStatus();
  renderMetrics();
}

function renderStatus() {
  const { currentPlayer, gameOver, inventories, humanPlayer } = gameState;
  ui.p1Mines.textContent = inventories.P1;
  ui.p2Mines.textContent = inventories.P2;
  if (gameOver) {
    turnStatusEl.innerHTML = `<h2>Game Over</h2><p>${gameState.metrics.outcome}</p>`;
    actionHintEl.textContent = "Restart to play again.";
    return;
  }
  const isHumanTurn = currentPlayer === humanPlayer;
  turnStatusEl.innerHTML = `<h2>Turn: ${PLAYER_NAMES[currentPlayer]}</h2>`;
  if (isHumanTurn) {
    actionHintEl.textContent = inventories[currentPlayer]
      ? "Click an arrow to push or click an empty cell to place a mine."
      : "Click an arrow to push a line.";
  } else {
    actionHintEl.textContent = "AI is thinking...";
  }
}

function renderMetrics() {
  const metrics = gameState.metrics;
  ui.outcome.textContent = metrics.outcome;
  ui.turnCount.textContent = `${metrics.turns} turns`;
  ui.p1MinesEarned.textContent = metrics.minesEarned.P1;
  ui.p2MinesEarned.textContent = metrics.minesEarned.P2;
  ui.p1MinesPlaced.textContent = metrics.minesPlaced.P1;
  ui.p2MinesPlaced.textContent = metrics.minesPlaced.P2;
  ui.minesDetonated.textContent = metrics.minesDetonated;
  ui.p1Detonated.textContent = metrics.stonesDetonated.P1;
  ui.p2Detonated.textContent = metrics.stonesDetonated.P2;
  ui.p1OppEject.textContent = metrics.ejections.opponent.P1;
  ui.p1SelfEject.textContent = metrics.ejections.self.P1;
  ui.p2OppEject.textContent = metrics.ejections.opponent.P2;
  ui.p2SelfEject.textContent = metrics.ejections.self.P2;
  ui.p1MineImpact.textContent = metrics.mineImpact.P1;
  ui.p2MineImpact.textContent = metrics.mineImpact.P2;
  ui.repeatHigh.textContent = `${metrics.repetition.mostRepeated}`;
  ui.longestCycle.textContent = `${metrics.repetition.longestCycle}`;
}

function renderBoard() {
  boardEl.innerHTML = "";
  const { board } = gameState;
  for (let r = 0; r < BOARD_SIZE + 2; r += 1) {
    for (let c = 0; c < BOARD_SIZE + 2; c += 1) {
      const isEdgeRow = r === 0 || r === BOARD_SIZE + 1;
      const isEdgeCol = c === 0 || c === BOARD_SIZE + 1;
      if (isEdgeRow && isEdgeCol) {
        const spacer = document.createElement("div");
        spacer.className = "cell";
        spacer.style.visibility = "hidden";
        boardEl.appendChild(spacer);
        continue;
      }
      if (isEdgeRow || isEdgeCol) {
        const arrow = document.createElement("button");
        arrow.className = "arrow";
        const dir = arrowDirection(r, c);
        arrow.textContent = dir.symbol;
        arrow.dataset.type = "push";
        arrow.dataset.line = dir.line;
        arrow.dataset.index = dir.index;
        arrow.dataset.side = dir.side;
        if (isLastActionPush(dir)) {
          arrow.classList.add("last-move");
        }
        if (!canPlayerAct() || !isPushAllowed(gameState, dir)) {
          arrow.classList.add("disabled");
        }
        arrow.addEventListener("click", handleArrowClick);
        boardEl.appendChild(arrow);
        continue;
      }
      const cell = document.createElement("div");
      cell.className = "cell";
      const boardRow = r - 1;
      const boardCol = c - 1;
      const value = board[boardRow][boardCol];
      cell.dataset.row = boardRow;
      cell.dataset.col = boardCol;
      if (!canPlayerAct()) {
        cell.classList.add("disabled");
      }
      if (isCellLastAction(boardRow, boardCol)) {
        cell.classList.add("last-move");
      }
      if (value === null) {
        cell.classList.add("empty");
      }
      if (value === "M") {
        cell.classList.add("mine");
        cell.textContent = "💣";
      }
      if (value === "P1" || value === "P2") {
        const stone = document.createElement("div");
        stone.className = `stone ${value === "P1" ? "p1" : "p2"}`;
        cell.appendChild(stone);
      }
      cell.addEventListener("click", handleCellClick);
      boardEl.appendChild(cell);
    }
  }
}

function arrowDirection(r, c) {
  const index = r === 0 || r === BOARD_SIZE + 1 ? c - 1 : r - 1;
  if (r === 0) {
    return { symbol: "↓", line: "col", index, side: "top" };
  }
  if (r === BOARD_SIZE + 1) {
    return { symbol: "↑", line: "col", index, side: "bottom" };
  }
  if (c === 0) {
    return { symbol: "→", line: "row", index, side: "left" };
  }
  return { symbol: "←", line: "row", index, side: "right" };
}

function canPlayerAct() {
  return !gameState.gameOver && gameState.currentPlayer === gameState.humanPlayer && !aiBusy;
}

function handleArrowClick(event) {
  if (!canPlayerAct()) return;
  const { line, index, side } = event.currentTarget.dataset;
  const action = {
    type: "push",
    line,
    index: Number(index),
    side,
  };
  if (!isPushAllowed(gameState, action)) return;
  applyAction(action, true);
}

function handleCellClick(event) {
  if (!canPlayerAct()) return;
  const row = Number(event.currentTarget.dataset.row);
  const col = Number(event.currentTarget.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return;
  if (gameState.inventories[gameState.currentPlayer] < 1) return;
  if (gameState.board[row][col] !== null) return;
  const action = { type: "mine", row, col };
  applyAction(action, true);
}

function applyAction(action, commit) {
  const state = commit ? gameState : cloneState(gameState);
  const player = state.currentPlayer;
  let minesEarned = 0;
  if (action.type === "push") {
    const result = pushLine(state, action, commit);
    minesEarned = result.minesEarned;
    state.lastPush = { line: action.line, index: action.index, side: action.side };
    state.lastAction = { ...action };
  } else if (action.type === "mine") {
    let beforeWins = 0;
    if (commit) {
      const opponent = otherPlayer(player);
      beforeWins = countImmediateWins(state, opponent);
    }
    state.board[action.row][action.col] = "M";
    state.inventories[player] -= 1;
    if (commit) {
      state.metrics.minesPlaced[player] += 1;
      const opponent = otherPlayer(player);
      const afterWins = countImmediateWins(state, opponent);
      if (beforeWins > 0 && afterWins === 0) {
        state.metrics.mineImpact[player] += 1;
      }
    }
    state.lastPush = null;
    state.lastAction = { ...action };
  }

  if (commit) {
    state.metrics.turns += 1;
    if (minesEarned > 0) {
      state.metrics.minesEarned[player] += minesEarned;
    }
  }

  const winner = determineWinner(state.board, player);
  if (winner) {
    if (commit) {
      state.metrics.outcome = `${PLAYER_NAMES[winner]} wins`;
      state.gameOver = true;
    }
  } else {
    state.currentPlayer = otherPlayer(state.currentPlayer);
  }

  if (commit) {
    updateRepetitionMetrics();
    render();
    maybeTriggerAi();
  }
  return state;
}

function pushLine(state, action, commit) {
  const { line, index, side } = action;
  const player = state.currentPlayer;
  let carry = player;
  const lineIndices = getLineIndices(line, index, side);
  let minesEarned = 0;
  for (const [r, c] of lineIndices) {
    const cell = state.board[r][c];
    if (cell === "M") {
      if (carry) {
        state.board[r][c] = null;
        if (commit) {
          state.metrics.minesDetonated += 1;
          if (carry === "P1" || carry === "P2") {
            state.metrics.stonesDetonated[carry] += 1;
          }
        }
      }
      carry = null;
      break;
    }
    state.board[r][c] = carry;
    carry = cell;
  }
  if (carry) {
    if (carry === "P1" || carry === "P2") {
      const opponent = otherPlayer(player);
      if (carry === opponent) {
        minesEarned = 1;
        state.inventories[player] += 1;
        if (commit) {
          state.metrics.ejections.opponent[player] += 1;
        }
      } else if (commit) {
        state.metrics.ejections.self[player] += 1;
      }
    }
  }
  return { minesEarned };
}

function getLineIndices(line, index, side) {
  const indices = [];
  if (line === "row") {
    if (side === "left") {
      for (let c = 0; c < BOARD_SIZE; c += 1) indices.push([index, c]);
    } else {
      for (let c = BOARD_SIZE - 1; c >= 0; c -= 1) indices.push([index, c]);
    }
  } else if (side === "top") {
    for (let r = 0; r < BOARD_SIZE; r += 1) indices.push([r, index]);
  } else {
    for (let r = BOARD_SIZE - 1; r >= 0; r -= 1) indices.push([r, index]);
  }
  return indices;
}

function determineWinner(board, lastPlayer) {
  const p1Win = hasFour(board, "P1");
  const p2Win = hasFour(board, "P2");
  if (p1Win && p2Win) {
    return otherPlayer(lastPlayer);
  }
  if (p1Win) return "P1";
  if (p2Win) return "P2";
  return null;
}

function hasFour(board, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of directions) {
        let count = 1;
        for (let step = 1; step < WIN_LENGTH; step += 1) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
          if (board[nr][nc] !== player) break;
          count += 1;
        }
        if (count >= WIN_LENGTH) return true;
      }
    }
  }
  return false;
}

function cloneState(state) {
  return {
    board: cloneBoard(state.board),
    currentPlayer: state.currentPlayer,
    inventories: { ...state.inventories },
    aiPlayer: state.aiPlayer,
    humanPlayer: state.humanPlayer,
    lastPush: state.lastPush ? { ...state.lastPush } : null,
    lastAction: state.lastAction ? { ...state.lastAction } : null,
    gameOver: state.gameOver,
    metrics: state.metrics,
  };
}

function isLastActionPush(dir) {
  const action = gameState.lastAction;
  if (!action || action.type !== "push") return false;
  return action.line === dir.line && action.index === dir.index && action.side === dir.side;
}

function isCellLastAction(row, col) {
  const action = gameState.lastAction;
  if (!action) return false;
  if (action.type === "mine") {
    return action.row === row && action.col === col;
  }
  if (action.type === "push") {
    if (action.line === "row" && action.index === row) return true;
    if (action.line === "col" && action.index === col) return true;
  }
  return false;
}

function countImmediateWins(state, player) {
  let wins = 0;
  for (const action of generatePushActions(state)) {
    const next = {
      board: cloneBoard(state.board),
      currentPlayer: player,
      inventories: { P1: 0, P2: 0 },
      lastPush: state.lastPush ? { ...state.lastPush } : null,
    };
    pushLine(next, action, false);
    next.lastPush = { line: action.line, index: action.index, side: action.side };
    const winner = determineWinner(next.board, player);
    if (winner === player) wins += 1;
  }
  return wins;
}

function generatePushActions(state) {
  const actions = [];
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    actions.push({ type: "push", line: "row", index: i, side: "left" });
    actions.push({ type: "push", line: "row", index: i, side: "right" });
    actions.push({ type: "push", line: "col", index: i, side: "top" });
    actions.push({ type: "push", line: "col", index: i, side: "bottom" });
  }
  if (!state) return actions;
  return actions.filter((action) => isPushAllowed(state, action));
}

function generateLegalActions(state) {
  const actions = generatePushActions(state);
  if (state.inventories[state.currentPlayer] > 0) {
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        if (state.board[r][c] === null) {
          actions.push({ type: "mine", row: r, col: c });
        }
      }
    }
  }
  return actions;
}

function isPushAllowed(state, action) {
  if (!state.lastPush) return true;
  if (state.lastPush.line !== action.line || state.lastPush.index !== action.index) return true;
  const oppositeSide =
    state.lastPush.side === "left"
      ? "right"
      : state.lastPush.side === "right"
      ? "left"
      : state.lastPush.side === "top"
      ? "bottom"
      : "top";
  return action.side !== oppositeSide;
}

function evaluateState(state, player) {
  const winner = determineWinner(state.board, otherPlayer(state.currentPlayer));
  if (winner === player) return 10000;
  if (winner && winner !== player) return -10000;

  const opp = otherPlayer(player);
  const threats = countOpenThrees(state.board, player) - countOpenThrees(state.board, opp);
  const oppImmediateWins = countImmediateWins(state, opp);
  const mineValue = state.inventories[player] * 3 - state.inventories[opp] * 2;
  return threats * 15 - oppImmediateWins * 40 + mineValue;
}

function countOpenThrees(board, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  let count = 0;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      for (const [dr, dc] of directions) {
        let stones = 0;
        let empties = 0;
        for (let step = 0; step < WIN_LENGTH; step += 1) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
            stones = 0;
            empties = 0;
            break;
          }
          const cell = board[nr][nc];
          if (cell === player) stones += 1;
          else if (cell === null) empties += 1;
          else {
            stones = 0;
            empties = 0;
            break;
          }
        }
        if (stones === 3 && empties === 1) count += 1;
      }
    }
  }
  return count;
}

function maybeTriggerAi() {
  if (gameState.gameOver) return;
  if (gameState.currentPlayer !== gameState.aiPlayer) return;
  aiBusy = true;
  render();
  setTimeout(() => {
    const difficulty = difficultyEl.value;
    const action = chooseAiAction(difficulty);
    aiBusy = false;
    applyAction(action, true);
  }, 700);
}

function chooseAiAction(difficulty) {
  if (difficulty === "easy") return chooseEasyAction();
  if (difficulty === "medium") return chooseSearchAction(4);
  return chooseSearchAction(6, true);
}

function chooseEasyAction() {
  const player = gameState.currentPlayer;
  const opponent = otherPlayer(player);
  const pushActions = generatePushActions(gameState);
  const winningPushes = pushActions.filter((action) => {
    const sim = applyAction(action, false);
    return determineWinner(sim.board, player) === player;
  });
  if (winningPushes.length) {
    return winningPushes[Math.floor(Math.random() * winningPushes.length)];
  }

  const opponentImmediateWins = countImmediateWins(gameState, opponent);
  if (gameState.inventories[player] > 0 && opponentImmediateWins > 0) {
    const mineActions = generateLegalActions(gameState).filter((action) => action.type === "mine");
    const blocking = mineActions.filter((action) => {
      const sim = applyAction(action, false);
      const after = countImmediateWins(sim, opponent);
      return after === 0;
    });
    if (blocking.length) {
      return blocking[Math.floor(Math.random() * blocking.length)];
    }
  }

  const safePushes = pushActions.filter((action) => {
    const sim = applyAction(action, false);
    const oppWins = countImmediateWins(sim.board, opponent);
    return oppWins === 0;
  });
  const choicePool = safePushes.length ? safePushes : pushActions;
  return choicePool[Math.floor(Math.random() * choicePool.length)];
}

function chooseSearchAction(depth, useTable = false) {
  const player = gameState.currentPlayer;
  const actions = generateLegalActions(gameState);
  const table = useTable ? new Map() : null;
  let bestScore = -Infinity;
  let bestAction = actions[0];
  for (const action of actions) {
    const sim = applyAction(action, false);
    const score = -negamax(sim, depth - 1, -Infinity, Infinity, otherPlayer(player), player, table);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  return bestAction;
}

function negamax(state, depth, alpha, beta, player, rootPlayer, table) {
  const key = table ? `${boardHash(state)}|${depth}|${player}` : null;
  if (table && table.has(key)) return table.get(key);

  const winner = determineWinner(state.board, otherPlayer(state.currentPlayer));
  if (winner) {
    const score = winner === rootPlayer ? 10000 : -10000;
    if (table) table.set(key, score);
    return score;
  }
  if (depth === 0) {
    const evalScore = evaluateState(state, rootPlayer);
    if (table) table.set(key, evalScore);
    return evalScore;
  }

  const actions = generateLegalActions(state);
  let value = -Infinity;
  for (const action of actions) {
    const sim = applyAction(action, false);
    const score = -negamax(sim, depth - 1, -beta, -alpha, otherPlayer(player), rootPlayer, table);
    value = Math.max(value, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  if (table) table.set(key, value);
  return value;
}

restartBtn.addEventListener("click", resetGame);
firstPlayerEl.addEventListener("change", resetGame);

difficultyEl.addEventListener("change", () => {
  if (!gameState.gameOver && gameState.currentPlayer === gameState.aiPlayer) {
    maybeTriggerAi();
  }
});

resetGame();
