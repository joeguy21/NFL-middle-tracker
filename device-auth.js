"use strict";
const { hashDeviceCredential } = require("./device-credentials");

// Extract exactly one opaque bearer credential. Callers should pass the
// request's raw Authorization header; duplicate/malformed headers fail closed.
function readBearerCredential(header) {
  if (typeof header !== "string") return null;
  const match = /^Bearer ([A-Za-z0-9_-]{40,128})$/i.exec(header);
  return match ? match[1] : null;
}

// repository.findActiveDeviceByCredentialHash(hash) must perform a parameterized
// lookup joining alert_devices to alert_principals, requiring both records
// enabled and the device not revoked. It must return {deviceId, principalId}
// or null. Never trust principal IDs supplied by a caller.
async function authenticateDevice(header, repository) {
  const token = readBearerCredential(header);
  if (!token || !repository || typeof repository.findActiveDeviceByCredentialHash !== "function") {
    return null;
  }
  const hash = hashDeviceCredential(token);
  if (!hash) return null;
  const record = await repository.findActiveDeviceByCredentialHash(hash);
  if (!record || typeof record.deviceId !== "string" || !record.deviceId ||
      typeof record.principalId !== "string" || !record.principalId) return null;
  return Object.freeze({ deviceId: record.deviceId, principalId: record.principalId });
}

module.exports = { readBearerCredential, authenticateDevice };
