/**
 * sampleLessonPlans.ts — the seeded example lesson plans.
 *
 * Six plans, hand-authored from the two real Grade 2 Term-1A schemes of work in
 * `SOW-examples/`, in the SAME shape AI Studio generation produces: a
 * {@link StructuredLessonPlan} satisfying `structuredLessonPlanSchema` and the
 * `validate.ts` semantic guards. `seed.ts` derives every other column from it
 * exactly as `savePlanStructured` does, so a seeded plan and a generated one are
 * indistinguishable — and the plan page renders the branded document rather than
 * the plain-markdown fallback.
 *
 *   G2_Arithmetic_T1a_W2_L1..L3           — grade2-arithmetic-sow.docx, revised
 *                                           Week 2 (its lessons 9, 10, 11)
 *   G2_HealthAndEnvironment_T1a_W2_L1..L2 — grade2-health-environment-sow.docx,
 *   G2_HealthAndEnvironment_T1a_W3_L1       its Week 2 P1/P2 and Week 3 P1
 *
 * Both subjects get a CONSECUTIVE run so "your next lessons"
 * (`@/lib/search/upcoming`) has a successor to offer from either — it looks for
 * a strictly-after (term, week, lesson) within the same grade and subject.
 *
 * Only the Health & Environment scheme is seeded (see `seedSchemes.ts`), so only
 * those three plans carry a {@link SchemeRef} and get a `scheme_lesson_id`. The
 * Arithmetic plans stand alone, which is a legitimate state too: an imported
 * plan need not belong to a scheme.
 *
 * Two lesson-numbering conventions meet here. The schemes number lessons
 * continuously across the term (Arithmetic 9, 10, 11; Health "L3 Wk3 · P1"),
 * while the app restarts them each week (W2_L1, W2_L2, W3_L1).
 *
 * Pure data module (no `server-only`, no I/O) so the seed CLI can import it
 * under plain Node.
 *
 * @see @/lib/ai/lessonPlan/structuredSchema — the contract.
 * @see @/lib/ai/lessonPlan/promptDefaults — BLUEPRINT, the worked exemplar.
 */
import type { StructuredLessonPlan } from "@/lib/ai/lessonPlan/structuredSchema";
import type { Term } from "@/lib/naming/constants";

/** Points a sample at the seeded scheme row it was written from. */
export interface SchemeRef {
  /** Scheme subject, exactly as printed in the docx metadata grid. */
  subject: string;
  /** Week number within the term. */
  week: number;
  /** 0-based position of the lesson among that week's rows. */
  indexInWeek: number;
}

/** One authored example plan: naming coordinates + the generated-shape body. */
export interface SamplePlan {
  /** Grade token, e.g. "G2". */
  grade: string;
  /** Single TitleCase token — see `@/lib/naming/constants`. */
  subject: string;
  term: Term;
  week: number;
  lesson: number;
  /** Period length from the scheme header: Arithmetic 40, Health 30. */
  durationMinutes: number;
  /** Present only when the source scheme is itself seeded. */
  schemeRef?: SchemeRef;
  structured: StructuredLessonPlan;
}

/* ── Grade 2 · Arithmetic · Term 1A · Week 2 ────────────────────────────────
   Source: SOW-examples/grade2-arithmetic-sow.docx, the revised Week 2 table
   "Identifying Numbers in Hundreds (100–200)", its lessons 9, 10 and 11. */

