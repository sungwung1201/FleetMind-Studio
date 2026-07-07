import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Cell, Scenario } from "../core/types";

export type EditableObjectKind = "amr" | "workstation" | "obstacle";

export type SelectedStudioObject = {
  kind: EditableObjectKind;
  id: string;
};

export type ObstacleBrushMode = "paint_obstacle" | "erase_obstacle" | null;

type GridCanvasProps = {
  scenario: Scenario;
  cellSize: number;
  editable?: boolean;
  selectedObject?: SelectedStudioObject | null;
  brushMode?: ObstacleBrushMode;
  obstacleBrushMode?: ObstacleBrushMode;
  onSelectObject?: (object: SelectedStudioObject) => void;
  onBrushCell?: (cell: Cell) => void;
  onMoveObject?: (object: SelectedStudioObject, cell: Cell) => void;
  [key: string]: unknown;
};

function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

function clampCell(cell: Cell, scenario: Scenario): Cell {
  return {
    x: Math.max(0, Math.min(scenario.width - 1, cell.x)),
    y: Math.max(0, Math.min(scenario.height - 1, cell.y)),
  };
}

function isInside(cell: Cell, scenario: Scenario): boolean {
  return (
    cell.x >= 0 &&
    cell.x < scenario.width &&
    cell.y >= 0 &&
    cell.y < scenario.height
  );
}

function getCellFromPointer(
  event: PointerEvent<HTMLDivElement>,
  element: HTMLDivElement,
  cellSize: number,
  scenario: Scenario
): Cell {
  const rect = element.getBoundingClientRect();

  return clampCell(
    {
      x: Math.floor((event.clientX - rect.left) / cellSize),
      y: Math.floor((event.clientY - rect.top) / cellSize),
    },
    scenario
  );
}

function getCellStyle(cell: Cell, cellSize: number): React.CSSProperties {
  return {
    left: cell.x * cellSize,
    top: cell.y * cellSize,
    width: cellSize,
    height: cellSize,
  };
}

function isSelected(
  selectedObject: SelectedStudioObject | null | undefined,
  object: SelectedStudioObject
): boolean {
  return (
    selectedObject?.kind === object.kind &&
    selectedObject?.id === object.id
  );
}

function getGoalCell(amr: unknown): Cell | null {
  const maybe = amr as {
    goalCell?: Cell;
    targetCell?: Cell;
    assignedGoal?: Cell;
  };

  return maybe.goalCell ?? maybe.targetCell ?? maybe.assignedGoal ?? null;
}

