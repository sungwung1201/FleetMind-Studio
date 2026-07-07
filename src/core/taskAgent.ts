import type {
  AgentCommand,
  AgentDecision,
  AMR,
  Scenario,
  Workstation,
} from "./types";
import { manhattanDistance } from "./grid";

export type AgentRoute = {
  amrId: string;
  waypoints: string[];
  source: "json" | "natural_language" | "rotation";
};

export type AgentPlanResult = {
  scenario: Scenario;
  command: AgentCommand;
  decisions: AgentDecision[];
  logs: string[];
  routes?: AgentRoute[];
};

type TargetCandidate = {
  id: string;
  index: number;
  source: string;
};

type AmrMention = {
  amrId: string;
  index: number;
  end: number;
  explicit: boolean;
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

function normalizeAmrId(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function getNumberFromId(id: string): number {
  return Number(id.replace(/\D/g, ""));
}

function getWorkstationIds(workstations: Workstation[]): string[] {
  return workstations
    .map((workstation) => workstation.id)
    .sort((a, b) => getNumberFromId(a) - getNumberFromId(b));
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

function resolveAmrId(raw: string, amrs: AMR[]): string | null {
  const normalized = normalizeAmrId(raw);
  const ids = new Set(amrs.map((amr) => amr.id));

  if (ids.has(normalized)) {
    return normalized;
  }

  const numberMatch = normalized.match(/(\d+)/);
  if (!numberMatch) {
    return null;
  }

  const candidate = `AMR_${String(Number(numberMatch[1])).padStart(2, "0")}`;
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
    /(순서|차례|입력\s*순|그대로|먼저|우선|부터|다음|order|input_order|in\s*order|sequential|first|priority)/i;

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
  return /(작업대|워크스테이션|워크|스테이션|채우|처리|목표|이동|보내|가|fill|move|target|workstation|station)/i.test(
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

function applyRangeExpansion(
  targets: string[],
  text: string,
  workstations: Workstation[]
): string[] {
  const rangePatterns = [
    /W\s*0*(\d+)\s*(?:부터|~|-|to)\s*W?\s*0*(\d+)/i,
    /작업대\s*0*(\d+)\s*(?:부터|~|-|to)\s*0*(\d+)/i,
  ];

  for (const pattern of rangePatterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    const start = Number(match[1]);
    const end = Number(match[2]);
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    const expanded = getWorkstationIds(workstations).filter((id) => {
      const number = getNumberFromId(id);
      return number >= low && number <= high;
    });

    return start <= end ? expanded : expanded.reverse();
  }

  return targets;
}

function applyExclusion(
  targets: string[],
  text: string,
  workstations: Workstation[]
): string[] {
  if (!/(빼고|제외|말고|except|exclude|without)/i.test(text)) {
    return targets;
  }

  const exclusionCandidates: TargetCandidate[] = [];
  const exclusionPatterns: Array<{ regex: RegExp; source: string }> = [
    { regex: /W\s*0*(\d+)\s*(?:빼고|제외|말고)/gi, source: "exclude_w" },
    { regex: /작업대\s*0*(\d+)\s*(?:빼고|제외|말고)/g, source: "exclude_ws" },
    { regex: /0*(\d+)\s*번\s*(?:빼고|제외|말고)/g, source: "exclude_number" },
  ];

  for (const pattern of exclusionPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text)) !== null) {
      addCandidateIfValid(
        exclusionCandidates,
        workstations,
        `W${match[1]}`,
        match.index,
        pattern.source
      );
    }
  }

  const excludedIds = new Set(uniqueByOrder(exclusionCandidates));
  if (excludedIds.size === 0) {
    return targets;
  }

  const baseTargets =
    targets.length > 0 ? targets : getWorkstationIds(workstations);

  return baseTargets.filter((target) => !excludedIds.has(target));
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
    return applyExclusion(getWorkstationIds(workstations), text, workstations);
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
      const before = text.slice(Math.max(0, numberedMatch.index - 5), numberedMatch.index);
      if (/AMR|로봇/i.test(before)) {
        continue;
      }

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

  const ranged = applyRangeExpansion(uniqueByOrder(candidates), text, workstations);
  return applyExclusion(ranged, text, workstations);
}

function getArrayFromParsed(
  parsed: Record<string, unknown>,
  keys: string[]
): unknown[] {
  for (const key of keys) {
    const value = parsed[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function parseJsonRoutes(
  parsed: Record<string, unknown>,
  scenario: Scenario
): AgentRoute[] {
  const rawRoutes = getArrayFromParsed(parsed, [
    "routes",
    "missions",
    "multiRoute",
    "multi_route",
    "sequence",
  ]);

  const routes: AgentRoute[] = [];

  rawRoutes.forEach((item) => {
    if (typeof item !== "object" || item === null) {
      return;
    }

    const route = item as Record<string, unknown>;
    const rawAmr = String(route.amrId ?? route.amr ?? route.robotId ?? route.robot ?? "");
    const amrId = resolveAmrId(rawAmr, scenario.amrs);

    if (!amrId) {
      return;
    }

    const rawWaypoints = getArrayFromParsed(route, [
      "waypoints",
      "targets",
      "fill",
      "stations",
      "workstations",
    ]);

    const waypoints = rawWaypoints
      .map((value) => resolveWorkstationId(String(value), scenario.workstations))
      .filter((value): value is string => Boolean(value));

    if (waypoints.length === 0) {
      return;
    }

    routes.push({
      amrId,
      waypoints: [...new Set(waypoints)],
      source: "json",
    });
  });

  return routes;
}

function parseJsonCommand(
  input: string,
  scenario: Scenario
): { command: AgentCommand | null; routes: AgentRoute[] } {
  try {
    const parsed = JSON.parse(input) as Record<string, unknown>;
    const routes = parseJsonRoutes(parsed, scenario);
    const rawFill = getArrayFromParsed(parsed, [
      "fill",
      "targets",
      "workstations",
      "stations",
    ]);

    if (rawFill.length === 0) {
      return { command: routes.length > 0 ? DEFAULT_COMMAND : null, routes };
    }

    const allRequested = rawFill.some((item) =>
      /^(all|every|모두|전체|전부|다)$/i.test(String(item).trim())
    );

    const fill = allRequested
      ? getWorkstationIds(scenario.workstations)
      : rawFill
          .map((item) => resolveWorkstationId(String(item), scenario.workstations))
          .filter((item): item is string => Boolean(item));

    if (fill.length === 0) {
      return { command: routes.length > 0 ? DEFAULT_COMMAND : null, routes };
    }

    const rawPriority = String(parsed.priority ?? parsed.strategy ?? parsed.mode ?? "");
    const priority =
      rawPriority === "input_order" || rawPriority === "nearest"
        ? rawPriority
        : inferPriority(rawPriority);

    return {
      command: {
        fill: [...new Set(fill)],
        priority,
      },
      routes,
    };
  } catch {
    return { command: null, routes: [] };
  }
}

function hasRouteIntent(input: string): boolean {
  return /(AMR|로봇|갔다가|들렀다가|거쳐|경유|순회|로테이션|돌아가|번갈|route|waypoint|multi)/i.test(
    input
  );
}

function findAmrMentions(text: string, amrs: AMR[]): AmrMention[] {
  const mentions: AmrMention[] = [];
  const patterns: Array<{ regex: RegExp; explicit: boolean }> = [
    { regex: /AMR[_\s-]*0*(\d+)/gi, explicit: true },
    { regex: /로봇\s*0*(\d+)\s*번?/g, explicit: true },
    { regex: /0*(\d+)\s*번\s*(?:로봇|AMR)/gi, explicit: true },
    { regex: /0*(\d+)\s*번\s*(?:은|는|이|가)/g, explicit: false },
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text)) !== null) {
      const before = text.slice(Math.max(0, match.index - 5), match.index);
      if (!pattern.explicit && /(작업대|워크|스테이션|W\s*)$/i.test(before)) {
        continue;
      }

      const amrId = resolveAmrId(`AMR_${match[1]}`, amrs);
      if (!amrId) {
        continue;
      }

      mentions.push({
        amrId,
        index: match.index,
        end: pattern.regex.lastIndex,
        explicit: pattern.explicit,
      });
    }
  }

  const sorted = mentions.sort((a, b) => a.index - b.index || b.end - a.end);
  const deduped: AmrMention[] = [];

  for (const mention of sorted) {
    const overlaps = deduped.some(
      (item) => mention.index >= item.index && mention.index < item.end
    );

    if (!overlaps) {
      deduped.push(mention);
    }
  }

  return deduped;
}

function parseTextRoutes(input: string, scenario: Scenario): AgentRoute[] {
  const text = normalizeText(input);

  const robotScopedRoutesV3 = parseRobotScopedRoutesV3(text, scenario);
  if (robotScopedRoutesV3.length > 0) {
    return robotScopedRoutesV3;
  }

  if (!hasRouteIntent(text)) {
    return [];
  }

  const mentions = findAmrMentions(text, scenario.amrs);
  if (mentions.length === 0) {
    return [];
  }

  const hasExplicitMention = mentions.some((mention) => mention.explicit);
  const routeLike = /(갔다가|들렀다가|거쳐|경유|로테이션|순회|돌아가|번갈|route|waypoint|multi)/i.test(
    text
  );

  if (!hasExplicitMention && !routeLike) {
    return [];
  }

  const routes: AgentRoute[] = [];

  mentions.forEach((mention, index) => {
    const nextMention = mentions[index + 1];
    const segment = text.slice(mention.end, nextMention ? nextMention.index : text.length);
    const waypoints = extractTargetsFromText(segment, scenario.workstations);

    if (waypoints.length === 0) {
      return;
    }

    routes.push({
      amrId: mention.amrId,
      waypoints,
      source: /로테이션|순회|돌아가|번갈/i.test(text)
        ? "rotation"
        : "natural_language",
    });
  });

  return routes;
}


function uniqueRouteWaypointsV3(waypoints: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const waypoint of waypoints) {
    if (seen.has(waypoint)) {
      continue;
    }

    seen.add(waypoint);
    result.push(waypoint);
  }

  return result;
}

function mergeRoutesByAmrV3(routes: AgentRoute[]): AgentRoute[] {
  const merged = new Map<string, AgentRoute>();

  for (const route of routes) {
    const existing = merged.get(route.amrId);

    if (!existing) {
      merged.set(route.amrId, {
        ...route,
        waypoints: uniqueRouteWaypointsV3(route.waypoints),
      });
      continue;
    }

    existing.waypoints = uniqueRouteWaypointsV3([
      ...existing.waypoints,
      ...route.waypoints,
    ]);
  }

  return [...merged.values()].filter((route) => route.waypoints.length > 0);
}

function extractWaypointIdsFromRobotTailV3(
  tail: string,
  scenario: Scenario
): string[] {
  const cleaned = tail
    .replace(/작업대/g, "W")
    .replace(/워크스테이션/g, "W")
    .replace(/스테이션/g, "W")
    .replace(/갔다가/g, " ")
    .replace(/갔다\s*가/g, " ")
    .replace(/갔다\s*와/g, " ")
    .replace(/들렀다가/g, " ")
    .replace(/들렸다가/g, " ")
    .replace(/들러서/g, " ")
    .replace(/거쳐서/g, " ")
    .replace(/거쳐/g, " ")
    .replace(/경유해서/g, " ")
    .replace(/경유/g, " ")
    .replace(/간\s*다음/g, " ")
    .replace(/그다음/g, " ")
    .replace(/다음/g, " ")
    .replace(/후에/g, " ")
    .replace(/먼저/g, " ")
    .replace(/그리고/g, " ")
    .replace(/가고/g, " ")
    .replace(/가봐/g, " ")
    .replace(/가라/g, " ")
    .replace(/보내/g, " ")
    .replace(/이동/g, " ")
    .replace(/처리/g, " ")
    .replace(/채워/g, " ")
    .replace(/가/g, " ");

  const waypoints: string[] = [];

  const patterns = [
    /W\s*0*(\d+)/gi,
    /0*(\d+)\s*번(?!\s*(?:로봇|robot|amr))/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(cleaned)) !== null) {
      const waypoint = resolveWorkstationId(`W${match[1]}`, scenario.workstations);

      if (waypoint) {
        waypoints.push(waypoint);
      }
    }
  }

  return uniqueRouteWaypointsV3(waypoints);
}

