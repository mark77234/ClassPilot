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
    engine.timing.timeScale = 0.38;
    engine.gravity.y = 0;

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

    const runner = Matter.Runner.create();
    const finishedBodies = new Set<number>();
    const bodyByCandidateId = new Map<string, Matter.Body>();
    const runtimeByBodyId = new Map<number, BallRuntimeState>();
    let released = false;
    let assistEnabled = false;
    let lastFocusId = "";
    let manualFocusBodyId: number | undefined;
    let manualFocusUntil = 0;

    const trackBodies = createTrackBodies(Matter, width);
    const balls = candidates.map((candidate, index) => {
      const color = MARBLE_COLORS[index % MARBLE_COLORS.length];
      const laneWidth = Math.max(54, (width - 160) / Math.max(candidates.length, 1));
      const startX = 80 + laneWidth * index + laneWidth / 2;
      const startY = 74 + (index % 3) * 12;
      const ball = Matter.Bodies.circle(startX, startY, 19, {
        friction: 0.008,
        frictionAir: 0.035,
        label: `marble-${candidate.id}`,
        restitution: 0.62,
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

      const resetY = clamp(runtime.checkpointY + 120, 118, WORLD_HEIGHT - 360);
      const resetX = clamp(
        runtime.lastPosition.x + (Math.random() - 0.5) * 76,
        74,
        width - 74,
      );
      runtime.resets += 1;
      runtime.lastActiveAt = performance.now();
      runtime.lastPosition = { x: resetX, y: resetY };

      Matter.Body.setPosition(body, { x: resetX, y: resetY });
      Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 0.85,
        y: 0.95,
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.025);
      updateBallState(runtime.id, (state) => ({
        ...state,
        resets: runtime.resets,
        status: "restarted",
      }));
      appendLog(`${runtime.name} 재출발`);
    }

    function focusCameraOnBody(body: Matter.Body) {
      const runtime = runtimeByBodyId.get(body.id);

      if (runtime && runtime.id !== lastFocusId) {
        lastFocusId = runtime.id;
        setFocusedBallId(runtime.id);
      }

      const targetCameraY = clamp(
        body.position.y - viewportSize * 0.5,
        0,
        WORLD_HEIGHT - viewportSize,
      );
      render.canvas.style.transform = `translateY(${-targetCameraY}px)`;
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

        const progressedDown = ball.position.y > runtime.lastPosition.y + 4;
        const movingDownFast = ball.velocity.y > 0.08;

        if (progressedDown || movingDownFast) {
          runtime.lastActiveAt = now;
          runtime.lastPosition = { x: ball.position.x, y: ball.position.y };
        } else if (now - runtime.lastActiveAt > 10000) {
          resetStuckBall(ball);
        }

        if (ball.position.y > WORLD_HEIGHT - FINISH_THRESHOLD) {
          finishBall(ball);
          return;
        }

        const windDirection = Math.sin(now / 650 + index) * 0.0027;
        Matter.Body.applyForce(ball, ball.position, {
          x: windDirection * 0.1 + (Math.random() - 0.5) * 0.0001,
          y: assistEnabled ? 0.0018 : 0.00055,
        });

        if (ball.position.x < 56 || ball.position.x > width - 56) {
          Matter.Body.applyForce(ball, ball.position, {
            x: ball.position.x < 56 ? 0.001 : -0.001,
            y: 0.0002,
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
    }, 3600);
    let assistTimer: number | undefined;

    runtimeRef.current = {
      cleanup: () => {
        window.clearInterval(eventInterval);
        if (assistTimer !== undefined) {
          window.clearTimeout(assistTimer);
        }
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
        focusCameraOnBody(body);
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
        engine.gravity.y = 0.16;
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
            x: (Math.random() - 0.5) * 0.7,
            y: 0.35 + (index % 4) * 0.05,
          });
          Matter.Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.025);
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
  const pinRows = Math.floor((WORLD_HEIGHT - 760) / 190);
  for (let row = 0; row < pinRows; row += 1) {
    const y = 620 + row * 190;
    const count = row % 2 === 0 ? 5 : 6;
    const gap = width / (count + 1);

    for (let column = 0; column < count; column += 1) {
      bodies.push(
        Matter.Bodies.circle(gap * (column + 1), y + (column % 2) * 24, 13, {
          friction: 0,
          isStatic: true,
          restitution: 0.92,
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
      x: (index: number) => -0.00032 - (index % 2) * 0.0001,
      y: 0.00018,
    },
    {
      label: "오른쪽 바람 구간",
      x: (index: number) => 0.00032 + (index % 2) * 0.0001,
      y: 0.00018,
    },
    {
      label: "느린 가속 구간",
      x: (index: number) => (index % 2 === 0 ? 0.00016 : -0.00016),
      y: 0.00055,
    },
    {
      label: "난류 발생",
      x: () => (Math.random() - 0.5) * 0.00065,
      y: 0.00028,
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

function shortenName(name: string): string {
  return name.length > 5 ? `${name.slice(0, 5)}` : name;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
