import type {
  ActionId,
  ClassSession,
  MainSection,
  Poll,
  PollOption,
  ScoreEvent,
  StageMode,
  Student,
  StudentPointEvent,
  StudentPointKind,
  StudentPosition,
  Team,
  TimerState,
  Topic,
} from "@/types/classpilot";

type RandomSource = () => number;

export type ActionDefinition = {
  id: ActionId;
  title: string;
  shortTitle: string;
  detail: string;
};

export type ActionCompleteTarget = Record<ActionId, MainSection>;

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

export const STORAGE_KEY = "classpilot.session.v2";
export const LEGACY_STORAGE_KEY = "classpilot.session.v1";

export const DEFAULT_TIMER_SECONDS = 15 * 60;

export const ACTION_DEFINITIONS: ActionDefinition[] = [
  {
    id: "team-maker",
    title: "팀 만들기",
    shortTitle: "팀",
    detail: "학생들을 팀으로 나눕니다.",
  },
  {
    id: "topic-assignment",
    title: "주제 배정",
    shortTitle: "주제",
    detail: "팀별 주제를 직접 배치합니다.",
  },
  {
    id: "timer",
    title: "수업 타이머",
    shortTitle: "타이머",
    detail: "활동 시간을 크게 표시합니다.",
  },
  {
    id: "random-student",
    title: "랜덤 학생 뽑기",
    shortTitle: "뽑기",
    detail: "오늘의 주인공을 뽑습니다.",
  },
  {
    id: "presentation-order",
    title: "발표 순서",
    shortTitle: "발표",
    detail: "팀 또는 개인 발표 순서를 만듭니다.",
  },
  {
    id: "poll",
    title: "투표",
    shortTitle: "투표",
    detail: "팀 또는 개인 투표를 진행합니다.",
  },
  {
    id: "score",
    title: "점수 추가/삭제",
    shortTitle: "점수",
    detail: "팀 점수 가산과 감점을 기록합니다.",
  },
  {
    id: "mini-game",
    title: "마블 룰렛",
    shortTitle: "마블",
    detail: "물리 엔진으로 공을 굴려 순서대로 점수를 냅니다.",
  },
  {
    id: "reward",
    title: "우승 상품 정하기",
    shortTitle: "상품",
    detail: "우승팀에게 줄 상품을 정합니다.",
  },
  {
    id: "finale",
    title: "점수 산정하기",
    shortTitle: "마무리",
    detail: "최종 우승팀을 발표합니다.",
  },
];

export const ACTION_COMPLETE_TARGETS: ActionCompleteTarget = {
  "team-maker": "teams",
  "topic-assignment": "teams",
  timer: "home",
  "random-student": "home",
  "presentation-order": "home",
  poll: "home",
  score: "teams",
  "mini-game": "home",
  reward: "teams",
  finale: "teams",
};

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function createEmptySession(): ClassSession {
  return {
    className: "",
    appStep: "start",
    mainSection: "home",
    students: [],
    teams: [],
    topics: [],
    presentationOrder: [],
    studentPresentationOrder: [],
    presentationMode: "team",
    polls: [],
    pollTarget: "team",
    timer: {
      duration: DEFAULT_TIMER_SECONDS,
      remaining: DEFAULT_TIMER_SECONDS,
      running: false,
    },
    stageMode: "dashboard",
    reward: "",
    scoreEvents: [],
    studentPointEvents: [],
    finale: {
      finished: false,
    },
    updatedAt: Date.now(),
  };
}

