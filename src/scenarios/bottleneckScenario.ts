import type { Obstacle, Scenario } from "../core/types";

const wallWithSingleGap: Obstacle[] = Array.from({ length: 20 }, (_, y) => y)
  .filter((y) => y !== 10)
  .map((y) => ({
    id: `WALL_${String(y).padStart(2, "0")}`,
    cell: { x: 9, y },
  }));

export const bottleneckScenario: Scenario = {
  id: "bottleneck_wait_test",
  name: "Bottleneck Wait vs Detour Scenario",
  width: 20,
  height: 20,
  amrs: [
    {
      id: "AMR_01",
      cell: { x: 2, y: 9 },
      startCell: { x: 2, y: 9 },
      goalCell: { x: 16, y: 9 },
      path: [],
      status: "IDLE",
      color: "#2563eb",
    },
    {
      id: "AMR_02",
      cell: { x: 2, y: 10 },
      startCell: { x: 2, y: 10 },
      goalCell: { x: 16, y: 10 },
      path: [],
      status: "IDLE",
      color: "#dc2626",
    },
    {
      id: "AMR_03",
      cell: { x: 2, y: 11 },
      startCell: { x: 2, y: 11 },
      goalCell: { x: 16, y: 11 },
      path: [],
      status: "IDLE",
      color: "#16a34a",
    },
  ],
  workstations: [
    {
      id: "W1",
      cell: { x: 16, y: 9 },
      footprint: [{ x: 16, y: 9 }],
    },
    {
      id: "W2",
      cell: { x: 16, y: 10 },
      footprint: [{ x: 16, y: 10 }],
    },
    {
      id: "W3",
      cell: { x: 16, y: 11 },
      footprint: [{ x: 16, y: 11 }],
    },
  ],
  obstacles: wallWithSingleGap,
};
