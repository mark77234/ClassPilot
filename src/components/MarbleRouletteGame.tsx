"use client";

import { Play, RefreshCw, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { addScoreEvent } from "@/lib/classpilot";
import type { ClassSession, DrawTarget, Student, Team } from "@/types/classpilot";

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
];

const PLACE_POINTS = [30, 25, 20, 15, 10, 8, 6, 4, 3, 2];

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
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<MarbleResult[]>([]);
  const [applied, setApplied] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<MarbleRuntime | undefined>(undefined);
  const candidates = useMemo(
    () => getCandidates(session.students, session.teams, target),
    [session.students, session.teams, target],
  );

  useEffect(() => {
    return () => {
      runtimeRef.current?.cleanup();
    };
  }, []);

  async function startGame() {
    if (!boardRef.current || candidates.length === 0) {
      return;
    }

    runtimeRef.current?.cleanup();
    setApplied(false);
    setResults([]);
    setRunning(true);

    const Matter = (await import("matter-js")).default;
    const container = boardRef.current;
    container.innerHTML = "";

    const width = Math.max(container.clientWidth, 760);
    const height = Math.max(container.clientHeight, 520);
    const engine = Matter.Engine.create();
    engine.gravity.y = 1.05;

    const render = Matter.Render.create({
      element: container,
      engine,
      options: {
        background: "transparent",
        height,
        pixelRatio: window.devicePixelRatio,
        showAngleIndicator: false,
        wireframes: false,
        width,
      },
    });
    const runner = Matter.Runner.create();
    const finished = new Set<number>();
    const ballMap = new Map<number, MarbleCandidate & { color: string }>();
    const finishBall = (ballId: number) => {
      if (finished.has(ballId)) {
        return;
      }

      const candidate = ballMap.get(ballId);
      if (!candidate) {
        return;
      }

      finished.add(ballId);
      setResults((current) => {
        if (current.some((result) => result.id === candidate.id)) {
          return current;
        }

        const rank = current.length + 1;
        return [
          ...current,
          {
            ...candidate,
            points: PLACE_POINTS[rank - 1] ?? 1,
            rank,
          },
        ];
      });

      if (finished.size === candidates.length) {
        window.setTimeout(() => setRunning(false), 350);
      }
    };

    const wallOptions = {
      isStatic: true,
      render: { fillStyle: "#173a52" },
    };
    const finishSensor = Matter.Bodies.rectangle(width / 2, height - 74, width, 96, {
      isSensor: true,
      isStatic: true,
      label: "finish-sensor",
      render: { fillStyle: "transparent" },
    });
    const bodies = [
      Matter.Bodies.rectangle(width / 2, height + 18, width + 80, 36, wallOptions),
      Matter.Bodies.rectangle(-18, height / 2, 36, height, wallOptions),
      Matter.Bodies.rectangle(width + 18, height / 2, 36, height, wallOptions),
      Matter.Bodies.rectangle(126, 178, 210, 16, {
        ...wallOptions,
        angle: -0.42,
      }),
      Matter.Bodies.rectangle(width - 126, 238, 220, 16, {
        ...wallOptions,
        angle: 0.42,
      }),
      Matter.Bodies.rectangle(width / 2, 318, 250, 14, {
        ...wallOptions,
        angle: -0.22,
        render: { fillStyle: "#245f8f" },
      }),
      finishSensor,
    ];

    for (let row = 0; row < 6; row += 1) {
      const count = row % 2 === 0 ? 8 : 7;
      const gap = width / (count + 1);
      for (let column = 0; column < count; column += 1) {
        bodies.push(
          Matter.Bodies.circle(
            gap * (column + 1) + (row % 2 === 0 ? 0 : gap / 2),
            118 + row * 56,
            11,
            {
              isStatic: true,
              restitution: 0.92,
              render: { fillStyle: row % 2 === 0 ? "#9fb5c7" : "#c8d7e3" },
            },
          ),
        );
      }
    }

    const balls = candidates.map((candidate, index) => {
      const color = MARBLE_COLORS[index % MARBLE_COLORS.length];
      const x = ((index + 1) / (candidates.length + 1)) * width;
      const ball = Matter.Bodies.circle(x, 34 + (index % 3) * 10, 15, {
        friction: 0.015,
        frictionAir: 0.006,
        label: `marble-${candidate.id}`,
        restitution: 0.78,
        render: {
          fillStyle: color,
          strokeStyle: "#ffffff",
          lineWidth: 3,
        },
      });
      ballMap.set(ball.id, { ...candidate, color });
      Matter.Body.setVelocity(ball, {
        x: (Math.random() - 0.5) * 5,
        y: Math.random() * 1.8,
      });
      return ball;
    });

    Matter.Composite.add(engine.world, [...bodies, ...balls]);
    Matter.Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const bodiesInPair = [pair.bodyA, pair.bodyB];
        const sensorHit = bodiesInPair.some(
          (body) => body.label === "finish-sensor",
        );
        const ball = bodiesInPair.find((body) => ballMap.has(body.id));

        if (!sensorHit || !ball || finished.has(ball.id)) {
          return;
        }

        finishBall(ball.id);
      });
    });
    Matter.Events.on(engine, "afterUpdate", () => {
      balls.forEach((ball) => {
        if (!finished.has(ball.id) && ball.position.y > height - 112) {
          finishBall(ball.id);
        }
      });
    });

    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);
    const nudgeInterval = window.setInterval(() => {
      balls.forEach((ball) => {
        if (!finished.has(ball.id)) {
          Matter.Body.applyForce(ball, ball.position, {
            x: (Math.random() - 0.5) * 0.006,
            y: 0.012,
          });
        }
      });
    }, 1600);
    const forceFinishTimer = window.setTimeout(() => {
      balls
        .filter((ball) => !finished.has(ball.id))
        .sort((left, right) => right.position.y - left.position.y)
        .forEach((ball) => finishBall(ball.id));
    }, 9000);

    runtimeRef.current = {
      cleanup: () => {
        window.clearInterval(nudgeInterval);
        window.clearTimeout(forceFinishTimer);
        Matter.Render.stop(render);
        Matter.Runner.stop(runner);
        Matter.World.clear(engine.world, false);
        Matter.Engine.clear(engine);
        render.canvas.remove();
        render.textures = {};
      },
    };
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
            onClick={() => {
              setTarget("team");
              setResults([]);
              setApplied(false);
            }}
            type="button"
          >
            팀 공 생성
          </button>
          <button
            className={target === "student" ? "active" : ""}
            disabled={session.students.length === 0 || running}
            onClick={() => {
              setTarget("student");
              setResults([]);
              setApplied(false);
            }}
            type="button"
          >
            개인 공 생성
          </button>
        </div>

        <div className="cp-game-controls">
          <button
            className="cp-secondary-button"
            disabled={running}
            onClick={() => {
              runtimeRef.current?.cleanup();
              runtimeRef.current = undefined;
              setResults([]);
              setApplied(false);
              setRunning(false);
            }}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={18} />
            리셋
          </button>
          <button
            className="cp-primary-button"
            disabled={candidates.length === 0 || running}
            onClick={startGame}
            type="button"
          >
            <Play aria-hidden="true" size={18} />
            공 떨어뜨리기
          </button>
        </div>
      </div>

      <div className="cp-marble-arena">
        <div className="cp-marble-physics-board" ref={boardRef}>
          <div className="cp-marble-placeholder">
            <strong>Marble Roulette</strong>
            <span>
              {candidates.length === 0
                ? target === "team"
                  ? "팀을 먼저 만들어주세요"
                  : "학생을 먼저 입력해주세요"
                : `${candidates.length}개의 공이 준비되었습니다`}
            </span>
          </div>
        </div>
        <aside className="cp-marble-result-board">
          <div>
            <p className="cp-section-label">완주 순서</p>
            <h3>{running ? "굴러가는 중" : "점수표"}</h3>
          </div>
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
