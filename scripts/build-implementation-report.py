"""Generate implementation Markdown and a clickable source/flow report."""
from pathlib import Path
import html,json
ROOT=Path(__file__).resolve().parents[1]
BASE="https://github.com/wevolmina/paybridge-mock/blob/main/"
specs=[
("customer","고객 주문 요청","apps/customer/src/main.tsx","async function pay()","상품·수량·requestId만 전송하며, 응답을 잃어도 같은 번호로 재시도합니다."),
("api","주문 확정 API","apps/merchant/app/api/checkout/route.ts","export async function POST","인증·입력 검증 → 기존 확정 조회 → Firestore 접수 → MySQL 확정 순서입니다."),
("auth","인증과 판매자 권한","apps/merchant/lib/admin.ts","export async function authorizedUser","서명 검증 및 계정 온라인 조회로 만료·폐기·비활성 계정을 차단합니다. 판매자는 merchant_id 클레임을 사용합니다."),
("intake","Firestore 주문 접수","apps/merchant/lib/checkout.ts","export async function recordRequest","고객 ID 토큰으로 REST API를 호출합니다. 요청 원문만 저장하며 금액이나 결제 승인 상태를 저장하지 않습니다."),
("tx","MySQL 원자적 확정","apps/merchant/lib/checkout.ts","export async function confirmOrder","orders·order_items·payments를 한 연결의 트랜잭션으로 확정합니다. 오류면 모두 롤백합니다."),
("schema","주문 테이블·고유 키","database/002-orders.sql","CREATE TABLE IF NOT EXISTS orders","customer_id/request_id 고유 키로 동시 재시도를 직렬화합니다. 항목은 주문 외래 키와 상품명·단가 스냅샷을 보관합니다."),
("receipt","고객 영수증 API","apps/merchant/app/api/receipt/route.ts","export async function GET","로그인 고객 ID로 MySQL 결제 원본을 조회합니다. 다른 고객의 결제는 반환하지 않습니다."),
("seller","판매자 매출 조회","apps/merchant/lib/payments.ts","export async function merchantPayments","같은 payments 원본을 판매자 ID로 필터링합니다. 화면은 보이는 동안 5초 간격으로 조회합니다."),
("rules","주문 접수 보안 규칙","firestore.rules","match /order_requests","본인 요청 생성·단건 읽기만 허용합니다. 필드·상품·수량을 제한하고 변경·삭제·목록과 결제 문서 접근은 차단합니다."),
("pool","암호화 DB 연결","apps/merchant/lib/mysql.ts","export function getPool","TLS 인증서를 검증하며 작은 연결 풀을 재사용합니다. DB 비밀 값은 서버 환경 변수에만 둡니다.")]
sources=[]
for ident,title,path,needle,explain in specs:
 lines=(ROOT/path).read_text(encoding="utf8").splitlines();line=next(i+1 for i,s in enumerate(lines) if needle in s)
 sources.append(dict(id=ident,title=title,path=path,url=BASE+path+f"#L{line}",explain=explain,code="\n".join(lines[max(0,line-2):min(len(lines),line+20)])))
