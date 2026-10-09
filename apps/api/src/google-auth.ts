import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, eq, gt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import type { PactFlowDatabase } from "@pactflow/db/client";
import { googleChallenges, accountSessions } from "@pactflow/db";
import { ProductError } from "./product";

const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 10000 },
);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type GoogleIdentity = { subject: string; name: string };
export async function verifyGoogleCredential(
  credential: string,
  audience: string,
  nonce: string,
  keySet: Parameters<typeof jwtVerify>[1] = keys,
): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(credential, keySet, {
    audience,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "nonce"],
  });
  if (
    payload.nonce !== nonce ||
    !payload.sub ||
    typeof payload.name !== "string" ||
    !payload.name.trim()
  )
    throw new ProductError(401, "GOOGLE_INVALID_TOKEN");
  return { subject: payload.sub, name: payload.name.trim().slice(0, 200) };
}

// Google identity never grants wallet authority. Wallet signatures remain mandatory.
export function registerGoogleRoutes(
  app: FastifyInstance,
  db: PactFlowDatabase,
  verify = verifyGoogleCredential,
) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const origin = process.env.WEB_ORIGIN ?? "http://localhost:3001";
  function checkOrigin(req: FastifyRequest) {
    if (req.headers.origin !== origin)
      throw new ProductError(403, "AUTH_ORIGIN_INVALID");
  }
  app.get("/api/v1/auth/google/config", async () => ({
    enabled: !!clientId,
    clientId: clientId || null,
  }));
  app.post("/api/v1/auth/google/challenge", async (req) => {
    checkOrigin(req);
    if (!clientId) throw new ProductError(503, "GOOGLE_UNAVAILABLE");
    const nonce = randomBytes(32).toString("hex");
    const [challenge] = await db
      .insert(googleChallenges)
      .values({ nonce, expiresAt: new Date(Date.now() + 5 * 60000) })
      .returning();
    return { id: challenge.id, nonce, clientId };
  });
  app.post("/api/v1/auth/google/verify", async (req) => {
    checkOrigin(req);
    if (!clientId) throw new ProductError(503, "GOOGLE_UNAVAILABLE");
    const { id, credential } = z
      .object({ id: z.uuid(), credential: z.string().min(1).max(12000) })
      .parse(req.body);
    const [challenge] = await db
      .select()
      .from(googleChallenges)
      .where(
        and(
          eq(googleChallenges.id, id),
          eq(googleChallenges.used, false),
          gt(googleChallenges.expiresAt, new Date()),
        ),
      );
    if (!challenge) throw new ProductError(401, "GOOGLE_INVALID_TOKEN");
    let account: GoogleIdentity;
    try {
      account = await verify(credential, clientId, challenge.nonce);
    } catch {
      throw new ProductError(401, "GOOGLE_INVALID_TOKEN");
    }
    const token = randomBytes(32).toString("hex");
    await db.transaction(async (tx) => {
      const consumed = await tx
        .update(googleChallenges)
        .set({ used: true })
        .where(
          and(
            eq(googleChallenges.id, id),
            eq(googleChallenges.used, false),
            gt(googleChallenges.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!consumed.length) throw new ProductError(409, "CHALLENGE_USED");
      await tx.insert(accountSessions).values({
        tokenHash: hash(token),
        subject: account.subject,
        name: account.name,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
    });
    return { token, account: { name: account.name, provider: "google" } };
  });
  async function session(req: FastifyRequest) {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token) throw new ProductError(401, "SIGN_IN_REQUIRED");
    const [account] = await db
      .select()
      .from(accountSessions)
      .where(
        and(
          eq(accountSessions.tokenHash, hash(token)),
          gt(accountSessions.expiresAt, new Date()),
        ),
      );
    if (!account) throw new ProductError(401, "SESSION_EXPIRED");
    return account;
  }
  app.get("/api/v1/auth/google/me", async (req) => ({
    name: (await session(req)).name,
    provider: "google",
  }));
  app.post("/api/v1/auth/google/logout", async (req) => {
    checkOrigin(req);
    await db
      .delete(accountSessions)
      .where(eq(accountSessions.tokenHash, (await session(req)).tokenHash));
    return { ok: true };
  });
}
