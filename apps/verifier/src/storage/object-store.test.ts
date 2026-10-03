import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFile, scanFile, MAX_FILE_BYTES } from "./object-store";
test("file type, signature, extension and size checks reject disguised payloads", () => {
  assert.throws(() =>
    validateFile("a.exe", "application/pdf", Buffer.from("%PDF-data")),
  );
  assert.throws(() =>
    validateFile(
      "a.png",
      "image/png",
      Buffer.from("<script>alert(1)</script>"),
    ),
  );
  assert.throws(() =>
    validateFile("a.pdf", "application/pdf", Buffer.from("MZexec")),
  );
  assert.throws(() =>
    validateFile("a.json", "application/json", Buffer.from("not json")),
  );
  assert.throws(() =>
    validateFile("a.txt", "text/plain", Buffer.alloc(MAX_FILE_BYTES + 1)),
  );
  assert.doesNotThrow(() =>
    validateFile("a.json", "application/json", Buffer.from('{"valid":true}')),
  );
});
test("scanner outage fails closed before ready storage admission", async () => {
  const old = process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_HOST;
  try {
    await assert.rejects(scanFile(Buffer.from("valid text")), {
      code: "SCANNER_UNAVAILABLE",
    });
  } finally {
    if (old) process.env.CLAMAV_HOST = old;
  }
});
