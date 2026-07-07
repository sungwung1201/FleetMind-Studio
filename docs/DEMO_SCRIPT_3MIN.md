# 3-Minute Demo Script

## 0:00 - 0:20 Opening

Show the web app.

Narration:
> This is a browser-based multi-AMR fleet simulation studio. It supports a 20x20 grid, multiple AMRs, workstations, obstacles, natural-language task assignment, Time A* path planning, reservation-based collision prevention, replay, and synthetic dataset export.

## 0:20 - 0:55 Default Fleet Assignment

Command:

```text
모든 작업대를 가장 가까운 AMR로 채워줘
```

Show Agent Decisions, Plan Result Summary, routes, and replay.

## 0:55 - 1:25 Explicit Multi-Route Command

Command:

```text
AMR_02는 W1 먼저 갔다가 W3 가고 AMR_01은 W2 가
```

Mention that explicit order is preserved when the command includes “먼저” or “갔다가”.

## 1:25 - 1:50 Route Order Optimization

Command:

```text
AMR_02는 W1이랑 W3 가까운 순서로 처리하고 AMR_01은 W2 가
```

Show the route order optimizer log.

## 1:50 - 2:15 Edge Swap Prevention

Select Edge Swap Prevention Scenario. Show reservation/arbiter logs.

Mention:
> Edge swap is prevented before execution by edge reservation. A successful result is a safe plan approved by the arbiter.

## 2:15 - 2:35 No Path Fast Fail

Select No Path / Blocked Target Scenario.

Command:

```text
모든 작업대를 가장 가까운 AMR로 채워줘
```

Show failed route segment and no browser freeze.

## 2:35 - 2:50 Dataset Export

Show Export Dataset, Export PNG, and Validate.

## 2:50 - 3:00 Closing

Mention:
> The system combines AI-style task assignment, Time A* planning, reservation-based safety, replay, and dataset generation in one web simulation studio.
