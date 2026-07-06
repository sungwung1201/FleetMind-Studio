import type { Cell, TimedCell } from "./types";
import { cellKey, isInsideGrid, manhattanDistance, sameCell } from "./grid";

type AStarNode = {
  cell: Cell;
  g: number;
  h: number;
  f: number;
  parentKey?: string;
};

type FindPathAStarParams = {
  width: number;
  height: number;
  start: Cell;
  goal: Cell;
  blockedCells: Set<string>;
};

const DIRECTIONS: Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function reconstructPath(
  goalKey: string,
  closed: Map<string, AStarNode>
): TimedCell[] {
  const reversed: Cell[] = [];
  let currentKey: string | undefined = goalKey;

  while (currentKey) {
    const currentNode = closed.get(currentKey);
    if (!currentNode) {
      break;
    }

    reversed.push(currentNode.cell);
    currentKey = currentNode.parentKey;
  }

  return reversed
    .reverse()
    .map((cell, index) => ({
      x: cell.x,
      y: cell.y,
      t: index,
    }));
}

export function findPathAStar(params: FindPathAStarParams): TimedCell[] {
  const { width, height, start, goal, blockedCells } = params;

  if (!isInsideGrid(start, width, height)) {
    return [];
  }

  if (!isInsideGrid(goal, width, height)) {
    return [];
  }

  const startKey = cellKey(start);
  const goalKey = cellKey(goal);

  const open = new Map<string, AStarNode>();
  const closed = new Map<string, AStarNode>();

  const startH = manhattanDistance(start, goal);
  open.set(startKey, {
    cell: start,
    g: 0,
    h: startH,
    f: startH,
  });

  while (open.size > 0) {
    let currentKey = "";
    let currentNode: AStarNode | undefined;

    for (const [key, node] of open.entries()) {
      if (
        !currentNode ||
        node.f < currentNode.f ||
        (node.f === currentNode.f && node.h < currentNode.h)
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

    for (const direction of DIRECTIONS) {
      const nextCell: Cell = {
        x: currentNode.cell.x + direction.x,
        y: currentNode.cell.y + direction.y,
      };

      if (!isInsideGrid(nextCell, width, height)) {
        continue;
      }

      const nextKey = cellKey(nextCell);

      if (blockedCells.has(nextKey) && nextKey !== goalKey) {
        continue;
      }

      if (closed.has(nextKey)) {
        continue;
      }

      const nextG = currentNode.g + 1;
      const nextH = manhattanDistance(nextCell, goal);
      const nextF = nextG + nextH;

      const existing = open.get(nextKey);
      if (existing && existing.g <= nextG) {
        continue;
      }

      open.set(nextKey, {
        cell: nextCell,
        g: nextG,
        h: nextH,
        f: nextF,
        parentKey: currentKey,
      });
    }
  }

  return [];
}
