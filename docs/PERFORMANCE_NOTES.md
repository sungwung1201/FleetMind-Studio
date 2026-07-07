# Performance Notes

## Target

| Item | Target |
|---|---|
| Runtime | Browser-based React/Vite app |
| Grid | 20x20 or larger |
| AMRs | 3+ required, tested with 6+ |
| Workstations | 3+ required, tested with 6+ |
| Obstacles | 5+ |
| Planning | Time A* + Reservation Table |
| Validation | Global Arbiter |
| Replay | Tick-based browser replay |

## Performance Strategy

The simulator is designed to stay responsive during normal planning and failure cases.

1. Static no-path reachability check before Time A*.
2. A* expanded-node guard for complex blocked scenes.
3. Reservation-based grid planning instead of heavy physics simulation.
4. Lightweight grid rendering.
5. Smaller AMR visual icons to reduce visual overlap during adjacent-cell motion.
6. Deterministic no-key agent with no network API latency.

## FPS Statement

The target runtime is 60FPS for typical 20x20 scenes. On limited hardware, the app is designed to remain usable at 30FPS or higher. No-path scenes fail fast instead of locking the browser main thread.

## Recommended Demo Environment

| Item | Recommended |
|---|---|
| Browser | Chrome / Edge |
| Mode | Production preview |
| Command | `npm run build && npm run preview` |
| Demo scenarios | Default, Edge Swap, Bottleneck, No Path, 6-AMR stress |
