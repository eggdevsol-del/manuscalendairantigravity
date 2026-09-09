import { useRoute, useSearch } from "wouter";
import { PaymentLinkPage } from "./PaymentLinkPage";
export function BalanceSheet() {
  const [, params] = useRoute("/balance/:id");
  const search = useSearch();
  return (
    <PaymentLinkPage
      kind="balance"
      bookingId={Number(params?.id)}
      token={new URLSearchParams(search).get("token") || ""}
    />
  );
}
