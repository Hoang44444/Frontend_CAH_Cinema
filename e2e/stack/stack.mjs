// Bật/tắt stack E2E: `node e2e/stack/stack.mjs up|down`.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STACK_DIR = dirname(fileURLToPath(import.meta.url));
const CLONE_ROOT = join(STACK_DIR, '..', '.stack');
const BACKEND_DIR = join(CLONE_ROOT, 'backend');
const BACKEND_REPO = 'https://github.com/MHoang26ct/Backend_CAH_Cinema.git';
const BACKEND_REF = process.env.E2E_BACKEND_REF ?? 'main';
const HEALTH_URL = 'http://localhost:8081/api/v1/public/genres/all';
const HEALTH_TIMEOUT_MS = 180_000;

const compose = ['compose', '-f', join(STACK_DIR, 'docker-compose.yml')];

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

/** Luôn build từ một bản clone riêng, không dùng working copy backend của dev. */
function syncBackend() {
  mkdirSync(CLONE_ROOT, { recursive: true });
  if (!existsSync(join(BACKEND_DIR, '.git'))) {
    run('git', ['clone', '--depth', '1', '--branch', BACKEND_REF, BACKEND_REPO, BACKEND_DIR]);
    return;
  }
  run('git', ['-C', BACKEND_DIR, 'fetch', '--depth', '1', 'origin', BACKEND_REF]);
  run('git', ['-C', BACKEND_DIR, 'reset', '--hard', 'FETCH_HEAD']);
}

async function waitForBackend() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) return;
    } catch {
      // Backend chưa lên.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  run('docker', [...compose, 'logs', '--tail', '60', 'backend']);
  throw new Error(`Backend không phản hồi ở ${HEALTH_URL}`);
}

async function up() {
  if (process.env.E2E_SKIP_BACKEND_SYNC !== '1') syncBackend();
  run('docker', [...compose, 'up', '-d', '--force-recreate', '--renew-anon-volumes', '--wait', 'postgres', 'redis']);
  run('docker', [...compose, 'up', '-d', '--build', '--force-recreate', '--no-deps', 'backend']);
  await waitForBackend();
  console.log(`Stack E2E đã sẵn sàng: ${HEALTH_URL}`);
}

function down() {
  run('docker', [...compose, 'down', '--volumes', '--remove-orphans']);
}

const action = process.argv[2];
if (action === 'up') {
  await up();
} else if (action === 'down') {
  down();
} else {
  console.error('Cách dùng: node e2e/stack/stack.mjs up|down');
  process.exit(1);
}
