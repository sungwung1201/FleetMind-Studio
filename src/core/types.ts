export type Cell = {
  x: number;
  y: number;
};

export type TimedCell = Cell & {
  t: number;
};

export type AMRStatus = "IDLE" | "MOVING" | "WAITING" | "DONE" | "FAILED";

export type AMR = {
  id: string;
  cell: Cell;
  startCell: Cell;
  goalCell?: Cell;
  path: TimedCell[];
  status: AMRStatus;
  color: string;
};

export type Workstation = {
  id: string;
  cell: Cell;
  footprint: Cell[];
};

export type Obstacle = {
  id: string;
  cell: Cell;
};

export type AgentCommand = {
  fill: string[];
  priority: "nearest" | "input_order";
};

export type AgentDecision = {
  taskId: string;
  amrId: string;
  targetId: string;
  targetCell: Cell;
  reason: string;
  priority: number;
  distance: number;
  decision: "ASSIGN" | "SKIP" | "FAILED";
};

export type Scenario = {
  id: string;
  name: string;
  width: number;
  height: number;
  amrs: AMR[];
  workstations: Workstation[];
  obstacles: Obstacle[];
};