export function normalizeSession(value: unknown): ClassSession {
  const base = createEmptySession();

  if (!value || typeof value !== "object") {
    return base;
  }

  const raw = value as Partial<ClassSession> & Record<string, unknown>;
  const students = normalizeStudents(raw.students);
  const teams = normalizeTeams(raw.teams, students);
  const scoreEvents = normalizeScoreEvents(raw.scoreEvents);
  const studentPointEvents = normalizeStudentPointEvents(
    raw.studentPointEvents,
    students,
  );

  return {
    ...base,
    className: typeof raw.className === "string" ? raw.className : "",
    appStep: isAppStep(raw.appStep) ? raw.appStep : inferAppStep(raw, students),
    mainSection: isMainSection(raw.mainSection) ? raw.mainSection : "home",
    students,
    teams,
    topics: normalizeTopics(raw.topics),
    presentationOrder: normalizeTeams(raw.presentationOrder, students),
    studentPresentationOrder: normalizeStudents(raw.studentPresentationOrder),
    presentationMode:
      raw.presentationMode === "student" || raw.presentationMode === "team"
        ? raw.presentationMode
        : "team",
    polls: normalizePolls(raw.polls),
    activePollId:
      typeof raw.activePollId === "string" ? raw.activePollId : undefined,
    pollTarget: raw.pollTarget === "student" ? "student" : "team",
    timer: normalizeTimer(raw.timer),
    stageMode: isStageMode(raw.stageMode) ? raw.stageMode : "dashboard",
    selectedStudent: normalizeSelectedStudent(raw.selectedStudent, students),
    reward: typeof raw.reward === "string" ? raw.reward : "",
    scoreEvents,
    studentPointEvents,
    finale:
      raw.finale && typeof raw.finale === "object"
        ? {
            finished: Boolean((raw.finale as { finished?: unknown }).finished),
            winnerTeamId:
              typeof (raw.finale as { winnerTeamId?: unknown }).winnerTeamId ===
              "string"
                ? (raw.finale as { winnerTeamId: string }).winnerTeamId
                : undefined,
            finishedAt:
              typeof (raw.finale as { finishedAt?: unknown }).finishedAt ===
              "number"
                ? (raw.finale as { finishedAt: number }).finishedAt
                : undefined,
          }
        : base.finale,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
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

export function createStudent(name: string, index: number, total = 6): Student {
  return {
    id: `student-${index + 1}-${slugify(name) || createId("name")}`,
    name,
    position: createDefaultStudentPosition(index, total),
    traits: [],
    memo: "",
    merit: 0,
    demerit: 0,
  };
}

export function createStudents(names: string[]): Student[] {
  const seen = new Set<string>();
  const uniqueNames = names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return uniqueNames.map((name, index) =>
    createStudent(name, index, Math.max(uniqueNames.length, 1)),
  );
}

export function addStudentToSession(
  session: ClassSession,
  name: string,
): ClassSession {
  const trimmedName = name.trim();
  const exists = session.students.some(
    (student) => student.name.toLowerCase() === trimmedName.toLowerCase(),
  );

  if (!trimmedName || exists) {
    return session;
  }

  const nextStudents = [
    ...session.students,
    createStudent(
      trimmedName,
      session.students.length,
      Math.max(session.students.length + 1, 6),
    ),
  ];
  const students =
    session.appStep === "main" ? nextStudents : applyDefaultStudentPositions(nextStudents);

  return withSessionUpdate(session, {
    students,
    teams: removeMissingStudentsFromTeams(session.teams, students),
  });
}

export function removeStudentFromSession(
  session: ClassSession,
  studentId: string,
): ClassSession {
  const students = session.students.filter((student) => student.id !== studentId);

  return withSessionUpdate(session, {
    students,
    teams: removeMissingStudentsFromTeams(session.teams, students),
    presentationOrder: removeMissingStudentsFromTeams(
      session.presentationOrder,
      students,
    ),
    studentPresentationOrder: session.studentPresentationOrder.filter(
      (student) => student.id !== studentId,
    ),
    selectedStudent:
      session.selectedStudent?.id === studentId ? undefined : session.selectedStudent,
    studentPointEvents: session.studentPointEvents.filter(
      (event) => event.studentId !== studentId,
    ),
  });
}

export function updateStudentPosition(
  students: Student[],
  studentId: string,
  position: StudentPosition,
): Student[] {
  return students.map((student) =>
    student.id === studentId
      ? {
          ...student,
          position: {
            x: clamp(position.x, 4, 96),
            y: clamp(position.y, 8, 92),
          },
        }
      : student,
  );
}

export function createDefaultStudentPosition(
  index: number,
  total: number,
): StudentPosition {
  const safeTotal = Math.max(total, 1);
  const groups = Math.max(1, Math.ceil(safeTotal / 6));
  const groupIndex = Math.floor(index / 6);
  const localIndex = index % 6;
  const column = localIndex % 2;
  const row = Math.floor(localIndex / 2);
  const groupWidth = 78 / groups;
  const x = 11 + groupIndex * groupWidth + (column + 0.5) * (groupWidth / 2);
  const y = 24 + row * 24;

  return {
    x: clamp(x, 8, 92),
    y: clamp(y, 14, 86),
  };
}

export function applyDefaultStudentPositions(students: Student[]): Student[] {
  const total = Math.max(students.length, 6);

  return students.map((student, index) => ({
    ...student,
    position: createDefaultStudentPosition(index, total),
  }));
}

export function swapStudentPositions(
  students: Student[],
  sourceId: string,
  targetId: string,
): Student[] {
  if (sourceId === targetId) {
    return students;
  }

  const source = students.find((student) => student.id === sourceId);
  const target = students.find((student) => student.id === targetId);

  if (!source || !target) {
    return students;
  }

  return students.map((student) => {
    if (student.id === sourceId) {
      return { ...student, position: target.position };
    }

    if (student.id === targetId) {
      return { ...student, position: source.position };
    }

    return student;
  });
}

export function findStudentAtPosition(
  students: Student[],
  sourceId: string,
  position: StudentPosition,
  threshold = 8,
): Student | undefined {
  return students.find((student) => {
    if (student.id === sourceId) {
      return false;
    }

    const dx = student.position.x - position.x;
    const dy = student.position.y - position.y;

    return Math.hypot(dx, dy) <= threshold;
  });
}

export function updateStudentProfile(
  students: Student[],
  studentId: string,
  changes: {
    memo?: string;
    traits?: string[];
  },
): Student[] {
  return students.map((student) =>
    student.id === studentId
      ? {
          ...student,
          memo: changes.memo ?? student.memo,
          traits: changes.traits
            ? normalizeTraitList(changes.traits)
            : student.traits,
        }
      : student,
  );
}

export function addStudentPointEvent(
  session: ClassSession,
  studentId: string,
  kind: StudentPointKind,
  points: number,
  reason: string,
): ClassSession {
  const student = session.students.find((item) => item.id === studentId);

  if (!student || !Number.isFinite(points)) {
    return session;
  }

  const roundedPoints = Math.round(points);
  const currentPoints = student[kind];
  const nextPoints = Math.max(0, currentPoints + roundedPoints);
  const actualPoints = nextPoints - currentPoints;

  if (actualPoints === 0) {
    return session;
  }

  const event: StudentPointEvent = {
    id: createId("student-point"),
    studentId,
    studentName: student.name,
    kind,
    points: actualPoints,
    reason: reason.trim() || (kind === "merit" ? "상점" : "벌점"),
    createdAt: Date.now(),
  };

  return withSessionUpdate(session, {
    students: session.students.map((item) =>
      item.id === studentId
        ? {
            ...item,
            [kind]: Math.max(0, item[kind] + actualPoints),
          }
        : item,
    ),
    teams: session.teams.map((team) => ({
      ...team,
      students: team.students.map((item) =>
        item.id === studentId
          ? {
              ...item,
              [kind]: Math.max(0, item[kind] + actualPoints),
            }
          : item,
      ),
    })),
    studentPresentationOrder: session.studentPresentationOrder.map((item) =>
      item.id === studentId
        ? {
            ...item,
            [kind]: Math.max(0, item[kind] + actualPoints),
          }
        : item,
    ),
    selectedStudent:
      session.selectedStudent?.id === studentId
        ? {
            ...session.selectedStudent,
            [kind]: Math.max(0, session.selectedStudent[kind] + actualPoints),
          }
        : session.selectedStudent,
    studentPointEvents: [...session.studentPointEvents, event],
  });
}

export function createTopics(titles: string[]): Topic[] {
  return titles.map((title, index) => ({
    id: `topic-${index + 1}-${slugify(title) || createId("topic")}`,
    title,
  }));
}

export function createPoll(question: string, labels: string[]): Poll {
  const options = labels.map<PollOption>((label, index) => ({
    id: `option-${index + 1}-${slugify(label) || createId("option")}`,
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
    score: 0,
  }));

  shuffled.forEach((student, index) => {
    teams[index % normalizedTeamCount].students.push(student);
  });

  return teams;
}

export function addTeam(teams: Team[]): Team[] {
  const nextIndex = teams.length + 1;
  const nextIdNumber =
    Math.max(
      0,
      ...teams
        .map((team) => Number(team.id.replace("team-", "")))
        .filter(Number.isFinite),
    ) + 1;

  return [
    ...teams,
    {
      id: `team-${nextIdNumber}`,
      name: TEAM_NAMES[nextIndex - 1] ?? `${nextIndex}팀`,
      students: [],
      score: 0,
    },
  ];
}

export function deleteTeam(teams: Team[], teamId: string): Team[] {
  return teams.filter((team) => team.id !== teamId);
}

export function deleteTeamFromSession(
  session: ClassSession,
  teamId: string,
): ClassSession {
  return withSessionUpdate(session, {
    teams: deleteTeam(session.teams, teamId),
    presentationOrder: session.presentationOrder.filter(
      (team) => team.id !== teamId,
    ),
    finale:
      session.finale.winnerTeamId === teamId
        ? { finished: false }
        : session.finale,
  });
}

export function moveStudentToTeam(
  teams: Team[],
  students: Student[],
  studentId: string,
  targetTeamId?: string,
  targetIndex?: number,
): Team[] {
  const student = students.find((item) => item.id === studentId);

  if (!student) {
    return teams;
  }

  const teamsWithoutStudent = teams.map((team) => ({
    ...team,
    students: team.students.filter((item) => item.id !== studentId),
  }));

  if (!targetTeamId) {
    return teamsWithoutStudent;
  }

  return teamsWithoutStudent.map((team) => {
    if (team.id !== targetTeamId) {
      return team;
    }

    const nextStudents = [...team.students];
    const insertIndex =
      typeof targetIndex === "number"
        ? clamp(Math.floor(targetIndex), 0, nextStudents.length)
        : nextStudents.length;
    nextStudents.splice(insertIndex, 0, student);

    return {
      ...team,
      students: nextStudents,
    };
  });
}

export function getUnassignedStudents(students: Student[], teams: Team[]): Student[] {
  const assignedIds = new Set(
    teams.flatMap((team) => team.students.map((student) => student.id)),
  );

  return students.filter((student) => !assignedIds.has(student.id));
}

export function createManualTeams(
  students: Student[],
  teamCount: number,
  assignments: Record<string, string>,
): Team[] {
  if (students.length === 0) {
    return [];
  }

  const normalizedTeamCount = clamp(Math.floor(teamCount), 1, students.length);
  const teams = Array.from({ length: normalizedTeamCount }, (_, index) => ({
    id: `team-${index + 1}`,
    name: TEAM_NAMES[index] ?? `${index + 1}팀`,
    students: [] as Student[],
    score: 0,
  }));
  const teamIds = new Set(teams.map((team) => team.id));

  students.forEach((student, index) => {
    const assignedTeamId = teamIds.has(assignments[student.id])
      ? assignments[student.id]
      : teams[index % normalizedTeamCount].id;
    const team = teams.find((item) => item.id === assignedTeamId) ?? teams[0];
    team.students.push(student);
  });

  return teams;
}

export function renameTeam(teams: Team[], teamId: string, name: string): Team[] {
  return teams.map((team) =>
    team.id === teamId ? { ...team, name: name.trim() || team.name } : team,
  );
}

export function assignTopicToTeam(
  teams: Team[],
  teamId: string,
  topicTitle: string,
): Team[] {
  return teams.map((team) =>
    team.id === teamId
      ? {
          ...team,
          topic: topicTitle.trim()
            ? {
                id: `topic-${team.id}-${slugify(topicTitle) || createId("topic")}`,
                title: topicTitle.trim(),
              }
            : undefined,
        }
      : team,
  );
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

export function createStudentPresentationOrder(
  students: Student[],
  random: RandomSource = Math.random,
): Student[] {
  return shuffle(students, random);
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

export function addScoreEvent(
  session: ClassSession,
  teamId: string,
  points: number,
  reason: string,
): ClassSession {
  const team = session.teams.find((item) => item.id === teamId);

  if (!team || !Number.isFinite(points)) {
    return session;
  }

  const roundedPoints = Math.round(points);
  const event: ScoreEvent = {
    id: createId("score"),
    teamId,
    teamName: team.name,
    points: roundedPoints,
    reason: reason.trim() || "수업 점수",
    createdAt: Date.now(),
  };

  return withSessionUpdate(session, {
    teams: session.teams.map((item) =>
      item.id === teamId
        ? {
            ...item,
            score: item.score + roundedPoints,
          }
        : item,
    ),
    scoreEvents: [...session.scoreEvents, event],
    finale: {
      finished: false,
    },
  });
}

export function getWinnerTeam(teams: Team[]): Team | undefined {
  return [...teams].sort((left, right) => right.score - left.score)[0];
}

export function getRankedTeams(teams: Team[]): Team[] {
  return [...teams].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.name.localeCompare(right.name);
  });
}

export function finishSession(session: ClassSession): ClassSession {
  const winner = getWinnerTeam(session.teams);

  return withSessionUpdate(session, {
    finale: {
      finished: true,
      winnerTeamId: winner?.id,
      finishedAt: Date.now(),
    },
  });
}

export function getActionDefinition(actionId: string): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find((action) => action.id === actionId);
}

export function getActionCompleteSection(actionId: ActionId): MainSection {
  return ACTION_COMPLETE_TARGETS[actionId];
}

export function isActionId(actionId: string): actionId is ActionId {
  return ACTION_DEFINITIONS.some((action) => action.id === actionId);
}

export function getStageLabel(stageMode: StageMode): string {
  const labels: Record<StageMode, string> = {
    dashboard: "홈",
    teams: "팀 현황",
    topics: "주제 배정",
    timer: "타이머",
    presentation: "발표 순서",
    poll: "투표 결과",
    random: "랜덤 뽑기",
  };

  return labels[stageMode];
}

export function getMainSectionLabel(section: MainSection): string {
  const labels: Record<MainSection, string> = {
    home: "홈",
    actions: "액션",
    teams: "팀",
  };

  return labels[section];
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function formatEventTime(timestamp: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
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

function normalizeStudents(value: unknown): Student[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index): Student | undefined => {
      if (!item || typeof item !== "object") {
        return undefined;
      }

      const raw = item as Partial<Student> & Record<string, unknown>;
      const name = typeof raw.name === "string" ? raw.name.trim() : "";

      if (!name) {
        return undefined;
      }

      return {
        id: typeof raw.id === "string" ? raw.id : `student-${index + 1}`,
        name,
        position: normalizePosition(raw.position, index, value.length),
        traits: Array.isArray(raw.traits)
          ? normalizeTraitList(
              raw.traits.filter((trait): trait is string => typeof trait === "string"),
            )
          : [],
        memo: typeof raw.memo === "string" ? raw.memo : "",
        merit: typeof raw.merit === "number" ? Math.max(0, raw.merit) : 0,
        demerit: typeof raw.demerit === "number" ? Math.max(0, raw.demerit) : 0,
      };
    })
    .filter((student): student is Student => Boolean(student));
}

function normalizeTeams(value: unknown, students: Student[]): Team[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const studentMap = new Map(students.map((student) => [student.id, student]));

  return value
    .map((item, index): Team | undefined => {
      if (!item || typeof item !== "object") {
        return undefined;
      }

      const raw = item as Partial<Team> & Record<string, unknown>;
      const teamStudents = Array.isArray(raw.students)
        ? raw.students
            .map((student) => {
              if (!student || typeof student !== "object") {
                return undefined;
              }

              const id = (student as Partial<Student>).id;
              return typeof id === "string" ? studentMap.get(id) : undefined;
            })
            .filter((student): student is Student => Boolean(student))
        : [];

      const team: Team = {
        id: typeof raw.id === "string" ? raw.id : `team-${index + 1}`,
        name:
          typeof raw.name === "string" && raw.name.trim()
            ? raw.name
            : TEAM_NAMES[index] ?? `${index + 1}팀`,
        students: teamStudents,
        topic:
          raw.topic && typeof raw.topic === "object"
            ? normalizeTopic(raw.topic)
            : undefined,
        score: typeof raw.score === "number" ? raw.score : 0,
      };

      return team;
    })
    .filter((team): team is Team => Boolean(team));
}

function normalizeTopics(value: unknown): Topic[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }

      return normalizeTopic(item, index);
    })
    .filter((topic): topic is Topic => Boolean(topic));
}

