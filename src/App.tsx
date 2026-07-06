import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { AMR, Scenario } from "./core/types";
import { getBlockedCellKeys, sameCell } from "./core/grid";
import { ReservationTable } from "./core/reservationTable";
import { findPathTimeAStar } from "./core/timeAstar";
import { defaultScenario } from "./scenarios/defaultScenario";
import { GridCanvas } from "./ui/GridCanvas";

function cloneScenario(scenario: Scenario): Scenario {
  return structuredClone(scenario);
}

function getLastPathTick(amrs: AMR[]): number {
  let maxTick = 0;

  for (const amr of amrs) {
    if (amr.path.length === 0) {
      continue;
    }

    const lastCell = amr.path[amr.path.length - 1];
    maxTick = Math.max(maxTick, lastCell.t);
  }

  return maxTick;
}

function App() {
  const initialScenario = useMemo(() => cloneScenario(defaultScenario), []);
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [systemLog, setSystemLog] = useState<string[]>([
    "System initialized.",
    "Ready to plan Time A* paths for AMR fleet.",
  ]);
  const [reservationLog, setReservationLog] = useState<string[]>([]);

  const appendLog = (message: string) => {
    setSystemLog((prev) => {
      const next = [`[t=${currentTick}] ${message}`, ...prev];
      return next.slice(0, 16);
    });
  };

  const planFleetPaths = (sourceScenario: Scenario) => {
    const nextScenario = cloneScenario(sourceScenario);
    const reservationTable = new ReservationTable();
    const blockedCells = getBlockedCellKeys(nextScenario);
    const logs: string[] = [];

    for (const amr of nextScenario.amrs) {
      if (!amr.goalCell) {
        amr.status = "FAILED";
        logs.push(`${amr.id}: failed because goal cell is missing.`);
        continue;
      }

      const path = findPathTimeAStar({
        width: nextScenario.width,
        height: nextScenario.height,
        start: amr.startCell,
        goal: amr.goalCell,
        blockedCells,
        reservationTable,
        amrId: amr.id,
        maxTime: 160,
      });

      if (path.length === 0) {
        amr.path = [];
        amr.status = "FAILED";
        logs.push(`${amr.id}: Time A* failed. no path found.`);
        continue;
      }

      amr.cell = { ...amr.startCell };
      amr.path = path;
      amr.status = "MOVING";

      reservationTable.reservePath(amr.id, path, 30);

      const waitSteps = path.filter((cell, index) => {
        if (index === 0) {
          return false;
        }
        return sameCell(cell, path[index - 1]);
      }).length;

      logs.push(
        `${amr.id}: Time A* planned. path_length=${path.length}, wait_steps=${waitSteps}, arrival_t=${path[path.length - 1].t}`
      );
    }

    return {
      scenario: nextScenario,
      planningLogs: logs,
      reservationLogs: reservationTable.getSummaryLines(32),
    };
  };

  const handleStart = () => {
    const alreadyPlanned = scenario.amrs.some((amr) => amr.path.length > 0);

    if (!alreadyPlanned) {
      const result = planFleetPaths(scenario);
      const plannedCount = result.scenario.amrs.filter((amr) => amr.path.length > 0).length;

      setCurrentTick(0);
      setScenario(result.scenario);
      setReservationLog(result.reservationLogs);
      setSystemLog((prev) => [
        "[t=0] Fleet Time A* planning completed.",
        ...result.planningLogs.map((log) => `[t=0] ${log}`),
        ...prev,
      ].slice(0, 16));

      if (plannedCount === 0) {
        setIsRunning(false);
        return;
      }
    }

    setIsRunning(true);
    appendLog("Fleet execution started.");
  };

  const handlePause = () => {
    setIsRunning(false);
    appendLog("Fleet execution paused.");
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentTick(0);
    setScenario(cloneScenario(defaultScenario));
    setReservationLog([]);
    setSystemLog([
      "System reset.",
      "Ready to plan Time A* paths for AMR fleet.",
    ]);
  };

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentTick((prevTick) => {
        const nextTick = prevTick + 1;
        const tickLogs: string[] = [];
        let shouldStop = false;

        setScenario((prevScenario) => {
          const nextScenario = cloneScenario(prevScenario);
          const maxTick = getLastPathTick(nextScenario.amrs);

          for (const amr of nextScenario.amrs) {
            if (amr.path.length === 0 || amr.status === "FAILED") {
              continue;
            }

            const lastCell = amr.path[amr.path.length - 1];
            const pathCell = amr.path.find((cell) => cell.t === nextTick);
            const prevPathCell = amr.path.find((cell) => cell.t === nextTick - 1);
            const wasDone = amr.status === "DONE";

            if (pathCell) {
              amr.cell = {
                x: pathCell.x,
                y: pathCell.y,
              };

              if (prevPathCell && sameCell(pathCell, prevPathCell)) {
                amr.status = "WAITING";
              } else {
                amr.status = "MOVING";
              }
            }

            if (nextTick >= lastCell.t) {
              amr.cell = {
                x: lastCell.x,
                y: lastCell.y,
              };
              amr.status = "DONE";

              if (!wasDone) {
                tickLogs.push(`${amr.id} reached goal. arrival_t=${lastCell.t}`);
              }
            }
          }

          if (nextTick >= maxTick) {
            shouldStop = true;
          }

          return nextScenario;
        });

        if (tickLogs.length > 0 || shouldStop) {
          setSystemLog((prev) => [
            ...tickLogs.map((log) => `[t=${nextTick}] ${log}`),
            ...(shouldStop ? [`[t=${nextTick}] Fleet execution completed.`] : []),
            ...prev,
          ].slice(0, 16));
        }

        if (shouldStop) {
          setIsRunning(false);
        }

        return nextTick;
      });
    }, 220);

    return () => {
      window.clearInterval(timer);
    };
  }, [isRunning]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">VISIONSPACE TESSERACT Assignment</p>
          <h1>Robot Fleet Web Studio</h1>
          <p className="subtitle">
            Step 3: Multi-AMR Time A* planning with Reservation Table based
            cell and edge reservation.
          </p>
        </div>

        <div className="status-card">
          <span className={isRunning ? "status-dot running" : "status-dot"} />
          <div>
            <p className="status-label">Simulation Status</p>
            <strong>{isRunning ? "RUNNING" : "IDLE"}</strong>
          </div>
        </div>
      </section>

      <section className="layout">
        <aside className="panel">
          <h2>Control Panel</h2>

          <div className="button-row">
            <button onClick={handleStart}>Start Fleet</button>
            <button onClick={handlePause}>Pause</button>
            <button onClick={handleReset}>Reset</button>
          </div>

          <div className="info-block">
            <h3>Scenario</h3>
            <p>{scenario.name}</p>
            <ul>
              <li>Grid: {scenario.width} x {scenario.height}</li>
              <li>AMRs: {scenario.amrs.length}</li>
              <li>Workstations: {scenario.workstations.length}</li>
              <li>Obstacles: {scenario.obstacles.length}</li>
              <li>Tick: {currentTick}</li>
            </ul>
          </div>

          <div className="info-block">
            <h3>AMR Fleet State</h3>
            <div className="fleet-table">
              {scenario.amrs.map((amr) => (
                <div className="fleet-row" key={amr.id}>
                  <span className="fleet-color" style={{ backgroundColor: amr.color }} />
                  <div>
                    <strong>{amr.id}</strong>
                    <p>
                      {amr.status} · cell=[{amr.cell.x}, {amr.cell.y}] · path=
                      {amr.path.length}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="info-block">
            <h3>System Log</h3>
            <div className="log-box">
              {systemLog.map((log, index) => (
                <p key={`${log}-${index}`}>{log}</p>
              ))}
            </div>
          </div>

          <div className="info-block">
            <h3>Reservation Log</h3>
            <div className="log-box reservation-log">
              {reservationLog.length === 0 ? (
                <p>No reservation yet.</p>
              ) : (
                reservationLog.map((log, index) => (
                  <p key={`${log}-${index}`}>{log}</p>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="simulation-area">
          <GridCanvas scenario={scenario} />
        </section>
      </section>
    </main>
  );
}

export default App;
