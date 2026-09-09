import { useRoute } from "wouter";
import { PaymentLinkPage } from "./PaymentLinkPage";
export function DepositSheet() {
  const [, params] = useRoute("/deposit/:token");
  return <PaymentLinkPage kind="deposit" token={params?.token || ""} />;
}
