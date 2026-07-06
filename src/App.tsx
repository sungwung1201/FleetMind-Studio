import { useMemo, useState } from "react";
import "./App.css";
import type { Scenario } from "./core/types";
import { defaultScenario } from "./scenarios/defaultScenario";
import { GridCanvas } from "./ui/GridCanvas";

function cloneScenario(scenario: Scenario): Scenario {
  return structuredClone(scenario);
}

function App() {
  const initialScenario = useMemo(() => cloneScenario(defaultScenario), []);
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [isRunning, setIsRunning] = useState(false);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setScenario(cloneScenario(defaultScenario));
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">VISIONSPACE TESSERACT Assignment</p>
          <h1>Robot Fleet Web Studio</h1>
          <p className="subtitle">
            Web-based AMR fleet simulation with Time A*, Reservation Table,
            Global Arbiter, and synthetic episode export.
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
            <button onClick={handleStart}>Start</button>
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
            </ul>
          </div>

          <div className="info-block">
            <h3>Next Implementation</h3>
            <ol>
              <li>Single AMR A*</li>
              <li>Time A* with WAIT action</li>
              <li>Reservation Table</li>
              <li>Global Arbiter</li>
              <li>Episode JSON export</li>
            </ol>
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
