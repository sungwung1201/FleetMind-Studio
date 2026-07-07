import type { AgentDecision } from "../core/types";

type AgentDrawerProps = {
  isOpen: boolean;
  commandInput: string;
  setCommandInput: (value: string) => void;
  agentDecisions: AgentDecision[];
  agentLog: string[];
  onPlanOnly: () => void;
  onStart: () => void;
  onClose: () => void;
};

export function AgentDrawer({
  isOpen,
  commandInput,
  setCommandInput,
  agentDecisions,
  agentLog,
  onPlanOnly,
  onStart,
  onClose,
}: AgentDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="agent-drawer-layer">
      <div className="agent-drawer-backdrop" onClick={onClose} />

      <aside className="agent-drawer" aria-label="AI Agent drawer">
        <header className="agent-drawer-header">
          <div>
            <p>Persistent AI Agent</p>
            <h2>Agent Control</h2>
          </div>

          <button className="drawer-close-button" onClick={onClose}>
            Close
          </button>
        </header>

        <section className="agent-drawer-body">
          <div className="drawer-card">
            <h3>Command</h3>
            <textarea
              value={commandInput}
              onChange={(event) => setCommandInput(event.target.value)}
              spellCheck={false}
            />

            <div className="drawer-quick-row">
              <button
                className="secondary-button"
                onClick={() =>
                  setCommandInput("모든 작업대를 가장 가까운 AMR로 채워줘")
                }
              >
                Fill All by Nearest
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  setCommandInput("작업대 3 먼저 채우고 작업대 1도 처리해")
                }
              >
                Priority W3 → W1
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  setCommandInput(
                    JSON.stringify(
                      { fill: ["W1", "W2", "W3"], priority: "nearest" },
                      null,
                      2
                    )
                  )
                }
              >
                JSON Nearest
              </button>
            </div>
          </div>

          <div className="drawer-card">
            <h3>Fast Execute</h3>
            <div className="drawer-execute-row">
              <button onClick={onPlanOnly}>Plan Only</button>
              <button className="primary-action" onClick={onStart}>
                Start Fleet
              </button>
            </div>
          </div>

          <div className="drawer-card">
            <h3>Agent Decisions</h3>
            <div className="drawer-decision-list">
              {agentDecisions.length === 0 ? (
                <p className="muted-text">No decision yet.</p>
              ) : (
                agentDecisions.map((decision) => (
                  <div className="decision-card" key={decision.taskId}>
                    <strong>
                      {decision.taskId}: {decision.amrId} → {decision.targetId}
                    </strong>
                    <p>
                      reason={decision.reason}, distance={decision.distance},
                      priority={decision.priority}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="drawer-card">
            <h3>Agent Log</h3>
            <div className="log-box drawer-agent-log">
              {agentLog.map((log, index) => (
                <p key={`${log}-${index}`}>{log}</p>
              ))}
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