export function GridCanvas({
  scenario,
  cellSize,
  editable = false,
  selectedObject = null,
  brushMode = null,
  obstacleBrushMode = null,
  onSelectObject,
  onBrushCell,
  onMoveObject,
}: GridCanvasProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [draggingObject, setDraggingObject] =
    useState<SelectedStudioObject | null>(null);
  const lastPaintedCellRef = useRef<string | null>(null);

  const activeBrushMode = brushMode ?? obstacleBrushMode ?? null;
  const isBrushActive =
    activeBrushMode === "paint_obstacle" ||
    activeBrushMode === "erase_obstacle";

  const paintAtPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!isBrushActive || !onBrushCell || !gridRef.current) {
      return;
    }

    const cell = getCellFromPointer(
      event,
      gridRef.current,
      cellSize,
      scenario
    );

    if (!isInside(cell, scenario)) {
      return;
    }

    const key = cellKey(cell);
    if (lastPaintedCellRef.current === key) {
      return;
    }

    lastPaintedCellRef.current = key;
    onBrushCell(cell);
  };

  const handleCanvasPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isBrushActive) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsPainting(true);
      lastPaintedCellRef.current = null;
      paintAtPointer(event);
      return;
    }

    setDraggingObject(null);
  };

  const handleCanvasPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isBrushActive && isPainting) {
      event.preventDefault();
      paintAtPointer(event);
    }
  };

  const handleCanvasPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (isBrushActive) {
      event.preventDefault();

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      setIsPainting(false);
      lastPaintedCellRef.current = null;
      return;
    }

    if (draggingObject && onMoveObject && gridRef.current) {
      const cell = getCellFromPointer(
        event,
        gridRef.current,
        cellSize,
        scenario
      );

      onMoveObject(draggingObject, cell);
    }

    setDraggingObject(null);
  };

  const handleObjectPointerDown = (
    event: PointerEvent<HTMLDivElement>,
    object: SelectedStudioObject
  ) => {
    if (isBrushActive) {
      return;
    }

    event.stopPropagation();
    onSelectObject?.(object);

    if (editable) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraggingObject(object);
    }
  };

  const gridWidth = scenario.width * cellSize;
  const gridHeight = scenario.height * cellSize;

  return (
    <div
      ref={gridRef}
      className={[
        "grid-canvas",
        editable ? "editable" : "",
        isBrushActive ? "brush-active" : "",
        activeBrushMode === "paint_obstacle" ? "paint-active" : "",
        activeBrushMode === "erase_obstacle" ? "erase-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        position: "relative",
        width: gridWidth,
        height: gridHeight,
        backgroundSize: `${cellSize}px ${cellSize}px`,
        touchAction: "none",
        cursor:
          activeBrushMode === "paint_obstacle"
            ? "crosshair"
            : activeBrushMode === "erase_obstacle"
              ? "not-allowed"
              : editable
                ? "grab"
                : "default",
      }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerUp}
    >
      {scenario.amrs.flatMap((amr) =>
        amr.path.map((pathCell, index) => (
          <div
            className="path-cell"
            key={`${amr.id}-path-${index}-${pathCell.x}-${pathCell.y}-${pathCell.t}`}
            style={{
              ...getCellStyle(pathCell, cellSize),
              position: "absolute",
              pointerEvents: "none",
            }}
          />
        ))
      )}

      {scenario.amrs.map((amr) => {
        const goalCell = getGoalCell(amr);

        if (!goalCell) {
          return null;
        }

        return (
          <div
            className="goal"
            key={`${amr.id}-goal`}
            style={{
              ...getCellStyle(goalCell, cellSize),
              position: "absolute",
              pointerEvents: "none",
            }}
          >
            G
          </div>
        );
      })}

      {scenario.obstacles.map((obstacle) => {
        const object: SelectedStudioObject = {
          kind: "obstacle",
          id: obstacle.id,
        };

        return (
          <div
            className={isSelected(selectedObject, object) ? "obstacle selected" : "obstacle"}
            key={obstacle.id}
            style={{
              ...getCellStyle(obstacle.cell, cellSize),
              position: "absolute",
            }}
            title={`${obstacle.id} [${obstacle.cell.x},${obstacle.cell.y}]`}
            onPointerDown={(event) => handleObjectPointerDown(event, object)}
          />
        );
      })}

      {scenario.workstations.map((workstation) => {
        const object: SelectedStudioObject = {
          kind: "workstation",
          id: workstation.id,
        };

        return (
          <div
            className={
              isSelected(selectedObject, object)
                ? "workstation selected"
                : "workstation"
            }
            key={workstation.id}
            style={{
              ...getCellStyle(workstation.cell, cellSize),
              position: "absolute",
            }}
            title={`${workstation.id} [${workstation.cell.x},${workstation.cell.y}]`}
            onPointerDown={(event) => handleObjectPointerDown(event, object)}
          >
            {workstation.id}
          </div>
        );
      })}

      {scenario.amrs.map((amr) => {
        const object: SelectedStudioObject = {
          kind: "amr",
          id: amr.id,
        };

        return (
          <div
            className={isSelected(selectedObject, object) ? "amr selected" : "amr"}
            key={amr.id}
            style={{
              ...getCellStyle(amr.cell, cellSize),
              position: "absolute",
              backgroundColor: amr.color,
            }}
            title={`${amr.id} [${amr.cell.x},${amr.cell.y}]`}
            onPointerDown={(event) => handleObjectPointerDown(event, object)}
          >
            {amr.id.replace("AMR_", "A")}
          </div>
        );
      })}
    </div>
  );
}
