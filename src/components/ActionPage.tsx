"use client";

import {
  ArrowLeft,
  BarChart3,
  Clock3,
  CheckCircle2,
  Dice5,
  ListOrdered,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Shuffle,
  Sparkles,
  Trash2,
  Trophy,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { MarbleRouletteGame } from "@/components/MarbleRouletteGame";
import { useClassSession } from "@/hooks/useClassSession";
import {
  addScoreEvent,
  addTeam,
  assignTopicToTeam,
  changePollVote,
  createPoll,
  createPresentationOrder,
  createStudentPresentationOrder,
  createManualTeams,
  createTeams,
  createTimer,
  deleteTeamFromSession,
  finishSession,
  formatEventTime,
  formatTime,
  getActionCompleteSection,
  getActionDefinition,
  getUnassignedStudents,
  getPollTotalVotes,
  getRankedTeams,
  getWinnerTeam,
  isActionId,
  moveStudentToTeam,
  pickRandomStudent,
  renameTeam,
  withSessionUpdate,
} from "@/lib/classpilot";
import type {
  ActionId,
  ClassSession,
  Poll,
  Student,
  Team,
  TeamDragPayload,
  TeamEditorMode,
} from "@/types/classpilot";

type ActionPageProps = {
  actionId: string;
};

export function ActionPage({ actionId }: ActionPageProps) {
  const { hydrated, session, setSession, updateSession } = useClassSession();
  const router = useRouter();

  useEffect(() => {
    if (!session.timer.running) {
      return;
    }

    const interval = window.setInterval(() => {
      setSession((current) => {
        if (!current.timer.running) {
          return current;
        }

        const remaining = Math.max(0, current.timer.remaining - 1);

        return withSessionUpdate(current, {
          timer: {
            ...current.timer,
            remaining,
            running: remaining > 0,
          },
          stageMode: "timer",
        });
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [session.timer.running, setSession]);

  if (!hydrated) {
    return (
      <main className="cp-screen cp-center-screen">
        <p className="cp-eyebrow">ClassPilot</p>
        <h1>액션을 불러오는 중</h1>
      </main>
    );
  }

  if (!isActionId(actionId)) {
    return (
      <ActionShell session={session} title="없는 액션">
        <EmptyAction
          ctaHref="/"
          ctaLabel="홈으로"
          title="이 액션은 아직 준비되지 않았습니다"
        />
      </ActionShell>
    );
  }

  const validActionId: ActionId = actionId;
  const action = getActionDefinition(validActionId);

  function handleComplete() {
    const mainSection = getActionCompleteSection(validActionId);

    setSession((current) =>
      withSessionUpdate(current, {
        mainSection,
        stageMode: mainSection === "teams" ? "teams" : current.stageMode,
      }),
    );
    router.push("/");
  }

  if (session.appStep !== "main") {
    return (
      <ActionShell session={session} title={action?.title ?? "액션"}>
        <EmptyAction
          ctaHref="/"
          ctaLabel="시작 화면으로"
          title="수업을 먼저 시작해주세요"
        />
      </ActionShell>
    );
  }

  return (
    <ActionShell
      onComplete={handleComplete}
      session={session}
      title={action?.title ?? "액션"}
    >
      {validActionId === "team-maker" && (
        <TeamMakerAction session={session} setSession={setSession} />
      )}
      {validActionId === "topic-assignment" && (
        <TopicAssignmentAction session={session} setSession={setSession} />
      )}
      {validActionId === "timer" && (
        <TimerAction session={session} updateSession={updateSession} />
      )}
      {validActionId === "random-student" && (
        <RandomStudentAction session={session} updateSession={updateSession} />
      )}
      {validActionId === "presentation-order" && (
        <PresentationAction session={session} updateSession={updateSession} />
      )}
      {validActionId === "poll" && (
        <PollAction session={session} updateSession={updateSession} />
      )}
      {validActionId === "score" && (
        <ScoreAction session={session} setSession={setSession} />
      )}
      {validActionId === "mini-game" && (
        <MiniGameAction session={session} setSession={setSession} />
      )}
      {validActionId === "reward" && (
        <RewardAction session={session} updateSession={updateSession} />
      )}
      {validActionId === "finale" && (
        <FinaleAction session={session} setSession={setSession} />
      )}
    </ActionShell>
  );
}

function ActionShell({
  children,
  onComplete,
  session,
  title,
}: {
  children: ReactNode;
  onComplete?: () => void;
  session: ClassSession;
  title: string;
}) {
  return (
    <main className="cp-screen cp-action-screen">
      <header className="cp-action-header">
        <Link className="cp-back-link" href="/">
          <ArrowLeft aria-hidden="true" size={20} />
          메인
        </Link>
        <div>
          <p className="cp-eyebrow">{session.className || "ClassPilot"}</p>
          <h1>{title}</h1>
        </div>
      </header>
      {children}
      {onComplete && (
        <div className="cp-action-complete-bar">
          <button className="cp-primary-button" onClick={onComplete} type="button">
            <CheckCircle2 aria-hidden="true" size={20} />
            완료
          </button>
        </div>
      )}
    </main>
  );
}

function TeamMakerAction({
  session,
  setSession,
}: {
  session: ClassSession;
  setSession: (updater: ClassSession | ((session: ClassSession) => ClassSession)) => void;
}) {
  const [teamCount, setTeamCount] = useState(Math.max(session.teams.length, 4));
  const [mode, setMode] = useState<TeamEditorMode>(
    session.teams.length > 0 ? "edit" : "random",
  );
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        session.students.map((student, index) => [
          student.id,
          `team-${(index % Math.max(session.teams.length || 4, 1)) + 1}`,
        ]),
      ),
  );
  const normalizedTeamCount = Math.max(
    1,
    Math.min(Math.floor(teamCount), Math.max(session.students.length, 1)),
  );
  const manualTeamOptions = Array.from(
    { length: normalizedTeamCount },
    (_, index) => ({
      id: `team-${index + 1}`,
      name: `${index + 1}팀`,
    }),
  );
  const unassignedStudents = getUnassignedStudents(session.students, session.teams);

  function handleCreateTeams() {
    setSession((current) =>
      withSessionUpdate(current, {
        teams:
          mode === "random"
            ? createTeams(current.students, teamCount)
            : createManualTeams(
                current.students,
                teamCount,
                manualAssignments,
              ),
        presentationOrder: [],
        mainSection: "teams",
        stageMode: "teams",
      }),
    );
    setMode("edit");
  }

  function handleAddTeam() {
    setSession((current) =>
      withSessionUpdate(current, {
        teams: addTeam(current.teams),
        mainSection: "teams",
        stageMode: "teams",
      }),
    );
  }

  function handleDeleteTeam(teamId: string) {
    setSession((current) => deleteTeamFromSession(current, teamId));
  }

  function handleMoveStudent(
    studentId: string,
    targetTeamId?: string,
    targetIndex?: number,
  ) {
    setSession((current) =>
      withSessionUpdate(current, {
        teams: moveStudentToTeam(
          current.teams,
          current.students,
          studentId,
          targetTeamId,
          targetIndex,
        ),
        mainSection: "teams",
        stageMode: "teams",
      }),
    );
  }

  function readDragPayload(event: DragEvent<HTMLElement>): TeamDragPayload | undefined {
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) {
      return undefined;
    }

    try {
      const payload = JSON.parse(raw) as Partial<TeamDragPayload>;
      return typeof payload.studentId === "string"
        ? {
            studentId: payload.studentId,
            fromTeamId:
              typeof payload.fromTeamId === "string" ? payload.fromTeamId : undefined,
          }
        : undefined;
    } catch {
      return undefined;
    }
  }

  function handleDrop(
    event: DragEvent<HTMLElement>,
    targetTeamId?: string,
    targetIndex?: number,
  ) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (!payload) {
      return;
    }

    handleMoveStudent(payload.studentId, targetTeamId, targetIndex);
  }

  return (
    <section className="cp-action-panel">
      <div className="cp-action-title-row">
        <UsersRound aria-hidden="true" size={34} />
        <div>
          <p className="cp-section-label">팀 만들기</p>
          <h2>
            {mode === "random"
              ? "랜덤으로 팀 나누기"
              : mode === "manual"
                ? "직접 팀 배정하기"
                : "팀 편집 보드"}
          </h2>
        </div>
      </div>

      <div className="cp-toggle-row">
        <button
          className={mode === "random" ? "active" : ""}
          onClick={() => setMode("random")}
          type="button"
        >
          랜덤 배정
        </button>
        <button
          className={mode === "manual" ? "active" : ""}
          onClick={() => setMode("manual")}
          type="button"
        >
          직접 배정
        </button>
        <button
          className={mode === "edit" ? "active" : ""}
          disabled={session.teams.length === 0}
          onClick={() => setMode("edit")}
          type="button"
        >
          편집 보드
        </button>
      </div>

      <div className="cp-action-controls">
        <label className="cp-field">
          팀 개수
          <input
            min={1}
            type="number"
            value={teamCount}
            onChange={(event) => setTeamCount(Number(event.target.value))}
          />
        </label>
        <button
          className="cp-primary-button"
          disabled={session.students.length === 0 || mode === "edit"}
          onClick={handleCreateTeams}
        >
          <Shuffle aria-hidden="true" size={20} />
          {mode === "random"
            ? "랜덤 팀 생성"
            : mode === "manual"
              ? "직접 배정 적용"
              : "편집 중"}
        </button>
        <button className="cp-secondary-button" onClick={handleAddTeam} type="button">
          <Plus aria-hidden="true" size={20} />팀 추가
        </button>
      </div>

      {mode === "manual" && (
        <div className="cp-manual-team-board">
          <div className="cp-manual-team-strip">
            {manualTeamOptions.map((team) => (
              <span key={team.id}>{team.name}</span>
            ))}
          </div>
          <div className="cp-student-assignment-grid">
            {session.students.map((student, index) => (
              <label className="cp-assignment-row" key={student.id}>
                <strong>{student.name}</strong>
                <select
                  value={
                    manualAssignments[student.id] ??
                    `team-${(index % normalizedTeamCount) + 1}`
                  }
                  onChange={(event) =>
                    setManualAssignments((current) => ({
                      ...current,
                      [student.id]: event.target.value,
                    }))
                  }
                >
                  {manualTeamOptions.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="cp-team-editor-board">
        <section
          className="cp-unassigned-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDrop(event)}
        >
          <div className="cp-editor-zone-header">
            <div>
              <p className="cp-section-label">미배정 학생</p>
              <h3>{unassignedStudents.length}명</h3>
            </div>
          </div>
          <div className="cp-editor-student-badges">
            {unassignedStudents.length === 0 ? (
              <p className="cp-empty-inline">모든 학생이 팀에 들어갔습니다.</p>
            ) : (
              unassignedStudents.map((student) => (
                <TeamStudentBadge
                  key={student.id}
                  student={student}
                />
              ))
            )}
          </div>
        </section>

        <section className="cp-team-editor-grid">
        {session.teams.map((team) => (
          <article
            className="cp-team-editor-card"
            key={team.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, team.id)}
          >
            <div className="cp-editor-zone-header">
              <input
                aria-label={`${team.name} 팀 이름`}
                className="cp-team-name-input"
                value={team.name}
                onChange={(event) =>
                  setSession((current) =>
                    withSessionUpdate(current, {
                      teams: renameTeam(current.teams, team.id, event.target.value),
                      mainSection: "teams",
                      stageMode: "teams",
                    }),
                  )
                }
              />
              <button
                aria-label={`${team.name} 삭제`}
                className="cp-danger-icon-button"
                onClick={() => handleDeleteTeam(team.id)}
                title={`${team.name} 삭제`}
                type="button"
              >
                <Trash2 aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="cp-team-editor-meta">
              <span>{team.students.length}명</span>
              <strong>{team.score}점</strong>
            </div>
            <div className="cp-editor-student-badges">
              {team.students.length === 0 ? (
                <p className="cp-empty-inline">학생 배지를 여기에 놓으세요.</p>
              ) : (
                team.students.map((student, index) => (
                  <TeamStudentBadge
                    fromTeamId={team.id}
                    key={student.id}
                    onDrop={(event) => handleDrop(event, team.id, index)}
                    student={student}
                  />
                ))
              )}
            </div>
          </article>
        ))}
        </section>
      </div>
    </section>
  );
}

function TeamStudentBadge({
  fromTeamId,
  onDrop,
  student,
}: {
  fromTeamId?: string;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
  student: Student;
}) {
  return (
    <button
      className="cp-team-student-chip"
      draggable
      onDragOver={(event) => {
        if (onDrop) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/json",
          JSON.stringify({ studentId: student.id, fromTeamId }),
        );
      }}
      onDrop={(event) => {
        if (!onDrop) {
          return;
        }

        event.stopPropagation();
        onDrop(event);
      }}
      type="button"
    >
      {student.name}
    </button>
  );
}

function TopicAssignmentAction({
  session,
  setSession,
}: {
  session: ClassSession;
  setSession: (updater: ClassSession | ((session: ClassSession) => ClassSession)) => void;
}) {
  if (session.teams.length === 0) {
    return (
      <EmptyAction
        ctaHref="/actions/team-maker"
        ctaLabel="팀 만들기"
        title="팀이 있어야 주제를 배정할 수 있습니다"
      />
    );
  }

  return (
    <section className="cp-action-panel">
      <div className="cp-action-title-row">
        <Sparkles aria-hidden="true" size={34} />
        <div>
          <p className="cp-section-label">주제 배정</p>
          <h2>팀별 주제 직접 배치</h2>
        </div>
      </div>

      <div className="cp-topic-list">
        {session.teams.map((team) => (
          <label className="cp-topic-row" key={team.id}>
            <span>{team.name}</span>
            <input
              aria-label={`${team.name} 주제`}
              placeholder="주제 입력"
              value={team.topic?.title ?? ""}
              onChange={(event) =>
                setSession((current) =>
                  withSessionUpdate(current, {
                    teams: assignTopicToTeam(
                      current.teams,
                      team.id,
                      event.target.value,
                    ),
                    mainSection: "teams",
                    stageMode: "topics",
                  }),
                )
              }
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function TimerAction({
  session,
  updateSession,
}: {
  session: ClassSession;
  updateSession: (changes: Partial<ClassSession>) => void;
}) {
  const [minutes, setMinutes] = useState(Math.round(session.timer.duration / 60));

  return (
    <section className="cp-action-panel cp-focus-action">
      <Clock3 aria-hidden="true" size={42} />
      <div className="cp-action-timer">{formatTime(session.timer.remaining)}</div>
      <div className="cp-action-controls">
        <label className="cp-field">
          분
          <input
            max={180}
            min={1}
            type="number"
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
        </label>
        <button
          className="cp-secondary-button"
          onClick={() =>
            updateSession({
              timer: createTimer(minutes),
              stageMode: "timer",
            })
          }
        >
          설정
        </button>
      </div>
      <div className="cp-control-row">
        <button
          aria-label="타이머 시작"
          className="cp-icon-command"
          onClick={() =>
            updateSession({
              timer: {
                ...session.timer,
                running: session.timer.remaining > 0,
              },
              stageMode: "timer",
            })
          }
          title="타이머 시작"
        >
          <Play aria-hidden="true" size={26} />
        </button>
        <button
          aria-label="타이머 정지"
          className="cp-icon-command"
          onClick={() =>
            updateSession({
              timer: {
                ...session.timer,
                running: false,
              },
              stageMode: "timer",
            })
          }
          title="타이머 정지"
        >
          <Pause aria-hidden="true" size={26} />
        </button>
        <button
          aria-label="타이머 초기화"
          className="cp-icon-command"
          onClick={() =>
            updateSession({
              timer: {
                ...session.timer,
                remaining: session.timer.duration,
                running: false,
              },
              stageMode: "timer",
            })
          }
          title="타이머 초기화"
        >
          <RefreshCw aria-hidden="true" size={26} />
        </button>
      </div>
    </section>
  );
}

function RandomStudentAction({
  session,
  updateSession,
}: {
  session: ClassSession;
  updateSession: (changes: Partial<ClassSession>) => void;
}) {
  return (
    <section className="cp-action-panel cp-focus-action">
      <Dice5 aria-hidden="true" size={46} />
      <p className="cp-section-label">오늘의 주인공</p>
      <div className="cp-picked-result">
        {session.selectedStudent?.name ?? "대기 중"}
      </div>
      <button
        className="cp-primary-button"
        disabled={session.students.length === 0}
        onClick={() =>
          updateSession({
            selectedStudent: pickRandomStudent(session.students),
            stageMode: "random",
          })
        }
      >
        한 명 뽑기
      </button>
    </section>
  );
}

function PresentationAction({
  session,
  updateSession,
}: {
  session: ClassSession;
  updateSession: (changes: Partial<ClassSession>) => void;
}) {
  const teamMode = session.presentationMode === "team";

  return (
    <section className="cp-action-panel">
      <div className="cp-action-title-row">
        <ListOrdered aria-hidden="true" size={34} />
        <div>
          <p className="cp-section-label">발표 순서</p>
          <h2>{teamMode ? "팀 발표 순서" : "개인 발표 순서"}</h2>
        </div>
      </div>

      <div className="cp-toggle-row">
        <button
          className={teamMode ? "active" : ""}
          onClick={() => updateSession({ presentationMode: "team" })}
        >
          팀
        </button>
        <button
          className={!teamMode ? "active" : ""}
          onClick={() => updateSession({ presentationMode: "student" })}
        >
          개인
        </button>
      </div>

      <button
        className="cp-primary-button"
        disabled={teamMode ? session.teams.length === 0 : session.students.length === 0}
        onClick={() =>
          teamMode
            ? updateSession({
                presentationOrder: createPresentationOrder(session.teams),
                stageMode: "presentation",
              })
            : updateSession({
                studentPresentationOrder: createStudentPresentationOrder(
                  session.students,
                ),
                stageMode: "presentation",
              })
        }
      >
        순서 만들기
      </button>

      <ol className="cp-big-order-list">
        {(teamMode ? session.presentationOrder : session.studentPresentationOrder).map(
          (item, index) => (
            <li key={item.id}>
              <span>{index + 1}</span>
              {item.name}
            </li>
          ),
        )}
      </ol>
    </section>
  );
}

function PollAction({
  session,
  updateSession,
}: {
  session: ClassSession;
  updateSession: (changes: Partial<ClassSession>) => void;
}) {
  const [question, setQuestion] = useState("오늘 가장 인상 깊었던 대상은?");
  const activePoll = useMemo(
    () =>
      session.polls.find((poll) => poll.id === session.activePollId) ??
      session.polls[0],
    [session.activePollId, session.polls],
  );
  const labels =
    session.pollTarget === "team"
      ? session.teams.map((team) => team.name)
      : session.students.map((student) => student.name);

  function handleCreatePoll() {
    const poll = createPoll(question, labels);

    updateSession({
      polls: [poll, ...session.polls],
      activePollId: poll.id,
      stageMode: "poll",
    });
  }

  return (
    <section className="cp-action-panel">
      <div className="cp-action-title-row">
        <BarChart3 aria-hidden="true" size={34} />
        <div>
          <p className="cp-section-label">투표</p>
          <h2>{session.pollTarget === "team" ? "팀 투표" : "개인 투표"}</h2>
        </div>
      </div>

      <div className="cp-toggle-row">
        <button
          className={session.pollTarget === "team" ? "active" : ""}
          onClick={() => updateSession({ pollTarget: "team" })}
        >
          팀
        </button>
        <button
          className={session.pollTarget === "student" ? "active" : ""}
          onClick={() => updateSession({ pollTarget: "student" })}
        >
          개인
        </button>
      </div>

      <div className="cp-action-controls stretch">
        <label className="cp-field">
          질문
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
        <button
          className="cp-primary-button"
          disabled={!question.trim() || labels.length < 2}
          onClick={handleCreatePoll}
        >
          투표 만들기
        </button>
      </div>

      {activePoll ? (
        <PollVoteBoard
          poll={activePoll}
          onVote={(optionId, delta) =>
            updateSession({
              polls: session.polls.map((poll) =>
                poll.id === activePoll.id
                  ? changePollVote(poll, optionId, delta)
                  : poll,
              ),
              activePollId: activePoll.id,
              stageMode: "poll",
            })
          }
        />
      ) : (
        <div className="cp-empty-inline">투표를 만들면 결과가 표시됩니다.</div>
      )}
    </section>
  );
}

function PollVoteBoard({
  onVote,
  poll,
}: {
  onVote: (optionId: string, delta: number) => void;
  poll: Poll;
}) {
  const totalVotes = getPollTotalVotes(poll);

  return (
    <div className="cp-poll-board">
      <h3>{poll.question}</h3>
      {poll.options.map((option) => {
        const votes = poll.votes[option.id] ?? 0;
        const percent = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);

        return (
          <div className="cp-poll-row" key={option.id}>
            <div>
              <strong>{option.label}</strong>
              <span>{votes}표</span>
            </div>
            <div className="cp-poll-track">
              <div style={{ width: `${percent}%` }} />
            </div>
            <div className="cp-score-buttons">
              <button onClick={() => onVote(option.id, -1)}>-</button>
              <button onClick={() => onVote(option.id, 1)}>+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreAction({
  session,
  setSession,
}: {
  session: ClassSession;
  setSession: (updater: ClassSession | ((session: ClassSession) => ClassSession)) => void;
}) {
  const [points, setPoints] = useState(10);
  const [reason, setReason] = useState("좋은 발표");
  const [selectedTeamId, setSelectedTeamId] = useState(session.teams[0]?.id ?? "");
  const activeTeamId = selectedTeamId || session.teams[0]?.id || "";

  function handleAddScore() {
    setSession((current) => addScoreEvent(current, activeTeamId, points, reason));
  }

  return (
    <section className="cp-action-panel">
      <div className="cp-action-title-row">
        <Trophy aria-hidden="true" size={34} />
        <div>
          <p className="cp-section-label">점수 추가/삭제</p>
          <h2>팀 점수 가산과 감점 기록</h2>
        </div>
      </div>

      <TeamRequired session={session}>
        <div className="cp-action-controls stretch">
          <TeamSelect
            selectedTeamId={activeTeamId}
            setSelectedTeamId={setSelectedTeamId}
            teams={session.teams}
          />
          <label className="cp-field">
            점수
            <input
              type="number"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
            />
          </label>
          <div className="cp-quick-score-row" aria-label="빠른 점수 선택">
            {[10, 5, -5, -10].map((quickPoint) => (
              <button
                key={quickPoint}
                onClick={() => setPoints(quickPoint)}
                type="button"
              >
                {quickPoint > 0 ? "+" : ""}
                {quickPoint}
              </button>
            ))}
          </div>
          <label className="cp-field">
            이유
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button className="cp-primary-button" onClick={handleAddScore}>
            기록하기
          </button>
        </div>
        <ScoreLog session={session} />
      </TeamRequired>
    </section>
  );
}

function MiniGameAction({
  session,
  setSession,
}: {
  session: ClassSession;
  setSession: (updater: ClassSession | ((session: ClassSession) => ClassSession)) => void;
}) {
  return (
    <section className="cp-action-panel">
      <div className="cp-action-title-row">
        <Rocket aria-hidden="true" size={34} />
        <div>
          <p className="cp-section-label">마블 룰렛</p>
          <h2>공이 떨어지는 순서대로 점수 내기</h2>
        </div>
      </div>

      <div className="cp-marble-intro">
        팀 또는 학생마다 공 하나를 만들고, 장애물과 벽을 타고 내려온 순서대로
        점수를 배출합니다. 팀 모드에서는 순위 점수를 팀 점수에 바로 반영할 수
        있습니다.
      </div>

      <MarbleRouletteGame session={session} setSession={setSession} />
    </section>
  );
}

function RewardAction({
  session,
  updateSession,
}: {
  session: ClassSession;
  updateSession: (changes: Partial<ClassSession>) => void;
}) {
  const [reward, setReward] = useState(session.reward);

  return (
    <section className="cp-action-panel cp-focus-action">
      <Trophy aria-hidden="true" size={46} />
      <p className="cp-section-label">우승 상품</p>
      <input
        aria-label="우승 상품"
        className="cp-big-input"
        placeholder="예: 간식 선택권"
        value={reward}
        onChange={(event) => {
          setReward(event.target.value);
          updateSession({ reward: event.target.value });
        }}
      />
      <button
        className="cp-primary-button"
        onClick={() => updateSession({ reward: reward.trim() })}
      >
        <Save aria-hidden="true" size={20} />
        저장
      </button>
    </section>
  );
}

function FinaleAction({
  session,
  setSession,
}: {
  session: ClassSession;
  setSession: (updater: ClassSession | ((session: ClassSession) => ClassSession)) => void;
}) {
  const winner = getWinnerTeam(session.teams);
  const rankedTeams = getRankedTeams(session.teams);

  return (
    <section className="cp-action-panel cp-finale-panel">
      <p className="cp-section-label">점수 산정하기</p>
      <h2>최종 우승팀 발표</h2>
      <button
        className="cp-primary-button"
        disabled={session.teams.length === 0}
        onClick={() => setSession((current) => finishSession(current))}
      >
        마무리 시작
      </button>

      {session.finale.finished && winner && (
        <div className="cp-winner-stage">
          <Trophy aria-hidden="true" size={58} />
          <span>우승</span>
          <strong>{winner.name}</strong>
          <p>{session.reward ? `상품: ${session.reward}` : "상품은 아직 미정"}</p>
        </div>
      )}

      <div className="cp-rank-board">
        {rankedTeams.map((team, index) => (
          <div className="cp-rank-row" key={team.id}>
            <span>{index + 1}</span>
            <strong>{team.name}</strong>
            <em>{team.score}점</em>
          </div>
        ))}
      </div>

      <ScoreLog session={session} />
    </section>
  );
}

function TeamSelect({
  selectedTeamId,
  setSelectedTeamId,
  teams,
}: {
  selectedTeamId: string;
  setSelectedTeamId: (teamId: string) => void;
  teams: Team[];
}) {
  return (
    <label className="cp-field">
      팀
      <select
        value={selectedTeamId}
        onChange={(event) => setSelectedTeamId(event.target.value)}
      >
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function TeamRequired({
  children,
  session,
}: {
  children: ReactNode;
  session: ClassSession;
}) {
  if (session.teams.length === 0) {
    return (
      <EmptyAction
        ctaHref="/actions/team-maker"
        ctaLabel="팀 만들기"
        title="팀이 먼저 필요합니다"
      />
    );
  }

  return children;
}

function ScoreLog({ session }: { session: ClassSession }) {
  if (session.scoreEvents.length === 0) {
    return <div className="cp-empty-inline">아직 점수 기록이 없습니다.</div>;
  }

  return (
    <div className="cp-score-log">
      {session.scoreEvents
        .slice()
        .reverse()
        .map((event) => (
          <div key={event.id}>
            <span>{formatEventTime(event.createdAt)}</span>
            <strong>{event.teamName}</strong>
            <em>
              {event.points > 0 ? "+" : ""}
              {event.points}점
            </em>
            <p>{event.reason}</p>
          </div>
        ))}
    </div>
  );
}

function EmptyAction({
  ctaHref,
  ctaLabel,
  title,
}: {
  ctaHref: string;
  ctaLabel: string;
  title: string;
}) {
  return (
    <section className="cp-empty-state">
      <Rocket aria-hidden="true" size={42} />
      <h2>{title}</h2>
      <Link className="cp-primary-button" href={ctaHref}>
        {ctaLabel}
      </Link>
    </section>
  );
}
