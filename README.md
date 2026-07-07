# Robot Fleet Web Studio

VISIONSPACE TESSERACT 과제용 웹 기반 AMR Fleet 시뮬레이션 스튜디오다. 20x20 이상 Grid에서 다중 AMR, Workstation, Obstacle을 편집하고 자연어/JSON 명령으로 작업을 배정한 뒤 Time A*, Reservation Table, Global Arbiter 기반으로 경로를 생성·검증·재생한다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 Vite가 출력하는 `http://localhost:5173/` 주소를 연다.

## 검증 명령

```bash
npm run build
npm run lint
npm run validate
```

`npm run validate`는 `dataset/episodes/*.json` 샘플 데이터셋을 검사한다.

## 주요 기능

| 구분 | 구현 내용 |
|---|---|
| Grid Studio | 20x20 이상 Grid, AMR/Workstation/Obstacle/Goal 시각화 |
| Edit | Select, Delete, Add 모드 |
| Build | AMR, Workstation, Goal, Wall 추가 |
| Drag Add/Delete | 좌클릭을 누른 상태로 지나가는 셀에 연속 추가/삭제 |
| Agent | 자연어/JSON 명령 파싱 및 작업 배정 |
| Planner | Time A* 기반 시간축 경로 탐색 |
| Reservation | Cell/Edge 예약, Edge Swap 차단 |
| Arbiter | 충돌, blocked cell, out-of-bounds, edge swap 검증 |
| Replay | 생성된 path를 tick 단위로 재생 |
| Dataset | Episode JSON export, PNG snapshot export, validation |
| Scenario | Scenario export/import, 기본/edge swap/bottleneck 시나리오 |

## 사용 예시

Agent 입력창에 다음처럼 입력한다.

```text
모든 작업대를 가장 가까운 AMR로 채워줘
```

또는 JSON으로 입력한다.

```json
{
  "fill": ["W1", "W2", "W3"],
  "priority": "nearest"
}
```

이후 `Plan Only`를 누르면 Agent 배정, Time A* 경로, Reservation Table, Global Arbiter 로그가 생성된다. `Play` 또는 `Start Fleet`를 누르면 AMR들이 경로를 따라 움직인다.

## 코드 구조

```text
src/App.tsx                         전체 화면/툴바/실행 흐름
src/ui/GridCanvas.tsx               Grid 렌더링 및 편집 인터랙션
src/ui/AgentDrawer.tsx              Agent 패널
src/ui/SceneTreeInspector.tsx       Scene/Inspector 패널
src/core/taskAgent.ts               자연어/JSON 파싱 및 AMR-Workstation 배정
src/core/timeAstar.ts               Time A* 경로 탐색
src/core/reservationTable.ts        Cell/Edge Reservation Table
src/core/globalArbiter.ts           Fleet plan 검증
src/core/pathCost.ts                Wait vs Detour 비용 로그
src/dataset/episodeLogger.ts        Dataset JSON 생성/검증
src/dataset/snapshotExporter.ts     PNG snapshot 생성
src/scenarios/scenarioIO.ts         Scenario export/import
```

## 제출 체크리스트

- [x] 20x20 이상 Grid
- [x] AMR 3대 이상
- [x] Workstation 3개 이상
- [x] Obstacle 5개 이상
- [x] 자연어/JSON Agent 명령
- [x] Time A*
- [x] Reservation Table
- [x] Edge swap 차단
- [x] Global Arbiter
- [x] Replay
- [x] Dataset JSON export
- [x] PNG snapshot export
- [x] validate script 및 샘플 dataset
