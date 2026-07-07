/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState, useRef } from "react";
import "./App.css";
import type { AgentDecision, AMR, EpisodeDataset, Scenario } from "./core/types";
import { getBlockedCellKeys, sameCell } from "./core/grid";
import { ReservationTable, type ReservationEvent } from "./core/reservationTable";
import { findPathTimeAStar } from "./core/timeAstar";
import { validateFleetPlan, type ArbiterReport } from "./core/globalArbiter";
import { getPathCostReport } from "./core/pathCost";
import { runTaskAgent } from "./core/taskAgent";
import {
  createEpisodeDataset,
  downloadJsonFile,
  validateEpisodeDataset,
} from "./dataset/episodeLogger";
import { createSnapshotPng } from "./dataset/snapshotExporter";
import { defaultScenario } from "./scenarios/defaultScenario";
import { getScenarioById, scenarioList } from "./scenarios";
import { downloadScenarioJson, readScenarioFile } from "./scenarios/scenarioIO";
import { AgentDrawer } from "./ui/AgentDrawer";
import { SceneTreeInspector } from "./ui/SceneTreeInspector";
import { ViewTimelineControls } from "./ui/ViewTimelineControls";
import { GridCanvas, type EditableObjectKind, type ObstacleBrushMode, type SelectedStudioObject } from "./ui/GridCanvas";

const DEFAULT_AGENT_COMMAND = JSON.stringify(
  {
    fill: ["W1", "W2", "W3"],
    priority: "nearest",
  },
  null,
  2
);

const AMR_COLOR_PALETTE = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
  "#be123c",
  "#15803d",
  "#7c3aed",
];

function cloneScenario(scenario: Scenario): Scenario {
  return structuredClone(scenario);
}

function getLastPathTick(amrs: AMR[]): number {
  let maxTick = 0;

  for (const amr of amrs) {
    if (amr.path.length === 0) {
      continue;
    }

    const lastCell = amr.path[amr.path.length - 1];
    maxTick = Math.max(maxTick, lastCell.t);
  }

  return maxTick;
}

function getEmptyArbiterReport(): ArbiterReport {
  return {
    approved: false,
    checkedTicks: 0,
    cellCollisionCount: 0,
    edgeSwapCount: 0,
    blockedCellCount: 0,
    outOfBoundsCount: 0,
    messages: ["No Global Arbiter validation yet."],
  };
}

