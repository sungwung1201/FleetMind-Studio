# Known Limitations

This project focuses on web-based AMR fleet planning, explainable task assignment, reservation-based collision prevention, replay, and synthetic dataset generation.

## Limitations

1. The AI Agent is deterministic and rule-based.
   - This avoids exposing external GPT/Gemini API keys in the frontend.
   - It also makes the demo reproducible.

2. The planner uses prioritized multi-agent planning.
   - It is not a full globally optimal MAPF solver.
   - In dense scenes, later AMRs may fail if all safe paths are blocked.

3. Safety is grid-based.
   - The arbiter checks cell collision, edge swap, and blocked-cell violation.
   - Continuous physical robot radius simulation is not included.

4. No 3D renderer is included.
   - The project focuses on Path Planning, AI Agent, Studio UI, and Synthetic Data.

5. Dynamic re-planning during replay is limited.
   - Planning is primarily performed before execution.
   - Failed route segments are reported safely instead of forcing invalid motion.

## Why These Choices Were Made

The assignment prioritizes a working web simulator, Time A* path planning, reservation table safety, AI-style task assignment, and synthetic data export. The implementation focuses on deterministic, reproducible behavior that can be reviewed without requiring API keys, backend services, or robotics hardware.
