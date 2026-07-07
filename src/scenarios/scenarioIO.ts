import type { Scenario } from "../core/types";

export type ScenarioImportResult = {
  ok: boolean;
  scenario?: Scenario;
  error?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateScenario(value: unknown): ScenarioImportResult {
  if (!isObject(value)) {
    return {
      ok: false,
      error: "Scenario JSON root must be an object.",
    };
  }

  const requiredFields = ["id", "name", "width", "height", "amrs", "workstations", "obstacles"];

  for (const field of requiredFields) {
    if (!(field in value)) {
      return {
        ok: false,
        error: `Missing required field: ${field}`,
      };
    }
  }

  if (!Array.isArray(value.amrs)) {
    return {
      ok: false,
      error: "amrs must be an array.",
    };
  }

  if (!Array.isArray(value.workstations)) {
    return {
      ok: false,
      error: "workstations must be an array.",
    };
  }

  if (!Array.isArray(value.obstacles)) {
    return {
      ok: false,
      error: "obstacles must be an array.",
    };
  }

  if (typeof value.width !== "number" || typeof value.height !== "number") {
    return {
      ok: false,
      error: "width and height must be numbers.",
    };
  }

  if (value.width < 20 || value.height < 20) {
    return {
      ok: false,
      error: "Scenario grid must be at least 20x20.",
    };
  }

  return {
    ok: true,
    scenario: value as Scenario,
  };
}

export function downloadScenarioJson(scenario: Scenario): void {
  const exportScenario: Scenario = {
    ...scenario,
    id: scenario.id.startsWith("imported_") ? scenario.id : scenario.id,
    amrs: scenario.amrs.map((amr) => ({
      ...amr,
      cell: { ...amr.startCell },
      path: [],
      status: "IDLE",
    })),
  };

  const blob = new Blob([JSON.stringify(exportScenario, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${scenario.id}_scenario.json`;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function readScenarioFile(file: File): Promise<ScenarioImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = JSON.parse(text);
        const result = validateScenario(parsed);

        if (!result.ok || !result.scenario) {
          resolve(result);
          return;
        }

        const scenario: Scenario = {
          ...result.scenario,
          id: result.scenario.id.startsWith("imported_")
            ? result.scenario.id
            : `imported_${result.scenario.id}`,
          name: result.scenario.name.startsWith("Imported")
            ? result.scenario.name
            : `Imported · ${result.scenario.name}`,
          amrs: result.scenario.amrs.map((amr) => ({
            ...amr,
            cell: { ...amr.startCell },
            path: [],
            status: "IDLE",
          })),
        };

        resolve({
          ok: true,
          scenario,
        });
      } catch (error) {
        resolve({
          ok: false,
          error: error instanceof Error ? error.message : "Unknown JSON parse error.",
        });
      }
    };

    reader.onerror = () => {
      resolve({
        ok: false,
        error: "Failed to read scenario file.",
      });
    };

    reader.readAsText(file);
  });
}
