import crypto from 'crypto';
import db from '../../../database/pool.js';

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');

const sessionRepository = {
  hashRefreshToken,

  create: async ({
    userId,
    refreshToken,
    expiresAt,
    deviceFingerprint = null,
    userAgent = null,
    ipAddress = null
  }) => {
    const result = await db.query(
      `INSERT INTO auth_sessions
        (user_id, refresh_token_hash, expires_at, device_fingerprint, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, expires_at, created_at`,
      [
        userId,
        hashRefreshToken(refreshToken),
        expiresAt,
        deviceFingerprint,
        userAgent,
        ipAddress
      ]
    );

    return result.rows[0];
  },

  findForUpdate: async (client, refreshToken) => {
    const result = await client.query(
      `SELECT id, user_id, refresh_token_hash, expires_at, revoked_at,
              device_fingerprint, user_agent, ip_address
       FROM auth_sessions
       WHERE refresh_token_hash = $1
       FOR UPDATE`,
      [hashRefreshToken(refreshToken)]
    );

    return result.rows[0] || null;
  },
  findByRefreshToken: async (refreshToken) => {
    const result = await db.query(
      `SELECT id, user_id, expires_at, revoked_at,
              device_fingerprint, user_agent, ip_address
       FROM auth_sessions
       WHERE refresh_token_hash = $1
       LIMIT 1`,
      [hashRefreshToken(refreshToken)]
    );

    return result.rows[0] || null;
  },

  rotate: async ({
    refreshToken,
    expectedSessionId,
    userId,
    nextRefreshToken,
    nextExpiresAt,
    deviceFingerprint = null,
    userAgent = null,
    ipAddress = null
  }) => {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const session = await sessionRepository.findForUpdate(
        client,
        refreshToken
      );

      if (!session || Number(session.id) !== Number(expectedSessionId)) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Refresh token tidak sah.'
        };
      }

      if (session.revoked_at) {
        await sessionRepository.revokeActiveForUser(client, session.user_id);
        await client.query('COMMIT');

        return {
          success: false,
          reused: true,
          error: 'Refresh token sudah digunakan atau dicabut.'
        };
      }

      if (new Date(session.expires_at).getTime() <= Date.now()) {
        await sessionRepository.revokeByIdWithClient(client, session.id);
        await client.query('COMMIT');

        return {
          success: false,
          expired: true,
          error: 'Refresh token sudah kedaluwarsa.'
        };
      }

      const inserted = await sessionRepository.createRotated(client, {
        userId,
        refreshToken: nextRefreshToken,
        expiresAt: nextExpiresAt,
        deviceFingerprint: deviceFingerprint ?? session.device_fingerprint,
        userAgent: userAgent ?? session.user_agent,
        ipAddress: ipAddress ?? session.ip_address
      });

      const revoked = await sessionRepository.replaceSession(
        client,
        session.id,
        inserted.id
      );

      if (revoked.rowCount !== 1) {
        await client.query('ROLLBACK');

        return {
          success: false,
          reused: true,
          error: 'Refresh token sudah digunakan.'
        };
      }

      await client.query('COMMIT');

      return {
        success: true,
        nextSessionId: inserted.id
      };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {}

      throw error;
    } finally {
      client.release();
    }
  },


  findActiveById: async (sessionId, userId) => {
    const result = await db.query(
      `SELECT id, user_id
       FROM auth_sessions
       WHERE id = $1
         AND user_id = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [sessionId, userId]
    );

    return result.rows[0] || null;
  },

  createRotated: async (
    client,
    {
      userId,
      refreshToken,
      expiresAt,
      deviceFingerprint = null,
      userAgent = null,
      ipAddress = null
    }
  ) => {
    const result = await client.query(
      `INSERT INTO auth_sessions
        (user_id, refresh_token_hash, expires_at, device_fingerprint, user_agent, ip_address)
       VALUES ($1, encode(digest($2, 'sha256'), 'hex'), $3, $4, $5, $6)
       RETURNING id`,
      [
        userId,
        refreshToken,
        expiresAt,
        deviceFingerprint,
        userAgent,
        ipAddress
      ]
    );

    return result.rows[0];
  },

  revokeActiveForUser: async (client, userId) => {
    return client.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, NOW()),
           last_used_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId]
    );
  },

  revokeByIdWithClient: async (client, sessionId) => {
    return client.query(
      `UPDATE auth_sessions
       SET revoked_at = NOW(),
           last_used_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );
  },

  replaceSession: async (client, sessionId, nextSessionId) => {
    return client.query(
      `UPDATE auth_sessions
       SET revoked_at = NOW(),
           replaced_by = $2,
           last_used_at = NOW()
       WHERE id = $1
         AND revoked_at IS NULL`,
      [sessionId, nextSessionId]
    );
  },

  revokeByRefreshToken: async (refreshToken) => {
    return db.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, NOW()),
           last_used_at = NOW()
       WHERE refresh_token_hash = $1`,
      [hashRefreshToken(refreshToken)]
    );
  },

  revoke: async (sessionId) =>
    db.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, NOW()),
           last_used_at = NOW()
       WHERE id = $1`,
      [sessionId]
    ),

  revokeAllForUser: async (userId) =>
    db.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, NOW()),
           last_used_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId]
    )
};

export default sessionRepository;
