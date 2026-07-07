# Scoring Evidence Map

## 제출 전 필수 확인

```bash
npm run build
npm run lint
npm run validate
```

## 기능별 증거 위치

| 기능 | 코드 | UI 확인 | 데이터 증거 |
|---|---|---|---|
| Natural Language Agent | `src/core/taskAgent.ts` | Agent Console | `dataset/episodes/default_episode.json` |
| Time A* | `src/core/timeAstar.ts` | Plan Only Log | 모든 episode trajectory |
| Reservation Table | `src/core/reservationTable.ts` | Reservation Log | `reservation_log` field |
| Edge Swap Prevention | `src/core/globalArbiter.ts` | Edge Swap Scenario | `edge_swap_episode.json` |
| Wait vs Detour | `src/core/pathCost.ts` | Bottleneck Scenario | `bottleneck_episode.json` |
| No Path Handling | `src/scenarios/noPathScenario.ts` | No Path Scenario | `no_path_episode.json` |
| Dataset Export | `src/dataset/episodeLogger.ts` | Dataset > Export | `dataset/episodes/*.json` |
| PNG Snapshot | `src/dataset/snapshotExporter.ts` | Dataset > PNG | `dataset/snapshots/*.png` |

## 시나리오별 기대 관찰점

### Default Fleet Scenario

- 자연어 명령이 W1~W3를 파싱한다.
- AMR_01~AMR_03에 목표가 배정된다.
- Time A* path가 생성된다.
- Arbiter가 승인한다.

### Edge Swap Prevention Scenario

- AMR이 마주보는 형태로 배치된다.
- Reservation Table이 edge reservation을 만든다.
- Global Arbiter 로그에서 edge swap count가 0으로 유지된다.

### Bottleneck Wait vs Detour Scenario

- 좁은 통로 때문에 wait 또는 detour 판단 로그가 발생한다.
- Reservation Log가 시간차 통과를 보여준다.

### No Path / Blocked Target Scenario

- W1 주변이 장애물로 막혀 있다.
- 실패 상황을 Planner Log로 설명할 수 있다.
- 나머지 가능한 AMR은 정상 계획될 수 있다.
