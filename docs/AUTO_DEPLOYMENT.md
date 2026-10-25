# 페이브릿지 자동 배포 안내서

기준: **2026-10-25, 한국 시간**. 고객은 Firebase Hosting, 판매자·API는 Vercel, 관리자는 Cloudflare Workers Static Assets를 사용합니다. 기존 프로젝트·DB·도메인을 유지합니다.

**처음 한 번 계정과 배포 권한을 연결하면, 이후에는 코드를 GitHub `main`에 합치는 것으로 배포합니다.** Firebase·Cloudflare는 GitHub Actions, Vercel은 기존 Git 연동을 사용합니다.

## 1. 무엇이 자동으로 실행되나요?

| 변경·행동 | 실행 결과 |
| --- | --- |
| main을 대상으로 PR 생성·수정 | `Paybridge checks`: 비밀값 없이 단위 테스트·세 앱 빌드 |
| main의 고객 코드 변경 | `Deploy customer to Firebase`: 테스트·고객 빌드 → Hosting live 배포 |
| main의 관리자 코드 변경 | `Deploy admin to Cloudflare`: 테스트·관리자 빌드·사전 검사 → Worker 배포 |
| main의 판매자·API 변경 | Vercel Production 자동 빌드·배포 |
| 공통 `packages/staff-ui` 변경 | Firebase·Cloudflare 배포 대상. Vercel에서도 공유 의존성 빌드 여부 확인 |
| 루트 package.json·package-lock.json 변경 | Firebase·Cloudflare 모두 재빌드·배포 |
| 문서만 변경 | Firebase·Cloudflare 배포 생략. Vercel 동작은 프로젝트의 빌드 생략 설정에 따름 |
| 작업 브랜치 변경 | GitHub 검사는 PR에서 실행. Firebase·Cloudflare 운영 배포는 안 함. Vercel은 미리보기 배포 대상 |

세 배포는 독립 실행됩니다. 한 사이트가 실패해도 다른 사이트의 성공이 자동 취소되지 않습니다. 완료 판단도 세 곳을 각각 확인합니다.

CI/CD는 Continuous Integration / Continuous Delivery 또는 Deployment의 줄임말입니다. 여기서는 **코드를 검사하고 사이트에 올리는 작업을 자동 실행하는 방식**을 뜻합니다.

## 2. 현재 반영 상태

