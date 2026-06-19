import {
  formatTime,
  getPollTotalVotes,
  getStageLabel,
} from "@/lib/classpilot";
import type { ClassSession, Poll, Team } from "@/types/classpilot";

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
        <h1>ClassPilot</h1>
        <div className="stage-timer">{formatTime(session.timer.remaining)}</div>
      </div>

      <div className="stage-body">
        {session.stageMode === "dashboard" && (
          <DashboardStage session={session} />
        )}
        {session.stageMode === "teams" && <TeamGrid teams={session.teams} />}
        {session.stageMode === "topics" && <TopicGrid teams={session.teams} />}
        {session.stageMode === "timer" && (
          <TimerStage remaining={session.timer.remaining} />
        )}
        {session.stageMode === "presentation" && (
          <PresentationStage teams={session.presentationOrder} />
        )}
        {session.stageMode === "poll" && <PollStage poll={activePoll} />}
        {session.stageMode === "random" && (
          <RandomStage name={session.selectedStudent?.name} />
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
      <Metric label="주제" value={`${session.topics.length}개`} />
      <Metric label="투표" value={`${session.polls.length}개`} />
    </div>
  );
}

function TeamGrid({ teams }: { teams: Team[] }) {
  if (teams.length === 0) {
    return <EmptyStage title="팀을 생성하면 여기에 표시됩니다." />;
  }

  return (
    <div className="stage-grid">
      {teams.map((team) => (
        <article className="stage-team" key={team.id}>
          <h2>{team.name}</h2>
          <p>{team.students.map((student) => student.name).join(" · ")}</p>
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

function PresentationStage({ teams }: { teams: Team[] }) {
  if (teams.length === 0) {
    return <EmptyStage title="발표 순서를 생성하면 여기에 표시됩니다." />;
  }

  return (
    <ol className="stage-order">
      {teams.map((team, index) => (
        <li key={team.id}>
          <span>{index + 1}</span>
          {team.name}
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
