import dbPool from '../../../../database/pool.js';

const accountManagerRepository = {
  countUsersByUsernamePrefix: async (prefix) => {
    const result = await dbPool.query(
      `SELECT COUNT(*)::integer AS total
       FROM login
       WHERE username LIKE $1`,
      [`${prefix}%`]
    );

    return Number(result.rows[0]?.total || 0);
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
