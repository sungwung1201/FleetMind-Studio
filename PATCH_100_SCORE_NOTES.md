# 100 Score Readiness Patch

This patch does not touch App interaction logic, Add/Delete/Goal/Wall behavior, Agent execution, Planner, Reservation Table, or Replay controls.

Changed/added only submission evidence and scenario documentation:

- Expanded `README.md` with rubric mapping, architecture, demo flow, scenario evidence, and checklist.
- Added `docs/DEMO_SCRIPT.md`.
- Added `docs/SCORING_EVIDENCE.md`.
- Added `src/scenarios/noPathScenario.ts` and registered it in `src/scenarios/index.ts`.
- Added evidence datasets:
  - `dataset/episodes/default_episode.json`
  - `dataset/episodes/edge_swap_episode.json`
  - `dataset/episodes/bottleneck_episode.json`
  - `dataset/episodes/no_path_episode.json`
  - refreshed `dataset/episodes/sample_episode.json`
- Added evidence snapshots:
  - `dataset/snapshots/default_snapshot.png`
  - `dataset/snapshots/edge_swap_snapshot.png`
  - `dataset/snapshots/bottleneck_snapshot.png`
  - `dataset/snapshots/no_path_snapshot.png`

Validation result:

```text
npm run build     PASS
npm run lint      PASS
npm run validate  PASS
```
