import type {
  ClassSession,
  Poll,
  PollOption,
  StageMode,
  Student,
  Team,
  TimerState,
  Topic,
} from "@/types/classpilot";

type RandomSource = () => number;

const TEAM_NAMES = [
  "로켓팀",
  "스파크팀",
  "웨이브팀",
  "픽셀팀",
  "루프팀",
  "노바팀",
  "브릿지팀",
  "해치팀",
];

export const STORAGE_KEY = "classpilot.session.v1";

export const DEFAULT_TIMER_SECONDS = 15 * 60;

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function createEmptySession(): ClassSession {
  return {
    students: [],
    teams: [],
    topics: [],
    presentationOrder: [],
    polls: [],
    timer: {
      duration: DEFAULT_TIMER_SECONDS,
      remaining: DEFAULT_TIMER_SECONDS,
      running: false,
    },
    stageMode: "dashboard",
    updatedAt: Date.now(),
  };
}

export function withSessionUpdate(
  session: ClassSession,
  changes: Partial<ClassSession>,
): ClassSession {
  return {
    ...session,
    ...changes,
    updatedAt: Date.now(),
  };
}

export function parseLines(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createStudents(names: string[]): Student[] {
  const seen = new Set<string>();

  return names
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((name, index) => ({
      id: `student-${index + 1}-${slugify(name)}`,
      name,
    }));
}

export function createTopics(titles: string[]): Topic[] {
  return titles.map((title, index) => ({
    id: `topic-${index + 1}-${slugify(title)}`,
    title,
  }));
}

export function createPoll(question: string, labels: string[]): Poll {
  const options = labels.map<PollOption>((label, index) => ({
    id: `option-${index + 1}-${slugify(label)}`,
    label,
  }));

  return {
    id: createId("poll"),
    question: question.trim(),
    options,
    votes: Object.fromEntries(options.map((option) => [option.id, 0])),
    status: "active",
  };
}

export function createTeams(
  students: Student[],
  teamCount: number,
  random: RandomSource = Math.random,
): Team[] {
  if (students.length === 0) {
    return [];
  }

  const normalizedTeamCount = clamp(Math.floor(teamCount), 1, students.length);
  const shuffled = shuffle(students, random);
  const teams = Array.from({ length: normalizedTeamCount }, (_, index) => ({
    id: `team-${index + 1}`,
    name: TEAM_NAMES[index] ?? `${index + 1}팀`,
    students: [] as Student[],
  }));

  shuffled.forEach((student, index) => {
    teams[index % normalizedTeamCount].students.push(student);
  });

  return teams;
}

export function assignTopicsToTeams(
  teams: Team[],
  topics: Topic[],
  random: RandomSource = Math.random,
): Team[] {
  if (teams.length === 0) {
    return [];
  }

  if (topics.length === 0) {
    return teams.map((team) => ({
      ...team,
      topic: undefined,
    }));
  }

  const shuffledTopics = shuffle(topics, random);

  return teams.map((team, index) => ({
    ...team,
    topic: shuffledTopics[index % shuffledTopics.length],
  }));
}

export function createPresentationOrder(
  teams: Team[],
  random: RandomSource = Math.random,
): Team[] {
  return shuffle(teams, random);
}

export function pickRandomStudent(
  students: Student[],
  random: RandomSource = Math.random,
): Student | undefined {
  if (students.length === 0) {
    return undefined;
  }

  return students[Math.floor(random() * students.length)];
}

export function changePollVote(
  poll: Poll,
  optionId: string,
  delta: number,
): Poll {
  const current = poll.votes[optionId] ?? 0;

  return {
    ...poll,
    votes: {
      ...poll.votes,
      [optionId]: Math.max(0, current + delta),
    },
  };
}

export function getPollTotalVotes(poll: Poll): number {
  return Object.values(poll.votes).reduce((total, count) => total + count, 0);
}

export function getStageLabel(stageMode: StageMode): string {
  const labels: Record<StageMode, string> = {
    dashboard: "대시보드",
    teams: "팀 공개",
    topics: "주제 배정",
    timer: "타이머",
    presentation: "발표 순서",
    poll: "투표 결과",
    random: "랜덤 뽑기",
  };

  return labels[stageMode];
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function createTimer(minutes: number): TimerState {
  const seconds = clamp(Math.floor(minutes * 60), 60, 180 * 60);

  return {
    duration: seconds,
    remaining: seconds,
    running: false,
  };
}

export function getSampleStudentText(): string {
  return [
    "김민준",
    "이서연",
    "박지호",
    "최하은",
    "정도윤",
    "강서준",
    "조예린",
    "윤지아",
    "장현우",
    "임수아",
    "한도현",
    "오지민",
    "신유준",
    "서아린",
    "권민재",
    "황다은",
    "안시우",
    "송하윤",
    "유건우",
    "문채원",
  ].join("\n");
}

export function getSampleTopicText(): string {
  return [
    "AI 점심 메뉴 추천 앱",
    "우리 반 투표 서비스",
    "급식 리뷰 서비스",
    "수업 집중도 체크 서비스",
  ].join("\n");
}

export function getSamplePollOptions(): string {
  return ["로켓팀", "스파크팀", "웨이브팀", "픽셀팀"].join("\n");
}

function shuffle<T>(items: T[], random: RandomSource): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}
