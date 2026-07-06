import type { Scenario } from "../core/types";

export const edgeSwapScenario: Scenario = {
  id: "edge_swap_test",
  name: "Edge Swap Prevention Scenario",
  width: 20,
  height: 20,
  amrs: [
    {
      id: "AMR_01",
      cell: { x: 5, y: 5 },
      startCell: { x: 5, y: 5 },
      goalCell: { x: 7, y: 5 },
      path: [],
      status: "IDLE",
      color: "#2563eb",
    },
    {
      id: "AMR_02",
      cell: { x: 6, y: 5 },
      startCell: { x: 6, y: 5 },
      goalCell: { x: 4, y: 5 },
      path: [],
      status: "IDLE",
      color: "#dc2626",
    },
    {
      id: "AMR_03",
      cell: { x: 2, y: 2 },
      startCell: { x: 2, y: 2 },
      goalCell: { x: 2, y: 8 },
      path: [],
      status: "IDLE",
      color: "#16a34a",
    },
  ],
  workstations: [
    {
      id: "W1",
      cell: { x: 7, y: 5 },
      footprint: [{ x: 7, y: 5 }],
    },
    {
      id: "W2",
      cell: { x: 4, y: 5 },
      footprint: [{ x: 4, y: 5 }],
    },
    {
      id: "W3",
      cell: { x: 2, y: 8 },
      footprint: [{ x: 2, y: 8 }],
    },
  ],
  obstacles: [
    { id: "OBS_01", cell: { x: 10, y: 3 } },
    { id: "OBS_02", cell: { x: 10, y: 4 } },
    { id: "OBS_03", cell: { x: 10, y: 5 } },
    { id: "OBS_04", cell: { x: 10, y: 6 } },
    { id: "OBS_05", cell: { x: 10, y: 7 } },
  ],
};
