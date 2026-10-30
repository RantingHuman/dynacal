import { describe, expect, it } from "vitest";
import { parseTaskLine } from "./task-line";

// Wednesday 7 January 2026.
const TODAY = "2026-01-07";

describe("parseTaskLine", () => {
  it("makes a plain line the title, with every default", () => {
    expect(parseTaskLine("Write the board memo", TODAY)).toEqual({
      input: {
        title: "Write the board memo",
        notes: "",
        estimatedMinutes: 60,
        deadline: null,
        earliestStart: null,
        priority: "medium",
        splittable: false,
      },
      context: null,
      found: [],
    });
  });

  it.each([
    ["Memo 2h", 120],
    ["Memo 90m", 90],
    ["Memo 1h30", 90],
    ["Memo 1h30m", 90],
    ["Memo 1.5 hours", 90],
    ["Memo 2 hours", 120],
    ["Memo 1 hour", 60],
    ["Memo 45 min", 45],
    ["Memo 45 minutes", 45],
    ["Memo 3H", 180],
  ])("reads the duration in %j", (line, minutes) => {
    const { input, found } = parseTaskLine(line, TODAY);

    expect(input.estimatedMinutes).toBe(minutes);
    expect(input.title).toBe("Memo");
    expect(found).toEqual(["estimatedMinutes"]);
  });

  it.each([
    ["Memo by today", "2026-01-07"],
    ["Memo due today", "2026-01-07"],
    ["Memo by tomorrow", "2026-01-08"],
    ["Memo by fri", "2026-01-09"],
    ["Memo by Friday", "2026-01-09"],
    ["Memo due mon", "2026-01-12"],
    ["Memo by thurs", "2026-01-08"],
    // A weekday is its next occurrence, today included.
    ["Memo by wed", "2026-01-07"],
    ["Memo by tue", "2026-01-13"],
  ])("reads the deadline in %j", (line, date) => {
    const { input, found } = parseTaskLine(line, TODAY);

    expect(input.deadline).toEqual({ date, time: null });
    expect(input.title).toBe("Memo");
    expect(found).toEqual(["deadline"]);
  });

  it("reads a deadline's time after 'at'", () => {
    expect(parseTaskLine("Memo by fri at 16:00", TODAY).input).toMatchObject({
      title: "Memo",
      deadline: { date: "2026-01-09", time: "16:00" },
    });
    expect(parseTaskLine("Memo due tomorrow at 9:30", TODAY).input.deadline).toEqual({
      date: "2026-01-08",
      time: "09:30",
    });
  });

  it("leaves a time that isn't a clock time in the title", () => {
    expect(parseTaskLine("Memo by fri at 25:00", TODAY).input).toMatchObject({
      title: "Memo at 25:00",
      deadline: { date: "2026-01-09", time: null },
    });
  });

  it("keeps 'by' without a day in the title", () => {
    const { input, found } = parseTaskLine("Read by the lake 2h", TODAY);

    expect(input).toMatchObject({ title: "Read by the lake", deadline: null, estimatedMinutes: 120 });
    expect(found).toEqual(["estimatedMinutes"]);
  });

  it("keeps a day without 'by' or 'due' in the title", () => {
    expect(parseTaskLine("Plan Friday drinks", TODAY).input).toMatchObject({
      title: "Plan Friday drinks",
      deadline: null,
    });
  });

  it("only reads whole weekday names and abbreviations", () => {
    expect(parseTaskLine("Feed by monster", TODAY).input).toMatchObject({ title: "Feed by monster", deadline: null });
  });

  it.each([
    ["Memo from fri", "2026-01-09"],
    ["Memo after tomorrow", "2026-01-08"],
    ["Memo not before mon", "2026-01-12"],
  ])("reads the Earliest Start in %j", (line, date) => {
    const { input, found } = parseTaskLine(line, TODAY);

    expect(input.earliestStart).toEqual({ date, time: null });
    expect(input.title).toBe("Memo");
    expect(found).toEqual(["earliestStart"]);
  });

  it("reads an Earliest Start's time after 'at'", () => {
    expect(parseTaskLine("Memo from mon at 10:00", TODAY).input).toMatchObject({
      title: "Memo",
      earliestStart: { date: "2026-01-12", time: "10:00" },
    });
  });

  it("keeps 'from' without a day in the title", () => {
    expect(parseTaskLine("Notes from the offsite", TODAY).input).toMatchObject({
      title: "Notes from the offsite",
      earliestStart: null,
    });
  });

  it.each([
    ["Memo !low", "low"],
    ["Memo !med", "medium"],
    ["Memo !medium", "medium"],
    ["Memo !high", "high"],
    ["Memo !crit", "critical"],
    ["Memo !critical", "critical"],
    ["Memo !HIGH", "high"],
  ])("reads the Priority in %j", (line, priority) => {
    const { input, found } = parseTaskLine(line, TODAY);

    expect(input.priority).toBe(priority);
    expect(input.title).toBe("Memo");
    expect(found).toEqual(["priority"]);
  });

  it("leaves an unknown '!' word in the title", () => {
    expect(parseTaskLine("Memo !urgent", TODAY).input).toMatchObject({ title: "Memo !urgent", priority: "medium" });
  });

  it.each(["Memo split", "Memo SPLIT"])("reads Splittable in %j", (line) => {
    const { input, found } = parseTaskLine(line, TODAY);

    expect(input.splittable).toBe(true);
    expect(input.title).toBe("Memo");
    expect(found).toEqual(["splittable"]);
  });

  it.each(["Memo in one go", "Memo one block", "Memo don't split", "Memo dont split", "Memo no split"])(
    "leaves the old phrase in the title of %j",
    (line) => {
      const { input, found } = parseTaskLine(line, TODAY);

      expect(input.title).toBe(line);
      expect(input.splittable).toBe(false);
      expect(found).toEqual([]);
    },
  );

  it.each([
    "Board memo 1h30 by fri at 16:00 from mon !high split",
    "!high split from mon Board memo by fri at 16:00 1h30",
    "Board from mon by fri at 16:00 !high memo split 90m",
  ])("reads every field in any order: %j", (line) => {
    const { input, found } = parseTaskLine(line, TODAY);

    expect(input).toEqual({
      title: "Board memo",
      notes: "",
      estimatedMinutes: 90,
      deadline: { date: "2026-01-09", time: "16:00" },
      earliestStart: { date: "2026-01-12", time: null },
      priority: "high",
      splittable: true,
    });
    expect(found).toEqual(["estimatedMinutes", "deadline", "earliestStart", "priority", "splittable"]);
  });

  it("reads a deadline when the title also has 'by' without a day", () => {
    expect(parseTaskLine("Stand by me essay by tomorrow", TODAY).input).toMatchObject({
      title: "Stand by me essay",
      deadline: { date: "2026-01-08", time: null },
    });
  });

  it("takes the first of two durations and leaves the other in the title", () => {
    expect(parseTaskLine("Memo 2h 30m", TODAY).input).toMatchObject({ title: "Memo 30m", estimatedMinutes: 120 });
  });

  it("gives an empty title when nothing is left, which Task validation then refuses", () => {
    expect(parseTaskLine("   ", TODAY)).toMatchObject({ input: { title: "", estimatedMinutes: 60 }, found: [] });
    expect(parseTaskLine("2h by fri", TODAY).input.title).toBe("");
  });

  it("leaves a number that isn't a duration in the title", () => {
    const { input, found } = parseTaskLine("Read chapter 2 of h2o", TODAY);

    expect(input).toMatchObject({ title: "Read chapter 2 of h2o", estimatedMinutes: 60 });
    expect(found).toEqual([]);
  });

  describe("@name", () => {
    it("puts the Task in the Context whose name starts with the word after '@'", () => {
      const { input, context, found } = parseTaskLine("Write essay 1h @deep", TODAY, ["Work", "Deep work"]);

      expect(input).toMatchObject({ title: "Write essay", estimatedMinutes: 60 });
      expect(context).toBe("Deep work");
      expect(found).toEqual(["estimatedMinutes", "context"]);
    });

    it("prefers an exact name, ignoring case, over a longer name it starts", () => {
      const { input, context } = parseTaskLine("Essay @deep", TODAY, ["Deep work", "Deep"]);

      expect(context).toBe("Deep");
      expect(input.title).toBe("Essay");
    });

    it("leaves a word that starts more than one name in the title", () => {
      const { input, context, found } = parseTaskLine("Essay @de", TODAY, ["Deep work", "Design"]);

      expect(context).toBeNull();
      expect(input.title).toBe("Essay @de");
      expect(found).toEqual([]);
    });

    it.each(["Essay @nothing", "Essay @", "Essay me@deep"])("leaves %j in the title, for the Default Context", (line) => {
      const { input, context } = parseTaskLine(line, TODAY, ["Work", "Deep work"]);

      expect(context).toBeNull();
      expect(input.title).toBe(line);
    });

    it("takes the first '@' word that names a Context and leaves the rest in the title", () => {
      const { input, context } = parseTaskLine("Essay @home @deep @work", TODAY, ["Work", "Deep work"]);

      expect(context).toBe("Deep work");
      expect(input.title).toBe("Essay @home @work");
    });

    it.each([
      "@deep Write essay 1h30 by fri !high split",
      "Write 1h30 @DEEP by fri essay split !high",
      "Write essay 1h30 by fri !high split @deep",
    ])("reads '@' anywhere alongside every other field: %j", (line) => {
      const { input, context, found } = parseTaskLine(line, TODAY, ["Work", "Deep work"]);

      expect(context).toBe("Deep work");
      expect(input).toMatchObject({
        title: "Write essay",
        estimatedMinutes: 90,
        deadline: { date: "2026-01-09", time: null },
        priority: "high",
        splittable: true,
      });
      expect(found).toEqual(["estimatedMinutes", "deadline", "priority", "splittable", "context"]);
    });
  });
});
