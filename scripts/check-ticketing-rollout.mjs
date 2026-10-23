import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
const config = await readFile(path.join(root, 'supabase', 'config.toml'), 'utf8');
const projectRef = config.match(/^project_id\s*=\s*"([a-z0-9]+)"/m)?.[1];
if (!projectRef) throw new Error('project_id is missing from supabase/config.toml');

function run(args) {
  try {
    const output = execFileSync(process.execPath, [cli, ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 60_000,
    });
    const jsonStart = output.indexOf('{');
    if (jsonStart < 0) throw new Error('Supabase CLI returned no JSON');
    return JSON.parse(output.slice(jsonStart));
  } catch {
    throw new Error(`Supabase read-only check failed: ${args.slice(0, 2).join(' ')}`);
  }
}

const migrations = run(['migration', 'list', '--linked']);
const functions = run(['functions', 'list', '--project-ref', projectRef]);
// The CLI response includes secret values. Read it only in memory and report names/presence.
const secrets = run(['secrets', 'list', '--project-ref', projectRef]);

const requiredMigrations = ['20261023000600', '20261023000700'];
const remoteMigrations = new Set((migrations.migrations || []).filter(item => item.remote).map(item => item.remote));
const requiredFunctions = [
  // These floors are the next versions after the linked production baseline observed during implementation.
  ['create-event', 4],
  ['create-manual-ticket-order', 2],
  ['submit-ticket-payment', 4],
  ['finalize-ticket-payment', 2],
  ['admin-list-ticket-payments', 3],
  ['admin-review-ticket-payment', 2],
  ['admin-retry-ticket-verification', 1],
  ['my-orders', 1],
  ['update-event-slipok', 2],
];
const secretNames = new Set((secrets.secrets || []).map(item => item.name));
const requiredSecrets = ['APP_ORIGIN', 'SLIPOK_CREDENTIAL_ENCRYPTION_KEY', 'TICKET_QR_SECRET'];
const checks = [
  ...requiredMigrations.map(id => [
    `migration ${id}`,
    remoteMigrations.has(id),
    remoteMigrations.has(id) ? 'applied' : 'pending',
  ]),
  ...requiredFunctions.map(([slug, minimumVersion]) => {
    const deployed = (functions.functions || []).find(item => item.slug === slug);
    const passed = deployed?.status === 'ACTIVE' && Number(deployed.version) >= minimumVersion;
    const state = !deployed ? 'not deployed'
      : deployed.status !== 'ACTIVE' ? deployed.status
        : Number(deployed.version) < minimumVersion ? `outdated v${deployed.version}; need v${minimumVersion}+`
          : `ACTIVE v${deployed.version}`;
    return [
      `function ${slug}`,
      passed,
      state,
    ];
  }),
  ...requiredSecrets.map(name => [
    `secret ${name}`,
    secretNames.has(name),
    secretNames.has(name) ? 'configured' : 'missing',
  ]),
];

for (const [label, passed, state] of checks) console.log(`${passed ? 'PASS' : 'PENDING'} ${label}: ${state}`);
const pending = checks.filter(([, passed]) => !passed).length;
console.log(`\n${checks.length - pending}/${checks.length} rollout checks passed.`);
if (pending) process.exitCode = 1;
