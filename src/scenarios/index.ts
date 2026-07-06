import type { Scenario } from "../core/types";
import { bottleneckScenario } from "./bottleneckScenario";
import { defaultScenario } from "./defaultScenario";
import { edgeSwapScenario } from "./edgeSwapScenario";

export const scenarioList: Scenario[] = [
  defaultScenario,
  edgeSwapScenario,
  bottleneckScenario,
];

export const scenarioMap = new Map<string, Scenario>(
  scenarioList.map((scenario) => [scenario.id, scenario])
);

export function getScenarioById(id: string): Scenario {
  return scenarioMap.get(id) ?? defaultScenario;
}
