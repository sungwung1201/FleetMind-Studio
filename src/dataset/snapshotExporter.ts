import type { Scenario } from "../core/types";

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + width / 2, y + height / 2);
}

export function createSnapshotPng(
  scenario: Scenario,
  filename: string,
  cellSize = 32
): void {
  const canvas = document.createElement("canvas");
  const width = scenario.width * cellSize;
  const height = scenario.height * cellSize;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(31, 56, 100, 0.18)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= scenario.width; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, height);
    ctx.stroke();
  }

  for (let y = 0; y <= scenario.height; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(width, y * cellSize);
    ctx.stroke();
  }

  for (const amr of scenario.amrs) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = amr.color;

    for (const pathCell of amr.path) {
      ctx.beginPath();
      ctx.arc(
        pathCell.x * cellSize + cellSize / 2,
        pathCell.y * cellSize + cellSize / 2,
        cellSize * 0.17,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  for (const obstacle of scenario.obstacles) {
    ctx.fillStyle = "#344054";
    ctx.fillRect(
      obstacle.cell.x * cellSize,
      obstacle.cell.y * cellSize,
      cellSize,
      cellSize
    );
  }

  ctx.font = "bold 12px sans-serif";

  for (const workstation of scenario.workstations) {
    const x = workstation.cell.x * cellSize;
    const y = workstation.cell.y * cellSize;

    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(x, y, cellSize, cellSize);

    ctx.fillStyle = "#111827";
    drawCenteredText(ctx, workstation.id, x, y, cellSize, cellSize);
  }

  for (const amr of scenario.amrs) {
    if (amr.goalCell) {
      const x = amr.goalCell.x * cellSize;
      const y = amr.goalCell.y * cellSize;

      ctx.strokeStyle = amr.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x + 3, y + 3, cellSize - 6, cellSize - 6);
      ctx.setLineDash([]);
    }
  }

  for (const amr of scenario.amrs) {
    const cx = amr.cell.x * cellSize + cellSize / 2;
    const cy = amr.cell.y * cellSize + cellSize / 2;

    ctx.fillStyle = amr.color;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(amr.id.replace("AMR_", "A"), cx, cy);
  }

  ctx.strokeStyle = "#1f3864";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, width, height);

  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);
  }, "image/png");
}