const ARITHMETIC_W2_L1: StructuredLessonPlan = {
  identifier: {
    title: "Counting 100 to 120 by grouping into hundreds, tens and ones",
    grade: "G2",
    subject: "Arithmetic",
    term: "1A",
    week: "2",
    lesson_number: "1",
    main_competence: "4.0 Arithmetic",
    specific_competence: "4.1 Recognise the concept of numbers",
  },
  success_criteria: [
    "Students can count a pile from 100 to 120 by grouping it into a hundred, some tens and some ones.",
    "Students can say which number comes next once the count has passed 100.",
    "Students can explain why grouping into tens keeps a big count safe.",
  ],
  knows: [
    "Numbers carry on in the same sequence past 100 — each one is simply one more than the last.",
    "Ten tens bundle together to make one hundred.",
    "A three-digit number is built from a hundred, some tens and some ones.",
    "A zero in the tens place holds the place open, so one hundred and six is written 106, not 16.",
  ],
  shows: [
    "Group a loose pile into tens and a hundred, then state the total.",
    "Name the number that comes next in the sequence past 100.",
    "Point to the hundreds, the tens and the ones in a three-digit number.",
    "Justify a count by naming that grouping protects it from slipping.",
  ],
  misconceptions: [
    {
      misconception: "Counting straight past 100 in ones.",
      description:
        "Carrying on one by one instead of making a hundred and counting on from it — the very habit this lesson replaces. One slip and the whole count starts again.",
    },
    {
      misconception: "Treating the hundred as a separate thing.",
      description:
        "Counting the hundred on its own, as though it were one more object, rather than seeing it as ten tens gathered inside the count.",
    },
    {
      misconception: "Dropping the zero in 106.",
      description:
        "Writing 16 for one hundred and six, because an empty tens place is heard as nothing rather than as a place that still has to be held.",
    },
  ],
  materials_and_prep: [
    "Bundling sticks or bottle tops, enough for each group to build past 120.",
    "At least one ready-made hundred, visibly built from ten tens, so the class can see what a hundred is made of.",
    "A place frame labelled hundreds, tens and ones to lay the bundles into.",
    "Number cards, exercise books and pencils.",
    "The oral questioning tracking sheet.",
  ],
  teaching_sequence: {
    introduction_hook: {
      depth: "Surface",
      text: "Teacher tips out a loose pile and begins counting it one by one, aloud and deliberately slowly. Somewhere past thirty the teacher loses the place and stops: 'I have lost my count. Now I must start again.' Ask the class whether there is a safer way to count a pile this big, and take two or three ideas without settling it yet.",
      sentence_frame: "Counting one by one is _____ because _____.",
      checkpoint:
        "A pupil counted 100, 101, 103. Is that correct? What number is missing?",
    },
    i_do: {
      depth: "Surface",
      text: "Teacher gathers ten ones into a ten, and ten tens into a single hundred, holding the hundred up so the class sees it is just ten tens bundled — not a new kind of object. From the hundred the teacher counts on, 101, 102, up to about 113, writes 113 and points out the one hundred, the one ten and the three ones sitting in their places. One pile and one running example are kept throughout so bundling and counting stay connected.",
      sentence_frame:
        "I have _____ hundred, _____ tens and _____ ones, so the number is _____.",
      checkpoint: "There are 10 bundles of ten and 6 loose sticks. How many altogether?",
    },
    we_do: {
      depth: "Deep",
      text: "The class counts a shared pile by grouping, naming the hundred, then the tens, then the ones, and reading the number aloud. The teacher deliberately includes 106, so the class meets the zero in the tens, says 'one hundred and six, no tens', and writes 106 with the zero held. Teacher circulates with the oral questioning tracking sheet, noting who reaches for grouping without being told.",
      sentence_frame: "One hundred and _____ has _____ tens, so we write _____.",
      checkpoint: "Write the number that comes after 117.",
    },
    you_do: {
      depth: "Deep",
      text: "Learners group and count two piles in the 100 to 120 range, write each number, and for one of them show the hundred, the tens and the ones in the place frame. They work in pairs first, then alone.",
      sentence_frame: "I grouped _____ into _____ hundred, _____ tens and _____ ones.",
      checkpoint:
        "Two children count the same pile. One counts one by one and gets 118. One groups into tens and also gets 118. Whose way is safer, and why?",
    },
  },
  differentiation: {
    remedial:
      "Work at the bundles with the teacher: build one hundred from ten visible tens, then count on from it to 110 only. The learner says each number while touching the bundle, and answers the reasoning checkpoint aloud rather than in writing.",
    support:
      "Give a ready-made hundred the learner can see is built from ten visible tens, and a place frame labelled hundreds, tens and ones to lay the bundles into, so the structure is in front of them rather than in their head.",
    challenge:
      "Give piles that tip just over 120, quietly previewing the next lesson, and ask the learner to explain to a partner why grouping beats counting in ones — putting the reasoning checkpoint into their own words before writing it.",
    digital_resources: [
      "A short place-value clip from the TIE e-Library showing a hundred being built from ten tens, to re-watch at home (if available).",
    ],
  },
  conclusion_and_exit_ticket: {
    understanding:
      "A hundred is simply ten tens bundled, so counting past 100 is the same counting we already know, with a hundred now in the count. Grouping is what keeps a large count from slipping.",
    exit_ticket:
      "Five questions, marked before the next lesson. 1. Write the number that comes after 117. (DOK 1) 2. There are 10 bundles of ten and 6 loose sticks. How many altogether? (DOK 2) 3. A pupil counted 100, 101, 103. Is that correct? What number is missing? (DOK 1) 4. Show the place of each digit in 113 as ones, tens and hundreds. (DOK 1) 5. Two children count the same pile. One counts one by one and gets 118. One groups into tens and gets 118. Whose way is safer, and why? (DOK 3) Marking guide: 1) 118. 2) 106. 3) 102. 4) 3 ones, 1 ten, 1 hundred. 5) the grouping way — a slip costs only one bundle rather than the whole count. Award the reasoning mark in question 5 only if the answer names that grouping protects the count, not simply that it is faster.",
  },
  assessment_method:
    "Observe the grouping during You Do and use oral questioning throughout We Do. The checkpoints distributed across the four stages are the formative evidence; log oral-only answers on the oral questioning tracking sheet as you go. Mark the exit ticket before the next lesson and sort the class into three response groups: secure (four or five correct, including the reasoning item) move on; developing (three or four, reasoning weak) get a short grouping starter; not yet (two or fewer) are pulled for a small-group reteach making a hundred from ten tens.",
  watch_for_notes: [
    "Note who now reaches for grouping to count, and who still counts in ones and loses track — grouping is the habit the entire hundreds sequence depends on.",
    "Note who held the zero in 106 and who dropped it; that zero is the readiness signal the baseline flagged.",
    "Listen for whether the reasoning names that grouping protects the count, rather than only that it is faster.",
  ],
  teacher_reflection: [
    "Did losing the count on purpose in the hook actually make the case for grouping, or did it just unsettle the class?",
    "When I held up the hundred, did I give the class long enough to see it was ten tens bundled rather than a new object?",
    "Which learners could count correctly but not explain why grouping is safer, and what does that tell me about how I pitched the reasoning?",
  ],
  meta: {
    source_lesson_idx: 9,
    grade: "G2",
    subject: "Arithmetic",
    gaps_flagged: [],
  },
};

