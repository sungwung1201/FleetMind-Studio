import type { Scenario } from "../core/types";

type GridCanvasProps = {
  scenario: Scenario;
  cellSize?: number;
};

function toPixel(value: number, cellSize: number): number {
  return value * cellSize;
}

export function GridCanvas({ scenario, cellSize = 32 }: GridCanvasProps) {
  const widthPx = scenario.width * cellSize;
  const heightPx = scenario.height * cellSize;

  return (
    <div
      className="grid-canvas"
      style={{
        width: widthPx,
        height: heightPx,
        backgroundSize: `${cellSize}px ${cellSize}px`,
      }}
    >
      {scenario.obstacles.map((obstacle) => (
        <div
          key={obstacle.id}
          className="grid-object obstacle"
          style={{
            left: toPixel(obstacle.cell.x, cellSize),
            top: toPixel(obstacle.cell.y, cellSize),
            width: cellSize,
            height: cellSize,
          }}
          title={obstacle.id}
        />
      ))}

      {scenario.workstations.map((workstation) => (
        <div
          key={workstation.id}
          className="grid-object workstation"
          style={{
            left: toPixel(workstation.cell.x, cellSize),
            top: toPixel(workstation.cell.y, cellSize),
            width: cellSize,
            height: cellSize,
          }}
          title={workstation.id}
        >
          {workstation.id}
        </div>
      ))}

      {scenario.amrs.map((amr) => (
        <div
          key={amr.id}
          className="grid-object amr"
          style={{
            left: toPixel(amr.cell.x, cellSize),
            top: toPixel(amr.cell.y, cellSize),
            width: cellSize,
            height: cellSize,
            backgroundColor: amr.color,
          }}
          title={amr.id}
        >
          {amr.id.replace("AMR_", "A")}
        </div>
      ))}

      {scenario.amrs.map((amr) =>
        amr.goalCell ? (
          <div
            key={`${amr.id}-goal`}
            className="grid-object goal"
            style={{
              left: toPixel(amr.goalCell.x, cellSize),
              top: toPixel(amr.goalCell.y, cellSize),
              width: cellSize,
              height: cellSize,
              borderColor: amr.color,
            }}
            title={`${amr.id} goal`}
          >
            G
          </div>
        ) : null
      )}
    </div>
  );
}