| 항목 | 상태 |
| --- | --- |
| 저장소 | [wevolmina/paybridge-mock](https://github.com/wevolmina/paybridge-mock) |
| 병합 상태 | [PR #1](https://github.com/wevolmina/paybridge-mock/pull/1), [PR #2](https://github.com/wevolmina/paybridge-mock/pull/2) 병합 완료. 배포 코드 main: `21073fe` |
| Vercel | Production Ready 확인. 관리자 주소 두 환경 변수 저장 후 재배포 완료 |
| Cloudflare | GitHub Actions 운영 배포 성공. [관리자 화면](https://paybridge-admin.evolvix.workers.dev/) 접속 확인 |
| 관리자 실제 운영 URL | `https://paybridge-admin.evolvix.workers.dev` |
| 고객 Firebase | [세 번째 실행 성공](https://github.com/wevolmina/paybridge-mock/actions/runs/40161796367/attempts/3). [고객 사이트](https://paybridge-mock.web.app/)의 최신 JS·CSS 응답 확인 |

사용자가 GitHub 설정 등록을 진행한 뒤 실제 자동 배포를 실행했습니다. Secret 값을 읽거나 새 키를 생성하지 않았습니다. Cloudflare·Firebase 자동 배포 성공과 Vercel Production Ready를 각각 확인했습니다. Firebase는 서비스 계정 권한 보완 후 세 번째 실행에서 성공했습니다. 사용자 승인 후 Firebase 인증의 승인 도메인에 `paybridge-admin.evolvix.workers.dev`를 추가했고 목록에서 저장 결과를 확인했습니다. `firebase.json` 기록도 맞췄습니다.

## 3. 처음 한 번: GitHub 변수 4개 입력

**대상은 `feed-mina/ME`가 아니라 `wevolmina/paybridge-mock`입니다.** ME는 안내서 보관용이며 그곳에서 배포하지 않습니다.

GitHub → paybridge-mock → **Settings → Secrets and variables → Actions → Variables → New repository variable**에서 입력합니다. Repository variable은 공개 설정을 담는 칸입니다.

| 이름: 그대로 입력 | 값의 출처 |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase 기존 웹 앱의 `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `paybridge-mock.firebaseapp.com` |
| `VITE_FIREBASE_APP_ID` | Firebase 기존 웹 앱의 `appId` |
| `CLOUDFLARE_ACCOUNT_ID` | 관리자를 배포할 Cloudflare 계정의 Account ID. 32자리 값 |

Firebase 공개 설정은 Firebase Console → paybridge-mock → 프로젝트 설정 → 일반 → 기존 웹 앱의 SDK 설정에서 확인합니다. SDK(Software Development Kit)는 Firebase 기능을 앱에서 쓰도록 도와주는 도구 모음입니다. 새 Firebase 프로젝트·웹 앱을 만들지 않습니다.

Cloudflare Account ID는 대상 계정의 대시보드에서 확인합니다. Zone ID·사용자 이메일·Worker 이름과 다릅니다.

워크플로에는 `VITE_FIREBASE_PROJECT_ID=paybridge-mock`, `VITE_STAFF_API_ORIGIN=https://paybridge-mock.vercel.app`을 지정했습니다. 이 두 값은 별도 GitHub 변수 등록이 필요 없습니다. 브라우저용 공개 설정에 DB 비밀번호나 비공개 키를 넣지 않습니다.

## 4. 처음 한 번: GitHub 비밀값 2개 입력

같은 화면의 **Secrets → New repository secret**에서 다음 두 항목을 등록합니다. Secrets는 배포 자격증명을 저장하는 칸입니다. 저장 후 값을 다시 읽을 수 없으므로 이름과 대상을 확인하고 입력합니다.

| 이름: 그대로 입력 | 넣을 값 | 사용하는 곳 |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_PAYBRIDGE_MOCK` | paybridge-mock 배포 전용 서비스 계정의 JSON 전체 내용 | Firebase Hosting 배포 작업 |
| `CLOUDFLARE_API_TOKEN` | 대상 계정의 Workers 배포용 API 토큰 | Cloudflare 배포 작업 |

### Firebase 서비스 계정 준비

1. Google Cloud Console에서 **paybridge-mock** 프로젝트를 선택합니다.
2. IAM 및 관리자 → 서비스 계정에서 Hosting 배포 전용 계정을 준비합니다. 기존 전용 계정이 있다면 재사용할 수 있습니다.
3. **Firebase Hosting Admin**(`roles/firebasehosting.admin`), CLI의 키 조회용 **API Keys Viewer**(`roles/serviceusage.apiKeysViewer`), API 상태 조회용 **Service Usage Viewer**(`roles/serviceusage.serviceUsageViewer`) 권한을 확인합니다. 마지막 역할은 `serviceusage.services.get`을 포함하며 API 활성화·비활성화 권한은 주지 않습니다. 실제 첫 배포에서 이 조회 권한 누락으로 403이 발생했습니다.
4. 해당 서비스 계정 → 키에서 JSON 키를 안전하게 준비합니다. 조직 정책이 키 생성을 막으면 정책을 끄지 말고 관리자에게 인증 방식을 확인합니다.
5. JSON 전체를 위 GitHub Secret에 입력합니다. `project_id`가 `paybridge-mock`인지 확인하세요.
6. 키 파일은 Git에 추가하지 않습니다. Vercel 기존 서버 키를 복사하기보다 배포 전용 계정을 사용합니다.

이번 작업은 Hosting live만 배포하며, Firebase Auth·Firestore·Functions를 배포하지 않습니다. Preview 인증 도메인 자동 수정이나 Cloud Run 연결도 사용하지 않습니다. 해당 기능을 위한 추가 관리자 권한을 이 안내 때문에 부여할 필요는 없습니다.

### Cloudflare 토큰 준비

1. Cloudflare 계정의 API Tokens 화면에서 Workers 배포용 토큰을 준비합니다.
2. 공식 **Edit Cloudflare Workers** 템플릿을 기준으로 필요한 권한을 확인하고 **배포할 계정 하나**로 범위를 지정합니다.
3. 토큰을 `CLOUDFLARE_API_TOKEN` Secret에 입력합니다. Account ID는 앞 단계의 Variable에 입력합니다.
4. 토큰에 만료일을 두었다면 만료 전에 GitHub Secret을 새 값으로 갱신합니다.

Global API Key나 로그인 비밀번호를 사용하지 않습니다. 이 안내에서는 Cloudflare의 별도 Workers Builds Git 연결을 사용하지 않습니다. 동일 Worker에 두 자동 배포 경로를 함께 연결하면 배포가 중복될 수 있으므로 GitHub Actions 한 경로로 운영합니다.

## 5. 처음 한 번: 관리자 주소 확보

**현재는 GitHub Actions로 `paybridge-admin` 배포를 완료했습니다. 실제 주소는 `https://paybridge-admin.evolvix.workers.dev`이므로 이 단계의 PC 최초 배포 명령을 다시 실행할 필요가 없습니다.** 아래는 다른 환경에서 처음 준비할 때의 참고 절차입니다.

아직 없다면 PR을 합치기 전에 현재 작업 브랜치에서 관리자만 **최초 1회** 배포해 주소를 확보합니다. 기존 판매자 `/admin`이 새 주소로 이동하기 때문에 주소·사이트를 먼저 준비하는 단계입니다. 이후 반복 배포는 Actions가 담당합니다.

Windows Git Bash, Node.js 22.x 기준입니다. 기존 작업을 덮어쓰지 않도록 새 폴더로 받습니다. 폴더가 이미 있다면 다른 새 이름을 사용하세요.

```bash
cd ~/Documents
git clone --branch feat/admin-cloudflare-ui-release https://github.com/wevolmina/paybridge-mock.git paybridge-release
cd paybridge-release
npm ci
cp apps/admin/.env.example apps/admin/.env.local
```

이미 `.env.local`이 있다면 복사 명령으로 덮어쓰지 말고 수정합니다. VS Code에서 다음 파일을 채웁니다.

```dotenv
VITE_FIREBASE_API_KEY=기존_웹앱의_apiKey
VITE_FIREBASE_AUTH_DOMAIN=paybridge-mock.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=paybridge-mock
VITE_FIREBASE_APP_ID=기존_웹앱의_appId
VITE_STAFF_API_ORIGIN=https://paybridge-mock.vercel.app
```

한글 설명을 실제 값으로 바꾸고 저장합니다. 파일 이름은 `.env.local.txt`가 아닌 `.env.local`입니다.

```bash
cd apps/admin
npx wrangler login
npx wrangler whoami
cd ../..
npm run deploy:admin
```

대상 Cloudflare 계정이 맞는지 확인합니다. 같은 이름 Worker가 이미 있다면 해당 프로젝트가 맞는지도 확인하세요. 계정 선택 오류가 나면 Wrangler 안내에 따라 `account_id`를 지정합니다.

터미널에 나온 **실제 HTTPS 관리자 URL**을 기록합니다. 계정명을 추측하지 않습니다. 이 단계는 화면과 주소를 준비하는 과정이며, 새 Vercel API가 배포되기 전에는 관리자 조회가 실패할 수 있습니다.

브라우저 Cloudflare 로그인과 터미널 `wrangler login` 인증은 별개입니다. 관리자 파일은 `apps/admin/dist`, 설정은 `apps/admin/wrangler.jsonc`, Worker 이름은 `paybridge-admin`입니다.

## 6. 처음 한 번: Vercel·Firebase 연결 설정

### Vercel 기존 프로젝트

기존 `https://paybridge-mock.vercel.app`을 제공하는 프로젝트를 선택합니다. 새 프로젝트를 만들지 않습니다.

| 위치·항목 | 값 |
| --- | --- |
| Settings → Git | 저장소 `wevolmina/paybridge-mock` 연결 |
| Settings → Environments → Production → Branch Tracking | `main` |
| Root Directory | `apps/merchant` |
| Root Directory 밖 소스 포함 | 켬. `packages/staff-ui`·`functions/src/domain.ts` 필요 |
| Node.js | 22.x |
| Install Command | `npm install --prefix ../..` |
| Build Command | `npm run build --workspace @bridge/merchant --prefix ../..` |
| Output Directory | Next.js 기본값 유지 |

메뉴 이름은 화면 개편에 따라 다를 수 있습니다. 설치·빌드 명령은 `apps/merchant/vercel.json`에도 있습니다. 다른 대시보드 값이 덮어쓰고 있다면 일치시키세요.

Settings → Environment Variables에서 **Production** 대상에 다음 두 값을 같은 실제 관리자 Origin으로 저장합니다.

```dotenv
ADMIN_SITE_ORIGIN=https://paybridge-admin.evolvix.workers.dev
NEXT_PUBLIC_ADMIN_SITE_URL=https://paybridge-admin.evolvix.workers.dev
```

Origin은 `https://`와 호스트를 합한 주소입니다. `/admin` 같은 경로·쿼리·`*`는 붙이지 않습니다. 기존 Firebase 서버 설정, `NEXT_PUBLIC_FIREBASE_*`, 운영 Aiven의 `MYSQL_*`, 기존 TLS·CA 설정은 유지합니다. 이 서버 비밀값을 GitHub 공개 Variables나 관리자 앱에 복사하지 않습니다.

현재 고객 코드의 API 주소는 `https://paybridge-mock.vercel.app`으로 고정되어 있습니다. 다른 Vercel 주소를 쓰려면 고객 소스의 API·메뉴 주소도 수정해야 합니다.

Vercel Preview가 필요하면 Preview 환경을 별도로 준비하세요. 운영 DB 비밀값을 미리보기 환경에 무조건 복사하지 않습니다. Vercel Git 연결이나 배포 권한에 문제가 있으면 소유 계정에서 기존 프로젝트의 접근 권한을 확인합니다.

### Firebase 관리자 도메인

Firebase Console → Authentication → Settings → Authorized domains에 실제 관리자 호스트를 추가합니다. 기존 도메인은 유지하며, 이 칸에는 `https://` 없이 호스트만 넣습니다.

API 키에 HTTP referrer 제한을 걸어 뒀다면 해당 기존 키에도 실제 관리자 사이트를 허용합니다. `firebase.json`의 `auth.authorizedDomains`에도 실제 호스트를 기록해 두세요. 이번 자동 배포는 Auth를 덮어쓰지 않습니다.

사이트 주소를 분리해도 관리자 권한이 새로 생기는 것은 아닙니다. 기존 Firebase 로그인 토큰과 DB 활성 직원 역할 검사를 유지합니다.

## 7. 최초 PR 병합과 배포 확인

현재 PR #1·PR #2는 병합됐습니다. 다음 신규 변경부터는 아래 준비와 PR 검사를 확인한 뒤 main에 병합합니다.

- GitHub Variables 4개·Secrets 2개 등록.
- 실제 Cloudflare 관리자 주소 확인.
- Vercel Production의 두 관리자 주소 변수 저장.
- Firebase 도메인 설정 확인.
- PR의 `Paybridge checks` 성공 확인.

처음 워크플로 파일을 추가한 PR에서는 GitHub 정책·설정에 따라 실행 허용이 필요할 수 있습니다. GitHub App이 워크플로 파일 쓰기를 거절하면 이 파일들을 소유 계정에서 추가하거나 해당 연결 권한을 확인해야 합니다.

병합 후 GitHub → Actions에서 다음 두 작업의 **같은 main 커밋** 실행을 확인합니다.

1. `Deploy customer to Firebase` 성공 → 기존 `https://paybridge-mock.web.app` 확인.
2. `Deploy admin to Cloudflare` 성공 → Wrangler 로그의 실제 관리자 주소 확인.
3. Vercel → Deployments → 같은 main 커밋의 **Production / Ready** 확인.

Actions는 변수·Secret 이름 누락, 잘못된 Firebase 프로젝트, 잘못된 Cloudflare Account ID 형식·API 주소를 검사하고 실패 시 배포를 중단합니다. 테스트·해당 앱 빌드가 실패해도 배포하지 않습니다. 이전 main 커밋을 재실행하면 최신 main의 해당 배포 대상 파일과 비교합니다. 대상 파일이 달라졌으면 오래된 배포를 건너뛰고, 이후 문서만 바뀌었다면 원래 배포를 진행합니다.

저장소 Settings → Actions → General에서 Actions가 허용되어 있어야 합니다. 조직이 허용 액션을 제한한다면 워크플로에 명시한 `actions/checkout`, `actions/setup-node`, `FirebaseExtended/action-hosting-deploy`의 고정 SHA 사용을 허용해야 합니다. GitHub 토큰은 `contents: read`만 사용하며, Firebase·Cloudflare 배포 권한은 각 전용 Secret으로 제공합니다.

## 8. 다음 변경부터는 이렇게 합니다

1. 작업 브랜치에서 코드 수정 후 PR을 만듭니다.
2. GitHub 검사와 필요 시 Vercel 미리보기를 확인합니다.
3. PR을 main에 병합합니다.
4. 변경된 대상의 Actions 결과와 Vercel Ready를 확인합니다.

PC에서 매번 `firebase deploy`, `wrangler deploy`, `vercel --prod`를 실행하지 않습니다. 공통 코드 변경은 관리자·판매자 모두의 빌드 결과를 확인합니다. Firestore·Auth·Functions·DB 스키마 변경은 이번 자동화의 배포 대상이 아닙니다.

GitHub 변수·Secret만 바꾸면 푸시 이벤트가 생기지 않습니다. 값 수정 후에는 **Actions → 해당 배포 작업 → Run workflow → Branch: main**으로 새 배포를 시작합니다. `workflow_dispatch`는 수동으로 자동 작업을 시작하는 기능입니다. 작업 파일이 main에 들어간 뒤 사용할 수 있으며, main 이외 브랜치 실행은 배포 job을 건너뜁니다.

실패한 실행의 Re-run jobs는 같은 과거 커밋을 다시 실행합니다. 최신 main이 달라졌다면 Run workflow로 최신 main을 선택하세요. Vercel 변수 변경은 기존 프로젝트에서 최신 main의 새 배포를 시작해야 합니다.

## 9. 파일별 역할

| 파일 | 하는 일 |
| --- | --- |
| `.github/workflows/ci.yml` | PR·main 단위 테스트와 세 앱 빌드. 배포 Secret 사용 안 함 |
| `.github/workflows/deploy-firebase.yml` | main 변경 경로에 따라 고객 Hosting live 배포 |
| `.github/workflows/deploy-cloudflare.yml` | main 변경 경로에 따라 관리자 정적 파일 배포 |
| `scripts/check-static-deploy-env.mjs` | 값 자체를 출력하지 않고 필수 설정·대상 검사 |
| `apps/merchant/vercel.json` | Vercel Git 자동 배포 허용·모노레포 빌드 명령 |
| `apps/admin/wrangler.jsonc` | Worker 이름·SPA 정적 파일 설정 |

Firebase 배포는 공식 Hosting 액션의 `channelId: live`를 사용합니다. `package-lock.json`도 저장소에 반영했습니다. 첫 GitHub 검사에서 고정 파일 누락을 수정한 뒤, 깨끗한 환경의 `npm ci`·테스트·세 앱 빌드가 통과했습니다. Firestore·Auth를 함께 배포하는 루트 `deploy:firebase` 스크립트는 이 자동화에서 호출하지 않습니다. Cloudflare는 npm lockfile에 설치된 Wrangler로 `apps/admin/dist`만 배포합니다. 외부 액션은 확인한 커밋 SHA로 고정했습니다.

## 10. 오류 해결과 화면 확인

| 증상 | 확인할 것 |
| --- | --- |
| Actions 메뉴·Run workflow가 없음 | main에 워크플로가 병합됐는지, Actions가 허용됐는지 확인 |
| `missing or placeholder` | 표시된 이름의 Repository Variable 확인. 한글 예시를 실제 값으로 바꾸기 |
| Firebase Secret JSON 오류·wrong project | JSON 전체인지, `project_id=paybridge-mock`인지 확인 |
| Firebase 403 | 실제 누락 권한은 `serviceusage.services.get`. 기존 배포 서비스 계정에 `Service Usage Viewer`를 추가한 뒤 실패 작업 재실행. Owner·Editor를 새로 줄 필요 없음 |
| Cloudflare 인증·권한 오류 | API 토큰 Secret, Account ID Variable, 대상 계정·Workers 권한 확인 |
| 배포 성공인데 관리자 조회 실패 | Vercel의 관리자 Origin·실제 운영 주소·최신 서버 배포 확인 |
| CORS 오류 | 관리자 주소와 Vercel `ADMIN_SITE_ORIGIN` 비교. Preview URL과 운영 URL 혼동 주의 |
| Vercel 자동 배포가 안 시작됨 | Git 연결·Production main 추적·작성자 권한·Ignored Build Step 확인 |
| 문서 수정 후 Firebase·Cloudflare 실행이 없음 | 경로 필터에 의한 정상 생략. 재배포가 필요하면 Run workflow 사용 |
| 오래된 배포가 skipped | 최신 main의 해당 대상 소스가 달라짐. 최신 main으로 Run workflow 실행 |

고객 화면·판매자 로그인·관리자 로그인/조회·기존 Vercel `/admin`의 새 주소 이동을 각각 확인합니다. 관리자 로그아웃 후 판매자 로그인은 유지되어야 합니다. 비로그인·일반 판매자가 관리자 자료를 조회할 수 없어야 합니다.

배포 성공 표시가 실제 관리자 권한·DB 연결 성공을 보장하지는 않습니다. 모의 결제를 누르면 운영 Firestore·MySQL에 데모 주문이 생기므로 화면 확인과 구분하세요. 현재 패키지 변경 API는 `bedroom-lighting`만 입력으로 허용하는 기존 제한이 있습니다.

롤백은 각 호스팅의 정상 버전 기록이나 수정·되돌림 PR로 처리합니다. 현재 Actions는 대상 소스가 달라진 오래된 커밋의 Re-run 배포를 막으므로 소스 복구는 **새 revert 커밋을 main에 반영**하는 방식이 맞습니다. 호스팅에서 수동 롤백한 뒤에도 main 소스를 맞추지 않으면 다음 자동 배포가 다시 최신 코드로 바꿉니다. 배포 롤백으로 DB 주문이 자동 삭제되지는 않습니다.

## 11. 검증 기록과 남은 연결

이번 변경은 Node.js 22.23.4에서 단위 테스트 **31개**와 세 앱 빌드를 통과했습니다. 잘못된 프로젝트·설정 누락·비밀값 비노출을 확인하는 배포 설정 테스트 4개를 포함합니다. actionlint 1.7.12로 워크플로 문법을 검사했고, 경로 필터·고정 액션 SHA·main 배포 제한을 점검했습니다. 실제 업로드 없는 관리자 사전 검사도 통과했습니다.

실제 GitHub PR 검사와 main 검사를 확인했습니다. Cloudflare Actions와 고객 Firebase Actions 모두 운영 게시에 성공했습니다. Firebase 세 번째 실행은 테스트 31개·고객 빌드·Hosting 게시를 통과했고 운영 HTML의 JS·CSS 파일명이 해당 빌드 결과와 일치했습니다. 실제 관리자 계정 로그인·DB 조회는 아직 시험하지 않았습니다.

운영 성공으로 표시하려면 GitHub Secrets·Variables 등록 후 **최초 Firebase·Cloudflare Actions 성공**, Vercel **Production Ready**, 운영 관리자 로그인·조회까지 따로 확인해야 합니다. 문서 저장이나 CI 성공만으로 운영 배포 완료라고 기록하지 않습니다.

| 기록 항목 | 실제 확인 후 입력 |
| --- | --- |
| GitHub 변수·Secret 등록 | 두 배포 작업 모두 설정 사전 검사 통과. Secret 실제 값은 읽지 않음 |
| 관리자 실제 URL | https://paybridge-admin.evolvix.workers.dev/ |
| main 병합 커밋 | `21073fefa08613a375cbd9c24d1745e77afd7a5d` |
| Firebase Actions 실행 URL·성공 | [세 번째 실행](https://github.com/wevolmina/paybridge-mock/actions/runs/40161796367/attempts/3), 성공. 소스 `518f04de1bb91659902b288e59efeaae853a85d1`, Hosting 버전 `1476f66f63ada150` |
| Cloudflare Actions 실행 URL·성공 | [실행 기록](https://github.com/wevolmina/paybridge-mock/actions/runs/40160606456), 성공. 버전 `20009ec2-5f38-4485-a707-039f23042106` |
| Vercel Production 배포 URL·Ready | [배포 상세](https://vercel.com/wevolmina94-9986/paybridge-mock/EDwRkhXJLfmTjS55krBqidVkKi3x), Ready 확인 |
| 기존 `/admin` 이동·관리자 조회 | 이동 307·정확한 관리자 Origin 204·다른 Origin 403·토큰 없는 조회 403. 관리자 실계정의 양성 조회는 미시험 |

상세 진행 결과: [2026-10-25 배포 기록](DEPLOYMENT_PROGRESS_2026-10-25.md).

## 공식 참고

- [Firebase Hosting GitHub 연동](https://firebase.google.com/docs/hosting/github-integration)
- [Firebase 공식 배포 액션·서비스 계정](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md)
- [Cloudflare GitHub Actions 배포](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Vercel Git 자동 배포](https://vercel.com/docs/git)
- [Vercel Git 설정](https://vercel.com/docs/project-configuration/git-configuration)
