import type { LeadershipPayload } from "./schema";

/** A small, valid payload shaped like the Apps Script's buildPayload output. */
export function samplePayload(overrides: Partial<LeadershipPayload> = {}): LeadershipPayload {
  return {
    campuses: ["Usa River", "Kijenge"],
    terms: [
      { name: "Term 1A", label: "Term 1A", start: "2026-01-12", end: "2026-03-06" },
      { name: "Term 1B", label: "Term 1B", start: "2026-03-16", end: "2026-05-29" },
    ],
    pdLists: { management: ["Narrating the positive"], rigor: ["Checking for understanding"] },
    walkthroughs: [
      {
        date: "2026-02-03", term: "Term 1A", campus: "Usa River", facilitator: "Grace Kambona",
        roles: "Principal", present: "Grace Kambona", ampm: "AM", pd: "Narrating the positive",
        assign: "Irene Didass Machange", target: "2026-02-20",
        glows: "Calm transitions", grows: "Exit tickets", notes: "",
      },
      {
        date: "2026-02-10", term: "Term 1A", campus: "Kijenge", facilitator: "Godfrey Mulokozi",
        roles: "Coach", present: "Godfrey Mulokozi", ampm: "PM", pd: "Checking for understanding",
        assign: "", target: "", glows: "", grows: "", notes: "<b>not markup</b>",
      },
    ],
    walkOffline: [{ campus: "Usa River", term: "Term 1A", count: 35 }],
    observations: [
      {
        campus: "Usa River", date: "2026-02-04", teacher: "Irene Didass Machange", grade: "Grade 2",
        observer: "Grace Kambona", type: "Formal", subject: "Math", track: "Learning/Rigor",
        step: "Checking for understanding",
      },
    ],
    obsRules: {
      range: { start: "2026-01-12", end: "2026-12-04" },
      allowancePerTeacher: 6,
      teachers: { "Usa River": 12, Kijenge: 9 },
      roster: { "Usa River": ["Irene Didass Machange"], Kijenge: [] },
    },
    generatedAt: "2026-10-29T06:00:00.000Z",
    sources: [
      {
        key: "walk", name: "[MASTER] Walkthroughs Tracker",
        url: "https://docs.google.com/spreadsheets/d/abc/edit", updated: "2026-10-28T10:00:00.000Z",
      },
    ],
    ...overrides,
  };
}
