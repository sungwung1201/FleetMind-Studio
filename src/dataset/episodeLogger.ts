import type {
  AgentDecision,
  AMR,
  EpisodeDataset,
  EpisodeRecord,
  EpisodeTrajectoryStep,
  Scenario,
} from "../core/types";
import type { ArbiterReport } from "../core/globalArbiter";
import type { ReservationEvent } from "../core/reservationTable";
import { sameCell } from "../core/grid";

type CreateDatasetParams = {
  scenario: Scenario;
  agentDecisions: AgentDecision[];
  reservationEvents: ReservationEvent[];
  arbiterReport: ArbiterReport;
};

type ValidationResult = {
  ok: boolean;
  messages: string[];
};

function toCellTuple(cell: { x: number; y: number }): [number, number] {
  return [cell.x, cell.y];
}

function getEpisodeId(scenarioId: string, amrId: string): string {
  return `ep_${scenarioId}_${amrId}_${Date.now()}`;
}

function getWaitSteps(amr: AMR): number {
  let waitSteps = 0;

  for (let i = 1; i < amr.path.length; i += 1) {
    if (sameCell(amr.path[i - 1], amr.path[i])) {
      waitSteps += 1;
    }
  }

  return waitSteps;
}

function getTrajectory(amr: AMR): EpisodeTrajectoryStep[] {
  return amr.path.map((cell, index) => {
    let status: AMR["status"] = "MOVING";

    if (index > 0 && sameCell(amr.path[index - 1], cell)) {
      status = "WAITING";
    }

    if (index === amr.path.length - 1) {
      status = "DONE";
    }

    return {
      t: cell.t,
      cell: [cell.x, cell.y],
      status,
    };
  });
}

function getDurationMs(amr: AMR): number {
  if (amr.path.length === 0) {
    return 0;
  }

  const last = amr.path[amr.path.length - 1];
  return last.t * 220;
}

function getDecisionForAmr(
  amrId: string,
  decisions: AgentDecision[]
): AgentDecision | null {
  return decisions.find((decision) => decision.amrId === amrId) ?? null;
}

function getReservationLogForAmr(
  amrId: string,
  events: ReservationEvent[]
): ReservationEvent[] {
  return events.filter((event) => event.amrId === amrId);
}

export function createEpisodeDataset(params: CreateDatasetParams): EpisodeDataset {
  const { scenario, agentDecisions, reservationEvents, arbiterReport } = params;

  const episodes: EpisodeRecord[] = scenario.amrs
    .filter((amr) => amr.path.length > 0)
    .map((amr) => {
      const decision = getDecisionForAmr(amr.id, agentDecisions);
      const success = amr.status === "DONE" || amr.path.length > 0;

      return {
        episode_id: getEpisodeId(scenario.id, amr.id),
        scenario_id: scenario.id,
        scenario_name: scenario.name,
        amr_id: amr.id,
        task: "MOVE",
        agent_decision: decision,
        start_cell: toCellTuple(amr.startCell),
        goal_cell: amr.goalCell ? toCellTuple(amr.goalCell) : null,
        trajectory: getTrajectory(amr),
        reservation_log: getReservationLogForAmr(amr.id, reservationEvents),
        collisions_avoided: getWaitSteps(amr),
        duration_ms: getDurationMs(amr),
        success,
      };
    });

  const successCount = episodes.filter((episode) => episode.success).length;

  return {
    dataset_id: `dataset_${scenario.id}_${Date.now()}`,
    generated_at: new Date().toISOString(),
    assignment: "VISIONSPACE_TESSERACT_ROBOT_TRACK",
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    summary: {
      amr_count: scenario.amrs.length,
      episode_count: episodes.length,
      success_count: successCount,
      total_collisions_detected: arbiterReport.cellCollisionCount,
      total_edge_swaps_detected: arbiterReport.edgeSwapCount,
      checked_ticks: arbiterReport.checkedTicks,
    },
    episodes,
  };
}

export function validateEpisodeDataset(dataset: EpisodeDataset): ValidationResult {
  const messages: string[] = [];

  if (!dataset.dataset_id) {
    messages.push("dataset_id is missing.");
  }

  if (!Array.isArray(dataset.episodes)) {
    messages.push("episodes must be an array.");
    return {
      ok: false,
      messages,
    };
  }

  if (dataset.episodes.length === 0) {
    messages.push("episodes array is empty.");
  }

  dataset.episodes.forEach((episode, index) => {
    const prefix = `episodes[${index}]`;

    if (!episode.episode_id) messages.push(`${prefix}.episode_id is missing.`);
    if (!episode.amr_id) messages.push(`${prefix}.amr_id is missing.`);
    if (!episode.task) messages.push(`${prefix}.task is missing.`);
    if (!Array.isArray(episode.start_cell)) messages.push(`${prefix}.start_cell must be an array.`);
    if (!Array.isArray(episode.trajectory)) messages.push(`${prefix}.trajectory must be an array.`);
    if (episode.trajectory.length === 0) messages.push(`${prefix}.trajectory is empty.`);
    if (typeof episode.duration_ms !== "number") messages.push(`${prefix}.duration_ms must be a number.`);
    if (typeof episode.success !== "boolean") messages.push(`${prefix}.success must be boolean.`);
  });

  if (messages.length === 0) {
    messages.push(`VALID: ${dataset.episodes.length} episode(s) passed schema validation.`);
  }

  return {
    ok: messages.length === 1 && messages[0].startsWith("VALID"),
    messages,
  };
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}
