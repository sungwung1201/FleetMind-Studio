import type {
  AgentCommand,
  AgentDecision,
  AMR,
  Scenario,
  Workstation,
} from "./types";
import { manhattanDistance } from "./grid";

export type AgentPlanResult = {
  scenario: Scenario;
  command: AgentCommand;
  decisions: AgentDecision[];
  logs: string[];
};

type TargetCandidate = {
  id: string;
  index: number;
  source: string;
};

type Assignment = {
  target: Workstation;
  amr: AMR;
  distance: number;
};

const DEFAULT_COMMAND: AgentCommand = {
  fill: ["W1", "W2", "W3"],
  priority: "nearest",
};

function cloneScenario(scenario: Scenario): Scenario {
  return structuredClone(scenario);
}

function normalizeText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function normalizeWorkstationId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function getWorkstationIds(workstations: Workstation[]): string[] {
  return workstations
    .map((workstation) => workstation.id)
    .sort((a, b) => {
      const aNumber = Number(a.replace(/\D/g, ""));
      const bNumber = Number(b.replace(/\D/g, ""));
      return aNumber - bNumber;
    });
}

function resolveWorkstationId(
  raw: string,
  workstations: Workstation[]
): string | null {
  const normalized = normalizeWorkstationId(raw);
  const ids = new Set(workstations.map((workstation) => workstation.id));

  if (ids.has(normalized)) {
    return normalized;
  }

  const numberMatch = normalized.match(/(\d+)/);
  if (!numberMatch) {
    return null;
  }

  const candidate = `W${Number(numberMatch[1])}`;
  return ids.has(candidate) ? candidate : null;
}

function uniqueByOrder(candidates: TargetCandidate[]): string[] {
  const sorted = [...candidates].sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const candidate of sorted) {
    if (seen.has(candidate.id)) {
      continue;
    }

    seen.add(candidate.id);
    result.push(candidate.id);
  }

  return result;
}

function inferPriority(input: string): AgentCommand["priority"] {
  const lower = input.toLowerCase();

  const inputOrderPattern =
    /(순서|차례|입력\s*순|그대로|먼저|우선|부터|다음|order|input_order|in\s*order|sequential|first)/i;

  const nearestPattern =
    /(가까|가장\s*가까운|최단|거리|nearest|closest|shortest)/i;

  if (inputOrderPattern.test(lower)) {
    return "input_order";
  }

  if (nearestPattern.test(lower)) {
    return "nearest";
  }

  return "nearest";
}

function hasWorkstationIntent(input: string): boolean {
  return /(작업대|워크스테이션|워크|스테이션|채우|처리|목표|이동|보내|fill|move|target|workstation|station)/i.test(
    input
  );
}

function addCandidateIfValid(
  candidates: TargetCandidate[],
  workstations: Workstation[],
  rawId: string,
  index: number,
  source: string
): void {
  const resolved = resolveWorkstationId(rawId, workstations);

  if (!resolved) {
    return;
  }

  candidates.push({
    id: resolved,
    index,
    source,
  });
}

function extractTargetsFromText(
  input: string,
  workstations: Workstation[]
): string[] {
  const candidates: TargetCandidate[] = [];
  const text = normalizeText(input);

  const allPattern = /(모든|모두|전체|전부|다|all|every|all\s*workstations)/i;
  const allMatch = text.match(allPattern);

  if (allMatch && typeof allMatch.index === "number") {
    return getWorkstationIds(workstations);
  }

  const patterns: Array<{ regex: RegExp; source: string }> = [
    { regex: /W\s*0*(\d+)/gi, source: "w_id" },
    { regex: /WS\s*0*(\d+)/gi, source: "ws_id" },
    { regex: /WORKSTATION\s*0*(\d+)/gi, source: "workstation_en" },
    { regex: /STATION\s*0*(\d+)/gi, source: "station_en" },
    { regex: /작업대\s*0*(\d+)/g, source: "workstation_ko" },
    { regex: /워크스테이션\s*0*(\d+)/g, source: "workstation_ko" },
    { regex: /스테이션\s*0*(\d+)/g, source: "station_ko" },
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.regex.exec(text)) !== null) {
      addCandidateIfValid(
        candidates,
        workstations,
        `W${match[1]}`,
        match.index,
        pattern.source
      );
    }
  }

  if (hasWorkstationIntent(text)) {
    const numberedPattern = /0*(\d+)\s*번/g;
    let numberedMatch: RegExpExecArray | null;

    while ((numberedMatch = numberedPattern.exec(text)) !== null) {
      addCandidateIfValid(
        candidates,
        workstations,
        `W${numberedMatch[1]}`,
        numberedMatch.index,
        "numbered_ko"
      );
    }

    const ordinalPatterns: Array<{ regex: RegExp; id: string; source: string }> = [
      { regex: /첫\s*번째|첫째|1\s*번째|일\s*번/g, id: "W1", source: "ordinal_1" },
      { regex: /두\s*번째|둘째|2\s*번째|이\s*번/g, id: "W2", source: "ordinal_2" },
      { regex: /세\s*번째|셋째|3\s*번째|삼\s*번/g, id: "W3", source: "ordinal_3" },
      { regex: /네\s*번째|넷째|4\s*번째|사\s*번/g, id: "W4", source: "ordinal_4" },
      { regex: /다섯\s*번째|5\s*번째|오\s*번/g, id: "W5", source: "ordinal_5" },
    ];

    for (const pattern of ordinalPatterns) {
      let match: RegExpExecArray | null;

      while ((match = pattern.regex.exec(text)) !== null) {
        addCandidateIfValid(
          candidates,
          workstations,
          pattern.id,
          match.index,
          pattern.source
        );
      }
    }
  }

  return uniqueByOrder(candidates);
}

