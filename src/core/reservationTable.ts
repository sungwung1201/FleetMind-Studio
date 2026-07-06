import type { Cell, TimedCell } from "./types";

export type ReservationRecord = {
  amrId: string;
  reason: string;
};

export type ReservationEvent = {
  type: "CELL" | "EDGE";
  amrId: string;
  key: string;
  t: number;
};

function cellReservationKey(cell: Cell, t: number): string {
  return `${cell.x},${cell.y},${t}`;
}

function edgeReservationKey(from: Cell, to: Cell, t: number): string {
  return `${from.x},${from.y}->${to.x},${to.y},${t}`;
}

export class ReservationTable {
  private cellReservations = new Map<string, ReservationRecord>();
  private edgeReservations = new Map<string, ReservationRecord>();
  private events: ReservationEvent[] = [];

  isCellReserved(cell: Cell, t: number, requesterAmrId?: string): boolean {
    const record = this.cellReservations.get(cellReservationKey(cell, t));
    if (!record) {
      return false;
    }

    return record.amrId !== requesterAmrId;
  }

  isEdgeReserved(from: Cell, to: Cell, t: number, requesterAmrId?: string): boolean {
    const record = this.edgeReservations.get(edgeReservationKey(from, to, t));
    if (!record) {
      return false;
    }

    return record.amrId !== requesterAmrId;
  }

  isEdgeSwap(from: Cell, to: Cell, t: number, requesterAmrId?: string): boolean {
    const reverseRecord = this.edgeReservations.get(edgeReservationKey(to, from, t));
    if (!reverseRecord) {
      return false;
    }

    return reverseRecord.amrId !== requesterAmrId;
  }

  reserveCell(amrId: string, cell: Cell, t: number, reason = "path_cell"): void {
    const key = cellReservationKey(cell, t);

    this.cellReservations.set(key, {
      amrId,
      reason,
    });

    this.events.push({
      type: "CELL",
      amrId,
      key,
      t,
    });
  }

  reserveEdge(amrId: string, from: Cell, to: Cell, t: number, reason = "path_edge"): void {
    const key = edgeReservationKey(from, to, t);

    this.edgeReservations.set(key, {
      amrId,
      reason,
    });

    this.events.push({
      type: "EDGE",
      amrId,
      key,
      t,
    });
  }

  reservePath(amrId: string, path: TimedCell[], holdExtraTicks = 20): void {
    if (path.length === 0) {
      return;
    }

    for (const cell of path) {
      this.reserveCell(amrId, cell, cell.t);
    }

    for (let i = 1; i < path.length; i += 1) {
      const from = path[i - 1];
      const to = path[i];
      this.reserveEdge(amrId, from, to, to.t);
    }

    const lastCell = path[path.length - 1];
    for (let t = lastCell.t + 1; t <= lastCell.t + holdExtraTicks; t += 1) {
      this.reserveCell(amrId, lastCell, t, "goal_hold");
    }
  }

  getEvents(): ReservationEvent[] {
    return [...this.events];
  }

  getSummaryLines(limit = 24): string[] {
    return this.events
      .slice(-limit)
      .reverse()
      .map((event) => {
        return `${event.type} ${event.key} by ${event.amrId}`;
      });
  }
}
