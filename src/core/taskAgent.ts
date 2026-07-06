import type { AgentCommand, AgentDecision, AMR, Scenario, Workstation } from "./types";
import { manhattanDistance } from "./grid";

export type AgentPlanResult = {
  scenario: Scenario;
  command: AgentCommand;
  decisions: AgentDecision[];
  logs: string[];
};

const DEFAULT_COMMAND: AgentCommand = {
  fill: ["W1", "W2", "W3"],
  priority: "nearest",
};

function cloneScenario(scenario: Scenario): Scenario {
  return structuredClone(scenario);
}

function normalizeWorkstationId(raw: string): string {
  return raw.trim().toUpperCase();
}

function parseJsonCommand(input: string): AgentCommand | null {
  try {
    const parsed = JSON.parse(input) as Partial<AgentCommand>;

    if (!Array.isArray(parsed.fill)) {
      return null;
    }

    const fill = parsed.fill
      .map((item) => normalizeWorkstationId(String(item)))
      .filter(Boolean);

    if (fill.length === 0) {
      return null;
    }

    const priority =
      parsed.priority === "input_order" || parsed.priority === "nearest"
        ? parsed.priority
        : "nearest";

    return {
      fill,
      priority,
    };
  } catch {
    return null;
  }
}

function parseTextCommand(input: string, workstations: Workstation[]): AgentCommand | null {
  const upper = input.toUpperCase();
  const targetIds = workstations
    .map((workstation) => workstation.id)
    .filter((id) => upper.includes(id));

  if (targetIds.length === 0) {
    return null;
  }

  return {
    fill: targetIds,
    priority: upper.includes("ORDER") || upper.includes("순서") ? "input_order" : "nearest",
  };
}

export function parseAgentCommand(input: string, scenario: Scenario): AgentCommand {
  const trimmed = input.trim();

  if (!trimmed) {
    return DEFAULT_COMMAND;
  }

  return (
    parseJsonCommand(trimmed) ??
    parseTextCommand(trimmed, scenario.workstations) ??
    DEFAULT_COMMAND
  );
}

function findNearestAmr(target: Workstation, candidates: AMR[]): AMR | null {
  let bestAmr: AMR | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const amr of candidates) {
    const distance = manhattanDistance(amr.startCell, target.cell);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestAmr = amr;
    }
  }

  return bestAmr;
}

export function runTaskAgent(sourceScenario: Scenario, commandInput: string): AgentPlanResult {
  const scenario = cloneScenario(sourceScenario);
  const command = parseAgentCommand(commandInput, scenario);
  const decisions: AgentDecision[] = [];
  const logs: string[] = [];

  const availableAmrs = [...scenario.amrs];
  const workstationMap = new Map(
    scenario.workstations.map((workstation) => [workstation.id, workstation])
  );

  const targets = command.fill
    .map((targetId) => workstationMap.get(normalizeWorkstationId(targetId)))
    .filter((item): item is Workstation => Boolean(item));

  if (targets.length === 0) {
    logs.push("Agent failed: no valid workstation target was parsed.");
    return {
      scenario,
      command,
      decisions,
      logs,
    };
  }

  logs.push(
    `Agent command parsed. fill=[${targets.map((target) => target.id).join(", ")}], priority=${command.priority}`
  );

  targets.forEach((target, targetIndex) => {
    if (availableAmrs.length === 0) {
      decisions.push({
        taskId: `task_${String(targetIndex + 1).padStart(3, "0")}`,
        amrId: "NONE",
        targetId: target.id,
        targetCell: target.cell,
        reason: "no_available_amr",
        priority: targetIndex + 1,
        distance: -1,
        decision: "FAILED",
      });

      logs.push(`${target.id}: skipped because no AMR is available.`);
      return;
    }

    const selectedAmr =
      command.priority === "nearest"
        ? findNearestAmr(target, availableAmrs)
        : availableAmrs[0];

    if (!selectedAmr) {
      logs.push(`${target.id}: failed because no selectable AMR exists.`);
      return;
    }

    const distance = manhattanDistance(selectedAmr.startCell, target.cell);
    const scenarioAmr = scenario.amrs.find((amr) => amr.id === selectedAmr.id);

    if (scenarioAmr) {
      scenarioAmr.goalCell = { ...target.cell };
      scenarioAmr.path = [];
      scenarioAmr.status = "IDLE";
    }

    const selectedIndex = availableAmrs.findIndex((amr) => amr.id === selectedAmr.id);
    if (selectedIndex >= 0) {
      availableAmrs.splice(selectedIndex, 1);
    }

    const reason =
      command.priority === "nearest"
        ? "nearest_idle_amr"
        : "input_order_assignment";

    decisions.push({
      taskId: `task_${String(targetIndex + 1).padStart(3, "0")}`,
      amrId: selectedAmr.id,
      targetId: target.id,
      targetCell: target.cell,
      reason,
      priority: targetIndex + 1,
      distance,
      decision: "ASSIGN",
    });

    logs.push(
      `${selectedAmr.id} assigned to ${target.id}. reason=${reason}, distance=${distance}, priority=${targetIndex + 1}`
    );
  });

  for (const remainingAmr of availableAmrs) {
    const scenarioAmr = scenario.amrs.find((amr) => amr.id === remainingAmr.id);

    if (scenarioAmr) {
      scenarioAmr.goalCell = undefined;
      scenarioAmr.path = [];
      scenarioAmr.status = "IDLE";
    }
  }

  return {
    scenario,
    command,
    decisions,
    logs,
  };
}
