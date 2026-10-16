import dbPool from '../../../../database/pool.js';

const accountManagerRepository = {
  getMaxSequenceByUsernamePrefix: async (prefix) => {
  const result = await dbPool.query(
    `SELECT username
     FROM login
     WHERE username LIKE $1`,
    [`${prefix}%`]
  );

  const maxSequence = result.rows.reduce((max, row) => {
    const suffix = row.username.slice(prefix.length);

    if (!/^\d+$/.test(suffix)) {
      return max;
    }

    return Math.max(max, Number(suffix));
  }, 0);

  return maxSequence;
},

  createUser: async ({
    username,
    email,
    passwordHash,
    role
  }) => {
    const result = await dbPool.query(
      `INSERT INTO login (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [username, email, passwordHash, role]
    );

    return result;
  },

  findPasswordHashByUserId: async (userId) => {
    const result = await dbPool.query(
      `SELECT password_hash
       FROM login
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    return result;
  },

  updatePasswordHash: async (userId, passwordHash) => {
    return await dbPool.query(
      `UPDATE login
       SET password_hash = $1
       WHERE id = $2`,
      [passwordHash, userId]
    );
  }
};

export default accountManagerRepository;
