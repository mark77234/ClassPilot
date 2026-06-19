"use client";

import {
  ArrowRight,
  Edit3,
  Gamepad2,
  Home,
  Minus,
  MonitorPlay,
  MousePointer2,
  Plus,
  Rocket,
  RotateCcw,
  School,
  Sparkles,
  Star,
  StickyNote,
  TimerReset,
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
  addStudentPointEvent,
  addStudentToSession,
  findStudentAtPosition,
  formatEventTime,
  getMainSectionLabel,
  getRankedTeams,
  removeStudentFromSession,
  swapStudentPositions,
  updateStudentProfile,
  updateStudentPosition,
  withSessionUpdate,
} from "@/lib/classpilot";
import type {
  ClassSession,
  MainSection,
  Student,
  StudentPosition,
} from "@/types/classpilot";

export function ClassPilotApp() {
  const { hydrated, resetSession, session, setSession, updateSession } =
    useClassSession();

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (session.appStep === "start") {
    return (
      <StartScreen onStart={() => updateSession({ appStep: "class-name" })} />
    );
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
  const onboardingItems = [
    {
      icon: <School aria-hidden="true" size={22} />,
      title: "명단 입력",
      text: "수업 이름을 정하고 학생을 한 명씩 추가하면 교실 보드가 만들어집니다.",
    },
    {
      icon: <MousePointer2 aria-hidden="true" size={22} />,
      title: "자리와 학생 기록",
      text: "학생 칩을 드래그해 배치하고 특징, 메모, 상벌점을 바로 남깁니다.",
    },
    {
      icon: <Gamepad2 aria-hidden="true" size={22} />,
      title: "활동 진행",
      text: "팀 점수, 투표, 발표 순서, 타이머, 마블 룰렛을 수업 흐름에 맞춰 실행합니다.",
    },
  ];

  return (
    <main className="cp-screen cp-start-screen">
      <section className="cp-start-hero">
        <div className="cp-start-copy">
          <div className="cp-logo-mark">
            <Sparkles aria-hidden="true" size={32} />
          </div>
          <p className="cp-eyebrow">ClassPilot</p>
          <h1>ClassPilot, 수업 진행을 한 화면에서</h1>
          <p className="cp-start-description">
            학생 명단을 넣으면 자리 보드가 만들어집니다. 선생님은 팀, 점수,
            투표, 발표 순서, 타이머, 마블 룰렛을 조작하고 학생 화면에는 보여줘도
            되는 결과만 띄웁니다.
          </p>
          <button
            className="cp-primary-button cp-hero-button"
            onClick={onStart}
          >
            수업 만들기
            <ArrowRight aria-hidden="true" size={22} />
          </button>
        </div>

        <div className="cp-start-showcase" aria-hidden="true">
          <div className="cp-showcase-header">
            <span>3반 과학 수업</span>
            <strong>LIVE</strong>
          </div>
          <div className="cp-showcase-board">
            {["김민준", "이서연", "박지호", "최하은", "정도윤", "강서준"].map(
              (name, index) => (
                <span key={name} style={{ animationDelay: `${index * 90}ms` }}>
                  {name}
                </span>
              ),
            )}
          </div>
          <div className="cp-showcase-action">
            <div>
              <TimerReset size={20} />
              <span>타이머 05:00</span>
            </div>
            <div>
              <Trophy size={20} />
              <span>로켓팀 +20</span>
            </div>
            <div>
              <MonitorPlay size={20} />
              <span>결과 화면 공유</span>
            </div>
          </div>
        </div>
      </section>

      <section
        className="cp-start-onboarding"
        aria-label="ClassPilot 사용 흐름"
      >
        {onboardingItems.map((item, index) => (
          <article
            key={item.title}
            style={{ animationDelay: `${index * 110}ms` }}
          >
            <div>{item.icon}</div>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </article>
        ))}
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
  setSession: (
    updater: ClassSession | ((session: ClassSession) => ClassSession),
  ) => void;
  updateSession: (changes: Partial<ClassSession>) => void;
}) {
  const [studentName, setStudentName] = useState("");

  function handleAddStudent() {
    setSession((current) => addStudentToSession(current, studentName));
    setStudentName("");
  }

  return (
    <main className="cp-screen cp-flow-screen">
      <SessionHeader
        resetSession={resetSession}
        session={session}
        updateSession={updateSession}
      />
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
              if (event.nativeEvent.isComposing) {
                return;
              }

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
  setSession: (
    updater: ClassSession | ((session: ClassSession) => ClassSession),
  ) => void;
  updateSession: (changes: Partial<ClassSession>) => void;
}) {
  return (
    <main className="cp-screen cp-main-screen">
      <SessionHeader
        resetSession={resetSession}
        session={session}
        updateSession={updateSession}
      />

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
  updateSession,
}: {
  resetSession: () => void;
  session: ClassSession;
  updateSession?: (changes: Partial<ClassSession>) => void;
}) {
  return (
    <header className="cp-session-header">
      <div>
        <p className="cp-eyebrow">ClassPilot</p>
        <h1>{session.className || "새 수업"}</h1>
      </div>
      <div className="cp-header-actions">
        {updateSession && (
          <button
            className="cp-edit-button"
            onClick={() =>
              updateSession({
                appStep: "class-name",
              })
            }
            type="button"
          >
            <Edit3 aria-hidden="true" size={18} />
            수업 수정
          </button>
        )}
        <button
          className="cp-reset-button"
          onClick={() => {
            if (window.confirm("수업을 처음부터 다시 시작할까요?")) {
              resetSession();
            }
          }}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={18} />
          수업 다시 시작
        </button>
      </div>
    </header>
  );
}

function HomeSection({
  session,
  setSession,
}: {
  session: ClassSession;
  setSession: (
    updater: ClassSession | ((session: ClassSession) => ClassSession),
  ) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | undefined>();
  const [dragPreview, setDragPreview] = useState<StudentPosition | undefined>();
  const [selectedStudentId, setSelectedStudentId] = useState<
    string | undefined
  >(session.students[0]?.id);
  const activeStudent =
    session.students.find((student) => student.id === selectedStudentId) ??
    session.students[0];

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingId || !boardRef.current) {
      return;
    }

    const rect = boardRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setDragPreview({
      x: Math.min(Math.max(x, 4), 96),
      y: Math.min(Math.max(y, 8), 92),
    });
  }

  function handlePointerUp() {
    if (!draggingId || !dragPreview) {
      setDraggingId(undefined);
      setDragPreview(undefined);
      return;
    }

    setSession((current) =>
      withSessionUpdate(current, {
        students: findStudentAtPosition(
          current.students,
          draggingId,
          dragPreview,
          10,
        )
          ? swapStudentPositions(
              current.students,
              draggingId,
              findStudentAtPosition(
                current.students,
                draggingId,
                dragPreview,
                10,
              )?.id ?? draggingId,
            )
          : updateStudentPosition(current.students, draggingId, dragPreview),
      }),
    );
    setDraggingId(undefined);
    setDragPreview(undefined);
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

      <div className="cp-home-layout">
        <section
          aria-label="교실 배치 보드"
          className="cp-class-board"
          ref={boardRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            setDraggingId(undefined);
            setDragPreview(undefined);
          }}
        >
          <div className="cp-teacher-zone">선생님</div>
          {session.students.map((student) => (
            <DraggableStudent
              dragging={draggingId === student.id}
              key={student.id}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setSelectedStudentId(student.id);
                setDraggingId(student.id);
                setDragPreview(student.position);
              }}
              previewPosition={
                draggingId === student.id ? dragPreview : undefined
              }
              selected={activeStudent?.id === student.id}
              student={student}
            />
          ))}
        </section>

        <StudentDetailPanel
          selectedStudent={activeStudent}
          session={session}
          setSession={setSession}
        />
      </div>
    </div>
  );
}

