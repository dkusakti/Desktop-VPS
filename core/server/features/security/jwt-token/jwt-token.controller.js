import JwtTokenDto from './jwt-token.dto.js';
import jwtTokenService from './jwt-token.service.js';
import sessionService from '../session/session.service.js';
import sessionRepository from '../session/session.repository.js';
import loginRepository from '../../login/login.repository.js';
import AuditService from '../../../application/audit/audit.service.js';
import { getCookie, serializeCookie, clearCookie } from '../../../infrastructure/http/cookies.js';

const normalizeRole = (role) =>
  String(role || 'user')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

class JwtTokenController {
  async issueSessionToken(userData, options = {}) {
    if (options === true && userData?.refreshToken) {
      return this.rotateSessionToken(String(userData.refreshToken));
    }

    try {
      const dto = new JwtTokenDto(userData);

      if (!dto.isValid()) {
        return {
          success: false,
          error: 'Data user tidak valid.'
        };
      }

      const sessionResult = await sessionService.createSession({
        userId: dto.id,
        deviceFingerprint:
          options.deviceFingerprint || userData?.fingerprint || null,
        userAgent: options.userAgent || null,
        ipAddress: options.ipAddress || null
      });

      const access = jwtTokenService.issueAccessToken(
        dto,
        sessionResult.session.id
      );

      return {
        success: true,
        accessToken: access.accessToken,
        refreshToken: sessionResult.refreshToken,
        expiresAt: access.expiresAt
      };
    } catch (error) {
      console.error(`[JWT_ISSUE_ERROR] ${error.message}`);

      return {
        success: false,
        error: 'Gagal membuat sesi autentikasi.'
      };
    }
  }

  async rotateSessionToken(refreshToken, metadata = {}) {
    if (
      !refreshToken ||
      typeof refreshToken !== 'string' ||
      refreshToken.length < 40 ||
      refreshToken.length > 256
    ) {
      return {
        success: false,
        error: 'Refresh token tidak valid.'
      };
    }

    try {
      const currentSession =
        await sessionRepository.findByRefreshToken(refreshToken);

      if (!currentSession) {
        return {
          success: false,
          error: 'Refresh token tidak sah.'
        };
      }

      const user =
        await loginRepository.findUserById(currentSession.user_id);

      if (!user) {
        await sessionRepository.revoke(currentSession.id);

        return {
          success: false,
          error: 'Akun tidak ditemukan.'
        };
      }

      const dto = new JwtTokenDto({
        ...user,
        role: normalizeRole(user.role)
      });

      if (!dto.isValid()) {
        await sessionRepository.revoke(currentSession.id);

        return {
          success: false,
          error: 'Role akun tidak valid.'
        };
      }

      const nextRefresh = sessionService.createOpaqueRefreshToken();
      const nextExpires = new Date(
        Date.now() + sessionService.refreshTtlSeconds * 1000
      );

      const rotation = await sessionRepository.rotate({
        refreshToken,
        expectedSessionId: currentSession.id,
        userId: dto.id,
        nextRefreshToken: nextRefresh,
        nextExpiresAt: nextExpires,
        deviceFingerprint: currentSession.device_fingerprint,
        userAgent: metadata.userAgent ?? currentSession.user_agent,
        ipAddress: metadata.ipAddress ?? currentSession.ip_address
      });

      if (!rotation.success) {
        return rotation;
      }

      const access = jwtTokenService.issueAccessToken(
        dto,
        rotation.nextSessionId
      );

      return {
        success: true,
        accessToken: access.accessToken,
        refreshToken: nextRefresh,
        expiresAt: access.expiresAt
      };
    } catch (error) {
      console.error(`[JWT_ROTATION_ERROR] ${error.message}`);

      return {
        success: false,
        error: 'Gagal melakukan rotasi sesi.'
      };
    }
  }

  async revokeSession(refreshToken) {
    if (!refreshToken || typeof refreshToken !== 'string') {
      return { success: true };
    }

    await sessionRepository.revokeByRefreshToken(refreshToken);

    return { success: true };
  }

  async revokeSessionById(sessionId) {
    if (sessionId) {
      await sessionService.revoke(sessionId);
    }

    return { success: true };
  }

