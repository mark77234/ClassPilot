import { describe, expect, it } from "vitest";
import {
  assignTopicsToTeams,
  changePollVote,
  createPoll,
  createPresentationOrder,
  createStudents,
  createTeams,
  createTopics,
  getPollTotalVotes,
  pickRandomStudent,
} from "@/lib/classpilot";

const randomValues = (values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe("classpilot utilities", () => {
  it("creates balanced random teams", () => {
    const students = createStudents(
      Array.from({ length: 20 }, (_, index) => `학생${index + 1}`),
    );

    const teams = createTeams(students, 4, randomValues([0.2, 0.7, 0.4, 0.1]));

    expect(teams).toHaveLength(4);
    expect(teams.flatMap((team) => team.students)).toHaveLength(20);
    expect(teams.map((team) => team.students.length)).toEqual([5, 5, 5, 5]);
  });

  it("assigns topics without duplicates when enough topics exist", () => {
    const students = createStudents(["A", "B", "C", "D"]);
    const teams = createTeams(students, 4, randomValues([0.1]));
    const topics = createTopics(["주제1", "주제2", "주제3", "주제4"]);

    const assigned = assignTopicsToTeams(teams, topics, randomValues([0.3, 0.6]));
    const assignedTopicIds = assigned.map((team) => team.topic?.id);

    expect(new Set(assignedTopicIds).size).toBe(4);
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
});
