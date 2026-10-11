import db from '../../database/pool.js';

const AuditService = Object.freeze({
  async record(user, action, table, status) {
    try {
      await db.query(
        `INSERT INTO activity_log
          (user_id, username, action_name, target_table, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          user?.id || null,
          user?.username || 'unknown_user',
          String(action),
          String(table),
          String(status)
        ]
      );

      return true;
    } catch (error) {
      console.error(`[AUDIT_LOG_FAILURE] ${error.message}`);
      return false;
    }
  }
});

export default AuditService;
