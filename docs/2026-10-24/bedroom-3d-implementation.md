# 3D 침실 체험 구현

- `/bedroom/`: Vite의 별도 HTML 입력으로 빌드되는 React 체험 화면.
- `bedroom3d.ts`: 직접 만든 가구·방 지오메트리, 광원, 카메라와 GPU 자원 수명 관리. 외부 모델/서비스 연결 없음.
- `BedroomExperience.tsx`: 선택·조명·시점·3D/2D 모드 상태. 선택한 `bedroom-lighting`만 기존 구매 화면으로 전달한다. 조명이나 카메라 상태는 결제 가격을 결정하지 않는다.
- `/bedroom/illustration.html`: 이전 그림 체험 보존. 새 화면 안에서도 구매 상태를 유지하며 2D로 전환 가능.
- three 0.186.1 / @types/three 0.186.0. 배포에 포함한 라이선스: `/licenses/three-LICENSE.txt`.

## 성능과 복구

420ms 조명/시점 전환 이후 프레임 예약을 중지한다. 숨긴 문서에서는 프레임을 취소하고 복귀하면 최종 상태를 그린다. 픽셀 비율은 최대1.5, 그림자 맵은512이며 후처리나 외부 텍스처 다운로드는 없다. 움직임 줄이기에서는 목표 상태를 한 프레임에 반영한다.

초기화/렌더 예외·WebGL context loss는 공통 정리 후 2D로 전환한다. observer, 이벤트, 프레임, geometry, material, texture, renderer, context를 정리한다. 3D가 없어도 패키지 선택과 모의 구매는 계속 가능하다.

## 검사

구매자 디렉터리의 공개 Firebase 웹 설정을 준비하고 `npm run dev --workspace @bridge/customer`로 개발 서버를 실행한다. Playwright가 설치된 환경에서 루트의 `node tests/browser/bedroom-3d.cjs`를 실행한다. 별도 모듈 위치는 `PLAYWRIGHT_MODULE_PATH`, 다른 서버 주소는 `UI_BASE_URL`로 지정한다. 기본 브라우저는 Windows msedge이다.

실제 WebGL 렌더 이미지 변화, 시점, idle 프레임 중지, 390px, reduced-motion, 재마운트, 선택 전달, 미지원/context loss/초기화/렌더 오류 복구를 검사한다. 문서 숨김은 시험에서 모사한다. 기존 `tests/browser/commerce-motion.cjs`는 별도 UI fixture로 구매 복구·모션 회귀를 검사하며 운영 주문 검증과 구분한다.

실제 저사양 장치의 FPS·배터리·발열 평가는 별도다. 새 데이터베이스나 기기 연결은 만들지 않는다. 실제 결제·배송도 없다.
