/**
 * Ed Admin General API (GET-only).
 *
 * Docs: GET {site}/api/general/v1/{Parents|Students|…}
 * You cannot add a custom query on the General API — we fetch the list
 * and match in memory, then upsert into edadmin_parents / edadmin_students
 * so marketing can join on parent_id.
 */

const axios = require('axios');

const DEFAULT_BASE = 'https://silverleafacademy.ed-space.net';
const CACHE_TTL_MS = 5 * 60 * 1000;
const PARENT_PHONE_FIELDS = [
  'MPCell', 'MPHome', 'FPCell', 'FPHome', 'FCell', 'MCell',
  'Cell', 'Phone', 'MPhone', 'FPhone',
];

const CAMPUS_ALIASES = {
  ACC: ['arusha city', 'acc', 'arusha'],
  USR: ['usa river', 'usr', 'usa'],
  BOM: ['boma'],
  KJG: ['kijenge'],
  ILB: ['ilboru'],
};

let parentCache = { at: 0, rows: null };
let studentCache = { at: 0, rows: null };

function looksLikeKey(value) {
  if (!value || String(value).trim() === '') return false;
  const v = String(value);
  if (/replace|your-|example|placeholder|<.*>/i.test(v)) return false;
  return v.length >= 8;
}

function isConfigured() {
  return looksLikeKey(process.env.EDADMIN_API_KEY);
}

