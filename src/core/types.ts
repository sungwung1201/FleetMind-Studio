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

export type EpisodeTrajectoryStep = {
  t: number;
  cell: [number, number];
  status: AMRStatus;
};

export type EpisodeRecord = {
  episode_id: string;
  scenario_id: string;
  scenario_name: string;
  amr_id: string;
  task: "PICKUP" | "MOVE" | "DROP" | "WAIT";
  agent_decision: AgentDecision | null;
  start_cell: [number, number];
  goal_cell: [number, number] | null;
  trajectory: EpisodeTrajectoryStep[];
  reservation_log: unknown[];
  collisions_avoided: number;
  duration_ms: number;
  success: boolean;
};

export type EpisodeDataset = {
  dataset_id: string;
  generated_at: string;
  assignment: string;
  scenario_id: string;
  scenario_name: string;
  summary: {
    amr_count: number;
    episode_count: number;
    success_count: number;
    total_collisions_detected: number;
    total_edge_swaps_detected: number;
    checked_ticks: number;
  };
  episodes: EpisodeRecord[];
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
