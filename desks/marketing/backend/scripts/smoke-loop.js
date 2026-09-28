/**
 * Loop engineering: offline security → live HTTP smoke.
 * Re-run after each fix. Exit 0 only when both pass.
 *
 *   npm run test:loop
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAX_ROUNDS = 1;

function run(name, args) {
  console.log(`\n── ${name} ──`);
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  return result.status === 0;
}

async function apiUp() {
  const base = process.env.SMOKE_API_URL || 'http://127.0.0.1:5000/api';
  try {
    const res = await fetch(`${base.replace(/\/api$/, '')}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  let ok = true;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    console.log(`\n======== smoke loop round ${round} ========`);
    const security = run('test:security', ['scripts/smoke-security.js']);
    if (!security) {
      ok = false;
      break;
    }

    if (!(await apiUp())) {
      console.error('\nAPI is not reachable at SMOKE_API_URL / http://127.0.0.1:5000.');
      console.error('Start it with: cd backend && npm run dev');
      process.exit(1);
    }

    const live = run('test:live', ['scripts/smoke-live.js']);
    if (!live) {
      ok = false;
      break;
    }
  }

  if (!ok) {
    console.error('\nSmoke loop failed. Fix the last ✗ and run npm run test:loop again.');
    process.exit(1);
  }
  console.log('\nSmoke loop passed (security + live).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
