import { redirect } from "next/navigation";
import { configuredAdminOrigin } from "../../lib/admin-http";
export default function AdminPage() {
  const origin = configuredAdminOrigin(process.env.NEXT_PUBLIC_ADMIN_SITE_URL);
  if (origin && origin !== "https://paybridge-mock.vercel.app")
    redirect(origin + "/");
  return (
    <main>
      <h1>관리자 사이트가 분리되었습니다.</h1>
      <p>Cloudflare 관리자 주소를 설정한 뒤 별도 사이트에서 로그인해 주세요.</p>
      <a href="/">판매자 센터로 이동</a>
    </main>
  );
}