function findExplicitRobotAnchorsV3(
  input: string,
  scenario: Scenario
): Array<{
  amrId: string;
  index: number;
  end: number;
}> {
  const anchors: Array<{
    amrId: string;
    index: number;
    end: number;
  }> = [];

  const patterns = [
    /(?:AMR|amr)[_\-\s]*0*(\d+)\s*(?:은|는|이|가|을|를)?/gi,
    /0*(\d+)\s*번\s*(?:로봇|robot|amr)\s*(?:은|는|이|가|을|를)?/gi,
    /로봇\s*0*(\d+)\s*번?\s*(?:은|는|이|가|을|를)?/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(input)) !== null) {
      const amrId = resolveAmrId(`AMR_${match[1]}`, scenario.amrs);

      if (!amrId) {
        continue;
      }

      anchors.push({
        amrId,
        index: match.index,
        end: pattern.lastIndex,
      });
    }
  }

  const sorted = anchors.sort((a, b) => a.index - b.index || b.end - a.end);
  const deduped: Array<{
    amrId: string;
    index: number;
    end: number;
  }> = [];

  for (const anchor of sorted) {
    const overlaps = deduped.some(
      (item) => anchor.index >= item.index && anchor.index < item.end
    );

    if (!overlaps) {
      deduped.push(anchor);
    }
  }

  return deduped;
}