const ARITHMETIC_W2_L2: StructuredLessonPlan = {
  identifier: {
    title: "Counting 120 to 200 by grouping, crossing each tens boundary",
    grade: "G2",
    subject: "Arithmetic",
    term: "1A",
    week: "2",
    lesson_number: "2",
    main_competence: "4.0 Arithmetic",
    specific_competence: "4.1 Recognise the concept of numbers",
  },
  success_criteria: [
    "Students can count from 120 to 200 by grouping, carrying the count cleanly across a tens boundary such as 159 to 160.",
    "Students can recognise 200 as two whole hundreds rather than an endpoint.",
    "Students can explain that a count of tens and the number it makes are the same amount.",
  ],
  knows: [
    "The counting sequence continues across a tens boundary — 160 is just one more than 159.",
    "Ten tens make one hundred, so ten more tens after 100 make 200.",
    "Counting in tens changes the tens digit, while counting in ones changes the ones digit.",
    "Thirteen tens and 130 are the same amount: one hundred and three tens.",
  ],
  shows: [
    "Count on across a tens boundary without hesitating or skipping the boundary number.",
    "Count in tens from 160 up to 200 and name each step.",
    "State the place value fact that ten tens make a hundred.",
    "Justify that 13 groups of ten is 130 by linking it to one hundred and three tens.",
  ],
  misconceptions: [
    {
      misconception: "Skipping the boundary ten itself.",
      description:
        "Counting 158, 159, 161 — the new ten was never heard as simply the next number in the sequence, so it gets jumped over.",
    },
    {
      misconception: "Slipping from tens back into ones.",
      description:
        "Counting 160, 170, 180 and then drifting into 181, 182 — changing the ones digit instead of the tens, because the rhythm was copied rather than understood.",
    },
    {
      misconception: "Treating 200 as an ending.",
      description:
        "Seeing 200 as a separate big number where counting stops, rather than as a second whole hundred made from ten more tens.",
    },
    {
      misconception: "Thinking 13 tens and 130 are different amounts.",
      description:
        "Not yet seeing that a count of tens and the number it makes are the same thing, so 13 groups of ten is not recognised as 130.",
    },
  ],
  materials_and_prep: [
    "A number line to 200 with the round tens marked.",
    "Bundling sticks, one made hundred, and ten loose tens so the second hundred can be seen forming.",
    "Number cards, exercise books and pencils.",
    "The oral questioning tracking sheet.",
  ],
  teaching_sequence: {
    introduction_hook: {
      depth: "Surface",
      text: "Teacher writes 159 on the board and asks the class to say the next number. Take answers without judging them — some will say 160, some will hesitate, some will guess 200. Teacher says: 'Some of us stopped at that number. Today we find out whether anything special happens there at all.'",
      sentence_frame: "After 159 comes _____ because _____.",
      checkpoint: "Write the number that comes after 159.",
    },
    i_do: {
      depth: "Surface",
      text: "Teacher counts on aloud from 158, slowing right down at the boundary — 158, 159, 160 — and says plainly that nothing special happened: 160 is just one more than 159. The teacher then counts in tens, 160, 170, 180, 190, and at 190 adds one more ten to make 200, holding up a second hundred made from ten tens and naming 200 as two whole hundreds. One running count is kept throughout so the rhythm stays unbroken.",
      sentence_frame: "Ten tens have just made _____, so the hundreds digit is now _____.",
      checkpoint: "How many tens make one hundred?",
    },
    we_do: {
      depth: "Deep",
      text: "The class counts on together across a boundary, fills a missing number sitting right on one (159, gap, 161), and counts in tens up to 200, saying each time that ten tens have just made another hundred. Teacher moves around with the oral questioning tracking sheet, noting who carries the rhythm across the boundary without hesitating and who stalls or guesses there.",
      sentence_frame: "1 hundred and _____ tens is _____.",
      checkpoint: "1 hundred and 6 tens — what is the number?",
    },
    you_do: {
      depth: "Deep",
      text: "Learners count two ranges by grouping and say the numbers aloud, with at least one count that crosses a tens boundary and one that reaches a round ten. Pairs first, then alone.",
      sentence_frame: "I counted _____ tens, which is the same as _____.",
      checkpoint:
        "A learner counted 130 sticks and made 13 groups of ten. Is that right, and how do you know?",
    },
  },
  differentiation: {
    remedial:
      "Count across one boundary only, aloud with the teacher, pointing to each number on the marked number line. Give the reasoning checkpoint orally at the bundles rather than in writing.",
    support:
      "Give a number line to 200 with the round tens marked, and a hundred bundle alongside ten loose tens, so the second hundred can be seen forming as the count reaches 200.",
    challenge:
      "Ask for counting in tens from an off-ten start such as 134, 144, 154, where the rhythm is the same but the ones digit stays put; then have the learner explain why 13 tens equals 130 in their own words before writing it.",
    digital_resources: [
      "An interactive number line to 200 on a tablet, to step across the tens boundaries and watch the digits change (if available).",
    ],
  },
  conclusion_and_exit_ticket: {
    understanding:
      "The counting never changes its rhythm: each step is one more, a full ten simply becomes the next ten, and ten full tens become the next hundred — which is why 200 is simply two whole hundreds.",
    exit_ticket:
      "Five questions, marked before the next lesson. 1. Write the number that comes after 159. (DOK 1) 2. How many tens make one hundred? (DOK 1) 3. 1 hundred and 6 tens — what is the number? (DOK 1) 4. Show the place value of 167 as ones, tens and hundreds. (DOK 1) 5. A learner counted 130 sticks and made 13 groups of ten. Is that right, and how do you know? (DOK 3) Marking guide: 1) 160. 2) 10. 3) 160. 4) 7 ones, 6 tens, 1 hundred. 5) yes — 13 tens is 130, which is one hundred and three tens. Award the reasoning mark in question 5 only if the answer links 13 tens to 1 hundred and 3 tens.",
  },
  assessment_method:
    "Use oral questioning at the boundary during We Do and observe the counting in You Do; the four stage checkpoints are the formative evidence, recorded on the oral questioning tracking sheet. Mark the exit ticket and sort into three response groups: secure are ready to read these numbers next lesson; developing get a starter crossing 159 to 160 and counting in tens; not yet are pulled for a small-group reteach on the number line to 200.",
  watch_for_notes: [
    "Note who carries the count across a boundary in the same rhythm and who treats 159 to 160 as a special jump — the same boundary the baseline flagged in the range to 100.",
    "Note who sees 200 as a second hundred and who treats it as an endpoint; seeing a hundred as ten tens is what the place-value work later in the term depends on.",
    "A learner who counts in ones reliably but slips when counting in tens needs the marked number line a while longer.",
  ],
  teacher_reflection: [
    "Did slowing right down at 159 to 160 land the point that nothing special happens there, or did the pause itself suggest the opposite?",
    "How many learners did I actually hear cross a boundary aloud, and were they the ones I was least sure about?",
    "Did the class leave seeing 200 as two whole hundreds, and if not, what would I put in front of them next time?",
  ],
  meta: {
    source_lesson_idx: 10,
    grade: "G2",
    subject: "Arithmetic",
    gaps_flagged: [],
  },
};