function normalizeTopic(value: unknown, index = 0): Topic | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Partial<Topic>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";

  if (!title) {
    return undefined;
  }

  return {
    id: typeof raw.id === "string" ? raw.id : `topic-${index + 1}`,
    title,
  };
}

function normalizePolls(value: unknown): Poll[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }

      const raw = item as Partial<Poll>;
      const options = Array.isArray(raw.options)
        ? raw.options.filter(
            (option): option is PollOption =>
              Boolean(
                option &&
                  typeof option.id === "string" &&
                  typeof option.label === "string",
              ),
          )
        : [];

      if (!raw.question || options.length === 0) {
        return undefined;
      }

      return {
        id: typeof raw.id === "string" ? raw.id : createId("poll"),
        question: raw.question,
        options,
        votes:
          raw.votes && typeof raw.votes === "object"
            ? (raw.votes as Record<string, number>)
            : Object.fromEntries(options.map((option) => [option.id, 0])),
        status:
          raw.status === "draft" || raw.status === "closed"
            ? raw.status
            : "active",
      };
    })
    .filter((poll): poll is Poll => Boolean(poll));
}

function normalizeTimer(value: unknown): TimerState {
  if (!value || typeof value !== "object") {
    return createEmptySession().timer;
  }

  const raw = value as Partial<TimerState>;
  const duration =
    typeof raw.duration === "number" ? raw.duration : DEFAULT_TIMER_SECONDS;
  const remaining =
    typeof raw.remaining === "number" ? raw.remaining : DEFAULT_TIMER_SECONDS;

  return {
    duration,
    remaining,
    running: Boolean(raw.running) && remaining > 0,
  };
}

