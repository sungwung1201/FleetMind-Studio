import type { Cell, TimedCell } from "./types";
import { cellKey, isInsideGrid, manhattanDistance, sameCell } from "./grid";
import type { ReservationTable } from "./reservationTable";

type TimeAStarNode = {
  cell: Cell;
  t: number;
  g: number;
  h: number;
  f: number;
  parentKey?: string;
  lastMove: Cell;
  turnCount: number;
  waitCount: number;
};

type FindPathTimeAStarParams = {
  width: number;
  height: number;
  start: Cell;
  goal: Cell;
  blockedCells: Set<string>;
  reservationTable: ReservationTable;
  amrId: string;
  maxTime?: number;
  startTime?: number;
};

type ActionVariant = "goal_x_first" | "goal_y_first" | "balanced" | "legacy";

const MOVE_RIGHT: Cell = { x: 1, y: 0 };
const MOVE_DOWN: Cell = { x: 0, y: 1 };
const MOVE_LEFT: Cell = { x: -1, y: 0 };
const MOVE_UP: Cell = { x: 0, y: -1 };
const WAIT: Cell = { x: 0, y: 0 };

const LEGACY_ACTIONS: Cell[] = [
  MOVE_RIGHT,
  MOVE_DOWN,
  MOVE_LEFT,
  MOVE_UP,
  WAIT,
];

function moveKey(move: Cell): string {
  return `${move.x},${move.y}`;
}

function stateKey(cell: Cell, t: number, lastMove: Cell): string {
  return `${cell.x},${cell.y},${t},${moveKey(lastMove)}`;
}

