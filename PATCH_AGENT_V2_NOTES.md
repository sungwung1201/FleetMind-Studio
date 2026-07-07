# AI Agent v2 Patch Notes

This patch improves the deployed demo without adding external LLM calls or API keys.

## Safety Policy

- No OpenAI/Gemini key is used.
- No `VITE_*_API_KEY` is introduced.
- No network call is required for command parsing.
- Existing editor, planner, reservation, arbiter, replay, dataset, and scenario features remain local-only.

## Added Agent Behaviors

The rule-based agent now understands richer fleet mission commands:

- Explicit robot route commands
  - `1번 로봇이 2번 갔다가 3번 가`
  - `AMR_02는 W1 먼저 갔다가 W3 가고 AMR_01은 W2 가`
- Rotation-style commands
  - `로테이션으로 1번은 W1, 2번은 W2, 3번은 W3 보내`
- Range commands
  - `W1부터 W3까지 가까운 AMR로 처리해`
- Exclusion commands
  - `W2 빼고 나머지 작업대 채워줘`
- JSON route commands
  - `{ "routes": [{ "amrId": "AMR_01", "waypoints": ["W2", "W3"] }] }`

## Planner Behavior

For route commands, each AMR can receive multiple waypoints. The planner creates a connected multi-segment Time A* path:

`current cell -> waypoint 1 -> waypoint 2 -> ...`

Reservation Table and Global Arbiter are still applied to the generated fleet plan.