const ARITHMETIC_W2_L3: StructuredLessonPlan = {
  identifier: {
    title: "Reading numbers 100 to 150 in words, hundreds first, then tens and ones",
    grade: "G2",
    subject: "Arithmetic",
    term: "1A",
    week: "2",
    lesson_number: "3",
    main_competence: "4.0 Arithmetic",
    specific_competence: "4.1 Recognise the concept of numbers",
  },
  success_criteria: [
    "Students can read a number from 100 to 150 aloud in place order: the hundreds, then and, then the tens and ones.",
    "Students can read a number containing a zero, such as 109, without dropping the empty place.",
    "Students can explain why the same digit is read differently in 105 and in 150.",
  ],
  knows: [
    "A three-digit number is read in place order: the hundreds, then and, then the tens and ones.",
    "The same digit is read differently depending on the place it sits in — the 5 in 105 is five, the 5 in 150 is fifty.",
    "A zero in the tens place means there are no tens, and the number is read straight from the hundreds to the ones.",
    "The word and joins the hundreds to the rest of the number.",
  ],
  shows: [
    "Read a three-digit number aloud and write it in words.",
    "Read a number containing a zero, naming that it has no tens.",
    "Say which place a digit sits in before naming what it says.",
    "Explain why a reading is wrong by reasoning about place.",
  ],
  misconceptions: [
    {
      misconception: "Reading the digits one at a time.",
      description:
        "132 becomes 'one, three, two' and 105 becomes 'one oh five', because the number is being read digit by digit instead of by place.",
    },
    {
      misconception: "Reading a digit the same wherever it sits.",
      description:
        "The 5 in 150 is read as five rather than fifty, missing that the place is what changes what the digit says.",
    },
    {
      misconception: "Flattening the tens word.",
      description:
        "130 is read as 'one hundred and three' instead of 'one hundred and thirty', reading the tens digit as a single number rather than as a tens word.",
    },
    {
      misconception: "Reversing the tens and the ones.",
      description:
        "132 is read as 'one hundred and twenty-three', putting the ones before the tens in the words.",
    },
  ],
  materials_and_prep: [
    "A place value chart labelled hundreds, tens and ones.",
    "Number cards 100 to 150 and word cards.",
    "A teen-to-ty strip, so a reader can check whether the tens digit says a teen word or a ty word.",
    "Exercise books, pencils and the oral questioning tracking sheet.",
  ],
  teaching_sequence: {
    introduction_hook: {
      depth: "Surface",
      text: "Teacher writes 105 and 150 side by side and asks two learners to read them aloud. When both come out sounding the same, the teacher says: 'These are not the same number, but they were just read the same way. By the end of this lesson we will know exactly why.'",
      sentence_frame: "105 and 150 are different because the 5 sits in _____.",
      checkpoint:
        "Read 132. Which is correct — one hundred and thirty-two, or one hundred and twenty-three?",
    },
    i_do: {
      depth: "Surface",
      text: "Teacher writes 132 and reads it by sweeping across the places left to right — one hundred, and, thirty-two — pointing to the hundreds, then the tens, then the ones as each part is said. The teacher then returns to 105 and 150, showing that the 5 says five when it sits in the ones but fifty when it sits in the tens: the place, not the digit, decides how it is read. That pair is kept as the running example so the point stays sharp.",
      sentence_frame: "The _____ sits in the _____ place, so it says _____.",
      checkpoint: "Read 145. How many tens does it have?",
    },
    we_do: {
      depth: "Deep",
      text: "The class reads several numbers from 100 to 150 together, always saying the hundreds first, then and, then the rest. Before naming a digit, the teacher asks which place it is sitting in. Teacher moves around with the oral questioning tracking sheet, noting who reads across the places in order and who reaches for the digits out of order or one at a time.",
      sentence_frame: "One hundred, and, _____ — so the number is _____.",
      checkpoint: "Read 109. Does it have any tens?",
    },
    you_do: {
      depth: "Deep",
      text: "Learners write given numbers in words and given names in numerals, in pairs first and then on their own. At least one number in each set contains a zero.",
      sentence_frame: "In _____, the 5 is read as _____ because it sits in the _____ place.",
      checkpoint:
        "105 and 150 were both read aloud as one hundred and five. Which reading is wrong, and how do you know?",
    },
  },
  differentiation: {
    remedial:
      "Read only 100 to 120, with the number sitting in the place chart and the teacher pointing to each place as its part is said. Give the reasoning checkpoint orally.",
    support:
      "Give a place chart labelled hundreds, tens and ones with the number sitting in it, and a teen-to-ty strip so the reader can check whether the tens digit should say a teen word or a ty word. Point to each place and say its part aloud before writing the words.",
    challenge:
      "Give numbers with a zero such as 102 and 120, where a place is empty but still read in order, and ask the learner to explain why 105 and 150 are read differently in their own words before writing it.",
    digital_resources: [
      "A number-reading activity on a tablet that says a number aloud as each place is tapped (if available).",
    ],
  },
  conclusion_and_exit_ticket: {
    understanding:
      "We read a number in place order — the hundreds first, then the tens and ones — and a digit is read by the place it sits in. That is why the same 5 is five in 105 but fifty in 150.",
    exit_ticket:
      "Five questions, marked before the next lesson. 1. Read 132. Which is correct — one hundred and thirty-two, or one hundred and twenty-three? (DOK 1) 2. Read 145. How many tens does it have? (DOK 1) 3. Read 109. Does it have any tens? (DOK 1) 4. In 150, is the 5 read as five or as fifty? (DOK 2) 5. 105 and 150 were both read aloud as one hundred and five. Which reading is wrong, and how do you know? (DOK 3) Marking guide: 1) one hundred and thirty-two — the tens are read before the ones. 2) one hundred and forty-five, four tens. 3) one hundred and nine, no tens; the tens place has a zero. 4) fifty, because the 5 sits in the tens place. 5) 150 is wrong — the 5 there is in the tens place, so it is read as fifty, giving one hundred and fifty. Award the reasoning mark only if the answer names the place.",
  },
  assessment_method:
    "Hear individual readers during We Do and mark the written work in You Do; the four stage checkpoints are the formative evidence, with oral-only answers logged on the oral questioning tracking sheet. Mark the exit ticket and sort into three response groups: secure are ready for the harder zero cases next lesson; developing get a starter contrasting 105 and 150 by the place of the 5; not yet are pulled for a small-group reteach reading hundreds, then and, then tens and ones with a place chart.",
  watch_for_notes: [
    "Note who reads across the places in order and who still reads digit by digit — a child who reads digit by digit now will misread every zero number to come.",
    "Note who reads the tens digit as a tens word and who flattens it to a single number; that is the same place reasoning the value work later in the term depends on.",
    "A learner who reads a number aloud correctly but cannot yet write the words needs the place chart and the teen-to-ty strip a while longer.",
  ],
  teacher_reflection: [
    "Did opening with two learners reading 105 and 150 the same way create the puzzle I wanted, or did it simply expose those two learners?",
    "How consistently did I ask which place a digit sits in before letting the class name it?",
    "Which learners need reteaching before the zero numbers next lesson, and would pointing to each place as I say its part help more than the chart alone?",
  ],
  meta: {
    source_lesson_idx: 11,
    grade: "G2",
    subject: "Arithmetic",
    gaps_flagged: [],
  },
};

