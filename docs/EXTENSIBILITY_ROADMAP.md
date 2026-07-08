# Extensibility Roadmap

FleetMind Studio is currently implemented as a 2D web-based AMR fleet planning studio. However, the system was designed around structured simulation data such as scenario layout, agent decisions, trajectories, reservation logs, validation results, replay data, and exported datasets. This makes the project extensible beyond a single web demo.

The long-term direction is to evolve from a browser-based simulator into a user-generated simulation data platform, 3D digital twin bridge, ROS2-connected fleet dashboard, and B2B AMR simulation SaaS.

---

## 1. User-Generated Scenario and Learning Data Platform

If FleetMind Studio is distributed to real users or enterprise customers, every user-created scenario can become a useful data asset.

Users can generate:

| User Action | Generated Data |
|---|---|
| Placing AMRs, workstations, obstacles, and goals | Scenario layout data |
| Entering natural-language commands | Command / intent dataset |
| Running the Agent | Agent decision dataset |
| Planning paths | Trajectory dataset |
| Avoiding conflicts | Reservation / conflict dataset |
| Creating blocked or failed cases | Failure-case dataset |
| Running replay | Time-series movement data |
| Exporting dataset | Structured synthetic episode data |

This allows the system to accumulate user-generated simulation data over time.

Potential uses:

- Improving AI Agent command interpretation
- Training AMR task allocation policies
- Learning bottleneck prediction models
- Learning collision-risk prediction models
- Recommending warehouse layout improvements
- Generating customer-specific PoC reports
- Building synthetic data for Physical AI pipelines

In a production version, anonymized telemetry could be collected with user consent. The data should focus on simulation structure and execution results rather than personal information.

Example telemetry fields:

- scenario_id
- grid_size
- object_count
- amr_count
- workstation_count
- obstacle_count
- command_type
- agent_assignment_result
- path_success
- path_failed
- collision_count
- edge_swap_prevented
- wait_steps
- detour_steps
- duration_ms
- replay_result

The key idea is that FleetMind Studio can become a user-generated simulation data platform, not only a simulator.

---

## 2. Synthetic Dataset Library and Marketplace

FleetMind Studio already exports structured episode datasets and PNG snapshots.

Current dataset structure:

