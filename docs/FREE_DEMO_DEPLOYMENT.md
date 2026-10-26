# ENG_agency 개인 비상업 시연용 배포

이 문서는 기존 Paybridge 보고서보다 우선합니다. 기존 프로젝트를 재사용하지 않고 새 Firebase, Vercel, Cloudflare, Neon 프로젝트에 연결하는 구성입니다. 실제 결제나 배송은 없습니다.

## 역할
| 서비스 | 역할 |
|---|---|
| Firebase Spark | 구매자 화면, Authentication 로그인, Standard Firestore 주문 접수함 |
| Vercel Hobby | 판매자 화면, 관리자 공통 API, 로그인 검증, 주문 검증, PostgreSQL 저장, 하루 한 번 재시도 |
| Neon Free PostgreSQL | 판매자 주문·결제 결과, 상품, 권한 신청·심사 이력 |
| Cloudflare Workers 정적 자산 | 관리자 화면 |

Firebase Cloud Functions는 배포하지 않습니다. functions 폴더는 기존 공용 상품 검증 코드와 과거 전달 테스트를 보관합니다. index.ts에는 서버 함수나 예약 작업 내보내기가 없습니다.

## 주문 흐름
1. 브라우저가 Firebase ID 토큰과 상품 번호·수량·요청 UUID를 Vercel로 보냅니다. 금액은 받지 않습니다.
2. Vercel은 토큰 서명과 계정 유효성을 확인하고 입력을 검증합니다.
3. Standard Firestore의 checkout_intake에 고객·요청·검증용 해시와 pending 상태를 먼저 기록합니다. 서버 Admin SDK만 접근하며 현재 규칙의 기본 거부가 브라우저 읽기·쓰기를 막습니다.
4. PostgreSQL 트랜잭션으로 상품 판매 상태·서버 가격을 확인하고 주문, 구성, 모의 결제 결과를 함께 저장합니다.
5. Firestore에 synced와 영수증을 기록합니다. 두 저장이 확인돼야 완료 응답을 보냅니다.
6. SQL 저장 또는 Firestore 완료 확인이 실패하면 HTTP 202 PROCESSING입니다. 구매자 화면은 완료 표시 대신 처리 중 안내와 같은 주문 결과 다시 확인 버튼을 유지합니다.
7. 같은 고객·요청 번호는 SQL 유일성 제약과 행 잠금으로 한 번만 저장합니다. 같은 요청의 내용이 바뀌면 409입니다.

두 DB를 하나의 트랜잭션으로 묶지는 않습니다. SQL 저장 후 응답/Firestore 확인이 끊겨도 재시도가 같은 영수증을 가져와 복구합니다. 최초 Firestore 기록조차 실패하면 SQL을 저장하지 않고 503을 반환합니다. 이 경우 브라우저의 미완료 요청이 유지됩니다.

## 재시도
- 수동: 구매자 기존 버튼이 같은 요청 번호와 내용으로 POST를 다시 보냅니다.
- 자동: Vercel Cron이 18:00 UTC, 한국 시간 다음 날 03시대에 하루 한 번 실행합니다. Hobby에서는 실행 시각에 한 시간 안팎의 오차가 있을 수 있습니다.
- GET /api/cron/reconcile는 32자 이상 CRON_SECRET의 정확한 Bearer 인증이 필요합니다. 일반 고객은 호출할 수 없습니다.
- 실행당 최대 25건을 시도합니다. 실패 건은 다음 시도 시각을 하루 뒤로 미루고, 상품 판매 중단·가격 변경·요청 충돌은 blocked로 보관하여 자동 반복하지 않습니다.
- 예약 작업이 끝나기 전에 실행 제한에 걸린 건은 접수함에 남습니다. SQL 중복 방지로 다음 실행에서 이어갈 수 있습니다. 일일 처리량보다 미완료 주문이 많으면 복구가 여러 날 걸릴 수 있으므로 소규모 시연에 사용합니다.
- 계정 삭제 등으로 고객 로그인을 더 이상 할 수 없어도, 이미 검증해 접수한 요청은 서버가 복구할 수 있습니다.
- 15분 간격 예약은 설정하지 않습니다.

