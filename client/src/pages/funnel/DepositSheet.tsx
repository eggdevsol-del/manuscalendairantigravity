import { useRoute } from "wouter";
import { PaymentLinkPage } from "@/app-v3/pages/PaymentLinks";
export function DepositSheet() {
  const [, params] = useRoute("/deposit/:token");
  return <PaymentLinkPage kind="deposit" token={params?.token || ""} />;
}
