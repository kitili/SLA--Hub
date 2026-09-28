/**
 * Postman-style probe of Ed Admin GET Parents / Students.
 *
 *   node scripts/probe-edadmin.js
 *   node scripts/probe-edadmin.js --sync
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const edadmin = require('../lib/edadmin');
const db = require('../db');

async function main() {
  const sync = process.argv.includes('--sync');
  const base = edadmin.apiBase();
  const urls = {
    parents: `${base}/api/general/v1/Parents`,
    students: `${base}/api/general/v1/Students`,
  };
  console.log('Ed Admin base:', base);
  console.log('Configured:', edadmin.isConfigured());
  console.log('GET', urls.parents);
  console.log('GET', urls.students);

  if (!edadmin.isConfigured()) {
    console.log('No real EDADMIN_API_KEY — paste the General API key in backend/.env then re-run.');
    if (!sync) process.exit(0);
    process.exit(1);
  }

  try {
    const xml = await edadmin.getGeneral('Parents');
    const parents = edadmin.parseXmlRecords(xml, 'Parents');
    console.log('Parents records:', parents.length);
    if (parents[0]) console.log('Parent fields:', Object.keys(parents[0]).join(', '));
    const firstId = parents[0] && (parents[0].ID || parents[0].ParentID);
    if (firstId) console.log('Try parent_id=', firstId);
  } catch (err) {
    console.error('Parents GET failed:', err.response?.status || err.message);
  }

  try {
    const xml = await edadmin.getGeneral('Students');
    const students = edadmin.parseXmlRecords(xml, 'Students');
    console.log('Students records:', students.length);
    if (students[0]) console.log('Student fields:', Object.keys(students[0]).join(', '));
  } catch (err) {
    console.error('Students GET failed:', err.response?.status || err.message);
  }

  if (sync) {
    const result = await edadmin.syncDirectory(db);
    console.log('Sync:', result);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