## 새 프로젝트 연결 순서
1. Firebase: Spark 프로젝트와 웹 앱을 만들고 Standard Firestore를 Native 문서 모드로 준비합니다. Google 로그인과 필요한 경우 익명 로그인·이메일 로그인을 켭니다. 이 변경은 기존 DB 복사나 기존 계정 이전을 포함하지 않습니다.
2. Neon: Free PostgreSQL 프로젝트를 만들고 Vercel에 pooled DATABASE_URL을 설정합니다. 새 빈 DB에만 npm run db:migrate를 실행합니다. 마이그레이션은 트랜잭션·버전 기록으로 재실행할 수 있고, 알 수 없는 기존 테이블이 있으면 중단합니다.
3. Vercel: ENG_agency를 가져오고 Root Directory를 apps/merchant로 지정합니다. 저장소 루트의 공유 패키지를 빌드에 포함하도록 Root Directory 밖 파일 포함 옵션을 켭니다.
4. 구매자와 관리자 빌드 환경에 새 Firebase 공개 설정과 새 Vercel 원본 주소를 입력합니다. 이전 paybridge-mock 주소로 돌아가는 기본값은 사용하지 않습니다.
5. Firebase Authentication의 승인 도메인에 새 Firebase/Vercel/Cloudflare 도메인을 등록합니다. Google 공급자 설정과 카카오 개발자 콘솔의 콜백 주소도 새 Vercel 주소에 맞춥니다.
6. 새 Firebase 서비스 계정을 Vercel 서버 환경 변수로 설정합니다. 개인키는 NEXT_PUBLIC_ 또는 VITE_ 이름에 절대 넣지 않습니다.
7. Firebase에 hosting,firestore만 배포해 규칙과 checkout_intake 복합 인덱스를 적용합니다.
8. Cloudflare에서 eng-agency-admin이라는 새 Worker 정적 사이트를 배포합니다.
9. 새 관리자 화면에서 지정 Google 계정으로 최초 마스터 등록을 마친 뒤 MASTER_SETUP_PASSWORD를 제거합니다.

## 환경 변수
### Vercel 서버
- DATABASE_URL: Neon PostgreSQL 연결 주소
- FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: 새 Firebase 서비스 계정
- NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID: 같은 프로젝트의 공개 웹 설정
- CUSTOMER_SITE_ORIGINS: 새 구매자 원본 주소, 여러 개면 쉼표 구분, 경로 없음
- ADMIN_SITE_ORIGIN, NEXT_PUBLIC_ADMIN_SITE_URL: 새 관리자 원본 주소
- NEXT_PUBLIC_CUSTOMER_SITE_URL: 새 구매자 사이트 주소
- SOCIAL_AUTH_API_ORIGIN: 새 Vercel 원본 주소
- CRON_SECRET: 충분히 긴 무작위 비밀값, 최소 32자
- MASTER_SETUP_EMAIL, MASTER_SETUP_MERCHANT_ID, MASTER_SETUP_PASSWORD: 최초 마스터 등록 전용
- SOCIAL_GOOGLE_ENABLED, SOCIAL_AUTH_STATE_SECRET, KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET: 소셜 로그인 설정

### Firebase 구매자와 Cloudflare 관리자 빌드
- VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID
- VITE_STAFF_API_ORIGIN: 새 Vercel 원본 주소
- 관리자에는 VITE_CUSTOMER_SITE_URL도 설정

### GitHub 자동 배포
- 저장소 Variables: 위 VITE_ 공개 값과 CLOUDFLARE_ACCOUNT_ID
- 저장소 Secrets: FIREBASE_SERVICE_ACCOUNT(JSON), CLOUDFLARE_API_TOKEN
- DEPLOY_ENG_AGENCY=true를 Variables에 넣기 전까지 자동 배포 작업은 실행하지 않습니다.
- .firebaserc에 예전 프로젝트를 지정하지 않습니다. 수동 명령은 npm run deploy:firebase -- --project 새프로젝트ID처럼 명시합니다.

## 검증과 제한
검증용 CI는 실제 서비스의 비밀값 없이 Postgres 임시 컨테이너에서 주문 동시 요청·롤백·다른 고객 영수증 차단·권한 수락과 전체 빌드를 확인합니다. 실제 새 계정 생성, 원격 환경 변수 입력, 로그인 공급자 설정, 운영 DB 연결 및 브라우저 주문 시험은 별도 배포 단계입니다.
무료 한도 안에서 사용하는 개인 비상업 시연 구성입니다. Firebase Functions·Cloud Scheduler·Secret Manager를 사용하지 않습니다. 이 구조가 사용량 한도를 없애 주지는 않습니다.

공식 기준:
- https://firebase.google.com/docs/functions/get-started
- https://firebase.google.com/docs/admin/setup
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/limits/fair-use-guidelines
- https://neon.com/pricing
