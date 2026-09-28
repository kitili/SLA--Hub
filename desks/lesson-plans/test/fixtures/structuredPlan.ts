/**
 * Shared StructuredLessonPlan fixture — a minimal valid plan based on the
 * blueprint exemplar (Grade 1 Arithmetic, "many and few").
 *
 * Used by the lessonPlan domain tests (validate / buildPrompt / render), the
 * markdown fallback-renderer round-trip test, and the savePlanStructured
 * action tests. Treat it as immutable: spread (or `structuredClone`) before
 * mutating so tests cannot contaminate each other.
 */
import type { StructuredLessonPlan } from "@/lib/ai/lessonPlan/structuredSchema";

export const VALID_PLAN: StructuredLessonPlan = {
  identifier: {
    title: "Identifying groups with many and few objects",
    grade: "1",
    subject: "Arithmetic",
    term: "1A",
    week: "Week 1",
    lesson_number: "1",
    main_competence: "4. Arithmetic",
    specific_competence: "4.1 Recognise the concept of numbers",
  },
  success_criteria: [
    "Students can look at two groups and say which has 'many' and which has 'few'.",
    "Students can use 'many' and 'few' to describe things around them.",
    "Students can make a 'many' group and a 'few' group and explain why.",
  ],
  knows: [
    "A group with more objects can be described as 'many'.",
    "A group with fewer objects can be described as 'few'.",
    "'Many' and 'few' are relative terms used to compare quantities.",
  ],
  shows: [
    "Observe two groups and orally state which has 'many' and which has 'few'.",
    "Correctly use 'many' and 'few' to describe and compare groups of classroom objects.",
    "Create two groups, one 'many' and one 'few', and explain the choice to a partner.",
  ],
  misconceptions: [
    {
      misconception: "'Many' and 'few' are relative.",
      description:
        "Thinking 'many' always means a fixed large number rather than relative to the comparison.",
    },
    {
      misconception: "Reversing the terms.",
      description: "Calling the smaller group 'many', often because it was looked at first.",
    },
  ],
  materials_and_prep: [
    "Two clear groups of objects (e.g., 2 stones and 6 stones) for the introduction.",
    "A variety of classroom objects for the I Do and We Do (pencils, bottle tops, erasers).",
  ],
  teaching_sequence: {
    introduction_hook: {
      depth: "Surface",
      text: "Teacher shows two clear groups: 2 bars of soap, and 10 children waiting to wash.",
      sentence_frame: "There are _____ soap for _____ children, so that is many / few.",
      checkpoint: "Are there MANY or FEW bars of soap compared to the students? Circle: MANY / FEW.",
    },
    i_do: {
      depth: "Surface",
      text: "Teacher points to a group of 6 stones: 'This group has MANY stones.'",
      sentence_frame: "This group has _____. This group has _____.",
      checkpoint: "Circle: The apples are MANY / The oranges are MANY.",
    },
    we_do: {
      depth: "Deep",
      text: "Teacher holds up 5 counters. 'Is 5 many, or few?' Puts 3 counters next to the 5. Now 5 is many. Puts 12 counters. Now 5 is few.",
      sentence_frame: "5 is _____ compared to _____, because _____.",
      checkpoint: "If I have 5 stickers and you have 3, who has FEW? If I have 5 and you have 12, who has FEW now? Explain.",
    },
    you_do: {
      depth: "Deep",
      text: "Pairs get 9 counters in Bag A, 2 in Bag B. Which bag has FEW? They decide and explain.",
      sentence_frame: "My group is many because _____ (compared to _____).",
      checkpoint: "Which bag has FEW counters? Make a 'many' group and tell your partner why it is many.",
    },
  },
  differentiation: {
    remedial: "Use only two very distinct groups (1 vs 5) to make the contrast obvious.",
    support: "Visual anchors, a red card for 'many' and a blue card for 'few'.",
    challenge: "Ask learners to explain WHY a group is 'many' or 'few'.",
    digital_resources: ["A short 'many vs few' video (if available)."],
  },
  conclusion_and_exit_ticket: {
    understanding:
      "A group is many or few depending on what we compare it to.",
    exit_ticket:
      "Each child circles the group with FEW mangoes, then draws one more and writes if it is still few.",
  },
  assessment_method:
    "Observe pair work during You Do and use oral questioning during We Do.",
  watch_for_notes: [
    "Listen for learners who consistently mix up 'many' and 'few'.",
    "Observe if pairs in the You Do create groups with a clear difference in quantity.",
  ],
  teacher_reflection: [
    "Did the introduction with physical objects hook the learners and elicit prior language?",
    "Was the transition from everyday language to academic language smooth?",
    "How accurate were the learners' pairs in the You Do?",
  ],
  meta: {
    source_lesson_idx: 1,
    grade: "1",
    subject: "Arithmetic",
    gaps_flagged: [],
  },
};
