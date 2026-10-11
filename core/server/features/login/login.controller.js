import loginValidator from './login.validator.js';
import loginDTO from './login.dto.js';
import loginService from './login.service.js';
import antiBruteForceService from '../security/anti-brute-force/anti-brute-force.service.js';
import loginRepository from './login.repository.js';
import AuditService from '../../application/audit/audit.service.js';
import jwtTokenController from '../security/jwt-token/jwt-token.controller.js';
import crypto from 'crypto';
import { getCookie, serializeCookie } from '../../infrastructure/http/cookies.js';

const loginController = {
  catatAuditAuth: async (username, aksi, status) => {
    try {
      
      const userRes = await loginRepository.findUserByUsername(username);
      
      
await AuditService.record(
{
id: userRes?.id || null,
username: username || 'unknown_user'
},
aksi,
'login',
status
);
      
    } catch (error) {
      console.error(`[AUTH_LOG_FAILURE] ${error.message}`);
    }
  },
  
  handleLoginRequest: async (rawPayload, clientKey = 'local_device') => {
    const inputUsername = String(rawPayload?.username || '').trim();
    const trackingKey =
    inputUsername !== ''
    ? `${clientKey}:${inputUsername}`
    : `${clientKey}:anonymous`;
    
    try {
      const lockStatus =
      antiBruteForceService.checkLockoutStatus(trackingKey);
      
      if (lockStatus.isLocked) {
        await loginController.catatAuditAuth(
          inputUsername,
          'LOGIN_ATTEMPT',
          'BLOCKED_BRUTEFORCE'
        );
        
        return {
          success: false,
          error: `Akses Dibekukan. Terlalu banyak percobaan salah! Sisa waktu: ${lockStatus.remainingTime} menit.`
        };
      }
      
      const validation =
      await loginValidator.validateInput(rawPayload);
      
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }
      
      const sanitizedDto = loginDTO.transformInput(rawPayload);
      
      
      const result =
      await loginService.executeLogin(sanitizedDto);
      
      
      if (result?.success) {
        antiBruteForceService.resetTracker(trackingKey);
        
        
        await loginController.catatAuditAuth(
          sanitizedDto.username,
          'LOGIN_SUCCESS',
          'SUCCESS'
        );
        
        
        return result;
      }
      
      const failure =
      antiBruteForceService.registerFailedAttempt(trackingKey);
      
      await loginController.catatAuditAuth(
        sanitizedDto.username,
        'LOGIN_FAILED',
        'INVALID_CREDENTIALS'
      );
      
      return {
        success: false,
        error: `${result?.error || 'Kredensial yang Anda masukkan salah.'} ${failure.message}`
      };
    } catch (error) {
      console.error(
        `[LOGIN_CONTROLLER_FATAL] ${error.message}`
      );
      
      return {
        success: false,
        error: 'Kegagalan sistem internal pada proses login.'
      };
    }
  },
  
  handleExpressLogin: async (req, res) => {
    try {
      const clientIp =
      req.ip ||
      req.socket.remoteAddress ||
      'unknown_vps_client';
        
        const existingDeviceId =
        getCookie(req, 'ei_device_id');
        
        const browserDeviceId =
        /^[a-f0-9]{64}$/.test(existingDeviceId)
        ? existingDeviceId
        : crypto.randomBytes(32).toString('hex');
        
        const loginPayload = {
          ...(req.body || {}),
          fingerprint: browserDeviceId
        };
        
        
        const result =
        await loginController.handleLoginRequest(
          loginPayload,
          clientIp
        );
        
        
        if (!result.success) {
          return res
          .status(
            result.error?.includes('Dibekukan')
            ? 429
            : 401
          )
          .json(result);
        }
        
        
        const tokens =
        await jwtTokenController.issueSessionToken(
          result.user,
          {
            deviceFingerprint: browserDeviceId,
            userAgent: req.get('user-agent') || null,
                                                   ipAddress: clientIp
          }
        );
        
        
        if (!tokens.success) {
          return res.status(500).json({
            success: false,
            error: 'Login berhasil tetapi sesi gagal dibuat.'
          });
        }
        
        res.setHeader('Set-Cookie', [
          serializeCookie(
            'ei_device_id',
            browserDeviceId,
            60 * 60 * 24 * 365
          ),
          serializeCookie(
            'ei_access_token',
            tokens.accessToken,
            15 * 60
          ),
          serializeCookie(
            'ei_refresh_token',
            tokens.refreshToken,
            7 * 24 * 60 * 60
          )
        ]);
        
        
        return res.status(200).json({
          success: true,
          user: result.user,
          expiresAt: tokens.expiresAt
        });
    } catch (error) {
      console.error(
        `[EXPRESS_LOGIN_FATAL] ${error.message}`
      );
      
      return res.status(500).json({
        success: false,
        error: 'Terjadi kesalahan internal pada server login.'
      });
    }
  },

  handleExpressClientLogin: async (req, res) => {
    try {
      const clientIp =
        req.ip ||
        req.socket.remoteAddress ||
        'unknown_vps_client';

      const loginPayload = {
        ...(req.body || {}),
        fingerprint: String(req.body?.fingerprint || '')
          .trim()
          .toLowerCase()
      };

      const result = await loginController.handleLoginRequest(
        loginPayload,
        clientIp
      );

      if (!result.success) {
        return res
          .status(result.error?.includes('Dibekukan') ? 429 : 401)
          .json(result);
      }

      const tokens = await jwtTokenController.issueSessionToken(
        result.user,
        {
          deviceFingerprint: loginPayload.fingerprint,
          userAgent: req.get('user-agent') || null,
          ipAddress: clientIp
        }
      );

      if (!tokens.success) {
        return res.status(500).json({
          success: false,
          error: 'Login berhasil tetapi sesi gagal dibuat.'
        });
      }

      return res.status(200).json({
        success: true,
        user: result.user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt
      });
    } catch (error) {
      console.error(
        `[EXPRESS_CLIENT_LOGIN_FATAL] ${error.message}`
      );

      return res.status(500).json({
        success: false,
        error: 'Terjadi kesalahan internal pada login client.'
      });
    }
  },
};

export default loginController;