function parseJsonCommand(
  input: string,
  workstations: Workstation[]
): AgentCommand | null {
  try {
    const parsed = JSON.parse(input) as Partial<AgentCommand>;
    const rawFill = Array.isArray(parsed.fill) ? parsed.fill : [];

    if (rawFill.length === 0) {
      return null;
    }

    const allRequested = rawFill.some((item) =>
      /^(all|every|모두|전체|전부|다)$/i.test(String(item).trim())
    );

    const fill = allRequested
      ? getWorkstationIds(workstations)
      : rawFill
          .map((item) => resolveWorkstationId(String(item), workstations))
          .filter((item): item is string => Boolean(item));

    if (fill.length === 0) {
      return null;
    }

    const priority =
      parsed.priority === "input_order" || parsed.priority === "nearest"
        ? parsed.priority
        : inferPriority(String(parsed.priority ?? ""));

    return {
      fill: [...new Set(fill)],
      priority,
    };
  } catch {
    return null;
  }
}

function parseTextCommand(
  input: string,
  workstations: Workstation[]
): AgentCommand | null {
  const fill = extractTargetsFromText(input, workstations);

  if (fill.length === 0) {
    return null;
  }

  return {
    fill,
    priority: inferPriority(input),
  };
}

export function parseAgentCommand(input: string, scenario: Scenario): AgentCommand {
  const trimmed = input.trim();

  if (!trimmed) {
    return DEFAULT_COMMAND;
  }

  const parsed =
    parseJsonCommand(trimmed, scenario.workstations) ??
    parseTextCommand(trimmed, scenario.workstations);

  if (parsed) {
    return parsed;
  }

  return DEFAULT_COMMAND;
}

function getDistance(amr: AMR, target: Workstation): number {
  return manhattanDistance(amr.cell, target.cell);
}

function getDistanceMatrixLog(amrs: AMR[], targets: Workstation[]): string[] {
  return targets.map((target) => {
    const distances = amrs
      .map((amr) => `${amr.id}=${getDistance(amr, target)}`)
      .join(", ");

    return `Distance matrix ${target.id}: ${distances}`;
  });
}

function compareAssignments(a: Assignment[], b: Assignment[]): number {
  const aCost = a.reduce((sum, item) => sum + item.distance, 0);
  const bCost = b.reduce((sum, item) => sum + item.distance, 0);

  if (aCost !== bCost) {
    return aCost - bCost;
  }

  const aMax = Math.max(...a.map((item) => item.distance));
  const bMax = Math.max(...b.map((item) => item.distance));

  if (aMax !== bMax) {
    return aMax - bMax;
  }

  const aKey = a.map((item) => `${item.target.id}:${item.amr.id}`).join("|");
  const bKey = b.map((item) => `${item.target.id}:${item.amr.id}`).join("|");

  return aKey.localeCompare(bKey);
}

function findGlobalNearestAssignments(
  targets: Workstation[],
  amrs: AMR[]
): Assignment[] {
  const assignableTargets = targets.slice(0, amrs.length);
  let best: Assignment[] | null = null;

  function dfs(
    targetIndex: number,
    remainingAmrs: AMR[],
    current: Assignment[]
  ): void {
    if (targetIndex >= assignableTargets.length) {
      if (!best || compareAssignments(current, best) < 0) {
        best = [...current];
      }
      return;
    }

    const target = assignableTargets[targetIndex];

    for (const amr of remainingAmrs) {
      const nextRemaining = remainingAmrs.filter((item) => item.id !== amr.id);
      const distance = getDistance(amr, target);

      dfs(targetIndex + 1, nextRemaining, [
        ...current,
        {
          target,
          amr,
          distance,
        },
      ]);
    }
  }

  dfs(0, amrs, []);
  return best ?? [];
}