function DraggableStudent({
  dragging,
  onPointerDown,
  previewPosition,
  selected,
  student,
}: {
  dragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  previewPosition?: StudentPosition;
  selected: boolean;
  student: Student;
}) {
  const position = previewPosition ?? student.position;

  return (
    <button
      className={[
        "cp-seat-chip",
        dragging ? "dragging" : "",
        selected ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerDown={onPointerDown}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
      type="button"
    >
      {student.name}
    </button>
  );
}

function StudentDetailPanel({
  selectedStudent,
  session,
  setSession,
}: {
  selectedStudent?: Student;
  session: ClassSession;
  setSession: (
    updater: ClassSession | ((session: ClassSession) => ClassSession),
  ) => void;
}) {
  const [traitInput, setTraitInput] = useState("");
  const [pointReason, setPointReason] = useState("수업 태도");
  const pointEvents = selectedStudent
    ? session.studentPointEvents
        .filter((event) => event.studentId === selectedStudent.id)
        .slice()
        .reverse()
        .slice(0, 4)
    : [];
  const assignedTeam = selectedStudent
    ? session.teams.find((team) =>
        team.students.some((student) => student.id === selectedStudent.id),
      )
    : undefined;

  if (!selectedStudent) {
    return (
      <aside className="cp-student-detail-panel">
        <StickyNote aria-hidden="true" size={30} />
        <h3>학생을 선택해주세요</h3>
        <p>
          교실 보드에서 학생 이름을 누르면 특징과 메모를 관리할 수 있습니다.
        </p>
      </aside>
    );
  }

  function updateTraits(nextTraits: string[]) {
    if (!selectedStudent) {
      return;
    }

    setSession((current) =>
      withSessionUpdate(current, {
        students: updateStudentProfile(current.students, selectedStudent.id, {
          traits: nextTraits,
        }),
      }),
    );
  }

  function handleAddTrait() {
    const trait = traitInput.trim();

    if (!trait || !selectedStudent) {
      return;
    }

    updateTraits([...selectedStudent.traits, trait]);
    setTraitInput("");
  }

  function handleMemoChange(memo: string) {
    if (!selectedStudent) {
      return;
    }

    setSession((current) =>
      withSessionUpdate(current, {
        students: updateStudentProfile(current.students, selectedStudent.id, {
          memo,
        }),
      }),
    );
  }

  function handlePoint(kind: "merit" | "demerit", points: number) {
    if (!selectedStudent) {
      return;
    }

    setSession((current) =>
      addStudentPointEvent(
        current,
        selectedStudent.id,
        kind,
        points,
        pointReason,
      ),
    );
  }

  return (
    <aside className="cp-student-detail-panel">
      <div className="cp-student-detail-header">
        <div>
          <p className="cp-section-label">학생 메모</p>
          <h3>{selectedStudent.name}</h3>
          <span className="cp-student-team-pill">
            {assignedTeam ? `${assignedTeam.name} 소속` : "팀 미배정"}
          </span>
        </div>
        <div className="cp-student-point-summary">
          <span>상 {selectedStudent.merit}</span>
          <span>벌 {selectedStudent.demerit}</span>
        </div>
      </div>

      <label className="cp-field cp-wide-field">
        특징
        <div className="cp-trait-input-row">
          <input
            placeholder="예: 발표 자신감"
            value={traitInput}
            onChange={(event) => setTraitInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddTrait();
              }
            }}
          />
          <button
            aria-label="특징 추가"
            className="cp-icon-command small"
            disabled={!traitInput.trim()}
            onClick={handleAddTrait}
            title="특징 추가"
            type="button"
          >
            <Plus aria-hidden="true" size={18} />
          </button>
        </div>
      </label>

      <div
        className="cp-trait-list"
        aria-label={`${selectedStudent.name} 특징`}
      >
        {selectedStudent.traits.length === 0 ? (
          <span className="cp-empty-pill">특징 없음</span>
        ) : (
          selectedStudent.traits.map((trait) => (
            <span key={trait}>
              {trait}
              <button
                aria-label={`${trait} 특징 삭제`}
                onClick={() =>
                  updateTraits(
                    selectedStudent.traits.filter((item) => item !== trait),
                  )
                }
                title={`${trait} 삭제`}
                type="button"
              >
                <X aria-hidden="true" size={13} />
              </button>
            </span>
          ))
        )}
      </div>

      <label className="cp-field cp-wide-field">
        메모
        <textarea
          placeholder="관찰 메모, 자리 배치 참고사항"
          value={selectedStudent.memo}
          onChange={(event) => handleMemoChange(event.target.value)}
        />
      </label>

      <label className="cp-field cp-wide-field">
        상벌점 이유
        <input
          value={pointReason}
          onChange={(event) => setPointReason(event.target.value)}
        />
      </label>

      <div className="cp-student-point-actions">
        <button onClick={() => handlePoint("merit", 1)} type="button">
          <Star aria-hidden="true" size={18} />
          상점 +1
        </button>
        <button onClick={() => handlePoint("merit", -1)} type="button">
          <Minus aria-hidden="true" size={18} />
          상점 -1
        </button>
        <button onClick={() => handlePoint("demerit", 1)} type="button">
          <Plus aria-hidden="true" size={18} />
          벌점 +1
        </button>
        <button onClick={() => handlePoint("demerit", -1)} type="button">
          <Minus aria-hidden="true" size={18} />
          벌점 -1
        </button>
      </div>

      <div className="cp-student-point-log">
        {pointEvents.length === 0 ? (
          <p>상벌점 기록이 없습니다.</p>
        ) : (
          pointEvents.map((event) => (
            <div key={event.id}>
              <span>{formatEventTime(event.createdAt)}</span>
              <strong>{event.kind === "merit" ? "상점" : "벌점"}</strong>
              <em>
                {event.points > 0 ? "+" : ""}
                {event.points}
              </em>
              <p>{event.reason}</p>
            </div>
          ))
        )}
      </div>
    </aside>
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
          <Link
            className="cp-action-tile"
            href={`/actions/${action.id}`}
            key={action.id}
          >
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
