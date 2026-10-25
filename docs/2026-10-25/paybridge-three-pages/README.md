# 페이브릿지 고객·판매자·관리자 진행 보고서

기준: 2026-10-25 한국 시간. easy-guide 적용. 세 화면의 구현·검증·게시 상태를 구분한다.

[HTML 보고서](easy-guide-paybridge-three-pages-20261025-135923.html)를 내려받아 브라우저에서 연다. 외부 글꼴·외부 스크립트 없이 작동하며, 그림 선택으로 상세가 바뀐다. 화면 모형은 실제 캡처가 아닌 코드 기반 재구성이다.

## 3줄 줄거리

1. 고객은 침실·주방 체험 후 최대 3종을 선택하고 구성·합계·동의를 확인해 모의 주문한다.
2. 판매자는 주문과 매출, 관리자는 별도 주소에서 공개 상태와 변경 이력을 확인한다.
3. 세 사이트의 게시를 마쳤으며 main의 관련 변경을 자동 배포한다. 실제 계정의 전체 기능 확인은 별도로 남았다.

이번 심화 부분은 관리자 사이트 분리다. 다음 확인 하나는 기존 관리자 계정으로 로그인하여 목록을 읽기만 하는 것이다.

| 화면 | 지금까지 반영한 내용 | 게시 | 남은 확인 |
| --- | --- | --- | --- |
| [고객](https://paybridge-mock.web.app/) | 공간 체험, 최대 3종 묶음 선택, 합계, 동의, 모의 주문·영수증 복원, 선택·완료 모션 | Firebase 성공 | 배포 뒤 실제 계정으로 전체 주문 흐름 확인 |
| [판매자](https://paybridge-mock.vercel.app/) | 주문 구성, 누적 모의 매출, 최근 100건 검색, 약 5초 확인, 새 주문 1회 강조 | Vercel 운영 게시 확인 | 실제 계정에서 같은 주문 구성 조회 |
| [관리자](https://paybridge-admin.evolvix.workers.dev/) | 별도 Cloudflare 주소·로그인 상태, 공간 카드·필터, 공개 변경·타임라인, 역할별 알림 | Cloudflare 성공 | 실계정 조회·변경 미시험. 공개 상태 변경은 현재 침실만 지원 |

## 고객에서 확인할 것

공간 체험에서 조명·센서를 바꿔 보고 스토어에서 구성·합계를 확인한다. 데스크는 입체 화면이 아닌 그림의 가상 집중 모드다. 구성 변경 시 동의를 다시 받으며, 결과를 놓치면 같은 주문 결과를 재확인한다. 완료 모션은 서버 승인 후에만 표시하고 영수증 복원 때 반복하지 않는다.

## 판매자에서 확인할 것

승인된 계정으로 로그인하고 주문·결제 내역에서 같은 주문을 찾는다. 최근 100건 검색과 전체 기간 누적 매출의 범위를 구분한다. 새 주문만 한 번 강조하며 최초 조회·동일 응답에는 반복 알림이 없다. 숨긴 탭에서는 확인 작업을 멈춘다.

## 관리자에서 확인할 것

Cloudflare 별도 주소에서 기존 관리자 계정으로 로그인한다. 전체 / 스토어 공개 / 구매 중지 필터를 사용한다. 공개 변경의 현재 지원 대상은 침실 패키지다. 주방·데스크 공개 변경, 계정 권한 편집, 승인·정산·취소·환불 업무를 완료한 것은 아니다. 관리 화면만 옮겼으며 서버와 MySQL 연결은 Vercel에 유지한다.

## 확인 근거와 범위

- [Firebase 세 번째 실행](https://github.com/wevolmina/paybridge-mock/actions/runs/40161796367/attempts/3): 테스트 31개·고객 빌드·Hosting 게시 성공. 실제 고객 HTML과 연결 파일 확인.
- [Cloudflare 실행](https://github.com/wevolmina/paybridge-mock/actions/runs/40160606456): 관리자 게시 성공.
- [최신 전체 검사](https://github.com/wevolmina/paybridge-mock/actions/runs/40163638062): 성공.
- [모션·사용성 변경 기록](https://github.com/wevolmina/paybridge-mock/blob/d5da25f3ad3576c020b44b44b2b9e47e81e87d4a/docs/2026-10-25/paybridge-motion-ux/README.md), [검증 기록](https://github.com/wevolmina/paybridge-mock/blob/d5da25f3ad3576c020b44b44b2b9e47e81e87d4a/docs/2026-10-25/paybridge-motion-ux/verification.md): 시험용 인증·자료로 화면과 모션 확인, 320·390·768·1440픽셀 가로 넘침 없음. 실물 휴대폰 전체 시험은 아님.
- [관리자 분리 기록](https://github.com/wevolmina/paybridge-mock/blob/d5da25f3ad3576c020b44b44b2b9e47e81e87d4a/CLOUDFLARE_ADMIN.md), [배포 기록](https://github.com/wevolmina/paybridge-mock/blob/d5da25f3ad3576c020b44b44b2b9e47e81e87d4a/docs/DEPLOYMENT_PROGRESS_2026-10-25.md): 주소 이동·허용된 연결·비로그인 조회 차단 확인. 실제 계정 조회·변경과 전체 주문 흐름 시험은 별도.
- 이 보고서 작성 중 운영 주문·결제·공개 상태를 바꾸지 않았다. 모의 결제는 실제 청구가 없지만 주문 기록은 저장된다.

## 보고서 자체 검사

[보고서 자체 검증 기록](verification.md)에 클릭·키보드·네 화면 폭·인쇄 검사를 남겼다. HTML과 이 문서의 사실·상태는 같은 기준이다. 외부 알림 발송이나 수신 확인은 수행하지 않았다.
