# 관리자 사이트를 Cloudflare로 분리

기준: 2026-10-25 한국 시간. 코드와 로컬 검증 완료. GitHub 작업 브랜치와 [PR #1](https://github.com/wevolmina/paybridge-mock/pull/1)에 반영했으며, main 병합·운영 배포·실계정 접속 검증은 아직 완료하지 않았다.

직접 배포할 때는 [Windows 직접 배포 안내서](docs/MANUAL_DEPLOYMENT.md)를 순서대로 따른다. 명령어·설정 입력 위치·PR 병합·Vercel 자동 배포 확인·완료 확인·오류 해결을 포함한다.

|사용자|호스팅|소스|역할|
|---|---|---|---|
|구매자|Firebase Hosting|`apps/customer`|공간 체험·모의 주문|
|판매자|Vercel|`apps/merchant`|판매자 로그인·모의 매출|
|관리자|Cloudflare Workers Static Assets|`apps/admin`|관리자 로그인·공간/패키지 관리|
|공통 서버|Vercel|`apps/merchant/app/api`|토큰·DB 역할 검사, 주문·관리자 API|
|공통 화면 코드|각 앱에서 빌드|`packages/staff-ui`|역할별 화면·상태 모션의 공통 구현|

이번 분리는 관리자 **화면과 접속 주소**를 Cloudflare에 옮기는 변경이다. 관리자 API와 Firebase Admin SDK·MySQL 연결은 Vercel 서버에 유지한다. Cloudflare에 DB 비밀번호나 Firebase 관리자 비밀 키를 넣지 않는다. 서버까지 Cloudflare로 이전하려면 별도의 런타임·DB 연결 검증이 필요하다.

## 사용 방법의 변화

판매자와 관리자는 서로 다른 주소에서 로그인한다. 같은 Firebase 계정을 사용하더라도 사이트별 로그인 상태는 분리된다. 관리자 로그아웃으로 판매자 사이트가 로그아웃되지는 않는다.

- 판매자 사이트의 `/admin`은 설정된 Cloudflare 관리자 주소로 307 이동한다. 주소 미설정 시 이전 관리자 화면 대신 분리 안내를 보여 준다.
- 판매자 메뉴의 관리자 링크는 `NEXT_PUBLIC_ADMIN_SITE_URL`을 설정한 경우 별도 사이트로 연결한다.
- 구매자 스토어에서는 관리자 메뉴를 제거했다.
- API는 매 요청마다 기존 Firebase 토큰과 DB의 활성 관리자 역할을 확인한다. 사이트 분리가 관리자 권한을 새로 부여하지 않는다.
- 관리자 API는 설정한 관리자 사이트의 정확한 Origin만 허용한다. `*.workers.dev`, `*` 같은 광범위한 허용은 사용하지 않는다. CORS는 브라우저 연결 규칙이며 관리자 인증을 대신하지 않는다.

## 1. 설치·공개 설정

프로젝트 루트에서 다음 명령을 실행한다. 권장 환경은 Node.js 22다.

```bash
npm install
```

`apps/admin/.env.example`을 같은 폴더의 `.env.local`로 복사한 뒤 기존 Firebase 웹 앱의 **공개 설정**을 채운다.

```dotenv
VITE_FIREBASE_API_KEY=기존_웹앱_API키
VITE_FIREBASE_AUTH_DOMAIN=기존_프로젝트.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=paybridge-mock
VITE_FIREBASE_APP_ID=기존_웹앱_ID
VITE_STAFF_API_ORIGIN=https://paybridge-mock.vercel.app
```

Vite의 `VITE_` 값은 브라우저에 포함되는 공개 값이다. MySQL 비밀번호·서비스 계정 JSON·서명 키를 넣지 않는다. 기존 Firebase 로그인 제공자를 그대로 사용하며 새 사용자·역할은 만들지 않는다.

## 2. Cloudflare 관리자 배포

루트에서 실행한다.

```bash
npx wrangler login
npm run deploy:admin
```

`apps/admin/wrangler.jsonc`의 Worker 이름은 `paybridge-admin`, 정적 파일 폴더는 `dist`다. 배포 명령은 관리자 앱을 빌드한 다음 정적 파일을 업로드한다. 응답으로 나온 **실제 관리자 URL**을 보관한다. 예시 주소의 계정 이름을 추측해서 사용하지 않는다.

Cloudflare에서 Git 연동 빌드를 쓰려면 저장소 루트에서 설치한 뒤 `npm run build:admin`으로 빌드하고, `apps/admin`에서 Wrangler를 실행하거나 루트에서 `npx wrangler deploy --config apps/admin/wrangler.jsonc`로 배포한다. Firebase 공개 설정은 빌드 환경에 제공한다. `apps/admin/dist`는 배포용 산출물이며 Git에 올리지 않는다.

## 3. Vercel 연결 설정·재배포

기존 Vercel 프로젝트의 환경 변수에 실제 관리자 주소를 두 곳 모두 등록한다.

```dotenv
ADMIN_SITE_ORIGIN=https://실제_관리자_호스트
NEXT_PUBLIC_ADMIN_SITE_URL=https://실제_관리자_호스트
```

프로토콜과 호스트만 넣는다. `/admin` 같은 경로·쿼리·인증 정보는 넣지 않는다. 두 값은 같은 사이트를 가리켜야 한다. 실제 배포에서 HTTPS를 사용한다. 로컬 시험에 한해서 `http://127.0.0.1:5190` 같은 주소를 허용한다.

변경한 Vercel 코드를 재배포해야 새 관리자 사이트의 API 요청과 기존 주소 이동이 동작한다. 환경 변수만 바꾸고 이전 배포를 계속 사용하면 적용되지 않는다. Vercel 프로젝트 루트가 `apps/merchant`라면 모노레포의 `packages/staff-ui`도 빌드 입력에 포함되어야 한다. 공유 패키지는 npm workspace와 Next.js `transpilePackages`로 연결했다.

새 사이트 도메인을 Firebase Authentication의 승인된 도메인 목록에도 등록해 인증 흐름을 정리한다. 웹 API 키에 HTTP referrer 제한이 있으면 실제 관리자 도메인도 허용한다. `firebase.json`의 `auth.authorizedDomains`에는 아직 새 주소가 없으므로, 향후 `firebase deploy --only auth`를 실행하기 전에 실제 호스트를 설정 파일에도 반영해야 한다. 실제 주소가 정해지지 않아 이번에는 도메인 설정이나 Auth 배포를 수행하지 않았다.

## 4. 구매자 화면 반영

구매자 앱의 관리자 메뉴 제거를 운영에도 반영하려면 기존 Firebase 공개 설정을 유지한 채 고객 앱을 빌드하고 Hosting만 배포한다.

```bash
npm run build --workspace @bridge/customer
npx firebase-tools deploy --only hosting --project paybridge-mock
```

기존 Firestore·Auth 설정은 이 화면 변경 배포에서 함께 덮어쓰지 않는다.

## 로컬 확인

터미널을 나눠서 아래 두 명령을 실행한다.

```bash
npm run dev:merchant
npm run dev:admin
```

판매자 주소는 `http://127.0.0.1:3000`, 관리자 주소는 `http://127.0.0.1:5190`이다. 로컬 관리자 `.env.local`의 API 주소와 판매자 `.env.local`의 관리자 Origin·사이트 주소도 이 로컬 주소로 맞춘다. 운영 Firebase·MySQL을 설정한 경우 실제 자료를 조회·변경할 수 있으므로 화면 확인과 API 대체 시험을 구분한다.

## 이번 검증 결과

- 기존 24개 + 관리자 Origin·사전 요청 검사 3개 = 단위 테스트 **27개 통과**.
- 구매자·판매자·관리자 빌드와 타입 검사 통과.
- `wrangler deploy --dry-run` 통과. 관리자 정적 파일 5개를 읽었으며 실제 업로드는 하지 않았다.
- 서로 다른 두 로컬 주소에서 별도 로그인·로그아웃 확인.
- 기존 `/admin`이 별도 관리자 주소로 307 이동함을 확인.
- 실제 로컬 관리자 API에서 허용 Origin의 사전 요청 204, 토큰 없는 조회 403, 다른 Origin 403 확인.
- 브라우저에서 관리자 요청의 Bearer 토큰 전달과 쿠키 미전달 확인.
- API 응답을 대체한 패키지 변경·재조회, 기존 역할별 모션·중복 알림 방지·구매자 선택/재확인/영수증 복원 검증 통과.
- 320 / 390 / 768 / 1440px의 페이지 가로 넘침 없음, 움직임 줄이기 통과.

브라우저 업무 자료와 로그인은 시험용 응답이다. 운영 DB 변경, 실제 계정의 관리자 권한 시험, Cloudflare 운영 사이트 접속 시험과 구분한다. 이번 실행 환경은 Node.js 24와 Linux Chromium이며, 권장 Node.js 22 재실행은 별도 확인하지 않았다.

## 배포 진행 상태

- GitHub 권한 연결 후 소스를 `feat/admin-cloudflare-ui-release`에 업로드하고 PR #1을 생성했다. 앞선 403 오류는 해소됐다.
- 이 작업 환경에서는 Cloudflare 실제 Worker를 생성하지 않았다. 사용자가 직접 배포하는 방식으로 전환했다. 사용자 PC에서는 Wrangler 인증을 별도로 확인한다.
- `apps/merchant/vercel.json`의 `git.deploymentEnabled`를 `true`로 변경했다. 기존 Git 연결과 Production main 추적을 확인한 뒤 PR을 병합하면 Vercel 자동 배포 대상이 된다. 실제 자동 빌드·운영 성공은 별도 확인한다.

Cloudflare 관리자 배포 → 실제 URL 확정 → Vercel 환경 변수·Firebase 도메인 설정 → PR 병합 → Vercel 자동 배포 확인 → 고객 Hosting 배포 → 운영 로그인·권한 확인 순서로 진행한다.

공식 참고: [Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/) · [SPA 라우팅](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) · [Wrangler 설정](https://developers.cloudflare.com/workers/wrangler/configuration/).