function findImplicitRobotAnchorsV3(
  input: string,
  scenario: Scenario
): Array<{
  amrId: string;
  index: number;
  end: number;
}> {
  if (!/(갔다가|갔다\s*가|거쳐|경유|들렀|들렸|로테이션|순회|번갈|route|waypoint)/i.test(input)) {
    return [];
  }

  const anchors: Array<{
    amrId: string;
    index: number;
    end: number;
  }> = [];

  const pattern = /(^|[\s,，]|그리고)\s*0*(\d+)\s*번\s*(?:은|는|이|가)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    const prefix = match[1] ?? "";
    const rawNumber = match[2];
    const numberStart = match.index + prefix.length;
    const before = input.slice(Math.max(0, numberStart - 8), numberStart);

    if (/(작업대|워크|스테이션|W\s*)$/i.test(before)) {
      continue;
    }

    const amrId = resolveAmrId(`AMR_${rawNumber}`, scenario.amrs);

    if (!amrId) {
      continue;
    }

    anchors.push({
      amrId,
      index: numberStart,
      end: pattern.lastIndex,
    });
  }

  return anchors;
}

function parseRotationRoutesV3(input: string, scenario: Scenario): AgentRoute[] {
  if (!/(로테이션|각자|돌아가면서|번갈|순번|순서대로)/i.test(input)) {
    return [];
  }

  const routes: AgentRoute[] = [];
  const pattern =
    /(?:AMR[_\-\s]*0*(\d+)|0*(\d+)\s*번)\s*(?:은|는|이|가|->|:)?\s*(?:W\s*0*(\d+)|작업대\s*0*(\d+)|워크스테이션\s*0*(\d+)|스테이션\s*0*(\d+)|0*(\d+)\s*번(?!\s*(?:로봇|robot|amr)))/gi;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    const rawAmr = match[1] ?? match[2];
    const rawWaypoint = match[3] ?? match[4] ?? match[5] ?? match[6] ?? match[7];

    if (!rawAmr || !rawWaypoint) {
      continue;
    }

    const amrId = resolveAmrId(`AMR_${rawAmr}`, scenario.amrs);
    const waypoint = resolveWorkstationId(`W${rawWaypoint}`, scenario.workstations);

    if (!amrId || !waypoint) {
      continue;
    }

    routes.push({
      amrId,
      waypoints: [waypoint],
      source: "rotation",
    });
  }

  return mergeRoutesByAmrV3(routes);
}

