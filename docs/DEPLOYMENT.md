# 실제 배포 절차

현재 배포된 서비스는 없습니다. 아래 절차는 배포 준비 안내이며 성공 기록이 아닙니다.

## 1. Firebase 프로젝트

1. Firebase Console에서 `paybridge-mock` 프로젝트 생성이 확인되었습니다. 프로젝트 ID도 `paybridge-mock`입니다. `.firebaserc`의 기본 프로젝트에 연결했습니다.
2. 현재 Spark 무료 요금제이며, 웹 앱은 아직 등록되지 않았습니다.
3. Cloud Firestore 기본 데이터베이스를 생성합니다. 가급적 서울 리전을 선택합니다.
4. Authentication에서 **익명**과 **이메일/비밀번호** 로그인 제공자를 활성화합니다.
5. 웹 앱을 등록하고 `apiKey`, `authDomain`, `projectId`, `appId`를 고객·판매자 예제 환경 변수에 각각 입력합니다. 이 웹 설정값은 로그인 자격증명인 비공개 서비스 계정 키와 다릅니다.
6. Cloud Functions 및 예약 재전송 함수 배포에는 Blaze 결제 계정 연결이 필요합니다. 아직 요금제를 변경하거나 결제 계정을 연결하지 않았습니다.

## 2. 외부 MySQL

기존 MySQL 8을 사용하거나 외부 관리형 MySQL 인스턴스를 준비합니다. 공급자는 아직 선택하지 않았습니다.

- DB: `payment_bridge`, 문자 집합 `utf8mb4`
- 접속 정보: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- 인증서가 필요한 공급자는 CA 인증서를 Base64로 인코딩하여 `MYSQL_CA_BASE64`에 설정합니다.
- 외부 MySQL TLS는 켜 둡니다. 무료 여부나 비용은 공급자별로 확인해야 합니다.
- 스키마 생성용 계정과 앱 실행용 계정을 분리할 수 있습니다. 앱에는 `payments` 테이블의 SELECT·INSERT·UPDATE 권한만 부여합니다.

로컬 `.env.local`에 준비한 접속 정보를 넣은 후 다음 명령으로 테이블을 생성합니다. Node.js가 해당 파일을 읽도록 명시합니다.

```powershell
node --env-file=apps/merchant/.env.local scripts/migrate.mjs
```

## 3. Vercel 판매자 앱

이 프로젝트는 모노레포(고객·판매자·서버 소스를 한 저장소에서 관리하는 구조)입니다. **`apps/merchant`만 따로 업로드하면 공통 소스가 빠집니다. 전체 프로젝트를 연결하세요.**

1. 전체 프로젝트를 담은 Git 저장소를 Vercel에 연결합니다.
2. Root Directory를 `apps/merchant`로 지정합니다.
3. 빌드 단계에서 Root Directory 바깥 소스를 포함하는 옵션을 켭니다. `functions/src/domain.ts`를 공통 규칙으로 가져오기 때문입니다.
4. 프레임워크는 Next.js입니다. 앱의 `vercel.json`에 모노레포 설치·빌드 명령과 서울 리전을 지정했습니다.
5. `apps/merchant/.env.local.example`의 모든 항목을 Vercel 환경 변수에 입력합니다. `NEXT_PUBLIC_`로 시작하는 값에는 Firebase 웹 설정값만 넣습니다.
6. Firebase 서비스 계정 인증서의 프로젝트 ID, 클라이언트 이메일, 비공개 키는 서버 변수에만 입력합니다. 비공개 키를 새로 발급해야 한다면 사용자 계정에서 안전하게 생성·등록하고 파일을 공개하지 않습니다.
7. `SYNC_SHARED_SECRET`에는 충분히 긴 임의 비밀값을 생성해 등록합니다. 최소 32자이며 Firebase Secret Manager에도 **동일한 값**을 등록해야 합니다. 비밀값을 채팅이나 Git에 붙여넣지 않습니다.
8. 배포 후 나온 실제 운영 도메인을 기록합니다.

