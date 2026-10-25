# 페이브릿지 직접 배포 안내서

작성 기준: **2026-10-25, 한국 시간**. Windows 11의 **Git Bash**에서 실행하는 순서입니다. 명령어를 한 줄씩 실행하고, 오류가 나면 해당 단계에서 멈추세요.

이미 운영 중인 고객·판매자 서비스에 UI/UX 개선과 관리자 사이트 분리를 반영하는 방법입니다. 새 Firebase 프로젝트나 MySQL 데이터베이스를 만들 필요가 없습니다.

## 1. 현재 상태와 전체 순서

| 항목 | 현재 상태 |
| --- | --- |
| 소스 저장소 | [wevolmina/paybridge-mock](https://github.com/wevolmina/paybridge-mock) |
| 수정 브랜치 | `feat/admin-cloudflare-ui-release` |
| 병합 요청 | [PR #1](https://github.com/wevolmina/paybridge-mock/pull/1), 작성 시점에는 미병합 |
| 고객 주소 | https://paybridge-mock.web.app |
| 판매자 주소 | https://paybridge-mock.vercel.app |
| 새 관리자 주소 | Cloudflare 배포 후 결정. 아직 확정하지 않음 |
| 이번 변경의 운영 배포 | 미완료. 로컬 검증과 운영 배포 성공은 별개 |

**코드 받기 → 공개 설정 입력 → Cloudflare 관리자 배포 → 연결 설정 → PR 병합 → Vercel 판매자·API 배포 → Firebase 고객 배포 → 화면 확인** 순서입니다.

관리자 사이트부터 준비하는 이유는 기존 판매자 주소의 `/admin`이 새 관리자 주소로 이동하도록 바뀌기 때문입니다. 관리자 배포 전에는 PR을 먼저 병합하지 마세요.

| 화면·기능 | 배포 위치 | 소스 |
| --- | --- | --- |
| 고객 상품·장바구니·영수증 | Firebase Hosting | `apps/customer` |
| 판매자 화면 | Vercel | `apps/merchant` |
| 관리자 화면 | Cloudflare Workers Static Assets | `apps/admin` |
| 주문·판매자·관리자 API | 기존 Vercel 서버 | `apps/merchant/app/api` |
| 공통 화면 코드 | 각 앱을 만들 때 함께 포함 | `packages/staff-ui` |

API(Application Programming Interface)는 화면과 서버가 데이터를 주고받는 통로입니다. 관리자 **화면만** Cloudflare로 옮깁니다. 로그인 검증과 MySQL 연결은 Vercel에 유지합니다. Firestore는 주문 요청, MySQL은 확정 주문·결제를 담당합니다.

## 2. 프로그램 준비와 소스 받기

필요한 프로그램은 Git, Node.js **22.x**, VS Code입니다. Cloudflare·Vercel·Firebase는 기존 프로젝트를 배포할 수 있는 계정을 사용합니다. 소스는 `feed-mina/ME`가 아니라 **`wevolmina/paybridge-mock`**에 있습니다.

Git Bash에서 버전을 확인합니다.

```bash
git --version
node --version
npm --version
```

`node --version`이 `v22.`로 시작하는지 확인합니다. 설치·버전 변경 후 터미널을 다시 여세요.

기존 작업을 덮어쓰지 않도록 새 폴더로 받습니다. 아래 폴더 이름이 이미 있으면 다른 새 이름을 사용하세요.

```bash
cd ~/Documents
git clone --branch feat/admin-cloudflare-ui-release https://github.com/wevolmina/paybridge-mock.git paybridge-release
cd paybridge-release
git branch --show-current
npm ci
```

성공 기준: 브랜치가 `feat/admin-cloudflare-ui-release`이며 `npm ci`가 오류 없이 끝납니다. VS Code에서 `paybridge-release` 폴더를 엽니다. 이후 별도 안내가 없으면 `package.json`이 있는 **이 최상위 폴더**에서 명령을 실행합니다.

이미 PR을 병합하고 브랜치를 삭제했다면 기본 `main`을 받으면 됩니다. 단, `apps/admin`과 `packages/staff-ui`가 들어 있는지 먼저 확인하세요.

## 3. Firebase 공개 설정 입력

Firebase Console → 기존 `paybridge-mock` 프로젝트 → 프로젝트 설정 → 일반 → 기존 웹 앱 → SDK 설정에서 `apiKey`, `authDomain`, `projectId`, `appId`를 확인합니다. 기존 값을 사용하며 새 프로젝트·웹 앱을 만들지 않습니다.

SDK(Software Development Kit)는 앱에서 Firebase 기능을 사용하도록 도와주는 도구 모음입니다. 웹 앱 공개 설정과 서비스 계정의 비공개 키는 다른 것입니다.

파일이 **아직 없을 때만** 다음을 실행합니다. 이미 있다면 VS Code에서 내용을 확인·수정하세요.

```bash
cp apps/customer/.env.example apps/customer/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

`apps/customer/.env.local`:

```dotenv
VITE_FIREBASE_API_KEY=기존_웹앱의_apiKey
VITE_FIREBASE_AUTH_DOMAIN=기존_웹앱의_authDomain
VITE_FIREBASE_PROJECT_ID=paybridge-mock
VITE_FIREBASE_APP_ID=기존_웹앱의_appId
VITE_USE_EMULATORS=false
```

`apps/admin/.env.local`:

```dotenv
VITE_FIREBASE_API_KEY=고객과_같은_apiKey
VITE_FIREBASE_AUTH_DOMAIN=고객과_같은_authDomain
VITE_FIREBASE_PROJECT_ID=paybridge-mock
VITE_FIREBASE_APP_ID=고객과_같은_appId
VITE_STAFF_API_ORIGIN=https://paybridge-mock.vercel.app
```

오른쪽 한글 설명을 실제 값으로 바꾸고 저장합니다. `.env.local.txt`가 아닌 **`.env.local`**이어야 합니다. `VITE_` 값은 브라우저 파일에 포함되므로 MySQL 비밀번호·Firebase 비공개 키·서비스 계정 JSON을 넣지 마세요.

현재 고객 앱의 API와 판매자 메뉴 주소는 소스에서 `https://paybridge-mock.vercel.app`으로 고정되어 있습니다. 기존 Vercel 프로젝트·주소를 유지하세요. 다른 주소를 쓰려면 고객 코드의 관련 주소도 수정하고 다시 빌드해야 합니다.

## 4. Cloudflare 관리자 배포

### 4-1. PC의 배포 도구 인증

```bash
cd apps/admin
npx wrangler login
npx wrangler whoami
cd ../..
```

Wrangler는 Cloudflare 배포 도구입니다. 열린 브라우저에서 기존 Cloudflare 계정으로 로그인하고 표시된 권한 요청을 확인합니다. `whoami` 결과에서 사용할 계정이 맞는지 확인하세요. 계정이 여러 개라면 실제 대상을 확인한 후 진행합니다. 계정 선택 오류가 발생하면 Wrangler 안내에 따라 해당 계정의 `account_id`를 `apps/admin/wrangler.jsonc`에 지정합니다.

**대시보드에 로그인하는 것과 터미널의 Wrangler 인증은 별개입니다.** 터미널도 인증되어야 합니다.

### 4-2. 빌드하고 게시

최상위 폴더에서 실행합니다.

```bash
npm run deploy:admin
```

이 명령은 TypeScript 검사 → 관리자 빌드 → Cloudflare 업로드를 실행합니다. 설정은 `apps/admin/wrangler.jsonc`, Worker 이름은 `paybridge-admin`, 업로드 파일은 `apps/admin/dist`입니다. 별도로 `wrangler init`을 하거나 Pages 프로젝트를 만들 필요가 없습니다.

같은 이름의 Worker가 이미 있다면 해당 프로젝트가 맞는지 먼저 확인하세요. 완료 후 터미널이 출력하는 **실제 HTTPS 운영 URL**을 메모합니다. 계정명을 추측해서 주소를 만들지 마세요.

```text
관리자 실제 주소: ___________________________________
```

이 주소에서 관리자 로그인 화면이 열리면 화면 배포는 된 것입니다. Vercel 연결 전에는 로그인 후 자료 조회가 실패할 수 있습니다. 아직 전체 완료는 아닙니다.

## 5. Vercel 설정과 Firebase 도메인 연결

### 5-1. 기존 Vercel 프로젝트 확인

Vercel 대시보드에서 **현재 `paybridge-mock.vercel.app`을 제공하는 기존 프로젝트**를 선택합니다. 새 프로젝트를 만들지 않습니다. Settings에서 다음을 확인합니다. 화면 개편에 따라 메뉴 이름은 조금 다를 수 있습니다.

| 설정 | 값 |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `apps/merchant` |
| Root Directory 밖 소스 포함 | 켬. `packages/staff-ui`와 `functions/src/domain.ts` 필요 |
| Node.js | 22.x |
| Install Command | `npm install --prefix ../..` |
| Build Command | `npm run build --workspace @bridge/merchant --prefix ../..` |
| Output Directory | Next.js 기본값 유지 |

설치·빌드 명령은 `apps/merchant/vercel.json`에도 있습니다. 대시보드가 다른 명령으로 덮어쓰고 있다면 위 값과 일치시키세요. 공유 코드가 있으므로 `apps/merchant`만 따로 업로드하면 안 됩니다.

### 5-2. 두 환경 변수 저장

Settings → Environment Variables에서 **Production** 대상으로 다음 두 값을 추가합니다. 둘 다 4단계의 **같은 실제 관리자 주소**입니다.

```dotenv
ADMIN_SITE_ORIGIN=https://실제_관리자_호스트
NEXT_PUBLIC_ADMIN_SITE_URL=https://실제_관리자_호스트
```

Origin은 `https://`와 호스트를 합한 주소입니다. `/admin` 같은 경로, 물음표, `*`를 붙이지 않습니다. `https://paybridge-admin.계정명.workers.dev`는 형태를 보여주는 예시일 뿐입니다. 실제 배포 결과를 입력하세요.

기존 운영 환경 변수는 유지합니다.

| 기존 변수 | 내용 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | 기존 Firebase 웹 앱 공개 설정 |
| `FIREBASE_PROJECT_ID` | `paybridge-mock` |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | 기존 운영 Aiven MySQL 접속 정보 |
| `MYSQL_TLS`, `MYSQL_CA_BASE64` | 기존 검증 가능한 TLS 연결 유지. 운영에서는 `MYSQL_TLS=false` 금지 |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | 기존에 사용 중이면 서버 전용 값 유지. 공개 변수·관리자 앱에 복사하지 않음 |

PC의 `.env.local` 수정만으로 Vercel 원격 설정이 바뀌지 않습니다. 대시보드에 저장한 후 **새 배포**해야 적용됩니다. 이번 화면 배포에는 DB 마이그레이션·DB 복사·계정 역할 재부여·Functions 배포·`SYNC_SHARED_SECRET` 설정이 필요하지 않습니다.

### 5-3. Firebase 승인 도메인

Firebase Console → `paybridge-mock` → Authentication → Settings → Authorized domains에서 기존 목록을 유지하고 **새 관리자 호스트**를 추가합니다. 이 칸에는 `https://` 없이 호스트만 넣습니다.

```text
paybridge-admin.실제계정명.workers.dev
```

웹 API 키에 HTTP referrer 제한을 걸어 둔 경우 Google Cloud Console의 해당 기존 키 설정에도 실제 관리자 사이트를 허용합니다. 제한이 없다면 이번 작업 때문에 새 키를 만들 필요는 없습니다. 현재 이메일·비밀번호 인증 외에 추후 팝업·리디렉션 인증을 사용할 때도 도메인 등록이 필요합니다.

저장소의 `firebase.json` → `auth.authorizedDomains`에도 이후 실제 호스트를 추가해 기록을 일치시키세요. 파일 수정은 다음 단계에서 `main`으로 전환한 뒤 진행하면 됩니다. **이번에는 `--only auth`를 실행하지 않습니다.**

## 6. PR 병합과 최신 main 받기

관리자 화면이 열리고 Vercel 환경 변수를 저장했다면 [PR #1](https://github.com/wevolmina/paybridge-mock/pull/1)을 엽니다. 변경 파일 확인 → **Merge pull request → Confirm merge**로 병합합니다. 이미 병합됐다면 반복하지 않습니다.

Git Bash에서 최신 `main`을 받습니다.

```bash
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
git log -1 --oneline
```

수정된 추적 파일이 보이면 변경부터 보관하세요. `reset --hard`나 강제 덮어쓰기로 해결하지 않습니다. `.env.local`은 Git에서 제외되어 정상적인 브랜치 전환 때 유지됩니다.

**중요: `apps/merchant/vercel.json`의 `git.deploymentEnabled`가 `false`입니다.** main에 병합해도 Vercel 자동 Git 배포는 실행되지 않습니다. 아래 CLI 배포를 진행하세요.

## 7. Vercel 판매자·API 수동 배포

최상위 폴더에서 실행합니다. CLI(Command Line Interface)는 터미널에서 명령어로 서비스를 조작하는 방식입니다.

```bash
npx vercel login
npx vercel link
```

연결 질문에서 기존 운영 프로젝트가 속한 계정·팀 → **기존 프로젝트에 연결**을 선택합니다. `paybridge-mock.vercel.app`을 제공하는 프로젝트인지 대시보드와 대조하세요. 새 프로젝트 생성은 선택하지 않습니다. 잘못 연결했다면 배포하지 말고 `vercel link`를 다시 실행해 바로잡습니다.

연결 후 최상위에 `.vercel/project.json`이 생깁니다. 다음 명령으로 운영 배포합니다.

```bash
npx vercel --prod
```

저장소 전체를 대상으로 업로드하되 원격 Root Directory는 `apps/merchant`여야 합니다. `--prod`는 실제 운영 도메인에 반영하는 옵션입니다. 예전 배포의 Redeploy만 누르면 예전 소스가 다시 배포될 수 있으므로 이번에는 최신 main을 받은 폴더에서 실행하세요.

성공 기준: Vercel 상태가 **Ready**, 운영 도메인은 기존 `paybridge-mock.vercel.app`입니다. 이 주소의 `/admin`을 열면 새 Cloudflare 주소로 이동해야 합니다. 이동은 되는데 조회가 실패하면 5단계의 주소 변수와 최신 배포 적용 여부를 확인합니다.

## 8. Firebase 고객 화면 배포

최상위 폴더에서 실행합니다.

```bash
npx firebase-tools login
npx firebase-tools projects:list
npm run build --workspace @bridge/customer
npx firebase-tools deploy --only hosting --project paybridge-mock
```

`projects:list`에서 `paybridge-mock`에 접근 가능한지 확인합니다. 빌드 실패 시 마지막 배포 명령은 실행하지 않습니다. 성공 후 고객 주소는 기존 `https://paybridge-mock.web.app`입니다.

이번에는 **`--only hosting`**으로 고객 화면만 배포합니다. 루트의 `npm run deploy:firebase`는 Firestore·Auth도 대상으로 하므로 이 안내에서는 사용하지 않습니다. `firebase init`과 Functions 배포도 필요하지 않습니다.

## 9. 완료 확인

새 브라우저 창에서 기존 계정으로 확인합니다. Firebase 로그인만으로 관리자 권한이 생기지는 않습니다. 서버가 DB의 활성 직원 역할을 추가 확인합니다.

| 확인 | 성공 기준 |
| --- | --- |
| 고객 | 기존 주소에서 새 화면이 열림. 공간 바로가기·선택 수·합계가 맞음 |
| 판매자 | 기존 주소에서 로그인·본인 거래 조회 가능 |
| 관리자 | 새 Cloudflare 주소에서 기존 관리자 계정으로 자료 조회 가능 |
| 기존 관리자 주소 | Vercel `/admin`이 새 Cloudflare 주소로 이동 |
| 권한 | 일반 판매자·비로그인 사용자는 관리자 자료 조회 불가 |
| 로그인 분리 | 관리자 로그아웃 후 판매자 사이트 로그인은 유지 |
| 움직임 | 좁은 화면도 가로 넘침이 없고 새 변화가 있을 때만 강조 |

개발자 도구의 Network에서 관리자 `/api/admin/overview`가 Vercel로 요청되는지 볼 수 있습니다. CORS(Cross-Origin Resource Sharing)는 서로 다른 사이트 간 브라우저 연결 규칙입니다. 주소 허용과 로그인·역할 검사는 각각 통과해야 합니다.

연결 규칙만 검사하려면 아래 Origin을 **실제 관리자 주소로 바꿔** Git Bash에서 실행합니다. 주문이나 DB 변경을 만들지 않습니다.

```bash
curl -i -X OPTIONS 'https://paybridge-mock.vercel.app/api/admin/overview' \
  -H 'Origin: https://실제_관리자_호스트' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization'
```

예상 결과는 `204`, 그리고 실제 관리자 Origin과 같은 `Access-Control-Allow-Origin` 헤더입니다. 아래처럼 로그인 토큰 없이 조회하면 `403`이 정상입니다.

```bash
curl -i 'https://paybridge-mock.vercel.app/api/admin/overview'
```

이 두 검사만으로 실제 관리자 로그인·DB 조회까지 성공했다고 보지는 않습니다. 전체 주문 흐름을 시험하려고 모의 결제를 누르면 운영 Firestore·MySQL에 데모 주문이 생기므로 단순 화면 확인과 구분하세요.

현재 패키지 변경 API 입력은 `bedroom-lighting`만 허용합니다. 다른 공간 카드의 변경까지 운영에서 성공한다고 검증된 상태는 아닙니다. 배포 성공과 이 기존 기능 제한을 구분하세요.

## 10. 오류 해결

| 증상 | 확인·해결 순서 |
| --- | --- |
| `Missing script: deploy:admin` | 최상위 폴더인지, 작업 브랜치 또는 병합된 최신 main인지 확인 |
| `@bridge/staff-ui`를 못 찾음 | 전체 저장소 확인 → 루트 `npm ci` → Vercel 바깥 소스 포함 옵션 확인 |
| Cloudflare 인증 실패 | `apps/admin`에서 `npx wrangler whoami` → 필요 시 `npx wrangler login`. 브라우저 로그인과 CLI 인증은 별개 |
| Cloudflare 계정 선택 오류 | 실제 대상 계정 확인 후 Wrangler 안내에 따라 `account_id` 지정 |
| 관리자 조회 실패 | `VITE_STAFF_API_ORIGIN` → Vercel의 두 관리자 주소 → 최신 Vercel 배포 순서로 확인 |
| CORS 오류 | Vercel `ADMIN_SITE_ORIGIN`과 주소창 Origin 비교. Preview URL과 운영 URL 혼동 주의 |
| `/admin`이 예전 화면 | Vercel 최신 배포 확인. main 병합만으로는 자동 배포되지 않음 |
| `auth/invalid-api-key`·설정 누락 | Firebase 웹 설정 확인 후 해당 앱 다시 빌드·배포 |
| `auth/unauthorized-domain` | Firebase 승인 도메인·API 키 웹사이트 제한 확인 |
| 로그인 후 403 | 기존 계정의 활성 상태와 DB 직원 역할 확인. CORS를 `*`로 바꿔 해결하지 않기 |
| API 500·DB 오류 | Vercel Logs에서 기존 MYSQL 설정·CA 인증서·Aiven 상태 확인. 운영 TLS를 끄지 않기 |
| `npm run check:deploy` 실패 | 기존 점검기는 로컬 판매자 env·`.vercel` 등만 검사. 원격 변수·관리자·실제 배포 성공 검사가 아님 |
| tsx의 테스트 실행 오류 | 필요 시 아래 동등한 단위 테스트 명령 사용. 빌드 오류와는 별개 |

```bash
node --import tsx --test tests/*.test.ts
```

오류 로그를 공유할 때 비밀번호·토큰·비공개 키·서비스 계정 JSON을 가리세요. 오류 해결을 위해 DB를 초기화할 필요는 없습니다.

## 11. 다음 변경부터 다시 배포하는 법

최초 연결·PR 병합 이후에 사용합니다. 세 사이트가 한 번에 자동 갱신되는 구조는 아닙니다.

| 변경한 부분 | 다시 할 작업 |
| --- | --- |
| 고객 `apps/customer` | 고객 빌드 + Firebase Hosting 배포 |
| 판매자·API `apps/merchant` | 최신 main에서 `npx vercel --prod` |
| 관리자 `apps/admin` | `npm run deploy:admin` |
| 공통 `packages/staff-ui` | 관리자와 판매자 **둘 다** 재배포 |
| `VITE_`·`NEXT_PUBLIC_` 변수 | 해당 앱 다시 빌드·배포 |
| 관리자 운영 도메인 | Vercel 두 주소·Firebase 승인 도메인·설정 파일 기록 함께 변경 |

로컬 수정부터 확인하고 최신 main을 받습니다.

```bash
git status --short
git switch main
git pull --ff-only origin main
npm ci
```

고객만 다시 배포:

```bash
npm run build --workspace @bridge/customer
npx firebase-tools deploy --only hosting --project paybridge-mock
```

판매자·API만 다시 배포:

```bash
npx vercel --prod
```

관리자만 다시 배포:

```bash
npm run deploy:admin
```

문제가 생기면 마지막 정상 배포를 기준으로 되돌립니다. Firebase Hosting은 릴리스 기록, Vercel은 배포 기록에서 이전 정상 버전을 선택할 수 있습니다. Cloudflare는 Workers 배포·버전 기록의 사용 가능한 롤백을 확인하거나 이전 소스를 다시 빌드해 배포합니다. Git에서 이전 소스를 선택하기 전에도 로컬 수정부터 보관하세요. 배포를 되돌려도 DB 주문이 자동 삭제되지는 않습니다. 관리자 분리 전 Vercel 코드로 돌아가면 기존 `/admin` 동작도 함께 돌아갑니다.

## 12. 검증 범위와 배포 기록

개발 환경에서 단위 테스트 27개, 세 앱 빌드, 실제 업로드 없는 Cloudflare 사전 검사(dry-run), 역할별 모션·로그인 분리·CORS 브라우저 검증을 통과했습니다. 시험용 API 응답을 사용한 UI 검증을 포함합니다. 실행 환경은 Node.js 24였으며 권장 Node.js 22 재실행, 실제 운영 계정의 관리자 권한·DB 변경·이번 세 서비스의 운영 배포는 별도 확인 대상입니다.

아래 칸은 직접 배포한 결과로 채웁니다. 빈칸을 성공으로 해석하지 않습니다.

| 기록 항목 | 직접 입력 |
| --- | --- |
| 배포 날짜·시간(KST) | |
| main 커밋(`git log -1 --oneline`) | |
| 관리자 실제 URL·Cloudflare 버전 | |
| Vercel 배포 URL·Ready 확인 | |
| Firebase Hosting 완료 | |
| 관리자 로그인·조회 | |
| 기존 `/admin` 이동 | |
| 남은 오류 | |

## 공식 참고

- [Cloudflare 정적 파일 배포](https://developers.cloudflare.com/workers/static-assets/get-started/)
- [Cloudflare 단일 페이지 앱 라우팅](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Vercel 모노레포](https://vercel.com/docs/monorepos)
- [Vercel CLI 운영 배포](https://vercel.com/docs/cli/deploy)
- [Firebase Hosting 시험·운영 배포](https://firebase.google.com/docs/hosting/test-preview-deploy)