function App() {
  const initialScenario = useMemo(() => cloneScenario(defaultScenario), []);
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultScenario.id);
  const [customScenario, setCustomScenario] = useState<Scenario | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedStudioObject, setSelectedStudioObject] =
    useState<SelectedStudioObject | null>(null);
  const [selectedMoveX, setSelectedMoveX] = useState(0);
  const [selectedMoveY, setSelectedMoveY] = useState(0);
  const [activePanel, setActivePanel] = useState("studio");
  const [activeLogTab, setActiveLogTab] = useState("system");
  const [rightPanelTab, setRightPanelTab] = useState<"agent" | "scene" | "inspector">("agent");
  const [isToolPanelOpen, setIsToolPanelOpen] = useState(false);
  const [activeStudioTool, setActiveStudioTool] = useState("object");
  const [agentPanelWidth, setAgentPanelWidth] = useState(430);
  const [logPanelHeight, setLogPanelHeight] = useState(250);
  const [isAgentResizing, setIsAgentResizing] = useState(false);
  const [isLogResizing, setIsLogResizing] = useState(false);
  const [cellSize, setCellSize] = useState(44);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [addObjectX, setAddObjectX] = useState(2);
  const [addObjectY, setAddObjectY] = useState(2);
  const [manualGoalAmrId, setManualGoalAmrId] = useState("AMR_01");
  const [manualGoalX, setManualGoalX] = useState(10);
  const [manualGoalY, setManualGoalY] = useState(10);
  const [placementMode, setPlacementMode] = useState<
    "select" | "add" | "delete"
  >("select");
  const [addTarget, setAddTarget] = useState<
    "none" | "amr" | "workstation" | "goal" | "wall"
  >("none");
  const [objectBuilderMode, setObjectBuilderMode] = useState<
    "amr" | "workstation" | "obstacle" | "goal"
  >("amr");
  const [scenarioHistory, setScenarioHistory] = useState<Scenario[]>([]);
  const [redoStack, setRedoStack] = useState<Scenario[]>([]);
  const [isAgentDrawerOpen, setIsAgentDrawerOpen] = useState(false);
  const [multiSelectedObjects, setMultiSelectedObjects] = useState<SelectedStudioObject[]>([]);
  const [obstacleBrushMode, setObstacleBrushMode] =
    useState<ObstacleBrushMode>(null);
  const [wallStartX, setWallStartX] = useState(0);
  const [wallStartY, setWallStartY] = useState(0);
  const [wallEndX, setWallEndX] = useState(5);
  const [wallEndY, setWallEndY] = useState(0);
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [commandInput, setCommandInput] = useState(DEFAULT_AGENT_COMMAND);
  const [agentDecisions, setAgentDecisions] = useState<AgentDecision[]>([]);
  const [reservationEvents, setReservationEvents] = useState<ReservationEvent[]>([]);
  const [latestDataset, setLatestDataset] = useState<EpisodeDataset | null>(null);
  const [datasetLog, setDatasetLog] = useState<string[]>(["No dataset exported yet."]);
  const [systemLog, setSystemLog] = useState<string[]>([
    "System initialized.",
    "Ready to run Agent → Time A* → Reservation Table → Global Arbiter pipeline.",
  ]);
  const [agentLog, setAgentLog] = useState<string[]>(["No Agent decision yet."]);
  const [reservationLog, setReservationLog] = useState<string[]>([]);
  const [arbiterReport, setArbiterReport] = useState<ArbiterReport>(
    getEmptyArbiterReport()
  );

  const appendLog = (message: string) => {
    setSystemLog((prev) => {
      const next = [`[t=${currentTick}] ${message}`, ...prev];
      return next.slice(0, 20);
    });
  };

  const resetToScenario = (scenarioId: string) => {
    const nextBaseScenario =
      customScenario && scenarioId === customScenario.id
        ? customScenario
        : getScenarioById(scenarioId);

    setSelectedScenarioId(scenarioId);
    setIsRunning(false);
    setCurrentTick(0);
    setSelectedStudioObject(null);
    setSelectedMoveX(0);
    setSelectedMoveY(0);
    setScenario(cloneScenario(nextBaseScenario));
    setAgentDecisions([]);
    setAgentLog(["No Agent decision yet."]);
    setReservationEvents([]);
    setReservationLog([]);
    setLatestDataset(null);
    setDatasetLog(["No dataset exported yet."]);
    setArbiterReport(getEmptyArbiterReport());
    setSystemLog([
      `Scenario loaded: ${nextBaseScenario.name}`,
      "Ready to run Agent → Time A* → Reservation Table → Global Arbiter pipeline.",
    ]);
  };

  const isInsideScenario = (
    cell: { x: number; y: number },
    targetScenario: Scenario
  ) => {
    return (
      cell.x >= 0 &&
      cell.y >= 0 &&
      cell.x < targetScenario.width &&
      cell.y < targetScenario.height
    );
  };

  useEffect(() => {
    if (!isAgentResizing && !isLogResizing) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (isAgentResizing) {
        const nextWidth = window.innerWidth - event.clientX - 18;
        setAgentPanelWidth(Math.min(680, Math.max(360, nextWidth)));
      }

      if (isLogResizing) {
        const nextHeight = window.innerHeight - event.clientY - 18;
        setLogPanelHeight(Math.min(460, Math.max(160, nextHeight)));
      }
    };

    const handleMouseUp = () => {
      setIsAgentResizing(false);
      setIsLogResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isAgentResizing, isLogResizing]);

  const loadAgentQuickCommand = (command: string) => {
    setCommandInput(command);
    setAgentLog((prev) => [
      `[quick] Command loaded: ${command.replace(/\n/g, " ").slice(0, 80)}`,
      ...prev,
    ].slice(0, 20));
  };

  const getPathCellAtTick = (
    amr: (typeof scenario.amrs)[number],
    tick: number
  ) => {
    if (amr.path.length === 0) {
      return amr.cell;
    }

    const exact = amr.path.find((cell) => cell.t === tick);
    if (exact) {
      return exact;
    }

    const first = amr.path[0];
    const last = amr.path[amr.path.length - 1];

    if (tick < first.t) {
      return first;
    }

    return last;
  };

  const applyScenarioAtTick = (tick: number) => {
    const maxTick = getLastPathTick(scenario.amrs);
    const nextTick = Math.max(0, Math.min(tick, maxTick));

    setCurrentTick(nextTick);

    setScenario((prevScenario) => {
      const nextScenario = cloneScenario(prevScenario);

      for (const amr of nextScenario.amrs) {
        if (amr.path.length === 0) {
          amr.status = "IDLE";
          continue;
        }

        const cell = getPathCellAtTick(amr, nextTick);
        const lastCell = amr.path[amr.path.length - 1];
        const prevCell = getPathCellAtTick(amr, Math.max(0, nextTick - 1));

        amr.cell = {
          x: cell.x,
          y: cell.y,
        };

        if (nextTick >= lastCell.t) {
          amr.status = "DONE";
        } else if (
          cell.x === prevCell.x &&
          cell.y === prevCell.y &&
          nextTick > 0
        ) {
          amr.status = "WAITING";
        } else {
          amr.status = "MOVING";
        }
      }

      return nextScenario;
    });
  };

  const handleStepBackward = () => {
    setIsRunning(false);
    applyScenarioAtTick(Math.max(0, currentTick - 1));
  };

  const handleStepForward = () => {
    setIsRunning(false);
    applyScenarioAtTick(
      Math.min(getLastPathTick(scenario.amrs), currentTick + 1)
    );
  };

  const handleFitView = () => {
    const stage = document.querySelector(".stage-canvas-wrap");

    if (!(stage instanceof HTMLElement)) {
      setCellSize(44);
      return;
    }

    const availableWidth = stage.clientWidth - 64;
    const availableHeight = stage.clientHeight - 96;
    const fitCellSize = Math.floor(
      Math.min(availableWidth / scenario.width, availableHeight / scenario.height)
    );

    setCellSize(Math.max(24, Math.min(72, fitCellSize)));
  };

  const handleZoomIn = () => {
    setCellSize((prev) => Math.min(72, prev + 4));
  };

  const handleZoomOut = () => {
    setCellSize((prev) => Math.max(20, prev - 4));
  };

  const handleResetZoom = () => {
    setCellSize(44);
  };

  const handleUndo = () => {
    if (scenarioHistory.length === 0) {
      return;
    }

    const [previous, ...rest] = scenarioHistory;

    setRedoStack((prev) => [cloneScenario(scenario), ...prev].slice(0, 30));
    setScenarioHistory(rest);
    setScenario(cloneScenario(previous));
    setSelectedStudioObject(null);
    setCurrentTick(0);
    setIsRunning(false);
    setSystemLog((prev) => [
      "[studio] Undo applied.",
      ...prev,
    ].slice(0, 20));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) {
      return;
    }

    const [next, ...rest] = redoStack;

    setScenarioHistory((prev) => [cloneScenario(scenario), ...prev].slice(0, 30));
    setRedoStack(rest);
    setScenario(cloneScenario(next));
    setSelectedStudioObject(null);
    setCurrentTick(0);
    setIsRunning(false);
    setSystemLog((prev) => [
      "[studio] Redo applied.",
      ...prev,
    ].slice(0, 20));
  };

  // Final editor controller: Select / Add / Delete.
  useEffect(() => {
    let dragTarget: { kind: "amr" | "workstation" | "obstacle"; id: string } | null = null;
    let dragMoved = false;
    let deleteDragging = false;
    let lastDeletedCellKey = "";

    const getCellFromPointer = (event: PointerEvent) => {
      const grid = document.querySelector(".grid-canvas");

      if (!(grid instanceof HTMLElement)) {
        return null;
      }

      const rect = grid.getBoundingClientRect();

      const x = Math.floor(((event.clientX - rect.left) / rect.width) * scenario.width);
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * scenario.height);

      if (x < 0 || y < 0 || x >= scenario.width || y >= scenario.height) {
        return null;
      }

      return { x, y };
    };

    const findObjectAtCell = (
      sourceScenario: Scenario,
      cell: { x: number; y: number }
    ) => {
      const amr = sourceScenario.amrs.find(
        (item) => item.cell.x === cell.x && item.cell.y === cell.y
      );

      if (amr) {
        return { kind: "amr" as const, id: amr.id };
      }

      const workstation = sourceScenario.workstations.find(
        (item) => item.cell.x === cell.x && item.cell.y === cell.y
      );

      if (workstation) {
        return { kind: "workstation" as const, id: workstation.id };
      }

      const obstacle = sourceScenario.obstacles.find(
        (item) => item.cell.x === cell.x && item.cell.y === cell.y
      );

      if (obstacle) {
        return { kind: "obstacle" as const, id: obstacle.id };
      }

      return null;
    };

    const isOccupied = (
      sourceScenario: Scenario,
      cell: { x: number; y: number },
      except?: { kind: "amr" | "workstation" | "obstacle"; id: string }
    ) => {
      return (
        sourceScenario.amrs.some(
          (amr) =>
            amr.cell.x === cell.x &&
            amr.cell.y === cell.y &&
            !(except?.kind === "amr" && except.id === amr.id)
        ) ||
        sourceScenario.workstations.some(
          (workstation) =>
            workstation.cell.x === cell.x &&
            workstation.cell.y === cell.y &&
            !(except?.kind === "workstation" && except.id === workstation.id)
        ) ||
        sourceScenario.obstacles.some(
          (obstacle) =>
            obstacle.cell.x === cell.x &&
            obstacle.cell.y === cell.y &&
            !(except?.kind === "obstacle" && except.id === obstacle.id)
        )
      );
    };

    const clearPlans = (sourceScenario: Scenario) => {
      const nextScenario = cloneScenario(sourceScenario);

      nextScenario.amrs = nextScenario.amrs.map((amr) => ({
        ...amr,
        path: [],
        status: "IDLE",
      }));

      return nextScenario;
    };

    const reindexScenario = (sourceScenario: Scenario) => {
      const nextScenario = cloneScenario(sourceScenario);

      nextScenario.amrs = nextScenario.amrs.map((amr, index) => ({
        ...amr,
        id: `AMR_${String(index + 1).padStart(2, "0")}`,
        path: [],
        status: "IDLE",
      }));

      nextScenario.workstations = nextScenario.workstations.map(
        (workstation, index) => ({
          ...workstation,
          id: `W${index + 1}`,
        })
      );

      nextScenario.obstacles = nextScenario.obstacles.map((obstacle, index) => ({
        ...obstacle,
        id: `OBS_${String(index + 1).padStart(2, "0")}`,
      }));

      return nextScenario;
    };

    const getNextId = (prefix: string, ids: string[], pad = 0) => {
      const numbers = ids
        .map((id) => Number(id.replace(prefix, "")))
        .filter((value) => Number.isFinite(value));

      const nextNumber = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
      return `${prefix}${pad > 0 ? String(nextNumber).padStart(pad, "0") : String(nextNumber)}`;
    };

    const addAtCell = (cell: { x: number; y: number }) => {
      setIsRunning(false);
      setCurrentTick(0);

      if (addTarget === "none") {
        setSystemLog((prev) => [
          "[add] Choose AMR, Workstation, or Goal from Build first.",
          ...prev,
        ].slice(0, 20));
        return;
      }

      setScenario((prevScenario) => {
        if (addTarget !== "goal" && isOccupied(prevScenario, cell)) {
          setSystemLog((prev) => [
            `[add] Cell [${cell.x},${cell.y}] is occupied.`,
            ...prev,
          ].slice(0, 20));
          return prevScenario;
        }

        const nextScenario = clearPlans(prevScenario);

        if (addTarget === "amr") {
          const template = nextScenario.amrs[0];

          if (!template) {
            return prevScenario;
          }

          const colors = [
            "#2563eb",
            "#dc2626",
            "#16a34a",
            "#9333ea",
            "#f97316",
            "#0891b2",
          ];

          const id = getNextId(
            "AMR_",
            nextScenario.amrs.map((amr) => amr.id),
            2
          );

          nextScenario.amrs.push({
            ...template,
            id,
            cell,
            startCell: cell,
            goalCell: undefined,
            path: [],
            status: "IDLE",
            color: colors[nextScenario.amrs.length % colors.length],
          });

          setSelectedStudioObject({ kind: "amr", id });
          setManualGoalAmrId(id);

          setSystemLog((prev) => [
            `[add] ${id} added at [${cell.x},${cell.y}].`,
            ...prev,
          ].slice(0, 20));

          return nextScenario;
        }

        if (addTarget === "workstation") {
          const template = nextScenario.workstations[0];

          if (!template) {
            return prevScenario;
          }

          const id = getNextId(
            "W",
            nextScenario.workstations.map((workstation) => workstation.id)
          );

          nextScenario.workstations.push({
            ...template,
            id,
            cell,
          });

          setSelectedStudioObject({ kind: "workstation", id });

          setSystemLog((prev) => [
            `[add] ${id} added at [${cell.x},${cell.y}].`,
            ...prev,
          ].slice(0, 20));

          return nextScenario;
        }

        if (addTarget === "wall") {
          const id = getNextId(
            "OBS_",
            nextScenario.obstacles.map((obstacle) => obstacle.id),
            2
          );

          nextScenario.obstacles.push({
            id,
            cell,
          } as (typeof nextScenario.obstacles)[number]);

          setSystemLog((prev) => [
            `[add] Wall added at [${cell.x},${cell.y}].`,
            ...prev,
          ].slice(0, 20));

          return nextScenario;
        }

        if (addTarget === "goal") {
          const obstacleExists = nextScenario.obstacles.some(
            (obstacle) => obstacle.cell.x === cell.x && obstacle.cell.y === cell.y
          );

          if (obstacleExists || nextScenario.amrs.length === 0) {
            return prevScenario;
          }

          const firstWithoutGoal = nextScenario.amrs.find(
            (amr) => !(amr as { goalCell?: { x: number; y: number } }).goalCell
          );

          const fallbackAmr =
            nextScenario.amrs[
              goalRoundRobinRef.current % Math.max(1, nextScenario.amrs.length)
            ];

          const targetAmr = firstWithoutGoal ?? fallbackAmr;

          if (!targetAmr) {
            return prevScenario;
          }

          goalRoundRobinRef.current += 1;

          nextScenario.amrs = nextScenario.amrs.map((amr) =>
            amr.id === targetAmr.id
              ? ({
                  ...amr,
                  goalCell: cell,
                  path: [],
                  status: "IDLE",
                } as typeof amr)
              : amr
          );

          setManualGoalAmrId(targetAmr.id);

          setSystemLog((prev) => [
            `[goal] ${targetAmr.id} goal set at [${cell.x},${cell.y}].`,
            ...prev,
          ].slice(0, 20));

          return nextScenario;
        }

        return prevScenario;
      });
    };

    const deleteAtCell = (cell: { x: number; y: number }) => {
      const cellKey = `${cell.x},${cell.y}`;

      if (cellKey === lastDeletedCellKey) {
        return;
      }

      lastDeletedCellKey = cellKey;

      setIsRunning(false);
      setCurrentTick(0);

      setScenario((prevScenario) => {
        const objectAtCell = findObjectAtCell(prevScenario, cell);

        if (!objectAtCell) {
          return prevScenario;
        }

        let nextScenario = clearPlans(prevScenario);

        if (objectAtCell.kind === "amr") {
          nextScenario.amrs = nextScenario.amrs.filter(
            (amr) => amr.id !== objectAtCell.id
          );
        }

        if (objectAtCell.kind === "workstation") {
          nextScenario.workstations = nextScenario.workstations.filter(
            (workstation) => workstation.id !== objectAtCell.id
          );
        }

        if (objectAtCell.kind === "obstacle") {
          nextScenario.obstacles = nextScenario.obstacles.filter(
            (obstacle) => obstacle.id !== objectAtCell.id
          );
        }

        nextScenario = reindexScenario(nextScenario);

        setSelectedStudioObject(null);

        const nextAmrId = nextScenario.amrs[0]?.id ?? "";
        if (nextAmrId) {
          setManualGoalAmrId(nextAmrId);
        }

        setSystemLog((prev) => [
          `[delete] ${objectAtCell.kind}:${objectAtCell.id} deleted. IDs reindexed.`,
          ...prev,
        ].slice(0, 20));

        return nextScenario;
      });
    };

    const moveObject = (
      object: { kind: "amr" | "workstation" | "obstacle"; id: string },
      cell: { x: number; y: number }
    ) => {
      setIsRunning(false);
      setCurrentTick(0);

      setScenario((prevScenario) => {
        if (isOccupied(prevScenario, cell, object)) {
          setSystemLog((prev) => [
            `[move] Cannot move ${object.kind}:${object.id} to [${cell.x},${cell.y}]: occupied.`,
            ...prev,
          ].slice(0, 20));
          return prevScenario;
        }

        const nextScenario = clearPlans(prevScenario);

        if (object.kind === "amr") {
          nextScenario.amrs = nextScenario.amrs.map((amr) =>
            amr.id === object.id
              ? {
                  ...amr,
                  cell,
                  startCell: cell,
                  path: [],
                  status: "IDLE",
                }
              : amr
          );
        }

        if (object.kind === "workstation") {
          nextScenario.workstations = nextScenario.workstations.map(
            (workstation) =>
              workstation.id === object.id
                ? {
                    ...workstation,
                    cell,
                  }
                : workstation
          );
        }

        if (object.kind === "obstacle") {
          nextScenario.obstacles = nextScenario.obstacles.map((obstacle) =>
            obstacle.id === object.id
              ? {
                  ...obstacle,
                  cell,
                }
              : obstacle
          );
        }

        setSystemLog((prev) => [
          `[move] ${object.kind}:${object.id} moved to [${cell.x},${cell.y}].`,
          ...prev,
        ].slice(0, 20));

        return nextScenario;
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      const cell = getCellFromPointer(event);

      if (!cell) {
        return;
      }

      const objectAtCell = findObjectAtCell(scenario, cell);

      if (placementMode === "add") {
        event.preventDefault();
        event.stopPropagation();
        addAtCell(cell);
        return;
      }

      if (placementMode === "delete") {
        event.preventDefault();
        event.stopPropagation();
        deleteDragging = true;
        lastDeletedCellKey = "";
        deleteAtCell(cell);
        return;
      }

      if (placementMode === "select") {
        if (!objectAtCell) {
          setSelectedStudioObject(null);
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        setIsEditMode(true);
        setSelectedStudioObject(objectAtCell);
        dragTarget = objectAtCell;
        dragMoved = false;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const cell = getCellFromPointer(event);

      if (!cell) {
        return;
      }

      if (placementMode === "delete" && deleteDragging) {
        event.preventDefault();
        event.stopPropagation();
        deleteAtCell(cell);
        return;
      }

      if (placementMode === "select" && dragTarget) {
        event.preventDefault();
        event.stopPropagation();
        dragMoved = true;
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (placementMode === "delete") {
        deleteDragging = false;
        lastDeletedCellKey = "";
        return;
      }

      if (!dragTarget || placementMode !== "select") {
        dragTarget = null;
        dragMoved = false;
        return;
      }

      const cell = getCellFromPointer(event);
      const target = dragTarget;

      dragTarget = null;

      if (!cell || !dragMoved) {
        dragMoved = false;
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      dragMoved = false;
      moveObject(target, cell);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerUp, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerUp, true);
    };
  }, [
    placementMode,
    addTarget,
    scenario,
    selectedStudioObject,
    manualGoalAmrId,
  ]);


  const repairCellKey = (cell: { x: number; y: number }) => {
    return `${cell.x},${cell.y}`;
  };

  const repairGetObjectCell = (
    sourceScenario: Scenario,
    object: { kind: "amr" | "workstation" | "obstacle"; id: string }
  ) => {
    if (object.kind === "amr") {
      return sourceScenario.amrs.find((amr) => amr.id === object.id)?.cell ?? null;
    }

    if (object.kind === "workstation") {
      return (
        sourceScenario.workstations.find(
          (workstation) => workstation.id === object.id
        )?.cell ?? null
      );
    }

    return (
      sourceScenario.obstacles.find((obstacle) => obstacle.id === object.id)
        ?.cell ?? null
    );
  };

  const repairIsOccupied = (
    sourceScenario: Scenario,
    cell: { x: number; y: number },
    except?: { kind: "amr" | "workstation" | "obstacle"; id: string }
  ) => {
    return (
      sourceScenario.amrs.some(
        (amr) =>
          amr.cell.x === cell.x &&
          amr.cell.y === cell.y &&
          !(except?.kind === "amr" && except.id === amr.id)
      ) ||
      sourceScenario.workstations.some(
        (workstation) =>
          workstation.cell.x === cell.x &&
          workstation.cell.y === cell.y &&
          !(except?.kind === "workstation" && except.id === workstation.id)
      ) ||
      sourceScenario.obstacles.some(
        (obstacle) =>
          obstacle.cell.x === cell.x &&
          obstacle.cell.y === cell.y &&
          !(except?.kind === "obstacle" && except.id === obstacle.id)
      )
    );
  };

  const repairNextId = (prefix: string, ids: string[], pad = 0) => {
    const values = ids
      .map((id) => Number(id.replace(prefix, "")))
      .filter((value) => Number.isFinite(value));

    const next = values.length === 0 ? 1 : Math.max(...values) + 1;
    return `${prefix}${pad > 0 ? String(next).padStart(pad, "0") : String(next)}`;
  };

  const repairReindexScenario = (sourceScenario: Scenario) => {
    const nextScenario = cloneScenario(sourceScenario);

    nextScenario.amrs = nextScenario.amrs.map((amr, index) => ({
      ...amr,
      id: `AMR_${String(index + 1).padStart(2, "0")}`,
      path: [],
      status: "IDLE",
    }));

    nextScenario.workstations = nextScenario.workstations.map(
      (workstation, index) => ({
        ...workstation,
        id: `W${index + 1}`,
      })
    );

    nextScenario.obstacles = nextScenario.obstacles.map((obstacle, index) => ({
      ...obstacle,
      id: `OBS_${String(index + 1).padStart(2, "0")}`,
    }));

    return nextScenario;
  };

  const repairCommitScenarioEdit = (
    updater: (sourceScenario: Scenario) => Scenario,
    message: string
  ) => {
    setIsRunning(false);
    setCurrentTick(0);

    setScenario((prevScenario) => {
      const nextScenario = updater(cloneScenario(prevScenario));

      setScenarioHistory((prev) =>
        [cloneScenario(prevScenario), ...prev].slice(0, 30)
      );
      setRedoStack([]);
      setSystemLog((prev) => [message, ...prev].slice(0, 20));

      return nextScenario;
    });
  };


  const handleExportDataset = () => {
    const dataset = createEpisodeDataset({
      scenario,
      agentDecisions,
      reservationEvents,
      arbiterReport,
    });

    const validation = validateEpisodeDataset(dataset);

    setLatestDataset(dataset);
    setDatasetLog((prev) => [
      `[dataset] Exported ${dataset.episodes.length} episode(s). ${validation.messages[0] ?? ""}`,
      ...prev,
    ].slice(0, 20));

    downloadJsonFile(`fleet_dataset_${Date.now()}.json`, dataset);
  };


  const handleExportSnapshot = () => {
    createSnapshotPng(
      scenario,
      `fleet_snapshot_${Date.now()}.png`,
      Math.max(24, Math.min(48, cellSize))
    );

    setDatasetLog((prev) => [
      "[snapshot] PNG snapshot exported.",
      ...prev,
    ].slice(0, 20));
  };


  const handleValidateDataset = () => {
    const errors: string[] = [];

    if (scenario.width < 20 || scenario.height < 20) {
      errors.push("Grid must be at least 20x20.");
    }

    if (scenario.amrs.length < 3) {
      errors.push("At least 3 AMRs are required.");
    }

    if (scenario.workstations.length < 3) {
      errors.push("At least 3 workstations are required.");
    }

    if (scenario.obstacles.length < 5) {
      errors.push("At least 5 obstacles are recommended for the default requirement.");
    }

    const dataset = latestDataset ?? createEpisodeDataset({
      scenario,
      agentDecisions,
      reservationEvents,
      arbiterReport,
    });
    const datasetValidation = validateEpisodeDataset(dataset);

    if (errors.length === 0 && datasetValidation.ok) {
      setDatasetLog((prev) => [
        `[validate] PASS: scenario and dataset are valid. ${datasetValidation.messages[0]}`,
        ...prev,
      ].slice(0, 20));
      return;
    }

    setDatasetLog((prev) => [
      `[validate] WARN: ${[...errors, ...datasetValidation.messages].join(" ")}`,
      ...prev,
    ].slice(0, 20));
  };


  const handleExportScenario = () => {
    downloadScenarioJson(scenario);

    setSystemLog((prev) => [
      `[scenario] Exported ${scenario.name}.`,
      ...prev,
    ].slice(0, 20));
  };


  const handleImportScenario = async (file: File | null) => {
    if (!file) {
      return;
    }

    const result = await readScenarioFile(file);

    if (!result.ok || !result.scenario) {
      setSystemLog((prev) => [
        `[scenario] Import failed: ${result.error ?? "Unknown scenario import error."}`,
        ...prev,
      ].slice(0, 20));
      return;
    }

    const importedScenario = result.scenario;

    setCustomScenario(importedScenario);
    setSelectedScenarioId(importedScenario.id);
    setScenarioHistory((prev) => [cloneScenario(scenario), ...prev].slice(0, 30));
    setRedoStack([]);
    setScenario(cloneScenario(importedScenario));
    setSelectedStudioObject(null);
    setCurrentTick(0);
    setIsRunning(false);
    setAgentDecisions([]);
    setReservationEvents([]);
    setReservationLog([]);
    setLatestDataset(null);
    setArbiterReport(getEmptyArbiterReport());

    setSystemLog((prev) => [
      `[scenario] Imported ${importedScenario.name}.`,
      ...prev,
    ].slice(0, 20));
  };

  const repairBuildManhattanPath = (
    start: { x: number; y: number },
    goal: { x: number; y: number },
    startTick: number
  ) => {
    const path: Array<{ x: number; y: number; t: number }> = [];
    let x = start.x;
    let y = start.y;
    let t = startTick;

    path.push({ x, y, t });

    while (x !== goal.x) {
      x += goal.x > x ? 1 : -1;
      t += 1;
      path.push({ x, y, t });
    }

    while (y !== goal.y) {
      y += goal.y > y ? 1 : -1;
      t += 1;
      path.push({ x, y, t });
    }

    return path;
  };



  const handlePlanOnly = () => {
    const agentResult = runTaskAgent(scenario, commandInput);
    const nextScenario = cloneScenario(agentResult.scenario);

    const reservationTable = new ReservationTable();
    const blockedCells = getBlockedCellKeys(nextScenario);
    const planningLog: string[] = [];

    nextScenario.amrs = nextScenario.amrs.map((amr) => {
      if (!amr.goalCell) {
        planningLog.push(`[planner] ${amr.id}: no goal assigned.`);
        return {
          ...amr,
          path: [],
          status: "IDLE",
        };
      }

      const path = findPathTimeAStar({
        width: nextScenario.width,
        height: nextScenario.height,
        start: amr.cell,
        goal: amr.goalCell,
        blockedCells,
        reservationTable,
        amrId: amr.id,
        maxTime: 180,
      });

      if (path.length === 0) {
        planningLog.push(
          `[planner] ${amr.id}: failed to find Time A* path to [${amr.goalCell.x},${amr.goalCell.y}].`
        );

        return {
          ...amr,
          path: [],
          status: "IDLE",
        };
      }

      reservationTable.reservePath(amr.id, path);

      const cost = getPathCostReport({ ...amr, path }, amr.goalCell);

      planningLog.push(
        `[planner] ${amr.id}: Time A* path=${path.length}, strategy=${cost.selectedStrategy}, wait=${cost.waitSteps}, detour=${cost.detourSteps}.`
      );

      return {
        ...amr,
        path,
        status: "IDLE",
      };
    });

    const arbiterReport = validateFleetPlan(nextScenario);

    setScenario(nextScenario);
    setCurrentTick(0);
    setIsRunning(false);

    setAgentDecisions(agentResult.decisions);
    setAgentLog([
      ...agentResult.logs,
      ...planningLog,
      arbiterReport.approved
        ? "[arbiter] APPROVED: no blocking fleet conflict detected."
        : "[arbiter] REJECTED: fleet conflict detected.",
      ...arbiterReport.messages,
    ].slice(0, 80));

    setReservationEvents(reservationTable.getEvents());
    setReservationLog(reservationTable.getSummaryLines(40));
    setArbiterReport(arbiterReport);

    setSystemLog((prev) => [
      "[planner] Agent → Time A* → Reservation Table → Global Arbiter pipeline completed.",
      ...prev,
    ].slice(0, 20));
  };



  const handleStart = () => {
    const hasPath = scenario.amrs.some(
      (amr) => Array.isArray(amr.path) && amr.path.length > 1
    );

    if (!hasPath) {
      setSystemLog((prev) => [
        "[replay] No path found. Run Plan Only first.",
        ...prev,
      ].slice(0, 20));
      return;
    }

    setIsRunning(true);

    setSystemLog((prev) => [
      "[replay] Fleet replay started.",
      ...prev,
    ].slice(0, 20));
  };



  const handlePause = () => {
    setIsRunning(false);

    setSystemLog((prev) => [
      "[replay] Fleet replay paused.",
      ...prev,
    ].slice(0, 20));
  };

  const handleSelectStudioObject = (object: {
    kind: "amr" | "workstation" | "obstacle";
    id: string;
  }) => {
    setSelectedStudioObject(object);

    const cell = repairGetObjectCell(scenario, object);
    if (cell) {
      setSelectedMoveX(cell.x);
      setSelectedMoveY(cell.y);
    }

    if (object.kind === "amr") {
      setManualGoalAmrId(object.id);
    }
  };

  const handleBrushCell = (cell: { x: number; y: number }) => {
    if (obstacleBrushMode === "paint_obstacle") {
      repairCommitScenarioEdit((sourceScenario) => {
        if (repairIsOccupied(sourceScenario, cell)) {
          return sourceScenario;
        }

        const nextId = repairNextId(
          "OBS_",
          sourceScenario.obstacles.map((obstacle) => obstacle.id),
          2
        );

        sourceScenario.obstacles.push({
          id: nextId,
          cell,
        } as any);

        return sourceScenario;
      }, `[studio] Obstacle added at [${cell.x},${cell.y}].`);
    }

    if (obstacleBrushMode === "erase_obstacle") {
      repairCommitScenarioEdit((sourceScenario) => {
        sourceScenario.obstacles = sourceScenario.obstacles.filter(
          (obstacle) => obstacle.cell.x !== cell.x || obstacle.cell.y !== cell.y
        );

        return repairReindexScenario(sourceScenario);
      }, `[studio] Obstacle deleted at [${cell.x},${cell.y}].`);
    }
  };

  const handleMoveObject = (
    kind: "amr" | "workstation" | "obstacle",
    id: string,
    nextCell: { x: number; y: number }
  ) => {
    const object = { kind, id };

    repairCommitScenarioEdit((sourceScenario) => {
      if (repairIsOccupied(sourceScenario, nextCell, object)) {
        return sourceScenario;
      }

      if (kind === "amr") {
        sourceScenario.amrs = sourceScenario.amrs.map((amr) =>
          amr.id === id
            ? {
                ...amr,
                cell: nextCell,
                startCell: nextCell,
                path: [],
                status: "IDLE",
              }
            : {
                ...amr,
                path: [],
                status: "IDLE",
              }
        );
      }

      if (kind === "workstation") {
        sourceScenario.workstations = sourceScenario.workstations.map(
          (workstation) =>
            workstation.id === id
              ? {
                  ...workstation,
                  cell: nextCell,
                }
              : workstation
        );
      }

      if (kind === "obstacle") {
        sourceScenario.obstacles = sourceScenario.obstacles.map((obstacle) =>
          obstacle.id === id
            ? {
                ...obstacle,
                cell: nextCell,
              }
            : obstacle
        );
      }

      return sourceScenario;
    }, `[move] ${kind}:${id} moved to [${nextCell.x},${nextCell.y}].`);

    return true;
  };

  const toggleMultiSelected = (object: {
    kind: "amr" | "workstation" | "obstacle";
    id: string;
  }) => {
    setMultiSelectedObjects((prev) => {
      const exists = prev.some(
        (item) => item.kind === object.kind && item.id === object.id
      );

      if (exists) {
        return prev.filter(
          (item) => !(item.kind === object.kind && item.id === object.id)
        );
      }

      return [...prev, object];
    });
  };

  const selectAllByKind = (kind: "amr" | "workstation" | "obstacle") => {
    if (kind === "amr") {
      setMultiSelectedObjects(scenario.amrs.map((amr) => ({ kind, id: amr.id })));
    }

    if (kind === "workstation") {
      setMultiSelectedObjects(
        scenario.workstations.map((workstation) => ({
          kind,
          id: workstation.id,
        }))
      );
    }

    if (kind === "obstacle") {
      setMultiSelectedObjects(
        scenario.obstacles.map((obstacle) => ({ kind, id: obstacle.id }))
      );
    }
  };

  const clearMultiSelection = () => {
    setMultiSelectedObjects([]);
  };

  const deleteMultiSelectedObjects = () => {
    if (multiSelectedObjects.length === 0) {
      return;
    }

    const selectedKeys = new Set(
      multiSelectedObjects.map((object) => `${object.kind}:${object.id}`)
    );

    repairCommitScenarioEdit((sourceScenario) => {
      sourceScenario.amrs = sourceScenario.amrs.filter(
        (amr) => !selectedKeys.has(`amr:${amr.id}`)
      );
      sourceScenario.workstations = sourceScenario.workstations.filter(
        (workstation) => !selectedKeys.has(`workstation:${workstation.id}`)
      );
      sourceScenario.obstacles = sourceScenario.obstacles.filter(
        (obstacle) => !selectedKeys.has(`obstacle:${obstacle.id}`)
      );

      return repairReindexScenario(sourceScenario);
    }, `[delete] ${multiSelectedObjects.length} selected objects deleted.`);

    setMultiSelectedObjects([]);
    setSelectedStudioObject(null);
  };

  const handleMoveSelectedObjectByInput = () => {
    if (!selectedStudioObject) {
      return;
    }

    handleMoveObject(selectedStudioObject.kind, selectedStudioObject.id, {
      x: selectedMoveX,
      y: selectedMoveY,
    });
  };

  const handleDeleteSelectedObject = () => {
    if (!selectedStudioObject) {
      return;
    }

    repairCommitScenarioEdit((sourceScenario) => {
      if (selectedStudioObject.kind === "amr") {
        sourceScenario.amrs = sourceScenario.amrs.filter(
          (amr) => amr.id !== selectedStudioObject.id
        );
      }

      if (selectedStudioObject.kind === "workstation") {
        sourceScenario.workstations = sourceScenario.workstations.filter(
          (workstation) => workstation.id !== selectedStudioObject.id
        );
      }

      if (selectedStudioObject.kind === "obstacle") {
        sourceScenario.obstacles = sourceScenario.obstacles.filter(
          (obstacle) => obstacle.id !== selectedStudioObject.id
        );
      }

      return repairReindexScenario(sourceScenario);
    }, `[delete] ${selectedStudioObject.kind}:${selectedStudioObject.id} deleted.`);

    setSelectedStudioObject(null);
  };

  const handleReindexIds = () => {
    repairCommitScenarioEdit((sourceScenario) => {
      return repairReindexScenario(sourceScenario);
    }, "[studio] IDs reindexed: AMR / Workstation / Obstacle order normalized.");

    setSelectedStudioObject(null);
    setMultiSelectedObjects([]);
  };

  const deleteHoldActiveRef = useRef(false);
  const deleteHoldVisitedCellsRef = useRef<Set<string>>(new Set());
  const deletePlacementModeRef = useRef(placementMode);

  useEffect(() => {
    deletePlacementModeRef.current = placementMode;
  }, [placementMode]);

  // Delete drag hold controller v2.
  // Delete 모드에서 좌클릭을 누른 채 지나가는 셀의 객체를 연속 삭제한다.
  useEffect(() => {
    const getCellFromClientPoint = (clientX: number, clientY: number) => {
      const grid = document.querySelector(".grid-canvas");

      if (!(grid instanceof HTMLElement)) {
        return null;
      }

      const rect = grid.getBoundingClientRect();

      const x = Math.floor(((clientX - rect.left) / rect.width) * scenario.width);
      const y = Math.floor(((clientY - rect.top) / rect.height) * scenario.height);

      if (x < 0 || y < 0 || x >= scenario.width || y >= scenario.height) {
        return null;
      }

      return { x, y };
    };

    const deleteAtCellHard = (cell: { x: number; y: number }) => {
      const cellKey = `${cell.x},${cell.y}`;

      if (deleteHoldVisitedCellsRef.current.has(cellKey)) {
        return;
      }

      deleteHoldVisitedCellsRef.current.add(cellKey);

      setScenario((prevScenario) => {
        const targetAmr = prevScenario.amrs.find(
          (amr) => amr.cell.x === cell.x && amr.cell.y === cell.y
        );
        const targetWorkstation = prevScenario.workstations.find(
          (workstation) =>
            workstation.cell.x === cell.x && workstation.cell.y === cell.y
        );
        const targetObstacle = prevScenario.obstacles.find(
          (obstacle) => obstacle.cell.x === cell.x && obstacle.cell.y === cell.y
        );

        if (!targetAmr && !targetWorkstation && !targetObstacle) {
          return prevScenario;
        }

        const nextScenario = cloneScenario(prevScenario);

        if (targetAmr) {
          nextScenario.amrs = nextScenario.amrs.filter(
            (amr) => amr.id !== targetAmr.id
          );
        }

        if (targetWorkstation) {
          nextScenario.workstations = nextScenario.workstations.filter(
            (workstation) => workstation.id !== targetWorkstation.id
          );
        }

        if (targetObstacle) {
          nextScenario.obstacles = nextScenario.obstacles.filter(
            (obstacle) => obstacle.id !== targetObstacle.id
          );
        }

        nextScenario.amrs = nextScenario.amrs.map((amr, index) => ({
          ...amr,
          id: `AMR_${String(index + 1).padStart(2, "0")}`,
          path: [],
          status: "IDLE",
        }));

        nextScenario.workstations = nextScenario.workstations.map(
          (workstation, index) => ({
            ...workstation,
            id: `W${index + 1}`,
          })
        );

        nextScenario.obstacles = nextScenario.obstacles.map((obstacle, index) => ({
          ...obstacle,
          id: `OBS_${String(index + 1).padStart(2, "0")}`,
        }));

        return nextScenario;
      });

      setSelectedStudioObject(null);
      setCurrentTick(0);
      setIsRunning(false);
    };

    const startDeleteHold = (clientX: number, clientY: number) => {
      if (deletePlacementModeRef.current !== "delete") {
        return;
      }

      const cell = getCellFromClientPoint(clientX, clientY);

      if (!cell) {
        return;
      }

      deleteHoldActiveRef.current = true;
      deleteHoldVisitedCellsRef.current = new Set();
      deleteAtCellHard(cell);
    };

    const moveDeleteHold = (clientX: number, clientY: number) => {
      if (deletePlacementModeRef.current !== "delete") {
        return;
      }

      if (!deleteHoldActiveRef.current) {
        return;
      }

      const cell = getCellFromClientPoint(clientX, clientY);

      if (!cell) {
        return;
      }

      deleteAtCellHard(cell);
    };

    const stopDeleteHold = () => {
      deleteHoldActiveRef.current = false;
      deleteHoldVisitedCellsRef.current = new Set();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      if (deletePlacementModeRef.current !== "delete") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      startDeleteHold(event.clientX, event.clientY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (deletePlacementModeRef.current !== "delete") {
        return;
      }

      if (!deleteHoldActiveRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      moveDeleteHold(event.clientX, event.clientY);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      if (deletePlacementModeRef.current !== "delete") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      startDeleteHold(event.clientX, event.clientY);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (deletePlacementModeRef.current !== "delete") {
        return;
      }

      if (!deleteHoldActiveRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      moveDeleteHold(event.clientX, event.clientY);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", stopDeleteHold, true);
    window.addEventListener("pointercancel", stopDeleteHold, true);

    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", stopDeleteHold, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", stopDeleteHold, true);
      window.removeEventListener("pointercancel", stopDeleteHold, true);

      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", stopDeleteHold, true);
    };
  }, [scenario.width, scenario.height]);

  const addHoldActiveRef = useRef(false);
  const addHoldVisitedCellsRef = useRef<Set<string>>(new Set());
  const addPlacementModeRef = useRef(placementMode);
  const addTargetRef = useRef(addTarget);
  const goalRoundRobinRef = useRef(0);

  useEffect(() => {
    addPlacementModeRef.current = placementMode;
    addTargetRef.current = addTarget;
  }, [placementMode, addTarget]);

  // Add drag hold controller v1.
  // Add 모드에서 좌클릭을 누른 채 지나가는 셀에 AMR / Workstation / Goal / Wall을 연속 추가한다.
  useEffect(() => {
    const getCellFromClientPoint = (clientX: number, clientY: number) => {
      const grid = document.querySelector(".grid-canvas");

      if (!(grid instanceof HTMLElement)) {
        return null;
      }

      const rect = grid.getBoundingClientRect();

      const x = Math.floor(((clientX - rect.left) / rect.width) * scenario.width);
      const y = Math.floor(((clientY - rect.top) / rect.height) * scenario.height);

      if (x < 0 || y < 0 || x >= scenario.width || y >= scenario.height) {
        return null;
      }

      return { x, y };
    };

    const nextId = (prefix: string, ids: string[], pad = 0) => {
      const numbers = ids
        .map((id) => Number(id.replace(prefix, "")))
        .filter((value) => Number.isFinite(value));

      const nextNumber = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
      return `${prefix}${pad > 0 ? String(nextNumber).padStart(pad, "0") : String(nextNumber)}`;
    };

    const isOccupied = (
      sourceScenario: Scenario,
      cell: { x: number; y: number }
    ) => {
      return (
        sourceScenario.amrs.some(
          (amr) => amr.cell.x === cell.x && amr.cell.y === cell.y
        ) ||
        sourceScenario.workstations.some(
          (workstation) =>
            workstation.cell.x === cell.x && workstation.cell.y === cell.y
        ) ||
        sourceScenario.obstacles.some(
          (obstacle) => obstacle.cell.x === cell.x && obstacle.cell.y === cell.y
        )
      );
    };

    const addAtCellHard = (cell: { x: number; y: number }) => {
      const target = addTargetRef.current;
      const cellKey = `${target}:${cell.x},${cell.y}`;

      if (addHoldVisitedCellsRef.current.has(cellKey)) {
        return;
      }

      addHoldVisitedCellsRef.current.add(cellKey);

      if (target === "none") {
        setSystemLog((prev) => [
          "[add] Build에서 AMR / Workstation / Goal / Wall 중 하나를 먼저 선택해.",
          ...prev,
        ].slice(0, 20));
        return;
      }

      setScenario((prevScenario) => {
        const nextScenario = cloneScenario(prevScenario);

        nextScenario.amrs = nextScenario.amrs.map((amr) => ({
          ...amr,
          path: [],
          status: "IDLE",
        }));

        if (target !== "goal" && isOccupied(nextScenario, cell)) {
          return prevScenario;
        }

        if (target === "amr") {
          const template = nextScenario.amrs[0];

          if (!template) {
            return prevScenario;
          }

          const colors = [
            "#2563eb",
            "#dc2626",
            "#16a34a",
            "#9333ea",
            "#f97316",
            "#0891b2",
          ];

          const id = nextId(
            "AMR_",
            nextScenario.amrs.map((amr) => amr.id),
            2
          );

          nextScenario.amrs.push({
            ...template,
            id,
            cell,
            startCell: cell,
            goalCell: undefined,
            path: [],
            status: "IDLE",
            color: colors[nextScenario.amrs.length % colors.length],
          });

          setSelectedStudioObject({ kind: "amr", id });
          setManualGoalAmrId(id);

          return nextScenario;
        }

        if (target === "workstation") {
          const template = nextScenario.workstations[0];

          if (!template) {
            return prevScenario;
          }

          const id = nextId(
            "W",
            nextScenario.workstations.map((workstation) => workstation.id)
          );

          nextScenario.workstations.push({
            ...template,
            id,
            cell,
          });

          setSelectedStudioObject({ kind: "workstation", id });

          return nextScenario;
        }

        if (target === "wall") {
          const id = nextId(
            "OBS_",
            nextScenario.obstacles.map((obstacle) => obstacle.id),
            2
          );

          nextScenario.obstacles.push({
            id,
            cell,
          } as (typeof nextScenario.obstacles)[number]);

          return nextScenario;
        }

        if (target === "goal") {
          const obstacleExists = nextScenario.obstacles.some(
            (obstacle) => obstacle.cell.x === cell.x && obstacle.cell.y === cell.y
          );

          if (obstacleExists || nextScenario.amrs.length === 0) {
            return prevScenario;
          }

          const firstWithoutGoal = nextScenario.amrs.find(
            (amr) => !(amr as { goalCell?: { x: number; y: number } }).goalCell
          );

          const fallbackAmr =
            nextScenario.amrs[
              goalRoundRobinRef.current % Math.max(1, nextScenario.amrs.length)
            ];

          const targetAmr = firstWithoutGoal ?? fallbackAmr;

          if (!targetAmr) {
            return prevScenario;
          }

          goalRoundRobinRef.current += 1;

          nextScenario.amrs = nextScenario.amrs.map((amr) =>
            amr.id === targetAmr.id
              ? ({
                  ...amr,
                  goalCell: cell,
                  path: [],
                  status: "IDLE",
                } as typeof amr)
              : amr
          );

          setManualGoalAmrId(targetAmr.id);

          return nextScenario;
        }

        return prevScenario;
      });

      setCurrentTick(0);
      setIsRunning(false);
    };

    const startAddHold = (clientX: number, clientY: number) => {
      if (addPlacementModeRef.current !== "add") {
        return;
      }

      const cell = getCellFromClientPoint(clientX, clientY);

      if (!cell) {
        return;
      }

      addHoldActiveRef.current = true;
      addHoldVisitedCellsRef.current = new Set();

      addAtCellHard(cell);
    };

    const moveAddHold = (clientX: number, clientY: number) => {
      if (addPlacementModeRef.current !== "add") {
        return;
      }

      if (!addHoldActiveRef.current) {
        return;
      }

      const cell = getCellFromClientPoint(clientX, clientY);

      if (!cell) {
        return;
      }

      addAtCellHard(cell);
    };

    const stopAddHold = () => {
      addHoldActiveRef.current = false;
      addHoldVisitedCellsRef.current = new Set();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      if (addPlacementModeRef.current !== "add") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      startAddHold(event.clientX, event.clientY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (addPlacementModeRef.current !== "add") {
        return;
      }

      if (!addHoldActiveRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      moveAddHold(event.clientX, event.clientY);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      if (addPlacementModeRef.current !== "add") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      startAddHold(event.clientX, event.clientY);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (addPlacementModeRef.current !== "add") {
        return;
      }

      if (!addHoldActiveRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      moveAddHold(event.clientX, event.clientY);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", stopAddHold, true);
    window.addEventListener("pointercancel", stopAddHold, true);

    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", stopAddHold, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", stopAddHold, true);
      window.removeEventListener("pointercancel", stopAddHold, true);

      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", stopAddHold, true);
    };
  }, [scenario.width, scenario.height, selectedStudioObject]);


  const repairParseFleetCommand = () => {
    const raw = commandInput.trim();
    const lowered = raw.toLowerCase();

    let requestedWorkstationIds: string[] = [];
    let priority: "nearest" | "input_order" = "nearest";

    try {
      const parsed = JSON.parse(raw) as {
        fill?: string[];
        workstations?: string[];
        priority?: string;
      };

      const fill = parsed.fill ?? parsed.workstations ?? [];
      requestedWorkstationIds = fill.map((item) => String(item).toUpperCase());

      if (parsed.priority === "input_order" || parsed.priority === "priority") {
        priority = "input_order";
      }
    } catch {
      const matches = [...raw.matchAll(/(?:W|w|작업대\s*)(\d+)/g)];
      requestedWorkstationIds = matches.map((match) => `W${Number(match[1])}`);

      if (
        lowered.includes("먼저") ||
        lowered.includes("우선") ||
        lowered.includes("순서") ||
        lowered.includes("priority") ||
        lowered.includes("input")
      ) {
        priority = "input_order";
      }

      if (
        lowered.includes("가까운") ||
        lowered.includes("최단") ||
        lowered.includes("nearest") ||
        lowered.includes("closest")
      ) {
        priority = "nearest";
      }
    }

    if (
      requestedWorkstationIds.length === 0 ||
      lowered.includes("모든") ||
      lowered.includes("전체") ||
      lowered.includes("all")
    ) {
      requestedWorkstationIds = scenario.workstations.map((workstation) =>
        workstation.id.toUpperCase()
      );
    }

    const validWorkstations = scenario.workstations.filter((workstation) =>
      requestedWorkstationIds.includes(workstation.id.toUpperCase())
    );

    return {
      priority,
      workstations:
        validWorkstations.length > 0 ? validWorkstations : scenario.workstations,
    };
  };

  const repairBfsPath = (
    start: { x: number; y: number },
    goal: { x: number; y: number }
  ) => {
    const blocked = new Set(
      scenario.obstacles.map((obstacle) => `${obstacle.cell.x},${obstacle.cell.y}`)
    );

    const queue: Array<{ x: number; y: number }> = [start];
    const cameFrom = new Map<string, string | null>();
    const startKey = `${start.x},${start.y}`;
    const goalKey = `${goal.x},${goal.y}`;

    cameFrom.set(startKey, null);

    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.x},${current.y}`;

      if (currentKey === goalKey) {
        break;
      }

      for (const dir of dirs) {
        const next = {
          x: current.x + dir.x,
          y: current.y + dir.y,
        };

        const nextKey = `${next.x},${next.y}`;

        if (
          next.x < 0 ||
          next.y < 0 ||
          next.x >= scenario.width ||
          next.y >= scenario.height ||
          blocked.has(nextKey) ||
          cameFrom.has(nextKey)
        ) {
          continue;
        }

        cameFrom.set(nextKey, currentKey);
        queue.push(next);
      }
    }

    if (!cameFrom.has(goalKey)) {
      const fallback: Array<{ x: number; y: number; t: number }> = [];
      let x = start.x;
      let y = start.y;
      let t = 0;

      fallback.push({ x, y, t });

      while (x !== goal.x) {
        x += goal.x > x ? 1 : -1;
        t += 1;
        fallback.push({ x, y, t });
      }

      while (y !== goal.y) {
        y += goal.y > y ? 1 : -1;
        t += 1;
        fallback.push({ x, y, t });
      }

      return fallback;
    }

    const reversed: Array<{ x: number; y: number }> = [];
    let cursor: string | null = goalKey;

    while (cursor) {
      const [x, y] = cursor.split(",").map(Number);
      reversed.push({ x, y });
      cursor = cameFrom.get(cursor) ?? null;
    }

    return reversed.reverse().map((cell, index) => ({
      ...cell,
      t: index,
    }));
  };

  const repairGetPathCellAtTick = (
    amr: (typeof scenario.amrs)[number],
    tick: number
  ) => {
    if (!amr.path || amr.path.length === 0) {
      return amr.cell;
    }

    const exact = amr.path.find((cell) => cell.t === tick);

    if (exact) {
      return exact;
    }

    if (tick <= amr.path[0].t) {
      return amr.path[0];
    }

    return amr.path[amr.path.length - 1];
  };

  // Replay tick controller repair v1.
  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const maxTick = Math.max(
      0,
      ...scenario.amrs.flatMap((amr) => (amr.path ?? []).map((cell) => cell.t))
    );

    if (maxTick <= 0) {
      setIsRunning(false);
      setSystemLog((prev) => [
        "[replay] No path found. Run Plan Only first.",
        ...prev,
      ].slice(0, 20));
      return;
    }

    const delay = Math.max(60, Math.round(240 / Math.max(0.25, playbackSpeed)));

    const timer = window.setTimeout(() => {
      setCurrentTick((prevTick) => {
        const nextTick = Math.min(prevTick + 1, maxTick);

        setScenario((prevScenario) => {
          const nextScenario = cloneScenario(prevScenario);

          nextScenario.amrs = nextScenario.amrs.map((amr) => {
            if (!amr.path || amr.path.length === 0) {
              return {
                ...amr,
                status: "IDLE",
              };
            }

            const cell = repairGetPathCellAtTick(amr, nextTick);
            const previousCell = repairGetPathCellAtTick(amr, Math.max(0, nextTick - 1));
            const finalCell = amr.path[amr.path.length - 1];

            return {
              ...amr,
              cell: {
                x: cell.x,
                y: cell.y,
              },
              status:
                nextTick >= finalCell.t
                  ? "DONE"
                  : cell.x === previousCell.x && cell.y === previousCell.y
                    ? "WAITING"
                    : "MOVING",
            };
          });

          return nextScenario;
        });

        if (nextTick >= maxTick) {
          window.setTimeout(() => {
            setIsRunning(false);
            setSystemLog((prev) => [
              "[replay] Fleet replay completed.",
              ...prev,
            ].slice(0, 20));
          }, 0);
        }

        return nextTick;
      });
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isRunning, currentTick, playbackSpeed, scenario.amrs]);


  return (
    <main className="app-shell" style={{ paddingRight: agentPanelWidth + 38 }}>
      <header
        className="forced-top-toolbar"
        style={{ right: agentPanelWidth + 58 }}
      >
        <div className="forced-toolbar-group final-editor-toolbar-group">
          <span>Edit</span>

          <button
            className={placementMode === "select" ? "active" : ""}
            onClick={() => {
              setIsEditMode(true);
              setObstacleBrushMode(null);
              setPlacementMode("select");
              setIsToolPanelOpen(false);
            }}
          >
            Select
          </button>

          <button
            className={placementMode === "delete" ? "active red" : ""}
            onClick={() => {
              setIsEditMode(true);
              setObstacleBrushMode(null);
              setPlacementMode("delete");
              setIsToolPanelOpen(false);
            }}
          >
            Delete
          </button>

          <button
            className={placementMode === "add" ? "active green" : ""}
            onClick={() => {
              setIsEditMode(true);
              setObstacleBrushMode(null);
              setPlacementMode("add");
              setAddTarget("none");
              setIsToolPanelOpen(false);
            }}
          >
            Add
          </button>
        </div>

                <div className="forced-toolbar-group final-wall-toolbar-group final-build-toolbar-group">
          <span>Build</span>

          <button
            className={placementMode === "add" && addTarget === "wall" ? "active green" : ""}
            onClick={() => {
              setIsEditMode(true);
              setObstacleBrushMode(null);
              setPlacementMode("add");
              setAddTarget("wall");
              setIsToolPanelOpen(false);
            }}
          >
            Wall
          </button>



          <button
            className={placementMode === "add" && addTarget === "amr" ? "active green" : ""}
            onClick={() => {
              setIsEditMode(true);
              setObstacleBrushMode(null);
              setPlacementMode("add");
              setAddTarget("amr");
              setIsToolPanelOpen(false);
            }}
          >
            AMR
          </button>

          <button
            className={placementMode === "add" && addTarget === "workstation" ? "active green" : ""}
            onClick={() => {
              setIsEditMode(true);
              setObstacleBrushMode(null);
              setPlacementMode("add");
              setAddTarget("workstation");
              setIsToolPanelOpen(false);
            }}
          >
            Workstation
          </button>

          <button
            className={placementMode === "add" && addTarget === "goal" ? "active green" : ""}
            onClick={() => {
              setIsEditMode(true);
              setObstacleBrushMode(null);
              setPlacementMode("add");
              setAddTarget("goal");
              setIsToolPanelOpen(false);
            }}
          >
            Goal
          </button>


          

          <button onClick={handleReindexIds}>
            Reindex
          </button>

          <button onClick={() => setIsToolPanelOpen(false)}>
            Hide
          </button>
        </div>

        

        

        

        

        <div className="forced-toolbar-group">
          <span>Agent</span>

          <button
            onClick={() =>
              loadAgentQuickCommand("모든 작업대를 가장 가까운 AMR로 채워줘")
            }
          >
            Nearest
          </button>

          <button
            onClick={() =>
              loadAgentQuickCommand("작업대 3 먼저 채우고 작업대 1도 처리해")
            }
          >
            Priority
          </button>

          <button
            onClick={() =>
              loadAgentQuickCommand(
                JSON.stringify(
                  { fill: ["W1", "W2", "W3"], priority: "nearest" },
                  null,
                  2
                )
              )
            }
          >
            JSON
          </button>
        </div>

        <div className="forced-toolbar-group">
          <span>Dataset</span>
          <button onClick={handleExportDataset}>Export</button>
          <button onClick={handleExportSnapshot}>PNG</button>
          <button onClick={handleValidateDataset}>Validate</button>
        </div>
      </header>
      <aside className="restored-left-rail">
        <section className="rail-brand-card">
          <div className="rail-brand-dot" />
          <div>
            <h1>Fleet Studio</h1>
            <p>{isRunning ? "RUNNING" : "IDLE"}</p>
          </div>
        </section>

        <section className="rail-card">
          <p className="rail-card-title">Scenario</p>
          <select
            value={selectedScenarioId}
            onChange={(event) => {
              resetToScenario(event.target.value);
            }}
          >
            {customScenario ? (
              <option value={customScenario.id}>{customScenario.name}</option>
            ) : null}
            {scenarioList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <button onClick={handleExportScenario}>Export Scenario</button>

          <input
            id="left-scenario-import"
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              handleImportScenario(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <button
            onClick={() => {
              document.getElementById("left-scenario-import")?.click();
            }}
          >
            Import Scenario
          </button>
        </section>

        

        <section className="rail-card">
          <p className="rail-card-title">Fleet Stats</p>
          <div className="rail-stats-grid">
            <div>
              <span>AMR</span>
              <strong>{scenario.amrs.length}</strong>
            </div>
            <div>
              <span>WS</span>
              <strong>{scenario.workstations.length}</strong>
            </div>
            <div>
              <span>OBS</span>
              <strong>{scenario.obstacles.length}</strong>
            </div>
            <div>
              <span>Tick</span>
              <strong>{Math.min(currentTick, getLastPathTick(scenario.amrs))}</strong>
            </div>
          </div>
        </section>

        <section className="rail-card rail-shortcuts">
          <p className="rail-card-title">Quick Actions</p>

          <button
            onClick={() =>
              loadAgentQuickCommand("모든 작업대를 가장 가까운 AMR로 채워줘")
            }
          >
            Load Nearest Command
          </button>

          <button
            onClick={() =>
              loadAgentQuickCommand("작업대 3 먼저 채우고 작업대 1도 처리해")
            }
          >
            Load Priority Command
          </button>

          <button
            onClick={() =>
              loadAgentQuickCommand(
                JSON.stringify(
                  { fill: ["W1", "W2", "W3"], priority: "nearest" },
                  null,
                  2
                )
              )
            }
          >
            Load JSON Command
          </button>

          <div className="rail-shortcut-hints">
            <span>Space · Play/Pause</span>
            <span>P · Plan Only</span>
            <span>R · Replay</span>
            <span>Esc · Close Tool</span>
          </div>
        </section>
      </aside>
      <section className="hero">
        <div>
          <p className="eyebrow">VISIONSPACE TESSERACT Assignment</p>
          <h1>Robot Fleet Web Studio</h1>
          <p className="subtitle">
            Step 6: Synthetic episode dataset export and validation.
          </p>
        </div>

        <div className="status-card">
          <span className={isRunning ? "status-dot running" : "status-dot"} />
          <div>
            <p className="status-label">Simulation Status</p>
            <strong>{isRunning ? "RUNNING" : "IDLE"}</strong>
          </div>
        </div>
      </section>

      

        <section className="center-work-area">
          <section className="main-stage">
          <div className="stage-header">
            <div>
              <p>Simulation Stage</p>
              <h2>{scenario.name}</h2>
            </div>
            <div className="stage-hints">
              <span>20x20+ Grid</span>
              <span>Time A*</span>
              <span>Reservation Table</span>
              <span>Global Arbiter</span>
            </div>
          </div>

          <div className="stage-canvas-wrap">
            <ViewTimelineControls
              cellSize={cellSize}
              currentTick={currentTick}
              maxTick={getLastPathTick(scenario.amrs)}
              isRunning={isRunning}
              playbackSpeed={playbackSpeed}
              setPlaybackSpeed={setPlaybackSpeed}
              onFitView={handleFitView}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoom={handleResetZoom}
              onSetTick={applyScenarioAtTick}
              onStepBackward={handleStepBackward}
              onStepForward={handleStepForward}
              onStart={handleStart}
              onPause={handlePause}
            />

            <GridCanvas
              scenario={scenario}
              cellSize={cellSize}
              editable={isEditMode}
              selectedObject={selectedStudioObject}
              brushMode={obstacleBrushMode}
              onSelectObject={handleSelectStudioObject}
              onBrushCell={handleBrushCell}
              onMoveObject={(object, cell) => {
                handleMoveObject(object.kind, object.id, cell);
              }}
            />
          </div>
        </section>

          </section>

          <aside className="right-agent-panel">
            <div className="right-agent-header">
              <div>
                <p className="dock-eyebrow">Persistent Agent</p>
                <h2>AI Agent</h2>
              </div>
              <span>{agentDecisions.length} decisions</span>
            </div>

            <div className="right-agent-body">
              <div className="agent-command-card">
                <h3>Command</h3>
                <textarea
                  value={commandInput}
                  onChange={(event) => setCommandInput(event.target.value)}
                  spellCheck={false}
                />

                <div className="quick-command-row right-agent-quick">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setCommandInput("모든 작업대를 가장 가까운 AMR로 채워줘")
                    }
                  >
                    Fill All Nearest
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setCommandInput("작업대 3 먼저 채우고 작업대 1도 처리해")
                    }
                  >
                    Priority W3 → W1
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setCommandInput(
                        JSON.stringify(
                          { fill: ["W1", "W2", "W3"], priority: "nearest" },
                          null,
                          2
                        )
                      )
                    }
                  >
                    JSON Nearest
                  </button>
                </div>
              </div>

              <div className="agent-command-card">
                <h3>Agent Decisions</h3>
                <div className="decision-list right-decision-list">
                  {agentDecisions.length === 0 ? (
                    <p className="muted-text">No decision yet.</p>
                  ) : (
                    agentDecisions.map((decision) => (
                      <div className="decision-card" key={decision.taskId}>
                        <strong>
                          {decision.taskId}: {decision.amrId} → {decision.targetId}
                        </strong>
                        <p>
                          reason={decision.reason}, distance={decision.distance},
                          priority={decision.priority}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="agent-command-card">
                <h3>Fast Execute</h3>
                <div className="right-agent-actions">
                  <button onClick={handlePlanOnly}>Plan Only</button>
                  <button className="primary-action" onClick={handleStart}>
                    Start Fleet
                  </button>
                </div>
              </div>
            </div>
          </aside>

        <section className="bottom-log-console" style={{ height: logPanelHeight }}>
          <div className="log-resize-handle" onMouseDown={(event) => {
            event.preventDefault();
            setIsLogResizing(true);
          }} />
          <div className="log-tabs">
            <button
              className={activeLogTab === "system" ? "active" : ""}
              onClick={() => setActiveLogTab("system")}
            >
              System
            </button>

            <button
              className={activeLogTab === "arbiter" ? "active" : ""}
              onClick={() => setActiveLogTab("arbiter")}
            >
              Arbiter
            </button>
            <button
              className={activeLogTab === "reservation" ? "active" : ""}
              onClick={() => setActiveLogTab("reservation")}
            >
              Reservation
            </button>
            <button
              className={activeLogTab === "dataset" ? "active" : ""}
              onClick={() => setActiveLogTab("dataset")}
            >
              Dataset
            </button>
          </div>

          <div className="bottom-log-body">
            {activeLogTab === "system"
              ? systemLog.map((log, index) => (
                  <p key={`${log}-${index}`}>{log}</p>
                ))
              : null}



            {activeLogTab === "arbiter"
              ? arbiterReport.messages.map((log, index) => (
                  <p key={`${log}-${index}`}>{log}</p>
                ))
              : null}

            {activeLogTab === "reservation"
              ? reservationLog.length === 0
                ? <p>No reservation yet.</p>
                : reservationLog.map((log, index) => (
                    <p key={`${log}-${index}`}>{log}</p>
                  ))
              : null}

            {activeLogTab === "dataset"
              ? datasetLog.map((log, index) => (
                  <p key={`${log}-${index}`}>{log}</p>
                ))
              : null}
          </div>
        </section>
      <aside className={`fixed-agent-panel tab-${rightPanelTab}`} style={{ width: agentPanelWidth }}>
        <div
          className="agent-width-handle"
          onMouseDown={(event) => {
            event.preventDefault();
            setIsAgentResizing(true);
          }}
        />

        <header className="fixed-agent-header">
          <div>
            <p className="dock-eyebrow">Always-on Agent</p>
            <h2>AI Agent</h2>
          </div>
          <span>{agentDecisions.length} decisions</span>
        </header>
        <nav className="right-panel-tabs" aria-label="Right panel tabs">
          <button
            className={rightPanelTab === "agent" ? "active" : ""}
            onClick={() => setRightPanelTab("agent")}
          >
            Agent
          </button>

          <button
            className={rightPanelTab === "scene" ? "active" : ""}
            onClick={() => setRightPanelTab("scene")}
          >
            Scene
          </button>

          <button
            className={rightPanelTab === "inspector" ? "active" : ""}
            onClick={() => setRightPanelTab("inspector")}
          >
            Inspector
          </button>
        </nav>


        <section className="fixed-agent-body">
          <div className="fixed-agent-card">
            <h3>Command</h3>
            <textarea
              value={commandInput}
              onChange={(event) => setCommandInput(event.target.value)}
              spellCheck={false}
            />

            <div className="fixed-agent-quick">
              <button
                className="secondary-button"
                onClick={() =>
                  loadAgentQuickCommand("모든 작업대를 가장 가까운 AMR로 채워줘")
                }
              >
                Fill All by Nearest
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  loadAgentQuickCommand("작업대 3 먼저 채우고 작업대 1도 처리해")
                }
              >
                Priority W3 → W1
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  loadAgentQuickCommand(
                    JSON.stringify(
                      { fill: ["W1", "W2", "W3"], priority: "nearest" },
                      null,
                      2
                    )
                  )
                }
              >
                JSON Nearest
              </button>
            </div>
          </div>

          <div className="fixed-agent-card">
            <h3>Fast Execute</h3>
            <div className="fixed-agent-actions">
              <button onClick={handlePlanOnly}>Plan Only</button>
              <button className="primary-action" onClick={handleStart}>
                Start Fleet
              </button>
            </div>
          </div>

          <div className="fixed-agent-card">
            <h3>Agent Decisions</h3>
            <div className="fixed-agent-decisions">
              {agentDecisions.length === 0 ? (
                <p className="muted-text">No decision yet.</p>
              ) : (
                agentDecisions.map((decision) => (
                  <div className="decision-card" key={decision.taskId}>
                    <strong>
                      {decision.taskId}: {decision.amrId} → {decision.targetId}
                    </strong>
                    <p>
                      reason={decision.reason}, distance={decision.distance},
                      priority={decision.priority}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="fixed-agent-card">
            <h3>Agent Log</h3>
            <div className="log-box fixed-agent-log">
              {agentLog.map((log, index) => (
                <p key={`${log}-${index}`}>{log}</p>
              ))}
            </div>
          </div>
          <div className="fixed-agent-card inspector-host-card">
            <SceneTreeInspector
              scenario={scenario}
              selectedObject={selectedStudioObject}
              multiSelectedObjects={multiSelectedObjects}
              selectedMoveX={selectedMoveX}
              selectedMoveY={selectedMoveY}
              setSelectedMoveX={setSelectedMoveX}
              setSelectedMoveY={setSelectedMoveY}
              onSelectObject={handleSelectStudioObject}
              onToggleMultiSelected={toggleMultiSelected}
              onSelectAllByKind={selectAllByKind}
              onClearMultiSelection={clearMultiSelection}
              onDeleteMultiSelected={deleteMultiSelectedObjects}
              onMoveSelected={handleMoveSelectedObjectByInput}
              onDeleteSelected={handleDeleteSelectedObject}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={scenarioHistory.length > 0}
              canRedo={redoStack.length > 0}
            />
          </div>
        </section>
      </aside>

      <button
        className="floating-agent-button"
        onClick={() => setIsAgentDrawerOpen(true)}
      >
        Agent
      </button>

      <AgentDrawer
        isOpen={isAgentDrawerOpen}
        commandInput={commandInput}
        setCommandInput={setCommandInput}
        agentDecisions={agentDecisions}
        agentLog={agentLog}
        onPlanOnly={handlePlanOnly}
        onStart={handleStart}
        onClose={() => setIsAgentDrawerOpen(false)}
      />
    </main>
  );
}

export default App;
