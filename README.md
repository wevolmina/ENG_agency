> 고객·판매자·관리자 구글/카카오/네이버 간편로그인: [공통 연결 설정](docs/2026-10-25/paybridge-social-login/README.md) · [판매자 적용과 검증 범위](docs/2026-10-25/paybridge-seller-social-login/README.md). 운영 서버의 연결 준비가 끝난 공급자만 사용할 수 있습니다.

> 2026-10-25 관리자 분리: 관리자 화면은 `apps/admin`의 Cloudflare 전용 앱으로 이동했습니다. 판매자·API는 Vercel에 유지합니다. [자동 배포 안내서](docs/AUTO_DEPLOYMENT.md)와 [구조·검증 기록](CLOUDFLARE_ADMIN.md)을 확인하세요. 관리자·판매자 운영 배포를 확인했습니다. 고객 Firebase도 서비스 계정 권한 보완 후 자동 배포에 성공했습니다. [최종 배포 기록](docs/DEPLOYMENT_PROGRESS_2026-10-25.md)을 확인하세요.

# Paybridge 모의 결제

Firestore는 주문 요청을 접수하고 MySQL은 확정 주문·항목·결제를 관리합니다. 고객 영수증과 판매자 대시보드는 Vercel API를 통해 동일한 MySQL 결제를 조회합니다.

