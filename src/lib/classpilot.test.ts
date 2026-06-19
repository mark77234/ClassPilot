import { describe, expect, it } from "vitest";
import {
  addScoreEvent,
  assignTopicToTeam,
  createEmptySession,
  createPoll,
  createPresentationOrder,
  createStudents,
  createTeams,
  createTopics,
  getPollTotalVotes,
  getWinnerTeam,
  normalizeSession,
  pickRandomStudent,
  changePollVote,
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
    expect(normalized.teams[0].score).toBe(0);
    expect(normalized.appStep).toBe("main");
  });
});
