import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Fastify from "fastify";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { PactFlowDatabase } from "@pactflow/db/client";
import * as schema from "@pactflow/db";
import { ProductError, registerProductRoutes } from "./product";
import type { PactFlowSdk } from "@pactflow/sdk";
import { registerGoogleRoutes, verifyGoogleCredential } from "./google-auth";

test("Google signature, issuer, audience, expiry and nonce are verified", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwks = createLocalJWKSet({ keys: [await exportJWK(publicKey)] });
  const token = async (overrides: Record<string, unknown> = {}) =>
    new SignJWT({
      name: "Ren Example",
      nonce: "one-use-nonce",
      sub: "google-subject",
      aud: "our-client",
      iss: "https://accounts.google.com",
      exp: Math.floor(Date.now() / 1000) + 60,
      iat: Math.floor(Date.now() / 1000),
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256" })
      .sign(privateKey);
  assert.deepEqual(
    await verifyGoogleCredential(
      await token(),
      "our-client",
      "one-use-nonce",
      jwks,
    ),
    { subject: "google-subject", name: "Ren Example" },
  );
  for (const invalid of [
    { aud: "another-client" },
    { iss: "https://attacker.test" },
    { exp: 1 },
    { nonce: "replayed" },
    { name: "" },
  ])
    await assert.rejects(
      verifyGoogleCredential(
        await token(invalid),
        "our-client",
        "one-use-nonce",
        jwks,
      ),
    );
  const { privateKey: forgedKey } = await generateKeyPair("RS256");
  const forged = await new SignJWT({ name: "Fake", nonce: "one-use-nonce" })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("google-subject")
    .setAudience("our-client")
    .setIssuer("https://accounts.google.com")
    .setIssuedAt()
    .setExpirationTime("1m")
    .sign(forgedKey);
  await assert.rejects(
    verifyGoogleCredential(forged, "our-client", "one-use-nonce", jwks),
  );
});

test("Google sessions cannot authorize wallets; challenges are one-use, origin-bound and logout revokes", async () => {
  const oldClient = process.env.GOOGLE_CLIENT_ID;
  const oldOrigin = process.env.WEB_ORIGIN;
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.WEB_ORIGIN = "http://localhost:3011";
  const storage = new PGlite();
  for (const file of [
    "0000_yielding_natasha_romanoff",
    "0001_famous_vapor",
    "0004_glossy_adam_destine",
  ])
    await storage.exec(
      readFileSync(
        new URL(`../../../packages/db/drizzle/${file}.sql`, import.meta.url),
        "utf8",
      ),
    );
  await storage.exec(
    "INSERT INTO users (handle, display_name) VALUES ('member-legacy', 'New member'), ('custom-profile', 'Custom name')",
  );
  await storage.exec(
    readFileSync(
      new URL(
        "../../../packages/db/drizzle/0004_glossy_adam_destine.sql",
        import.meta.url,
      ),
      "utf8",
    )
      .split("--> statement-breakpoint")
      .at(-1)!,
  );
  const db = drizzle(storage, { schema }) as unknown as PactFlowDatabase;
  const profiles = await db.select().from(schema.users);
  assert.match(
    profiles.find((p) => p.handle === "member-legacy")!.displayName,
    /^Guest-[A-F0-9]{6}$/,
  );
  assert.equal(
    profiles.find((p) => p.handle === "custom-profile")!.displayName,
    "Custom name",
  );
  const app = Fastify();
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwks = createLocalJWKSet({ keys: [await exportJWK(publicKey)] });
  registerGoogleRoutes(app, db, (credential, audience, nonce) =>
    verifyGoogleCredential(credential, audience, nonce, jwks),
  );
  await registerProductRoutes(app, db, {} as PactFlowSdk);
  app.setErrorHandler((e, _req, reply) =>
    reply
      .code(e instanceof ProductError ? e.statusCode : 400)
      .send({ code: e instanceof ProductError ? e.code : "INVALID_INPUT" }),
  );
  const origin = { origin: process.env.WEB_ORIGIN };
  try {
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/google/challenge",
          headers: { origin: "https://attacker.test" },
        })
      ).statusCode,
      403,
    );
    const challenge = (
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/google/challenge",
        headers: origin,
      })
    ).json();
    const credential = await new SignJWT({
      name: "Google Display Name",
      nonce: challenge.nonce,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("google-user-id")
      .setIssuer("https://accounts.google.com")
      .setAudience("test-client")
      .setIssuedAt()
      .setExpirationTime("1m")
      .sign(privateKey);
    const result = await app.inject({
      method: "POST",
      url: "/api/v1/auth/google/verify",
      headers: origin,
      payload: { id: challenge.id, credential },
    });
    assert.equal(result.statusCode, 200);
    const { token, account } = result.json();
    assert.deepEqual(account, {
      name: "Google Display Name",
      provider: "google",
    });
    const headers = { ...origin, authorization: `Bearer ${token}` };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/google/verify",
          headers: origin,
          payload: { id: challenge.id, credential },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/auth/google/me", headers })).json()
        .name,
      "Google Display Name",
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/me", headers })).statusCode,
      401,
    );
    const sessions = await db.select().from(schema.accountSessions);
    assert.notEqual(sessions[0].tokenHash, token);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/google/logout",
          headers,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/auth/google/me", headers })).statusCode,
      401,
    );
    const expired = (
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/google/challenge",
        headers: origin,
      })
    ).json();
    await storage.exec(
      `UPDATE google_challenges SET expires_at = NOW() - INTERVAL '1 minute'`,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/google/verify",
          headers: origin,
          payload: { id: expired.id, credential },
        })
      ).statusCode,
      401,
    );
  } finally {
    await app.close();
    await storage.close();
    if (oldClient === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = oldClient;
    if (oldOrigin === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = oldOrigin;
  }
});