/* ── Grade 2 · Health and Environment · Term 1A ─────────────────────────────
   Source: SOW-examples/grade2-health-environment-sow.docx, Week 2 P1/P2 and
   Week 3 P1. Periods are 30 minutes. */

const HEALTH_W2_L1: StructuredLessonPlan = {
  identifier: {
    title: "Simple investigations: observing the environment around us",
    grade: "G2",
    subject: "HealthAndEnvironment",
    term: "1A",
    week: "2",
    lesson_number: "1",
    main_competence: "7.0 Care for health and the environment",
    specific_competence: "7.1 Observe objects found in the environment",
  },
  success_criteria: [
    "Students can observe their surroundings carefully and name the things they see.",
    "Students can explain that the environment is everything around us — things, plants, animals, people and even the air.",
    "Students can decide whether something hard to see, such as the air, belongs to the environment, and give a reason.",
  ],
  knows: [
    "The environment is everything that surrounds us: things, plants, animals and people.",
    "The air is part of the environment too, even though it is hard to see.",
    "To observe is to look carefully, not to glance.",
    "The test for the environment is simple: does it surround us?",
  ],
  shows: [
    "Name the things observed in a picture or in the classroom.",
    "Classify a borderline case such as the air or the people as part of the environment.",
    "Explain why saying the environment is only the animals is too narrow.",
  ],
  misconceptions: [
    {
      misconception: "The environment means only the animals.",
      description:
        "Or only the outdoors and nature — forgetting the things, the plants, the people and the air that surround us just as much.",
    },
    {
      misconception: "The air and the people do not count.",
      description:
        "Because we do not see them the way we see an object, they get left out, even though both surround us.",
    },
    {
      misconception: "Observing is the same as a quick glance.",
      description:
        "Looking up briefly and reporting a colour, rather than looking carefully and naming what is actually there.",
    },
    {
      misconception: "Naming an action or a colour instead of the thing.",
      description:
        "Answering 'running' or 'green' when asked what was observed, rather than naming the thing itself.",
    },
  ],
  materials_and_prep: [
    "TIE Health and Environment Pupil's Book Standard Two, pages 1 and 2 — the village picture and 'I know the environment around me'.",
    "A real stone and a real leaf, to pre-teach the words environment and observe.",
    "Picture and word cards made by the teacher, with the word printed underneath for learners not yet reading.",
    "The oral questioning tracking sheet.",
  ],
  teaching_sequence: {
    introduction_hook: {
      depth: "Surface",
      text: "Teacher asks the class to look around for a moment and say what they see. Take the first few answers exactly as they come — a colour, an action, one animal. The teacher does not correct them yet, but says: 'We have just glanced. Today we learn to observe, and we will find the environment is much bigger than what we noticed first.'",
      sentence_frame: "When I glanced I saw _____, but when I looked carefully I saw _____.",
      checkpoint:
        "What does environment mean? (A) only animals (B) everything around us (C) only plants",
    },
    i_do: {
      depth: "Surface",
      text: "Using the village picture on page 2 and a fixed example set — a cow, a maize plant, a stone, a bicycle, a tree and a chicken — the teacher thinks aloud: 'To observe is to look carefully. I see a tree, and I name it: tree. I see a stone, and I name it: stone.' Then the teacher lifts the idea: 'Is the air part of the environment? I cannot see it well, but it surrounds me, so yes. Are the people part of it? Yes, they surround me too.' The teacher models the misconception aloud: 'Some people say the environment means only the animals. That is too small — they forgot the plants, the things, the people and the air.'",
      sentence_frame: "I can see a _____.",
      checkpoint: "Write the names of two things you can see in your classroom.",
    },
    we_do: {
      depth: "Deep",
      text: "The class names things in the picture together using the frame. Then the teacher poses boundary checks: 'Is the sky part of the environment? The soil? The people walking?' Thumbs up for yes, and tell me why. The checking question is: 'What is our test for whether something belongs to the environment?', leading the class to 'does it surround us?'. The teacher re-models if learners restrict the environment to animals, or name an action or a colour instead of a thing.",
      sentence_frame: "The _____ is part of the environment because it _____ us.",
      checkpoint:
        "Is the air around us part of the environment? Tick YES or NO and give one reason.",
    },
    you_do: {
      depth: "Deep",
      text: "Learners observe the classroom, or the view from the window, and list or draw at least four things, naming each. Then they circle one thing people often forget belongs to the environment — such as the air, the floor, or themselves.",
      sentence_frame:
        "People often forget that _____ is part of the environment, but it is because _____.",
      checkpoint:
        "Salma says the environment is only the animals. Is she correct? Explain how you know.",
    },
  },
  differentiation: {
    remedial:
      "Pre-teach the words environment and observe with a real stone and a real leaf in the hand. Name just two things in the picture with the teacher, using picture cards with the word printed underneath.",
    support:
      "Picture cards with the word printed underneath for learners who are not yet reading, and the 'I can see a _____' frame said aloud to a partner before anything is written.",
    challenge:
      "Name something present but easy to miss — the air, a sound, the soil — and say why it still belongs. Then name each thing and also where it is, such as 'a bird, in the tree', which seeds the habitat idea needed in Week 5.",
    digital_resources: [
      "Tablet or ICT pictures of the environment from the TIE e-Library, to compare a village scene with our own compound (if available).",
    ],
  },
  conclusion_and_exit_ticket: {
    understanding:
      "The environment is everything around us: things, plants, animals, people and even the air. We test it by asking, does it surround us? And we make sense of it by observing carefully and naming what we see.",
    exit_ticket:
      "Five questions. 1. What does environment mean? (A) only animals (B) everything around us (C) only plants (DOK 1) 2. Write the names of two things you can see in your classroom. (DOK 1) 3. A friend looked quickly and said only, 'I saw green.' What should the friend do to observe well? (DOK 2) 4. Is the air around us part of the environment? Tick YES or NO and give one reason. (DOK 2) 5. Salma says the environment is only the animals. Is she correct? Explain how you know. (DOK 3) Marking guide: 1) B. 2) any two real classroom things. 3) look carefully and name the things, not just a colour. 4) YES, because it surrounds us, even though it is hard to see. 5) No — the environment is everything that surrounds us: things, plants, people and air, not only animals. The hardest item may be taken orally when 30 minutes is tight.",
  },
  assessment_method:
    "Cold call on the boundary checks during We Do, and circulate during You Do scanning each list and what was circled. The four stage checkpoints are the formative evidence; log oral-only answers on the oral questioning tracking sheet so they are captured. Mark the ticket and sort into three groups: secure take an extension card next lesson; developing get a quick 'does it surround us?' recap; not yet join the modelling for guided observing before new content.",
  watch_for_notes: [
    "Note who named actions or colours instead of things, and who narrowed the environment to animals.",
    "Note who could not read the written ticket, and mark them for oral assessment from now on.",
    "If a learner keeps the environment to animals only, prompt 'what else surrounds you right now?'; if several do, re-model the test before the ticket.",
  ],
  teacher_reflection: [
    "Did letting the first glance answers stand uncorrected set up the lesson, or did it leave the class thinking they were already right?",
    "When I modelled the misconception aloud, did the class hear it as a mistake to avoid, or as another fact to learn?",
    "Which learners named the air or themselves without prompting, and what does that tell me about who is ready to be stretched next lesson?",
  ],
  meta: {
    source_lesson_idx: 2,
    grade: "G2",
    subject: "HealthAndEnvironment",
    gaps_flagged: [],
  },
};

