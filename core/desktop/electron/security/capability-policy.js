const CAPABILITY_ROLES = Object.freeze({
  TRUNCATE_HARDWARE_DATA: Object.freeze(['owner']),
  APPROVE_DEVICE: Object.freeze(['owner']),
  CHECK_HEARTBEAT_AND_DEVICES: Object.freeze(['owner', 'adminmaster']),
  REGISTER_USER: Object.freeze(['owner'])
});

function normalizeRole(role) {
  return String(role || 'user')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

const CapabilityPolicy = Object.freeze({
  getAllowedRoles(action) {
    return CAPABILITY_ROLES[action] || null;
  },

  isAllowed(action, role) {
    const allowedRoles = CAPABILITY_ROLES[action];

    if (!allowedRoles) return true;

    return allowedRoles.includes(normalizeRole(role));
  },

  assert(action, role) {
    if (!CapabilityPolicy.isAllowed(action, role)) {
      throw new Error(
        `CAPABILITY_DENIED:${String(action)}:${normalizeRole(role)}`
      );
    }

    return true;
  }
});

export default CapabilityPolicy;
