import type { AMR, Cell, Scenario, TimedCell } from "./types";
import { cellKey, isInsideGrid, sameCell } from "./grid";

export type ArbiterReport = {
  approved: boolean;
  checkedTicks: number;
  cellCollisionCount: number;
  edgeSwapCount: number;
  blockedCellCount: number;
  outOfBoundsCount: number;
  messages: string[];
};

function getLastPathTick(amrs: AMR[]): number {
  return Math.max(
    0,
    ...amrs.map((amr) => {
      if (amr.path.length === 0) {
        return 0;
      }

      return amr.path[amr.path.length - 1].t;
    })
  );
}

function getCellAtTick(amr: AMR, t: number): TimedCell {
  if (amr.path.length === 0) {
    return {
      x: amr.cell.x,
      y: amr.cell.y,
      t,
    };
  }

  const exact = amr.path.find((cell) => cell.t === t);
  if (exact) {
    return exact;
  }

  const first = amr.path[0];
  const last = amr.path[amr.path.length - 1];

  if (t < first.t) {
    return {
      x: first.x,
      y: first.y,
      t,
    };
  }

  return {
    x: last.x,
    y: last.y,
    t,
  };
}

function edgeKey(from: Cell, to: Cell): string {
  return `${from.x},${from.y}->${to.x},${to.y}`;
}

function reverseEdgeKey(from: Cell, to: Cell): string {
  return `${to.x},${to.y}->${from.x},${from.y}`;
}

function isAllowedGoalFootprint(amr: AMR, cell: Cell): boolean {
  if (amr.goalCell && sameCell(amr.goalCell, cell)) {
    return true;
  }

  const routeGoalCells =
    (amr as AMR & { routeGoalCells?: Cell[] }).routeGoalCells ?? [];

  return routeGoalCells.some((routeGoalCell) => sameCell(routeGoalCell, cell));
}

export function validateFleetPlan(scenario: Scenario): ArbiterReport {
  const report: ArbiterReport = {
    approved: true,
    checkedTicks: 0,
    cellCollisionCount: 0,
    edgeSwapCount: 0,
    blockedCellCount: 0,
    outOfBoundsCount: 0,
    messages: [],
  };

  const blockedCells = new Set<string>();

  for (const obstacle of scenario.obstacles) {
    blockedCells.add(cellKey(obstacle.cell));
  }

  for (const workstation of scenario.workstations) {
    for (const footprintCell of workstation.footprint) {
      blockedCells.add(cellKey(footprintCell));
    }
  }

  const maxTick = getLastPathTick(scenario.amrs);
  report.checkedTicks = maxTick;

  for (let t = 0; t <= maxTick; t += 1) {
    const occupancy = new Map<string, string[]>();

    for (const amr of scenario.amrs) {
      const cell = getCellAtTick(amr, t);

      if (!isInsideGrid(cell, scenario.width, scenario.height)) {
        report.outOfBoundsCount += 1;
        report.messages.push(
          `[t=${t}] OUT_OF_BOUNDS ${amr.id} at [${cell.x}, ${cell.y}]`
        );
        continue;
      }

      const key = cellKey(cell);
      const current = occupancy.get(key) ?? [];
      current.push(amr.id);
      occupancy.set(key, current);

      if (blockedCells.has(key) && !isAllowedGoalFootprint(amr, cell)) {
        report.blockedCellCount += 1;
        report.messages.push(
          `[t=${t}] BLOCKED_CELL ${amr.id} at [${cell.x}, ${cell.y}]`
        );
      }
    }

    for (const [key, amrIds] of occupancy.entries()) {
      if (amrIds.length > 1) {
        report.cellCollisionCount += 1;
        report.messages.push(
          `[t=${t}] CELL_COLLISION ${key} occupied by ${amrIds.join(", ")}`
        );
      }
    }

    if (t > 0) {
      const edges = new Map<string, string>();

      for (const amr of scenario.amrs) {
        const from = getCellAtTick(amr, t - 1);
        const to = getCellAtTick(amr, t);

        if (sameCell(from, to)) {
          continue;
        }

        const forwardKey = edgeKey(from, to);
        const reverseKey = reverseEdgeKey(from, to);
        const reverseAmrId = edges.get(reverseKey);

        if (reverseAmrId && reverseAmrId !== amr.id) {
          report.edgeSwapCount += 1;
          report.messages.push(
            `[t=${t}] EDGE_SWAP ${amr.id} ${forwardKey} conflicts with ${reverseAmrId} ${reverseKey}`
          );
        }

        edges.set(forwardKey, amr.id);
      }
    }
  }

  if (
    report.cellCollisionCount > 0 ||
    report.edgeSwapCount > 0 ||
    report.blockedCellCount > 0 ||
    report.outOfBoundsCount > 0
  ) {
    report.approved = false;
  }

  if (report.approved) {
    report.messages.unshift(
      `APPROVED: no cell collision, no edge swap, no blocked-cell violation. checked_ticks=${maxTick}`
    );
  }

  return report;
}