function parseRobotScopedRoutesV3(input: string, scenario: Scenario): AgentRoute[] {
  const normalized = normalizeText(input)
    .replace(/에이엠알/gi, "AMR")
    .replace(/[,，]/g, " 그리고 ");

  const rotationRoutes = parseRotationRoutesV3(normalized, scenario);

  if (rotationRoutes.length > 0) {
    return rotationRoutes;
  }

  const explicitAnchors = findExplicitRobotAnchorsV3(normalized, scenario);
  const anchors =
    explicitAnchors.length > 0
      ? explicitAnchors
      : findImplicitRobotAnchorsV3(normalized, scenario);

  if (anchors.length === 0) {
    return [];
  }

  const routes: AgentRoute[] = [];

  anchors.forEach((anchor, index) => {
    const nextAnchor = anchors[index + 1];
    const tail = normalized.slice(
      anchor.end,
      nextAnchor ? nextAnchor.index : normalized.length
    );

    const waypoints = extractWaypointIdsFromRobotTailV3(tail, scenario);

    if (waypoints.length === 0) {
      return;
    }

    routes.push({
      amrId: anchor.amrId,
      waypoints,
      source: "natural_language",
    });
  });

  return mergeRoutesByAmrV3(routes);
}


function parseTextCommand(
  input: string,
  scenario: Scenario
): { command: AgentCommand | null; routes: AgentRoute[] } {
  const routes = parseTextRoutes(input, scenario);
  const fill = extractTargetsFromText(input, scenario.workstations);

  if (fill.length === 0) {
    return { command: routes.length > 0 ? DEFAULT_COMMAND : null, routes };
  }

  return {
    command: {
      fill,
      priority: inferPriority(input),
    },
    routes,
  };
}









