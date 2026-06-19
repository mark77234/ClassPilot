"use client";

import { Play, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { addScoreEvent } from "@/lib/classpilot";
import type {
  ClassSession,
  DrawTarget,
  MarbleBallState,
  MarbleRacePhase,
  Student,
  Team,
} from "@/types/classpilot";

type MarbleCandidate = {
  id: string;
  name: string;
  type: DrawTarget;
};

type MarbleResult = MarbleCandidate & {
  color: string;
  points: number;
  rank: number;
};

type MarbleRuntime = {
  cleanup: () => void;
  focusBall: (candidateId: string) => void;
  release: () => void;
};

type BallRuntimeState = MarbleCandidate & {
  color: string;
  startX: number;
  startY: number;
  checkpointY: number;
  lastActiveAt: number;
  lastPosition: { x: number; y: number };
  resets: number;
};

const MARBLE_COLORS = [
  "#c95f35",
  "#246b4b",
  "#245f8f",
  "#d9a722",
  "#a93b52",
  "#5b6f2a",
  "#7a4fb1",
  "#137a79",
  "#b6538f",
  "#536dfe",
  "#8a6b2d",
  "#2f7d62",
];

const PLACE_POINTS = [30, 25, 20, 15, 10, 8, 6, 4, 3, 2];
const WORLD_HEIGHT = 4200;
const MIN_VIEWPORT_SIZE = 320;
const FINISH_THRESHOLD = 184;
const STICKY_PIN_LABEL = "sticky-pin";
const BUMPER_PIN_LABEL = "bumper-pin";
const WARP_PIN_LABEL = "warp-pin";
const LAUNCHER_PIN_LABEL = "launcher-pin";
const BREAK_BAR_LABEL = "break-bar";

export function MarbleRouletteGame({
  session,
  setSession,
}: {
  session: ClassSession;
  setSession: (
    updater: ClassSession | ((session: ClassSession) => ClassSession),
  ) => void;
}) {
  const [target, setTarget] = useState<DrawTarget>(
    session.teams.length > 0 ? "team" : "student",
  );
  const [phase, setPhase] = useState<MarbleRacePhase>("idle");
  const [ballStates, setBallStates] = useState<MarbleBallState[]>([]);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [focusedBallId, setFocusedBallId] = useState<string>();
  const [results, setResults] = useState<MarbleResult[]>([]);
  const [applied, setApplied] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<MarbleRuntime | undefined>(undefined);
  const candidates = useMemo(
    () => getCandidates(session.students, session.teams, target),
    [session.students, session.teams, target],
  );
  const running = phase === "running";
  const generated = phase === "generated";

  useEffect(() => {
    return () => {
      runtimeRef.current?.cleanup();
    };
  }, []);

  function appendLog(message: string) {
    const time = new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date());

    setEventLog((current) => [`${time} ${message}`, ...current].slice(0, 9));
  }

  function resetRace() {
    runtimeRef.current?.cleanup();
    runtimeRef.current = undefined;
    setPhase("idle");
    setBallStates([]);
    setEventLog([]);
    setFocusedBallId(undefined);
    setResults([]);
    setApplied(false);
  }

  async function generateBalls() {
    if (!mountRef.current || candidates.length === 0) {
      return;
    }

    runtimeRef.current?.cleanup();
    setApplied(false);
    setResults([]);
    setFocusedBallId(undefined);
    setEventLog([]);

    const initialStates = candidates.map<MarbleBallState>((candidate, index) => ({
      ...candidate,
      color: MARBLE_COLORS[index % MARBLE_COLORS.length],
      resets: 0,
      status: "ready",
    }));
    setBallStates(initialStates);
    setPhase("generated");

    const Matter = (await import("matter-js")).default;
    const mount = mountRef.current;
    mount.innerHTML = "";

    const viewportSize = Math.max(
      Math.round(mount.clientWidth || mount.getBoundingClientRect().width),
      MIN_VIEWPORT_SIZE,
    );
    const width = viewportSize;
    const engine = Matter.Engine.create();
    engine.timing.timeScale = 0.58;
    engine.gravity.y = 0;

    const render = Matter.Render.create({
      element: mount,
      engine,
      options: {
        background: "transparent",
        hasBounds: true,
        height: viewportSize,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        showAngleIndicator: false,
        wireframes: false,
        width,
      },
    });
    render.canvas.style.width = `${width}px`;
    render.canvas.style.height = `${viewportSize}px`;
    render.canvas.style.transformOrigin = "top left";
    render.bounds.min.x = 0;
    render.bounds.max.x = width;
    render.bounds.min.y = 0;
    render.bounds.max.y = viewportSize;

    const runner = Matter.Runner.create();
    const finishedBodies = new Set<number>();
    const bodyByCandidateId = new Map<string, Matter.Body>();
    const runtimeByBodyId = new Map<number, BallRuntimeState>();
    const stickyConstraints = new Map<
      number,
      { constraint: Matter.Constraint; timer: number }
    >();
    const stickyCooldownUntil = new Map<string, number>();
    const breakBarIds = new Set<number>();
    const warpCooldownUntil = new Map<string, number>();
    let released = false;
    let assistEnabled = false;
    let cameraY = 0;
    let lastFocusId = "";
    let manualFocusBodyId: number | undefined;
    let manualFocusUntil = 0;

    const trackBodies = createTrackBodies(Matter, width);
    const balls = candidates.map((candidate, index) => {
      const color = MARBLE_COLORS[index % MARBLE_COLORS.length];
      const { x: startX, y: startY } = createStartPosition(
        index,
        candidates.length,
        width,
      );
      const ball = Matter.Bodies.circle(startX, startY, 19, {
        friction: 0.008,
        frictionAir: 0.024,
        label: `marble-${candidate.id}`,
        restitution: 0.76,
        render: {
          fillStyle: color,
          lineWidth: 4,
          strokeStyle: "#ffffff",
        },
      });

      runtimeByBodyId.set(ball.id, {
        ...candidate,
        checkpointY: 120,
        color,
        lastActiveAt: performance.now(),
        lastPosition: { x: startX, y: startY },
        resets: 0,
        startX,
        startY,
      });
      bodyByCandidateId.set(candidate.id, ball);

      return ball;
    });

    const finishSensor = Matter.Bodies.rectangle(
      width / 2,
      WORLD_HEIGHT - 106,
      width + 180,
      116,
      {
        isSensor: true,
        isStatic: true,
        label: "finish-sensor",
        render: { fillStyle: "rgba(217, 167, 34, 0.13)" },
      },
    );

    function updateBallState(
      candidateId: string,
      updater: (state: MarbleBallState) => MarbleBallState,
    ) {
      setBallStates((current) =>
        current.map((state) => (state.id === candidateId ? updater(state) : state)),
      );
    }

    function finishBall(body: Matter.Body) {
      if (finishedBodies.has(body.id)) {
        return;
      }

      const runtime = runtimeByBodyId.get(body.id);
      if (!runtime) {
        return;
      }

      finishedBodies.add(body.id);
      releaseStickyConstraint(body.id);
      const rank = finishedBodies.size;
      const points = PLACE_POINTS[rank - 1] ?? 1;

      Matter.Body.setVelocity(body, { x: 0, y: 0 });
      Matter.Body.setStatic(body, true);
      Matter.Body.setPosition(body, {
        x: 72 + ((rank - 1) % 8) * 82,
        y: WORLD_HEIGHT - 74 - Math.floor((rank - 1) / 8) * 50,
      });

      setResults((current) => {
        if (current.some((result) => result.id === runtime.id)) {
          return current;
        }

        return [
          ...current,
          {
            id: runtime.id,
            name: runtime.name,
            type: runtime.type,
            color: runtime.color,
            points,
            rank,
          },
        ];
      });
      updateBallState(runtime.id, (state) => ({
        ...state,
        rank,
        status: "finished",
      }));
      appendLog(`${runtime.name} ${rank}위 완주`);

      if (finishedBodies.size === candidates.length) {
        setPhase("finished");
        setFocusedBallId(undefined);
        appendLog("모든 공이 완주했습니다");
      }
    }

    function resetStuckBall(body: Matter.Body) {
      const runtime = runtimeByBodyId.get(body.id);
      if (!runtime || finishedBodies.has(body.id)) {
        return;
      }

      const resetX = runtime.startX;
      const resetY = runtime.startY;
      runtime.resets += 1;
      runtime.lastActiveAt = performance.now();
      runtime.lastPosition = { x: resetX, y: resetY };
      runtime.checkpointY = 120;

      releaseStickyConstraint(body.id);
      Matter.Body.setPosition(body, { x: resetX, y: resetY });
      Matter.Body.setVelocity(body, {
        x: 0,
        y: 1.15,
      });
      Matter.Body.setAngularVelocity(body, 0);
      updateBallState(runtime.id, (state) => ({
        ...state,
        resets: runtime.resets,
        status: "restarted",
      }));
      appendLog(`${runtime.name} 출발선 재시작`);
    }

    function releaseStickyConstraint(bodyId: number) {
      const stickyState = stickyConstraints.get(bodyId);

      if (!stickyState) {
        return;
      }

      window.clearTimeout(stickyState.timer);
      Matter.Composite.remove(engine.world, stickyState.constraint);
      stickyConstraints.delete(bodyId);
    }

    function attachStickyPin(ball: Matter.Body, stickyPin: Matter.Body) {
      if (!released || finishedBodies.has(ball.id) || stickyConstraints.has(ball.id)) {
        return;
      }

      const runtime = runtimeByBodyId.get(ball.id);
      if (!runtime) {
        return;
      }

      const cooldownKey = `${ball.id}:${stickyPin.id}`;
      const now = performance.now();
      if ((stickyCooldownUntil.get(cooldownKey) ?? 0) > now) {
        return;
      }

      Matter.Body.setVelocity(ball, { x: 0, y: 0.04 });
      Matter.Body.setAngularVelocity(ball, 0);
      const constraint = Matter.Constraint.create({
        bodyA: stickyPin,
        bodyB: ball,
        damping: 0.22,
        length: 28,
        render: { visible: false },
        stiffness: 0.72,
      });
      Matter.Composite.add(engine.world, constraint);
      appendLog(`${runtime.name} 끈끈이 장애물`);

      const timer = window.setTimeout(() => {
        Matter.Composite.remove(engine.world, constraint);
        stickyConstraints.delete(ball.id);
        stickyCooldownUntil.set(cooldownKey, performance.now() + 2600);

        if (finishedBodies.has(ball.id)) {
          return;
        }

        Matter.Body.setVelocity(ball, { x: 0, y: 1.48 });
      }, 900 + Math.random() * 900);

      stickyConstraints.set(ball.id, { constraint, timer });
    }

    function launchFromBumper(ball: Matter.Body, bumper: Matter.Body) {
      const runtime = runtimeByBodyId.get(ball.id);
      if (!runtime || finishedBodies.has(ball.id)) {
        return;
      }

      const cooldownKey = `bumper:${ball.id}:${bumper.id}`;
      const now = performance.now();
      if ((warpCooldownUntil.get(cooldownKey) ?? 0) > now) {
        return;
      }

      warpCooldownUntil.set(cooldownKey, now + 900);
      releaseStickyConstraint(ball.id);
      const horizontalDirection =
        ball.position.x >= bumper.position.x ? 1 : -1;
      Matter.Body.setVelocity(ball, {
        x: horizontalDirection * (3.4 + Math.random() * 2.2),
        y: -6.6 - Math.random() * 2.4,
      });
      Matter.Body.setAngularVelocity(ball, horizontalDirection * 0.18);
      runtime.lastActiveAt = now;
      runtime.lastPosition = { x: ball.position.x, y: ball.position.y };
      appendLog(`${runtime.name} 탄성 범퍼 반동`);
    }

    function warpBallUp(ball: Matter.Body, warpPin: Matter.Body) {
      const runtime = runtimeByBodyId.get(ball.id);
      if (!runtime || finishedBodies.has(ball.id)) {
        return;
      }

      const cooldownKey = `${ball.id}:${warpPin.id}`;
      const now = performance.now();
      if ((warpCooldownUntil.get(cooldownKey) ?? 0) > now) {
        return;
      }

      releaseStickyConstraint(ball.id);
      const nextY = clamp(ball.position.y - (460 + Math.random() * 260), 118, WORLD_HEIGHT - 460);
      const nextX = clamp(
        ball.position.x + (Math.random() - 0.5) * 180,
        64,
        width - 64,
      );
      Matter.Body.setPosition(ball, { x: nextX, y: nextY });
      Matter.Body.setVelocity(ball, {
        x: (Math.random() - 0.5) * 1.4,
        y: 1.3,
      });
      runtime.lastActiveAt = now;
      runtime.lastPosition = { x: nextX, y: nextY };
      runtime.checkpointY = Math.max(120, Math.min(runtime.checkpointY, nextY));
      warpCooldownUntil.set(cooldownKey, now + 3600);
      appendLog(`${runtime.name} 위쪽 워프`);
    }

    function launchBallUp(ball: Matter.Body, launcherPin: Matter.Body) {
      const runtime = runtimeByBodyId.get(ball.id);
      if (!runtime || finishedBodies.has(ball.id)) {
        return;
      }

      const cooldownKey = `${ball.id}:${launcherPin.id}`;
      const now = performance.now();
      if ((warpCooldownUntil.get(cooldownKey) ?? 0) > now) {
        return;
      }

      releaseStickyConstraint(ball.id);
      Matter.Body.setVelocity(ball, {
        x: (Math.random() - 0.5) * 2.6,
        y: -4.8 - Math.random() * 1.8,
      });
      Matter.Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.2);
      runtime.lastActiveAt = now;
      runtime.lastPosition = { x: ball.position.x, y: ball.position.y };
      warpCooldownUntil.set(cooldownKey, now + 2400);
      appendLog(`${runtime.name} 점프 패드`);
    }

    function breakOneShotBar(ball: Matter.Body, breakBar: Matter.Body) {
      const runtime = runtimeByBodyId.get(ball.id);
      if (!runtime || breakBarIds.has(breakBar.id) || finishedBodies.has(ball.id)) {
        return;
      }

      breakBarIds.add(breakBar.id);
      Matter.Composite.remove(engine.world, breakBar);
      Matter.Body.setVelocity(ball, {
        x: (ball.position.x >= breakBar.position.x ? 1 : -1) * (1.4 + Math.random()),
        y: -3.2 - Math.random() * 1.8,
      });
      Matter.Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.16);
      runtime.lastActiveAt = performance.now();
      runtime.lastPosition = { x: ball.position.x, y: ball.position.y };
      appendLog(`${runtime.name} 1회성 바 파괴`);
    }

    function focusCameraOnBody(body: Matter.Body, forceFocusUpdate = false) {
      const runtime = runtimeByBodyId.get(body.id);

      if (runtime && (forceFocusUpdate || runtime.id !== lastFocusId)) {
        lastFocusId = runtime.id;
        setFocusedBallId(runtime.id);
      }

      const targetCameraY = clamp(
        body.position.y - viewportSize * 0.5,
        0,
        WORLD_HEIGHT - viewportSize,
      );
      cameraY = targetCameraY;
      render.bounds.min.y = targetCameraY;
      render.bounds.max.y = targetCameraY + viewportSize;
    }

    function updateCamera() {
      const now = performance.now();
      const manualFocusBody =
        manualFocusBodyId && now < manualFocusUntil
          ? balls.find((ball) => ball.id === manualFocusBodyId)
          : undefined;

      if (manualFocusBody) {
        focusCameraOnBody(manualFocusBody);
        return;
      }

      manualFocusBodyId = undefined;
      const activeBodies = balls
        .filter((ball) => !finishedBodies.has(ball.id))
        .sort(
          (left, right) =>
            right.position.y - left.position.y ||
            right.velocity.y - left.velocity.y,
        );
      const focusBody = activeBodies[0];

      if (!focusBody) {
        return;
      }

      focusCameraOnBody(focusBody);
    }

    Matter.Composite.add(engine.world, [...trackBodies, finishSensor, ...balls]);
    Matter.Events.on(render, "afterRender", () => {
      drawBallLabels(
        render.context,
        balls,
        runtimeByBodyId,
        finishedBodies,
        cameraY,
        viewportSize,
      );
    });
    Matter.Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const pairBodies = [pair.bodyA, pair.bodyB];
        const hitSensor = pairBodies.some((body) => body.label === "finish-sensor");
        const ball = pairBodies.find((body) => runtimeByBodyId.has(body.id));
        const stickyPin = pairBodies.find((body) =>
          body.label.startsWith(STICKY_PIN_LABEL),
        );
        const bumperPin = pairBodies.find((body) =>
          body.label.startsWith(BUMPER_PIN_LABEL),
        );
        const warpPin = pairBodies.find((body) =>
          body.label.startsWith(WARP_PIN_LABEL),
        );
        const launcherPin = pairBodies.find((body) =>
          body.label.startsWith(LAUNCHER_PIN_LABEL),
        );
        const breakBar = pairBodies.find((body) =>
          body.label.startsWith(BREAK_BAR_LABEL),
        );

        if (hitSensor && ball) {
          finishBall(ball);
        }

        if (ball && stickyPin) {
          attachStickyPin(ball, stickyPin);
        }

        if (ball && bumperPin) {
          launchFromBumper(ball, bumperPin);
        }

        if (ball && warpPin) {
          warpBallUp(ball, warpPin);
        }

        if (ball && launcherPin) {
          launchBallUp(ball, launcherPin);
        }

        if (ball && breakBar) {
          breakOneShotBar(ball, breakBar);
        }
      });
    });
    Matter.Events.on(engine, "afterUpdate", () => {
      const now = performance.now();

      balls.forEach((ball, index) => {
        if (finishedBodies.has(ball.id) || !released) {
          return;
        }

        const runtime = runtimeByBodyId.get(ball.id);
        if (!runtime) {
          return;
        }

        if (ball.position.y > runtime.checkpointY + 310) {
          runtime.checkpointY = Math.min(
            WORLD_HEIGHT - 360,
            Math.floor(ball.position.y / 320) * 320,
          );
        }

        const moved = Math.hypot(
          ball.position.x - runtime.lastPosition.x,
          ball.position.y - runtime.lastPosition.y,
        );
        const speed = Math.hypot(ball.velocity.x, ball.velocity.y);

        if (moved > 6 || speed > 0.1) {
          runtime.lastActiveAt = now;
          runtime.lastPosition = { x: ball.position.x, y: ball.position.y };
        } else if (now - runtime.lastActiveAt > 5000) {
          resetStuckBall(ball);
        }

        if (ball.position.y > WORLD_HEIGHT - FINISH_THRESHOLD) {
          finishBall(ball);
          return;
        }

        Matter.Body.applyForce(ball, ball.position, {
          x: 0,
          y: assistEnabled ? 0.0025 : 0.0009,
        });
      });

      if (released) {
        updateCamera();
      }
    });

    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);
    appendLog(`${candidates.length}개의 공을 생성했습니다`);

    const eventInterval = window.setInterval(() => {
      if (!released || finishedBodies.size === candidates.length) {
        return;
      }

      const activeBalls = balls.filter((ball) => !finishedBodies.has(ball.id));
      const eventName = pickRaceEvent();
      appendLog(eventName.label);
      activeBalls.forEach((ball, index) => {
        Matter.Body.applyForce(ball, ball.position, {
          x: eventName.x(index),
          y: eventName.y,
        });
      });
    }, 3600);
    let assistTimer: number | undefined;

    runtimeRef.current = {
      cleanup: () => {
        window.clearInterval(eventInterval);
        if (assistTimer !== undefined) {
          window.clearTimeout(assistTimer);
        }
        stickyConstraints.forEach((stickyState) => {
          window.clearTimeout(stickyState.timer);
        });
        stickyConstraints.clear();
        Matter.Render.stop(render);
        Matter.Runner.stop(runner);
        Matter.World.clear(engine.world, false);
        Matter.Engine.clear(engine);
        render.canvas.remove();
        render.textures = {};
      },
      focusBall: (candidateId: string) => {
        const body = bodyByCandidateId.get(candidateId);

        if (!body) {
          return;
        }

        manualFocusBodyId = body.id;
        manualFocusUntil = performance.now() + 3500;
        focusCameraOnBody(body, true);
      },
      release: () => {
        if (released) {
          return;
        }

        released = true;
        setPhase("running");
        setBallStates((current) =>
          current.map((state) => ({ ...state, status: "running" })),
        );
        appendLog("공을 떨어뜨렸습니다");
        const releasedAt = performance.now();
        engine.gravity.y = 0.25;
        assistTimer = window.setTimeout(() => {
          if (!released || finishedBodies.size === candidates.length) {
            return;
          }

          assistEnabled = true;
          appendLog("완주 보조 힘이 켜졌습니다");
        }, 22000);
        balls.forEach((ball, index) => {
          const runtime = runtimeByBodyId.get(ball.id);

          if (runtime) {
            runtime.lastActiveAt = releasedAt;
            runtime.lastPosition = { x: ball.position.x, y: ball.position.y };
          }

          Matter.Body.setVelocity(ball, {
            x: 0,
            y: 0.75 + (index % 4) * 0.05,
          });
          Matter.Body.setAngularVelocity(ball, 0);
        });
      },
    };
  }

  function dropBalls() {
    runtimeRef.current?.release();
  }

  function handleTargetChange(nextTarget: DrawTarget) {
    runtimeRef.current?.cleanup();
    runtimeRef.current = undefined;
    setTarget(nextTarget);
    setPhase("idle");
    setBallStates([]);
    setResults([]);
    setEventLog([]);
    setFocusedBallId(undefined);
    setApplied(false);
  }

  function applyTeamScores() {
    if (target !== "team" || results.length === 0) {
      return;
    }

    setSession((current) =>
      results.reduce(
        (nextSession, result) =>
          addScoreEvent(
            nextSession,
            result.id,
            result.points,
            `마블 룰렛 ${result.rank}위`,
          ),
        current,
      ),
    );
    setApplied(true);
  }

  return (
    <div className="cp-marble-game">
      <div className="cp-game-toolbar">
        <div className="cp-toggle-row">
          <button
            className={target === "team" ? "active" : ""}
            disabled={session.teams.length === 0 || running}
            onClick={() => handleTargetChange("team")}
            type="button"
          >
            팀 공
          </button>
          <button
            className={target === "student" ? "active" : ""}
            disabled={session.students.length === 0 || running}
            onClick={() => handleTargetChange("student")}
            type="button"
          >
            개인 공
          </button>
        </div>

        <div className="cp-game-controls">
          <button
            className="cp-secondary-button"
            disabled={running}
            onClick={resetRace}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={18} />
            리셋
          </button>
          <button
            className="cp-secondary-button"
            disabled={candidates.length === 0 || running}
            onClick={generateBalls}
            type="button"
          >
            <Sparkles aria-hidden="true" size={18} />
            공 생성하기
          </button>
          <button
            className="cp-primary-button"
            disabled={!generated}
            onClick={dropBalls}
            type="button"
          >
            <Play aria-hidden="true" size={18} />
            공 떨어뜨리기
          </button>
        </div>
      </div>

      <div className="cp-marble-arena">
        <div className="cp-marble-physics-board">
          <div className="cp-marble-canvas-mount" ref={mountRef} />
          {phase === "idle" && (
            <div className="cp-marble-placeholder">
              <strong>Marble Roulette</strong>
              <span>
                {candidates.length === 0
                  ? target === "team"
                    ? "팀을 먼저 만들어주세요"
                    : "학생을 먼저 입력해주세요"
                  : "공 생성하기를 눌러 출발선을 확인하세요"}
              </span>
            </div>
          )}
        </div>

        <aside className="cp-marble-result-board">
          <div>
            <p className="cp-section-label">레이스 상태</p>
            <h3>
              {phase === "running"
                ? "굴러가는 중"
                : phase === "finished"
                  ? "완주 완료"
                  : phase === "generated"
                    ? "공 준비 완료"
                    : "대기 중"}
            </h3>
          </div>

          <div className="cp-marble-focus">
            <span>카메라</span>
            <strong>
              {focusedBallId
                ? ballStates.find((ball) => ball.id === focusedBallId)?.name
                : phase === "finished"
                  ? "도착점"
                  : "출발선"}
            </strong>
          </div>

          <div className="cp-marble-legend">
            {ballStates.length === 0 ? (
              <p className="cp-empty-inline">공을 생성하면 색상표가 표시됩니다.</p>
            ) : (
              ballStates.map((ball) => (
                <button
                  aria-label={`${ball.name} 공 위치 보기`}
                  className={`cp-marble-legend-row${
                    focusedBallId === ball.id ? " active" : ""
                  }`}
                  key={ball.id}
                  onClick={() => runtimeRef.current?.focusBall(ball.id)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="cp-marble-color-dot"
                    style={{ background: ball.color }}
                  />
                  <strong>{ball.name}</strong>
                  <em>
                    {ball.rank
                      ? `${ball.rank}위`
                      : ball.status === "restarted"
                        ? `재출발 ${ball.resets}`
                        : ball.status === "running"
                          ? "진행"
                          : "준비"}
                  </em>
                </button>
              ))
            )}
          </div>

          <div className="cp-marble-results">
            <p className="cp-section-label">완주 순서</p>
            {results.length === 0 ? (
              <p className="cp-empty-inline">공이 도착하면 순위가 쌓입니다.</p>
            ) : (
              <ol>
                {results.map((result) => (
                  <li key={result.id}>
                    <span style={{ background: result.color }}>{result.rank}</span>
                    <strong>{result.name}</strong>
                    <em>+{result.points}</em>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="cp-marble-event-log">
            <p className="cp-section-label">이벤트</p>
            {eventLog.length === 0 ? (
              <p className="cp-empty-inline">레이스 이벤트가 여기에 기록됩니다.</p>
            ) : (
              eventLog.map((event, index) => (
                <span key={`${event}-${index}`}>{event}</span>
              ))
            )}
          </div>

          {target === "team" && results.length > 0 && (
            <button
              className="cp-primary-button"
              disabled={applied || running}
              onClick={applyTeamScores}
              type="button"
            >
              <Trophy aria-hidden="true" size={18} />
              {applied ? "팀 점수 반영 완료" : "순위 점수 반영"}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function createTrackBodies(Matter: typeof import("matter-js"), width: number) {
  const sideWallOptions = {
    friction: 0,
    isStatic: true,
    restitution: 1.08,
    render: {
      fillStyle: "#14324a",
      lineWidth: 2,
      strokeStyle: "#d7e8f2",
    },
  };
  const floorOptions = {
    friction: 0.02,
    isStatic: true,
    render: { fillStyle: "#173a52" },
  };
  const bodies = [
    Matter.Bodies.rectangle(10, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, {
      ...sideWallOptions,
      label: "left-bounce-wall",
    }),
    Matter.Bodies.rectangle(
      width - 10,
      WORLD_HEIGHT / 2,
      20,
      WORLD_HEIGHT,
      {
        ...sideWallOptions,
        label: "right-bounce-wall",
      },
    ),
    Matter.Bodies.rectangle(
      width / 2,
      WORLD_HEIGHT + 24,
      width + 120,
      48,
      floorOptions,
    ),
  ];
  let row = 0;
  for (let y = 350; y < WORLD_HEIGHT - 390; y += 142 + Math.random() * 64) {
    const count = 3 + Math.floor(Math.random() * 4);
    const gap = width / (count + 1);
    const rowShift = (Math.random() - 0.5) * gap * 0.34;

    const sideY = y + (row % 2 === 0 ? -18 : 18);
    bodies.push(
      createRoundObstacle(Matter, 50, sideY, row % 3 === 0 ? "bumper" : "normal", row, -1),
      createRoundObstacle(
        Matter,
        width - 50,
        sideY + (row % 2 === 0 ? 30 : -30),
        row % 3 === 1 ? "bumper" : "normal",
        row,
        count,
      ),
    );

    for (let column = 0; column < count; column += 1) {
      const roll = Math.random();
      const role =
        roll > 0.9
          ? "warp"
          : roll > 0.78
            ? "launcher"
            : roll > 0.58
              ? "bumper"
              : roll > 0.46
                ? "sticky"
                : "normal";
      const x = clamp(
        gap * (column + 1) + rowShift + (Math.random() - 0.5) * gap * 0.42,
        58,
        width - 58,
      );
      const pinY = y + (Math.random() - 0.5) * 42;

      bodies.push(createRoundObstacle(Matter, x, pinY, role, row, column));
    }

    if (row % 3 === 1) {
      const barWidth = Math.min(width * 0.36, 185 + Math.random() * 46);
      const barX = clamp(
        width * (row % 2 === 0 ? 0.34 : 0.66) + (Math.random() - 0.5) * 78,
        100,
        width - 100,
      );
      bodies.push(
        Matter.Bodies.rectangle(barX, y + 76, barWidth, 13, {
          friction: 0,
          isStatic: true,
          label: `${BREAK_BAR_LABEL}-${row}`,
          restitution: 1.08,
          render: {
            fillStyle: "#b6538f",
            lineWidth: 3,
            strokeStyle: "#f6d4eb",
          },
        }),
      );
    }
    row += 1;
  }

  return bodies;
}

type RoundObstacleRole = "normal" | "bumper" | "sticky" | "warp" | "launcher";

function createRoundObstacle(
  Matter: typeof import("matter-js"),
  x: number,
  y: number,
  role: RoundObstacleRole,
  row: number,
  column: number,
) {
  const radius =
    role === "bumper"
      ? 20
      : role === "sticky"
        ? 17
        : role === "warp"
          ? 18
          : role === "launcher"
            ? 16
            : 10 + Math.random() * 5;
  const label =
    role === "sticky"
      ? `${STICKY_PIN_LABEL}-${row}-${column}`
      : role === "bumper"
        ? `${BUMPER_PIN_LABEL}-${row}-${column}`
        : role === "warp"
          ? `${WARP_PIN_LABEL}-${row}-${column}`
          : role === "launcher"
            ? `${LAUNCHER_PIN_LABEL}-${row}-${column}`
            : `normal-pin-${row}-${column}`;

  return Matter.Bodies.circle(x, y, radius, {
    friction: role === "sticky" ? 0.08 : 0,
    isSensor: role === "warp" || role === "launcher",
    isStatic: true,
    label,
    restitution:
      role === "bumper"
        ? 1.72
        : role === "sticky"
          ? 0.12
          : role === "launcher"
            ? 1.1
            : 0.88,
    render: {
      fillStyle:
        role === "bumper"
          ? "#f0a33a"
          : role === "sticky"
            ? "#2f7d62"
            : role === "warp"
              ? "#536dfe"
              : role === "launcher"
                ? "#13a38f"
                : row % 2 === 0
                  ? "#c8d7e3"
                  : "#9fb5c7",
      strokeStyle:
        role === "bumper"
          ? "#fff1c7"
          : role === "sticky"
            ? "#c6f1d8"
            : role === "warp"
              ? "#dfe4ff"
              : role === "launcher"
                ? "#c9fff5"
                : "#ffffff",
      lineWidth: role === "normal" ? 2 : 4,
    },
  });
}

function drawBallLabels(
  context: CanvasRenderingContext2D,
  balls: Matter.Body[],
  runtimeByBodyId: Map<number, BallRuntimeState>,
  finishedBodies: Set<number>,
  cameraY: number,
  viewportSize: number,
) {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";

  balls.forEach((ball) => {
    const runtime = runtimeByBodyId.get(ball.id);
    if (!runtime) {
      return;
    }

    const screenY = ball.position.y - cameraY;
    if (screenY < -40 || screenY > viewportSize + 40) {
      return;
    }

    const label = shortenName(runtime.name);
    context.save();
    context.translate(ball.position.x, screenY);
    context.rotate(ball.angle);
    context.fillStyle = "#ffffff";
    context.strokeStyle = "rgba(18, 30, 38, 0.55)";
    context.lineWidth = 4;
    context.font = "900 11px Arial, sans-serif";
    context.strokeText(label, 0, finishedBodies.has(ball.id) ? -1 : 0);
    context.fillText(label, 0, finishedBodies.has(ball.id) ? -1 : 0);
    context.restore();
  });

  context.restore();
}

function pickRaceEvent() {
  const events = [
    {
      label: "낙하 속도 상승",
      x: (_index: number) => 0,
      y: 0.00032,
    },
    {
      label: "중력 가속 구간",
      x: (_index: number) => 0,
      y: 0.00048,
    },
    {
      label: "탄성 범퍼 흐름",
      x: (_index: number) => 0,
      y: 0.0002,
    },
    {
      label: "핀볼 구간 진입",
      x: (_index: number) => 0,
      y: 0.00038,
    },
  ];

  return events[Math.floor(Math.random() * events.length)];
}

function createStartPosition(
  index: number,
  total: number,
  width: number,
): { x: number; y: number } {
  const horizontalGap = 54;
  const verticalGap = 52;
  const sidePadding = 74;
  const maxColumns = Math.max(
    1,
    Math.floor((width - sidePadding * 2) / horizontalGap) + 1,
  );
  const columns = Math.min(total, maxColumns);
  const row = Math.floor(index / columns);
  const column = index % columns;
  const rowCount = Math.min(columns, total - row * columns);
  const rowWidth = (rowCount - 1) * horizontalGap;
  const rowStartX = width / 2 - rowWidth / 2;
  const x =
    columns === 1
      ? width / 2
      : rowCount === columns
      ? sidePadding + column * ((width - sidePadding * 2) / Math.max(columns - 1, 1))
      : rowStartX + column * horizontalGap;

  return {
    x: clamp(x, sidePadding, width - sidePadding),
    y: 72 + row * verticalGap,
  };
}

function getCandidates(
  students: Student[],
  teams: Team[],
  target: DrawTarget,
): MarbleCandidate[] {
  return target === "team"
    ? teams.map((team) => ({
        id: team.id,
        name: team.name,
        type: "team",
      }))
    : students.map((student) => ({
        id: student.id,
        name: student.name,
        type: "student",
      }));
}

function shortenName(name: string): string {
  return name.length > 5 ? `${name.slice(0, 5)}` : name;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
