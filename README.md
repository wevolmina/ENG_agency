# Paybridge 모의 결제

Firestore는 주문 요청을 접수하고 MySQL은 확정 주문·항목·결제를 관리합니다. 고객 영수증과 판매자 대시보드는 Vercel API를 통해 동일한 MySQL 결제를 조회합니다.

- 고객 화면: https://paybridge-mock.web.app
- 판매자 화면: https://paybridge-mock.vercel.app
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
