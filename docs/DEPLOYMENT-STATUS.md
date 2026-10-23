# 배포 결과 — 2026-10-23

고객: https://paybridge-mock.web.app

판매자: https://paybridge-mock.vercel.app

## 완료

- Firebase Hosting, Firestore 보안 규칙, 기본 Auth 배포 완료. Cloud Functions는 배포 대상에서 제외.
- Cloud Shell 새 터미널의 기존 ADC 인증으로 배포했으며, 별도 서비스 계정 키를 생성하지 않음.
- Vercel 인증 수정 코드 2c5a5ac6d571bb97be6d4c5de5019216f79280d4 Production Ready 확인.
- 운영 MySQL orders/order_items 테이블 추가. 기존 데이터 보존.
- 익명 계정 validSince 생략 시 인증 실패하던 오류 수정. 토큰 서명 검증·온라인 계정 조회·폐기 검사 유지.
- 단위 테스트 17건 통과. 신규 Firestore 보안·실제 MySQL 통합 테스트 각각 1건 통과.
- 운영 API 확인 12항목 통과: 익명 인증, 비인증 차단, 금액 변조 차단, 결제, Firestore 접수, CORS, 동일 요청 재시도, 내용 충돌 거절, 영수증 조회, 다른 고객 차단, 판매자 클레임 필요, 사전 요청.
- 실제 브라우저에서 24,000원 모의 결제·MySQL 영수증 표시·새로고침 후 복원 확인.

## 검증 결과와 제한

[기계 판독 결과](verification-2026-10-23.json)

모의 거래 2건을 운영 DB에 남겼습니다. API 검증 12,000원, 브라우저 검증 24,000원이며 실제 카드 청구는 없습니다. 익명 인증 확인 과정에서 생성한 테스트 계정도 남아 있습니다.

판매자 실제 로그인 및 차트 시연은 판매자 계정과 merchant_id 클레임 준비 후 별도로 확인해야 합니다. API가 권한 없는 계정에 403을 반환하는 것은 검증했습니다. MySQL 판매자 분리는 격리 DB 통합 테스트에서 확인했습니다.

Firebase와 MySQL은 분산 트랜잭션을 사용하지 않습니다. Firestore 접수 실패 시 신규 확정을 시작하지 않고, MySQL 실패 시 SQL 작업 전체를 롤백합니다. 자동 복구 큐는 없으며 같은 요청 번호로 재시도합니다.

## 재개 시 위치

Cloud Shell: ~/paybridge-deploy. 기존의 로그인 코드 대기 중인 터미널 0/1 대신, 새로 만든 터미널에서 ADC 인증을 확인한 뒤 CLI를 실행합니다.

- /tmp/paybridge-final-deploy.log
- /tmp/paybridge-final-hosting-build.log
- /tmp/paybridge-final-merchant-build.log
- /tmp/paybridge-final-unit.log
- /tmp/paybridge-live-smoke.log

운영 API 검증을 다시 실행하면 모의 결제가 추가되므로 필요할 때만 실행합니다. 비밀번호·ID 토큰은 로그나 소스에 저장하지 않습니다.