  async validateActiveToken(token) {
    const access = jwtTokenService.verifyAccessToken(token);

    if (!access.success) {
      return access;
    }

    const activeSession = await sessionRepository.findActiveById(
      access.user.sessionId,
      access.user.id
    );

    if (!activeSession) {
      return {
        success: false,
        expired: false,
        error: 'Sesi sudah dicabut atau tidak aktif.'
      };
    }

    const user =
      await loginRepository.findUserById(activeSession.user_id);

    if (!user) {
      return {
        success: false,
        expired: false,
        error: 'Akun tidak ditemukan.'
      };
    }

    return {
      success: true,
      user: {
        id: Number(user.id),
        username: String(user.username),
        role: normalizeRole(user.role),
        sessionId: access.user.sessionId,
        jti: access.user.jti
      }
    };
  }

  expressAuthenticateToken = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken =
        authHeader?.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : '';

      const token =
        bearerToken || getCookie(req, 'ei_access_token');

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Token autentikasi diperlukan.'
        });
      }

      const validation =
        jwtTokenService.verifyAccessToken(token);

      if (!validation.success) {
        return res
          .status(validation.expired ? 401 : 403)
          .json({
            success: false,
            expired: validation.expired || false,
            error: validation.error
          });
      }

      const active =
        await sessionRepository.findActiveById(
          validation.user.sessionId,
          validation.user.id
        );

      if (!active) {
        return res.status(401).json({
          success: false,
          error: 'Sesi sudah dicabut atau tidak aktif.'
        });
      }

      const user =
        await loginRepository.findUserById(active.user_id);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Akun tidak ditemukan.'
        });
      }

      req.user = {
        id: Number(user.id),
        username: String(user.username),
        role: normalizeRole(user.role),
        sessionId: validation.user.sessionId,
        jti: validation.user.jti
      };

      return next();
    } catch (error) {
      console.error(`[JWT_AUTH_ERROR] ${error.message}`);

      return res.status(500).json({
        success: false,
        error: 'Gagal memvalidasi sesi.'
      });
    }
  };

  expressRotateSessionToken = async (req, res) => {
    try {
      // Refresh token hanya boleh berasal dari HttpOnly cookie.
      // Jangan menerima credential sesi dari request body.
      const refreshToken =
        getCookie(req, 'ei_refresh_token');

      const result = await this.rotateSessionToken(
        refreshToken,
        {
          userAgent: req.get('user-agent') || null,
          ipAddress: req.ip || null
        }
      );

      if (!result.success) {
        return res.status(401).json(result);
      }

      res.setHeader('Set-Cookie', [
        serializeCookie(
          'ei_access_token',
          result.accessToken,
          15 * 60
        ),
        serializeCookie(
          'ei_refresh_token',
          result.refreshToken,
          7 * 24 * 60 * 60
        )
      ]);

      return res.status(200).json({
        success: true,
        expiresAt: result.expiresAt
      });
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Kesalahan internal saat refresh sesi.'
      });
    }
  };

  expressLogout = async (req, res) => {
    try {
      const token = getCookie(req, 'ei_refresh_token');

      if (token) {
        const session = await sessionRepository.findByRefreshToken(token);

        await this.revokeSession(token);

        const user = session
          ? await loginRepository.findUserById(session.user_id)
          : null;

        await AuditService.record(
          {
            id: user?.id || req.user?.id || null,
            username: user?.username || req.user?.username || 'vps_client'
          },
          'LOGOUT',
          'auth_sessions',
          'SUCCESS'
        );
      }

      res.setHeader('Set-Cookie', [
        clearCookie('ei_access_token'),
        clearCookie('ei_refresh_token')
      ]);

      return res.status(200).json({
        success: true
      });
    } catch (error) {
      console.error(`[JWT_LOGOUT_ERROR] ${error.message}`);

      return res.status(500).json({
        success: false,
        error: 'Gagal melakukan logout.'
      });
    }
  };

  expressRotateClientSessionToken = async (req, res) => {
    try {
      const refreshToken = String(
        req.headers['x-refresh-token'] || ''
      ).trim();

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token tidak tersedia.'
        });
      }

      const result = await this.rotateSessionToken(
        refreshToken,
        {
          userAgent: req.get('user-agent') || null,
          ipAddress: req.ip || null
        }
      );

      if (!result.success) {
        return res.status(401).json(result);
      }

      return res.status(200).json({
        success: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt
      });
    } catch (error) {
      console.error(
        `[CLIENT_REFRESH_ERROR] ${error.message}`
      );

      return res.status(500).json({
        success: false,
        error: 'Kesalahan internal saat refresh sesi.'
      });
    }
  };

}

export default new JwtTokenController();