function normalizeStrictAmrId(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return "";
  }
  return `AMR_${String(n).padStart(2, "0")}`;
}

function normalizeStrictWorkstationId(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return "";
  }
  return `W${n}`;
}

function parseStrictWaypointTail(tail: string): string[] {
  const cleaned = tail
    .replace(/작업대/g, "W")
    .replace(/번/g, " ")
    .replace(/으로/g, " ")
    .replace(/로/g, " ")
    .replace(/갔다가/g, " ")
    .replace(/갔다\s*가/g, " ")
    .replace(/갔다\s*와/g, " ")
    .replace(/간\s*다음/g, " ")
    .replace(/다음/g, " ")
    .replace(/그다음/g, " ")
    .replace(/후에/g, " ")
    .replace(/먼저/g, " ")
    .replace(/들렸다가/g, " ")
    .replace(/들러서/g, " ")
    .replace(/가고/g, " ")
    .replace(/가봐/g, " ")
    .replace(/가/g, " ");

  const ids: string[] = [];

  for (const match of cleaned.matchAll(/(?:W\s*)?(\d+)/gi)) {
    const id = normalizeStrictWorkstationId(match[1]);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }

  return ids;
}

function parseStrictRobotRouteCommand(input: string): Array<{
  amrId: string;
  waypoints: string[];
}> {
  const normalized = input
    .replace(/에이엠알/gi, "AMR")
    .replace(/로봇\s*/g, "로봇")
    .replace(/작업대\s*/g, "작업대")
    .replace(/[,，]/g, " 그리고 ");

  const robotPattern =
    /(?:(?:AMR|amr)[_\-\s]*0?(\d+)|(\d+)\s*번\s*(?:로봇|robot|amr))/g;

  const robotMatches = [...normalized.matchAll(robotPattern)];

  if (robotMatches.length === 0) {
    return [];
  }

  const routes: Array<{
    amrId: string;
    waypoints: string[];
  }> = [];

  for (let i = 0; i < robotMatches.length; i += 1) {
    const match = robotMatches[i];
    const robotNumber = match[1] ?? match[2];
    const amrId = normalizeStrictAmrId(robotNumber);

    if (!amrId) {
      continue;
    }

    const tailStart = (match.index ?? 0) + match[0].length;
    const tailEnd =
      i + 1 < robotMatches.length
        ? robotMatches[i + 1].index ?? normalized.length
        : normalized.length;

    const tail = normalized.slice(tailStart, tailEnd);
    const waypoints = parseStrictWaypointTail(tail);

    if (waypoints.length > 0) {
      routes.push({
        amrId,
        waypoints,
      });
    }
  }

  return routes;
}


