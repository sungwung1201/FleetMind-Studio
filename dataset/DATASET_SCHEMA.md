# Dataset Schema

The simulator exports synthetic episode data for AMR fleet planning.

## Episode Dataset

| Field | Description |
|---|---|
| dataset_id | Unique dataset export identifier |
| generated_at | Export timestamp |
| assignment | Assignment method or scenario label |
| scenario_id | Scenario identifier |
| scenario_name | Scenario display name |
| summary | Aggregated result summary |
| episodes | List of AMR-level episode records |

## Summary Fields

| Field | Description |
|---|---|
| amr_count | Number of AMRs in the scenario |
| episode_count | Number of AMR episodes |
| success_count | Number of successful AMR episodes |
| total_collisions_detected | Collision count detected by the arbiter |
| total_edge_swaps_detected | Edge swap count detected by the arbiter |
| checked_ticks | Number of ticks checked by the arbiter |

## Episode Fields

| Field | Description |
|---|---|
| episode_id | Unique AMR episode ID |
| scenario_id | Scenario ID |
| scenario_name | Scenario name |
| amr_id | AMR ID |
| task | Task type: PICKUP, MOVE, DROP, WAIT |
| agent_decision | Agent assignment decision |
| start_cell | AMR start cell |
| goal_cell | AMR goal cell |
| trajectory | Time-indexed AMR path |
| reservation_log | Cell and edge reservation evidence |
| collisions_avoided | Number of avoided or detected conflicts |
| duration_ms | Simulated or measured duration |
| success | Whether the episode succeeded |

## Trajectory Step

| Field | Description |
|---|---|
| t | Time tick |
| cell | `[x, y]` grid coordinate |
| status | AMR status at that tick |

## Validation

```bash
npm run validate
```

Expected result:

```text
PASS
```