flow="""flowchart TD
 C["고객: 상품·수량·요청 번호"] --> A["Vercel: 인증·입력 검증"]
 A --> Q{"이미 확정된 요청?"}
 Q -->|동일 내용| R["MySQL 영수증 반환"]
 Q -->|내용 변경| X["409 충돌"]
 Q -->|신규| F["Firestore 주문 요청 접수"]
 F --> T["MySQL: 주문·항목·결제 트랜잭션"]
 T --> S{"커밋 성공?"}
 S -->|예| R
 S -->|아니오| E["전체 롤백·접수 보존·동일 번호 재시도"]
 R --> U["고객 영수증"]
 R --> M["판매자 대시보드"]
"""
erd="""erDiagram
 ORDERS ||--|{ ORDER_ITEMS : contains
 ORDERS ||--o| PAYMENTS : application_link
 ORDERS {
  varchar order_id PK
  varchar customer_id
  char request_id "customer와 복합 고유 키"
  char request_hash
  decimal amount
  datetime created_at
 }
 ORDER_ITEMS {
  varchar order_id PK,FK
  int line_number PK
  varchar product_name
  decimal unit_price
  int quantity
 }
 PAYMENTS {
  varchar payment_id PK
  varchar order_id "기존 테이블 호환·앱에서 1건 보장"
  decimal amount
  varchar status
 }
"""
status="코드 수정·고객/Vercel 전체 빌드·단위 12건·Firestore 보안 테스트·실제 MySQL 트랜잭션 테스트를 통과했습니다. 운영 MySQL에 orders/order_items 추가도 완료했습니다. 핵심 API·화면·스키마·설정은 GitHub main에서 확인했습니다. 보고서·테스트·배포 스크립트 및 최종 문구의 원격 업로드, Firebase Hosting/Auth/Rules 배포, Vercel Ready 확인과 실제 연결 결제는 브라우저 재연결 후 남아 있습니다."
summary="Firestore는 주문 요청을 접수하고, MySQL은 주문·항목·모의 결제를 함께 확정하며 고객과 판매자는 API로 같은 결제 원본을 조회합니다."
progress=["고객 요청을 인증하고 금액은 서버 상품 가격으로 다시 계산합니다.","요청을 Firestore에 남긴 뒤 MySQL 트랜잭션으로 주문·항목·결제를 함께 확정합니다.","고객은 영수증으로, 판매자는 매출 그래프와 거래 목록으로 같은 MySQL 결제를 확인합니다."]
rows="\n".join(f'| {s["title"]} | [{s["path"]}]({s["url"]}) | {s["explain"]} |' for s in sources)
md=f"""# Paybridge 구현 결과 보고서

## 핵심 한 줄

{summary}

## 쉽게 보는 진행 과정 3줄

1. {progress[0]}
2. {progress[1]}
3. {progress[2]}

## 확인 상태

{status}

고객: https://paybridge-mock.web.app / 판매자: https://paybridge-mock.vercel.app

## DB 관리 기준

| 저장소 | 책임 | 최종 기준 |
|---|---|---|
| Firestore order_requests | 본인 주문 요청 원문, 변경 불가 | 접수 사실만 담당 |
| MySQL orders | 고객·판매자·요청 고유 키·확정 주문 | 주문 확정 원본 |
| MySQL order_items | 주문 상품명·단가·수량 스냅샷 | 확정 시점 상품 정보 |
| MySQL payments | 확정된 모의 결제 | 영수증·매출의 공통 원본 |

결제 복제와 Cloud Functions는 사용하지 않습니다. 기존 Functions 소스는 과거 참고용이며 firebase.json 배포 대상에서 제외했습니다. 기존 동기화 API는 410을 반환합니다. MySQL payments의 기존 열은 호환을 위해 유지합니다. order_items에는 실제 FK가 있고 payments의 주문 관계는 앱 트랜잭션에서 보장합니다. 기존 데이터는 삭제하지 않는 추가 마이그레이션입니다.

## 처리 흐름

```mermaid
{flow}```

## 테이블 관계

```mermaid
{erd}```

## 소스 위치

| 기능 | GitHub 소스 | 처리 설명 |
|---|---|---|
{rows}

[왼쪽 소스·오른쪽 클릭형 흐름도](IMPLEMENTATION-REPORT.html)는 HTML 파일을 내려받아 브라우저에서 열면 동작합니다. GitHub Markdown에서는 위 소스 링크로 해당 파일의 함수 위치를 확인할 수 있습니다.

## 실패·재시도 원칙

- Firestore 접수 실패: 신규 MySQL 확정을 시작하지 않습니다.
- MySQL 확정 실패: 주문·항목·결제 모두 롤백하고 Firestore 요청은 남깁니다.
- 커밋 뒤 응답 유실: 같은 요청 번호로 기존 MySQL 결과를 먼저 조회해 반환합니다.
- 같은 번호에 다른 상품·수량: 409로 거절합니다. 동시 요청은 DB 고유 키와 행 잠금으로 직렬화합니다.
- 자동 재처리 큐는 없습니다. 고객의 동일 요청 재시도가 복구 방법입니다. 무인 재처리가 필요하면 별도 작업 큐가 필요합니다.

## 보안·운영

API는 Firebase 서명을 검증하고 accounts:lookup으로 계정 상태와 validSince를 확인합니다. Firestore REST에는 고객 토큰을 전달하므로 보안 규칙이 적용됩니다. 고객은 자기 요청을 직접 생성할 수도 있지만 결제 금액·승인 상태는 만들 수 없습니다. API가 상품·수량과 신원을 별도로 검증한 후 MySQL만 확정합니다. CORS는 고객 호스팅 두 주소에만 허용하고, 모든 응답은 캐시하지 않습니다. 판매자 ID를 요청 본문에서 받지 않습니다.

Firebase Spark, 외부 무료 MySQL, Vercel Hobby 범위의 개인 모의 결제입니다. 무료 한도 초과 시 서비스 제한이 생길 수 있으며 실제 카드 승인은 지원하지 않습니다. 익명 사용자가 브라우저 데이터를 삭제하면 기존 영수증의 인증 신원을 복구할 수 없습니다. 공개 서비스 전에는 계정 로그인, 요청 속도 제한, 모니터링, 백업·복구 훈련을 추가해야 합니다.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for owner-only immutable order intake with strict field validation and no payment writes. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

## 검증 방법

`npm test` / 격리된 `_test` DB에서 `RUN_MYSQL_INTEGRATION=true npx tsx --test tests/integration/checkout.test.ts` / Firestore Emulator의 `firestore-rules.test.ts` / `npm run build`를 사용합니다. 신규 테스트는 동시 재시도, 요청 충돌, 고객 분리, 결제 INSERT 중 오류의 전체 롤백, 요청 스키마와 변경 금지를 확인합니다.

## 배포 방법

1. 서버 환경 변수에 기존 MYSQL_*와 FIREBASE_PROJECT_ID, 공개 Firebase 설정을 등록합니다. 서비스 계정 비밀 키 없이 ID 토큰 서명 및 온라인 계정 조회를 수행합니다.
2. TLS로 MySQL에 연결하여 `npm run db:migrate`를 실행합니다. 001과 002 테이블은 기존 데이터를 보존합니다.
3. `npm run build` 후 `npm run deploy:firebase`로 Hosting·Firestore·Auth만 배포하고 GitHub main 변경으로 Vercel을 배포합니다.
4. 판매자 이메일 계정을 만든 후 관리 권한으로 `merchant_id=studio-mina` 커스텀 클레임을 부여합니다. 공개 회원가입으로 판매자 권한을 얻을 수 없습니다.
"""
(ROOT/"docs/IMPLEMENTATION-REPORT.md").write_text(md,encoding="utf8")
buttons="".join(f'<button data-id="{s["id"]}">{html.escape(s["title"])}</button>' for s in sources)
payload=json.dumps(sources,ensure_ascii=False).replace("</","<\/")
page="""<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Paybridge 구현 보고서</title><style>body{font-family:system-ui;margin:0;background:#f3f5f3;color:#18271f}header{padding:24px 4vw;background:#182d23;color:white}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:24px 4vw}section{min-width:0;background:white;padding:24px;border-radius:14px}button{display:block;width:100%;padding:14px;margin:10px 0;text-align:left;background:#eaf3eb;border:1px solid #aac5b0;border-radius:8px;cursor:pointer}button[aria-pressed=true]{background:#254d37;color:white}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#17261e;color:#e4f1e8;padding:18px;border-radius:10px;font-size:13px}a{color:#267844}small{display:block;margin-bottom:16px}h1{font-size:26px}@media(max-width:800px){main{grid-template-columns:1fr}}</style><header><h1>Paybridge 구현 보고서</h1><p>__SUMMARY__</p></header><main><section><small>왼쪽 · 관련 소스</small><h2 id="title"></h2><p id="explain"></p><a id="source" target="_blank" rel="noopener">GitHub에서 함수 위치 열기</a><pre id="code"></pre></section><section><small>오른쪽 · 단계를 누르면 소스가 바뀝니다</small><h2>주문 접수 → 원자적 확정 → 두 화면</h2>__BUTTONS__<p>Firestore: 주문 접수만 보관<br>MySQL: 확정 주문·항목·결제의 원본</p><a href="IMPLEMENTATION-REPORT.md">Markdown 보고서</a></section></main><script>const sources=__DATA__;function select(id){const s=sources.find(x=>x.id===id);document.getElementById('title').textContent=s.title;document.getElementById('explain').textContent=s.explain;document.getElementById('source').href=s.url;document.getElementById('source').textContent=s.path+' · GitHub에서 보기';document.getElementById('code').textContent=s.code;document.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));}document.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>select(b.dataset.id)));select('customer');</script></html>"""
page=page.replace("__SUMMARY__",html.escape(summary)).replace("__BUTTONS__",buttons).replace("__DATA__",payload)
(ROOT/"docs/IMPLEMENTATION-REPORT.html").write_text(page,encoding="utf8")
print("Report generated:",len(sources),"source links")
