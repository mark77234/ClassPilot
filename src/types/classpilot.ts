export type Student = {
  id: string;
  name: string;
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

export type StageMode =
  | "dashboard"
  | "teams"
  | "topics"
  | "timer"
  | "presentation"
  | "poll"
  | "random";

export type ClassSession = {
  students: Student[];
  teams: Team[];
  topics: Topic[];
  presentationOrder: Team[];
  polls: Poll[];
  activePollId?: string;
  timer: TimerState;
  stageMode: StageMode;
  selectedStudent?: Student;
  updatedAt: number;
};
