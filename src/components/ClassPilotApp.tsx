"use client";

import {
  ArrowRight,
  Home,
  Rocket,
  RotateCcw,
  Sparkles,
  Trophy,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import type { PointerEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { useClassSession } from "@/hooks/useClassSession";
import {
  ACTION_DEFINITIONS,
  addStudentToSession,
  createEmptySession,
  getMainSectionLabel,
  getRankedTeams,
  removeStudentFromSession,
  updateStudentPosition,
  withSessionUpdate,
} from "@/lib/classpilot";
import type { ClassSession, MainSection, Student } from "@/types/classpilot";

export function ClassPilotApp() {
  const { hydrated, resetSession, session, setSession, updateSession } =
    useClassSession();

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (session.appStep === "start") {
    return <StartScreen onStart={() => updateSession({ appStep: "class-name" })} />;
  }

  if (session.appStep === "class-name") {
    return (
      <ClassNameScreen
        session={session}
        onNext={(className) =>
          updateSession({
            appStep: "students",
            className,
          })
        }
      />
    );
  }

  if (session.appStep === "students") {
    return (
      <StudentSetupScreen
        resetSession={resetSession}
        session={session}
        setSession={setSession}
        updateSession={updateSession}
      />
    );
  }

  return (
    <MainExperience
      resetSession={resetSession}
      session={session}
      setSession={setSession}
      updateSession={updateSession}
    />
  );
}

function LoadingScreen() {
  return (
    <main className="cp-screen cp-center-screen">
      <div className="cp-logo-mark">
        <Sparkles aria-hidden="true" size={28} />
      </div>
      <p className="cp-eyebrow">ClassPilot</p>
      <h1>수업을 불러오는 중</h1>
    </main>
  );
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="cp-screen cp-start-screen">
      <section className="cp-start-hero">
        <div className="cp-logo-mark">
          <Sparkles aria-hidden="true" size={32} />
        </div>
        <p className="cp-eyebrow">ClassPilot</p>
        <h1>수업을 게임처럼 진행하는 선생님용 컨트롤 타워</h1>
        <button className="cp-primary-button cp-hero-button" onClick={onStart}>
          시작하기
          <ArrowRight aria-hidden="true" size={22} />
        </button>
      </section>
    </main>
  );
}

function ClassNameScreen({
  onNext,
  session,
}: {
  onNext: (className: string) => void;
  session: ClassSession;
}) {
  const [className, setClassName] = useState(session.className);

  function handleSubmit() {
    const trimmedName = className.trim();

    if (!trimmedName) {
      return;
    }

    onNext(trimmedName);
  }

  return (
    <main className="cp-screen cp-step-screen">
      <section className="cp-step-panel">
        <p className="cp-step-count">01</p>
        <h1>어떤 수업인가요?</h1>
        <input
          aria-label="수업 이름"
          autoFocus
          className="cp-big-input"
          placeholder="예: 3반 바이브 코딩 수업"
          value={className}
          onChange={(event) => setClassName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSubmit();
            }
          }}
        />
        <button
          className="cp-primary-button"
          disabled={!className.trim()}
          onClick={handleSubmit}
        >
          다음
          <ArrowRight aria-hidden="true" size={20} />
        </button>
      </section>
    </main>
  );
}

function StudentSetupScreen({
  resetSession,
  session,
  setSession,
  updateSession,
}: {
  resetSession: () => void;
  session: ClassSession;
  setSession: (updater: ClassSession | ((session: ClassSession) => ClassSession)) => void;
  updateSession: (changes: Partial<ClassSession>) => void;
}) {
  const [studentName, setStudentName] = useState("");

  function handleAddStudent() {
    setSession((current) => addStudentToSession(current, studentName));
    setStudentName("");
  }

  return (
    <main className="cp-screen cp-flow-screen">
      <SessionHeader resetSession={resetSession} session={session} />
      <section className="cp-step-panel cp-student-panel">
        <p className="cp-step-count">02</p>
        <h1>멋진 학생들 이름을 넣어주세요</h1>
        <div className="cp-add-student-row">
          <input
            aria-label="학생 이름"
            autoFocus
            className="cp-big-input"
            placeholder="학생 이름 입력 후 Enter"
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddStudent();
              }
            }}
          />
          <button
            aria-label="학생 추가"
            className="cp-icon-command"
            disabled={!studentName.trim()}
            onClick={handleAddStudent}
            title="학생 추가"
          >
            <UserPlus aria-hidden="true" size={24} />
          </button>
        </div>

        <div className="cp-student-badges" aria-label="입력한 학생 목록">
          {session.students.map((student) => (
            <span className="cp-student-badge" key={student.id}>
              {student.name}
              <button
                aria-label={`${student.name} 제거`}
                onClick={() =>
                  setSession((current) =>
                    removeStudentFromSession(current, student.id),
                  )
                }
                title={`${student.name} 제거`}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </span>
          ))}
        </div>

        <button
          className="cp-primary-button"
          disabled={session.students.length === 0}
          onClick={() =>
            updateSession({
              appStep: "main",
              mainSection: "home",
              stageMode: "dashboard",
            })
          }
        >
          메인 화면으로
          <ArrowRight aria-hidden="true" size={20} />
        </button>
      </section>
    </main>
  );
}

