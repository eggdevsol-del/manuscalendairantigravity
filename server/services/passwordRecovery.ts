import jwt from "jsonwebtoken";
import { createHmac } from "node:crypto";
import { getAuthSecret } from "../_core/auth-secret";

type RecoveryUser = {
  id: string;
  email: string | null;
  password: string | null;
};
const revision = (password: string | null) =>
  createHmac("sha256", getAuthSecret())
    .update(password || "no-password")
    .digest("hex");
export function createPasswordRecoveryToken(user: RecoveryUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      purpose: "password-reset",
      revision: revision(user.password),
    },
    getAuthSecret(),
    { expiresIn: "15m", audience: "tattoi-account-recovery" }
  );
}
export function readPasswordRecoveryToken(
  token: string
): { userId: string; email: string; revision: string } | null {
  try {
    const data = jwt.verify(token, getAuthSecret(), {
      algorithms: ["HS256"],
      audience: "tattoi-account-recovery",
    }) as jwt.JwtPayload;
    if (
      data.purpose !== "password-reset" ||
      typeof data.sub !== "string" ||
      typeof data.email !== "string" ||
      typeof data.revision !== "string"
    )
      return null;
    return { userId: data.sub, email: data.email, revision: data.revision };
  } catch {
    return null;
  }
}
export function recoveryMatchesUser(
  token: string,
  user: RecoveryUser
): boolean {
  const data = readPasswordRecoveryToken(token);
  return (
    !!data &&
    data.userId === user.id &&
    data.email === user.email &&
    data.revision === revision(user.password)
  );
}