function normalizeScoreEvents(value: unknown): ScoreEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is ScoreEvent =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as ScoreEvent).id === "string" &&
          typeof (item as ScoreEvent).teamId === "string" &&
          typeof (item as ScoreEvent).teamName === "string" &&
          typeof (item as ScoreEvent).points === "number" &&
          typeof (item as ScoreEvent).reason === "string" &&
          typeof (item as ScoreEvent).createdAt === "number",
      ),
  );
}

function normalizeStudentPointEvents(
  value: unknown,
  students: Student[],
): StudentPointEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const studentIds = new Set(students.map((student) => student.id));

  return value.filter(
    (item): item is StudentPointEvent =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as StudentPointEvent).id === "string" &&
          typeof (item as StudentPointEvent).studentId === "string" &&
          studentIds.has((item as StudentPointEvent).studentId) &&
          typeof (item as StudentPointEvent).studentName === "string" &&
          ((item as StudentPointEvent).kind === "merit" ||
            (item as StudentPointEvent).kind === "demerit") &&
          typeof (item as StudentPointEvent).points === "number" &&
          typeof (item as StudentPointEvent).reason === "string" &&
          typeof (item as StudentPointEvent).createdAt === "number",
      ),
  );
}

function normalizeSelectedStudent(
  value: unknown,
  students: Student[],
): Student | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const id = (value as Partial<Student>).id;

  return typeof id === "string"
    ? students.find((student) => student.id === id)
    : undefined;
}

