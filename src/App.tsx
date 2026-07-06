import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { AMR, Scenario } from "./core/types";
import { getBlockedCellKeys, sameCell } from "./core/grid";
import { ReservationTable } from "./core/reservationTable";
import { findPathTimeAStar } from "./core/timeAstar";
import { validateFleetPlan, type ArbiterReport } from "./core/globalArbiter";
import { defaultScenario } from "./scenarios/defaultScenario";
import { getScenarioById, scenarioList } from "./scenarios";
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

function getEmptyArbiterReport(): ArbiterReport {
  return {
    approved: false,
    checkedTicks: 0,
    cellCollisionCount: 0,
    edgeSwapCount: 0,
    blockedCellCount: 0,
    outOfBoundsCount: 0,
    messages: ["No Global Arbiter validation yet."],
  };
}

function App() {
  const initialScenario = useMemo(() => cloneScenario(defaultScenario), []);
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultScenario.id);
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [systemLog, setSystemLog] = useState<string[]>([
    "System initialized.",
    "Ready to plan Time A* paths for AMR fleet.",
  ]);
  const [reservationLog, setReservationLog] = useState<string[]>([]);
  const [arbiterReport, setArbiterReport] = useState<ArbiterReport>(
    getEmptyArbiterReport()
  );

  const appendLog = (message: string) => {
    setSystemLog((prev) => {
      const next = [`[t=${currentTick}] ${message}`, ...prev];
      return next.slice(0, 16);
    });
  };

  const resetToScenario = (scenarioId: string) => {
    const nextBaseScenario = getScenarioById(scenarioId);
    setSelectedScenarioId(scenarioId);
    setIsRunning(false);
    setCurrentTick(0);
    setScenario(cloneScenario(nextBaseScenario));
    setReservationLog([]);
    setArbiterReport(getEmptyArbiterReport());
    setSystemLog([
      `Scenario loaded: ${nextBaseScenario.name}`,
      "Ready to plan Time A* paths for AMR fleet.",
    ]);
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

    const report = validateFleetPlan(nextScenario);

    return {
      scenario: nextScenario,
      planningLogs: logs,
      reservationLogs: reservationTable.getSummaryLines(32),
      arbiterReport: report,
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
      setArbiterReport(result.arbiterReport);
      setSystemLog((prev) => [
        "[t=0] Fleet Time A* planning completed.",
        `[t=0] Global Arbiter result: ${
          result.arbiterReport.approved ? "APPROVED" : "REJECTED"
        }`,
        ...result.planningLogs.map((log) => `[t=0] ${log}`),
        ...prev,
      ].slice(0, 16));

      if (plannedCount === 0 || !result.arbiterReport.approved) {
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
    resetToScenario(selectedScenarioId);
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
            Step 4: Scenario switching, Edge Swap test, Bottleneck test, and
            Global Arbiter validation report.
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

          <label className="scenario-label" htmlFor="scenario-select">
            Scenario
          </label>
          <select
            id="scenario-select"
            className="scenario-select"
            value={selectedScenarioId}
            onChange={(event) => resetToScenario(event.target.value)}
          >
            {scenarioList.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>

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
            <h3>Global Arbiter</h3>
            <div
              className={
                arbiterReport.approved
                  ? "arbiter-card approved"
                  : "arbiter-card rejected"
              }
            >
              <strong>{arbiterReport.approved ? "APPROVED" : "NOT APPROVED YET"}</strong>
              <ul>
                <li>Checked ticks: {arbiterReport.checkedTicks}</li>
                <li>Cell collisions: {arbiterReport.cellCollisionCount}</li>
                <li>Edge swaps: {arbiterReport.edgeSwapCount}</li>
                <li>Blocked cells: {arbiterReport.blockedCellCount}</li>
                <li>Out of bounds: {arbiterReport.outOfBoundsCount}</li>
              </ul>
            </div>
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
            <h3>Arbiter Log</h3>
            <div className="log-box arbiter-log">
              {arbiterReport.messages.map((log, index) => (
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