function sameMove(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

function isWait(move: Cell): boolean {
  return move.x === 0 && move.y === 0;
}

function getPrimaryMoves(current: Cell, goal: Cell): {
  xMove: Cell | null;
  yMove: Cell | null;
} {
  const dx = goal.x - current.x;
  const dy = goal.y - current.y;

  const xMove =
    dx === 0
      ? null
      : {
          x: dx > 0 ? 1 : -1,
          y: 0,
        };

  const yMove =
    dy === 0
      ? null
      : {
          x: 0,
          y: dy > 0 ? 1 : -1,
        };

  return {
    xMove,
    yMove,
  };
}

function appendUniqueAction(actions: Cell[], action: Cell | null): void {
  if (!action) {
    return;
  }

  if (actions.some((item) => sameMove(item, action))) {
    return;
  }

  actions.push(action);
}

function getOppositeMove(move: Cell | null): Cell | null {
  if (!move) {
    return null;
  }

  return {
    x: -move.x,
    y: -move.y,
  };
}

function getOrderedActions(
  current: Cell,
  goal: Cell,
  variant: ActionVariant
): Cell[] {
  if (variant === "legacy") {
    return LEGACY_ACTIONS;
  }

  const { xMove, yMove } = getPrimaryMoves(current, goal);
  const actions: Cell[] = [];

  if (variant === "goal_x_first") {
    appendUniqueAction(actions, xMove);
    appendUniqueAction(actions, yMove);
  }

  if (variant === "goal_y_first") {
    appendUniqueAction(actions, yMove);
    appendUniqueAction(actions, xMove);
  }

  if (variant === "balanced") {
    const dx = Math.abs(goal.x - current.x);
    const dy = Math.abs(goal.y - current.y);

    if (dx >= dy) {
      appendUniqueAction(actions, xMove);
      appendUniqueAction(actions, yMove);
    } else {
      appendUniqueAction(actions, yMove);
      appendUniqueAction(actions, xMove);
    }
  }

  appendUniqueAction(actions, MOVE_RIGHT);
  appendUniqueAction(actions, MOVE_DOWN);
  appendUniqueAction(actions, MOVE_LEFT);
  appendUniqueAction(actions, MOVE_UP);

  appendUniqueAction(actions, getOppositeMove(xMove));
  appendUniqueAction(actions, getOppositeMove(yMove));

  appendUniqueAction(actions, WAIT);

  return actions;
}

function getActionCost(current: Cell, action: Cell, goal: Cell): number {
  if (isWait(action)) {
    return 1.12;
  }

  const currentDistance = manhattanDistance(current, goal);
  const nextCell: Cell = {
    x: current.x + action.x,
    y: current.y + action.y,
  };
  const nextDistance = manhattanDistance(nextCell, goal);

  if (nextDistance < currentDistance) {
    return 1.0;
  }

  if (nextDistance === currentDistance) {
    return 1.08;
  }

  return 1.35;
}

function countTurns(path: TimedCell[]): number {
  let turns = 0;
  let previousMove: Cell | null = null;

  for (let i = 1; i < path.length; i += 1) {
    const move = {
      x: path[i].x - path[i - 1].x,
      y: path[i].y - path[i - 1].y,
    };

    if (isWait(move)) {
      continue;
    }

    if (previousMove && !sameMove(previousMove, move)) {
      turns += 1;
    }

    previousMove = move;
  }

  return turns;
}

function countWaits(path: TimedCell[]): number {
  let waits = 0;

  for (let i = 1; i < path.length; i += 1) {
    if (path[i].x === path[i - 1].x && path[i].y === path[i - 1].y) {
      waits += 1;
    }
  }

  return waits;
}

function scorePath(path: TimedCell[], start: Cell, goal: Cell, startTime: number): number {
  if (path.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const finalCell = path[path.length - 1];

  if (!sameCell(finalCell, goal)) {
    return Number.POSITIVE_INFINITY;
  }

  const duration = finalCell.t - startTime;
  const manhattan = manhattanDistance(start, goal);
  const detour = Math.max(0, duration - manhattan);
  const turns = countTurns(path);
  const waits = countWaits(path);

  return duration * 100 + detour * 18 + turns * 7 + waits * 3;
}

function reconstructPath(
  goalStateKey: string,
  closed: Map<string, TimeAStarNode>
): TimedCell[] {
  const reversed: TimedCell[] = [];
  let currentKey: string | undefined = goalStateKey;

  while (currentKey) {
    const node = closed.get(currentKey);
    if (!node) {
      break;
    }

    reversed.push({
      x: node.cell.x,
      y: node.cell.y,
      t: node.t,
    });

    currentKey = node.parentKey;
  }

  return reversed.reverse();
}

function runTimeAStarVariant(
  params: FindPathTimeAStarParams,
  variant: ActionVariant
): TimedCell[] {
  const {
    width,
    height,
    start,
    goal,
    blockedCells,
    reservationTable,
    amrId,
    maxTime = 160,
    startTime = 0,
  } = params;

  if (!isInsideGrid(start, width, height)) {
    return [];
  }

  if (!isInsideGrid(goal, width, height)) {
    return [];
  }

  const goalCellKey = cellKey(goal);
  const open = new Map<string, TimeAStarNode>();
  const closed = new Map<string, TimeAStarNode>();

  const startH = manhattanDistance(start, goal);
  const startMove = WAIT;
  const startKey = stateKey(start, startTime, startMove);
  const maxAbsoluteTime = startTime + maxTime;

  open.set(startKey, {
    cell: start,
    t: startTime,
    g: 0,
    h: startH,
    f: startH,
    lastMove: startMove,
    turnCount: 0,
    waitCount: 0,
  });

  let expandedNodeCount = 0;
  const maxExpandedNodes = width * height * 80;

  while (open.size > 0) {
    expandedNodeCount += 1;

    if (expandedNodeCount > maxExpandedNodes) {
      return [];
    }

    let currentKey = "";
    let currentNode: TimeAStarNode | undefined;

    for (const [key, node] of open.entries()) {
      if (
        !currentNode ||
        node.f < currentNode.f ||
        (node.f === currentNode.f && node.h < currentNode.h) ||
        (node.f === currentNode.f &&
          node.h === currentNode.h &&
          node.turnCount < currentNode.turnCount) ||
        (node.f === currentNode.f &&
          node.h === currentNode.h &&
          node.turnCount === currentNode.turnCount &&
          node.waitCount < currentNode.waitCount) ||
        (node.f === currentNode.f &&
          node.h === currentNode.h &&
          node.turnCount === currentNode.turnCount &&
          node.waitCount === currentNode.waitCount &&
          node.t < currentNode.t)
      ) {
        currentKey = key;
        currentNode = node;
      }
    }

    if (!currentNode) {
      return [];
    }

    open.delete(currentKey);
    closed.set(currentKey, currentNode);

    if (sameCell(currentNode.cell, goal)) {
      return reconstructPath(currentKey, closed);
    }

    if (currentNode.t >= maxAbsoluteTime) {
      continue;
    }

    for (const action of getOrderedActions(currentNode.cell, goal, variant)) {
      const nextCell: Cell = {
        x: currentNode.cell.x + action.x,
        y: currentNode.cell.y + action.y,
      };

      const nextT = currentNode.t + 1;

      if (!isInsideGrid(nextCell, width, height)) {
        continue;
      }

      const nextCellKey = cellKey(nextCell);

      if (blockedCells.has(nextCellKey) && nextCellKey !== goalCellKey) {
        continue;
      }

      if (reservationTable.isCellReserved(nextCell, nextT, amrId)) {
        continue;
      }

      if (reservationTable.isEdgeReserved(currentNode.cell, nextCell, nextT, amrId)) {
        continue;
      }

      if (reservationTable.isEdgeSwap(currentNode.cell, nextCell, nextT, amrId)) {
        continue;
      }

      const nextStateKey = stateKey(nextCell, nextT, action);

      if (closed.has(nextStateKey)) {
        continue;
      }

      const h = manhattanDistance(nextCell, goal);
      const actionCost = getActionCost(currentNode.cell, action, goal);
      const didTurn =
        !isWait(action) &&
        !isWait(currentNode.lastMove) &&
        !sameMove(action, currentNode.lastMove);

      const nextG = currentNode.g + actionCost + (didTurn ? 0.04 : 0);
      const nextTurnCount = currentNode.turnCount + (didTurn ? 1 : 0);
      const nextWaitCount = currentNode.waitCount + (isWait(action) ? 1 : 0);

      const previousOpenNode = open.get(nextStateKey);
      const candidateNode: TimeAStarNode = {
        cell: nextCell,
        t: nextT,
        g: nextG,
        h,
        f: nextG + h,
        parentKey: currentKey,
        lastMove: action,
        turnCount: nextTurnCount,
        waitCount: nextWaitCount,
      };

      if (
        !previousOpenNode ||
        candidateNode.f < previousOpenNode.f ||
        (candidateNode.f === previousOpenNode.f &&
          candidateNode.turnCount < previousOpenNode.turnCount) ||
        (candidateNode.f === previousOpenNode.f &&
          candidateNode.turnCount === previousOpenNode.turnCount &&
          candidateNode.waitCount < previousOpenNode.waitCount)
      ) {
        open.set(nextStateKey, candidateNode);
      }
    }
  }

  return [];
}


function buildManhattanCandidatePath(
  start: Cell,
  goal: Cell,
  startTime: number,
  order: "x_first" | "y_first"
): TimedCell[] {
  const path: TimedCell[] = [];
  let x = start.x;
  let y = start.y;
  let t = startTime;

  path.push({ x, y, t });

  const stepX = () => {
    if (x === goal.x) {
      return;
    }

    x += goal.x > x ? 1 : -1;
    t += 1;
    path.push({ x, y, t });
  };

  const stepY = () => {
    if (y === goal.y) {
      return;
    }

    y += goal.y > y ? 1 : -1;
    t += 1;
    path.push({ x, y, t });
  };

  if (order === "x_first") {
    while (x !== goal.x) {
      stepX();
    }

    while (y !== goal.y) {
      stepY();
    }
  } else {
    while (y !== goal.y) {
      stepY();
    }

    while (x !== goal.x) {
      stepX();
    }
  }

  return path;
}

function isCandidatePathValid(
  path: TimedCell[],
  params: FindPathTimeAStarParams
): boolean {
  const {
    width,
    height,
    goal,
    blockedCells,
    reservationTable,
    amrId,
  } = params;

  const goalKey = cellKey(goal);

  for (let i = 0; i < path.length; i += 1) {
    const cell = path[i];
    const key = cellKey(cell);

    if (!isInsideGrid(cell, width, height)) {
      return false;
    }

    if (blockedCells.has(key) && key !== goalKey) {
      return false;
    }

    if (reservationTable.isCellReserved(cell, cell.t, amrId)) {
      return false;
    }

    if (i > 0) {
      const previous = path[i - 1];

      if (reservationTable.isEdgeReserved(previous, cell, cell.t, amrId)) {
        return false;
      }

      if (reservationTable.isEdgeSwap(previous, cell, cell.t, amrId)) {
        return false;
      }
    }
  }

  return true;
}

function findBestManhattanCandidate(
  params: FindPathTimeAStarParams
): TimedCell[] {
  const startTime = params.startTime ?? 0;

  const candidates = [
    buildManhattanCandidatePath(params.start, params.goal, startTime, "x_first"),
    buildManhattanCandidatePath(params.start, params.goal, startTime, "y_first"),
  ]
    .filter((path) => isCandidatePathValid(path, params))
    .map((path) => ({
      path,
      score: scorePath(path, params.start, params.goal, startTime),
    }))
    .sort((a, b) => a.score - b.score);

  return candidates[0]?.path ?? [];
}



function hasStaticReachablePath(params: FindPathTimeAStarParams): boolean {
  const { width, height, start, goal, blockedCells } = params;

  if (!isInsideGrid(start, width, height)) {
    return false;
  }

  if (!isInsideGrid(goal, width, height)) {
    return false;
  }

  if (sameCell(start, goal)) {
    return true;
  }

  const goalKey = cellKey(goal);
  const visited = new Set<string>();
  const queue: Cell[] = [start];

  visited.add(cellKey(start));

  let cursor = 0;

  while (cursor < queue.length) {
    const current = queue[cursor];
    cursor += 1;

    for (const action of [MOVE_RIGHT, MOVE_DOWN, MOVE_LEFT, MOVE_UP]) {
      const next: Cell = {
        x: current.x + action.x,
        y: current.y + action.y,
      };

      if (!isInsideGrid(next, width, height)) {
        continue;
      }

      const nextKey = cellKey(next);

      if (visited.has(nextKey)) {
        continue;
      }

      if (blockedCells.has(nextKey) && nextKey !== goalKey) {
        continue;
      }

      if (sameCell(next, goal)) {
        return true;
      }

      visited.add(nextKey);
      queue.push(next);
    }
  }

  return false;
}


export function findPathTimeAStar(params: FindPathTimeAStarParams): TimedCell[] {
  if (!hasStaticReachablePath(params)) {
    return [];
  }

  const manhattanCandidate = findBestManhattanCandidate(params);

  if (manhattanCandidate.length > 0) {
    return manhattanCandidate;
  }

  const variants: ActionVariant[] = [
    "goal_x_first",
    "goal_y_first",
    "balanced",
    "legacy",
  ];

  const candidates = variants
    .map((variant) => {
      const path = runTimeAStarVariant(params, variant);

      return {
        variant,
        path,
        score: scorePath(path, params.start, params.goal, params.startTime ?? 0),
      };
    })
    .filter((candidate) => candidate.path.length > 0)
    .sort((a, b) => a.score - b.score);

  return candidates[0]?.path ?? [];
}
