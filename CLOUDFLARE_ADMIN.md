# 관리자 사이트를 Cloudflare로 분리

기준: 2026-10-25 한국 시간. 코드와 로컬 검증 완료. PR #1·PR #2 병합과 관리자 Cloudflare·판매자 Vercel 운영 배포를 확인했다. 고객 Firebase 자동 배포는 API 조회 권한 보완이 필요하며 관리자 실계정 조회는 미시험이다.

직접 배포할 때는 [자동 배포 안내서](docs/AUTO_DEPLOYMENT.md)를 순서대로 따른다. GitHub Actions의 변수·Secret 등록, 최초 관리자 주소 확보, PR 병합과 세 사이트 자동 배포 확인을 포함한다.

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

위 명령은 최초 관리자 주소를 확보하거나 수동 복구할 때 사용한다. 반복 배포는 `.github/workflows/deploy-cloudflare.yml`이 main 변경으로 실행한다. GitHub Variables·Secrets는 자동 배포 안내서대로 등록한다. 별도 Cloudflare Workers Builds Git 연결을 중복 구성하지 않는다. `apps/admin/dist`는 배포용 산출물이며 Git에 올리지 않는다.

## 3. Vercel 연결 설정·재배포

기존 Vercel 프로젝트의 환경 변수에 실제 관리자 주소를 두 곳 모두 등록한다.

```dotenv
ADMIN_SITE_ORIGIN=https://실제_관리자_호스트
NEXT_PUBLIC_ADMIN_SITE_URL=https://실제_관리자_호스트
```

프로토콜과 호스트만 넣는다. `/admin` 같은 경로·쿼리·인증 정보는 넣지 않는다. 두 값은 같은 사이트를 가리켜야 한다. 실제 배포에서 HTTPS를 사용한다. 로컬 시험에 한해서 `http://127.0.0.1:5190` 같은 주소를 허용한다.

변경한 Vercel 코드를 재배포해야 새 관리자 사이트의 API 요청과 기존 주소 이동이 동작한다. 환경 변수만 바꾸고 이전 배포를 계속 사용하면 적용되지 않는다. Vercel 프로젝트 루트가 `apps/merchant`라면 모노레포의 `packages/staff-ui`도 빌드 입력에 포함되어야 한다. 공유 패키지는 npm workspace와 Next.js `transpilePackages`로 연결했다.

새 사이트 도메인을 Firebase Authentication의 승인된 도메인 목록에도 등록해 인증 흐름을 정리한다. 웹 API 키에 HTTP referrer 제한이 있으면 실제 관리자 도메인도 허용한다. `firebase.json`의 `auth.authorizedDomains`에는 아직 새 주소가 없으므로, 향후 `firebase deploy --only auth`를 실행하기 전에 실제 호스트를 설정 파일에도 반영해야 한다. 실제 주소가 정해지지 않아 이번에는 도메인 설정이나 Auth 배포를 수행하지 않았다.

## 4. 구매자 자동 배포와 수동 복구

구매자 화면은 main 변경 시 `.github/workflows/deploy-firebase.yml`이 공개 설정으로 빌드해 Hosting만 배포한다. 아래 명령은 자동 작업 대신 수동 복구가 필요할 때만 사용한다.

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

- PR #1·PR #2 병합 완료. 배포 코드 main은 `21073fe`다.
- Cloudflare 자동 배포 성공: https://paybridge-admin.evolvix.workers.dev/ . Worker 버전 `20009ec2-5f38-4485-a707-039f23042106`.
- Vercel의 두 관리자 주소 변수를 실제 Origin으로 저장하고 Production Ready를 확인했다. 기존 `/admin`의 307 이동, 허용 Origin의 204, 다른 Origin과 비로그인 조회의 403을 확인했다.
- 고객 Firebase는 설정 검사·설치·테스트·빌드 후 게시 단계에서 `serviceusage.services.get` 부족으로 실패했다. 기존 배포 계정의 Service Usage Viewer 역할 보완 후 재실행한다.
- Firebase 새 관리자 도메인 승인은 아직 저장하지 않았다. 실제 계정의 관리자 자료 조회·변경은 미시험이다.
- [상세 진행 기록](docs/DEPLOYMENT_PROGRESS_2026-10-25.md).

공식 참고: [Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/) · [SPA 라우팅](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) · [Wrangler 설정](https://developers.cloudflare.com/workers/wrangler/configuration/).
