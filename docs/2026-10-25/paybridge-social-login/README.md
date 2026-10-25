# 고객·판매자·관리자 구글 / 카카오 / 네이버 간편로그인

기준: 2026-10-25 한국 시간. 고객·관리자 로그인 UI와 연결 서버를 구현했다. 판매자도 간편로그인과 기존 이메일 로그인을 함께 제공한다. [판매자 확장과 최신 검증 기록](../paybridge-seller-social-login/README.md)을 확인한다. 서비스별 실제 활성화와 운영 계정 로그인 확인은 코드 구현·자동 배포와 별도다.

## 달라지는 화면과 계정 보호

- 고객: 세 간편로그인 버튼, 계정 안내와 로그아웃을 추가했다. 로그인 없이 공간 체험·비회원 모의 주문을 유지한다.
- 판매자: 기존 Vercel 주소에서 세 버튼과 이메일 로그인을 제공하며, DB의 활성 판매자 역할로 매출 접근을 확인한다.
- 관리자: 세 버튼과 기존 이메일 로그인을 함께 제공한다. 로그인 성공 뒤에도 기존 DB의 활성 관리자 역할을 확인한다.
- 설정이 없거나 읽히지 않으면 해당 버튼을 ‘연결 준비 중’으로 비활성화한다. 팝업 차단·취소·시간 초과·계정 충돌은 안내한다. 팝업을 차단하는 앱 내 브라우저에서는 일반 브라우저로 접속해 확인한다.
- 로그인 중 주문·선택 변경을 잠근다. 고객 계정이 바뀌면 이전 영수증·확인 상태를 지우고 동의를 다시 받는다.
- Google은 Firebase 공식 팝업 로그인을 사용한다. 비회원 계정에는 공식 연결 기능을 사용해 같은 사용자 번호를 유지한다. 이미 다른 계정에 연결된 경우 자동으로 합치지 않는다.
- 카카오·네이버는 별도 공급자 계정으로 로그인한다. 기존 비회원 주문이 있으면 전환을 막는다. 주문 이전·계정 합치기는 구현하지 않았다. 이메일이 같다는 이유로 관리자 권한을 부여하지 않는다.

## 1. Google 활성화