function MainExperience({
  resetSession,
  session,
  setSession,
  updateSession,
}: {
  resetSession: () => void;
  session: ClassSession;
  setSession: (updater: ClassSession | ((session: ClassSession) => ClassSession)) => void;
  updateSession: (changes: Partial<ClassSession>) => void;
}) {
  return (
    <main className="cp-screen cp-main-screen">
      <SessionHeader resetSession={resetSession} session={session} />

      <section className="cp-main-content">
        {session.mainSection === "home" && (
          <HomeSection session={session} setSession={setSession} />
        )}
        {session.mainSection === "actions" && <ActionsSection />}
        {session.mainSection === "teams" && <TeamsSection session={session} />}
      </section>

      <FloatingNav
        activeSection={session.mainSection}
        onChange={(mainSection) =>
          updateSession({
            mainSection,
            stageMode: mainSection === "teams" ? "teams" : "dashboard",
          })
        }
      />
    </main>
  );
}

function SessionHeader({
  resetSession,
  session,
}: {
  resetSession: () => void;
  session: ClassSession;
}) {
  return (
    <header className="cp-session-header">
      <div>
        <p className="cp-eyebrow">ClassPilot</p>
        <h1>{session.className || "새 수업"}</h1>
      </div>
      <button
        className="cp-reset-button"
        onClick={() => {
          if (window.confirm("수업을 처음부터 다시 시작할까요?")) {
            resetSession();
          }
        }}
      >
        <RotateCcw aria-hidden="true" size={18} />
        수업 다시 시작
      </button>
    </header>
  );
}

function HomeSection({
  session,
  setSession,
}: {
  session: ClassSession;
  setSession: (updater: ClassSession | ((session: ClassSession) => ClassSession)) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | undefined>();

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingId || !boardRef.current) {
      return;
    }

    const rect = boardRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setSession((current) =>
      withSessionUpdate(current, {
        students: updateStudentPosition(current.students, draggingId, { x, y }),
      }),
    );
  }

  return (
    <div className="cp-section-stack">
      <section className="cp-section-hero">
        <p className="cp-section-label">홈</p>
        <h2>오늘의 교실</h2>
        <div className="cp-home-stats">
          <StatBadge label="학생" value={`${session.students.length}명`} />
          <StatBadge label="팀" value={`${session.teams.length}개`} />
          <StatBadge
            label="최고 점수"
            value={`${getRankedTeams(session.teams)[0]?.score ?? 0}점`}
          />
        </div>
      </section>

      <section
        className="cp-class-board"
        ref={boardRef}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDraggingId(undefined)}
        onPointerCancel={() => setDraggingId(undefined)}
      >
        <div className="cp-teacher-zone">선생님</div>
        {session.students.map((student) => (
          <DraggableStudent
            dragging={draggingId === student.id}
            key={student.id}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDraggingId(student.id);
            }}
            student={student}
          />
        ))}
      </section>
    </div>
  );
}

function DraggableStudent({
  dragging,
  onPointerDown,
  student,
}: {
  dragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  student: Student;
}) {
  return (
    <button
      className={dragging ? "cp-seat-chip dragging" : "cp-seat-chip"}
      onPointerDown={onPointerDown}
      style={{
        left: `${student.position.x}%`,
        top: `${student.position.y}%`,
      }}
      type="button"
    >
      {student.name}
    </button>
  );
}

function ActionsSection() {
  return (
    <div className="cp-section-stack">
      <section className="cp-section-hero">
        <p className="cp-section-label">액션</p>
        <h2>수업 이벤트</h2>
      </section>

      <section className="cp-action-gallery" aria-label="액션 목록">
        {ACTION_DEFINITIONS.map((action, index) => (
          <Link className="cp-action-tile" href={`/actions/${action.id}`} key={action.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{action.title}</strong>
            <em>{action.detail}</em>
          </Link>
        ))}
      </section>
    </div>
  );
}

function TeamsSection({ session }: { session: ClassSession }) {
  const rankedTeams = getRankedTeams(session.teams);

  return (
    <div className="cp-section-stack">
      <section className="cp-section-hero">
        <p className="cp-section-label">팀</p>
        <h2>팀 현황판</h2>
      </section>

      {session.teams.length === 0 ? (
        <section className="cp-empty-state">
          <UsersRound aria-hidden="true" size={42} />
          <h3>아직 팀이 없습니다</h3>
          <Link className="cp-primary-button" href="/actions/team-maker">
            팀 만들기
          </Link>
        </section>
      ) : (
        <section className="cp-team-grid">
          {rankedTeams.map((team, index) => (
            <article className="cp-team-card" key={team.id}>
              <div className="cp-team-rank">{index + 1}</div>
              <div>
                <h3>{team.name}</h3>
                <p>{team.topic?.title || " "}</p>
              </div>
              <div className="cp-team-meta">
                <span>{team.students.length}명</span>
                <strong>{team.score}점</strong>
              </div>
              <div className="cp-team-members">
                {team.students.map((student) => student.name).join(" · ")}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function FloatingNav({
  activeSection,
  onChange,
}: {
  activeSection: MainSection;
  onChange: (section: MainSection) => void;
}) {
  const items: Array<{
    icon: ReactNode;
    id: MainSection;
    label: string;
  }> = [
    { icon: <Home aria-hidden="true" size={20} />, id: "home", label: "홈" },
    {
      icon: <Rocket aria-hidden="true" size={20} />,
      id: "actions",
      label: "액션",
    },
    {
      icon: <UsersRound aria-hidden="true" size={20} />,
      id: "teams",
      label: "팀",
    },
  ];

  return (
    <nav className="cp-floating-nav" aria-label="메인 섹션">
      {items.map((item) => (
        <button
          className={activeSection === item.id ? "active" : ""}
          key={item.id}
          onClick={() => onChange(item.id)}
          type="button"
        >
          {item.icon}
          <span>{getMainSectionLabel(item.id)}</span>
        </button>
      ))}
    </nav>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="cp-stat-badge">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
