# Demo Script

목표 시간: 1분 40초 ~ 2분

## 0:00~0:15 프로젝트 개요

멘트:

> 이 프로젝트는 20x20 이상 Grid 환경에서 여러 AMR을 동시에 배정하고 충돌 없이 이동시키는 웹 기반 Fleet Simulation Studio입니다. 사용자는 직접 AMR, Workstation, Goal, Wall을 편집할 수 있고, 자연어 명령으로 작업을 자동 배정할 수 있습니다.

화면:

- 전체 UI
- 좌측 Scenario
- 중앙 Grid
- 우측 Agent / Scene / Inspector

## 0:15~0:35 Studio 편집 기능

시연:

1. `Edit > Add`
2. `Build > AMR`
3. Grid 위를 좌클릭 드래그하여 AMR 연속 추가
4. `Build > Wall`
5. 장애물 연속 추가
6. `Edit > Delete`
7. 좌클릭 드래그로 일부 객체 삭제

멘트:

> Add와 Delete는 단일 클릭뿐 아니라 드래그 연속 편집을 지원합니다. 시나리오를 빠르게 만들고 수정할 수 있습니다.

## 0:35~0:55 Agent 명령

입력:

```text
모든 작업대를 가장 가까운 AMR로 채워줘
```

또는:

```json
{
  "fill": ["W1", "W2", "W3"],
  "priority": "nearest"
}
```

멘트:

> Agent는 자연어와 JSON 명령을 모두 해석합니다. 각 Workstation에 대해 가장 적합한 AMR을 배정하고, 배정 근거를 로그로 남깁니다.

## 0:55~1:15 Planner / Reservation / Arbiter

시연:

1. `Plan Only` 클릭
2. Agent Log 확인
3. Reservation Log 확인
4. Arbiter 승인 확인

멘트:

> 경로 생성은 Time A*를 사용합니다. Reservation Table이 시간별 cell과 edge를 예약하고, edge swap과 동시 점유를 방지합니다. Global Arbiter가 최종 경로를 검증합니다.

## 1:15~1:35 Replay

시연:

1. `Start Fleet` 클릭
2. AMR 이동 확인
3. Timeline tick 확인

멘트:

> 생성된 경로는 tick 단위로 재생됩니다. AMR들이 동시에 움직이면서 예약 충돌 없이 목표 지점으로 이동합니다.

## 1:35~1:50 Dataset Evidence

시연:

1. `Dataset > Export`
2. `Dataset > PNG`
3. 터미널에서 `npm run validate`

멘트:

> 시뮬레이션 결과는 episode JSON과 snapshot PNG로 내보낼 수 있으며, validate script로 제출 데이터셋 형식을 검증할 수 있습니다.

## 예비 질문 답변

### 왜 Time A*인가?

A*에 시간축 `t`를 추가해서 같은 셀이라도 시간에 따라 점유 가능 여부를 다르게 판단하기 위해서입니다. 다중 AMR에서는 단순 공간 경로보다 cell/edge reservation이 중요합니다.

### Reservation Table은 무엇을 막나?

같은 시간 같은 cell 점유, 같은 edge 점유, 서로 반대 방향으로 같은 edge를 통과하는 edge swap을 막습니다.

### Global Arbiter 역할은?

각 AMR의 경로가 생성된 뒤 전체 fleet 관점에서 충돌, blocked cell, out-of-bounds, edge swap을 다시 검증합니다.

### Dataset은 왜 필요한가?

시뮬레이션 결과를 episode 단위로 저장해서 재현 가능성과 평가 가능성을 확보하기 위해서입니다.