- dataset/episodes/*.json
- dataset/snapshots/*.png
- validate.js

This can be expanded into a larger dataset library.

| Dataset Type | Description |
|---|---|
| Default fleet dataset | General AMR task allocation data |
| Edge swap dataset | Head-to-head edge conflict prevention data |
| Bottleneck dataset | Wait vs detour decision data |
| No-path dataset | Blocked target and failure-case data |
| Stress dataset | Multi-AMR scalability test data |
| User-generated dataset | Layouts, commands, and trajectories created by users |

Future uses:

- AMR fleet algorithm benchmark
- AI Agent task allocation training
- Collision avoidance policy learning
- Bottleneck analysis
- Layout optimization recommendation
- Customer PoC simulation reports

In the long term, this can become a fleet behavior benchmark library or AMR simulation dataset marketplace.

---

## 3. Isaac Sim, MuJoCo, and Gazebo Bridge

FleetMind Studio currently validates fleet logic in a 2D grid. The exported scenario and trajectory JSON can be used as an intermediate format for 3D and physics-based simulators.

### Isaac Sim Extension

Isaac Sim is suitable for warehouse-scale digital twin validation and sensor simulation.

Possible pipeline:

FleetMind Studio -> scenario JSON export -> AMR trajectory export -> Isaac Sim warehouse scene generation -> 3D AMR movement validation -> RGB / Depth / Segmentation synthetic data generation

Possible features:

- Convert 2D grid layouts into Isaac Sim warehouse scenes
- Generate 3D workstations, obstacles, and AMR models
- Replay FleetMind trajectories in 3D
- Generate synthetic sensor data
- Validate layouts before physical robot deployment

### MuJoCo Extension

MuJoCo is suitable for lightweight robot dynamics, control, and reinforcement learning experiments.

Possible pipeline:

FleetMind Studio -> high-level AMR route -> MuJoCo dynamics model -> path-following controller validation

Possible features:

- AMR base dynamics validation
- Controller tuning
- Mobile manipulator extension
- Reinforcement learning environment generation

### Gazebo / ROS2 Extension

Gazebo and ROS2 can connect the web planning layer to robot-oriented simulation and execution stacks.

Possible pipeline:

FleetMind Studio -> ROS2 Bridge -> Nav2 NavigateToPose -> Gazebo or real AMR execution -> AMR pose / battery / task status feedback

---

## 4. ROS2 / Nav2 Bridge

FleetMind Studio can be extended into a web-based ROS2 fleet dashboard.

Possible architecture:

Web UI -> Agent Task Allocation -> Route / Goal Generation -> ROS2 Bridge Server -> Nav2 Goal Publish -> AMR State Feedback -> Web Dashboard Update

Possible ROS2 interfaces:

- /fleet/tasks
- /fleet/amr_states
- /fleet/reservations
- /fleet/trajectories
- /fleet/agent_decisions
- /fleet/validation_result
- /nav2_goal

Possible applications:

- Gazebo simulation
- TurtleBot or custom AMR goal dispatch
- Real-time AMR status visualization
- Battery, pose, and task monitoring
- Web-based operator interface

---

## 5. 3D Digital Twin Viewer

A 3D viewer can be added with Three.js, React Three Fiber, or Babylon.js.

Possible features:

- Convert 2D grid into 3D warehouse floor
- Render AMR, workstation, obstacle, and goal objects
- Replay trajectories in 3D
- Support top-down and orbit camera views
- Provide customer-facing digital twin visualization

This was intentionally omitted from the current version because the planning core, Agent, validation, and dataset pipeline were prioritized first.

---

## 6. Optional LLM Tool-Calling Agent

The current Agent is deterministic and rule-based. This was chosen because the public demo can run without API keys and produces reproducible results.

A future backend-based LLM Agent could call tools such as:

- getSceneState()
- assignNearestAMR()
- createExplicitRoute()
- optimizeWaypointOrder()
- runTimeAStar()
- validateFleetPlan()
- exportDataset()
- explainDecision()

Possible pipeline:

User command -> LLM Agent -> tool call -> planning / validation -> fleet execution

This would improve complex natural-language handling while keeping API keys secure on the backend.

---

## 7. Dynamic Replanning and Recovery

The current version focuses mainly on pre-execution planning. Future versions can support online replanning.

Example:

Runtime obstacle added -> future reservation conflict detected -> path invalidation -> partial Time A* replan -> Reservation Table update -> replay continues

Possible features:

- Runtime obstacle insertion
- Partial replanning
- Deadlock detection
- Priority escalation
- Failed route recovery
- Task reassignment

This would evolve the project from a planning simulator into an online fleet orchestrator.

---

## 8. Algorithm Comparison Mode

The same scenario can be tested with multiple algorithms.

Possible algorithms:

- A*
- Time A*
- Time A* + Reservation Table
- Prioritized Planning
- CBS / MAPF
- RRT*
- Dijkstra

Possible metrics:

| Metric | Description |
|---|---|
| planning_time_ms | Path calculation time |
| total_distance | Total movement distance |
| wait_steps | Number of wait actions |
| detour_steps | Number of detour actions |
| collision_count | Number of collisions |
| edge_swap_count | Number of edge swaps |
| success_rate | Arrival success rate |
| dataset_size | Number of generated episodes |

This would make the project useful as an educational and benchmarking tool.

---

## 9. Analytics Dashboard

The dataset export pipeline can be expanded into an analytics dashboard.

Possible analytics:

- AMR utilization chart
- Workstation demand heatmap
- Bottleneck heatmap
- Conflict frequency map
- Wait vs detour statistics
- Success / failure ratio
- Average task duration
- Scenario comparison report

Example use case:

Customer uploads a warehouse layout -> runs AMR 3 / 5 / 10-unit simulations -> system detects bottlenecks and conflict risks -> system recommends AMR count and layout changes -> PoC report is generated

---

## 10. B2B SaaS Fleet Simulation Platform

In the long term, FleetMind Studio can evolve into a B2B SaaS simulation platform.

Possible SaaS features:

- User accounts
- Customer workspaces
- Project-based scenario storage
- Scenario version control
- Team collaboration
- Simulation history
- Dataset library
- Automated PoC reports
- Layout optimization recommendations
- API-based scenario submission

B2B use case:

A logistics center uploads its current layout -> compares AMR 5 / 10 / 20 deployment plans -> analyzes bottlenecks and collision risks -> receives optimal fleet size and layout recommendation -> exports a PoC report

---

## Summary

FleetMind Studio can be expanded in five stages:

### Stage 1 — Current Version

- 2D Web Fleet Planning Studio
- AMR layout editing
- AI-style task assignment
- Time A* planning
- Reservation Table
- Global Arbiter
- Replay
- Dataset export

### Stage 2 — Data Platform

- User-generated scenarios
- Synthetic episode datasets
- Dataset viewer
- Analytics dashboard
- Benchmark library

### Stage 3 — Simulation Bridge

- Three.js / React Three Fiber 3D viewer
- Isaac Sim bridge
- MuJoCo dynamics validation
- Gazebo / ROS2 bridge

### Stage 4 — Intelligent Orchestration

- LLM tool-calling Agent
- Dynamic replanning
- Failure recovery
- Algorithm comparison mode

### Stage 5 — SaaS Product

- Customer workspace
- Scenario versioning
- Fleet simulation reports
- PoC automation
- Synthetic data marketplace

The key design decision is that FleetMind Studio stores simulation results as structured data. Because scenario, command, assignment, trajectory, reservation, validation, replay, and dataset outputs are separated, the system can grow into a larger Physical AI simulation and data platform.
