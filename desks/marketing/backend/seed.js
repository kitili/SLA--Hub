/**
 * Silverleaf Academy — Database Seed Script
 * Creates initial admin users with bcrypt-hashed default passwords.
 *
 * Usage:
 *   cd backend
 *   node seed.jsgfb
 *
 * Default password for all seeded accounts: set via DEFAULT_PASSWORD in .env
 * Users will be required to change on first login.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db     = require('./db');
const { DEFAULT_PASSWORD, BCRYPT_COST } = require('./middleware/auth');

const ROUNDS = BCRYPT_COST;

async function seed() {
  console.log('🌱 Seeding Silverleaf Academy database...');

  // Hash the default password once
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, ROUNDS);
  console.log(`🔐 Password hashed (rounds: ${ROUNDS})`);

  try {
    // ── Fetch campus IDs ─────────────────────────────────────
    const { rows: campuses } = await db.query(
      'SELECT id, name, code FROM campuses ORDER BY id'
    );
    if (!campuses.length) {
      console.error('❌ No campuses found. Run migration first: npm run db:migrate');
      process.exit(1);
    }

    const campusMap = {};
    campuses.forEach(c => { campusMap[c.code] = c.id; });
    console.log('🏫 Campuses found:', campuses.map(c => c.name).join(', '));

    const MARKETING_EMAIL = 'marketing@silverleaf.co.tz';

    // ── Seed users ───────────────────────────────────────────
    const users = [
      // Global heads (no campus)
      {
        name:       'CEO',
        email:      'ceo@silverleaf.co.tz',
        role:       'ceo',
        department: 'marketing',
        campus_id:  null,
      },
      {
        name:       'Global Marketing Head',
        email:      'marketing@silverleaf.co.tz',
        role:       'global_marketing_head',
        department: 'marketing',
        campus_id:  null,
      },
      {
        name:       'Global SE Head',
        email:      'se@silverleaf.co.tz',
        role:       'global_student_exp_head',
        department: 'student_experience',
        campus_id:  null,
      },
      // Campus marketing heads — Eric & Mariam only
      {
        name:       'Eric',
        email:      'eric@silverleaf.co.tz',
        role:       'campus_marketing_head',
        department: 'marketing',
        campus_id:  campusMap['ACC'] || campuses[0]?.id,
      },
      {
        name:       'Mariam',
        email:      'mariam@silverleaf.co.tz',
        role:       'campus_marketing_head',
        department: 'marketing',
        campus_id:  campusMap['USR'] || campuses[1]?.id,
      },
      // Campus SE heads
      ...campuses.map(c => ({
        name:       `${c.name} SE Head`,
        email:      `se.${c.code.toLowerCase()}@silverleaf.co.tz`,
        role:       'campus_student_exp_head',
        department: 'student_experience',
        campus_id:  c.id,
      })),
      // Nurses (one per campus)
      ...campuses.map(c => ({
        name:       `${c.name} Nurse`,
        email:      `nurse.${c.code.toLowerCase()}@silverleaf.co.tz`,
        role:       'nurse',
        department: 'dispensary',
        campus_id:  c.id,
      })),
    ];

    let created = 0;
    let skipped = 0;

    for (const user of users) {
      try {
        await db.query(
          `INSERT INTO users
             (name, email, password_hash, role, department, campus_id, must_change_password)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)
           ON CONFLICT (email) DO NOTHING`,
          [user.name, user.email, hash, user.role, user.department, user.campus_id]
        );
        created++;
        console.log(`  ✅ ${user.role.padEnd(28)} ${user.email}`);
      } catch (err) {
        if (err.code === '23505') { skipped++; continue; }
        throw err;
      }
    }

    await db.query(
      `UPDATE users
       SET password_hash = $1, must_change_password = FALSE, is_active = TRUE, updated_at = NOW()
       WHERE LOWER(email) IN (LOWER($2), 'ceo@silverleaf.co.tz')`,
      [hash, MARKETING_EMAIL]
    );
    console.log('  🔒 marketing@ and ceo@ passwords pinned to DEFAULT_PASSWORD');

    // ── Sample leads for testing ──────────────────────────────
    const { rows: allCampuses } = await db.query('SELECT id FROM campuses');
    const globalMktUser = (await db.query("SELECT id FROM users WHERE email = 'marketing@silverleaf.co.tz'")).rows[0];

    if (globalMktUser) {
      const sampleLeads = [
        { parent_name: 'Demo parent A', parent_phone: '+255712345001', source: 'walk_in',       child_name: 'Child A', interested_class: 'Grade 1', campus_id: allCampuses[0]?.id },
        { parent_name: 'Demo parent B', parent_phone: '+255712345002', source: 'social_media',  child_name: 'Child B', interested_class: 'Grade 3', campus_id: allCampuses[1]?.id },
        { parent_name: 'Demo parent C', parent_phone: '+255712345003', source: 'referral',      child_name: 'Child C', interested_class: 'Form 1',  campus_id: allCampuses[2]?.id },
        { parent_name: 'Demo parent D', parent_phone: '+255712345004', source: 'radio_campaign', child_name: 'Child D', interested_class: 'Grade 5', campus_id: allCampuses[0]?.id },
        { parent_name: 'Demo parent E', parent_phone: '+255712345005', source: 'billboard',     child_name: 'Child E', interested_class: 'Nursery', campus_id: allCampuses[3]?.id },
      ];

      for (const lead of sampleLeads) {
        if (!lead.campus_id) continue;
        await db.query(
          `INSERT INTO marketing_leads
             (campus_id, created_by, parent_name, parent_phone, source, child_name, interested_class)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [lead.campus_id, globalMktUser.id, lead.parent_name, lead.parent_phone,
           lead.source, lead.child_name, lead.interested_class]
        ).catch(() => {}); // ignore duplicates
      }
      console.log(`  📋 Sample leads inserted`);
    }

    // ── Demo students only (SE/dispensary FKs). Enrolled children live in Ed Admin. ──
    const { rows: studentCount } = await db.query('SELECT COUNT(*) FROM students');
    if (studentCount[0].count === '0' && allCampuses.length) {
      const sampleStudents = [
        { first_name: 'Demo', last_name: 'Child A', class_name: 'Grade 1', parent_name: 'Demo parent A', parent_phone: '+255712345001' },
        { first_name: 'Demo', last_name: 'Child B', class_name: 'Grade 3', parent_name: 'Demo parent B', parent_phone: '+255712345002' },
        { first_name: 'Demo', last_name: 'Child C', class_name: 'Form 1',  parent_name: 'Demo parent C', parent_phone: '+255712345003' },
        { first_name: 'Demo', last_name: 'Child D', class_name: 'Grade 5', parent_name: 'Demo parent D', parent_phone: '+255712345004' },
        { first_name: 'Demo', last_name: 'Child E', class_name: 'Nursery', parent_name: 'Demo parent E', parent_phone: '+255712345005' },
        { first_name: 'Demo', last_name: 'Child F', class_name: 'Grade 2', parent_name: 'Demo parent F', parent_phone: '+255712345006' },
      ];

      for (const campus of allCampuses) {
        for (const student of sampleStudents) {
          await db.query(
            `INSERT INTO students (campus_id, first_name, last_name, class_name, parent_name, parent_phone)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [campus.id, student.first_name, student.last_name, student.class_name,
             student.parent_name, student.parent_phone]
          ).catch(() => {});
        }
      }
      console.log(`  🎓 Sample students inserted (${allCampuses.length * sampleStudents.length})`);
    }

    // ── Sample drug inventory ─────────────────────────────────
    const { rows: cats } = await db.query("SELECT id FROM drug_categories WHERE name = 'Pain Relief' LIMIT 1");
    if (cats.length && allCampuses.length) {
      const sampleDrugs = ['Paracetamol 500mg', 'Ibuprofen 400mg', 'Amoxicillin 250mg', 'Chlorphenamine', 'ORS Sachets'];
      for (const campus of allCampuses) {
        for (const drug of sampleDrugs) {
          await db.query(
            `INSERT INTO drug_inventory
               (campus_id, category_id, drug_name, quantity, unit, minimum_stock, expiry_date)
             VALUES ($1, $2, $3, $4, 'tablets', 20, $5)
             ON CONFLICT DO NOTHING`,
            [campus.id, cats[0].id, drug, Math.floor(Math.random() * 200) + 50,
             new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)]
          ).catch(() => {});
        }
      }
      console.log(`  💊 Sample drug inventory inserted`);
    }

    console.log(`\n🎉 Seed complete — ${created} users created, ${skipped} skipped (already exist)`);
    console.log(`\n📋 Default login password: ${DEFAULT_PASSWORD}`);
    console.log(`   All users must change password on first login.\n`);

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
