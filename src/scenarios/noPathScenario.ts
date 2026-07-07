import type { Scenario } from "../core/types";

export const noPathScenario: Scenario = {
  id: "no_path_blocked_target",
  name: "No Path / Blocked Target Scenario",
  width: 20,
  height: 20,
  amrs: [
    {
      id: "AMR_01",
      cell: { x: 2, y: 10 },
      startCell: { x: 2, y: 10 },
      goalCell: { x: 10, y: 10 },
      path: [],
      status: "IDLE",
      color: "#2563eb",
    },
    {
      id: "AMR_02",
      cell: { x: 2, y: 5 },
      startCell: { x: 2, y: 5 },
      goalCell: { x: 16, y: 5 },
      path: [],
      status: "IDLE",
      color: "#dc2626",
    },
    {
      id: "AMR_03",
      cell: { x: 2, y: 15 },
      startCell: { x: 2, y: 15 },
      goalCell: { x: 16, y: 15 },
      path: [],
      status: "IDLE",
      color: "#16a34a",
    },
  ],
  workstations: [
    {
      id: "W1",
      cell: { x: 10, y: 10 },
      footprint: [{ x: 10, y: 10 }],
    },
    {
      id: "W2",
      cell: { x: 16, y: 5 },
      footprint: [{ x: 16, y: 5 }],
    },
    {
      id: "W3",
      cell: { x: 16, y: 15 },
      footprint: [{ x: 16, y: 15 }],
    },
  ],
  obstacles: [
    { id: "OBS_01", cell: { x: 9, y: 10 } },
    { id: "OBS_02", cell: { x: 11, y: 10 } },
    { id: "OBS_03", cell: { x: 10, y: 9 } },
    { id: "OBS_04", cell: { x: 10, y: 11 } },
    { id: "OBS_05", cell: { x: 9, y: 9 } },
    { id: "OBS_06", cell: { x: 11, y: 9 } },
    { id: "OBS_07", cell: { x: 9, y: 11 } },
    { id: "OBS_08", cell: { x: 11, y: 11 } },
  ],
};
