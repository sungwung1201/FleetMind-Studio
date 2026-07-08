# Engineering Decisions

FleetMind Studio was developed with a priority on completing a reliable end-to-end AMR fleet simulation pipeline rather than attempting every possible extension.

The assignment emphasized approach, prioritization, and reasoning. Therefore, the implementation focused first on the Must-Have path: web simulation, Time A* planning, reservation-based collision prevention, AI-style task assignment, replay, and dataset export.

## 1. Priority Strategy

The implementation priority was:

1. Build a working browser-based AMR simulation environment
2. Implement Time A* path planning with time-indexed cell occupancy
3. Add Reservation Table support for cell and edge reservations
4. Add Global Arbiter validation for cell collision, edge swap, and blocked-cell violation
5. Implement deterministic AI-style task assignment
6. Add replay and dataset export
7. Add Studio UI features after the planning pipeline was stable

This order was chosen because a polished UI without a reliable planning core would not demonstrate the core value of a fleet simulation engine.

## 2. What Was Prioritized

### Path Planning Core

The first priority was the planning and safety stack:

- Time A*
- Reservation Table
- Edge reservation
- Edge swap prevention
- Global Arbiter
- No-path fast-fail
- Idle AMR static reservation
- Workstation footprint synchronization

These decisions directly target multi-AMR fleet safety. A simple A* implementation would not be enough because simultaneous AMR movement can create future cell conflicts and edge-swap conflicts.

### Deterministic AI Agent

The Agent was implemented as a deterministic rule-based command interpreter instead of using an external LLM API.

Reason:

- The public demo can run without API keys
- The same command produces the same result
- Evaluation is reproducible
- There is no risk of exposing private API credentials in the frontend

The Agent supports:

- Natural-language commands
- JSON commands
- nearest assignment
- explicit AMR assignment
- multi-waypoint route commands
- route order optimization
- decision logs

### Dataset Export

Synthetic data was treated as a first-class output, not as an afterthought.

The dataset includes:

- episode_id
- amr_id
- task
- agent_decision
- start_cell / goal_cell
- trajectory
- reservation_log
- duration_ms
- success

This reflects the idea that simulation output can become reusable data for fleet analysis, reporting, and future Physical AI pipelines.

## 3. What Was Intentionally Omitted

### Full 3D Renderer

Three.js / R3F / WebGL rendering was not implemented in this version.

Reason:

The assignment's core value was Path Planning + AI Agent + Synthetic Data. A 3D renderer would improve presentation, but it would also increase implementation risk within the time limit. The project instead focuses on a clear 2D grid simulation where AMR movement, reservations, conflicts, and logs are easy to inspect.

### Claude API Tool-Calling Agent

Claude API tool-calling was considered but not used in the deployed frontend.

Reason:

The goal was to create a reproducible and safe public demo. A frontend API-key integration would introduce security risk and external dependency. The current deterministic Agent keeps the system testable without network calls.

### Full Optimal MAPF Solver

The planner uses prioritized multi-agent planning rather than a globally optimal MAPF solver.

Reason:

The goal was to demonstrate practical fleet coordination with Time A*, Reservation Table, and Global Arbiter. Full MAPF optimization would increase complexity and could reduce completion reliability. The current approach is easier to explain, debug, validate, and extend.

### ROS2 Bridge

ROS2 integration was not included in the submitted version.

Reason:

The project is scoped as a browser-based simulation and dataset generation studio. ROS2 Bridge is a valuable extension, but it is outside the minimum end-to-end web simulation requirement.

### Physical Robot Deployment

The system does not control real AMRs.

Reason:

This version focuses on web-based simulation, path planning validation, and synthetic data extraction. Physical deployment would require hardware-specific safety layers and runtime integration.

## 4. Problems Found and Fixed

During development, several realistic fleet-planning issues were found and fixed:

1. Workstation movement updated the visible cell but not the footprint
   - Fixed by synchronizing workstation cell and footprint

2. Idle AMRs were not reserved as occupied cells
   - Fixed by reserving idle AMR positions over the planning horizon

3. Blocked targets could cause expensive Time A* search
   - Fixed by adding static reachability fast-fail before Time A*

4. Multi-route path cost was computed against only the final goal
   - Fixed by computing route-aware shortest distance across waypoints

5. AMR icons visually overlapped in adjacent cells
   - Fixed by reducing AMR visual size without changing safety logic

These fixes show that the implementation was tested against edge cases instead of only the default scenario.

## 5. Current Limitations

Current limitations are documented intentionally:

- The planner is not globally optimal MAPF
- The Agent is deterministic rule-based, not live LLM tool-calling
- The simulation is 2D, not full 3D
- Dynamic re-planning during replay is limited
- Physical robot integration is not included

These are scope decisions rather than hidden failures.

## 6. Future Extensions

Recommended next steps:

1. Add a 3D digital twin viewer with Three.js or R3F
2. Add optional backend LLM tool-calling mode
3. Add A* vs Time A* vs MAPF comparison mode
4. Add ROS2 Bridge for real robot command streaming
5. Add scenario analytics dashboard for bottleneck and utilization analysis
6. Add user-generated scenario library and dataset marketplace model

## 7. Summary

The main design choice was to complete a reliable, inspectable, and deployable fleet planning pipeline.

The implementation prioritizes:

- correctness over visual complexity
- reproducibility over API dependency
- explainability over black-box behavior
- end-to-end completion over isolated features

This matches the goal of demonstrating how a path-planning algorithm and AI-style fleet agent can be ported into a web-based simulation studio.
