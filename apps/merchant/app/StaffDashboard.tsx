"use client";
import Dashboard from "@bridge/staff-ui";
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export default function StaffDashboard() {
  return (
    <Dashboard
      firebaseConfig={firebaseConfig}
      adminSiteUrl={process.env.NEXT_PUBLIC_ADMIN_SITE_URL}
    />
  );
}
