/**
 * Silverleaf Academy — Instructional Leadership Dashboard (Google Apps Script web app)
 * -------------------------------------------------------------------------------
 * Combines campus walkthroughs and teacher observations in one live view.
 * Reads two Google Sheets on every refresh:
 *   • [MASTER] Walkthroughs Tracker             — "Combined Responses" (the walkthrough form),
 *                                                  "SETUP (Edit Here)" (term dates) and
 *                                                  "Google Form Setup Guide" (PD focus trajectories)
 *   • [MASTER] 2026 SLA Teacher Observation Tracker — the five campus response tabs, "SETUP (Edit Here)"
 *                                                  (teacher roster) and "DASHBOARD" (date range)
 *
 * Observation figures are worked out from the campus response tabs themselves, using the same rules
 * as the Observation Tracker's DASHBOARD per-campus table (date range, and the allowance of
 * OBS_ALLOWANCE_PER_TEACHER per teacher on the roster), so they match that table without depending
 * on its observer formulas.
 *
 * Deploy: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone within Silverleaf.
 * The account that deploys must be able to open both spreadsheets and the brandmark file.
 */

var CONFIG = {
  WALKTHROUGH_SHEET_ID: '1SlxrfzV7JrlknWODUf_CjvUffSno-j883pWT5B_2tAc',
  OBSERVATION_SHEET_ID: '1OHfF72o26SrHk3Ww5tPGRnpiV46fTO_sjITwCuh3EIU',
  // Brandmark PNG in Drive (Electric Blue, no tagline); the page turns it white on blue with CSS.
  LOGO_FILE_ID: '1jtnqyTStADUMMkKdX2UeLLurtwUFYkvL',

  // name: as the walkthrough form and the observation tab names write it; full: as the observation SETUP writes it.
  CAMPUSES: [
    { name: 'Usa River', full: 'Usa River Campus' },
    { name: 'Arusha Modern', full: 'Arusha Modern Campus' },
    { name: 'Kijenge', full: 'Kijenge Campus' },
    { name: 'Ilboru', full: 'Ilboru Campus' },
    { name: 'Boma', full: 'Boma Campus' }
  ],

  WALKTHROUGH_TAB: 'Combined Responses',
  WALKTHROUGH_SETUP_TAB: 'SETUP (Edit Here)',
  WALKTHROUGH_PD_TAB: 'Google Form Setup Guide',
  // Its "WALKTHROUGHS PER CAMPUS AND TERM" table also counts walkthroughs done before the form existed.
  WALKTHROUGH_DASHBOARD_TAB: 'DASHBOARD',
  OBS_SETUP_TAB: 'SETUP (Edit Here)',
  OBS_DASHBOARD_TAB: 'DASHBOARD',

  // The Observation Tracker DASHBOARD adds 6 observations per rostered teacher to each campus's
  // "# Observations" and "# Classroom Obs". Kept so the totals match that tracker.
  OBS_ALLOWANCE_PER_TEACHER: 6,

  // Order used only if a date arrives as typed text rather than a real date ('MDY' or 'DMY').
  TEXT_DATE_ORDER: 'MDY',
  CACHE_MINUTES: 15
};

// ------------------------------------------------------------------ web app

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Silverleaf Academy · Instructional Leadership Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Returns the dashboard payload. Cached for CONFIG.CACHE_MINUTES; force=true (the Refresh button) re-reads both sheets. */
function getDashboardData(force) {
  if (!force) {
    var cached = cacheGet_();
    if (cached) return cached;
  }
  var data = buildData_();
  cachePut_(data);
  return data;
}

/** Returns the brandmark as a data URI so the page needs no public image hosting. */
function getLogo() {
  try {
    var blob = DriveApp.getFileById(CONFIG.LOGO_FILE_ID).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) { return ''; }
}

// ------------------------------------------------------------------ read the sheets

