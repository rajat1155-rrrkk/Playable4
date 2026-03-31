const boardElement = document.getElementById("board");
const movesElement = document.getElementById("moves-count");
const chargeElement = document.getElementById("charge-count");
const statusElement = document.getElementById("status-text");
const goalElement = document.getElementById("goal-text");
const tutorialCallout = document.getElementById("tutorial-callout");
const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlay-message");
const replayButton = document.getElementById("replay-button");

const ctaButtons = [
  document.getElementById("top-cta"),
  document.getElementById("main-cta"),
  document.getElementById("overlay-cta"),
].filter(Boolean);

const adTargetUrl = "https://play.google.com/store";
const directionOrder = ["up", "right", "down", "left"];
const directionVectors = {
  up: { row: -1, col: 0, opposite: "down" },
  right: { row: 0, col: 1, opposite: "left" },
  down: { row: 1, col: 0, opposite: "up" },
  left: { row: 0, col: -1, opposite: "right" },
};

const baseTiles = [
  [
    { type: "source", open: ["right"] },
    { type: "straight", open: ["left", "right"] },
    { type: "corner", open: ["left", "down"] },
    { type: "corner", open: ["right", "down"] },
    { type: "corner", open: ["left", "down"] },
  ],
  [
    { type: "corner", open: ["right", "down"] },
    { type: "straight", open: ["left", "right"] },
    { type: "straight", open: ["up", "down"] },
    { type: "corner", open: ["left", "up"] },
    { type: "straight", open: ["left", "right"] },
  ],
  [
    { type: "corner", open: ["up", "right"] },
    { type: "corner", open: ["left", "down"] },
    { type: "straight", open: ["up", "down"] },
    { type: "corner", open: ["right", "down"] },
    { type: "corner", open: ["left", "down"] },
  ],
  [
    { type: "corner", open: ["right", "down"] },
    { type: "straight", open: ["left", "right"] },
    { type: "corner", open: ["up", "right"] },
    { type: "straight", open: ["left", "right"] },
    { type: "corner", open: ["left", "down"] },
  ],
  [
    { type: "corner", open: ["up", "right"] },
    { type: "straight", open: ["left", "right"] },
    { type: "straight", open: ["left", "right"] },
    { type: "corner", open: ["left", "up"] },
    { type: "vault", open: ["up"] },
  ],
];

const scrambleRotations = [
  [0, 0, 3, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
];

const tutorialTarget = { row: 0, col: 2 };

let state;
let cellMap;

function createGameState() {
  const board = baseTiles.map((row, rowIndex) =>
    row.map((tile, colIndex) => ({
      ...tile,
      row: rowIndex,
      col: colIndex,
      rotation: scrambleRotations[rowIndex][colIndex],
      energized: false,
    })),
  );

  return {
    board,
    moves: 0,
    charge: 100,
    solved: false,
    tutorialDone: false,
  };
}

function rotateDirections(openSides, turns) {
  return openSides.map((side) => {
    const index = directionOrder.indexOf(side);
    return directionOrder[(index + turns) % 4];
  });
}

function getOpenSides(tile) {
  return rotateDirections(tile.open, tile.rotation);
}

function buildBoard() {
  boardElement.innerHTML = "";
  cellMap = new Map();

  for (const row of state.board) {
    for (const tile of row) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(tile.row);
      cell.dataset.col = String(tile.col);
      cell.setAttribute("aria-label", `${tile.type} tile`);

      const path = document.createElement("div");
      path.className = "cell-path";

      const horizontal = document.createElement("div");
      horizontal.className = "segment horizontal";

      const vertical = document.createElement("div");
      vertical.className = "segment vertical";

      const core = document.createElement("div");
      core.className = "core";

      if (tile.type === "source") {
        core.classList.add("source");
      }

      if (tile.type === "vault") {
        core.classList.add("vault");
      }

      path.append(horizontal, vertical);
      cell.append(path, core);
      boardElement.appendChild(cell);

      cellMap.set(keyFor(tile.row, tile.col), {
        cell,
        horizontal,
        vertical,
      });
    }
  }
}

