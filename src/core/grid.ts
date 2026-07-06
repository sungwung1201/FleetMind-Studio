import type { Cell, Scenario } from "./types";

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isInsideGrid(cell: Cell, width: number, height: number): boolean {
  return cell.x >= 0 && cell.x < width && cell.y >= 0 && cell.y < height;
}

export function getBlockedCellKeys(scenario: Scenario): Set<string> {
  const blocked = new Set<string>();

  for (const obstacle of scenario.obstacles) {
    blocked.add(cellKey(obstacle.cell));
  }

  for (const workstation of scenario.workstations) {
    for (const footprintCell of workstation.footprint) {
      blocked.add(cellKey(footprintCell));
    }
  }

  return blocked;
}

export function manhattanDistance(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
