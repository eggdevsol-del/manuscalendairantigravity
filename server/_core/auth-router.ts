import { router, publicProcedure, protectedProcedure } from "./trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  generateToken,
  hashPassword,
  comparePassword,
  generateMagicLinkToken,
  verifyMagicLinkToken,
} from "./auth-new";
import {
  getUserByEmail,
  createUser,
  updateUserLastSignedIn,
  getUserById,
  updateUserPassword,
  createConversation,
} from "../db";
import { getDb } from "../services/core";
import { eq, and } from "drizzle-orm";
import { studioMembers } from "../../drizzle/schema";
import { randomBytes } from "crypto";

/**
 * Authentication router with email/password and magic link support
 */
export const authRouter = router({
  /**
   * Register a new user with email and password
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        name: z.string().min(1, "Name is required"),
        role: z.enum(["client", "artist", "studio"]).optional(),
        studioName: z.string().optional(),
        phone: z.string().max(20).optional(),
        birthday: z.string().max(20).optional(),
        gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
        city: z.string().max(100).optional(),
        country: z.string().max(100).optional(),
        referralArtistId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { email, password, name, role = "client", studioName, phone, birthday, gender, city, country, referralArtistId } = input;

      // Check if user already exists
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists",
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Generate user ID
      const userId = `user_${randomBytes(16).toString("hex")}`;

      // Create user
      const user = await createUser({
        id: userId,
        email,
        password: hashedPassword,
        name,
        role,
        loginMethod: "email",
        hasCompletedOnboarding: 0,
        ...(phone ? { phone } : {}),
        ...(birthday ? { birthday } : {}),
        ...(gender ? { gender } : {}),
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
      });

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      // Handle Studio Creation
      if (role === "studio") {
        const db = await getDb();
        if (db) {
          const studioId = `studio_${randomBytes(16).toString("hex")}`;

          // Create studio
          await db.insert(require("../../drizzle/schema").studios).values({
            id: studioId,
            name: studioName || `${name}'s Studio`,
            ownerId: user.id,
          });

          // Create studio member (owner)
          await db
            .insert(require("../../drizzle/schema").studioMembers)
            .values({
              studioId,
              userId: user.id,
              role: "owner",
              status: "active",
            });
        } else {
          console.error(
            "[Auth] Database not available to create studio records."
          );
        }
      }

      // Generate JWT token
      const token = generateToken({ id: user.id, email: user.email as string });

      // Auto-connect with referring artist (creates conversation)
      if (referralArtistId && role === "client") {
        try {
          await createConversation({
            artistId: referralArtistId,
            clientId: user.id,
          });
        } catch (e) {
          // Non-fatal: conversation may already exist from import
          console.log("[Auth] Referral conversation creation:", (e as any)?.message || e);
        }
      }

      return {
        user: {
          id: user.id,
          email: user.email as string,
          name: user.name,
          role: user.role,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
        },
        token,
      };
    }),

  /**
   * Login with email and password
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { email, password } = input;

      // Get user by email
      const user = await getUserByEmail(email);
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Check if user has a password (might be social auth only)
      if (!user.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This account uses social login. Please use Google or Facebook to sign in.",
        });
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Update last signed in
      await updateUserLastSignedIn(user.id);

      // Generate JWT token
      const token = generateToken({ id: user.id, email: user.email || "" });

      return {
        user: {
          id: user.id,
          email: user.email || "",
          name: user.name,
          role: user.role,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
        },
        token,
      };
    }),

  /**
   * Request a magic link for passwordless login
   */
  requestMagicLink: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const { email } = input;

      // Check if user exists
      const user = await getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return {
          success: true,
          message:
            "If an account exists with this email, a magic link has been sent.",
        };
      }

      // Generate magic link token
      const token = generateMagicLinkToken(email);
      const magicLink = `${process.env.VITE_APP_URL || "http://localhost:3000"}/auth/magic?token=${token}`;

      // TODO: Send email with magic link
      // For now, just log it (in production, integrate with email service)
      console.log(`[Auth] Magic link for ${email}: ${magicLink}`);

      return {
        success: true,
        message:
          "If an account exists with this email, a magic link has been sent.",
        // In development, return the link
        ...(process.env.NODE_ENV === "development" && { magicLink }),
      };
    }),

  /**
   * Verify magic link token and log in
   */
  verifyMagicLink: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { token } = input;

      // Verify magic link token
      const payload = verifyMagicLinkToken(token);
      if (!payload) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired magic link",
        });
      }

      // Get user by email
      const user = await getUserByEmail(payload.email);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Update last signed in
      await updateUserLastSignedIn(user.id);

      // Generate JWT token
      const authToken = generateToken({ id: user.id, email: user.email || "" });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
        },
        token: authToken,
      };
    }),

  /**
   * Get current user info
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const db = await getDb();
    let studioId = null;
    let studioRole = null;

    if (db) {
      const member = await db.query.studioMembers.findFirst({
        where: and(
          eq(studioMembers.userId, user.id),
          eq(studioMembers.status, "active")
        ),
      });
      if (member) {
        studioId = member.studioId;
        studioRole = member.role;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      studioId,
      studioRole,
    };
  }),

  /**
   * Logout (client-side should clear token)
   */
  logout: protectedProcedure.mutation(async () => {
    return { success: true };
  }),

  /**
   * Change password
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { currentPassword, newPassword } = input;
      const user = ctx.user;

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      // Get full user data
      const fullUser = await getUserById(user.id);
      if (!fullUser || !fullUser.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change password for social login accounts",
        });
      }

      // Verify current password
      const isValidPassword = await comparePassword(
        currentPassword,
        fullUser.password
      );
      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await updateUserPassword(user.id, hashedPassword);

      return { success: true };
    }),

  /**
   * Check if email exists (for funnel clients)
   */
  checkEmailExists: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const { email } = input;
      const user = await getUserByEmail(email);

      if (!user) {
        return { exists: false, isFunnelClient: false, name: null };
      }

      // Check if this is a funnel client (has no password set)
      const isFunnelClient = !user.password;

      return {
        exists: true,
        isFunnelClient,
        name: user.name,
      };
    }),

  /**
   * Set password for funnel client (first-time account setup)
   */
  setPasswordForFunnelClient: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input }) => {
      const { email, password } = input;

      // Get user by email
      const user = await getUserByEmail(email);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found. Please submit a consultation first.",
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(password);

      // Update password
      await updateUserPassword(user.id, hashedPassword);

      // Update last signed in
      await updateUserLastSignedIn(user.id);

      // Generate JWT token
      const token = generateToken({ id: user.id, email: user.email || "" });

      return {
        user: {
          id: user.id,
          email: user.email || "",
          name: user.name,
          role: user.role,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
        },
        token,
      };
    }),

  /**
   * Request password reset
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const { email } = input;

      // Check if user exists
      const user = await getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return {
          success: true,
          message:
            "If an account exists with this email, a password reset link has been sent.",
        };
      }

      // Generate reset token (similar to magic link)
      const token = generateMagicLinkToken(email);
      const resetLink = `${process.env.VITE_APP_URL || "http://localhost:3000"}/auth/reset-password?token=${token}`;

      // TODO: Send email with reset link
      console.log(`[Auth] Password reset link for ${email}: ${resetLink}`);

      return {
        success: true,
        message:
          "If an account exists with this email, a password reset link has been sent.",
        // In development, return the link
        ...(process.env.NODE_ENV === "development" && { resetLink }),
      };
    }),

  /**
   * Reset password with token
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input }) => {
      const { token, newPassword } = input;

      // Verify reset token
      const payload = verifyMagicLinkToken(token);
      if (!payload) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired reset link",
        });
      }

      // Get user by email
      const user = await getUserByEmail(payload.email);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await updateUserPassword(user.id, hashedPassword);

      return { success: true };
    }),

  /**
   * Return the Google OAuth Client ID so the frontend can init the provider
   * without baking the credential into the JS bundle.
   */
  getGoogleClientId: publicProcedure.query(() => {
    const { ENV } = require("./env");
    return { clientId: ENV.googleClientId };
  }),

  /**
   * Google OAuth login/register (Authorization Code flow)
   * Frontend sends the auth code; backend exchanges it for tokens
   * using the client secret, then finds or creates the user.
   */
  googleLogin: publicProcedure
    .input(
      z.object({
        code: z.string(), // Google authorization code
        role: z.enum(["client", "artist", "studio"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { ENV } = require("./env");
      const { code, role } = input;

      // Exchange authorization code for tokens using client secret
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: "postmessage", // required for popup-based auth-code flow
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error("[Auth] Google token exchange failed:", errBody);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Google authentication failed",
        });
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        id_token?: string;
      };

      // Fetch user info using the access token
      const userInfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );

      if (!userInfoRes.ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Failed to fetch Google user info",
        });
      }

      const googlePayload = (await userInfoRes.json()) as {
        email: string;
        name: string;
        picture?: string;
        sub: string;
      };

      if (!googlePayload.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No email found in Google account",
        });
      }

      // ── Diagnostic logging ──
      console.log("[Auth/Google] OAuth payload:", {
        email: googlePayload.email,
        name: googlePayload.name,
        sub: googlePayload.sub,
      });

      // Check if user exists by email
      let user = await getUserByEmail(googlePayload.email);

      // If no match by email, try matching by Google sub (handles email alias mismatches)
      if (!user) {
        const dbInstance = await (await import("../services/core")).getDb();
        if (dbInstance) {
          const { users: usersTable } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const byGoogleSub = await dbInstance
            .select()
            .from(usersTable)
            .where(eq(usersTable.googleSub, googlePayload.sub))
            .limit(1);
          if (byGoogleSub.length > 0) {
            user = byGoogleSub[0];
            console.log("[Auth/Google] Matched by googleSub instead of email:", {
              googleEmail: googlePayload.email,
              userEmail: user.email,
              userId: user.id,
            });
          }
        }
      }

      let isNewUser = false;

      if (!user) {
        // Create new user
        isNewUser = true;
        const userId = `user_${randomBytes(16).toString("hex")}`;

        console.log("[Auth/Google] Creating NEW user:", {
          userId,
          email: googlePayload.email,
          role: role || "client",
        });

        user = await createUser({
          id: userId,
          email: googlePayload.email,
          name: googlePayload.name || "User",
          role: role || "client",
          loginMethod: "google",
          avatar: googlePayload.picture || undefined,
          hasCompletedOnboarding: 0,
        });

        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create user",
          });
        }
      } else {
        // Existing user — update last signed in
        console.log("[Auth/Google] EXISTING user matched:", {
          userId: user.id,
          userEmail: user.email,
          googleEmail: googlePayload.email,
          loginMethod: user.loginMethod,
          role: user.role,
        });
        await updateUserLastSignedIn(user.id);
      }

      // Persist the Google sub on the user so future logins match even if the email changes
      try {
        const dbInstance = await (await import("../services/core")).getDb();
        if (dbInstance && googlePayload.sub) {
          const { users: usersTable } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await dbInstance
            .update(usersTable)
            .set({ googleSub: googlePayload.sub, loginMethod: user.loginMethod === "email" ? "email" : "google" })
            .where(eq(usersTable.id, user.id));
        }
      } catch (e) {
        console.warn("[Auth/Google] Failed to persist googleSub (column may not exist yet):", (e as any)?.message);
      }

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email as string,
      });

      return {
        user: {
          id: user.id,
          email: user.email as string,
          name: user.name,
          role: user.role,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
        },
        token,
        isNewUser,
      };
    }),
});

