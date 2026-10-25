# 배포 안내

현재 코드의 직접 배포 절차는 [페이브릿지 직접 배포 안내서](MANUAL_DEPLOYMENT.md)를 따르세요.

기존 고객 Firebase Hosting·판매자 Vercel을 유지하고, 관리자 화면을 Cloudflare로 분리합니다. 안내서에 Windows Git Bash 명령, 환경 변수, PR 병합 시점, 재배포·오류 해결·완료 확인을 정리했습니다.

과거 Functions 동기화 구조의 배포 설명은 현재 절차와 달라 교체했습니다. 이번 화면 배포에서는 Functions·공유 동기화 비밀값·DB 마이그레이션이 필요하지 않습니다. Firebase는 Hosting만 배포하고 Vercel은 CLI로 수동 배포합니다.

2026-10-25 기준 수정 코드는 PR #1에 있으며, 이번 변경의 운영 배포는 미완료입니다.
