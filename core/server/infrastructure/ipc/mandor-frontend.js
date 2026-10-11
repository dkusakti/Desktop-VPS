import db from '../../database/pool.js';
import AuditService from '../../application/audit/audit.service.js';

const CACHE_STRUKTUR_RAM = new Map();
const PROTECTED_TABLES = new Set(['login', 'auth_sessions', 'schema_migrations']);
const READ_ONLY_TABLES = new Set(['app_menus', 'activity_log']);
const SENSITIVE_COLUMNS = new Set(['password', 'password_hash', 'refresh_token', 'refresh_token_hash', 'otp_secret']);
const ROLE_ALIASES = { admin: 'adminmaster', master_admin: 'adminmaster', super_admin: 'owner' };
const normalizeRole = (role) => { const r = String(role || 'user').trim().toLowerCase().replace(/\s+/g, ''); return ROLE_ALIASES[r] || r; };

const ambilRoleNormal = (currentSessionRole) => {
  return normalizeRole(currentSessionRole);
};
const otorisasiResource = async (table, role, aksi, contextUser) => {
  const menu = await db.query(
    `SELECT roles_allowed FROM app_menus WHERE LOWER(folder_name) = $1 LIMIT 1`,
    [table]
  );

  const isBuiltinRead = READ_ONLY_TABLES.has(table);

  if (menu.rowCount !== 1 && !isBuiltinRead) {
    await audit(contextUser, aksi, table, 'BLOCKED_TABLE_NOT_WHITELISTED');
    return {
      allowed: false,
      pesan: 'Resource tidak terdaftar.'
    };
  }

  if (menu.rowCount === 1) {
    const allowedRoles = String(menu.rows[0].roles_allowed || '')
      .split(/[,.]/)
      .map(normalizeRole)
      .filter(Boolean);

    if (!(allowedRoles.includes('all') || allowedRoles.includes(role))) {
      await audit(contextUser, aksi, table, 'BLOCKED_ROLE');
      return {
        allowed: false,
        pesan: 'Akses Ditolak! Tingkat otoritas tidak mencukupi.'
      };
    }
  } else if (table !== 'app_menus' && !['owner', 'adminmaster'].includes(role)) {
    await audit(contextUser, aksi, table, 'BLOCKED_BUILTIN_RESOURCE');
    return {
      allowed: false,
      pesan: 'Akses Ditolak.'
    };
  }

  return {
    allowed: true
  };
};

const ambilStrukturTabel = async (table) => {
  if (!CACHE_STRUKTUR_RAM.has(table)) {
    const schema = await db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );

    if (!schema.rowCount) {
      return {
        ok: false,
        pesan: 'Resource database tidak ditemukan.'
      };
    }

    CACHE_STRUKTUR_RAM.set(
      table,
      schema.rows.map((row) => row.column_name)
    );
  }

  return {
    ok: true,
    columns: CACHE_STRUKTUR_RAM.get(table)
  };
};

const ambilKolomAman = (columns) => {
  return columns.filter(
    (column) => !SENSITIVE_COLUMNS.has(column.toLowerCase())
  );
};

