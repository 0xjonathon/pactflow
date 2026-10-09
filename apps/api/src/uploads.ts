import { uploadsAvailable } from "./runtime-config";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PactFlowDatabase } from "@pactflow/db/client";
import * as s from "@pactflow/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { keccak256, type Address } from "viem";
import {
  MAX_FILE_BYTES,
  validateFile,
  scanFile,
  putPrivateObject,
  signedDownload,
} from "@pactflow/verifier";
import { ProductError } from "./product";
export function registerUploadRoutes(
  app: FastifyInstance,
  db: PactFlowDatabase,
  actor: (req: FastifyRequest) => Promise<{ address: string }>,
  participant: (req: FastifyRequest, address: Address) => Promise<unknown>,
) {
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer", bodyLimit: MAX_FILE_BYTES },
    (_req, body, done) => done(null, body),
  );
  app.post("/api/v1/uploads", { bodyLimit: MAX_FILE_BYTES }, async (req) => {
    const a = await actor(req);
    if (!uploadsAvailable(process.env))
      throw new ProductError(503, "UPLOADS_UNAVAILABLE");
    const q = z
      .object({ name: z.string().max(160), mime: z.string().max(80) })
      .parse(req.query);
    const body = req.body;
    if (!Buffer.isBuffer(body)) throw new ProductError(400, "INVALID_FILE");
    try {
      validateFile(q.name, q.mime, body);
    } catch {
      throw new ProductError(400, "INVALID_FILE");
    }
    const id = randomUUID();
    const key = `evidence/${id}`;
    await db.insert(s.uploads).values({
      id,
      owner: a.address,
      objectKey: key,
      name: q.name,
      mime: q.mime,
      size: body.length,
      contentHash: keccak256(body),
    });
    try {
      await scanFile(body);
      await putPrivateObject(key, body, q.mime);
      await db
        .update(s.uploads)
        .set({ status: "READY" })
        .where(eq(s.uploads.id, id));
      return { id, status: "READY", contentHash: keccak256(body) };
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "STORAGE_UNAVAILABLE";
      if (code === "MALWARE_FOUND")
        await db
          .update(s.uploads)
          .set({ status: "REJECTED" })
          .where(eq(s.uploads.id, id));
      throw new ProductError(code === "MALWARE_FOUND" ? 422 : 503, code);
    }
  });
  app.get("/api/v1/uploads/:id/download", async (req) => {
    const a = await actor(req);
    if (!uploadsAvailable(process.env))
      throw new ProductError(503, "UPLOADS_UNAVAILABLE");
    const id = z.uuid().parse((req.params as { id: string }).id);
    const [file] = await db
      .select()
      .from(s.uploads)
      .where(eq(s.uploads.id, id));
    if (!file || file.status !== "READY")
      throw new ProductError(404, "NOT_FOUND");
    if (a.address !== file.owner) {
      const refs = await db
        .select()
        .from(s.evidence)
        .where(eq(s.evidence.source, id));
      let authorized = false;
      for (const ref of refs.filter((r) => r.visibility !== "VERIFIER")) {
        const [submission] = await db
          .select()
          .from(s.submissions)
          .where(eq(s.submissions.id, ref.submissionId));
        if (!submission) continue;
        try {
          await participant(req, submission.escrowAddress as Address);
          authorized = true;
          break;
        } catch (error) {
          if (!(error instanceof ProductError) || error.statusCode !== 403)
            throw error;
        }
      }
      if (!authorized) throw new ProductError(403, "PRIVATE_EVIDENCE");
    }
    return {
      url: await signedDownload(file.objectKey, file.name),
      expiresIn: 60,
    };
  });
}
