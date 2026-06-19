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
  release: () => void;
};

type BallRuntimeState = MarbleCandidate & {
  color: string;
  startX: number;
  startY: number;
  checkpointY: number;
  lastActiveAt: number;
  lastPosition: { x: number; y: number };
  raceBias: number;
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
const WORLD_HEIGHT = 2860;
const MIN_TRACK_WIDTH = 820;
const VIEWPORT_HEIGHT = 620;

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

    const width = Math.max(mount.clientWidth, MIN_TRACK_WIDTH);
    const viewportHeight = Math.max(mount.clientHeight, VIEWPORT_HEIGHT);
    const engine = Matter.Engine.create();
    engine.gravity.y = 0.92;

    const render = Matter.Render.create({
      element: mount,
      engine,
      options: {
        background: "transparent",
        height: WORLD_HEIGHT,
        pixelRatio: window.devicePixelRatio,
        showAngleIndicator: false,
        wireframes: false,
        width,
      },
    });
    render.canvas.style.width = `${width}px`;
    render.canvas.style.height = `${WORLD_HEIGHT}px`;
    render.canvas.style.transformOrigin = "top left";
    render.canvas.style.transition = "transform 120ms linear";

    const runner = Matter.Runner.create();
    const finishedBodies = new Set<number>();
    const runtimeByBodyId = new Map<number, BallRuntimeState>();
    const bodyByCandidateId = new Map<string, Matter.Body>();
    let released = false;
    let assistEnabled = false;
    let lastCameraY = 0;
    let lastFocusId = "";
    let raceStartedAt = 0;

    const trackBodies = createTrackBodies(Matter, width);
    const fallbackOrder = createFallbackOrder(candidates);
    const balls = candidates.map((candidate, index) => {
      const color = MARBLE_COLORS[index % MARBLE_COLORS.length];
      const laneWidth = Math.max(54, (width - 160) / Math.max(candidates.length, 1));
      const startX = 80 + laneWidth * index + laneWidth / 2;
      const startY = 86 + (index % 3) * 12;
      const ball = Matter.Bodies.circle(startX, startY, 19, {
        friction: 0.008,
        frictionAir: 0.004,
        isStatic: true,
        label: `marble-${candidate.id}`,
        restitution: 0.86,
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
        raceBias: (candidates.length - (fallbackOrder.get(candidate.id) ?? index)) * 100000,
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

      const resetY = clamp(
        runtime.checkpointY + 520 + runtime.resets * 180,
        118,
        WORLD_HEIGHT - 260,
      );
      const resetX = clamp(
        94 + Math.random() * Math.max(80, width - 188) + (Math.random() - 0.5) * 18,
        74,
        width - 74,
      );
      runtime.resets += 1;
      runtime.checkpointY = Math.max(runtime.checkpointY, resetY);
      runtime.lastActiveAt = performance.now();
      runtime.lastPosition = { x: resetX, y: resetY };

      Matter.Body.setPosition(body, { x: resetX, y: resetY });
      Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 6,
        y: 5.8,
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.16);
      updateBallState(runtime.id, (state) => ({
        ...state,
        resets: runtime.resets,
        status: "restarted",
      }));
      appendLog(`${runtime.name} 재출발`);
    }

    function updateCamera() {
      const activeBodies = balls
        .filter((ball) => !finishedBodies.has(ball.id))
        .sort((left, right) => right.position.y - left.position.y);
      const focusBody = activeBodies[0];

      if (!focusBody) {
        return;
      }

      const runtime = runtimeByBodyId.get(focusBody.id);
      if (runtime && runtime.id !== lastFocusId) {
        lastFocusId = runtime.id;
        setFocusedBallId(runtime.id);
      }

      const targetCameraY = clamp(
        focusBody.position.y - viewportHeight * 0.36,
        0,
        WORLD_HEIGHT - viewportHeight,
      );
      lastCameraY += (targetCameraY - lastCameraY) * 0.08;
      render.canvas.style.transform = `translateY(${-lastCameraY}px)`;
    }

    Matter.Composite.add(engine.world, [...trackBodies, finishSensor, ...balls]);
    Matter.Events.on(render, "afterRender", () => {
      drawBallLabels(render.context, balls, runtimeByBodyId, finishedBodies);
    });
    Matter.Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const pairBodies = [pair.bodyA, pair.bodyB];
        const hitSensor = pairBodies.some((body) => body.label === "finish-sensor");
        const ball = pairBodies.find((body) => runtimeByBodyId.has(body.id));

        if (hitSensor && ball) {
          finishBall(ball);
        }
      });
    });
    Matter.Events.on(engine, "afterUpdate", () => {
      const now = performance.now();

      if (
        raceStartedAt &&
        now - raceStartedAt > 26000 &&
        finishedBodies.size < candidates.length
      ) {
        balls
          .filter((ball) => !finishedBodies.has(ball.id))
          .sort((left, right) => {
            const leftRuntime = runtimeByBodyId.get(left.id);
            const rightRuntime = runtimeByBodyId.get(right.id);

            return (
              (fallbackOrder.get(leftRuntime?.id ?? "") ?? 0) -
              (fallbackOrder.get(rightRuntime?.id ?? "") ?? 0)
            );
          })
          .forEach((ball, index) => {
            const runtime = runtimeByBodyId.get(ball.id);

            Matter.Body.setPosition(ball, {
              x: 86 + ((index * 97) % Math.max(160, width - 172)),
              y: WORLD_HEIGHT - 132,
            });
            Matter.Body.setVelocity(ball, {
              x: (Math.random() - 0.5) * 3,
              y: 12,
            });

            if (runtime) {
              appendLog(`${runtime.name} 마지막 직선 구간 완주`);
            }
            finishBall(ball);
          });
        return;
      }

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

        if (moved > 9 || speed > 0.22) {
          runtime.lastActiveAt = now;
          runtime.lastPosition = { x: ball.position.x, y: ball.position.y };
        } else if (now - runtime.lastActiveAt > 5000) {
          resetStuckBall(ball);
        }

        if (ball.position.y > WORLD_HEIGHT - 184) {
          finishBall(ball);
          return;
        }

        const windDirection = Math.sin(now / 650 + index) * 0.0027;
        Matter.Body.applyForce(ball, ball.position, {
          x: windDirection + (Math.random() - 0.5) * 0.0009,
          y: assistEnabled ? 0.024 : 0.011,
        });

        if (ball.position.x < 56 || ball.position.x > width - 56) {
          Matter.Body.applyForce(ball, ball.position, {
            x: ball.position.x < 56 ? 0.009 : -0.009,
            y: 0.003,
          });
        }
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
    }, 2600);
    const assistTimer = window.setTimeout(() => {
      assistEnabled = true;
      appendLog("완주 보조 힘이 켜졌습니다");
    }, 10000);
    const emergencyTimer = window.setTimeout(() => {
      balls.forEach((ball, index) => {
        if (finishedBodies.has(ball.id)) {
          return;
        }

        Matter.Body.setPosition(ball, {
          x: 90 + ((index * 89) % Math.max(160, width - 180)),
          y: WORLD_HEIGHT - 430 - (index % 3) * 26,
        });
        Matter.Body.setVelocity(ball, {
          x: (Math.random() - 0.5) * 4,
          y: 10,
        });
      });
      appendLog("장시간 미완주 공을 마지막 구간으로 이동했습니다");
    }, 22000);

    runtimeRef.current = {
      cleanup: () => {
        window.clearInterval(eventInterval);
        window.clearTimeout(assistTimer);
        window.clearTimeout(emergencyTimer);
        Matter.Render.stop(render);
        Matter.Runner.stop(runner);
        Matter.World.clear(engine.world, false);
        Matter.Engine.clear(engine);
        render.canvas.remove();
        render.textures = {};
      },
      release: () => {
        if (released) {
          return;
        }

        released = true;
        raceStartedAt = performance.now();
        setPhase("running");
        setBallStates((current) =>
          current.map((state) => ({ ...state, status: "running" })),
        );
        appendLog("공을 떨어뜨렸습니다");
        balls.forEach((ball, index) => {
          Matter.Body.setStatic(ball, false);
          Matter.Body.setVelocity(ball, {
            x: (Math.random() - 0.5) * 7,
            y: 3.2 + (index % 4) * 0.65,
          });
          Matter.Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.25);
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
                <div className="cp-marble-legend-row" key={ball.id}>
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
                </div>
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
              eventLog.map((event) => <span key={event}>{event}</span>)
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
  const wallOptions = {
    friction: 0.02,
    isStatic: true,
    render: { fillStyle: "#173a52" },
  };
  const railOptions = {
    friction: 0.01,
    isStatic: true,
    restitution: 0.84,
    render: { fillStyle: "#245f8f" },
  };
  const goldRailOptions = {
    ...railOptions,
    render: { fillStyle: "#d9a722" },
  };
  const bodies = [
    Matter.Bodies.rectangle(-24, WORLD_HEIGHT / 2, 48, WORLD_HEIGHT, wallOptions),
    Matter.Bodies.rectangle(
      width + 24,
      WORLD_HEIGHT / 2,
      48,
      WORLD_HEIGHT,
      wallOptions,
    ),
    Matter.Bodies.rectangle(
      width / 2,
      WORLD_HEIGHT + 24,
      width + 120,
      48,
      wallOptions,
    ),
  ];
  const railRows = [
    { y: 245, x: width * 0.38, angle: 0.18, length: width * 0.72 },
    { y: 475, x: width * 0.62, angle: -0.2, length: width * 0.74 },
    { y: 710, x: width * 0.36, angle: 0.24, length: width * 0.66 },
    { y: 955, x: width * 0.64, angle: -0.24, length: width * 0.68 },
    { y: 1215, x: width * 0.37, angle: 0.2, length: width * 0.76 },
    { y: 1485, x: width * 0.63, angle: -0.21, length: width * 0.72 },
    { y: 1755, x: width * 0.35, angle: 0.25, length: width * 0.62 },
    { y: 2025, x: width * 0.65, angle: -0.25, length: width * 0.64 },
    { y: 2280, x: width * 0.5, angle: 0.14, length: width * 0.54 },
  ];

  railRows.forEach((rail, index) => {
    bodies.push(
      Matter.Bodies.rectangle(rail.x, rail.y, rail.length, 18, {
        ...(index % 3 === 0 ? goldRailOptions : railOptions),
        angle: rail.angle,
      }),
    );
  });

  for (let row = 0; row < 12; row += 1) {
    const y = 350 + row * 190;
    const count = row % 2 === 0 ? 5 : 6;
    const gap = width / (count + 1);

    for (let column = 0; column < count; column += 1) {
      bodies.push(
        Matter.Bodies.circle(gap * (column + 1), y + (column % 2) * 24, 13, {
          friction: 0,
          isStatic: true,
          restitution: 1.04,
          render: {
            fillStyle: row % 2 === 0 ? "#c8d7e3" : "#9fb5c7",
            strokeStyle: "#ffffff",
            lineWidth: 2,
          },
        }),
      );
    }
  }

  return bodies;
}

function drawBallLabels(
  context: CanvasRenderingContext2D,
  balls: Matter.Body[],
  runtimeByBodyId: Map<number, BallRuntimeState>,
  finishedBodies: Set<number>,
) {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";

  balls.forEach((ball) => {
    const runtime = runtimeByBodyId.get(ball.id);
    if (!runtime) {
      return;
    }

    const label = shortenName(runtime.name);
    context.save();
    context.translate(ball.position.x, ball.position.y);
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
      label: "왼쪽 바람 구간",
      x: (index: number) => -0.0045 - (index % 2) * 0.001,
      y: 0.004,
    },
    {
      label: "오른쪽 바람 구간",
      x: (index: number) => 0.0045 + (index % 2) * 0.001,
      y: 0.004,
    },
    {
      label: "가속 레일 진입",
      x: (index: number) => (index % 2 === 0 ? 0.002 : -0.002),
      y: 0.013,
    },
    {
      label: "난류 발생",
      x: () => (Math.random() - 0.5) * 0.011,
      y: 0.007,
    },
  ];

  return events[Math.floor(Math.random() * events.length)];
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

function createFallbackOrder(candidates: MarbleCandidate[]): Map<string, number> {
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const matchesOriginalOrder = shuffled.every(
    (candidate, index) => candidate.id === candidates[index]?.id,
  );
  const ordered = matchesOriginalOrder && shuffled.length > 1 ? shuffled.reverse() : shuffled;

  return new Map(ordered.map((candidate, index) => [candidate.id, index]));
}

function shortenName(name: string): string {
  return name.length > 5 ? `${name.slice(0, 5)}` : name;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