function findInputOrderNearestAssignments(
  targets: Workstation[],
  amrs: AMR[]
): Assignment[] {
  const assignments: Assignment[] = [];
  const remainingAmrs = [...amrs];

  for (const target of targets) {
    if (remainingAmrs.length === 0) {
      break;
    }

    const sorted = [...remainingAmrs].sort((a, b) => {
      const distanceDiff = getDistance(a, target) - getDistance(b, target);

      if (distanceDiff !== 0) {
        return distanceDiff;
      }

      return a.id.localeCompare(b.id);
    });

    const selectedAmr = sorted[0];

    assignments.push({
      target,
      amr: selectedAmr,
      distance: getDistance(selectedAmr, target),
    });

    const selectedIndex = remainingAmrs.findIndex(
      (amr) => amr.id === selectedAmr.id
    );

    if (selectedIndex >= 0) {
      remainingAmrs.splice(selectedIndex, 1);
    }
  }

  return assignments;
}

function applyAssignmentsToScenario(
  scenario: Scenario,
  assignments: Assignment[],
  decisions: AgentDecision[],
  logs: string[],
  command: AgentCommand,
  targets: Workstation[]
): void {
  const assignedAmrIds = new Set<string>();
  const assignedTargetIds = new Set<string>();

  assignments.forEach((assignment, index) => {
    const scenarioAmr = scenario.amrs.find((amr) => amr.id === assignment.amr.id);

    if (!scenarioAmr) {
      return;
    }

    scenarioAmr.startCell = { ...scenarioAmr.cell };
    scenarioAmr.goalCell = { ...assignment.target.cell };
    scenarioAmr.path = [];
    scenarioAmr.status = "IDLE";

    assignedAmrIds.add(scenarioAmr.id);
    assignedTargetIds.add(assignment.target.id);

    const reason =
      command.priority === "nearest"
        ? "global_nearest_total_distance"
        : "input_order_nearest_available_amr";

    decisions.push({
      taskId: `task_${String(index + 1).padStart(3, "0")}`,
      amrId: scenarioAmr.id,
      targetId: assignment.target.id,
      targetCell: assignment.target.cell,
      reason,
      priority: index + 1,
      distance: assignment.distance,
      decision: "ASSIGN",
    });

    logs.push(
      `${scenarioAmr.id} assigned to ${assignment.target.id}. reason=${reason}, current_distance=${assignment.distance}, priority=${index + 1}`
    );
  });

  targets.forEach((target, index) => {
    if (assignedTargetIds.has(target.id)) {
      return;
    }

    decisions.push({
      taskId: `task_${String(assignments.length + index + 1).padStart(3, "0")}`,
      amrId: "NONE",
      targetId: target.id,
      targetCell: target.cell,
      reason: "no_available_amr",
      priority: assignments.length + index + 1,
      distance: -1,
      decision: "FAILED",
    });

    logs.push(`${target.id}: skipped because no AMR is available.`);
  });

  for (const amr of scenario.amrs) {
    if (assignedAmrIds.has(amr.id)) {
      continue;
    }

    amr.goalCell = undefined;
    amr.path = [];
    amr.status = "IDLE";
  }
}

export function runTaskAgent(
  sourceScenario: Scenario,
  commandInput: string
): AgentPlanResult {
  const scenario = cloneScenario(sourceScenario);
  const command = parseAgentCommand(commandInput, scenario);
  const decisions: AgentDecision[] = [];
  const logs: string[] = [];

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
    `Agent command parsed. fill=[${targets
      .map((target) => target.id)
      .join(", ")}], priority=${command.priority}`
  );

  logs.push(...getDistanceMatrixLog(scenario.amrs, targets));

  const assignments =
    command.priority === "nearest"
      ? findGlobalNearestAssignments(targets, scenario.amrs)
      : findInputOrderNearestAssignments(targets, scenario.amrs);

  const totalDistance = assignments.reduce(
    (sum, assignment) => sum + assignment.distance,
    0
  );

  logs.push(
    `Assignment strategy=${command.priority}. assigned=${assignments.length}, total_distance=${totalDistance}`
  );

  applyAssignmentsToScenario(
    scenario,
    assignments,
    decisions,
    logs,
    command,
    targets
  );

  return {
    scenario,
    command,
    decisions,
    logs,
  };
}
