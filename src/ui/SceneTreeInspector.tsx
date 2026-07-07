import type { Scenario } from "../core/types";
import type { EditableObjectKind, SelectedStudioObject } from "./GridCanvas";

type SceneTreeInspectorProps = {
  scenario: Scenario;
  selectedObject: SelectedStudioObject | null;
  multiSelectedObjects: SelectedStudioObject[];
  selectedMoveX: number;
  selectedMoveY: number;
  setSelectedMoveX: (value: number) => void;
  setSelectedMoveY: (value: number) => void;
  onSelectObject: (object: SelectedStudioObject) => void;
  onToggleMultiSelected: (object: SelectedStudioObject) => void;
  onSelectAllByKind: (kind: EditableObjectKind) => void;
  onClearMultiSelection: () => void;
  onDeleteMultiSelected: () => void;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

function objectKey(object: SelectedStudioObject): string {
  return `${object.kind}:${object.id}`;
}

function isMultiSelected(
  object: SelectedStudioObject,
  multiSelectedObjects: SelectedStudioObject[]
): boolean {
  const key = objectKey(object);
  return multiSelectedObjects.some((item) => objectKey(item) === key);
}

function getSelectedLabel(object: SelectedStudioObject | null): string {
  if (!object) return "None";
  return `${object.kind.toUpperCase()} · ${object.id}`;
}

function getSelectedType(object: SelectedStudioObject | null): string {
  if (!object) return "-";
  if (object.kind === "amr") return "AMR";
  if (object.kind === "workstation") return "Workstation";
  return "Obstacle";
}

export function SceneTreeInspector({
  scenario,
  selectedObject,
  multiSelectedObjects,
  selectedMoveX,
  selectedMoveY,
  setSelectedMoveX,
  setSelectedMoveY,
  onSelectObject,
  onToggleMultiSelected,
  onSelectAllByKind,
  onClearMultiSelection,
  onDeleteMultiSelected,
  onMoveSelected,
  onDeleteSelected,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: SceneTreeInspectorProps) {
  return (
    <div className="scene-inspector-shell">
      <section className="scene-tree-card">
        <div className="scene-card-header">
          <h3>Scene Tree</h3>
          <div className="scene-tree-actions">
            <button onClick={() => onSelectAllByKind("amr")}>AMR</button>
            <button onClick={() => onSelectAllByKind("workstation")}>WS</button>
            <button onClick={() => onSelectAllByKind("obstacle")}>OBS</button>
          </div>
        </div>

        <div className="scene-tree-groups">
          <div className="scene-tree-group">
            <p>AMRs</p>
            {scenario.amrs.map((amr) => {
              const object: SelectedStudioObject = { kind: "amr", id: amr.id };
              const selected = selectedObject?.kind === "amr" && selectedObject.id === amr.id;

              return (
                <div className={selected ? "scene-tree-row selected" : "scene-tree-row"} key={amr.id}>
                  <input
                    type="checkbox"
                    checked={isMultiSelected(object, multiSelectedObjects)}
                    onChange={() => onToggleMultiSelected(object)}
                  />
                  <button onClick={() => onSelectObject(object)}>
                    <span className="scene-dot" style={{ backgroundColor: amr.color }} />
                    {amr.id}
                  </button>
                  <span>[{amr.cell.x},{amr.cell.y}]</span>
                </div>
              );
            })}
          </div>

          <div className="scene-tree-group">
            <p>Workstations</p>
            {scenario.workstations.map((workstation) => {
              const object: SelectedStudioObject = {
                kind: "workstation",
                id: workstation.id,
              };
              const selected =
                selectedObject?.kind === "workstation" &&
                selectedObject.id === workstation.id;

              return (
                <div
                  className={selected ? "scene-tree-row selected" : "scene-tree-row"}
                  key={workstation.id}
                >
                  <input
                    type="checkbox"
                    checked={isMultiSelected(object, multiSelectedObjects)}
                    onChange={() => onToggleMultiSelected(object)}
                  />
                  <button onClick={() => onSelectObject(object)}>
                    <span className="scene-dot workstation-dot" />
                    {workstation.id}
                  </button>
                  <span>[{workstation.cell.x},{workstation.cell.y}]</span>
                </div>
              );
            })}
          </div>

          <div className="scene-tree-group">
            <p>Obstacles</p>
            {scenario.obstacles.map((obstacle) => {
              const object: SelectedStudioObject = {
                kind: "obstacle",
                id: obstacle.id,
              };
              const selected =
                selectedObject?.kind === "obstacle" &&
                selectedObject.id === obstacle.id;

              return (
                <div
                  className={selected ? "scene-tree-row selected" : "scene-tree-row"}
                  key={obstacle.id}
                >
                  <input
                    type="checkbox"
                    checked={isMultiSelected(object, multiSelectedObjects)}
                    onChange={() => onToggleMultiSelected(object)}
                  />
                  <button onClick={() => onSelectObject(object)}>
                    <span className="scene-dot obstacle-dot" />
                    {obstacle.id}
                  </button>
                  <span>[{obstacle.cell.x},{obstacle.cell.y}]</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="scene-tree-footer">
          <button onClick={onClearMultiSelection}>Clear Multi</button>
          <button className="danger-button" onClick={onDeleteMultiSelected}>
            Delete Multi
          </button>
        </div>
      </section>

      <section className="inspector-card">
        <div className="scene-card-header">
          <h3>Inspector</h3>
          <div className="inspector-history-row">
            <button disabled={!canUndo} onClick={onUndo}>Undo</button>
            <button disabled={!canRedo} onClick={onRedo}>Redo</button>
          </div>
        </div>

        <div className="inspector-summary">
          <strong>{getSelectedLabel(selectedObject)}</strong>
          <span>Type: {getSelectedType(selectedObject)}</span>
        </div>

        <div className="inspector-grid">
          <label>
            X
            <input
              type="number"
              min={0}
              max={scenario.width - 1}
              value={selectedMoveX}
              onChange={(event) => setSelectedMoveX(Number(event.target.value))}
            />
          </label>

          <label>
            Y
            <input
              type="number"
              min={0}
              max={scenario.height - 1}
              value={selectedMoveY}
              onChange={(event) => setSelectedMoveY(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="inspector-actions">
          <button onClick={onMoveSelected}>Apply Move</button>
          <button className="danger-button" onClick={onDeleteSelected}>
            Delete Selected
          </button>
        </div>

        <p>
          Scene Tree and Inspector follow the Stage/Property workflow used by
          professional simulator tools.
        </p>
      </section>
    </div>
  );
}