const ambilDataResource = async (
  table,
  columns,
  safeColumns,
  suratPerintah,
  role
) => {
  let requested = Array.isArray(suratPerintah.kolom_diminta)
    ? suratPerintah.kolom_diminta.map(String)
    : safeColumns;

  requested = requested
    .map((column) => column.trim())
    .filter((column) => safeColumns.includes(column));

  if (!requested.length) {
    return {
      ok: false,
      pesan: 'Tidak ada kolom yang diizinkan.'
    };
  }

  const orderColumn =
    table === 'activity_log' && columns.includes('created_at')
      ? 'created_at'
      : (columns.includes('sort_order')
          ? 'sort_order'
          : (columns.includes('id') ? 'id' : columns[0]));

  const orderDirection = table === 'activity_log' ? 'DESC' : 'ASC';

  const limit = Math.min(
    Math.max(Number(suratPerintah.limit) || 100, 1),
    500
  );

  const offset = Math.min(
    Math.max(Number(suratPerintah.offset) || 0, 0),
    1000000
  );

  const result = await db.query(
    `SELECT ${requested.map(quoteIdentifier).join(', ')}
     FROM ${quoteIdentifier(table)}
     ORDER BY ${quoteIdentifier(orderColumn)} ${orderDirection}
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  let rows = result.rows;

  if (table === 'app_menus') {
    rows = rows.filter((row) => {
      const allowedRoles = String(row.roles_allowed || '')
        .split(/[,.]/)
        .map(normalizeRole)
        .filter(Boolean);

      return allowedRoles.includes('all') || allowedRoles.includes(role);
    });
  }

  return {
    ok: true,
    data: rows,
    pagination: {
      limit,
      offset,
      returned: rows.length
    }
  };
};

const tambahDataResource = async (
  table,
  safeColumns,
  suratPerintah
) => {
  const input = suratPerintah.data_input;

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      pesan: 'data_input tidak valid.'
    };
  }

  const keys = Object.keys(input).filter(
    (key) => safeColumns.includes(key) && key !== 'id'
  );

  if (!keys.length) {
    return {
      ok: false,
      pesan: 'Tidak ada kolom input yang diizinkan.'
    };
  }

  const result = await db.query(
    `INSERT INTO ${quoteIdentifier(table)} (${keys.map(quoteIdentifier).join(', ')})
     VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING ${safeColumns.map(quoteIdentifier).join(', ')}`,
    keys.map((key) => input[key])
  );

  return {
    ok: true,
    data: result.rows[0]
  };
};

const hapusDataResource = async (
  table,
  columns,
  suratPerintah
) => {
  const id = suratPerintah.id_target;

  if (id === undefined || id === null || !columns.includes('id')) {
    return {
      ok: false,
      pesan: 'id_target wajib dan tabel harus memiliki kolom id.'
    };
  }

  const result = await db.query(
    `DELETE FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier('id')} = $1 RETURNING id`,
    [id]
  );

  if (!result.rowCount) {
    return {
      ok: false,
      pesan: 'Data tidak ditemukan.'
    };
  }

  return {
    ok: true,
    id: result.rows[0].id
  };
};

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;
const audit = AuditService.record;
const validasiPerintah = (suratPerintah) => {
  if (
    !suratPerintah ||
    typeof suratPerintah !== 'object' ||
    Array.isArray(suratPerintah)
  ) {
    return {
      valid: false,
      pesan: 'Surat perintah tidak valid.'
    };
  }
  
  const { aksi, target_tabel: targetTable } = suratPerintah;
  const table = String(targetTable || '').trim().toLowerCase();
  
  if (
    !table ||
    !['ambil_data', 'tambah_data', 'hapus_data'].includes(aksi)
  ) {
    return {
      valid: false,
      pesan: 'Operasi CRUD tidak valid.'
    };
  }
  
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(table)) {
    return {
      valid: false,
      pesan: 'Nama tabel tidak valid.'
    };
  }
  
  if (PROTECTED_TABLES.has(table)) {
    return {
      valid: false,
      pesan: 'Akses ke resource sistem ditolak.'
    };
  }
  
  if (READ_ONLY_TABLES.has(table) && aksi !== 'ambil_data') {
    return {
      valid: false,
      pesan: 'Resource hanya dapat dibaca.'
    };
  }
  
  return {
    valid: true,
    aksi,
    table
  };
};

const MandorFrontend = {

  catatLogAktivitas: audit,
  eksekusiMenuSpesifik: async (suratPerintah, currentSessionRole, contextUser = {}) => {
    const timestamp = new Date().toISOString();
    const validasi = validasiPerintah(suratPerintah);
    
    if (!validasi.valid) {
      return {
        status: 'ERROR',
        pesan: validasi.pesan
      };
    }
    
    const { aksi, table } = validasi;
    const role = ambilRoleNormal(currentSessionRole);
    try {
      const otorisasi = await otorisasiResource(
        table,
        role,
        aksi,
        contextUser
      );

      if (!otorisasi.allowed) {
        return {
          status: 'ERROR',
          pesan: otorisasi.pesan
        };
      }
      if (aksi === 'hapus_data' && !['owner', 'adminmaster'].includes(role)) { await audit(contextUser, aksi, table, 'BLOCKED_DELETE'); return { status: 'ERROR', pesan: 'Hanya owner/adminmaster yang dapat menghapus data.' }; }
      if (aksi === 'tambah_data' && !['owner', 'adminmaster'].includes(role)) { await audit(contextUser, aksi, table, 'BLOCKED_INSERT'); return { status: 'ERROR', pesan: 'Role ini tidak dapat menambah data.' }; }

      const struktur = await ambilStrukturTabel(table);

      if (!struktur.ok) {
        return {
          status: 'ERROR',
          pesan: struktur.pesan
        };
      }

      const columns = struktur.columns;
      const safeColumns = ambilKolomAman(columns);

      if (aksi === 'ambil_data') {
        const hasil = await ambilDataResource(
          table,
          columns,
          safeColumns,
          suratPerintah,
          role
        );

        if (!hasil.ok) {
          return {
            status: 'ERROR',
            pesan: hasil.pesan
          };
        }

        await audit(contextUser, aksi, table, 'SUCCESS');

        return {
          status: 'OK',
          data: hasil.data,
          pagination: hasil.pagination
        };
      }

      if (aksi === 'tambah_data') {
        const hasil = await tambahDataResource(
          table,
          safeColumns,
          suratPerintah
        );

        if (!hasil.ok) {
          return {
            status: 'ERROR',
            pesan: hasil.pesan
          };
        }

        await audit(contextUser, aksi, table, 'SUCCESS');

        return {
          status: 'OK',
          data: hasil.data
        };
      }

      const hasil = await hapusDataResource(
        table,
        columns,
        suratPerintah
      );

      if (!hasil.ok) {
        return {
          status: 'ERROR',
          pesan: hasil.pesan
        };
      }

      await audit(contextUser, aksi, table, 'SUCCESS');

      return {
        status: 'OK',
        pesan: 'Data berhasil dihapus.',
        id: hasil.id
      };
    } catch (error) {
      console.error(`[MANDOR_FRONTEND_FATAL] [${timestamp}] ${error.message}`);
      await audit(contextUser, aksi, table, 'FAILED');
      return { status: 'ERROR', pesan: 'Gagal memproses operasi database.' };
    }
  },
  handleExpressDynamicCRUD: async (req, res) => {
    try {
      const result = await MandorFrontend.eksekusiMenuSpesifik(req.body, req.user?.role, req.user);
      const forbidden = result.status === 'ERROR' && /Ditolak|tidak terdaftar|tidak dapat|tidak mencukupi/i.test(result.pesan || '');
      return res.status(result.status === 'ERROR' ? (forbidden ? 403 : 400) : 200).json(result);
    } catch { return res.status(500).json({ status: 'ERROR', pesan: 'Kegagalan internal CRUD.' }); }
  }
};
export default MandorFrontend;
