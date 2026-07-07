import type { AMR, Cell } from "./types";
import { manhattanDistance, sameCell } from "./grid";

export type PathCostReport = {
  amrId: string;
  staticShortestDistance: number;
  moveSteps: number;
  waitSteps: number;
  detourSteps: number;
  waitCost: number;
  detourCost: number;
  selectedStrategy: "DIRECT" | "WAIT" | "DETOUR" | "WAIT_BIASED" | "DETOUR_BIASED";
  reason: string;
};

export function getPathCostReport(amr: AMR, goal: Cell): PathCostReport {
  const staticShortestDistance = manhattanDistance(amr.startCell, goal);

  let waitSteps = 0;
  let moveSteps = 0;

  for (let i = 1; i < amr.path.length; i += 1) {
    if (sameCell(amr.path[i - 1], amr.path[i])) {
      waitSteps += 1;
    } else {
      moveSteps += 1;
    }
  }

  const detourSteps = Math.max(0, moveSteps - staticShortestDistance);
  const waitCost = Number((waitSteps * 1.15).toFixed(2));
  const detourCost = Number((detourSteps * 1.0).toFixed(2));

  let selectedStrategy: PathCostReport["selectedStrategy"] = "DIRECT";
  let reason = "direct_shortest_path";

  if (waitSteps > 0 && detourSteps > 0) {
    if (waitCost <= detourCost) {
      selectedStrategy = "WAIT_BIASED";
      reason = "wait_cost_lower_or_equal_than_detour_cost";
    } else {
      selectedStrategy = "DETOUR_BIASED";
      reason = "detour_cost_lower_than_wait_cost";
    }
  } else if (waitSteps > 0) {
    selectedStrategy = "WAIT";
    reason = "reservation_conflict_resolved_by_wait_action";
  } else if (detourSteps > 0) {
    selectedStrategy = "DETOUR";
    reason = "reservation_or_obstacle_constraint_resolved_by_detour";
  }

  return {
    amrId: amr.id,
    staticShortestDistance,
    moveSteps,
    waitSteps,
    detourSteps,
    waitCost,
    detourCost,
    selectedStrategy,
    reason,
  };
}