function buildData_() {
  var t0 = new Date();
  var wt = SpreadsheetApp.openById(CONFIG.WALKTHROUGH_SHEET_ID);
  var ob = SpreadsheetApp.openById(CONFIG.OBSERVATION_SHEET_ID);

  var src = {
    walk: {
      responses: values_(wt, CONFIG.WALKTHROUGH_TAB),
      setup: values_(wt, CONFIG.WALKTHROUGH_SETUP_TAB),
      pd: displayValues_(wt, CONFIG.WALKTHROUGH_PD_TAB),
      dashboard: values_(wt, CONFIG.WALKTHROUGH_DASHBOARD_TAB)
    },
    obs: {
      tabs: {},
      setup: values_(ob, CONFIG.OBS_SETUP_TAB),
      dashboard: values_(ob, CONFIG.OBS_DASHBOARD_TAB)
    }
  };
  CONFIG.CAMPUSES.forEach(function (c) { src.obs.tabs[c.name] = values_(ob, c.name); });

  var data = buildPayload(src, CONFIG);
  data.generatedAt = new Date().toISOString();
  data.buildMs = new Date() - t0;
  data.sources = [
    { key: 'walk', name: wt.getName(), url: wt.getUrl(), updated: DriveApp.getFileById(CONFIG.WALKTHROUGH_SHEET_ID).getLastUpdated().toISOString() },
    { key: 'obs', name: ob.getName(), url: ob.getUrl(), updated: DriveApp.getFileById(CONFIG.OBSERVATION_SHEET_ID).getLastUpdated().toISOString() }
  ];
  return data;
}

function values_(ss, tab) {
  var sh = ss.getSheetByName(tab);
  return sh ? sh.getDataRange().getValues() : [];
}

function displayValues_(ss, tab) {
  var sh = ss.getSheetByName(tab);
  return sh ? sh.getDataRange().getDisplayValues() : [];
}

// ------------------------------------------------------------------ pure parsing (no Apps Script services)

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

/** Any date the sheets can hold (Date object, serial number, ISO text or d/m/y text) → 'yyyy-mm-dd', else ''. */
function toISODate(v, order) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    return v.getFullYear() + '-' + pad2_(v.getMonth() + 1) + '-' + pad2_(v.getDate());
  }
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return '';
    var d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
  }
  var s = String(v).trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(s);
  if (m) {
    var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    var mo = (order || CONFIG.TEXT_DATE_ORDER) === 'DMY' ? b : a, da = (order || CONFIG.TEXT_DATE_ORDER) === 'DMY' ? a : b;
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return '';
    return m[3] + '-' + pad2_(mo) + '-' + pad2_(da);
  }
  return '';
}

function clean_(v) { return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim(); }

/** "GRACE  KAMBONA" → "Grace Kambona". Leaves already mixed-case names alone. */
function personName(v) {
  var s = clean_(v);
  if (!s) return '';
  if (s === s.toUpperCase() || s === s.toLowerCase()) {
    s = s.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, function (_, p, ch) { return p + ch.toUpperCase(); });
  }
  return s;
}

