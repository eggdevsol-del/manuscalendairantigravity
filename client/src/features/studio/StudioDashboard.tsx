import { useLocation } from "wouter";
import { StudioDashboardSettings } from "@/components/settings/StudioDashboardSettings";
export default function StudioDashboard() {
  const [, navigate] = useLocation();
  return <StudioDashboardSettings onBack={() => navigate("/settings")} />;
}
