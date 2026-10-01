import { TRPCError } from "@trpc/server";
export const offersEnabled = () => process.env.IVORY_OFFERS_ENABLED === "true";
export function requireOffersEnabled() {
  if (!offersEnabled())
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Promotions testing is not activated on this server yet. Apply the Ivory offers migration and enable IVORY_OFFERS_ENABLED.",
    });
}
