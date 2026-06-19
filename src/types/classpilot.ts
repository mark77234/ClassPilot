export type Student = {
  id: string;
  name: string;
  position: StudentPosition;
  traits: string[];
  memo: string;
  merit: number;
  demerit: number;
};

export type StudentPosition = {
  x: number;
  y: number;
};

export type Topic = {
  id: string;
  title: string;
};

export type Team = {
  id: string;
  name: string;
  students: Student[];
  topic?: Topic;
  score: number;
};

export type PollStatus = "draft" | "active" | "closed";

export type PollOption = {
  id: string;
  label: string;
};

export type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  votes: Record<string, number>;
  status: PollStatus;
};

export type TimerState = {
  duration: number;
  remaining: number;
  running: boolean;
};

export type AppStep = "start" | "class-name" | "students" | "main";

export type MainSection = "home" | "actions" | "teams";

export type TeamEditorMode = "random" | "manual" | "edit";

export type TeamDragPayload = {
  studentId: string;
  fromTeamId?: string;
};

export type ActionId =
  | "team-maker"
  | "topic-assignment"
  | "timer"
  | "random-student"
  | "presentation-order"
  | "poll"
  | "score"
  | "mini-game"
  | "reward"
  | "finale";

export type PresentationMode = "team" | "student";

export type PollTarget = "team" | "student";

export type DrawTarget = "team" | "student";

export type MiniGameMode = "marble-roulette";

export type MarbleRacePhase = "idle" | "generated" | "running" | "finished";

export type MarbleBallState = {
  id: string;
  name: string;
  type: DrawTarget;
  color: string;
  status: "ready" | "running" | "finished" | "restarted";
  rank?: number;
  resets: number;
};

export type ScoreEvent = {
  id: string;
  teamId: string;
  teamName: string;
  points: number;
  reason: string;
  createdAt: number;
};

export type StudentPointKind = "merit" | "demerit";

export type StudentPointEvent = {
  id: string;
  studentId: string;
  studentName: string;
  kind: StudentPointKind;
  points: number;
  reason: string;
  createdAt: number;
};

export type FinaleState = {
  finished: boolean;
  winnerTeamId?: string;
  finishedAt?: number;
};

export type StageMode =
  | "dashboard"
  | "teams"
  | "topics"
  | "timer"
  | "presentation"
  | "poll"
  | "random";

export type ClassSession = {
  className: string;
  appStep: AppStep;
  mainSection: MainSection;
  students: Student[];
  teams: Team[];
  topics: Topic[];
  presentationOrder: Team[];
  studentPresentationOrder: Student[];
  presentationMode: PresentationMode;
  polls: Poll[];
  activePollId?: string;
  pollTarget: PollTarget;
  timer: TimerState;
  stageMode: StageMode;
  selectedStudent?: Student;
  reward: string;
  scoreEvents: ScoreEvent[];
  studentPointEvents: StudentPointEvent[];
  finale: FinaleState;
  updatedAt: number;
};
