import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { artistSetupProgress } from "../../shared/artistSetup";
export async function getArtistSetupProgress(userId: string) {
  const user = await db.getUserById(userId);
  if (!user || user.role !== "artist")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Artist setup is only available to artist accounts.",
    });
  const settings = await db.getArtistSettings(userId);
  // Only contact Stripe once all local setup steps are saved.
  const local = artistSetupProgress(user, settings);
  const stripe =
    settings?.stripeConnectAccountId && local.nextStep === "bank"
      ? (await import("./stripeConnect")).getAccountStatus(
          settings.stripeConnectAccountId
        )
      : null;
  return artistSetupProgress(user, settings, await stripe);
}