function apiBase() {
  return (process.env.EDADMIN_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
}

function phoneKeys(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return [];
  const keys = new Set([digits]);
  if (digits.length >= 9) keys.add(digits.slice(-9));
  if (digits.startsWith('255') && digits.length >= 12) keys.add(`0${digits.slice(3)}`);
  if (digits.startsWith('0') && digits.length >= 10) keys.add(`255${digits.slice(1)}`);
  return [...keys];
}

function phonesOverlap(a, b) {
  const left = new Set(phoneKeys(a));
  if (!left.size) return false;
  return phoneKeys(b).some((k) => left.has(k));
}

function parentMatchesPhone(parent, phone) {
  return PARENT_PHONE_FIELDS.some((field) => phonesOverlap(phone, parent[field]));
}

function campusMatches(campusName, campusCode) {
  if (!campusCode) return true;
  const name = String(campusName || '').toLowerCase();
  if (!name) return true;
  const aliases = CAMPUS_ALIASES[String(campusCode).toUpperCase()] || [String(campusCode).toLowerCase()];
  return aliases.some((alias) => name.includes(alias));
}

function parseXmlRecords(xml, tag) {
  if (!xml || typeof xml !== 'string') return [];
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  return xml.split(open).slice(1).map((part) => {
    const body = part.split(close)[0] || '';
    const obj = {};
    for (const m of body.matchAll(/<([A-Za-z0-9]+)>([^<]*)<\/\1>/g)) {
      obj[m[1]] = m[2];
    }
    return obj;
  });
}

async function getGeneral(resource) {
  const key = process.env.EDADMIN_API_KEY;
  if (!key) return null;
  const url = `${apiBase()}/api/general/v1/${resource}`;
  const { data } = await axios.get(url, {
    timeout: 15000,
    headers: {
      Accept: 'application/xml, text/xml, */*',
      'X-API-Key': key,
      Authorization: `Bearer ${key}`,
    },
    responseType: 'text',
    validateStatus: (status) => status >= 200 && status < 300,
  });
  return data;
}

function pickField(row, names) {
  for (const name of names) {
    if (row[name] != null && String(row[name]).trim() !== '') return String(row[name]).trim();
  }
  return '';
}

async function loadParents({ force } = {}) {
  const now = Date.now();
  if (!force && parentCache.rows && now - parentCache.at < CACHE_TTL_MS) return parentCache.rows;
  const xml = await getGeneral('Parents');
  const rows = parseXmlRecords(xml, 'Parents');
  parentCache = { at: now, rows };
  return rows;
}

async function loadStudents({ force } = {}) {
  const now = Date.now();
  if (!force && studentCache.rows && now - studentCache.at < CACHE_TTL_MS) return studentCache.rows;
  const xml = await getGeneral('Students');
  const rows = parseXmlRecords(xml, 'Students');
  studentCache = { at: now, rows };
  return rows;
}

function normalizeParent(row) {
  const edadminId = pickField(row, ['ID', 'Id', 'ParentID', 'ParentId', 'ParentsID']);
  const first = pickField(row, ['FirstName', 'FName', 'MotherFirstName', 'FatherFirstName']);
  const last = pickField(row, ['LastName', 'SName', 'Surname', 'MotherLastName', 'FatherLastName']);
  const full = pickField(row, ['FullName', 'Name', 'ParentName']) || [first, last].filter(Boolean).join(' ');
  return {
    edadmin_id: edadminId,
    first_name: first.slice(0, 80),
    last_name: last.slice(0, 80),
    full_name: full.slice(0, 160),
    phone: pickField(row, PARENT_PHONE_FIELDS).slice(0, 40),
    phone2: pickField(row, ['MPHome', 'FPHome', 'FPCell']).slice(0, 40),
    email: pickField(row, ['Email', 'MPEmail', 'FPEmail']).slice(0, 120),
    campus_name: pickField(row, ['CampusName', 'Campus', 'School']).slice(0, 120),
  };
}

function normalizeStudent(row) {
  return {
    edadmin_id: pickField(row, ['ID', 'Id', 'StudentID', 'StudentId']),
    parent_edadmin_id: pickField(row, ['ParentID', 'ParentId', 'ParentsID', 'PID', 'FamilyID']),
    first_name: pickField(row, ['FirstName', 'FName', 'StudentFirstName']).slice(0, 80),
    last_name: pickField(row, ['LastName', 'SName', 'Surname', 'StudentLastName']).slice(0, 80),
    class_name: pickField(row, ['Class', 'Grade', 'ClassName']).slice(0, 40),
    gender: pickField(row, ['Gender', 'Sex']).slice(0, 10),
    campus_name: pickField(row, ['CampusName', 'Campus', 'School']).slice(0, 120),
  };
}

/**
 * True when Ed Admin already has a parent on this phone (optionally campus).
 * Returns false when the API is unconfigured or unreachable — never falls
 * back to the local students table.
 */
async function hasEnrolledSibling(phone, { campusCode } = {}) {
  if (!isConfigured() || !phone) return false;
  try {
    const parents = await loadParents();
    return parents.some((parent) => (
      parentMatchesPhone(parent, phone) && campusMatches(parent.CampusName, campusCode)
    ));
  } catch (err) {
    console.error('Ed Admin sibling lookup failed:', err.message);
    return false;
  }
}

async function parentCount() {
  if (!isConfigured()) return null;
  const rows = await loadParents();
  return rows.length;
}

/**
 * Headcount by campus + grade. Drops names — only counts.
 */
async function occupancyByGrade() {
  if (!isConfigured()) return null;
  const xml = await getGeneral('StudentClasses');
  const rows = parseXmlRecords(xml, 'StudentClasses');
  const map = new Map();
  for (const row of rows) {
    const campus = row.CampusName || 'Unknown';
    const grade = row.Grade || row.Class || 'Unknown';
    const key = `${campus}\t${grade}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([key, students]) => {
    const [campus, grade] = key.split('\t');
    return { campus, grade, students };
  });
}

async function syncDirectory(db) {
  if (!isConfigured()) {
    return { configured: false, parents: 0, students: 0, linked_leads: 0 };
  }
  const [parentsRaw, studentsRaw] = await Promise.all([
    loadParents({ force: true }),
    loadStudents({ force: true }),
  ]);
  const parents = parentsRaw.map(normalizeParent).filter((p) => p.edadmin_id);
  const students = studentsRaw.map(normalizeStudent).filter((s) => s.edadmin_id);
  const parentIds = new Set(parents.map((p) => p.edadmin_id));

  for (const parent of parents) {
    await db.query(
      `INSERT INTO edadmin_parents
         (edadmin_id, first_name, last_name, full_name, phone, phone2, email, campus_name, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (edadmin_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         phone2 = EXCLUDED.phone2,
         email = EXCLUDED.email,
         campus_name = EXCLUDED.campus_name,
         synced_at = NOW()`,
      [parent.edadmin_id, parent.first_name, parent.last_name, parent.full_name,
        parent.phone, parent.phone2, parent.email, parent.campus_name]
    );
  }

  for (const student of students) {
    const parentId = parentIds.has(student.parent_edadmin_id) ? student.parent_edadmin_id : null;
    await db.query(
      `INSERT INTO edadmin_students
         (edadmin_id, parent_edadmin_id, first_name, last_name, class_name, gender, campus_name, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (edadmin_id) DO UPDATE SET
         parent_edadmin_id = EXCLUDED.parent_edadmin_id,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         class_name = EXCLUDED.class_name,
         gender = EXCLUDED.gender,
         campus_name = EXCLUDED.campus_name,
         synced_at = NOW()`,
      [student.edadmin_id, parentId, student.first_name, student.last_name,
        student.class_name, student.gender, student.campus_name]
    );
  }

  const { rowCount: linked } = await db.query(`
    UPDATE marketing_leads l
    SET edadmin_parent_id = p.edadmin_id,
        sibling_flag = TRUE,
        updated_at = NOW()
    FROM edadmin_parents p
    WHERE l.edadmin_parent_id IS NULL
      AND l.parent_phone IS NOT NULL
      AND (
        regexp_replace(l.parent_phone, '\\D', '', 'g')
        = regexp_replace(COALESCE(p.phone, ''), '\\D', '', 'g')
        OR right(regexp_replace(l.parent_phone, '\\D', '', 'g'), 9)
        = right(regexp_replace(COALESCE(p.phone, ''), '\\D', '', 'g'), 9)
      )
  `);

  return {
    configured: true,
    parents: parents.length,
    students: students.length,
    linked_leads: linked || 0,
    endpoints: {
      parents: `${apiBase()}/api/general/v1/Parents`,
      students: `${apiBase()}/api/general/v1/Students`,
    },
  };
}

module.exports = {
  isConfigured,
  apiBase,
  phoneKeys,
  phonesOverlap,
  parseXmlRecords,
  hasEnrolledSibling,
  parentCount,
  occupancyByGrade,
  loadParents,
  loadStudents,
  normalizeParent,
  normalizeStudent,
  syncDirectory,
  getGeneral,
};
