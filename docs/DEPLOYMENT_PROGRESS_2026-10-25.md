# 페이브릿지 자동 배포 진행 결과 · 2026-10-25

## 완료

- PR #1은 앱 변경까지 병합됐으며, 그 뒤 추가한 자동 배포 파일은 PR #2로 병합했다.
- 첫 GitHub 검사에서 package-lock.json 누락을 확인해 추가했다. 깨끗한 설치와 PR 검사에서 테스트 31개·세 앱 빌드가 통과했다.
- 관리자·판매자 앱 배포 소스: `21073fefa08613a375cbd9c24d1745e77afd7a5d`.
- 고객 Firebase 자동 배포: [세 번째 실행 성공](https://github.com/wevolmina/paybridge-mock/actions/runs/40161796367/attempts/3). 소스 `518f04de1bb91659902b288e59efeaae853a85d1`, Hosting 버전 `1476f66f63ada150`, 2026-10-25 13:53 한국 시간.
- Cloudflare 관리자: https://paybridge-admin.evolvix.workers.dev/ . [Actions 성공 기록](https://github.com/wevolmina/paybridge-mock/actions/runs/40160606456). Worker 버전 `20009ec2-5f38-4485-a707-039f23042106`.
- Vercel Production에 `ADMIN_SITE_ORIGIN`, `NEXT_PUBLIC_ADMIN_SITE_URL`을 위 Origin으로 저장했다. [재배포 Ready 확인](https://vercel.com/wevolmina94-9986/paybridge-mock/EDwRkhXJLfmTjS55krBqidVkKi3x).

## 운영 HTTP 검사

| 항목 | 실제 결과 |
| --- | --- |
| 기존 Vercel `/admin` | 307, Location이 새 Cloudflare 관리자 주소 |
| 새 관리자 Origin의 API OPTIONS | 204, 허용 Origin이 정확한 새 관리자 주소 |
| 다른 Origin의 API OPTIONS | 403 |
| 토큰 없는 관리자 API GET | 403 |
| 고객 Firebase `/` | 200, 최신 빌드의 `store-C4dIVNeI.js`·`store-C4Y4sApf.css` 참조 |
| 고객 JS·CSS 직접 요청 | 모두 200, 각각 JavaScript·CSS Content-Type |
| 고객 `/spaces/bedroom` 직접 요청 | 200, 같은 앱 HTML 반환(SPA fallback) |

관리자 화면은 접속 확인했다. 실제 관리자 계정의 로그인·DB 조회·변경은 시험하지 않았다. 모의 주문이나 운영 DB 변경은 생성하지 않았다.

## Firebase 재실행 성공

처음 두 실행은 Hosting 게시 단계에서 `serviceusage.services.get` 부족으로 403이 발생했다. 사용자가 서비스 계정 권한을 추가한 뒤 같은 소스의 실패 작업을 다시 실행했다.

[세 번째 실행](https://github.com/wevolmina/paybridge-mock/actions/runs/40161796367/attempts/3)은 설정 검사·npm ci·테스트 31개·고객 빌드·Hosting live 게시를 모두 통과했다. Secret 값을 읽거나 새 키를 만들지 않았다. 운영 고객 사이트의 HTML과 JS·CSS 응답이 해당 빌드 결과와 일치한다.

권한 누락을 예방하려면 개인 Google 계정이 아니라 GitHub Secret에 등록한 배포 서비스 계정에 **Service Usage Viewer**(`roles/serviceusage.serviceUsageViewer`)가 있는지 확인한다.

사용자가 새 관리자 도메인 추가를 승인한 뒤 Firebase 승인 도메인 목록에 `paybridge-admin.evolvix.workers.dev`를 저장했고 목록의 Custom 행에서 확인했다. `firebase.json`에도 같은 호스트를 추가했다. 계정·역할·로그인 제공자는 변경하지 않았다.

## 남은 기능 확인

자동 배포 연결과 세 사이트의 게시 확인을 마쳤다. 기존 관리자 계정의 실제 로그인·조회 및 구매자·판매자의 전체 주문 흐름은 별도 기능 확인이 필요하다. 이번 배포 확인에서는 운영 주문이나 DB 변경을 생성하지 않았다.
