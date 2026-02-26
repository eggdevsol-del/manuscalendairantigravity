import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getUserById } from "../db";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d"; // Token expires in 7 days

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: "client" | "artist" | "admin";
  hasCompletedOnboarding: boolean;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * Generate JWT token for a user
 */
export function generateToken(user: { id: string; email: string }): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token and return payload
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password with hashed password
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Extract token from Authorization header or cookies
 */
export function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}

/**
 * Authenticate request and attach user to request object
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ error: "No authentication token provided" });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Get user from database
    const user = await getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Attach user to request
    (req as any).user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
    } as AuthUser;

    next();
  } catch (error) {
    console.error("[Auth] Authentication error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        const user = await getUserById(payload.userId);
        if (user) {
          (req as any).user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
          } as AuthUser;
        }
      }
    }

    next();
  } catch (error) {
    console.error("[Auth] Optional authentication error:", error);
    next();
  }
}

/**
 * Generate a random verification code (6 digits)
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a magic link token (for passwordless login)
 */
export function generateMagicLinkToken(email: string): string {
  const payload = {
    email,
    type: "magic-link",
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  };
  return jwt.sign(payload, JWT_SECRET);
}

/**
 * Verify magic link token
 */
export function verifyMagicLinkToken(token: string): { email: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type === "magic-link" && payload.email) {
      return { email: payload.email };
    }
    return null;
  } catch (error) {
    return null;
  }
}