function paintBoard() {
  for (const row of state.board) {
    for (const tile of row) {
      const cellEntry = cellMap.get(keyFor(tile.row, tile.col));
      const openSides = getOpenSides(tile);
      const hasHorizontal = openSides.includes("left") || openSides.includes("right");
      const hasVertical = openSides.includes("up") || openSides.includes("down");
      const isTutorialTarget =
        !state.tutorialDone &&
        tile.row === tutorialTarget.row &&
        tile.col === tutorialTarget.col;

      cellEntry.cell.classList.toggle("highlight", isTutorialTarget);
      cellEntry.cell.classList.toggle("energized", tile.energized);
      cellEntry.horizontal.className = `segment horizontal ${hasHorizontal ? "on" : "off"}`;
      cellEntry.vertical.className = `segment vertical ${hasVertical ? "on" : "off"}`;
    }
  }
}

function rotateTile(row, col) {
  if (state.solved) {
    return;
  }

  const tile = state.board[row][col];
  tile.rotation = (tile.rotation + 1) % 4;
  state.moves += 1;
  state.charge = Math.max(18, 100 - state.moves * 8);

  if (row === tutorialTarget.row && col === tutorialTarget.col) {
    state.tutorialDone = true;
    tutorialCallout.classList.add("hidden");
  }

  updateConnectivity();
  updateHud();
  paintBoard();
}

function updateConnectivity() {
  const visited = new Set();
  const queue = [state.board[0][0]];
  visited.add(keyFor(0, 0));

  for (const tile of state.board.flat()) {
    tile.energized = false;
  }

  while (queue.length > 0) {
    const tile = queue.shift();
    tile.energized = true;

    for (const side of getOpenSides(tile)) {
      const vector = directionVectors[side];
      const nextRow = tile.row + vector.row;
      const nextCol = tile.col + vector.col;
      const nextTile = state.board[nextRow]?.[nextCol];

      if (!nextTile) {
        continue;
      }

      if (!getOpenSides(nextTile).includes(vector.opposite)) {
        continue;
      }

      const key = keyFor(nextRow, nextCol);
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push(nextTile);
    }
  }

  const solved = state.board[4][4].energized;

  if (solved && !state.solved) {
    state.solved = true;
    state.charge = 100;
    goalElement.textContent = "Vault open";
    statusElement.textContent = "Perfect. The route is active and the vault is unlocked.";
    overlayMessage.textContent = `Solved in ${state.moves} move${state.moves === 1 ? "" : "s"}. This is the fast-success loop a portrait playable needs.`;
    window.setTimeout(() => overlay.classList.remove("hidden"), 220);
    return;
  }

  if (!state.solved) {
    goalElement.textContent = "Power the vault";
    if (!state.tutorialDone) {
      statusElement.textContent = "Tap the highlighted tile for the instant win.";
    } else {
      const energizedCount = state.board.flat().filter((tile) => tile.energized).length;
      statusElement.textContent = `${energizedCount} tiles charged. Keep the route flowing to the vault.`;
    }
  }
}

function updateHud() {
  movesElement.textContent = String(state.moves);
  chargeElement.textContent = `${state.charge}%`;
}

function keyFor(row, col) {
  return `${row}-${col}`;
}

function resetGame() {
  state = createGameState();
  overlay.classList.add("hidden");
  tutorialCallout.classList.remove("hidden");
  statusElement.textContent = "One easy interaction, instant success, strong payoff.";
  goalElement.textContent = "Power the vault";
  updateConnectivity();
  updateHud();
  paintBoard();
}

boardElement.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) {
    return;
  }

  rotateTile(Number(cell.dataset.row), Number(cell.dataset.col));
});

replayButton.addEventListener("click", resetGame);

for (const button of ctaButtons) {
  button.addEventListener("click", () => {
    window.open(adTargetUrl, "_blank", "noopener,noreferrer");
  });
}

state = createGameState();
buildBoard();
updateConnectivity();
updateHud();
paintBoard();