const HEALTH_W2_L2: StructuredLessonPlan = {
  identifier: {
    title: "Living things and non-living things in the environment",
    grade: "G2",
    subject: "HealthAndEnvironment",
    term: "1A",
    week: "2",
    lesson_number: "2",
    main_competence: "7.0 Care for health and the environment",
    specific_competence: "7.1 Observe objects found in the environment",
  },
  success_criteria: [
    "Students can sort clear everyday things into living and non-living, naming the group each belongs to.",
    "Students can name that living things are either animals or plants.",
    "Students can begin to give a reason for placing a thing in its group.",
  ],
  knows: [
    "Living things have life; non-living things do not.",
    "Living things are grouped into animals and plants.",
    "A plant is living even though it does not move about.",
    "Grouping helps us make sense of a crowded place.",
  ],
  shows: [
    "Name a living thing and a non-living thing.",
    "Sort clear everyday cases into a LIVING and NON-LIVING chart.",
    "Give a reason for one placement.",
  ],
  misconceptions: [
    {
      misconception: "Plants are non-living because they do not move.",
      description:
        "Movement is being used as the test for life, so a maize plant or a tree gets placed with the stones.",
    },
    {
      misconception: "Anything that moves is living.",
      description:
        "A bicycle or a car is called living because it moves, even though nothing about it feeds or grows.",
    },
    {
      misconception: "Only animals are living.",
      description:
        "Plants are treated as scenery that is 'just there', rather than as one of the two groups of living things.",
    },
  ],
  materials_and_prep: [
    "TIE Health and Environment Pupil's Book Standard Two, pages 3 to 6 — living things and the picture grid.",
    "A two-column organiser headed LIVING and NON-LIVING, pre-drawn for those who need it.",
    "Picture and word cards, and real classroom objects to sort.",
    "The same six items used last lesson: a cow, a maize plant, a stone, a bicycle, a tree and a chicken.",
  ],
  teaching_sequence: {
    introduction_hook: {
      depth: "Surface",
      text: "Teacher holds up the stone and the leaf from last lesson and asks: 'Both of these are in our environment. But are they the same kind of thing?' Take answers. Teacher: 'You already feel there is a difference. Today we give that difference its name.'",
      sentence_frame: "The _____ and the _____ are different because one _____.",
      checkpoint:
        "Living things are divided into two groups, which are: (A) animals and birds (B) animals and plants (C) snakes and fish",
    },
    i_do: {
      depth: "Surface",
      text: "Using the same six items as last lesson, the teacher thinks aloud while placing each in a two-column chart: 'The cow feeds and grows, so it is living. The stone does nothing of the kind, so it is non-living. The maize plant grows, so it is living — even though it is not an animal.' The teacher stresses the key idea: living things are animals or plants. Key words revisited: living, non-living, sort, group.",
      sentence_frame: "The _____ is living because it _____.",
      checkpoint: "Write one living thing and one non-living thing.",
    },
    we_do: {
      depth: "Deep",
      text: "The class sorts new everyday items together — a chair, a dog, a bean plant, a bottle — into the LIVING and NON-LIVING organiser. The checking question after each is: 'Why did you put it there?' The teacher re-models if a plant is called non-living, or a moving object is called living.",
      sentence_frame: "I put the _____ under _____ because it _____.",
      checkpoint:
        "From the list, write the living things only: stone, goat, chair, maize plant, bicycle.",
    },
    you_do: {
      depth: "Deep",
      text: "Learners sort a set of picture cards or a written list into the two columns and add one reason for any one item. They peer-check with a partner against the agreed test before the ticket.",
      sentence_frame: "The _____ belongs under _____ because _____.",
      checkpoint:
        "A pupil put a bicycle with the living things. Is the pupil correct? Write the correct group and one reason.",
    },
  },
  differentiation: {
    remedial:
      "Sort only four very clear items — a stone, a dog, a chair, a tree — physically with the teacher, using picture cards rather than words.",
    support:
      "Picture cards instead of words, a pre-drawn two-column organiser, and the partner sorting aloud first so the reason is spoken before it is written.",
    challenge:
      "Add a tricky item such as a seed and ask which column it belongs in, previewing next lesson's boundary cases; then use a blank organiser and write a reason for two items.",
    digital_resources: [
      "A sorting game on a tablet where pictures are dragged into living and non-living columns (if available).",
    ],
  },
  conclusion_and_exit_ticket: {
    understanding:
      "We sort by asking, does it have life? Living things — which are animals and plants — feed and grow; non-living things do not. Grouping helps us make sense of a crowded place.",
    exit_ticket:
      "Five questions. 1. Living things are divided into two groups, which are: (A) animals and birds (B) animals and plants (C) snakes and fish (DOK 1) 2. Write one living thing and one non-living thing. (DOK 1) 3. From the list, write the living things only: stone, goat, chair, maize plant, bicycle. (DOK 2) 4. Tick the non-living thing: dog, tree, table. (DOK 2) 5. A pupil put a bicycle with the living things. Is the pupil correct? Write the correct group and one reason. (DOK 2 to 3) Marking guide: 1) B. 2) any correct pair. 3) goat and maize plant. 4) table. 5) No — a bicycle does not feed, grow or breathe, so it is non-living.",
  },
  assessment_method:
    "Circulate during the sort and at peer-checking, listening for the reason rather than only the label; the four stage checkpoints are the formative evidence. Peer checking against the agreed test comes before the teacher marks. Mark the ticket and sort into three groups: secure peer-check a partner's sort and take an extension card; developing revisit the sort of the six items at the start of next lesson; not yet join the modelling to re-sort with the teacher.",
  watch_for_notes: [
    "Record who confuses movement with life and who excludes plants — these are next lesson's targets.",
    "If plants land in the non-living column, pause and re-teach 'plants grow, so they are living' before the ticket.",
    "Keep the same items as last lesson so the next lesson can deepen the same sort into reasoning.",
  ],
  teacher_reflection: [
    "Did reusing the same six items from last lesson help the class see a new idea, or did the familiarity let them answer from memory?",
    "How often did I ask 'why did you put it there?' before accepting a placement?",
    "Did I catch the plants-are-not-living idea early enough, or did it survive as far as the ticket?",
  ],
  meta: {
    source_lesson_idx: 3,
    grade: "G2",
    subject: "HealthAndEnvironment",
    gaps_flagged: [],
  },
};