CLI를 사용할 때도 저장소 최상위 폴더에서 프로젝트를 연결합니다. Vercel 원격 프로젝트의 Root Directory 설정은 동일해야 합니다.

```powershell
npx vercel login
npx vercel link
npm run deploy:vercel
```

동기화 주소는 Firebase 서버가 접근할 수 있어야 합니다. Vercel Deployment Protection이 켜져 서버 간 전송을 막는 환경은 별도 보호 우회 설정이 필요합니다. 처음에는 인증된 운영 API를 사용하세요. 보호를 무작정 해제하지 않습니다.

## 4. Firebase 서버와 고객 앱

`functions/.env`의 `SYNC_API_URL`에 실제 Vercel 운영 주소를 입력합니다.

```text
SYNC_API_URL=https://실제운영도메인/api/sync/payments
```

다음 명령으로 Firebase 프로젝트를 연결하고 공유 비밀값을 안전한 입력 프롬프트에 등록합니다. `YOUR_PROJECT_ID`는 실제 ID로 바꿉니다.

```powershell
npx firebase-tools login
npx firebase-tools use --add YOUR_PROJECT_ID
npx firebase-tools functions:secrets:set SYNC_SHARED_SECRET
npm run build
npm run deploy:firebase
```

`functions/.env`는 함수 배포 도구가 읽습니다. 고객 Vite 빌드는 `apps/customer/.env.local`을 읽습니다. Hosting은 `apps/customer/dist`를 배포합니다.

Firebase Authentication의 승인된 도메인 목록에 실제 고객 Hosting 도메인과 판매자 Vercel 도메인을 등록합니다.

## 5. 판매자 계정

Firebase Authentication에서 이메일/비밀번호 판매자 사용자를 만듭니다. 고객 화면의 기본 상품 판매자는 `studio-mina`입니다.

안전하게 준비한 서비스 계정 자격증명을 사용해 다음을 실행합니다. `FIREBASE_UID`는 실제 판매자 사용자의 UID로 바꿉니다.

```powershell
npm run merchant:grant -- FIREBASE_UID studio-mina
```

스크립트는 Firebase Admin의 Application Default Credentials(기본 애플리케이션 인증 정보)를 사용합니다. 실행 환경의 `GOOGLE_APPLICATION_CREDENTIALS` 등에 안전하게 등록해야 하며 키 파일을 저장소에 넣지 않습니다. 권한 등록 후 다시 로그인해야 새 권한이 반영됩니다.

판매자 분리 시험에는 별도 계정에 `other-store` 권한을 부여합니다. `studio-mina`의 거래가 표시되면 실패입니다.

## 6. 배포 완료 확인

아래 항목이 모두 확인되어야 서비스 배포 완료로 기록합니다.

| 확인 | 성공 기준 |
|---|---|
| 고객 Hosting | HTTPS 주소에서 화면 접속 |
| 결제 생성 | Firestore에 서버가 만든 결제 문서 1개 |
| 영수증 | 본인 거래의 금액과 상품·시간 표시 |
| 서버 간 전송 | Vercel API 200, Firestore `syncState=synced` |
| MySQL | 같은 `paymentId`의 행 1개 |
| 판매자 화면 | 동일 금액이 합계·차트·목록에 반영 |
| 중복 요청 | 결제 생성 재시도·이벤트 재전송 후에도 1건 |
| 오류 복구 | DB 장애 중 원본 보존, 복구 후 자동 반영 |
| 권한 분리 | 다른 판매자와 비로그인 사용자에게 거래 비공개 |

배포 전후 `npm run check:deploy`로 로컬 설정 유무를 확인할 수 있습니다. 이 명령은 비밀값을 출력하지 않으며, 원격 환경 변수나 실제 서비스 상태까지 검사하지는 않습니다.
