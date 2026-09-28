// One question per SECTION only (medium difficulty) — after reading all documents in that section
export const PASS_THRESHOLD = 1;

// No per-document quizzes
export const itemCheckpoints = {};

export const sectionCheckpoints = {
  'section-welcome': {
    title: 'Welcome & About Us — Checkpoint',
    questions: [{
      id: 'sw-q1',
      text: 'A new teacher is unsure who to approach about a curriculum decision that affects their grade level. According to Silverleaf\'s organisation materials, what should they do first?',
      options: [
        'Follow the chain of command on the organisation chart to identify their line manager',
        'Post the question in a public parent WhatsApp group',
        'Wait until the end of the school year to raise it',
        'Contact the CEO directly for every classroom decision',
      ],
      correct: 0,
    }],
  },
  'section-branding': {
    title: 'Branding & Communication — Checkpoint',
    questions: [{
      id: 'sb-q1',
      text: 'You are preparing a flyer for a school open day. Which approach aligns with Silverleaf\'s brand guidelines?',
      options: [
        'Use approved logos, colours, and letterhead/presentation templates from the branding pack',
        'Download any logo from Google Images to save time',
        'Create a new mascot and colour scheme for your campus only',
        'Use Comic Sans and bright red because it "stands out"',
      ],
      correct: 0,
    }],
  },
  'section-digital-tools': {
    title: 'Digital Tools — Checkpoint',
    questions: [{
      id: 'sdt-q1',
      text: 'By the end of your first week, which setup best reflects Silverleaf\'s digital onboarding expectations?',
      options: [
        'School Google account, email, Classroom, and shared calendars configured per the guides',
        'Use only a personal Gmail account for all school communication',
        'Share one login with a colleague to reduce password fatigue',
        'Disable calendar notifications so meetings do not appear',
      ],
      correct: 0,
    }],
  },
  'section-marketing': {
    title: 'Marketing & Social Media — Checkpoint',
    questions: [{
      id: 'sm-q1',
      text: 'You want to share photos from a school event on your personal social media. What is the most compliant first step?',
      options: [
        'Follow the social media and content creation guidelines — including consent and official channels',
        'Tag Silverleaf and post immediately; policies apply only to the marketing team',
        'Use student full names and classroom details so parents can find the post',
        'Live-stream inside classrooms without checking any policy',
      ],
      correct: 0,
    }],
  },
  'section-training': {
    title: 'Training & Professional Development — Checkpoint',
    questions: [{
      id: 'st-q1',
      text: 'Silverleaf\'s professional development materials emphasise that growth is expected of:',
      options: [
        'All staff — customer service and ongoing learning apply across roles',
        'Only teaching staff in exam years',
        'New hires for their first month only',
        'Senior leadership — others are exempt from training',
      ],
      correct: 0,
    }],
  },
  'section-faqs': {
    title: 'Support & Contacts — Checkpoint',
    questions: [{
      id: 'sf-q1',
      text: 'You have a payroll question on day three and cannot find the answer in the handbook. What is the best course of action?',
      options: [
        'Use the support contacts / FAQ resources to reach the correct HR or leadership contact',
        'Ask students for advice on how payroll works at Silverleaf',
        'Assume the issue will resolve itself without reporting it',
        'Share salary details in a staff Telegram group to compare',
      ],
      correct: 0,
    }],
  },
  'section-health-safety': {
    title: 'Health, Safety & Emergency — Checkpoint',
    questions: [{
      id: 'shs-q1',
      text: 'During an emergency on campus, what is the first priority according to standard health and safety practice?',
      options: [
        'Ensure everyone is safe and follow the school\'s emergency procedures',
        'Finish your lesson before checking what happened',
        'Post about the incident on social media immediately',
        'Investigate the cause alone before alerting anyone',
      ],
      correct: 0,
    }],
  },
  'section-statutory-payroll': {
    title: 'Statutory & Payroll — Checkpoint',
    questions: [{
      id: 'ssp-q1',
      text: 'You notice an error on your payslip. What is the correct first step?',
      options: [
        'Contact HR through the official support channels with the details',
        'Discuss your salary openly with students',
        'Ignore it — it will correct itself next month',
        'Change your bank details without telling HR',
      ],
      correct: 0,
    }],
  },
  'section-templates-resources': {
    title: 'Templates & Resources — Checkpoint',
    questions: [{
      id: 'str-q1',
      text: 'You need a document template for school communication. Where should you look first?',
      options: [
        'The approved Templates & Resources section of the onboarding hub',
        'Any random template found online',
        'Ask a parent to design one for you',
        'Create your own version without checking brand guidelines',
      ],
      correct: 0,
    }],
  },
  'section-teaching-academic': {
    title: 'Teaching & Academic — Checkpoint',
    questions: [{
      id: 'sta-q1',
      text: 'A new teacher wants to understand Silverleaf\'s academic expectations. What should they do first?',
      options: [
        'Review the Teaching & Academic materials and follow guidance from their line manager',
        'Use only their previous school\'s approach without checking Silverleaf standards',
        'Skip reading materials and improvise in the classroom',
        'Wait until the end of term to ask about expectations',
      ],
      correct: 0,
    }],
  },
  'section-safeguarding': {
    title: 'Safeguarding — Checkpoint',
    questions: [{
      id: 'ss-q1',
      text: 'You overhear a disclosure from a student that raises a safeguarding concern. What does the Child Protection / Staff Code of Conduct require?',
      options: [
        'Report immediately through the proper safeguarding channels — do not investigate alone',
        'Promise the student you will keep it completely secret between you two',
        'Wait until you have gathered full evidence before telling anyone',
        'Discuss the child\'s situation in the staff room for collective advice first',
      ],
      correct: 0,
    }],
  },
};

export function getCheckpointForItem() {
  return null;
}

export function getCheckpointForSection(sectionId) {
  return sectionCheckpoints[`section-${sectionId}`] || null;
}

export function hasCheckpoint(id) {
  return Boolean(sectionCheckpoints[id]);
}

export function getSectionCheckpointIds() {
  return Object.keys(sectionCheckpoints);
}
