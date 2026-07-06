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
};

const ACTIONS: Cell[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 0 }, // WAIT
];

function stateKey(cell: Cell, t: number): string {
  return `${cell.x},${cell.y},${t}`;
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

export function findPathTimeAStar(params: FindPathTimeAStarParams): TimedCell[] {
  const {
    width,
    height,
    start,
    goal,
    blockedCells,
    reservationTable,
    amrId,
    maxTime = 160,
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
  const startKey = stateKey(start, 0);

  open.set(startKey, {
    cell: start,
    t: 0,
    g: 0,
    h: startH,
    f: startH,
  });

  while (open.size > 0) {
    let currentKey = "";
    let currentNode: TimeAStarNode | undefined;

    for (const [key, node] of open.entries()) {
      if (
        !currentNode ||
        node.f < currentNode.f ||
        (node.f === currentNode.f && node.h < currentNode.h) ||
        (node.f === currentNode.f && node.h === currentNode.h && node.t < currentNode.t)
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

    if (currentNode.t >= maxTime) {
      continue;
    }

    for (const action of ACTIONS) {
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

      const nextStateKey = stateKey(nextCell, nextT);

      if (closed.has(nextStateKey)) {
        continue;
      }

      const isWait = sameCell(currentNode.cell, nextCell);
      const stepCost = isWait ? 1.15 : 1.0;
      const nextG = currentNode.g + stepCost;
      const nextH = manhattanDistance(nextCell, goal);
      const nextF = nextG + nextH;

      const existing = open.get(nextStateKey);
      if (existing && existing.g <= nextG) {
        continue;
      }

      open.set(nextStateKey, {
        cell: nextCell,
        t: nextT,
        g: nextG,
        h: nextH,
        f: nextF,
        parentKey: currentKey,
      });
    }
  }

  return [];
}
