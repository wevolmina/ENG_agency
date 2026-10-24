# Paybridge 모의 구매 소스 및 수동 배포 안내

2026-10-24 · 사용자가 직접 배포하기 위한 인계 문서

## 게시 범위와 현재 상태

구매자 스토어의 침실 패키지 선택 → 99,000원 모의 결제 → 완료 화면, 판매자 주문·모의 매출, 관리자 주문·패키지 공개 관리 소스를 포함합니다. 세 화면은 Firebase Hosting 구매자 사이트, Vercel 판매자 `/`, 같은 Vercel 프로젝트의 관리자 `/admin`입니다.

로컬 일반 테스트 18개, TypeScript 검사, 구매자 및 판매자·관리자 빌드가 통과했습니다. Firestore 규칙은 dry-run 컴파일만 통과했으며 보안 동작 테스트, 실제 새 MySQL 통합, 운영 브라우저 흐름은 미검증입니다. 새 DB 생성, 역할 부여, 기존 데이터 삭제는 실행하지 않았습니다. 이 소스를 올리는 것은 운영 전환 완료를 뜻하지 않습니다.

`apps/merchant/vercel.json`의 `git.deploymentEnabled=false`로 GitHub 푸시 자동 배포를 끕니다. 수동 배포 요청을 반영한 설정입니다. 기존 프로젝트 Root Directory는 `apps/merchant`인지 확인하세요. 프로젝트를 새로 만들지 않고 기존 `paybridge-mock`에 연결하세요.

## 1. 새 DB 준비

기존 프로젝트의 MySQL 연결 정보를 안전한 로컬 환경 변수로 설정합니다. 비밀번호나 서비스 계정은 저장소에 넣지 않습니다. `MYSQL_DATABASE`에는 **기존 DB 이름**을 둡니다. 기존 판매자 계정의 정확한 Firebase UID를 확인합니다. 로그인 계정이나 Auth 설정은 초기화하지 않습니다.

추가 환경 변수:

| 변수 | 값 |
|---|---|
| SMARTSPACE_NEW_DATABASE | 기존 DB와 다른 `paybridge_smartspace_`로 시작하는 새 이름 |
| SMARTSPACE_SELLER_UID | 확인한 기존 판매자의 Firebase UID |
| SMARTSPACE_PROVISION | `CREATE_NEW_EMPTY_DATABASE` |

저장소 루트에서 `node scripts/provision-smartspace.mjs`를 실행합니다. 새 스키마와 침실 패키지, 판매자·관리자 역할 두 행을 만듭니다. 기존 DB를 삭제하거나 복사하지 않습니다. 이미 있는 대상 DB는 거절합니다. 중간 실패 시 DB가 일부 생성돼 있을 수 있으므로 자동 재실행·덮어쓰기를 하지 말고 상태를 먼저 확인하세요.

기존 `db:migrate`와 `merchant:grant`는 이전 구조용입니다. 이번 새 DB와 관리자 권한 준비에 사용하지 마세요. 실제 MySQL 검증은 별도의 비어 있는 `_test`로 끝나는 DB와 `RUN_MYSQL_INTEGRATION=true`로 `npm run test:integration`을 실행해야 합니다. 테스트가 환경 변수 없이 건너뛰어진 것은 통과 증거가 아닙니다.

## 2. 서버와 보안 규칙

Vercel 기존 프로젝트에서 `apps/merchant/.env.local.example`에 있는 설정을 점검합니다. 특히 `MYSQL_DATABASE`를 검증한 **새 DB 이름**으로 바꿉니다. 기존 Firebase 프로젝트 설정과 인증 검증에 사용하는 서버 설정을 유지합니다. `.env`를 GitHub에 올리지 않습니다.

Firestore 새 `smartspace_order_requests` 규칙의 에뮬레이터 테스트를 먼저 실행합니다. `FIRESTORE_EMULATOR_HOST`가 있어야 `tests/integration/smartspace-rules.test.ts`가 실행됩니다. 규칙 확인 후 `firebase deploy --only firestore:rules --project paybridge-mock`로 규칙만 배포합니다. 광범위한 `deploy:firebase` 스크립트는 Auth까지 포함하므로 이번에는 사용하지 마세요.

Vercel CLI에서 기존 프로젝트에 연결된 것을 확인한 뒤 수동 production 배포합니다. 프로젝트의 Root Directory와 환경 변수 적용 범위를 확인하고 배포 로그를 확인합니다. Git 자동 배포는 꺼져 있으므로 푸시 후 자동 반영을 기다리는 방식이 아닙니다.

## 3. 구매자 사이트

`apps/customer/.env.example` 또는 기존 배포의 Firebase 공개 웹 설정을 사용해 구매자 앱을 빌드합니다. `npm run build --workspace @bridge/customer`가 성공하면 `firebase deploy --only hosting --project paybridge-mock`로 구매자 사이트만 배포합니다.

대상 주소:

- 구매자: https://paybridge-mock.web.app/
- 침실 체험: https://paybridge-mock.web.app/bedroom/
- 판매자: https://paybridge-mock.vercel.app/
- 관리자: https://paybridge-mock.vercel.app/admin

## 4. 실제 연결 확인 후에만 기존 기록 정리

1. 구매자에서 99,000원 모의 주문을 한 번 완료하고 주문·결제 번호를 확인합니다.
2. 같은 요청 재시도가 같은 번호를 반환하며 중복 주문이 없는지 확인합니다.
3. 기존 판매자 계정으로 판매자·관리자에서 같은 주문 번호와 금액을 확인합니다.
4. 일반 구매자가 판매자·관리자 API를 읽을 수 없는지 확인합니다.
5. 관리자에서 공개 중단 시 새 주문은 차단되고 기존 완료 주문 재확인은 가능한지 확인합니다. 다시 공개합니다.
6. 이전 Functions `createPayment` 등 기존 Firestore 쓰기 경로의 실제 배포 여부를 조사하고 닫습니다. 현재 목록 조회가 실패해 배포 여부는 미확인입니다. 현재 규칙은 전환을 위해 기존 `order_requests` 쓰기도 허용하므로 최종 전환 시 해당 레거시 권한을 제거하고 검증해야 합니다.
7. 위 검증 이후에만 정확히 식별된 **기존** MySQL DB와 **기존** Firestore 컬렉션 기록을 삭제합니다. 사용자 결정대로 백업은 만들지 않습니다. 새 DB·`smartspace_order_requests`·Firebase Auth 계정은 삭제 대상이 아닙니다.

전환 검증이 실패하면 기존 데이터 삭제를 중단합니다. 실제 결제, 카드 정보 수집, 배송, 기기 연결은 이 구현에 포함하지 않습니다.

## 근거

- 새 DB: `database/smartspace-v2.sql`
- 준비 스크립트: `scripts/provision-smartspace.mjs`
- 구매 화면: `apps/customer/src/SmartspaceApp.tsx`
- 주문 처리: `apps/merchant/lib/checkout.ts`
- 역할 확인: `apps/merchant/lib/staff.ts`
- 판매자·관리자: `apps/merchant/app/StaffDashboard.tsx`
- 자동 배포 설정: https://vercel.com/docs/project-configuration/git-configuration

기존 진행 보고서는 당시의 대기 상태를 보존합니다. 이번 게시 이후에는 팀 초대가 소스 다운로드의 선행 조건이 아닙니다. 배포는 사용자가 직접 수행합니다.
## 배포 계정
이 프로젝트의 수동 배포는 GitHub wevolmina와 연결된 Vercel 계정에서 진행합니다.
