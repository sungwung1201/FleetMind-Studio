import type { Scenario } from "../core/types";

export const defaultScenario: Scenario = {
  id: "default_fleet",
  name: "Default Fleet Scenario",
  width: 20,
  height: 20,
  amrs: [
    {
      id: "AMR_01",
      cell: { x: 1, y: 1 },
      startCell: { x: 1, y: 1 },
      goalCell: { x: 15, y: 4 },
      path: [],
      status: "IDLE",
      color: "#2563eb",
    },
    {
      id: "AMR_02",
      cell: { x: 1, y: 3 },
      startCell: { x: 1, y: 3 },
      goalCell: { x: 15, y: 10 },
      path: [],
      status: "IDLE",
      color: "#dc2626",
    },
    {
      id: "AMR_03",
      cell: { x: 1, y: 5 },
      startCell: { x: 1, y: 5 },
      goalCell: { x: 15, y: 16 },
      path: [],
      status: "IDLE",
      color: "#16a34a",
    },
  ],
  workstations: [
    {
      id: "W1",
      cell: { x: 16, y: 4 },
      footprint: [{ x: 16, y: 4 }],
    },
    {
      id: "W2",
      cell: { x: 16, y: 10 },
      footprint: [{ x: 16, y: 10 }],
    },
    {
      id: "W3",
      cell: { x: 16, y: 16 },
      footprint: [{ x: 16, y: 16 }],
    },
  ],
  obstacles: [
    { id: "OBS_01", cell: { x: 7, y: 4 } },
    { id: "OBS_02", cell: { x: 7, y: 5 } },
    { id: "OBS_03", cell: { x: 7, y: 6 } },
    { id: "OBS_04", cell: { x: 10, y: 10 } },
    { id: "OBS_05", cell: { x: 11, y: 10 } },
    { id: "OBS_06", cell: { x: 12, y: 10 } },
  ],
};
