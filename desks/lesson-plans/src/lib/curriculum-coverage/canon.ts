/** One spelling for grades, subjects, and term windows that the sheets write differently. */

const SUBJECTS: Record<string, string> = {
  math: "Mathematics",
  maths: "Mathematics",
  mathematics: "Mathematics",
  english: "English",
  "english language": "English",
  kiswahili: "Kiswahili",
  swahili: "Kiswahili",
  "kiswahili language": "Kiswahili",
  science: "Science and Technology",
  "science and technology": "Science and Technology",
  "social studies": "Social Studies",
  sst: "Social Studies",
  civics: "Civics and Moral",
  cme: "Civics and Moral",
  "civics and moral": "Civics and Moral",
  "civics and moral education": "Civics and Moral",
  vocational: "Vocational Skills",
  "vocational skills": "Vocational Skills",
  art: "Art and Crafts",
  arts: "Art and Crafts",
  "art and crafts": "Art and Crafts",
  "arts and crafts": "Art and Crafts",
  reading: "Reading",
  kusoma: "Reading",
  writing: "Writing",
  kuandika: "Writing",
  arithmetic: "Arithmetic",
  hesabu: "Arithmetic",
  health: "Health and Environment",
  "health and environment": "Health and Environment",
  "health environment": "Health and Environment",
};

export function subjectKey(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function canonSubject(value: string) {
  const key = subjectKey(value);
  if (!key) return "";
  if (SUBJECTS[key]) return SUBJECTS[key];
  return key.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function canonGrade(value: string) {
  const compact = value.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  const kg = /^(?:kg|k g|nursery|pre primary)\s*(\d)$/.exec(compact) || /^kg(\d)$/.exec(compact.replace(/\s/g, ""));
  if (kg) return `KG${kg[1]}`;
  const grade = /^(?:grade|grd|std|standard|g)\s*(\d)$/.exec(compact);
  if (grade) return `Grade ${grade[1]}`;
  return value.trim();
}

export function canonTerm(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  const match = /^(?:TERM)?T?([12])([AB])$/.exec(compact);
  return match ? `T${match[1]}${match[2]}` : value.trim();
}

export function canonType(value: string) {
  const text = value.trim();
  if (/sfna/i.test(text)) return "SFNA";
  if (/term/i.test(text)) return "Termly";
  return text;
}