export function parseAgentCommand(input: string, scenario: Scenario): AgentCommand {

  const strictRobotRoutes = parseStrictRobotRouteCommand(input);

  if (strictRobotRoutes.length > 0) {
    return {
      fill: [],
      priority: "input_order",
      // routes are handled by parseAgentInput/runTaskAgent, not AgentCommand
    };
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return DEFAULT_COMMAND;
  }

  const jsonParsed = parseJsonCommand(trimmed, scenario);
  if (jsonParsed.command) {
    return jsonParsed.command;
  }

  const textParsed = parseTextCommand(trimmed, scenario);
  if (textParsed.command) {
    return textParsed.command;
  }

return DEFAULT_COMMAND;
}

function parseAgentInput(
  input: string,
  scenario: Scenario
): { command: AgentCommand; routes: AgentRoute[] } {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      command: DEFAULT_COMMAND,
      routes: [],
    };
  }

  const jsonParsed = parseJsonCommand(trimmed, scenario);
  if (jsonParsed.command || jsonParsed.routes.length > 0) {
    return {
      command: jsonParsed.command ?? DEFAULT_COMMAND,
      routes: jsonParsed.routes,
    };
  }

  const robotScopedRoutesV3 = parseRobotScopedRoutesV3(trimmed, scenario);

  if (robotScopedRoutesV3.length > 0) {
    return {
      command: {
        fill: [],
        priority: "input_order",
      },
      routes: robotScopedRoutesV3,
    };
  }

  const textParsed = parseTextCommand(trimmed, scenario);
  if (textParsed.command || textParsed.routes.length > 0) {
    return {
      command: textParsed.command ?? DEFAULT_COMMAND,
      routes: textParsed.routes,
    };
  }

  return {
    command: DEFAULT_COMMAND,
    routes: [],
  };
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

function applyRouteAssignmentsToScenario(
  scenario: Scenario,
  routes: AgentRoute[],
  decisions: AgentDecision[],
  logs: string[]
): void {
  const workstationMap = new Map(
    scenario.workstations.map((workstation) => [workstation.id, workstation])
  );
  const assignedAmrIds = new Set<string>();
  let taskIndex = 1;

  for (const route of routes) {
    const scenarioAmr = scenario.amrs.find((amr) => amr.id === route.amrId);
    if (!scenarioAmr) {
      continue;
    }

    const validWaypoints = route.waypoints
      .map((waypoint) => workstationMap.get(waypoint))
      .filter((item): item is Workstation => Boolean(item));

    if (validWaypoints.length === 0) {
      logs.push(`${route.amrId}: route skipped because no valid waypoint was parsed.`);
      continue;
    }

    assignedAmrIds.add(route.amrId);
    scenarioAmr.startCell = { ...scenarioAmr.cell };
    scenarioAmr.goalCell = { ...validWaypoints[validWaypoints.length - 1].cell };
    scenarioAmr.path = [];
    scenarioAmr.status = "IDLE";

    validWaypoints.forEach((target, routeOrder) => {
      const fromCell =
        routeOrder === 0 ? scenarioAmr.cell : validWaypoints[routeOrder - 1].cell;
      const distance = manhattanDistance(fromCell, target.cell);

      decisions.push({
        taskId: `route_${String(taskIndex).padStart(3, "0")}`,
        amrId: scenarioAmr.id,
        targetId: target.id,
        targetCell: target.cell,
        reason: `explicit_${route.source}_route_order_${routeOrder + 1}`,
        priority: taskIndex,
        distance,
        decision: "ASSIGN",
      });

      taskIndex += 1;
    });

    logs.push(
      `${route.amrId} route parsed: ${validWaypoints
        .map((target) => target.id)
        .join(" -> ")} source=${route.source}`
    );
  }

  for (const amr of scenario.amrs) {
    if (assignedAmrIds.has(amr.id)) {
      continue;
    }

    amr.goalCell = undefined;
    amr.path = [];
    amr.status = "IDLE";
  }
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
  const parsed = parseAgentInput(commandInput, scenario);
  const command = parsed.command;
  const decisions: AgentDecision[] = [];
  const logs: string[] = [];

  if (parsed.routes.length > 0) {
    logs.push(
      `Agent route command parsed. routes=${parsed.routes
        .map((route) => `${route.amrId}:${route.waypoints.join("->")}`)
        .join(", ")}`
    );

    applyRouteAssignmentsToScenario(scenario, parsed.routes, decisions, logs);

    return {
      scenario,
      command,
      decisions,
      logs,
      routes: parsed.routes,
    };
  }

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