- 고객 화면: https://paybridge-mock.web.app
- 판매자 화면: https://paybridge-mock.vercel.app
- 관리자 화면: https://paybridge-admin.evolvix.workers.dev
- [MySQL Workbench Community 무료 다운로드](https://dev.mysql.com/downloads/workbench/) — 설치·DB 연결 후 MySQL 테이블을 확인합니다.
- [구현 보고서와 소스 링크](docs/IMPLEMENTATION-REPORT.md)
- [클릭형 소스 설명](docs/IMPLEMENTATION-REPORT.html): 내려받아 브라우저에서 열기

## 실행

Node.js 22에서 `npm install` 후 고객 `.env.example`, 판매자 `.env.local.example`을 각각 `.env.local`로 복사하고 값을 설정합니다. DB 접속 정보는 서버 전용 환경 변수입니다.

```sh
npm test
npm run build
npm run db:migrate
npm run dev:customer
npm run dev:merchant
```

## 배포

[자동 배포 안내서](docs/AUTO_DEPLOYMENT.md)를 순서대로 따르세요. 최초 1회 GitHub Variables 4개·Secrets 2개, 관리자 실제 주소, Vercel 환경 변수를 설정한 뒤 PR을 main에 병합합니다.

- 고객 Firebase Hosting: `.github/workflows/deploy-firebase.yml`에서 main 변경 시 빌드·Hosting live 배포.
- 관리자 Cloudflare Workers: `.github/workflows/deploy-cloudflare.yml`에서 main 변경 시 빌드·정적 파일 배포.
- 판매자·API Vercel: `git.deploymentEnabled: true`와 기존 Git 연결로 main의 Production 자동 배포.
- PR 검사: `.github/workflows/ci.yml`에서 비밀값 없이 테스트·세 앱 빌드.

고객·관리자 배포는 변경 경로에 따라 실행합니다. `packages/staff-ui`·루트 의존성 변경은 두 Actions의 배포 대상입니다. Vercel에서도 공통 코드 변경 시 새 빌드·Ready를 확인합니다. GitHub 변수·Secret만 수정했다면 해당 배포 작업의 Run workflow에서 main을 선택합니다.

Firebase 자동화는 Hosting만 배포합니다. 기존 `deploy:firebase` 스크립트는 Firestore·Auth도 대상으로 하므로 이 자동화에서는 호출하지 않습니다. MySQL·Firebase 서버 인증 설정은 Vercel에 유지하고 관리자 앱에는 공개 웹 설정만 포함합니다. Firebase·Cloudflare 운영 자동 배포 성공을 확인했습니다. 각 앱의 전체 기능 확인은 배포 상태와 별도로 진행합니다.

## DB 책임과 재시도

1. API가 로그인 신원과 입력을 검증하고 서버 가격으로 계산합니다.
2. 기존 확정 요청이면 같은 영수증을 반환합니다. 신규 요청은 Firestore order_requests에 변경 불가능한 원문을 남깁니다.
3. MySQL 트랜잭션에서 orders, order_items, payments를 함께 확정합니다.
4. 오류 시 MySQL 전체를 롤백하고 Firestore 접수는 남깁니다. 같은 requestId로 재시도합니다. 자동 작업 큐는 없습니다.

`(customer_id,request_id)` 고유 키와 행 잠금이 동시 요청의 중복 확정을 막습니다. 내용이 다르면 409로 거절합니다. 고객은 본인 영수증만, 판매자는 본인 매출만 조회합니다. 고객 데이터 삭제로 익명 인증 신원을 잃으면 이전 영수증을 복원할 수 없습니다.

## 검증

Firestore Emulator에서 `tests/integration/firestore-rules.test.ts`를 실행합니다. 실제 MySQL 테스트는 격리된 `_test` 데이터베이스만 사용합니다.

```sh
RUN_MYSQL_INTEGRATION=true npx tsx --test tests/integration/checkout.test.ts
```

병렬 재시도, 입력 충돌, 고객 영수증 분리, 결제 INSERT 오류 시 주문·항목 롤백을 확인합니다. 테스트는 생성한 테스트 고객 데이터만 정리합니다.

Firebase Spark, Vercel Hobby, 외부 무료 MySQL을 사용하는 개인용 데모입니다. 실제 카드 결제는 없으며 카드 번호를 입력받지 않습니다. 과거 functions 소스와 전달 관련 단위 테스트는 참고용으로 남아 있습니다. 운영 동기화 API는 410을 반환합니다.


## 처음 확인할 화면과 영상 시나리오

| 확인할 것 | 주소·문서 | 내용 |
| --- | --- | --- |
| 고객 스토어 | [고객 화면](https://paybridge-mock.web.app/) | 상품 선택·수량·동의·모의 결제·영수증 |
| 판매자 센터 | [판매자 화면](https://paybridge-mock.vercel.app/) | 판매자 로그인·매출 카드·차트·거래 목록 |
| MySQL 테이블 조회 | [MySQL Workbench 무료 다운로드](https://dev.mysql.com/downloads/workbench/) | 설치 → Aiven DB 연결 → SCHEMAS → Tables → 행 조회 |
| 개발자 영상 | [영상 촬영 시나리오](docs/VIDEO-SCENARIOS.md) | 약 7분: 호스팅·DB 역할, 설계 변경, 트랜잭션·재시도 |
| 의뢰인 영상 | [영상 촬영 시나리오](docs/VIDEO-SCENARIOS.md) | 약 4분: 상품 선택 → 24,000원 모의 결제 → 영수증·판매자 매출 |

영상 문서는 총 16개 장면으로, 시간·화면 조작·그대로 읽을 멘트·자막·확인 사항을 포함합니다. 의뢰인 영상을 먼저 촬영한 뒤 그 거래를 개발자 영상에서 다시 설명하도록 구성했습니다.

### 최신 화면 배포와 검증 범위 / 2026-10-23

- 고객: Firebase Hosting 배포 완료 출력과 새 상품 카드·주문 요약 화면을 확인했습니다.
- 판매자: Vercel 배포 성공 상태와 새 로그인 화면을 확인했습니다.
- 이번 화면 변경에서 고객·판매자 빌드와 기존 단위 테스트 17건이 통과했습니다.
- 운영 고객 화면에서 데일리 노트 2개 = 24,000원, 동의 체크·해제에 따른 결제 버튼 활성·비활성을 확인했습니다.
- 최신 UI 점검에서는 새 모의 결제를 생성하지 않았습니다. 판매자 실계정 로그인과 같은 거래의 매출 반영은 촬영 전 별도 확인이 필요합니다.
- 과거 운영 API 12항목 검증 결과는 이전 보고서의 기록입니다. 새 UI 배포 후 재실행한 결과로 해석하지 않습니다.


## 내 PC용 Docker MySQL과 브라우저 DB 관리

배포된 Firebase 고객 화면과 Vercel 서버는 기존 Aiven을 사용합니다. 아래 도구는 내 PC의 개발용 MySQL과 **Adminer(DB 테이블을 브라우저에서 보는 도구)**만 실행합니다. Workbench를 열 필요가 없습니다. Docker Desktop 자체도 메모리를 사용하므로 메모리 부족이 반드시 해결되는 것은 아닙니다.

### 1. 실행할 폴더부터 맞추기

**Docker Desktop을 켜고 엔진 시작을 기다린 뒤**, Git Bash에서 전체 소스 폴더로 이동합니다. 고객 배포 파일만 있는 `paybridge-customer-deploy`에서는 실행할 수 없습니다.

처음 받는 경우:

```bash
cd ~/Documents
git clone https://github.com/wevolmina/paybridge-mock.git paybridge-full
cd paybridge-full
npm install
node scripts/local-mysql.mjs up
```

이미 `paybridge-full`을 받은 경우:

```bash
cd ~/Documents/paybridge-full
git pull --ff-only
node scripts/local-mysql.mjs up
```

로컬 수정 때문에 git pull이 거절되면 파일을 강제로 지우거나 덮어쓰지 말고 변경 내용을 먼저 확인합니다. 첫 실행은 이미지 다운로드와 DB 초기화 때문에 시간이 걸립니다. 완료되면 브라우저 주소창에 **http://127.0.0.1:8081**을 입력합니다. 이 주소는 Docker를 실행한 PC에서 열립니다.

### 2. Adminer 로그인과 테이블 보기

| 로그인 칸 | 입력값 |
| --- | --- |
| 시스템 | MySQL |
| 서버 | `mysql` (Adminer도 Docker 안에 있으므로 localhost가 아닙니다.) |
| 사용자 이름 | `paybridge` |
| 비밀번호 | 실행 완료 후 터미널에 표시된 로컬 비밀번호 |
| 데이터베이스 | `payment_bridge_local` |

로그인 → 테이블 목록에서 **payments / orders / order_items** 선택 → **데이터 선택(Select data)**으로 행을 봅니다. 첫 시작은 빈 테이블이 정상입니다. 운영 Aiven 데이터가 자동 복사되지는 않습니다. 비밀번호를 다시 확인하려면 다음을 실행합니다. 출력은 공개 문서에 붙여넣지 않습니다.

```bash
node scripts/local-mysql.mjs info
```

DB 사용자 `paybridge`는 로컬 DB에만 접근합니다. 판매자 화면의 Firebase 이메일 계정과는 별개입니다.

### 3. 도구가 자동으로 준비하는 것

- MySQL 8.4: PC 접속 주소 `127.0.0.1:3307`. 컨테이너 메모리 상한 512MB, 버퍼 풀 128MB로 설정합니다.
- Adminer: `127.0.0.1:8081`. 컨테이너 메모리 상한 128MB입니다. Docker Desktop의 가상 머신 메모리는 별도입니다.
- DB 이름 `payment_bridge_local`과 임의의 로컬 비밀번호를 생성하고, 새 데이터 볼륨의 첫 실행에 기존 `database/001-payments.sql`과 `002-orders.sql`을 순서대로 적용합니다.
- 로컬 접속 정보와 Compose 설정은 Git에서 제외된 `.qa/local-mysql/`에 저장합니다. 이 폴더를 지우면 기존 볼륨의 비밀번호와 새 설정이 어긋날 수 있으므로 보관합니다.
- 실행이 성공하면 `apps/merchant/.env.local`의 MYSQL_* 설정을 로컬 DB로 바꿉니다. 기존 파일이 있으면 최초 1회 `.env.local.before-docker`로 백업하고, Firebase 관련 설정은 유지합니다. 기존 로컬 판매자 서버는 재시작합니다.
- 새 .env.local을 만드는 경우 Firebase 값은 비어 있습니다. Firebase 프로젝트 설정 → 일반 → 웹 앱 SDK 설정에 있는 공개 설정과 `FIREBASE_PROJECT_ID`를 채운 뒤 `npm run dev:merchant`를 실행합니다. 로컬 판매자 화면은 http://127.0.0.1:3000 입니다.

현재 고객 소스의 결제 API 주소는 배포된 Vercel 주소로 고정되어 있습니다. 따라서 **고객 화면에서 결제해도 로컬 Docker DB에는 들어오지 않습니다.** 이 도구의 완료 범위는 개발용 DB·관리 화면과 로컬 판매자 서버 DB 연결입니다. 로컬 주문부터 결제까지 별도로 시험하려면 고객 API 경로와 개발 프록시도 추가로 맞춰야 합니다. Firebase Auth·Firestore는 이 도구가 로컬로 전환하지 않습니다.

### 4. 확인·중지와 데이터 보존

```bash
node scripts/local-mysql.mjs status
node scripts/local-mysql.mjs down
```

중지해도 DB 데이터 볼륨은 남습니다. 다시 시작할 때는 `up`을 사용합니다. 데이터 삭제 옵션 `-v`는 사용하지 않습니다. 포트 충돌이면 기존 3307/8081 사용 프로그램을 확인하고, MySQL이 메모리 부족으로 종료되면 Workbench 등 다른 프로그램을 닫고 Docker Desktop의 가용 메모리를 확인합니다. 필요할 때만 실행하고 작업 후 중지합니다.

검증: 실행 파일 문법·도움말과 기존 단위 테스트 17건을 확인했습니다. 작업 환경에 Docker 엔진이 없어 실제 컨테이너 시작·초기 SQL 적용·Adminer 로그인은 아직 실행 검증하지 못했습니다.

공식 참고: [Docker MySQL 이미지](https://hub.docker.com/_/mysql/) · [Adminer 이미지](https://hub.docker.com/_/adminer/)

## MySQL과 Firebase DB 확인

### Firestore: Firebase 콘솔에서 주문 요청 보기

1. [paybridge-mock Firebase 콘솔](https://console.firebase.google.com/project/paybridge-mock/overview)을 엽니다.
2. 프로젝트를 관리하는 Google 계정으로 로그인합니다.
3. 왼쪽 Build(빌드) → Firestore Database → Data(데이터)를 엽니다.
4. 기본 데이터베이스에서 order_requests 컬렉션을 선택합니다.
5. 촬영한 주문의 문서를 열어 customerId, requestId, productId, quantity를 확인합니다.

컬렉션은 문서를 모은 묶음이고, 문서는 주문 요청 한 건입니다. order_requests에 기록이 있어도 결제 완료를 의미하지는 않습니다. 결제의 확정 기준은 MySQL입니다.

현재 결제 생성 소스에서 Firestore 문서 ID는 orderId입니다. 고객 영수증의 paymentId와 같은 이름의 문서를 찾는 방식은 아닙니다. MySQL payments 행의 order_id를 확인하면 Firestore 문서와 연결해 볼 수 있습니다.

### MySQL: 무료 MySQL Workbench로 연결해서 테이블 보기

[MySQL Workbench Community 공식 다운로드](https://dev.mysql.com/downloads/workbench/)에서 Windows용 설치 파일을 받아 설치합니다. Community 버전은 무료 DB 접속·조회 도구입니다. 이 링크는 프로그램 다운로드 페이지이며, 설치 후 기존 MySQL 서버에 연결해야 테이블을 볼 수 있습니다. 외부 Aiven DB를 조회하는 용도라면 로컬 MySQL Server를 새로 설치할 필요는 없습니다.

앞선 구성 기록의 MySQL 제공자는 Aiven입니다. Workbench 사용료와 기존 Aiven DB 서비스의 요금·무료 플랜 한도는 별개입니다. 실제 서비스 이름과 DB 이름은 계정 화면에서 확인해야 합니다. Vercel은 서버와 판매자 화면을 실행하는 곳이며, MySQL DB 자체는 외부 서비스에 있습니다.

#### 지금 올린 화면에서 시작하기

2026-10-23에 공유한 화면의 창 제목은 **Database Connection Configuration**입니다. 아래 안내는 그 화면에 실제로 보이는 이름을 기준으로 작성했습니다. 기존 안내의 Connection Name은 이 화면의 **Caption**, SSL 탭은 **TLS**, SSL CA File은 **CA Certificate Path**에 해당합니다. Connection Method에 이미 표시된 **mysql**을 사용합니다.

현재 사진에서 Caption·User Name·Host·Port는 입력되어 있지만, **TLS Mode는 Preferred이고 CA Certificate Path는 비어 있습니다.** 먼저 아래 1단계에서 인증서 파일을 준비하고 3단계에서 지정합니다. 사진만으로 Host 전체, 비밀번호, 실제 DB 이름, 연결 성공 여부는 확인할 수 없습니다.

#### 1단계. Aiven에서 값과 인증서 준비하기

1. [Aiven 콘솔](https://console.aiven.io/)을 열고 사용 중인 MySQL 서비스를 선택합니다.
2. **Overview → Connection information**에서 **Host, Port, User, Password**를 확인합니다. Workbench에 입력할 값은 이 서비스의 값입니다. Firebase·Google·판매자 로그인 비밀번호와 다릅니다.
3. 서비스 화면의 **CA certificate** 다운로드 항목에서 인증서 파일을 PC에 저장합니다. 내려받은 파일은 보통 `ca.pem` 같은 이름입니다. 이 파일은 연결 상대가 맞는 서버인지 확인하는 데 사용합니다. 다운로드 위치는 화면 구성에 따라 다를 수 있으므로 [Aiven 공식 연결 안내](https://aiven.io/docs/products/mysql/howto/connect-from-mysql-workbench)를 함께 확인합니다.
4. DB 이름은 앱 서버의 `MYSQL_DATABASE` 설정과 맞춥니다. 지금 모르겠다면 Workbench의 **Default Schema는 우선 비워도 됩니다.** 연결 후 목록에서 실제 DB를 찾을 수 있습니다.

#### 2단계. 첫 번째 사진: 기본값과 Authentication 입력하기

위에서 아래로 다음 표와 맞춥니다. 이미 입력한 칸은 Aiven의 값과 같은지만 확인합니다.

| 화면에 보이는 이름 | 쉬운 뜻 | 입력하거나 선택할 값 |
| --- | --- | --- |
| Caption | 내 PC에서 구분할 연결 별명 | `Paybridge`. DB 이름을 만드는 칸이 아닙니다. |
| Description / Tags | 설명 / 분류 표시 | 기본값을 두거나 비워도 됩니다. |
| Connection Method | 연결할 DB 종류 | 사진에 표시된 `mysql` 유지 |
| User Name | DB 사용자 이름 | Aiven의 User. 사진에는 `avnadmin`이 보이지만 실제 서비스 값과 확인합니다. |
| Host Name or IP Address | DB 서버 주소 | Aiven의 Host 전체를 복사합니다. `https://`나 비밀번호가 포함된 접속 URI 전체를 넣지 않습니다. |
| Port | 서버 접속 번호 | Aiven의 Port 숫자 그대로 입력합니다. 기본값 3306으로 바꾸지 않습니다. |
| Default Schema | 처음 열 DB 이름 | 실제 `MYSQL_DATABASE` 값. 모르면 지금은 빈칸 유지 |
| Authentication → Factor 1 | 첫 번째 로그인 방법 | 사진처럼 `password` 유지 |
| Authentication → Factor 2 / Factor 3 | 추가 로그인 방법 | Aiven에서 별도로 요구하지 않았다면 사진처럼 `None` 유지 |

**Store Password는 지금 누르지 않아도 됩니다.** 사진의 “Password will be prompted”는 연결할 때 비밀번호를 물어본다는 뜻입니다. 아래 Test Connection에서 비밀번호 입력 창이 나오면 Aiven DB 비밀번호를 직접 입력합니다. 계정 식별값이나 비밀번호를 README에 적을 필요는 없습니다.

#### 3단계. 두 번째 사진: TLS 설정하기

**Authentication 오른쪽의 TLS 탭**을 누릅니다. TLS는 **Transport Layer Security**, 즉 PC와 DB 사이의 통신을 암호화하고 서버를 확인하는 보안 방식입니다.

| 화면에 보이는 이름 | 무엇을 해야 하나요? |
| --- | --- |
| TLS Mode | 현재 `Preferred`인 드롭다운을 엽니다. 서버 인증서와 호스트 이름을 검증하는 `Verify Identity` / `VERIFY_IDENTITY` / `Require and Verify Identity`에 해당하는 항목을 선택합니다. 정확한 표기는 버전에 따라 다릅니다. 첨부 사진에는 펼친 목록이 없어 선택지의 실제 이름은 확인하지 못했습니다. |
| CA Certificate Path | 이 칸 오른쪽의 **… 버튼**을 누르고, 1단계에서 내려받은 Aiven CA 인증서 파일을 선택합니다. 예: 다운로드 폴더의 `ca.pem`. 서버 주소나 비밀번호를 쓰는 칸이 아닙니다. |
| Client Certificate Path | Aiven에서 별도 클라이언트 인증서를 요구하지 않았다면 비워 둡니다. CA 파일을 이 칸에 넣지 않습니다. |
| Client Key Path | 별도 클라이언트 개인 키를 사용하는 구성이 아니라면 비워 둡니다. |
| Permitted ciphers | 암호화 알고리즘 제한 설정입니다. 지금은 비워 둡니다. |
| Post-Quantum Cryptography 영역 | 추가 암호화 설정입니다. 사진의 기본값을 유지하며 두 체크박스를 새로 켜지 않습니다. |

`Preferred`는 서버 신원 검증을 보장하는 선택이 아닙니다. 검증 항목이 보이지 않으면 임의로 Disabled로 바꾸지 말고 프로그램의 버전과 해당 목록을 확인합니다. 기존 Workbench 8 화면이라면 **SSL → Use SSL: Require and Verify Identity → SSL CA File**이 같은 목적의 설정입니다.

#### 4단계. 연결 시험하고 저장하기

1. 창 **왼쪽 아래 Test Connection**을 누릅니다.
2. 비밀번호 창이 나오면 **Aiven DB 비밀번호**를 입력하고 확인합니다. Google이나 판매자 계정 비밀번호를 넣지 않습니다.
3. 연결 성공 메시지가 나오면 그 메시지를 닫습니다. **Test Connection은 접속 가능 여부를 시험하는 버튼**입니다.
4. 연결 설정 창 **오른쪽 아래 OK**를 눌러 연결을 저장합니다.
5. 홈의 **Database Connections** 또는 왼쪽 **CONNECTIONS**에 생긴 **Paybridge** 연결을 엽니다. 두 번 클릭해야 열리는 화면도 있습니다.

#### 5단계. 접속 후 테이블과 행 보기

아래는 연결이 성공한 다음 순서입니다. 아직 접속 후 화면은 공유되지 않았으므로 메뉴 이름은 버전에 따라 다를 수 있습니다.

1. 연결을 열고 SQL 편집기 화면으로 들어갑니다. 왼쪽 DB 목록에서 앱이 사용하는 DB를 찾습니다. Workbench 8에서는 **SCHEMAS** 탭입니다. Schema(스키마)는 여기서는 테이블을 담은 DB 묶음으로 이해하면 됩니다.
2. DB 이름 왼쪽의 펼침 표시 → **Tables**를 엽니다. 목록이 비어 보이면 새로고침하고, 실제 `MYSQL_DATABASE` 값과 같은 DB인지 확인합니다.
3. **payments**를 우클릭 → **Select Rows - Limit 1000**을 누르면 저장된 결제 행을 표로 볼 수 있습니다. 같은 방식으로 **orders**, **order_items**도 확인합니다. 메뉴가 다르면 아래 SQL 방법을 사용합니다.
4. 테이블의 **Columns**를 펼치면 열 이름과 구조를 확인할 수 있습니다. 데이터 표를 열었을 때 0행이면 연결 실패와는 다릅니다. 해당 DB나 테이블에 아직 기록이 없을 수 있습니다.

DB 목록이나 테이블 메뉴를 찾기 어렵다면 SQL 편집기의 새 쿼리 탭에서 다음을 **한 문장씩 선택하여 실행**합니다. Workbench 8에서는 선택한 SQL 실행 단축키가 **Ctrl+Enter**입니다. 다른 버전에서는 실행 버튼 또는 실행 메뉴를 사용합니다.

```sql
-- 1. 현재 계정에서 볼 수 있는 DB 목록
SHOW DATABASES;

-- 2. 아래 이름을 실제 MYSQL_DATABASE 값으로 바꾼 뒤 실행
USE `실제_DB_이름`;

-- 3. 선택한 DB의 테이블 목록
SHOW TABLES;

-- 4. 열 이름과 자료형 확인
DESCRIBE payments;

-- 5. 최근 결제 10건 확인
SELECT payment_id, order_id, amount, status, created_at
FROM payments
ORDER BY created_at DESC
LIMIT 10;
```

`실제_DB_이름`은 예시 자리표시자입니다. 이 글자 그대로 실행하지 않습니다. DB 이름을 모르면 1번 결과와 서버의 `MYSQL_DATABASE` 값을 비교한 뒤 2번을 실행합니다. `USE`는 이번 쿼리 창에서 사용할 DB를 고를 뿐, 데이터를 변경하지 않습니다.

#### 막혔을 때 확인하기

| 보이는 메시지·상태 | 먼저 확인할 것 |
| --- | --- |
| 비밀번호를 입력하라고 나옴 | 연결 과정의 정상적인 요청일 수 있습니다. Aiven DB 비밀번호를 입력합니다. |
| Access denied | DB User와 Password를 다시 확인합니다. 판매자 로그인 정보와 구분합니다. |
| Can't connect / timeout | Aiven 서비스 실행 상태, Host 전체, Port, 네트워크·서비스 접근 제한을 확인합니다. |
| Certificate / TLS / SSL 오류 | 해당 Aiven 서비스의 CA 파일과 Host를 확인합니다. 인증서 파일이 PC에서 이동·삭제되지 않았는지도 확인합니다. |
| Unknown database | Default Schema 또는 USE의 DB 이름을 실제 MYSQL_DATABASE 값과 맞춥니다. 모르면 Default Schema를 비우고 연결합니다. |
| No database selected | 먼저 실제 DB를 선택하거나 USE 문을 실행합니다. |
| 테이블이 없거나 목록이 다름 | 다른 DB를 선택했는지, 현재 사용자에게 조회 권한이 있는지 확인합니다. 조회만 하려는 상황에서 마이그레이션을 다시 실행하지 않습니다. |

이 안내는 첨부한 두 설정 화면과 공식 연결 문서를 기준으로 작성했습니다. 이번 README 수정에서 사용자의 PC에 접속하거나 실제 DB 연결을 시험한 것은 아닙니다.

| 테이블 | 저장하는 내용 | 촬영에서 보여줄 부분 |
| --- | --- | --- |
| orders | 확정 주문 | order_id, request_id, amount, status |
| order_items | 구매한 상품과 수량 | order_id, product_name, unit_price, quantity |
| payments | 확정 모의 결제 | payment_id, order_id, amount, status |

조회 예시입니다. 연결한 DB를 먼저 선택하고 실행합니다. 데이터를 바꾸지 않는 SELECT만 사용합니다.

    SELECT payment_id, order_id, product_name, quantity, amount, status, created_at
    FROM payments
    WHERE merchant_id = 'studio-mina'
    ORDER BY created_at DESC
    LIMIT 10;

촬영에서는 Aiven 비밀번호·접속 URI·Authorization 헤더를 보여주지 않습니다. 주문을 확인할 때는 해당 거래만 조회하고 고객 식별값을 가립니다.

공식 안내:

- [Firebase 콘솔에서 Firestore 관리](https://firebase.google.com/docs/firestore/using-console?hl=ko)
- [MySQL Workbench Community 무료 다운로드](https://dev.mysql.com/downloads/workbench/)
- [Aiven MySQL과 MySQL Workbench 연결](https://aiven.io/docs/products/mysql/howto/connect-from-mysql-workbench)
- [Aiven MySQL과 DBeaver 연결](https://aiven.io/docs/products/mysql/howto/connect-with-dbeaver)



## 판매자 테스트 계정과 권한

2026-10-23 Firebase Authentication 사용자 목록에서 기존 이메일 계정 1개를 확인했습니다. 이 작업에서 새 계정을 만들거나 판매자 클레임을 등록한 것은 아닙니다. 계정 이메일·비밀번호는 공개 README에 싣지 않습니다. 이메일 계정의 존재만으로 판매자 권한이 있다고 판단할 수 없습니다. Google Cloud Shell은 현재 작업 브라우저에서 Site Unavailable로 열리지 않아 권한 등록을 완료하지 못했습니다.

| 항목 | 현재 안내 |
| --- | --- |
| 로그인 이메일 | Firebase Authentication에서 기존 이메일 계정 확인. 실제 이메일은 콘솔에서 확인 |
| 비밀번호 | 공개 README에 기록하지 않음. 생성 시 정한 값을 별도로 관리 |
| 판매자 권한 | merchant_id=studio-mina |
| studio-mina의 의미 | 로그인 아이디가 아니라 이 스토어의 매출을 조회할 권한 값 |
| 일반 이메일 계정만 있는 경우 | 로그인은 가능해도 판매자 권한이 없으면 매출 조회가 거절됨 |

### Missing script 오류와 관리자 인증 준비

`npm error Missing script: "merchant:grant"`는 현재 폴더의 package.json에 명령이 없다는 뜻입니다. 위 Docker 안내처럼 전체 소스의 **paybridge-full 루트**로 이동하고 최신 코드를 받은 뒤 `npm run`으로 명령 목록을 확인합니다. 바로 실행할 파일은 `scripts/grant-merchant.mjs`입니다.

권한 등록에는 Firebase 관리자 인증이 필요합니다. `firebase login`만으로 준비되는 것은 아닙니다. 이미 승인된 서비스 계정 키 파일이 있다면, Git Bash에서 경로를 지정한 뒤 아래 명령을 실행합니다.

```bash
# 실제 보관 경로와 실제 UID로 바꿉니다.
export GOOGLE_APPLICATION_CREDENTIALS="C:/본인_보관_폴더/firebase-admin.json"
FIREBASE_PROJECT_ID=paybridge-mock node scripts/grant-merchant.mjs "실제_UID" studio-mina
```

키가 없다면 프로젝트 소유자가 Firebase 프로젝트 설정 → 서비스 계정 → Firebase Admin SDK에서 관리자 인증을 준비해야 합니다. 새 비공개 키를 발급하면 본인 PC의 저장소 밖에 보관하고 위 경로로 지정합니다. 키 내용은 채팅·GitHub·README에 붙여넣지 않습니다. 이 권한 등록은 판매자 매출 접근 권한을 부여합니다. 명령 실행 전 본인이 관리하는 테스트 계정 UID인지 확인합니다. 완료 후 판매자 화면에서 로그아웃하고 다시 로그인합니다.

### 준비 순서

1. Firebase 콘솔에서 paybridge-mock 프로젝트 → Authentication → Users(사용자)를 엽니다.
2. 테스트용 이메일 계정이 이미 있는지 확인합니다. 없다면 Add user(사용자 추가)로 본인이 관리하는 테스트 이메일과 비밀번호를 등록합니다. 비밀번호 입력은 녹화 밖에서 진행합니다.
3. 해당 계정의 UID(사용자 고유 식별값)를 확인합니다.
4. 이 프로젝트의 Firebase Authentication 관리 권한이 있는 인증 환경에서 저장소 루트의 아래 명령을 실행합니다. 실제_UID 부분을 방금 확인한 UID로 바꿉니다. 별도 웹 로그인으로 판매자 권한이 자동 부여되지는 않습니다.

    FIREBASE_PROJECT_ID=paybridge-mock npm run merchant:grant -- "실제_UID" studio-mina

이 명령은 Git Bash용입니다. 먼저 npm install이 되어 있어야 하며, 스크립트는 Application Default Credentials(기본 애플리케이션 인증 정보)를 사용합니다. firebase login 성공만으로 이 관리자 인증이 준비됐다고 단정할 수 없습니다. 승인된 관리자 인증이 없으면 관리자 환경을 먼저 준비해야 합니다. 서비스 계정 비밀 키를 README나 저장소에 올리지 않습니다.

5. 권한 등록이 끝나면 판매자 화면에서 로그아웃 후 다시 로그인합니다.
6. 매출 카드·차트·거래 목록이 정상 조회되는지 확인한 뒤 촬영을 시작합니다.

비밀번호나 ID 토큰을 채팅 또는 공개 문서에 붙여넣지 않습니다. 이 문서를 올리는 작업에서는 계정 생성이나 관리자 권한 부여를 수행하지 않습니다.
