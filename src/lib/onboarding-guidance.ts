import type { Locale } from "@/i18n/routing";

export interface SectionGuidance {
  purpose: string;
  outcome: string;
  howToUse: string[];
  reflection: string;
  mediaNote?: string;
}

const EN_GUIDANCE: Record<string, SectionGuidance> = {
  welcome: {
    purpose:
      "Start here to understand the story, people, and operating rhythm behind Silverleaf before you move into policies and tools.",
    outcome:
      "By the end of this section, you should be able to describe who Silverleaf serves, what we value, and who to contact when you need support.",
    howToUse: [
      "Watch the welcome message first, then use the team and structure documents as a map of the organisation.",
      "Keep the leadership contacts open as a reference for your first few weeks.",
    ],
    reflection:
      "Which part of Silverleaf's mission feels most connected to the role you are joining?",
    mediaNote:
      "Leadership introduction clips belong here. Shorter role-specific videos will make this section warmer and easier to digest.",
  },
  policies: {
    purpose:
      "This section turns expectations into shared practice: how we keep staff, students, families, data, and school operations safe.",
    outcome:
      "You should know the policies that govern your work and the behaviours Silverleaf expects from every staff member.",
    howToUse: [
      "For each policy: watch the briefing video, open the full document, then digitally sign with your full name.",
      "Read for decisions you will make in real situations, not just for the declaration.",
      "Pause on anything that affects children, money, data, confidentiality, or conduct.",
      "When every policy is signed, complete the final bilingual declaration at the end.",
    ],
    reflection:
      "Which policy is most likely to affect your day-to-day work, and what would you do if you were unsure how to apply it?",
    mediaNote:
      "Each policy opens with a short briefing video and ends with a digital signature. The full PDF/DOCX remains the official policy.",
  },
  "digital-tools": {
    purpose:
      "Digital tools are how work gets coordinated across campuses, classrooms, and central teams.",
    outcome:
      "You should be ready to access your accounts, communicate professionally, and use core tools without waiting for urgent help.",
    howToUse: [
      "Treat each guide as a setup task and complete the setup as you go.",
      "If a tool is not relevant to your role, still skim it so you know where colleagues work.",
    ],
    reflection:
      "Which account or tool do you need to set up before your first working day?",
    mediaNote:
      "Short screen-recording walkthroughs would be useful here, especially for email, Classroom, Drive, and AI tools.",
  },
  branding: {
    purpose:
      "Our brand standards help every staff member represent Silverleaf consistently to families, partners, and the public.",
    outcome:
      "You should know which templates, logos, colours, and communication standards to use before creating public-facing materials.",
    howToUse: [
      "Use the assets as working references rather than one-time reading.",
      "Before sending or publishing anything, compare it against the brand guidance.",
    ],
    reflection:
      "What is one communication habit you can adopt to make Silverleaf feel consistent and professional?",
  },
  support: {
    purpose:
      "This section helps you find the right person quickly, so questions and issues do not get stuck.",
    outcome:
      "You should know where to go for HR, IT, campus, leadership, and operational support.",
    howToUse: [
      "Save the contact lists somewhere easy to reach.",
      "Notice escalation routes: who answers first, and who supports if something is urgent.",
    ],
    reflection:
      "Who are the first three people you would contact for support in your first week?",
    mediaNote:
      "Short introductions from leaders and heads of department would make this section much more personal.",
  },
  marketing: {
    purpose:
      "This section explains how Silverleaf shows up online and how staff can help protect the school's reputation.",
    outcome:
      "You should understand what is appropriate to post, share, photograph, or escalate.",
    howToUse: [
      "Read with real school moments in mind: photos, events, WhatsApp groups, parent communication, and public posts.",
      "When in doubt, ask before posting or sharing.",
    ],
    reflection:
      "What is one situation where you would pause and ask for guidance before posting or sharing?",
  },
  "health-safety": {
    purpose:
      "Safety procedures matter before there is an emergency. This section prepares you for the basics.",
    outcome:
      "You should know the key health, safety, and emergency expectations for your campus or work location.",
    howToUse: [
      "Use this as a checklist for questions to ask your manager or campus lead.",
      "Pay attention to what is missing or campus-specific and follow up early.",
    ],
    reflection:
      "What emergency or safety question do you still need answered before you feel fully prepared?",
  },
  safeguarding: {
    purpose:
      "Safeguarding is central to the trust families place in Silverleaf. Every staff member is responsible for it.",
    outcome:
      "You should understand expected conduct, reporting duties, and how to respond to concerns involving children.",
    howToUse: [
      "Read slowly and imagine practical scenarios, not only policy language.",
      "If any situation feels unclear, ask immediately rather than waiting.",
    ],
    reflection:
      "What would you do if you saw or heard something that made you concerned about a child's safety?",
  },
  payroll: {
    purpose:
      "This section helps you understand employment, payroll, and statutory requirements before questions become urgent.",
    outcome:
      "You should know what information HR needs from you and where to ask employment-related questions.",
    howToUse: [
      "Check whether there are forms, deadlines, or personal documents you still need to submit.",
      "Keep payroll and statutory guidance for future reference.",
    ],
    reflection:
      "What HR or payroll item do you need to confirm before your first payroll cycle?",
  },
  templates: {
    purpose:
      "Templates save time and help teams work from a shared standard instead of reinventing documents.",
    outcome:
      "You should know where to find common templates and when to use them.",
    howToUse: [
      "Bookmark the resources that match your role.",
      "Use templates as starting points, then adapt them thoughtfully.",
    ],
    reflection:
      "Which template or resource is most likely to help you in your first month?",
  },
  teaching: {
    purpose:
      "This section orients academic staff to teaching expectations, curriculum, and classroom standards.",
    outcome:
      "You should understand the academic practices and professional expectations that shape learning at Silverleaf.",
    howToUse: [
      "Connect each document to a classroom or coaching situation.",
      "Bring questions to your academic lead rather than guessing.",
    ],
    reflection:
      "What teaching expectation do you want to discuss further with your academic lead?",
    mediaNote:
      "Teacher, head of school, and academic leadership videos would be especially valuable here.",
  },
  training: {
    purpose:
      "Training and professional development should feel like an ongoing pathway, not a one-time onboarding task.",
    outcome:
      "You should know which learning opportunities are available and how to continue growing in role.",
    howToUse: [
      "Use this section to identify your next learning step after core onboarding.",
      "Discuss development priorities with your manager.",
    ],
    reflection:
      "What is one capability you want to strengthen during your first term at Silverleaf?",
  },
};

export function getSectionGuidance(
  sectionId: string,
  locale: Locale,
): SectionGuidance | null {
  void locale;
  return EN_GUIDANCE[sectionId] ?? null;
}
