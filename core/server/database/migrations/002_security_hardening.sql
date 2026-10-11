-- Security hardening migration
ALTER TABLE users_devices
  ADD COLUMN IF NOT EXISTS activation_code_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ;

-- Existing plaintext OTPs must never remain usable.
UPDATE users_devices
SET activation_code = NULL
WHERE activation_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_devices_user_fingerprint
  ON users_devices(user_id, device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_users_devices_activation_hash
  ON users_devices(activation_code_hash)
  WHERE activation_code_hash IS NOT NULL;

-- Prevent more than one active pending/verified record for the same device.
-- The unique index above also closes concurrent duplicate-registration paths.
