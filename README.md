# Paybridge 모의 결제

Firestore는 주문 요청을 접수하고 MySQL은 확정 주문·항목·결제를 관리합니다. 고객 영수증과 판매자 대시보드는 Vercel API를 통해 동일한 MySQL 결제를 조회합니다.

- 고객 화면: https://paybridge-mock.web.app
- 판매자 화면: https://paybridge-mock.vercel.app
- [MySQL DB 관리 콘솔 바로가기 (Aiven)](https://console.aiven.io/) — 로그인 후 사용 중인 MySQL 서비스를 선택합니다.
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

```sh
npm run deploy:firebase
```

Firebase Hosting·Firestore·기본 Auth를 배포합니다. Functions는 배포하지 않습니다. Vercel 프로젝트는 apps/merchant를 루트로 사용하며 GitHub main 변경으로 배포합니다. MySQL은 외부 관리형 서비스에 두고 TLS 인증서를 검증합니다. DB 마이그레이션은 001과 002를 순서대로 실행하며 기존 데이터는 삭제하지 않습니다.

고객은 Firebase 익명 인증, 판매자는 이메일/비밀번호 인증 및 관리자에게 부여받은 merchant_id 클레임을 사용합니다. 클레임이 없으면 매출 조회는 거절됩니다. 관리자 자격 증명이 준비된 별도 관리 환경에서 기존 `scripts/grant-merchant.mjs`를 사용할 수 있습니다. 앱 배포 자체에는 서비스 계정 비밀 키가 필요하지 않습니다.

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
| MySQL DB 관리 | [Aiven 콘솔 바로가기](https://console.aiven.io/) | 로그인 → 조직·프로젝트 → MySQL 서비스 → Overview |
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


## MySQL과 Firebase DB 확인

### Firestore: Firebase 콘솔에서 주문 요청 보기

1. [paybridge-mock Firebase 콘솔](https://console.firebase.google.com/project/paybridge-mock/overview)을 엽니다.
2. 프로젝트를 관리하는 Google 계정으로 로그인합니다.
3. 왼쪽 Build(빌드) → Firestore Database → Data(데이터)를 엽니다.
4. 기본 데이터베이스에서 order_requests 컬렉션을 선택합니다.
5. 촬영한 주문의 문서를 열어 customerId, requestId, productId, quantity를 확인합니다.

컬렉션은 문서를 모은 묶음이고, 문서는 주문 요청 한 건입니다. order_requests에 기록이 있어도 결제 완료를 의미하지는 않습니다. 결제의 확정 기준은 MySQL입니다.

현재 결제 생성 소스에서 Firestore 문서 ID는 orderId입니다. 고객 영수증의 paymentId와 같은 이름의 문서를 찾는 방식은 아닙니다. MySQL payments 행의 order_id를 확인하면 Firestore 문서와 연결해 볼 수 있습니다.

### MySQL: Aiven 연결 정보를 이용해 조회 도구에서 보기

앞선 구성 기록의 MySQL 제공자는 Aiven입니다. 실제 서비스 이름과 DB 이름은 계정 화면에서 확인해야 합니다. Vercel은 서버와 판매자 화면을 실행하는 곳이며, MySQL DB 자체는 외부 서비스에 있습니다.

1. [Aiven 콘솔](https://console.aiven.io/)에 로그인합니다.
2. 조직 → 프로젝트 → 사용 중인 MySQL 서비스를 선택합니다.
3. Overview → Connection information에서 Host, Port, User, Database를 확인합니다. Password와 CA 인증서도 연결에 사용합니다.
4. MySQL Workbench 또는 DBeaver에서 해당 정보로 연결합니다. SSL/TLS와 CA 인증서 검증은 유지합니다.
5. 앱이 사용하는 DB를 선택한 뒤 orders, order_items, payments 테이블을 조회합니다. DB 이름을 임의로 payment_bridge 또는 defaultdb라고 단정하지 말고 실제 MYSQL_DATABASE 설정과 맞춥니다.

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
- [Aiven MySQL과 MySQL Workbench 연결](https://aiven.io/docs/products/mysql/howto/connect-from-mysql-workbench)
- [Aiven MySQL과 DBeaver 연결](https://aiven.io/docs/products/mysql/howto/connect-with-dbeaver)



## 판매자 테스트 계정과 권한

현재 이 작업에서 생성·전달한 판매자 테스트 이메일과 비밀번호는 없습니다. 기존 보고서에서도 판매자 계정·권한 준비가 남은 항목으로 기록되어 있습니다. Firebase Authentication의 실제 계정 목록은 이 문서 작성 중 별도로 열람하지 않았으므로, 이미 다른 작업에서 만든 계정이 있는지는 콘솔에서 확인해야 합니다.

| 항목 | 현재 안내 |
| --- | --- |
| 로그인 이메일 | 확인·전달된 테스트 이메일 없음 |
| 비밀번호 | 공개 README에 기록하지 않음. 생성 시 정한 값을 별도로 관리 |
| 판매자 권한 | merchant_id=studio-mina |
| studio-mina의 의미 | 로그인 아이디가 아니라 이 스토어의 매출을 조회할 권한 값 |
| 일반 이메일 계정만 있는 경우 | 로그인은 가능해도 판매자 권한이 없으면 매출 조회가 거절됨 |

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
