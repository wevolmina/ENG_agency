import type {Metadata} from "next";
import "./style.css";
export const metadata:Metadata={title:"페이브릿지 · 판매자 매출",description:"Firestore 결제 데이터를 MySQL 매출 화면으로 연결합니다."};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="ko"><body>{children}</body></html>;}
