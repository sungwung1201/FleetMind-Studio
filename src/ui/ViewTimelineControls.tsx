type ViewTimelineControlsProps = {
  cellSize: number;
  currentTick: number;
  maxTick: number;
  isRunning: boolean;
  playbackSpeed: number;
  setPlaybackSpeed: (value: number) => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onSetTick: (tick: number) => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onStart: () => void;
  onPause: () => void;
};

export function ViewTimelineControls({
  cellSize,
  currentTick,
  maxTick,
  isRunning,
  playbackSpeed,
  setPlaybackSpeed,
  onFitView,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSetTick,
  onStepBackward,
  onStepForward,
  onStart,
  onPause,
}: ViewTimelineControlsProps) {
  const safeMaxTick = Math.max(0, maxTick);
  const safeCurrentTick = Math.min(Math.max(0, currentTick), safeMaxTick);

  return (
    <div className="view-timeline-shell">
      <section className="viewport-toolbar">
        <span>View</span>
        <button onClick={onFitView}>Fit</button>
        <button onClick={onZoomOut}>−</button>
        <button onClick={onResetZoom}>{cellSize}px</button>
        <button onClick={onZoomIn}>+</button>
      </section>

      <section className="timeline-toolbar">
        <span>Timeline</span>
        <button onClick={onStepBackward}>◀ Step</button>
        <button onClick={isRunning ? onPause : onStart}>
          {isRunning ? "Pause" : "Play"}
        </button>
        <button onClick={onStepForward}>Step ▶</button>

        <input
          type="range"
          min={0}
          max={safeMaxTick}
          value={safeCurrentTick}
          onChange={(event) => {
            const nextTick = Math.min(
              Math.max(0, Number(event.target.value)),
              safeMaxTick
            );
            onSetTick(nextTick);
          }}
        />

        <strong>
          {safeCurrentTick} / {safeMaxTick}
        </strong>

        <select
          value={playbackSpeed}
          onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
        </select>
      </section>
    </div>
  );
}
