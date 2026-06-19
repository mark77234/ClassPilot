"use client";

import {
  BarChart3,
  Clock3,
  Dice5,
  ExternalLink,
  ListOrdered,
  Monitor,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StageView } from "@/components/StageView";
import {
  STORAGE_KEY,
  assignTopicsToTeams,
  changePollVote,
  createEmptySession,
  createPoll,
  createPresentationOrder,
  createStudents,
  createTeams,
  createTimer,
  createTopics,
  getPollTotalVotes,
  getSamplePollOptions,
  getSampleStudentText,
  getSampleTopicText,
  parseLines,
  pickRandomStudent,
  withSessionUpdate,
} from "@/lib/classpilot";
import type { ClassSession, Poll, StageMode } from "@/types/classpilot";

const DEFAULT_POLL_QUESTION = "오늘 가장 인상 깊었던 팀은?";

export function ClassPilotApp() {
  const [session, setSession] = useState<ClassSession>(() =>
    createEmptySession(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [studentInput, setStudentInput] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [teamCount, setTeamCount] = useState(4);
  const [timerMinutes, setTimerMinutes] = useState(15);
  const [pollQuestion, setPollQuestion] = useState(DEFAULT_POLL_QUESTION);
  const [pollOptionInput, setPollOptionInput] = useState(getSamplePollOptions());

  const activePoll = useMemo(
    () =>
      session.polls.find((poll) => poll.id === session.activePollId) ??
      session.polls[0],
    [session.activePollId, session.polls],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored) {
      try {
        const parsedSession = JSON.parse(stored) as ClassSession;
        setSession(parsedSession);
        setStudentInput(parsedSession.students.map((student) => student.name).join("\n"));
        setTopicInput(parsedSession.topics.map((topic) => topic.title).join("\n"));
        setTeamCount(Math.max(1, parsedSession.teams.length || 4));
        setTimerMinutes(Math.max(1, Math.round(parsedSession.timer.duration / 60)));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [hydrated, session]);

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
        });
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [session.timer.running]);

  function updateSession(changes: Partial<ClassSession>) {
    setSession((current) => withSessionUpdate(current, changes));
  }

  function setStageMode(stageMode: StageMode) {
    updateSession({ stageMode });
  }

  function handleApplyStudents() {
    const students = createStudents(parseLines(studentInput));

    updateSession({
      students,
      teams: [],
      presentationOrder: [],
      selectedStudent: undefined,
      stageMode: "dashboard",
    });
  }

  function handleCreateTeams() {
    const teams = createTeams(session.students, teamCount);

    updateSession({
      teams,
      presentationOrder: [],
      stageMode: "teams",
    });
  }

  function handleApplyTopics() {
    updateSession({
      topics: createTopics(parseLines(topicInput)),
      stageMode: "dashboard",
    });
  }

  function handleAssignTopics() {
    const topics =
      session.topics.length > 0
        ? session.topics
        : createTopics(parseLines(topicInput));

    updateSession({
      topics,
      teams: assignTopicsToTeams(session.teams, topics),
      stageMode: "topics",
    });
  }

  function handleCreatePresentationOrder() {
    updateSession({
      presentationOrder: createPresentationOrder(session.teams),
      stageMode: "presentation",
    });
  }

  function handlePickStudent() {
    updateSession({
      selectedStudent: pickRandomStudent(session.students),
      stageMode: "random",
    });
  }

  function handleSetTimer() {
    updateSession({
      timer: createTimer(timerMinutes),
      stageMode: "timer",
    });
  }

  function handleTimerRunning(running: boolean) {
    updateSession({
      timer: {
        ...session.timer,
        running: session.timer.remaining > 0 && running,
      },
      stageMode: "timer",
    });
  }

  function handleTimerReset() {
    updateSession({
      timer: {
        ...session.timer,
        remaining: session.timer.duration,
        running: false,
      },
      stageMode: "timer",
    });
  }

  function handleCreatePoll() {
    const options = parseLines(pollOptionInput);

    if (!pollQuestion.trim() || options.length < 2) {
      return;
    }

    const poll = createPoll(pollQuestion, options);

    updateSession({
      polls: [poll, ...session.polls],
      activePollId: poll.id,
      stageMode: "poll",
    });
  }

  function handleVote(poll: Poll, optionId: string, delta: number) {
    updateSession({
      polls: session.polls.map((item) =>
        item.id === poll.id ? changePollVote(item, optionId, delta) : item,
      ),
      activePollId: poll.id,
      stageMode: "poll",
    });
  }

  function handlePollStatus(poll: Poll, status: Poll["status"]) {
    updateSession({
      polls: session.polls.map((item) =>
        item.id === poll.id ? { ...item, status } : item,
      ),
      activePollId: poll.id,
      stageMode: "poll",
    });
  }

  function handleResetSession() {
    const emptySession = createEmptySession();

    setSession(emptySession);
    setStudentInput("");
    setTopicInput("");
    setTeamCount(4);
    setTimerMinutes(15);
    setPollQuestion(DEFAULT_POLL_QUESTION);
    setPollOptionInput(getSamplePollOptions());
  }

  function handleLoadSample() {
    const students = createStudents(parseLines(getSampleStudentText()));
    const topics = createTopics(parseLines(getSampleTopicText()));
    const teams = assignTopicsToTeams(createTeams(students, 4), topics);
    const poll = createPoll(DEFAULT_POLL_QUESTION, parseLines(getSamplePollOptions()));

    setStudentInput(getSampleStudentText());
    setTopicInput(getSampleTopicText());
    setTeamCount(4);
    setPollQuestion(DEFAULT_POLL_QUESTION);
    setPollOptionInput(getSamplePollOptions());
    setSession(
      withSessionUpdate(createEmptySession(), {
        students,
        teams,
        topics,
        presentationOrder: createPresentationOrder(teams),
        polls: [poll],
        activePollId: poll.id,
        stageMode: "dashboard",
      }),
    );
  }

  function openDisplay() {
    window.open("/display", "classpilot-display");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Sparkles aria-hidden="true" size={20} />
          </div>
          <div>
            <strong>ClassPilot</strong>
            <span>수업 컨트롤 타워</span>
          </div>
        </div>

        <nav className="stage-nav" aria-label="큰 화면 표시">
          <StageButton
            active={session.stageMode === "dashboard"}
            icon={<Monitor aria-hidden="true" size={18} />}
            label="대시보드"
            onClick={() => setStageMode("dashboard")}
          />
          <StageButton
            active={session.stageMode === "teams"}
            icon={<UsersRound aria-hidden="true" size={18} />}
            label="팀"
            onClick={() => setStageMode("teams")}
          />
          <StageButton
            active={session.stageMode === "topics"}
            icon={<Sparkles aria-hidden="true" size={18} />}
            label="주제"
            onClick={() => setStageMode("topics")}
          />
          <StageButton
            active={session.stageMode === "timer"}
            icon={<Clock3 aria-hidden="true" size={18} />}
            label="타이머"
            onClick={() => setStageMode("timer")}
          />
          <StageButton
            active={session.stageMode === "presentation"}
            icon={<ListOrdered aria-hidden="true" size={18} />}
            label="발표"
            onClick={() => setStageMode("presentation")}
          />
          <StageButton
            active={session.stageMode === "poll"}
            icon={<BarChart3 aria-hidden="true" size={18} />}
            label="투표"
            onClick={() => setStageMode("poll")}
          />
          <StageButton
            active={session.stageMode === "random"}
            icon={<Dice5 aria-hidden="true" size={18} />}
            label="뽑기"
            onClick={() => setStageMode("random")}
          />
        </nav>

        <div className="sidebar-actions">
          <button className="button button-primary" onClick={openDisplay}>
            <ExternalLink aria-hidden="true" size={17} />
            큰 화면 열기
          </button>
          <button className="button button-ghost" onClick={handleLoadSample}>
            <Plus aria-hidden="true" size={17} />
            샘플 채우기
          </button>
          <button className="button button-danger" onClick={handleResetSession}>
            <RotateCcw aria-hidden="true" size={17} />
            초기화
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>1차 MVP</p>
            <h1>교사용 진행 화면</h1>
          </div>
          <div className="session-stats">
            <Stat label="학생" value={session.students.length} />
            <Stat label="팀" value={session.teams.length} />
            <Stat label="투표" value={session.polls.length} />
          </div>
        </header>

        <div className="main-grid">
          <section className="control-grid" aria-label="수업 제어">
            <Panel title="학생 명단" icon={<UsersRound aria-hidden="true" />}>
              <textarea
                aria-label="학생 이름"
                className="textarea"
                placeholder="학생 이름을 한 줄에 한 명씩 입력"
                value={studentInput}
                onChange={(event) => setStudentInput(event.target.value)}
              />
              <div className="panel-actions">
                <button className="button button-primary" onClick={handleApplyStudents}>
                  명단 반영
                </button>
                <span>{session.students.length}명</span>
              </div>
            </Panel>

            <Panel title="팀 나누기" icon={<Shuffle aria-hidden="true" />}>
              <div className="inline-fields">
                <label>
                  팀 개수
                  <input
                    min={1}
                    type="number"
                    value={teamCount}
                    onChange={(event) => setTeamCount(Number(event.target.value))}
                  />
                </label>
                <button
                  className="button button-primary"
                  disabled={session.students.length === 0}
                  onClick={handleCreateTeams}
                >
                  팀 생성
                </button>
              </div>
              <TeamSummary session={session} />
            </Panel>

            <Panel title="주제 배정" icon={<Sparkles aria-hidden="true" />}>
              <textarea
                aria-label="프로젝트 주제"
                className="textarea compact-textarea"
                placeholder="프로젝트 주제를 한 줄에 하나씩 입력"
                value={topicInput}
                onChange={(event) => setTopicInput(event.target.value)}
              />
              <div className="panel-actions">
                <button className="button button-secondary" onClick={handleApplyTopics}>
                  주제 반영
                </button>
                <button
                  className="button button-primary"
                  disabled={
                    session.teams.length === 0 ||
                    (session.topics.length === 0 &&
                      parseLines(topicInput).length === 0)
                  }
                  onClick={handleAssignTopics}
                >
                  랜덤 배정
                </button>
              </div>
            </Panel>

            <Panel title="수업 타이머" icon={<Clock3 aria-hidden="true" />}>
              <div className="timer-readout">{session.timer.remaining > 0 ? "" : "종료"} {session.timer.remaining >= 0 && <span>{formatTimerLabel(session.timer.remaining)}</span>}</div>
              <div className="inline-fields">
                <label>
                  분
                  <input
                    min={1}
                    max={180}
                    type="number"
                    value={timerMinutes}
                    onChange={(event) => setTimerMinutes(Number(event.target.value))}
                  />
                </label>
                <button className="button button-secondary" onClick={handleSetTimer}>
                  설정
                </button>
              </div>
              <div className="segmented-actions">
                <button
                  className="icon-button"
                  aria-label="타이머 시작"
                  title="타이머 시작"
                  onClick={() => handleTimerRunning(true)}
                >
                  <Play aria-hidden="true" size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="타이머 정지"
                  title="타이머 정지"
                  onClick={() => handleTimerRunning(false)}
                >
                  <Pause aria-hidden="true" size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="타이머 초기화"
                  title="타이머 초기화"
                  onClick={handleTimerReset}
                >
                  <RefreshCw aria-hidden="true" size={18} />
                </button>
              </div>
            </Panel>

            <Panel title="발표 순서" icon={<ListOrdered aria-hidden="true" />}>
              <button
                className="button button-primary"
                disabled={session.teams.length === 0}
                onClick={handleCreatePresentationOrder}
              >
                발표 순서 생성
              </button>
              <ol className="mini-list">
                {session.presentationOrder.map((team, index) => (
                  <li key={team.id}>
                    <span>{index + 1}</span>
                    {team.name}
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel title="랜덤 학생" icon={<Dice5 aria-hidden="true" />}>
              <button
                className="button button-primary"
                disabled={session.students.length === 0}
                onClick={handlePickStudent}
              >
                한 명 뽑기
              </button>
              <div className="picked-name">
                {session.selectedStudent?.name ?? "대기 중"}
              </div>
            </Panel>

            <Panel title="투표" icon={<BarChart3 aria-hidden="true" />}>
              <input
                aria-label="투표 질문"
                className="text-input"
                value={pollQuestion}
                onChange={(event) => setPollQuestion(event.target.value)}
              />
              <textarea
                aria-label="투표 선택지"
                className="textarea compact-textarea"
                value={pollOptionInput}
                onChange={(event) => setPollOptionInput(event.target.value)}
              />
              <button className="button button-primary" onClick={handleCreatePoll}>
                투표 시작
              </button>
              {activePoll && (
                <PollControl
                  poll={activePoll}
                  onVote={handleVote}
                  onStatus={handlePollStatus}
                />
              )}
            </Panel>
          </section>

          <aside className="preview-pane">
            <div className="preview-toolbar">
              <span>큰 화면 미리보기</span>
              <button className="button button-secondary" onClick={openDisplay}>
                <ExternalLink aria-hidden="true" size={16} />
                열기
              </button>
            </div>
            <StageView compact session={session} />
          </aside>
        </div>
      </section>
    </main>
  );
}

function StageButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "stage-button active" : "stage-button"}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Panel({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="panel">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TeamSummary({ session }: { session: ClassSession }) {
  if (session.teams.length === 0) {
    return <div className="empty-inline">팀 없음</div>;
  }

  return (
    <div className="team-summary">
      {session.teams.map((team) => (
        <div key={team.id}>
          <strong>{team.name}</strong>
          <span>{team.students.length}명</span>
        </div>
      ))}
    </div>
  );
}

function PollControl({
  poll,
  onStatus,
  onVote,
}: {
  poll: Poll;
  onStatus: (poll: Poll, status: Poll["status"]) => void;
  onVote: (poll: Poll, optionId: string, delta: number) => void;
}) {
  const totalVotes = getPollTotalVotes(poll);

  return (
    <div className="poll-control">
      <div className="poll-control-head">
        <strong>{poll.status === "active" ? "진행 중" : "닫힘"}</strong>
        <span>{totalVotes}표</span>
      </div>
      {poll.options.map((option) => {
        const votes = poll.votes[option.id] ?? 0;
        const percent = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);

        return (
          <div className="vote-row" key={option.id}>
            <span>{option.label}</span>
            <div className="vote-controls">
              <button
                className="small-icon-button"
                aria-label={`${option.label} 표 빼기`}
                onClick={() => onVote(poll, option.id, -1)}
              >
                -
              </button>
              <strong>{votes}</strong>
              <button
                className="small-icon-button"
                aria-label={`${option.label} 표 더하기`}
                onClick={() => onVote(poll, option.id, 1)}
              >
                +
              </button>
              <em>{percent}%</em>
            </div>
          </div>
        );
      })}
      <div className="segmented-actions">
        <button
          className="button button-secondary"
          onClick={() => onStatus(poll, "active")}
        >
          열기
        </button>
        <button
          className="button button-secondary"
          onClick={() => onStatus(poll, "closed")}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function formatTimerLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${rest
    .toString()
    .padStart(2, "0")}`;
}
