const assert = require("assert");

function createStubElement(id) {
  return {
    id,
    value: "",
    disabled: false,
    textContent: "",
    innerHTML: "",
    className: "",
    dataset: {},
    style: {},
    classList: {
      add() {},
    },
    appendChild() {},
    addEventListener() {},
    querySelector() {
      return { textContent: "" };
    },
  };
}

const elementIds = [
  "board",
  "gameMode",
  "difficulty",
  "firstPlayer",
  "restart",
  "turnStatus",
  "actionHint",
  "p1Mines",
  "p2Mines",
  "outcome",
  "turnCount",
  "p1MinesEarned",
  "p2MinesEarned",
  "p1MinesPlaced",
  "p2MinesPlaced",
  "minesDetonated",
  "p1Detonated",
  "p2Detonated",
  "p1OppEject",
  "p1SelfEject",
  "p2OppEject",
  "p2SelfEject",
  "p1MineImpact",
  "p2MineImpact",
  "repeatHigh",
  "longestCycle",
  "moveLog",
];

const elements = new Map();
for (const id of elementIds) {
  elements.set(id, createStubElement(id));
}
elements.get("gameMode").value = "ai";
elements.get("difficulty").value = "medium";
elements.get("firstPlayer").value = "P1";

global.document = {
  getElementById(id) {
    if (!elements.has(id)) {
      const stub = createStubElement(id);
      elements.set(id, stub);
    }
    return elements.get(id);
  },
  createElement(tag) {
    return createStubElement(tag);
  },
};

const {
  createEmptyBoard,
  initialMetrics,
  countImmediateWins,
  applyAction,
  chooseAiAction,
  setGameStateForTest,
} = require("../script.js");

function buildState(board, currentPlayer = "P2", inventories = { P1: 0, P2: 1 }) {
  return {
    board,
    currentPlayer,
    inventories: { ...inventories },
    aiPlayer: "P2",
    humanPlayer: "P1",
    localMultiplayer: false,
    lastPush: null,
    lastAction: null,
    metrics: initialMetrics(),
    gameOver: false,
  };
}

function describeAction(action) {
  if (!action) return "none";
  if (action.type === "mine") {
    return `mine @ (${action.row}, ${action.col})`;
  }
  return `${action.type} ${action.line} ${action.index} from ${action.side}`;
}

function runScenario(label, boardBuilder) {
  const baseBoard = createEmptyBoard();
  boardBuilder(baseBoard);
  const initialState = buildState(baseBoard);
  setGameStateForTest(initialState);
  const beforeWins = countImmediateWins(initialState, "P1");
  assert.ok(beforeWins > 0, `${label}: expected P1 to have immediate win options`);

  const mediumAction = chooseAiAction("medium");
  const mediumState = applyAction(mediumAction, false);
  const mediumWins = countImmediateWins(mediumState, "P1");
  console.log(`${label} | medium action: ${describeAction(mediumAction)} | P1 immediate wins: ${mediumWins}`);
  assert.strictEqual(mediumWins, 0, `${label}: medium should block immediate win`);

  const hardAction = chooseAiAction("hard");
  const hardState = applyAction(hardAction, false);
  const hardWins = countImmediateWins(hardState, "P1");
  console.log(`${label} | hard action: ${describeAction(hardAction)} | P1 immediate wins: ${hardWins}`);
  assert.strictEqual(hardWins, 0, `${label}: hard should block immediate win`);
}

runScenario("Scenario 1: straight 3-in-a-row with winning push", (board) => {
  board[2][0] = "P1";
  board[2][1] = "P1";
  board[2][2] = "P1";
});

runScenario("Scenario 2: gapped 3-in-a-row with adjacent push fill", (board) => {
  board[2][0] = "P1";
  board[2][1] = "P1";
  board[2][3] = "P1";
  board[1][2] = "P1";
});

console.log("AI scenario tests completed.");
