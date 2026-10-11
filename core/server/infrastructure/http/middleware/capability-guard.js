import CapabilityPolicy from '../../../application/capabilities/capability-policy.js';

const vpsRoleGuard = (actionName) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Sesi tidak valid.'
    });
  }

  const capability = CapabilityPolicy.assert(
    actionName,
    req.user.role
  );

  if (!capability.allowed) {
    return res.status(403).json({
      status: 'error',
      message: 'Otoritas akun tidak mencukupi.'
    });
  }

  return next();
};

export default vpsRoleGuard;
