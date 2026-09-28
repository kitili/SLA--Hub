/**
 * Ensure Eric and Mariam exist as campus marketing heads.
 * Does not deactivate other staff — Team management owns the roster.
 *
 * Usage: cd backend && node scripts/seed-marketing-team.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../db');
const { DEFAULT_PASSWORD, BCRYPT_COST } = require('../middleware/auth');

const TEAM = [
  { name: 'Eric', email: 'eric@silverleaf.co.tz', campus_code: 'ACC' },
  { name: 'Mariam', email: 'mariam@silverleaf.co.tz', campus_code: 'USR' },
];

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_COST);
  const { rows: campuses } = await db.query('SELECT id, code FROM campuses');
  const byCode = Object.fromEntries(campuses.map(c => [c.code, c.id]));
  for (const member of TEAM) {
    const campusId = byCode[member.campus_code] || null;
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, department, campus_id, is_active, must_change_password)
       VALUES ($1, $2, $3, 'campus_marketing_head', 'marketing', $4, TRUE, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         campus_id = EXCLUDED.campus_id,
         is_active = TRUE,
         department = 'marketing',
         role = 'campus_marketing_head',
         updated_at = NOW()`,
      [member.name, member.email, hash, campusId]
    );
    console.log(`  ✅ ${member.name} (${member.email}) · ${member.campus_code}`);
  }

  console.log(`\nEric and Mariam are active campus marketing heads.`);
  console.log(`Add or deactivate other members from the Team page.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
