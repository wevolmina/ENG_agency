import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Local development only. Does not contact Aiven, Vercel or Firebase.
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = path.join(root, '.qa/local-mysql');
const configPath = path.join(dir, 'connection.json');
const composePath = path.join(dir, 'compose.json');
const command = process.argv[2] || 'help';
if (!['up', 'down', 'info', 'status', 'help'].includes(command)) {
  console.error('사용법: node scripts/local-mysql.mjs up|down|info|status');
  process.exit(1);
}
if (command === 'help') {
  console.log('Docker Desktop을 켠 뒤 저장소 루트에서 실행하세요.\nnode scripts/local-mysql.mjs up     # DB와 웹 관리 화면 시작\nnode scripts/local-mysql.mjs info   # 로컬 접속 정보\nnode scripts/local-mysql.mjs status # 상태 확인\nnode scripts/local-mysql.mjs down   # 중지, 데이터 보존');
  process.exit(0);
}
const exists = async p => {try {await access(p); return true;} catch {return false;}};
const docker = args => spawnSync('docker', args, {cwd: root, stdio: 'inherit', shell: false});
if (command === 'up' && docker(['info', '--format', '{{.ServerVersion}}']).status !== 0) {
  console.error('Docker Desktop을 실행하고 엔진 시작이 끝난 뒤 다시 실행하세요.');
  process.exit(1);
}
if (!(await exists(configPath))) {
  if (command !== 'up') {console.error('먼저 node scripts/local-mysql.mjs up 을 실행하세요.'); process.exit(1);}
  await mkdir(dir, {recursive: true});
  await writeFile(configPath, JSON.stringify({password: randomBytes(24).toString('hex'), rootPassword: randomBytes(32).toString('hex')}, null, 2), {mode: 0o600, flag: 'wx'});
}
const secrets = JSON.parse(await readFile(configPath, 'utf8'));
if (command === 'up') {
  const compose = {name: 'paybridge-local', services: {
    mysql: {image: 'mysql:8.4', restart: 'no', mem_limit: '512m',
      command: ['--innodb-buffer-pool-size=128M', '--max-connections=25', '--performance-schema=OFF'],
      environment: {MYSQL_ROOT_PASSWORD: secrets.rootPassword, MYSQL_DATABASE: 'payment_bridge_local', MYSQL_USER: 'paybridge', MYSQL_PASSWORD: secrets.password},
      ports: ['127.0.0.1:3307:3306'],
      volumes: ['mysql-data:/var/lib/mysql', {type: 'bind', source: path.join(root, 'database'), target: '/docker-entrypoint-initdb.d', read_only: true}],
      healthcheck: {test: ['CMD-SHELL', 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT 1 FROM payments LIMIT 0; SELECT 1 FROM orders LIMIT 0; SELECT 1 FROM order_items LIMIT 0"'], interval: '5s', timeout: '5s', retries: 30, start_period: '30s'}},
    adminer: {image: 'adminer:5', restart: 'no', mem_limit: '128m', ports: ['127.0.0.1:8081:8080'], environment: {ADMINER_DEFAULT_SERVER: 'mysql'}, depends_on: {mysql: {condition: 'service_healthy'}}}
  }, volumes: {'mysql-data': {}}};
  // Compose interpolates $; $$ preserves the container's environment references.
  compose.services.mysql.healthcheck.test[1] = compose.services.mysql.healthcheck.test[1].replaceAll(';
  await writeFile(composePath, JSON.stringify(compose, null, 2), {mode: 0o600});
}
if (command !== 'info') {
  const actions = {up: ['up', '-d', '--wait', '--wait-timeout', '240'], down: ['down'], status: ['ps']};
  const result = docker(['compose', '-f', composePath, ...actions[command]]);
  if (result.status !== 0) {console.error('Docker 실행에 실패했습니다. Docker Desktop과 포트 3307/8081을 확인하세요.'); process.exit(1);}
}
if (command === 'up') {
  const appEnv = path.join(root, 'apps/merchant/.env.local');
  const backup = path.join(root, 'apps/merchant/.env.local.before-docker');
  const existing = await exists(appEnv) ? await readFile(appEnv, 'utf8') : await readFile(path.join(root, 'apps/merchant/.env.local.example'), 'utf8');
  if (await exists(appEnv) && !(await exists(backup))) await writeFile(backup, existing, {mode: 0o600, flag: 'wx'});
  const values = {MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3307', MYSQL_USER: 'paybridge', MYSQL_PASSWORD: secrets.password, MYSQL_DATABASE: 'payment_bridge_local', MYSQL_TLS: 'false', MYSQL_CA_BASE64: ''};
  let updated = existing.replace(/^(?:export\s+)?MYSQL_(?:HOST|PORT|USER|PASSWORD|DATABASE|TLS|CA_BASE64)\s*=.*\r?\n?/gm, '');
  updated = updated.trimEnd() + '\n\n# Local Docker MySQL\n' + Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  await writeFile(appEnv, updated, {mode: 0o600});
  console.log('로컬 DB 설정을 저장했습니다: apps/merchant/.env.local');
}
if (command === 'up' || command === 'info') {
  console.log(`\n로컬 DB 관리 화면: http://127.0.0.1:8081\n시스템: MySQL\n서버: mysql\n사용자: paybridge\n비밀번호: ${secrets.password}\n데이터베이스: payment_bridge_local\n\nPC 프로그램 연결: 127.0.0.1:3307\n운영 Aiven 데이터는 복사되지 않습니다. 로컬 DB는 처음에 빈 테이블입니다.\n로컬 판매자 실행: npm run dev:merchant\nFirebase 설정이 비어 있으면 기존 프로젝트 설정을 먼저 채우세요.\n종료: node scripts/local-mysql.mjs down (데이터 보존)`);
}
, () => '$');
  await writeFile(composePath, JSON.stringify(compose, null, 2), {mode: 0o600});
}
if (command !== 'info') {
  const actions = {up: ['up', '-d', '--wait', '--wait-timeout', '240'], down: ['down'], status: ['ps']};
  const result = docker(['compose', '-f', composePath, ...actions[command]]);
  if (result.status !== 0) {console.error('Docker 실행에 실패했습니다. Docker Desktop과 포트 3307/8081을 확인하세요.'); process.exit(1);}
}
if (command === 'up') {
  const appEnv = path.join(root, 'apps/merchant/.env.local');
  const backup = path.join(root, 'apps/merchant/.env.local.before-docker');
  const existing = await exists(appEnv) ? await readFile(appEnv, 'utf8') : await readFile(path.join(root, 'apps/merchant/.env.local.example'), 'utf8');
  if (await exists(appEnv) && !(await exists(backup))) await writeFile(backup, existing, {mode: 0o600, flag: 'wx'});
  const values = {MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3307', MYSQL_USER: 'paybridge', MYSQL_PASSWORD: secrets.password, MYSQL_DATABASE: 'payment_bridge_local', MYSQL_TLS: 'false', MYSQL_CA_BASE64: ''};
  let updated = existing.replace(/^(?:export\s+)?MYSQL_(?:HOST|PORT|USER|PASSWORD|DATABASE|TLS|CA_BASE64)\s*=.*\r?\n?/gm, '');
  updated = updated.trimEnd() + '\n\n# Local Docker MySQL\n' + Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  await writeFile(appEnv, updated, {mode: 0o600});
  console.log('로컬 DB 설정을 저장했습니다: apps/merchant/.env.local');
}
if (command === 'up' || command === 'info') {
  console.log(`\n로컬 DB 관리 화면: http://127.0.0.1:8081\n시스템: MySQL\n서버: mysql\n사용자: paybridge\n비밀번호: ${secrets.password}\n데이터베이스: payment_bridge_local\n\nPC 프로그램 연결: 127.0.0.1:3307\n운영 Aiven 데이터는 복사되지 않습니다. 로컬 DB는 처음에 빈 테이블입니다.\n로컬 판매자 실행: npm run dev:merchant\nFirebase 설정이 비어 있으면 기존 프로젝트 설정을 먼저 채우세요.\n종료: node scripts/local-mysql.mjs down (데이터 보존)`);
}