const HEALTH_W3_L1: StructuredLessonPlan = {
  identifier: {
    title: "How do we know a thing is living? Life features",
    grade: "G2",
    subject: "HealthAndEnvironment",
    term: "1A",
    week: "3",
    lesson_number: "1",
    main_competence: "7.0 Care for health and the environment",
    specific_competence: "7.1 Observe objects found in the environment",
  },
  success_criteria: [
    "Students can state the life features that show a thing is alive.",
    "Students can apply the life features as a test to decide a tricky case such as a seed or a parked car.",
    "Students can justify a decision and settle a disagreement about whether something is living.",
  ],
  knows: [
    "The life features are feeding, growing, breathing, moving on its own, and reproducing.",
    "Movement alone is not life — a car moves but has no life features.",
    "A seed and an egg are living, because they grow and develop.",
    "A dead leaf is no longer living.",
  ],
  shows: [
    "Name two features that show a thing has life.",
    "Run the life-feature test on a boundary case and name the feature used.",
    "Explain why a moving object such as a car is still not living.",
    "Decide who is right in a disagreement and say how you know.",
  ],
  misconceptions: [
    {
      misconception: "It moves, so it is alive.",
      description:
        "Said of a car or a river. Movement is mistaken for the test, so anything in motion is counted as living.",
    },
    {
      misconception: "It does not move, so it is not alive.",
      description:
        "Said of a tree or a seed. The same wrong test, run the other way — stillness is read as lifelessness.",
    },
    {
      misconception: "A dead leaf is still living.",
      description:
        "Because it once was alive, or because it came from a plant, it is still placed with the living things.",
    },
    {
      misconception: "A seed or an egg is non-living because it looks still.",
      description:
        "Nothing appears to be happening, so the growing and developing going on inside is missed entirely.",
    },
  ],
  materials_and_prep: [
    "TIE Health and Environment Pupil's Book Standard Two, pages 2 to 4.",
    "An 'is it living?' checklist chart, with picture icons for those who need them.",
    "Boundary-case picture cards: a seed, an egg, a dead leaf, a parked car, a sleeping cat.",
    "The oral questioning tracking sheet.",
  ],
  teaching_sequence: {
    introduction_hook: {
      depth: "Surface",
      text: "Teacher holds up a picture of a car and a picture of a tree. 'Last week we sorted things into living and non-living. The car moves down the road. The tree never moves at all. So — is the car living, and the tree not?' Let the class feel the pull of the wrong answer before the test is built.",
      sentence_frame: "I think the _____ is living because _____.",
      checkpoint: "Name two features that show a thing has life.",
    },
    i_do: {
      depth: "Surface",
      text: "The teacher builds the 'is it living?' test on the board as a checklist: does it feed? grow? breathe? move on its own? reproduce? The teacher thinks aloud with the cow, which ticks the features and is living, and with the stone, which ticks none and is non-living. Then the teacher models the misconception: 'A car moves, so is it living? Let me run the test: it does not feed, grow or breathe. An engine moves it. So it is non-living. Moving is not the same as living.' Then a boundary case, the seed: 'it will grow and develop, so it is living.'",
      sentence_frame: "It is _____ because it _____.",
      checkpoint: "Write one living thing and one non-living thing.",
    },
    we_do: {
      depth: "Deep",
      text: "The class runs the test on tricky cases together: a parked car, a sleeping cat, a dead leaf and an egg. Each is taken as a think-pair-share, and pairs must name the feature they used. The teacher re-models if 'it moves, so it is alive' reappears, returning every time to the checklist rather than arguing the case.",
      sentence_frame: "The _____ is _____ because it does not _____.",
      checkpoint:
        "Use the life features to decide: is a maize seed living or non-living? Tick one and name one feature you used.",
    },
    you_do: {
      depth: "Deep",
      text: "Each learner decides three cases — a seed, a bicycle and a chicken — ticking living or non-living, and writes the feature used for one of them.",
      sentence_frame: "_____ is correct, because the _____ does _____.",
      checkpoint:
        "Asha says, 'the tree is not living because it cannot walk.' Juma says the tree is living. Who is correct, and how do you know?",
    },
  },
  differentiation: {
    remedial:
      "Show the checklist as picture icons and decide only one boundary case, the seed, with the teacher, using the sentence frame aloud.",
    support:
      "Keep the checklist visible throughout and give the frame 'It is _____ because it _____.' so the reason is scaffolded rather than invented.",
    challenge:
      "Take a harder pair — running water and a fish — and justify both with the test. Then write two full justifications and a rebuttal to a wrong claim.",
    digital_resources: [
      "A short TIE e-Library clip of a seed germinating in time-lapse, so the growing that cannot be seen in the classroom becomes visible (if available).",
    ],
  },
  conclusion_and_exit_ticket: {
    understanding:
      "We decide what is living by its features — feeding, growing, breathing, moving on its own and reproducing — not by how it looks or whether it happens to be moving.",
    exit_ticket:
      "Five questions. 1. Name two features that show a thing has life. (DOK 1) 2. Write one living thing and one non-living thing. (DOK 1) 3. Use the life features to decide: is a maize seed living or non-living? Tick one and name one feature you used. (DOK 2) 4. A car moves along the road. Explain why a car is still not a living thing. (DOK 3) 5. Asha says, 'the tree is not living because it cannot walk.' Juma says the tree is living. Who is correct, and how do you know? (DOK 3) Marking guide: 1) any two of feeding, growing, breathing, moving on its own, reproducing. 2) any correct pair. 3) living, because it grows and develops into a plant. 4) it has no life features — it does not feed, grow or breathe, and an engine moves it. 5) Juma, because the tree grows and feeds, and walking is not one of the life features.",
  },
  assessment_method:
    "Think-pair-share through We Do with each pair naming the feature they used, then error-spotting in You Do; the four stage checkpoints are the formative evidence, with oral answers logged on the oral questioning tracking sheet. Mark the ticket and sort into three groups: secure take an extension error-spotting card and a peer-mentor role; developing revisit the life-feature test at the start of next lesson; not yet get focused reteaching on the life features before new content.",
  watch_for_notes: [
    "This is the unit's pivot lesson — note who still equates movement with life and carry them as a reteach group into the next lesson's opener and the Week 10 review.",
    "The life-feature test is reused in Weeks 8 and 9 and in the midterm, so a gap here does not stay local.",
    "If the movement misconception persists for several learners, re-teach with the parked-car and sleeping-cat pair before the ticket.",
  ],
  teacher_reflection: [
    "Did letting the class feel the pull of 'the car moves so it is living' make the test necessary, or did it plant the idea more firmly?",
    "Every time the movement idea came back, did I return to the checklist rather than argue the individual case?",
    "Who can now name the feature they used, rather than only the right answer, and how will I use them in the next lesson?",
  ],
  meta: {
    source_lesson_idx: 4,
    grade: "G2",
    subject: "HealthAndEnvironment",
    gaps_flagged: [],
  },
};

