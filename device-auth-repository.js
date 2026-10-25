"use strict";

// Adapter for node-postgres. Query joins both authorization layers so a revoked
// device or disabled principal is never authenticated. No caller-owned ID input.
function createDeviceAuthRepository(pool) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool required");
  return Object.freeze({
    async findActiveDeviceByCredentialHash(hash) {
      if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) return null;
      const result = await pool.query(
        `SELECT d.device_id AS "deviceId", d.principal_id AS "principalId"
           FROM alert_devices d
           JOIN alert_principals p ON p.principal_id = d.principal_id
          WHERE d.credential_hash = $1
            AND d.revoked_at IS NULL
            AND p.disabled_at IS NULL
          LIMIT 1`,
        [hash]
      );
      const row = result && Array.isArray(result.rows) ? result.rows[0] : null;
      return row && typeof row.deviceId === "string" && typeof row.principalId === "string"
        ? { deviceId: row.deviceId, principalId: row.principalId }
        : null;
    }
  });
}
module.exports = { createDeviceAuthRepository };
