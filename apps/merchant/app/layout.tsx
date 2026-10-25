import type {Metadata} from "next";
import "@bridge/staff-ui/style.css";
import "@bridge/staff-ui/dashboard-ux.css";
export const metadata:Metadata={title:"페이브릿지 · 판매자 매출",description:"공간 패키지의 주문과 모의 매출을 확인하는 판매자 센터입니다."};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="ko"><body>{children}</body></html>;}
