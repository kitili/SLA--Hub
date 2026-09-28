import type { Locale } from "@/i18n/routing";

export interface TeamIntro {
  name: string;
  role: string;
  helpsWith: string;
  firstMonthPrompt: string;
  videoStatus: "ready" | "needed";
  videoHref?: string;
}

export interface SectionTeamIntros {
  kicker: string;
  title: string;
  intro: string;
  people: TeamIntro[];
}

const EN_TEAM_INTROS: Record<string, SectionTeamIntros> = {
  welcome: {
    kicker: "Meet the people",
    title: "The faces behind your first month",
    intro:
      "Onboarding should feel like being welcomed by people, not sent into folders. These are the voices and introductions this section should carry as videos become available.",
    people: [
      {
        name: "CEO / Founder",
        role: "Silverleaf story and standards",
        helpsWith:
          "Why Silverleaf exists, what excellence looks like, and the culture new staff are joining.",
        firstMonthPrompt:
          "Listen for the one standard you want to practise immediately.",
        videoStatus: "needed",
      },
      {
        name: "Head of School",
        role: "School rhythm and student experience",
        helpsWith:
          "How the school day works, what learners and families experience, and how staff contribute to consistency.",
        firstMonthPrompt:
          "Ask: what should a new staff member notice during their first campus walk?",
        videoStatus: "needed",
      },
      {
        name: "People / HR",
        role: "Employment, support, and onboarding",
        helpsWith:
          "Contracts, bio data, statutory details, policies, first-week support, and where to ask for help.",
        firstMonthPrompt:
          "Keep HR close for anything unclear about documents, payroll, or expectations.",
        videoStatus: "needed",
      },
      {
        name: "Department Leads",
        role: "Role-specific expectations",
        helpsWith:
          "What success looks like for teachers, central team, operations, finance, IT, and campus teams.",
        firstMonthPrompt:
          "Find the lead closest to your role and note what they expect in week one.",
        videoStatus: "needed",
      },
    ],
  },
};

export function getSectionTeamIntros(
  sectionId: string,
  locale: Locale,
): SectionTeamIntros | null {
  void locale;
  return EN_TEAM_INTROS[sectionId] ?? null;
}
