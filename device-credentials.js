"use strict";
const crypto = require("node:crypto");

// Opaque device credentials: show plaintext once to the owner, persist only hash.
// A principal ID is assigned by trusted provisioning, never parsed from token text.
const TOKEN_RE = /^[A-Za-z0-9_-]{40,128}$/;
function issueDeviceCredential() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashDeviceCredential(token) };
}
function hashDeviceCredential(token) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  return crypto.createHash("sha256").update(token,"utf8").digest("hex");
}
function credentialMatches(token, expectedHash) {
  const actual = hashDeviceCredential(token);
  if (!actual || typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual,"hex"),Buffer.from(expectedHash,"hex"));
}
module.exports = { issueDeviceCredential, hashDeviceCredential, credentialMatches };
