# 3D 주문 재확인 결과 — 확인 보류

확인 시점: 2026-10-24T08:09:11.762Z

판매자 로그인은 유지되지만 주문 목록은 데이터 확인 중·연결 지연 상태다. 관리자 주문 화면은 브라우저 제어 지연 및 확장 프로그램 UI 차단으로 읽지 못했다. 양쪽 반영 성공은 확인하지 못했다.

## 현재 확인

- 상품 API /api/catalog: 503. 판매자 / 및 관리자 /admin: HTML 200만 확인.
- 기존 로컬 MySQL 주소: 시스템·Cloudflare·Google DNS에서 모두 ENOTFOUND. 직접 DB 접속도 ENOTFOUND.
- 판매자 화면: 로그아웃 버튼, 집계 —, 데이터 확인 중, 연결 지연 안내. 주문 0건 또는 삭제를 의미하지 않는다.
- Aiven 상태: 사용자가 Running/READY로 확인함. AI의 서비스 화면 직접 확인 및 현재 Host 대조는 미실행. Vercel 내부 원인은 미확인.

## 과거 근거와 구분

2026-10-24T04:45:44.212Z MySQL 직접 대조: 주문 ord_9aa48caf8745af43b319ea0d7b7340d5e6bbdab8, 결제 pay_9aa48caf8745af43b319ea0d7b7340d5e6bbdab8, 99,000원·수량 1·MOCK_APPROVED. 당시 누적 3건·297,000원. 이 값은 현재 조회 성공이나 현재 집계를 뜻하지 않는다.

## 다음 순서

1. Aiven paybridge-mysql 존재 및 Running/READY 상태 확인.
2. 현재 Host와 Vercel MYSQL_HOST 대조. 비밀번호·접속 문자열은 게시하지 않는다.
3. DNS/TLS DB 연결과 catalog 200 확인.
4. 판매자 /api/payments 및 관리자 /api/admin/overview와 실제 화면에서 동일 주문·99,000원·상태 대조.

신규 주문, DB·역할·환경 설정 변경, 삭제, 배포, 실제 결제 및 기기 연결은 이번에 수행하지 않았다. 기존 배포 소스 SHA: 9ae66fdda25eb55a0d65b2e76a08e5e406ec3904.

[클릭형 HTML 보고서](work-map-20261024171120-staff-recheck.html) · [검증 JSON](verification-20261024171120-staff-recheck.json) · [기존 보고서·소스 ZIP](README.md)

## 소스 참조

- [apps/merchant/app/StaffDashboard.tsx](https://github.com/wevolmina/paybridge-mock/blob/9ae66fdda25eb55a0d65b2e76a08e5e406ec3904/apps/merchant/app/StaffDashboard.tsx)
- [apps/merchant/lib/staff.ts](https://github.com/wevolmina/paybridge-mock/blob/9ae66fdda25eb55a0d65b2e76a08e5e406ec3904/apps/merchant/lib/staff.ts)
- [apps/merchant/lib/mysql.ts](https://github.com/wevolmina/paybridge-mock/blob/9ae66fdda25eb55a0d65b2e76a08e5e406ec3904/apps/merchant/lib/mysql.ts)
- [apps/merchant/app/api/catalog/route.ts](https://github.com/wevolmina/paybridge-mock/blob/9ae66fdda25eb55a0d65b2e76a08e5e406ec3904/apps/merchant/app/api/catalog/route.ts)
