export type ParentChild = {
  id: string;
  label: string;
  grade: string;
  campus: string;
};

/** Shape of a household. Not a live family. */
export const previewChildren: ParentChild[] = [
  { id: "older", label: "Older child", grade: "Grade 4", campus: "Usa River" },
  { id: "younger", label: "Younger child", grade: "KG", campus: "Usa River" },
];

export type FeedState = "collects-here" | "other-login" | "not-connected";

export type ParentNeed = {
  id: string;
  name: string;
  question: string;
  desk: string;
  state: FeedState;
  stateLabel: string;
  summary: string;
  parentSees: string[];
  deskKeeps: string[];
  today: Record<string, string>;
};

export const parentNeeds: ParentNeed[] = [
  {
    id: "school",
    name: "School life",
    question: "What is happening at school?",
    desk: "Marketing",
    state: "other-login",
    stateLabel: "Sent as messages",
    summary:
      "Term dates already have a public calendar. Admissions updates — tour, interview, the Ed Admin form, enrolment, admission paid — go out by SMS or email. They never collect in one place the parent can reopen.",
    parentSees: [
      "This term’s dates",
      "Where an application stands",
      "The last message the school sent this family",
    ],
    deskKeeps: ["Lead lists", "campaigns", "staff notes on a family"],
    today: {
      older: "Term dates are on the marketing calendar. No new school message is waiting in this app.",
      younger: "Tour, interview, and form reminders go out by SMS. This app has nowhere to reread them.",
    },
  },
  {
    id: "transport",
    name: "Transport",
    question: "Did my child get on the bus?",
    desk: "Ops",
    state: "other-login",
    stateLabel: "Text only",
    summary:
      "Ops records boarding, checks the fee flag, and can notify the parent. The parent receives a message. They cannot open one app and see the bus, the time, or a missed boarding.",
    parentSees: ["Boarded or not", "Time", "Which bus", "Who to call if the bus is late"],
    deskKeeps: ["Routes", "matron tools", "fleet", "the full student register"],
    today: {
      older: "Ops can text when this child boards. The bus itself is not on this screen.",
      younger: "Daycare pickup is not a boarding event. Ops has no parent view for it.",
    },
  },
  {
    id: "uniforms",
    name: "Uniforms",
    question: "What did I order, and when can I collect it?",
    desk: "Uniforms",
    state: "other-login",
    stateLabel: "Separate login",
    summary:
      "Parents can already place an order in the uniforms system. That order, the size, and campus collection stay behind the uniforms login. A parent with two children repeats the sign-in.",
    parentSees: ["Order status", "Size on file", "Which campus to collect from", "What is still to pay for the uniform"],
    deskKeeps: ["Stock", "sewing jobs", "purchase orders", "store reports"],
    today: {
      older: "An order can be placed in Uniforms. It does not show up here.",
      younger: "Same uniforms desk. Size and collection still sit on that other login.",
    },
  },
  {
    id: "fees",
    name: "Fees",
    question: "What do we owe, and what is already paid?",
    desk: "Finance",
    state: "not-connected",
    stateLabel: "No fee feed",
    summary:
      "Admission payment can be marked in Ed Admin and then show as paid on the marketing admissions path. Term fees have no connected finance system. Uniform money is a third ledger. A parent cannot see one balance.",
    parentSees: ["Amount due this term", "What is paid", "How to send a receipt", "A clear split between school fees and uniform money"],
    deskKeeps: ["The ledger", "discounts", "staff finance screens"],
    today: {
      older: "Admission can be marked paid. The term balance has nowhere to come from.",
      younger: "Same gap. This app cannot say what the family owes this term.",
    },
  },
  {
    id: "experience",
    name: "Student experience",
    question: "Is my child all right, and what did the school do?",
    desk: "Student experience",
    state: "other-login",
    stateLabel: "SMS if serious",
    summary:
      "Student experience lives with marketing. A high or critical incident can SMS the parent. The parent never gets a page that says what happened, what the school did, and who to speak to. Routine classroom news has no feed at all.",
    parentSees: ["What happened, in plain language", "What the school did", "Who to call", "Only this child"],
    deskKeeps: ["The incident log", "other children", "staff follow-up"],
    today: {
      older: "A serious incident can arrive as a text. The follow-up stays on the staff desk.",
      younger: "Same rule. Ordinary classroom news is not sent anywhere a parent can open.",
    },
  },
];