function editDistance_(a, b) {
  var prev = [], cur, i, j;
  for (j = 0; j <= b.length; j++) prev.push(j);
  for (i = 1; i <= a.length; i++) {
    cur = [i];
    for (j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Maps spelling variants of a person's name onto one form, so filters and tables list each person once.
 *   • a shorter entry whose words start a longer name ("Irene", "Irene Didass" → "Irene Didass Machange")
 *   • a near-identical spelling with the same number of words ("Godfrrey Mulokozi" → "Godfrey Mulokozi")
 * Candidates are the names entered (and any `known` roster names); the most complete, most used name wins.
 * Returns {variant: canonical}; names with no clear match are left alone.
 */
function canonicalNames(names, known) {
  var freq = {};
  names.forEach(function (n) { if (n) freq[n] = (freq[n] || 0) + 1; });
  (known || []).forEach(function (n) { if (n && !freq[n]) freq[n] = 0.5; });
  var all = Object.keys(freq);
  var words = function (n) { return n.toLowerCase().split(' '); };
  var map = {};
  Object.keys(freq).filter(function (n) { return freq[n] >= 1; }).forEach(function (n) {
    var wn = words(n), best = null;
    all.forEach(function (m) {
      if (m === n) return;
      var wm = words(m), ok = false;
      if (wm.length > wn.length) {
        ok = wn.every(function (w, i) { return w === wm[i]; });
      } else if (wm.length === wn.length && freq[m] > freq[n] && wn[0].charAt(0) === wm[0].charAt(0)) {
        ok = editDistance_(n.toLowerCase(), m.toLowerCase()) <= 2;
      }
      if (!ok) return;
      if (!best || wm.length > words(best).length || (wm.length === words(best).length && freq[m] > freq[best])) best = m;
    });
    if (best) map[n] = best;
  });
  // follow chains (a → b → c) to the end
  Object.keys(map).forEach(function (k) { var v = map[k], guard = 0; while (map[v] && guard++ < 5) v = map[v]; map[k] = v; });
  return map;
}

/** Index of each wanted column, matched on the header text (exact first, then prefix). */
function headerIndex(header, wanted) {
  var h = header.map(function (x) { return clean_(x).toLowerCase(); });
  var out = {};
  Object.keys(wanted).forEach(function (k) {
    var w = wanted[k].toLowerCase();
    var i = h.indexOf(w);
    if (i < 0) for (var j = 0; j < h.length; j++) { if (h[j].indexOf(w) === 0) { i = j; break; } }
    out[k] = i;
  });
  return out;
}

/** Term windows from the walkthrough SETUP: the block headed Term | Label | Start Date | End Date. */
function parseTerms(vals) {
  var out = [];
  for (var r = 0; r < vals.length; r++) {
    var row = vals[r];
    for (var c = 0; c < row.length; c++) {
      if (clean_(row[c]).toLowerCase() === 'term' && clean_(row[c + 2]).toLowerCase() === 'start date') {
        for (var r2 = r + 1; r2 < vals.length; r2++) {
          var name = clean_(vals[r2][c]);
          if (!name) break;
          out.push({ name: name, label: clean_(vals[r2][c + 1]), start: toISODate(vals[r2][c + 2], 'DMY'), end: toISODate(vals[r2][c + 3], 'DMY') });
        }
        return out;
      }
    }
  }
  return out;
}

/** PD focus categories from the walkthrough form guide: the columns under "Management Trajectory" and "Rigor Trajectory". */
function parsePdLists(vals) {
  var lists = { management: [], rigor: [] };
  for (var r = 0; r < vals.length; r++) {
    for (var c = 0; c < vals[r].length; c++) {
      var v = clean_(vals[r][c]).toLowerCase();
      var key = v === 'management trajectory' ? 'management' : (v === 'rigor trajectory' ? 'rigor' : '');
      if (!key) continue;
      for (var r2 = r + 1; r2 < vals.length; r2++) {
        var item = clean_(vals[r2][c]);
        if (!item) continue;
        if (item.toLowerCase() === 'other') continue;
        if (lists[key].indexOf(item) < 0) lists[key].push(item);
      }
    }
  }
  return lists;
}

function parseWalkthroughs(vals, knownNames) {
  if (!vals.length) return [];
  var ci = headerIndex(vals[0], {
    stamp: 'Timestamp', date: 'Date of Walkthrough', term: 'Term', campus: 'Campus', present: 'Who is present',
    roles: 'Roles present', facilitator: 'Facilitator', ampm: 'AM or PM', glows: 'Glows', grows: 'Grows',
    pd: 'PD Focus Category', assign: 'Assign PD to', target: 'PD completion target date', notes: 'Other notes'
  });
  var get = function (row, k) { return ci[k] >= 0 ? row[ci[k]] : ''; };
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    var campus = clean_(get(row, 'campus'));
    if (!campus) continue;
    out.push({
      date: toISODate(get(row, 'date')) || toISODate(get(row, 'stamp')),
      term: clean_(get(row, 'term')),
      campus: campus,
      facilitator: personName(get(row, 'facilitator')),
      roles: clean_(get(row, 'roles')),
      present: clean_(get(row, 'present')),
      ampm: clean_(get(row, 'ampm')),
      pd: clean_(get(row, 'pd')) || 'Not recorded',
      assign: personName(get(row, 'assign')),
      target: toISODate(get(row, 'target')),
      glows: String(get(row, 'glows') || '').trim(),
      grows: String(get(row, 'grows') || '').trim(),
      notes: String(get(row, 'notes') || '').trim()
    });
  }
  var map = canonicalNames(out.map(function (w) { return w.facilitator; }), knownNames);
  out.forEach(function (w) { if (map[w.facilitator]) w.facilitator = map[w.facilitator]; });
  return out;
}

/** The Walkthroughs Tracker DASHBOARD table headed Campus | Term 1A | Term 1B | … → { campus: { term: count } }. */
function parseWalkMatrix(vals) {
  for (var r = 0; r < vals.length; r++) {
    for (var c = 0; c < vals[r].length; c++) {
      if (clean_(vals[r][c]).toLowerCase() !== 'campus' || !/^term/i.test(clean_(vals[r][c + 1]))) continue;
      var terms = [];
      for (var c2 = c + 1; c2 < vals[r].length && /^term/i.test(clean_(vals[r][c2])); c2++) terms.push(clean_(vals[r][c2]));
      var out = {};
      for (var r2 = r + 1; r2 < vals.length; r2++) {
        var campus = clean_(vals[r2][c]);
        if (!campus || /^network/i.test(campus)) break;
        out[campus] = {};
        terms.forEach(function (t, i) { out[campus][t] = Number(vals[r2][c + 1 + i]) || 0; });
      }
      return out;
    }
  }
  return {};
}

function parseObservations(campus, vals) {
  if (!vals.length) return [];
  var ci = headerIndex(vals[0], {
    stamp: 'Timestamp', date: 'What is the date?', teacher: 'Teacher Name', grade: 'Grade?', observer: 'Observer?',
    type: 'What type of form', subject: 'Subject Observed', track: 'Is this a culture/management or learning/rigor',
    cm: 'What kind of culture/management', lr: 'What kind of learning/rigor'
  });
  var get = function (row, k) { return ci[k] >= 0 ? row[ci[k]] : ''; };
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    var date = toISODate(get(row, 'date'));
    var teacher = personName(get(row, 'teacher'));
    if (!date && !teacher) continue;
    out.push({
      campus: campus, date: date, teacher: teacher, grade: clean_(get(row, 'grade')),
      observer: personName(get(row, 'observer')), type: clean_(get(row, 'type')),
      subject: clean_(get(row, 'subject')), track: clean_(get(row, 'track')),
      step: clean_(get(row, 'cm')) || clean_(get(row, 'lr'))
    });
  }
  return out;
}

/** Teachers on the roster per campus: SETUP rows whose Role is "Teacher" (as the tracker's # Teachers counts them). */
function parseRoster(vals, campuses) {
  var counts = {};
  campuses.forEach(function (c) { counts[c.name] = 0; });
  var roleCol = -1, campusCol = -1, nameCol = -1;
  var names = {}, coaches = [];
  for (var r = 0; r < vals.length; r++) {
    var row = vals[r].map(function (x) { return clean_(x).toLowerCase(); });
    if (roleCol < 0) {
      var rc = row.indexOf('role');
      if (rc >= 0 && row.indexOf('campus name') >= 0) { roleCol = rc; campusCol = row.indexOf('campus name'); nameCol = row.indexOf('coach full name'); }
      continue;
    }
    if (row[roleCol] === 'observer' || row[roleCol] === 'both') {
      var cn = personName(vals[r][nameCol]);
      if (cn && coaches.indexOf(cn) < 0) coaches.push(cn);
      continue;
    }
    if (row[roleCol] !== 'teacher') continue;
    campuses.forEach(function (c) {
      if (row[campusCol] === c.full.toLowerCase()) {
        counts[c.name]++;
        var n = personName(vals[r][nameCol]);
        if (n) (names[c.name] = names[c.name] || []).push(n);
      }
    });
  }
  return { counts: counts, names: names, coaches: coaches };
}

/** The Start Date / End Date the Observation Tracker DASHBOARD counts within. */
function parseObsRange(vals) {
  for (var r = 0; r < vals.length; r++) {
    for (var c = 0; c < vals[r].length; c++) {
      if (clean_(vals[r][c]).toLowerCase() === 'start date:') {
        var start = '', end = '';
        for (var c2 = c + 1; c2 < vals[r].length; c2++) {
          var v = vals[r][c2];
          if (!start && toISODate(v, 'DMY')) { start = toISODate(v, 'DMY'); continue; }
          if (clean_(v).toLowerCase() === 'end date:') { end = toISODate(vals[r][c2 + 1], 'DMY'); break; }
        }
        return { start: start, end: end };
      }
    }
  }
  return { start: '', end: '' };
}

/** Builds the whole payload from plain grids. buildData_ supplies them from the live sheets; the tests supply saved copies. */
function buildPayload(src, cfg) {
  var campuses = cfg.CAMPUSES;
  var observations = [];
  campuses.forEach(function (c) { observations = observations.concat(parseObservations(c.name, (src.obs.tabs || {})[c.name] || [])); });
  var roster = parseRoster(src.obs.setup || [], campuses);
  // One spelling per observer across the network, and per teacher within each campus.
  var om = canonicalNames(observations.map(function (o) { return o.observer; }), roster.coaches);
  observations.forEach(function (o) { if (om[o.observer]) o.observer = om[o.observer]; });
  campuses.forEach(function (c) {
    var rows = observations.filter(function (o) { return o.campus === c.name; });
    var tm = canonicalNames(rows.map(function (o) { return o.teacher; }), roster.names[c.name] || []);
    rows.forEach(function (o) { if (tm[o.teacher]) o.teacher = tm[o.teacher]; });
  });
  var walkthroughs = parseWalkthroughs(src.walk.responses || [], roster.coaches);
  // Walkthroughs the tracker counts beyond those logged through the form (e.g. Term 1A, before the form was in use).
  var matrix = parseWalkMatrix(src.walk.dashboard || []), walkOffline = [];
  Object.keys(matrix).forEach(function (campus) {
    Object.keys(matrix[campus]).forEach(function (term) {
      var logged = walkthroughs.filter(function (w) { return w.campus === campus && w.term === term; }).length;
      var extra = matrix[campus][term] - logged;
      if (extra > 0) walkOffline.push({ campus: campus, term: term, count: extra });
    });
  });
  return {
    campuses: campuses.map(function (c) { return c.name; }),
    terms: parseTerms(src.walk.setup || []),
    pdLists: parsePdLists(src.walk.pd || []),
    walkthroughs: walkthroughs,
    walkOffline: walkOffline,
    observations: observations,
    obsRules: {
      range: parseObsRange(src.obs.dashboard || []),
      allowancePerTeacher: cfg.OBS_ALLOWANCE_PER_TEACHER,
      teachers: roster.counts,
      roster: roster.names
    }
  };
}

// ------------------------------------------------------------------ cache (chunked; CacheService values max 100 KB)

function cacheGet_() {
  try {
    var cache = CacheService.getScriptCache();
    var meta = cache.get('ild_meta');
    if (!meta) return null;
    var n = parseInt(meta, 10);
    var keys = []; for (var i = 0; i < n; i++) keys.push('ild_' + i);
    var parts = cache.getAll(keys);
    var s = '';
    for (var j = 0; j < n; j++) { if (!parts['ild_' + j]) return null; s += parts['ild_' + j]; }
    var data = JSON.parse(s);
    data.fromCache = true;
    return data;
  } catch (e) { return null; }
}

function cachePut_(data) {
  try {
    var cache = CacheService.getScriptCache();
    var s = JSON.stringify(data);
    var size = 90000, parts = {}, n = 0;
    for (var i = 0; i < s.length; i += size) { parts['ild_' + n] = s.substr(i, size); n++; }
    parts['ild_meta'] = String(n);
    cache.putAll(parts, CONFIG.CACHE_MINUTES * 60);
  } catch (e) { /* cache is best effort */ }
}

// Export pure functions for the Node test harness (ignored by Apps Script).
if (typeof module !== 'undefined') {
  module.exports = { CONFIG: CONFIG, toISODate: toISODate, personName: personName, canonicalNames: canonicalNames, headerIndex: headerIndex,
    parseTerms: parseTerms, parsePdLists: parsePdLists, parseWalkthroughs: parseWalkthroughs, parseObservations: parseObservations,
    parseRoster: parseRoster, parseObsRange: parseObsRange, parseWalkMatrix: parseWalkMatrix, buildPayload: buildPayload };
}
