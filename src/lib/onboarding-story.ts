import type { Locale } from "@/i18n/routing";

export interface StoryChapter {
  eyebrow: string;
  title: string;
  summary: string;
  prompt: string;
  startSeconds: number;
}

export interface SectionStory {
  kicker: string;
  title: string;
  intro: string;
  videoKey: string;
  chapters: StoryChapter[];
}

const WELCOME_VIDEO_KEY = "00 — Start Here/WELCOME VIDEO.mp4";

const EN_STORIES: Record<string, SectionStory> = {
  welcome: {
    kicker: "Welcome story",
    title: "Begin with the human story, not the files",
    intro:
      "Use the welcome video as a guided orientation. Each chapter gives the learner a lens for what to listen for before they move into the documents.",
    videoKey: WELCOME_VIDEO_KEY,
    chapters: [
      {
        eyebrow: "Chapter 1",
        title: "Why Silverleaf exists",
        summary:
          "Start with the mission, the learners we serve, and the reason this work matters.",
        prompt: "What part of the mission feels closest to your role?",
        startSeconds: 0,
      },
      {
        eyebrow: "Chapter 2",
        title: "How we work together",
        summary:
          "Listen for the expectations, habits, and culture that make teams effective here.",
        prompt: "What working habit do you want to practise in your first month?",
        startSeconds: 180,
      },
      {
        eyebrow: "Chapter 3",
        title: "What excellence looks like",
        summary:
          "Connect the message to daily choices: communication, ownership, care, and follow-through.",
        prompt: "What does excellence look like in your day-to-day work?",
        startSeconds: 360,
      },
      {
        eyebrow: "Chapter 4",
        title: "Your first weeks",
        summary:
          "Close with practical advice for settling in, asking questions, and finding support.",
        prompt: "Who will you ask for help first if something is unclear?",
        startSeconds: 540,
      },
    ],
  },
};

export function getSectionStory(
  sectionId: string,
  locale: Locale,
): SectionStory | null {
  void locale;
  return EN_STORIES[sectionId] ?? null;
}
