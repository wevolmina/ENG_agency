# 페이브릿지 자동 배포 진행 결과 · 2026-10-25

## 완료

- PR #1은 앱 변경까지 병합됐으며, 그 뒤 추가한 자동 배포 파일은 PR #2로 병합했다.
- 첫 GitHub 검사에서 package-lock.json 누락을 확인해 추가했다. 깨끗한 설치와 PR 검사에서 테스트 31개·세 앱 빌드가 통과했다.
- 배포 코드 main: `21073fefa08613a375cbd9c24d1745e77afd7a5d`.
- Cloudflare 관리자: https://paybridge-admin.evolvix.workers.dev/ . [Actions 성공 기록](https://github.com/wevolmina/paybridge-mock/actions/runs/40160606456). Worker 버전 `20009ec2-5f38-4485-a707-039f23042106`.
- Vercel Production에 `ADMIN_SITE_ORIGIN`, `NEXT_PUBLIC_ADMIN_SITE_URL`을 위 Origin으로 저장했다. [재배포 Ready 확인](https://vercel.com/wevolmina94-9986/paybridge-mock/EDwRkhXJLfmTjS55krBqidVkKi3x).

## 운영 HTTP 검사

| 항목 | 실제 결과 |
| --- | --- |
| 기존 Vercel `/admin` | 307, Location이 새 Cloudflare 관리자 주소 |
| 새 관리자 Origin의 API OPTIONS | 204, 허용 Origin이 정확한 새 관리자 주소 |
| 다른 Origin의 API OPTIONS | 403 |
| 토큰 없는 관리자 API GET | 403 |

관리자 화면은 접속 확인했다. 실제 관리자 계정의 로그인·DB 조회·변경은 시험하지 않았다. 모의 주문이나 운영 DB 변경은 생성하지 않았다.

## Firebase 중단 지점

[고객 배포 실행 기록](https://github.com/wevolmina/paybridge-mock/actions/runs/40160606416)에서 설정 검사·npm ci·테스트·고객 빌드는 통과했으나, Hosting 게시 단계가 403으로 실패했다.

부족한 권한: `serviceusage.services.get`.

기존 GitHub 배포 서비스 계정에 **Service Usage Viewer**(`roles/serviceusage.serviceUsageViewer`)를 추가해야 한다. 서비스 상태를 읽는 역할이며 Owner·Editor를 새로 부여할 필요는 없다. 현재 작업 브라우저에서 Google Cloud IAM 페이지가 Site Unavailable로 열리지 않아 권한 변경을 수행하지 못했다. Secret을 다시 만들거나 값을 채팅에 보낼 필요는 없다.

역할 보완 후 기존 실패 실행의 Re-run failed jobs를 사용할 수 있다. 이후 main 변경이 배포 대상 파일을 바꿨다면 최신 main으로 Run workflow를 실행한다.

Firebase 인증의 새 관리자 호스트 승인 추가도 아직 저장하지 않았다. 입력안은 `paybridge-admin.evolvix.workers.dev`이며 OAuth 로그인 허용 범위 변경에 대한 사용자 확인 후 반영한다. 현재 이메일·비밀번호 로그인과 관리자 역할 검사를 새로 허용하는 조치는 아니다.

## 다음 단계

1. 기존 배포 서비스 계정에 API 상태 조회 역할 추가.
2. 사용자 확인 후 Firebase 승인 도메인에 새 관리자 호스트 추가하고 firebase.json 기록도 맞춤.
3. 실패한 Firebase 배포 재실행·Hosting 성공 확인.
4. 관리자 기존 계정의 실제 조회와 구매자·판매자 최종 화면 확인.
