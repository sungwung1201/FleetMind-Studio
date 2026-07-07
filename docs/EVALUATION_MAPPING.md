# Evaluation Mapping

This document maps the project implementation to the submitted evaluation criteria.

## 1. Web Simulation Environment

| Requirement | Evidence |
|---|---|
| Web-based simulator | Vite + React + TypeScript application |
| 20x20 grid or larger | Scenario grid uses at least 20x20 cells |
| 3+ AMRs | Default and stress scenarios support 3+ AMRs |
| 3+ workstations | Default and stress scenarios support 3+ workstations |
| 5+ obstacles | Default scenario includes obstacles; editable in Studio |
| Browser execution | Runs with `npm run dev`, production build with `npm run build` |
| Deployment-ready | Can be deployed to Vercel, Netlify, or GitHub Pages |

## 2. Path Planning Algorithm

| Requirement | Evidence |
|---|---|
| Time-aware path planning | `src/core/timeAstar.ts` |
| Future cell occupancy | `ReservationTable.reserveCell()` |
| Edge reservation | `ReservationTable.reserveEdge()` |
| Edge swap prevention | `ReservationTable.isEdgeSwap()` and `GlobalArbiter` |
| Collision validation | `src/core/globalArbiter.ts` |
| Wait / detour handling | Planner logs and Plan Result Summary |
| Idle AMR occupancy | Idle AMR static reservation before planning |
| No-path safe failure | Static reachability fast-fail before Time A* search |
| Workstation footprint safety | Workstation `cell` and `footprint` synchronization |

## 3. AI Agent / Fleet Control

| Requirement | Evidence |
|---|---|
| Natural-language command | Agent command console |
| Structured JSON command | JSON route command support |
| AMR-task assignment | `runTaskAgent()` |
| Nearest assignment | Global nearest assignment strategy |
| Multi-route command | `AMR_02 -> W1 -> W3` route parsing |
| Route order optimization | Optimizes waypoint order when user asks for nearest/optimal order |
| Deterministic reasoning log | Agent Decisions and Agent Log panels |
| No external API key required | Rule-based deterministic agent for safe deployment |

## 4. Synthetic Data Extraction

| Requirement | Evidence |
|---|---|
| Episode JSON | `dataset/episodes/*.json` |
| Snapshot PNG | `dataset/snapshots/*.png` or exported PNG snapshots |
| Validation script | `dataset/validate.js` |
| Trajectory | `trajectory` field in each episode |
| Agent decision | `agent_decision` field |
| Reservation log | `reservation_log` field |
| Collision / edge-swap summary | Dataset summary fields |
| Success status | `success` field |

## 5. Studio UI / UX

| Requirement | Evidence |
|---|---|
| Object placement | Add AMR / Workstation / Wall / Goal |
| Drag editing | Select and drag objects |
| Delete editing | Delete mode supports repeated deletion |
| Scenario import/export | Scenario JSON export/import |
| Replay | Fleet replay controls |
| Agent console | Natural-language command panel |
| Health check | Scene Health Check integrated with validation |
| Result summary | Plan Result Summary line after planning |

## 6. Could Have

Selected option: **Advanced Natural Language Command**

Implemented:
- Explicit AMR assignment
- Multi-waypoint route command
- Route order optimization
- Strict order preservation for “먼저 / 갔다가 / 후에”
- JSON route command
- Deterministic no-key parser
