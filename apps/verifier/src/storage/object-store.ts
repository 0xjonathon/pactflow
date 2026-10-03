import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { connect } from "node:net";
import { keccak256 } from "viem";
import { eq } from "drizzle-orm";
import { uploads } from "@pactflow/db";
import type { PactFlowDatabase } from "@pactflow/db/client";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
function config(publicUrl = false) {
  const endpoint = publicUrl
    ? process.env.S3_PUBLIC_ENDPOINT
    : process.env.S3_ENDPOINT;
  if (
    !endpoint ||
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY ||
    !process.env.S3_BUCKET
  )
    throw Object.assign(new Error("Private storage unavailable"), {
      code: "STORAGE_UNAVAILABLE",
    });
  if (
    publicUrl &&
    process.env.NODE_ENV === "production" &&
    new URL(endpoint).protocol !== "https:"
  )
    throw new Error("Public storage requires HTTPS");
  return {
    client: new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    }),
    bucket: process.env.S3_BUCKET,
  };
}
export async function putPrivateObject(
  key: string,
  body: Buffer,
  mime: string,
) {
  const { client, bucket } = config();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mime,
    }),
  );
}
export async function signedDownload(key: string, name: string) {
  const { client, bucket } = config(true);
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${name.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    }),
    { expiresIn: 60 },
  );
}
export async function readPrivateUpload(db: PactFlowDatabase, id: string) {
  const [file] = await db.select().from(uploads).where(eq(uploads.id, id));
  if (!file || file.status !== "READY") throw new Error("FILE_NOT_READY");
  const { client, bucket } = config();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: file.objectKey }),
  );
  if (
    !result.Body ||
    (result.ContentLength ?? MAX_FILE_BYTES + 1) > MAX_FILE_BYTES
  )
    throw new Error("ARTIFACT_TOO_LARGE");
  const body = Buffer.from(await result.Body.transformToByteArray());
  if (body.length > MAX_FILE_BYTES || keccak256(body) !== file.contentHash)
    throw new Error("FILE_HASH_MISMATCH");
  return { body, mime: file.mime };
}
export function validateFile(name: string, mime: string, body: Buffer) {
  const allowed: Record<string, string[]> = {
    "application/pdf": ["pdf"],
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
    "text/plain": ["txt"],
    "text/csv": ["csv"],
    "application/json": ["json"],
  };
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  if (
    !name ||
    name.length > 160 ||
    !allowed[mime]?.includes(extension) ||
    !body.length ||
    body.length > MAX_FILE_BYTES
  )
    throw Object.assign(new Error("Invalid file"), { code: "INVALID_FILE" });
  if (
    mime === "application/pdf" &&
    !body.subarray(0, 5).equals(Buffer.from("%PDF-"))
  )
    throw new Error("INVALID_FILE");
  if (
    mime === "image/png" &&
    !body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error("INVALID_FILE");
  if (
    mime === "image/jpeg" &&
    (body[0] !== 255 || body[1] !== 216 || body[2] !== 255)
  )
    throw new Error("INVALID_FILE");
  if (mime === "application/json") JSON.parse(body.toString("utf8"));
}
export async function scanFile(body: Buffer): Promise<void> {
  if (!process.env.CLAMAV_HOST)
    throw Object.assign(new Error("Malware scanner unavailable"), {
      code: "SCANNER_UNAVAILABLE",
    });
  await new Promise<void>((resolve, reject) => {
    const socket = connect({
      host: process.env.CLAMAV_HOST!,
      port: Number(process.env.CLAMAV_PORT ?? 3310),
    });
    let response = "";
    socket.setTimeout(20000, () =>
      socket.destroy(
        Object.assign(new Error("Scanner timed out"), {
          code: "SCANNER_UNAVAILABLE",
        }),
      ),
    );
    socket.on("error", reject);
    socket.on("data", (chunk) => {
      response += chunk.toString();
      if (response.includes("\0")) {
        socket.end();
        if (response.includes("stream: OK")) resolve();
        else
          reject(
            Object.assign(new Error("File rejected by scanner"), {
              code: response.includes("FOUND")
                ? "MALWARE_FOUND"
                : "SCANNER_UNAVAILABLE",
            }),
          );
      }
    });
    socket.on("end", () => {
      if (!response.includes("\0")) reject(new Error("SCANNER_UNAVAILABLE"));
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let i = 0; i < body.length; i += 65536) {
        const chunk = body.subarray(i, i + 65536);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}