function normalizePosition(
  value: unknown,
  index: number,
  total: number,
): StudentPosition {
  if (value && typeof value === "object") {
    const raw = value as Partial<StudentPosition>;
    if (typeof raw.x === "number" && typeof raw.y === "number") {
      return {
        x: clamp(raw.x, 4, 96),
        y: clamp(raw.y, 8, 92),
      };
    }
  }

  return createDefaultStudentPosition(index, Math.max(total, 6));
}

function removeMissingStudentsFromTeams(teams: Team[], students: Student[]): Team[] {
  const ids = new Set(students.map((student) => student.id));

  return teams.map((team) => ({
    ...team,
    students: team.students.filter((student) => ids.has(student.id)),
  }));
}

function normalizeTraitList(traits: string[]): string[] {
  const seen = new Set<string>();

  return traits
    .map((trait) => trait.trim())
    .filter(Boolean)
    .filter((trait) => {
      const key = trait.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function inferAppStep(
  raw: Partial<ClassSession> & Record<string, unknown>,
  students: Student[],
): ClassSession["appStep"] {
  if (students.length > 0) {
    return "main";
  }

  return typeof raw.className === "string" && raw.className.trim()
    ? "students"
    : "start";
}

function isAppStep(value: unknown): value is ClassSession["appStep"] {
  return (
    value === "start" ||
    value === "class-name" ||
    value === "students" ||
    value === "main"
  );
}

function isMainSection(value: unknown): value is MainSection {
  return value === "home" || value === "actions" || value === "teams";
}

function isStageMode(value: unknown): value is StageMode {
  return (
    value === "dashboard" ||
    value === "teams" ||
    value === "topics" ||
    value === "timer" ||
    value === "presentation" ||
    value === "poll" ||
    value === "random"
  );
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