/** Scheme subject label, exactly as printed in the Health & Environment docx. */
const HEALTH_SCHEME = "Health and Environment";

/**
 * The seeded corpus, in catalogue order. Keep each (subject, week, lesson) run
 * CONSECUTIVE — `getUpcomingForTeacher` finds a successor by strictly-after
 * (term, week, lesson) within the same grade and subject, so a lone plan in a
 * bucket has nothing to offer next.
 */
export const SAMPLE_PLANS: SamplePlan[] = [
  {
    grade: "G2",
    subject: "Arithmetic",
    term: "1a",
    week: 2,
    lesson: 1,
    durationMinutes: 40,
    structured: ARITHMETIC_W2_L1,
  },
  {
    grade: "G2",
    subject: "Arithmetic",
    term: "1a",
    week: 2,
    lesson: 2,
    durationMinutes: 40,
    structured: ARITHMETIC_W2_L2,
  },
  {
    grade: "G2",
    subject: "Arithmetic",
    term: "1a",
    week: 2,
    lesson: 3,
    durationMinutes: 40,
    structured: ARITHMETIC_W2_L3,
  },
  {
    grade: "G2",
    subject: "HealthAndEnvironment",
    term: "1a",
    week: 2,
    lesson: 1,
    durationMinutes: 30,
    schemeRef: { subject: HEALTH_SCHEME, week: 2, indexInWeek: 0 },
    structured: HEALTH_W2_L1,
  },
  {
    grade: "G2",
    subject: "HealthAndEnvironment",
    term: "1a",
    week: 2,
    lesson: 2,
    durationMinutes: 30,
    schemeRef: { subject: HEALTH_SCHEME, week: 2, indexInWeek: 1 },
    structured: HEALTH_W2_L2,
  },
  {
    grade: "G2",
    subject: "HealthAndEnvironment",
    term: "1a",
    week: 3,
    lesson: 1,
    durationMinutes: 30,
    schemeRef: { subject: HEALTH_SCHEME, week: 3, indexInWeek: 0 },
    structured: HEALTH_W3_L1,
  },
];
