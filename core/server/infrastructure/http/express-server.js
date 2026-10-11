import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRoutes from './routes/health.routes.js';
import loginRoutes from './routes/login.routes.js';
import clientRoutes from './routes/client.routes.js';
import sessionRoutes from './routes/session.routes.js';
import logoutRoutes from './routes/logout.routes.js';
import ownerRoutes from './routes/owner.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import userRoutes from './routes/user.routes.js';
import dynamicCrudRoutes from './routes/dynamic-crud.routes.js';
import securityMiddleware from './middleware/security.middleware.js';

const ExpressServer = {
  start: () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appExpress = express();

    appExpress.set(
      'trust proxy',
      process.env.TRUST_PROXY === 'true' ? 1 : false
    );

    appExpress.disable('x-powered-by');

    appExpress.use(
      express.json({
        limit: process.env.JSON_BODY_LIMIT || '100kb'
      })
    );

    appExpress.use(securityMiddleware);

    appExpress.use(healthRoutes);

    appExpress.use(loginRoutes);
    appExpress.use(clientRoutes);
    
    appExpress.use(sessionRoutes);

    appExpress.use(logoutRoutes);

appExpress.use(ownerRoutes);

appExpress.use(settingsRoutes);

appExpress.use(userRoutes);






    appExpress.use(dynamicCrudRoutes);

appExpress.use((err, req, res, next) => {
      console.error(`[EXPRESS_GLOBAL_ERROR] ${err.message}`);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(500).json({
        status: 'error',
        message: 'Kesalahan sistem internal.'
      });
    });

    const vpsPort = parseInt(process.env.PORT || '3000', 10);

    if (
      !Number.isInteger(vpsPort) ||
      vpsPort < 1 ||
      vpsPort > 65535
    ) {
      throw new Error('PORT tidak valid.');
    }

    return appExpress.listen(
vpsPort,
'127.0.0.1',
() =>
        console.log(
          `[EXPRESS_SUCCESS] Server aktif pada port ${vpsPort}`
        )
    );
  }
};

export default ExpressServer;
