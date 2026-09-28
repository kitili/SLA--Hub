/** Escape text for safe interpolation into HTML email bodies. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Log server-side, never leak internal details to clients. */
function sendServerError(res, err, label = 'Request') {
  console.error(`${label} error:`, err?.message || err);
  return res.status(500).json({ error: 'Internal server error.' });
}

/**
 * Campus access helper.
 * @returns {true} if allowed
 */
function assertCampusAccess(scope, campusId) {
  if (scope.isGlobal) return true;
  return campusId != null && String(campusId) === String(scope.campusId);
}

/**
 * Load a row by id and enforce campus scope.
 * @returns {object|null|false} row, null if missing, false if forbidden
 */
async function loadScopedRow(db, table, id, scope, { campusColumn = 'campus_id' } = {}) {
  const { rows } = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  if (!rows.length) return null;
  if (!assertCampusAccess(scope, rows[0][campusColumn])) return false;
  return rows[0];
}

function forbiddenOrNotFound(res, row) {
  if (row === null) return res.status(404).json({ error: 'Not found.' });
  if (row === false) return res.status(403).json({ error: 'Outside your campus scope.' });
  return null;
}

module.exports = {
  escapeHtml,
  sendServerError,
  assertCampusAccess,
  loadScopedRow,
  forbiddenOrNotFound,
};
