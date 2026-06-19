import { describe, expect, it } from "vitest";
import {
  addStudentPointEvent,
  addScoreEvent,
  addTeam,
  assignTopicToTeam,
  createDefaultStudentPosition,
  createEmptySession,
  createManualTeams,
  createPoll,
  createPresentationOrder,
  createStudents,
  createTeams,
  createTopics,
  deleteTeamFromSession,
  findStudentAtPosition,
  getActionCompleteSection,
  getPollTotalVotes,
  getRankedStudents,
  getStudentScore,
  getUnassignedStudents,
  getWinnerTeam,
  moveStudentToTeam,
  normalizeSession,
  pickRandomStudent,
  changePollVote,
  swapStudentPositions,
  updateStudentProfile,
  updateStudentPosition,
} from "@/lib/classpilot";

const randomValues = (values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe("classpilot utilities", () => {
  it("creates unique students with default board positions", () => {
    const students = createStudents(["A", "B", "A"]);

    expect(students).toHaveLength(2);
    expect(students[0].position.x).toBeGreaterThan(0);
    expect(students[0].position.y).toBeGreaterThan(0);
    expect(students[0].traits).toEqual([]);
    expect(students[0].memo).toBe("");
  });

  it("places the first six students as two columns and three rows", () => {
    const positions = Array.from({ length: 6 }, (_, index) =>
      createDefaultStudentPosition(index, 6),
    );

    expect(positions.map((position) => Math.round(position.x))).toEqual([
      31, 70, 31, 70, 31, 70,
    ]);
    expect(positions.map((position) => position.y)).toEqual([
      24, 24, 48, 48, 72, 72,
    ]);
  });

  it("creates balanced random teams with zero scores", () => {
    const students = createStudents(
      Array.from({ length: 20 }, (_, index) => `학생${index + 1}`),
    );

    const teams = createTeams(students, 4, randomValues([0.2, 0.7, 0.4, 0.1]));

    expect(teams).toHaveLength(4);
    expect(teams.flatMap((team) => team.students)).toHaveLength(20);
    expect(teams.map((team) => team.students.length)).toEqual([5, 5, 5, 5]);
    expect(teams.map((team) => team.score)).toEqual([0, 0, 0, 0]);
  });

  it("creates teams from manual student assignments", () => {
    const students = createStudents(["A", "B", "C", "D"]);
    const teams = createManualTeams(students, 2, {
      [students[0].id]: "team-2",
      [students[1].id]: "team-1",
      [students[2].id]: "team-2",
      [students[3].id]: "team-1",
    });

    expect(teams.map((team) => team.students.map((student) => student.name))).toEqual([
      ["B", "D"],
      ["A", "C"],
    ]);
  });

  it("adds a new empty team without moving students", () => {
    const students = createStudents(["A", "B", "C", "D"]);
    const teams = createTeams(students, 2, randomValues([0.5]));
    const updated = addTeam(teams);

    expect(updated).toHaveLength(3);
    expect(updated[2].students).toEqual([]);
    expect(updated.flatMap((team) => team.students)).toHaveLength(4);
  });

  it("deletes a team and leaves its students unassigned", () => {
    const students = createStudents(["A", "B", "C", "D"]);
    const teams = createTeams(students, 2, randomValues([0.5]));
    const session = {
      ...createEmptySession(),
      students,
      teams,
      presentationOrder: teams,
    };

    const updated = deleteTeamFromSession(session, teams[0].id);

    expect(updated.teams).toHaveLength(1);
    expect(updated.presentationOrder.map((team) => team.id)).not.toContain(
      teams[0].id,
    );
    expect(getUnassignedStudents(updated.students, updated.teams)).toEqual(
      teams[0].students,
    );
  });

  it("moves students between teams and unassigned area without duplication", () => {
    const students = createStudents(["A", "B", "C", "D"]);
    const teams = createTeams(students, 2, randomValues([0.5]));
    const studentId = teams[0].students[0].id;

    const movedToOtherTeam = moveStudentToTeam(
      teams,
      students,
      studentId,
      teams[1].id,
      0,
    );
    expect(movedToOtherTeam[1].students[0].id).toBe(studentId);
    expect(
      movedToOtherTeam.flatMap((team) => team.students).filter((student) => student.id === studentId),
    ).toHaveLength(1);

    const movedToUnassigned = moveStudentToTeam(
      movedToOtherTeam,
      students,
      studentId,
      undefined,
    );
    expect(getUnassignedStudents(students, movedToUnassigned)[0].id).toBe(studentId);
  });

  it("maps action completion to the expected main section", () => {
    expect(getActionCompleteSection("team-maker")).toBe("teams");
    expect(getActionCompleteSection("mini-game")).toBe("home");
    expect(getActionCompleteSection("reward")).toBe("teams");
  });

  it("assigns a topic directly to a selected team", () => {
    const students = createStudents(["A", "B", "C", "D"]);
    const teams = createTeams(students, 2, randomValues([0.1]));
    const updated = assignTopicToTeam(teams, teams[0].id, "AI 서비스 만들기");

    expect(updated[0].topic?.title).toBe("AI 서비스 만들기");
    expect(updated[1].topic).toBeUndefined();
  });

  it("updates student board position by percentage", () => {
    const students = createStudents(["A", "B"]);
    const updated = updateStudentPosition(students, students[0].id, {
      x: 140,
      y: -20,
    });

    expect(updated[0].position).toEqual({ x: 96, y: 8 });
    expect(updated[1].position).toEqual(students[1].position);
  });

  it("swaps student positions when dropped over another student", () => {
    const students = createStudents(["A", "B"]);
    const updated = swapStudentPositions(students, students[0].id, students[1].id);

    expect(updated[0].position).toEqual(students[1].position);
    expect(updated[1].position).toEqual(students[0].position);
  });

  it("finds a drop target near a student position", () => {
    const students = createStudents(["A", "B"]);
    const target = findStudentAtPosition(
      students,
      students[0].id,
      students[1].position,
      2,
    );

    expect(target?.id).toBe(students[1].id);
  });

  it("updates one student profile without changing others", () => {
    const students = createStudents(["A", "B"]);
    const updated = updateStudentProfile(students, students[0].id, {
      traits: ["발표", " 발표 ", "도움"],
      memo: "앞자리 선호",
    });

    expect(updated[0].traits).toEqual(["발표", "도움"]);
    expect(updated[0].memo).toBe("앞자리 선호");
    expect(updated[1].memo).toBe("");
  });

  it("creates presentation order with every team exactly once", () => {
    const students = createStudents(["A", "B", "C", "D"]);
    const teams = createTeams(students, 2, randomValues([0.5]));

    const order = createPresentationOrder(teams, randomValues([0.2]));

    expect(order).toHaveLength(2);
    expect(new Set(order.map((team) => team.id))).toEqual(
      new Set(teams.map((team) => team.id)),
    );
  });

  it("picks one student from the list", () => {
    const students = createStudents(["A", "B", "C"]);

    expect(pickRandomStudent(students, () => 0.99)?.name).toBe("C");
  });

  it("aggregates poll votes and prevents negative counts", () => {
    const poll = createPoll("질문", ["A", "B"]);
    const optionId = poll.options[0].id;
    const voted = changePollVote(changePollVote(poll, optionId, 1), optionId, 1);
    const corrected = changePollVote(voted, optionId, -3);

    expect(getPollTotalVotes(voted)).toBe(2);
    expect(corrected.votes[optionId]).toBe(0);
  });

  it("adds score event and updates team score", () => {
    const students = createStudents(["A", "B", "C", "D"]);
    const teams = createTeams(students, 2, randomValues([0.5]));
    const session = {
      ...createEmptySession(),
      students,
      teams,
    };

    const updated = addScoreEvent(session, teams[0].id, 15, "발표");

    expect(updated.teams[0].score).toBe(15);
    expect(updated.scoreEvents[0].reason).toBe("발표");
  });

  it("allows team score deletion through negative score events", () => {
    const students = createStudents(["A", "B", "C", "D"]);
    const teams = createTeams(students, 2, randomValues([0.5]));
    const session = {
      ...createEmptySession(),
      students,
      teams,
    };

    const updated = addScoreEvent(session, teams[0].id, -5, "규칙 위반");

    expect(updated.teams[0].score).toBe(-5);
    expect(updated.scoreEvents[0].points).toBe(-5);
  });

  it("adds student merit and demerit events", () => {
    const students = createStudents(["A", "B"]);
    const session = {
      ...createEmptySession(),
      students,
    };

    const withMerit = addStudentPointEvent(
      session,
      students[0].id,
      "merit",
      2,
      "친구 도움",
    );
    const withDemerit = addStudentPointEvent(
      withMerit,
      students[0].id,
      "demerit",
      1,
      "지각",
    );

    const adjusted = addStudentPointEvent(
      withDemerit,
      students[0].id,
      "merit",
      -1,
      "정정",
    );

    expect(adjusted.students[0].merit).toBe(1);
    expect(adjusted.students[0].demerit).toBe(1);
    expect(adjusted.studentPointEvents).toHaveLength(3);
    expect(adjusted.studentPointEvents[2].points).toBe(-1);
  });

  it("calculates and ranks student individual scores", () => {
    const [first, second, third] = createStudents(["A", "B", "C"]);
    const students = [
      { ...first, merit: 2, demerit: 1 },
      { ...second, merit: 3, demerit: 0 },
      { ...third, merit: 1, demerit: 3 },
    ];

    expect(getStudentScore(students[0])).toBe(1);
    expect(getRankedStudents(students).map((student) => student.name)).toEqual([
      "B",
      "A",
      "C",
    ]);
  });

  it("returns the highest scoring team as winner", () => {
    const students = createStudents(["A", "B", "C", "D"]);
    const teams = createTeams(students, 2, randomValues([0.5]));
    const winner = getWinnerTeam([
      { ...teams[0], score: 5 },
      { ...teams[1], score: 20 },
    ]);

    expect(winner?.score).toBe(20);
  });

  it("normalizes legacy session data", () => {
    const normalized = normalizeSession({
      students: [{ id: "a", name: "A" }],
      teams: [{ id: "team-1", name: "팀", students: [{ id: "a", name: "A" }] }],
      topics: createTopics(["주제"]),
    });

    expect(normalized.students[0].position).toBeDefined();
    expect(normalized.students[0].traits).toEqual([]);
    expect(normalized.studentPointEvents).toEqual([]);
    expect(normalized.teams[0].score).toBe(0);
    expect(normalized.appStep).toBe("main");
  });
});
