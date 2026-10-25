import { createRoot } from "react-dom/client";
import StaffDashboard from "@bridge/staff-ui";
import "@bridge/staff-ui/style.css";
import "@bridge/staff-ui/dashboard-ux.css";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const apiOrigin =
  import.meta.env.VITE_STAFF_API_ORIGIN || "https://paybridge-mock.vercel.app";
createRoot(document.getElementById("root")!).render(
  <StaffDashboard
    admin
    firebaseConfig={firebaseConfig}
    apiOrigin={apiOrigin}
    merchantSiteUrl={apiOrigin + "/"}
  />,
);