[Firebase 로그인 방법](https://console.firebase.google.com/project/paybridge-mock/authentication/providers) → 새 제공업체 추가 → Google.

1. Google 사용 설정을 켠다.
2. 공개 프로젝트 이름과 지원 이메일을 확인하고 저장한다. 기존 이메일/비밀번호·익명은 유지한다.
3. 승인 도메인에서 고객·관리자 주소를 확인한다. 관리자 도메인은 앞선 작업에서 추가했다.
4. Vercel의 기존 paybridge-mock 프로젝트 → Settings → Environment Variables → **Production**에 `SOCIAL_GOOGLE_ENABLED=true`를 저장하고 최신 main을 재배포한다.
5. 콘솔 실제 설정과 `firebase.json` 기록을 맞춘다. 이번 CI는 Hosting만 게시하며 Auth 전체를 덮어쓰지 않는다.

사용자 승인 후 Google 사용 설정을 저장했다. 공개 프로젝트 이름은 ‘페이브릿지’이며 승인된 지원 이메일을 선택했다. 기존 이메일/비밀번호·익명은 유지했다. Vercel Production의 `SOCIAL_GOOGLE_ENABLED=true` 저장과 운영 재배포, 고객·관리자 버튼 활성화까지 확인했다.

## 2. 카카오 앱 설정

[카카오 Developers](https://developers.kakao.com/)에서 본인 앱을 선택한다.

1. 카카오 로그인을 사용 설정한다.
2. 아래 Redirect URI를 정확히 등록한다.
3. REST API 키·Client Secret을 확인하고 Client Secret 기능을 사용 설정한다.
4. 불필요한 개인정보 동의 항목을 요구하지 않는다. 이 구현은 계정 구분용 사용자 번호만 사용한다.

```text
https://paybridge-mock.vercel.app/api/auth/social/callback/kakao
```

Vercel Production에 `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`을 저장한다. JavaScript 키·Admin 키를 넣는 칸이 아니다.

## 3. 네이버 앱 설정

[네이버 Developers](https://developers.naver.com/apps/#/register)에서 네이버 로그인 앱을 선택하거나 등록한다.

1. 서비스 URL은 고객 서비스 주소로 등록하고 관리자는 같은 서비스의 관리 화면으로 설명한다.
2. 아래 Callback URL을 정확히 등록한다.
3. Client ID·Client Secret을 Vercel Production의 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`에 저장한다.
4. 개발/검수 단계라면 허용된 테스트 계정과 일반 사용자 제공 가능 여부를 콘솔에서 확인한다. 코드 구현만으로 검수가 끝나는 것은 아니다.

```text
https://paybridge-mock.vercel.app/api/auth/social/callback/naver
```

두 서비스 모두 고객·관리자 화면이 아닌 **공통 서버의 callback 주소**로 돌아온다. 서버가 로그인 시작 시 확인한 정확한 고객/관리자 창으로 결과를 전달한다.

## 4. Vercel 공통 설정

| 항목 | 설명 |
| --- | --- |
| `SOCIAL_GOOGLE_ENABLED` | Google 콘솔 설정 완료 후 true |
| `SOCIAL_AUTH_STATE_SECRET` | 요청 위조 검사용 32자 이상 임의 비밀값 |
| `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | 카카오 앱 키·Client Secret |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 앱 키·Client Secret |
| `SOCIAL_AUTH_API_ORIGIN` | `https://paybridge-mock.vercel.app` |
| `ADMIN_SITE_ORIGIN` | 기존 `https://paybridge-admin.evolvix.workers.dev` 유지 |
| Firebase 서버 인증 | 기존 `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`가 있어야 카카오·네이버 사용자용 Firebase 토큰을 서명할 수 있음 |

공통 비밀값은 본인 PC에서 다음 명령으로 생성해 Vercel에 직접 입력한다. 출력값을 GitHub나 채팅에 보내지 않는다.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

공급자 Secret과 공통 비밀값은 **Vercel 서버 전용**이다. 고객 Firebase·관리자 Cloudflare·GitHub 공개 Variables에 넣지 않는다. `NEXT_PUBLIC_`·`VITE_` 접두사를 붙이지 않는다. 이 작업 때문에 기존 Firebase 서비스 계정 비밀키를 새로 만들거나 공개하지 않는다.

설정 저장 후 최신 main을 Vercel에서 재배포한다. 앱은 준비 여부만 참/거짓으로 조회하며 실제 키는 받지 않는다. 서버의 설정만 바뀌면 되므로 고객·관리자 앱을 다시 빌드해 키를 넣을 필요는 없다.

## 5. 관리자 권한과 비회원 주문

Google과 카카오·네이버는 같은 사람이어도 Firebase 사용자 번호가 다를 수 있다. 카카오·네이버는 공급자·앱·검증된 사용자 번호를 묶어 해시한 별도 사용자 번호로 로그인한다. 이름·이메일을 저장하거나 이메일만으로 기존 관리자와 연결하지 않는다.

관리자 자료를 보려면 **실제 로그인한 Firebase 사용자 번호**에 DB의 활성 관리자 역할이 있어야 한다. 이 작업에서 관리자 역할·DB 구조를 추가하거나 수정하지 않는다. 기존 이메일 로그인은 그대로 이용할 수 있다. 관리자 등록은 계정 소유자와 사용자 번호를 확인하는 별도 권한 작업이다.

비회원 주문은 원래 비회원 사용자 번호 소유다. Google 연결은 같은 번호를 유지하도록 처리하지만 계정 충돌은 자동 병합하지 않는다. 카카오·네이버 전환으로 기존 비회원 주문을 잃지 않도록 기존 비회원 주문이 있는 계정에서는 해당 전환을 막는다.

## 6. 보호 장치

- 무작위 state, 서명된 HttpOnly/Secure/SameSite=Lax 쿠키, 10분 만료, 공급자·콜백 서버·원래 사이트 주소 검사.
- 코드·Client Secret은 서버 POST 본문, 공급자 토큰은 프로필 조회 Authorization 헤더에만 사용. 고정된 공식 HTTPS 주소만 호출하며 공급자 토큰·Secret을 브라우저에 보내지 않는다.
- Firebase 로그인 토큰을 URL에 넣지 않고 정확한 원래 창에 전달한다. 받는 창은 송신 주소·팝업 객체·요청 nonce·메시지 구조를 검사한다.
- 완료 시 쿠키 만료, 주소의 code/state 제거, no-store·CSP·프레임 차단. 실패 기록에 토큰이나 공급자 응답 내용을 출력하지 않는다.
- Firebase 추가 클레임에는 공급자 구분만 넣는다. 관리자·판매자 역할은 발급하지 않는다.

## 7. 검증과 남은 일

아래는 판매자 확장 전 검증 기록이다. 최신 판매자 검증은 위 확장 가이드를 참조한다. 단위 검사 **42개** 통과. 고객·판매자·관리자 빌드 통과. 브라우저 시험용 응답으로 다음을 확인했다.

- 고객 로그인·로그아웃, 로그인 중 결제 잠금, 계정 변경 시 동의 초기화, 비회원 주문 보호.
- 잘못된 nonce 거절, 미설정 버튼 잠금, 팝업 차단 복구.
- 관리자 권한 없는 계정 차단, 로그아웃 뒤 기존 이메일 로그인 유지, 판매자 간편로그인 미노출.
- 320/390/768/1440px 가로 넘침 없음, 브라우저 실행 오류 없음.
- 기존 고객 선택·결과 재확인·영수증 복원, 두 직원 사이트의 별도 로그인·로그아웃 검사 통과.

운영 계정 로그인·주문 생성 없이 시험용 인증·공급자·업무 응답으로 확인했다. 카카오·네이버 실제 앱 등록, Google 실제 계정 연결 성공, 모바일 실제 기기의 팝업 복귀는 아직 미확인이다.

남은 순서:

1. 카카오·네이버 앱의 키·Client Secret·콜백 설정.
2. 실제 계정으로 각 로그인 취소·성공·재접속 확인.
3. 관리자 실계정의 DB 역할 확인. 공급자 간 주문 이전은 별도 기능으로 남긴다.

## 공식 근거

[Firebase Google 로그인](https://firebase.google.com/docs/auth/web/google-signin) · [계정 연결](https://firebase.google.com/docs/auth/web/account-linking) · [사용자 지정 토큰](https://firebase.google.com/docs/auth/admin/create-custom-tokens) · [카카오 REST 로그인](https://developers.kakao.com/docs/ko/kakaologin/rest-api) · [네이버 로그인 API](https://developers.naver.com/docs/login/api/api.md) · [네이버 프로필 조회](https://developers.naver.com/docs/login/profile/profile.md)

## 게시 결과 · Google 활성화 완료

- [PR #3](https://github.com/wevolmina/paybridge-mock/pull/3) 병합. 기능 게시 소스는 43d3d334d3b74d0bd5f777acef0be8c27de31b59.
- [PR 검사 성공](https://github.com/wevolmina/paybridge-mock/actions/runs/40165786444). [main 검사](https://github.com/wevolmina/paybridge-mock/actions/runs/40165902555).
- [고객 자동 배포 성공](https://github.com/wevolmina/paybridge-mock/actions/runs/40165902564), Hosting 버전 61243ef01b996529.
- [관리자 자동 배포 성공](https://github.com/wevolmina/paybridge-mock/actions/runs/40165902568), Worker 버전 6f643d1d-cd5e-48ef-bd20-d0493b8b3112.
- [Vercel 배포 성공](https://vercel.com/wevolmina94-9986/paybridge-mock/GicGA95wEnqJC8c5NBCujcyGUw94).
- 운영 HTML의 고객·관리자 연결 파일이 새 빌드와 일치한다. Google 활성화 후 실제 두 사이트에서 구글 버튼이 활성화되고 카카오·네이버는 ‘연결 준비 중’임을 확인했다.
- 준비 상태 조회는 고객·관리자 두 주소에서 모두 200, Google true·Kakao false·Naver false. 기존 검사에서 허용하지 않은 주소 403, 인증 정보 없는 관리자 조회 403을 확인했다.
- **Google 설정 저장·운영 버튼 활성화를 마쳤으며 실제 개인 계정의 로그인 완료 시험과 구분한다.** 카카오·네이버는 앱 키·Secret·콜백 등록이 남았다. 비밀값을 읽거나 생성해 게시하지 않았다.

## Google 활성화 확인 · 2026-10-25

- Firebase 콘솔: Google 사용 설정됨. 기존 이메일/비밀번호·익명 사용 설정 유지.
- 승인된 공개 이름·지원 이메일을 저장하고 `firebase.json` 기록도 맞췄다. Auth 전체 배포는 수행하지 않았다.
- Vercel Production에 `SOCIAL_GOOGLE_ENABLED=true`를 Config로 저장했다.
- [운영 재배포 Ready](https://vercel.com/wevolmina94-9986/paybridge-mock/37jm4mM6ym6fVxzS3abBV3c9rWgJ), 소스 `4a77401b997cb7f0b4bfceec646b3a21790a8df7`.
- [main 검사 성공](https://github.com/wevolmina/paybridge-mock/actions/runs/40167060460), [고객 Hosting 자동 배포 성공](https://github.com/wevolmina/paybridge-mock/actions/runs/40167060473).
- 고객·관리자 실제 화면에서 구글 버튼 활성화를 확인했다. 개인 계정 로그인, 관리자 권한 추가, 주문·DB 변경은 수행하지 않았다.
