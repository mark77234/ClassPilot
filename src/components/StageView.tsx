import {
  formatEventTime,
  formatTime,
  getPollTotalVotes,
  getRankedTeams,
  getStageLabel,
  getWinnerTeam,
} from "@/lib/classpilot";
import type { ClassSession, Poll, Student, Team } from "@/types/classpilot";

type StageViewProps = {
  session: ClassSession;
  compact?: boolean;
};

export function StageView({ session, compact = false }: StageViewProps) {
  const activePoll =
    session.polls.find((poll) => poll.id === session.activePollId) ??
    session.polls[0];

  return (
    <section className={compact ? "stage stage-compact" : "stage"}>
      <div className="stage-header">
        <p className="stage-kicker">{getStageLabel(session.stageMode)}</p>
        <h1>{session.className || "ClassPilot"}</h1>
        <div className="stage-timer">{formatTime(session.timer.remaining)}</div>
      </div>

      <div className="stage-body">
        {session.finale.finished ? (
          <FinaleStage session={session} />
        ) : (
          <>
            {session.stageMode === "dashboard" && (
              <DashboardStage session={session} />
            )}
            {session.stageMode === "teams" && <TeamGrid teams={session.teams} />}
            {session.stageMode === "topics" && <TopicGrid teams={session.teams} />}
            {session.stageMode === "timer" && (
              <TimerStage remaining={session.timer.remaining} />
            )}
            {session.stageMode === "presentation" && (
              <PresentationStage session={session} />
            )}
            {session.stageMode === "poll" && <PollStage poll={activePoll} />}
            {session.stageMode === "random" && (
              <RandomStage name={session.selectedStudent?.name} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function DashboardStage({ session }: { session: ClassSession }) {
  return (
    <div className="stage-dashboard">
      <Metric label="학생" value={`${session.students.length}명`} />
      <Metric label="팀" value={`${session.teams.length}개`} />
      <Metric
        label="최고 점수"
        value={`${getRankedTeams(session.teams)[0]?.score ?? 0}점`}
      />
      <Metric label="상품" value={session.reward || "미정"} />
      <ReadOnlyStudentBoard students={session.students} />
    </div>
  );
}

function ReadOnlyStudentBoard({ students }: { students: Student[] }) {
  return (
    <div className="stage-student-board">
      {students.map((student) => (
        <span
          key={student.id}
          style={{ left: `${student.position.x}%`, top: `${student.position.y}%` }}
        >
          {student.name}
        </span>
      ))}
    </div>
  );
}

function TeamGrid({ teams }: { teams: Team[] }) {
  if (teams.length === 0) {
    return <EmptyStage title="팀을 생성하면 여기에 표시됩니다." />;
  }

  return (
    <div className="stage-grid">
      {getRankedTeams(teams).map((team) => (
        <article className="stage-team" key={team.id}>
          <div className="stage-team-title">
            <h2>{team.name}</h2>
            <strong>{team.score}점</strong>
          </div>
          <p>{team.students.map((student) => student.name).join(" · ")}</p>
          <em>{team.topic?.title || " "}</em>
        </article>
      ))}
    </div>
  );
}

function TopicGrid({ teams }: { teams: Team[] }) {
  const assignedTeams = teams.filter((team) => team.topic);

  if (assignedTeams.length === 0) {
    return <EmptyStage title="주제를 배정하면 여기에 표시됩니다." />;
  }

  return (
    <div className="stage-grid">
      {assignedTeams.map((team) => (
        <article className="stage-team" key={team.id}>
          <h2>{team.name}</h2>
          <p>{team.topic?.title}</p>
        </article>
      ))}
    </div>
  );
}

function TimerStage({ remaining }: { remaining: number }) {
  return <div className="stage-countdown">{formatTime(remaining)}</div>;
}

function PresentationStage({ session }: { session: ClassSession }) {
  const items =
    session.presentationMode === "team"
      ? session.presentationOrder
      : session.studentPresentationOrder;

  if (items.length === 0) {
    return <EmptyStage title="발표 순서를 생성하면 여기에 표시됩니다." />;
  }

  return (
    <ol className="stage-order">
      {items.map((item, index) => (
        <li key={item.id}>
          <span>{index + 1}</span>
          {item.name}
        </li>
      ))}
    </ol>
  );
}

function PollStage({ poll }: { poll?: Poll }) {
  if (!poll) {
    return <EmptyStage title="투표를 만들면 결과가 표시됩니다." />;
  }

  const totalVotes = getPollTotalVotes(poll);

  return (
    <div className="stage-poll">
      <h2>{poll.question}</h2>
      <div className="stage-bars">
        {poll.options.map((option) => {
          const votes = poll.votes[option.id] ?? 0;
          const percent = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);

          return (
            <div className="stage-bar-row" key={option.id}>
              <div className="stage-bar-label">
                <strong>{option.label}</strong>
                <span>{votes}표</span>
              </div>
              <div className="stage-bar-track">
                <div
                  className="stage-bar-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RandomStage({ name }: { name?: string }) {
  return (
    <div className="stage-random">
      <span>오늘의 주인공</span>
      <strong>{name ?? "대기 중"}</strong>
    </div>
  );
}

function FinaleStage({ session }: { session: ClassSession }) {
  const winner = getWinnerTeam(session.teams);

  return (
    <div className="stage-finale">
      <span>최종 우승</span>
      <strong>{winner?.name ?? "대기 중"}</strong>
      <p>{session.reward ? `상품: ${session.reward}` : "상품은 아직 미정"}</p>
      <div className="stage-score-events">
        {session.scoreEvents.slice(-5).map((event) => (
          <div key={event.id}>
            <em>{formatEventTime(event.createdAt)}</em>
            <span>{event.teamName}</span>
            <strong>
              {event.points > 0 ? "+" : ""}
              {event.points}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stage-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyStage({ title }: { title: string }) {
  return <div className="stage-empty">{title}</div>;
}
