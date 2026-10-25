# 배포 안내

현재 코드의 배포 절차는 [페이브릿지 자동 배포 안내서](AUTO_DEPLOYMENT.md)를 따르세요.

고객 Firebase Hosting과 관리자 Cloudflare Workers는 GitHub Actions로, 판매자·API Vercel은 기존 Git 연동으로 main 변경을 배포합니다. 최초 연결에 필요한 GitHub Variables 4개·Secrets 2개와 관리자 주소 설정을 마친 뒤 PR을 병합합니다.

이번 자동화는 Hosting과 관리자 정적 파일만 배포합니다. Functions·Auth·Firestore·DB 마이그레이션·공유 동기화 비밀값 설정은 포함하지 않습니다. 실제 원격 자격증명 등록과 첫 Firebase·Cloudflare 배포 성공은 별도 확인 대상입니다.
