const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'ponto_facial.db');

let db = null;
let dbReady = null;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function initDatabase() {
  if (dbReady) return dbReady;

  dbReady = (async () => {
    const SQL = await initSqlJs();

    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT DEFAULT '',
        face_descriptors TEXT NOT NULL,
        photo TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS time_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('entrada', 'saida')),
        timestamp TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('entrada', 'saida')),
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT DEFAULT '',
        date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_records_employee ON time_records(employee_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_records_timestamp ON time_records(timestamp)`);

    const employeeCols = queryAll("PRAGMA table_info(employees)").map(c => c.name);
    if (!employeeCols.includes('daily_rate')) {
      db.run("ALTER TABLE employees ADD COLUMN daily_rate REAL DEFAULT 0.0");
    }
    if (!employeeCols.includes('payment_method')) {
      db.run("ALTER TABLE employees ADD COLUMN payment_method TEXT DEFAULT 'PIX'");
    }
    if (!employeeCols.includes('pix_key_type')) {
      db.run("ALTER TABLE employees ADD COLUMN pix_key_type TEXT DEFAULT ''");
    }
    if (!employeeCols.includes('pix_key')) {
      db.run("ALTER TABLE employees ADD COLUMN pix_key TEXT DEFAULT ''");
    }
    if (!employeeCols.includes('location_id')) {
      db.run("ALTER TABLE employees ADD COLUMN location_id INTEGER DEFAULT NULL");
    }

    const recordCols = queryAll("PRAGMA table_info(time_records)").map(c => c.name);
    if (!recordCols.includes('location_id')) {
      db.run("ALTER TABLE time_records ADD COLUMN location_id INTEGER DEFAULT NULL");
    }

    const countRes = queryOne('SELECT COUNT(*) as count FROM admins');
    if (!countRes || countRes.count === 0) {
      const { hash, salt } = hashPassword('admin123');
      runSql('INSERT INTO admins (username, password_hash, salt) VALUES (?, ?, ?)', ['admin', hash, salt]);
    }

    const locCount = queryOne('SELECT COUNT(*) as count FROM locations');
    if (!locCount || locCount.count === 0) {
      runSql("INSERT INTO locations (name, address) VALUES (?, ?)", ['Sede Principal', 'Matriz']);
    }

    persist();
    return db;
  })();

  return dbReady;
}

function persist() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  const lastInsertRowid = db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0];
  const changes = db.getRowsModified();
  persist();
  return {
    lastInsertRowid,
    changes
  };
}

function createLocation({ name, address }) {
  const result = runSql(
    'INSERT INTO locations (name, address) VALUES (?, ?)',
    [name, address || '']
  );
  return getLocationById(result.lastInsertRowid);
}

function getAllLocations() {
  return queryAll(`
    SELECT l.id, l.name, l.address, l.created_at,
           COUNT(e.id) as employee_count
    FROM locations l
    LEFT JOIN employees e ON e.location_id = l.id
    GROUP BY l.id
    ORDER BY l.name
  `);
}

function getLocationById(id) {
  return queryOne('SELECT id, name, address, created_at FROM locations WHERE id = ?', [id]);
}

function deleteLocation(id) {
  runSql('UPDATE employees SET location_id = NULL WHERE location_id = ?', [id]);
  return runSql('DELETE FROM locations WHERE id = ?', [id]);
}

function createEmployee({ name, role, dailyRate, paymentMethod, pixKeyType, pixKey, locationId, faceDescriptors, photo }) {
  const result = runSql(
    `INSERT INTO employees (name, role, daily_rate, payment_method, pix_key_type, pix_key, location_id, face_descriptors, photo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      role || '',
      parseFloat(dailyRate) || 0.0,
      paymentMethod || 'PIX',
      pixKeyType || '',
      pixKey || '',
      locationId ? parseInt(locationId) : null,
      JSON.stringify(faceDescriptors),
      photo || null
    ]
  );
  return getEmployeeById(result.lastInsertRowid);
}

function updateEmployee(id, { name, role, dailyRate, paymentMethod, pixKeyType, pixKey, locationId, photo }) {
  const emp = getEmployeeById(id);
  if (!emp) throw new Error('Colaborador não encontrado');

  const updatedName = name !== undefined ? name : emp.name;
  const updatedRole = role !== undefined ? role : emp.role;
  const updatedDailyRate = dailyRate !== undefined ? parseFloat(dailyRate) : emp.daily_rate;
  const updatedPaymentMethod = paymentMethod !== undefined ? paymentMethod : emp.payment_method;
  const updatedPixKeyType = pixKeyType !== undefined ? pixKeyType : emp.pix_key_type;
  const updatedPixKey = pixKey !== undefined ? pixKey : emp.pix_key;
  const updatedLocationId = locationId !== undefined ? (locationId ? parseInt(locationId) : null) : emp.location_id;
  const updatedPhoto = photo !== undefined ? photo : emp.photo;

  runSql(
    `UPDATE employees
     SET name = ?, role = ?, daily_rate = ?, payment_method = ?, pix_key_type = ?, pix_key = ?, location_id = ?, photo = ?
     WHERE id = ?`,
    [
      updatedName,
      updatedRole,
      updatedDailyRate,
      updatedPaymentMethod,
      updatedPixKeyType,
      updatedPixKey,
      updatedLocationId,
      updatedPhoto,
      id
    ]
  );

  return getEmployeeById(id);
}

function getAllEmployees() {
  return queryAll(`
    SELECT e.id, e.name, e.role, e.daily_rate, e.payment_method, e.pix_key_type, e.pix_key,
           e.location_id, l.name as location_name, e.photo, e.created_at
    FROM employees e
    LEFT JOIN locations l ON l.id = e.location_id
    ORDER BY e.name
  `);
}

function getEmployeeById(id) {
  return queryOne(`
    SELECT e.id, e.name, e.role, e.daily_rate, e.payment_method, e.pix_key_type, e.pix_key,
           e.location_id, l.name as location_name, e.photo, e.created_at
    FROM employees e
    LEFT JOIN locations l ON l.id = e.location_id
    WHERE e.id = ?
  `, [id]);
}

function getAllDescriptors() {
  return queryAll('SELECT id, name, face_descriptors FROM employees').map(row => ({
    id: row.id,
    name: row.name,
    descriptors: JSON.parse(row.face_descriptors)
  }));
}

function deleteEmployee(id) {
  runSql('DELETE FROM time_records WHERE employee_id = ?', [id]);
  return runSql('DELETE FROM employees WHERE id = ?', [id]);
}

function createRecord({ employeeId, locationId, timestamp, type }) {
  const emp = getEmployeeById(employeeId);
  const locId = locationId || emp?.location_id || null;

  let recordType = type;
  if (!recordType) {
    const lastRecord = getLastRecordForEmployee(employeeId);
    recordType = (!lastRecord || lastRecord.type === 'saida') ? 'entrada' : 'saida';
  }

  let result;
  if (timestamp) {
    result = runSql(
      'INSERT INTO time_records (employee_id, location_id, type, timestamp) VALUES (?, ?, ?, ?)',
      [employeeId, locId, recordType, timestamp]
    );
  } else {
    result = runSql(
      'INSERT INTO time_records (employee_id, location_id, type) VALUES (?, ?, ?)',
      [employeeId, locId, recordType]
    );
  }
  return getRecordById(result.lastInsertRowid);
}

function getRecordById(id) {
  return queryOne(`
    SELECT r.id, r.employee_id, e.name as employee_name, l.name as location_name, r.type, r.timestamp
    FROM time_records r
    JOIN employees e ON e.id = r.employee_id
    LEFT JOIN locations l ON l.id = COALESCE(r.location_id, e.location_id)
    WHERE r.id = ?
  `, [id]);
}

function getLastRecordForEmployee(employeeId) {
  return queryOne(`
    SELECT id, employee_id, location_id, type, timestamp
    FROM time_records
    WHERE employee_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `, [employeeId]);
}

function getRecords({ employeeId, locationId, startDate, endDate, limit = 100 }) {
  let sql = `
    SELECT r.id, r.employee_id, e.name as employee_name, l.name as location_name, r.type, r.timestamp
    FROM time_records r
    JOIN employees e ON e.id = r.employee_id
    LEFT JOIN locations l ON l.id = COALESCE(r.location_id, e.location_id)
    WHERE 1=1
  `;
  const params = [];

  if (employeeId) {
    sql += ' AND r.employee_id = ?';
    params.push(employeeId);
  }
  if (locationId) {
    sql += ' AND (r.location_id = ? OR e.location_id = ?)';
    params.push(locationId, locationId);
  }
  if (startDate) {
    sql += ' AND r.timestamp >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND r.timestamp <= ?';
    params.push(endDate + ' 23:59:59');
  }

  sql += ' ORDER BY r.timestamp DESC LIMIT ?';
  params.push(limit);

  return queryAll(sql, params);
}

function getRecordsSummary({ employeeId, locationId, startDate, endDate }) {
  
  let empSql = `
    SELECT e.id as employee_id, e.name as employee_name, e.role, e.daily_rate, e.payment_method, e.pix_key_type, e.pix_key,
           l.name as location_name
    FROM employees e
    LEFT JOIN locations l ON l.id = e.location_id
    WHERE 1=1
  `;
  const empParams = [];
  if (employeeId) {
    empSql += ' AND e.id = ?';
    empParams.push(employeeId);
  }
  if (locationId) {
    empSql += ' AND e.location_id = ?';
    empParams.push(locationId);
  }
  empSql += ' ORDER BY e.name';

  const employees = queryAll(empSql, empParams);

  const summaryMap = {};
  for (const emp of employees) {
    summaryMap[emp.employee_id] = {
      employee_id: emp.employee_id,
      employee_name: emp.employee_name,
      role: emp.role || '—',
      daily_rate: emp.daily_rate || 0,
      payment_method: emp.payment_method || 'PIX',
      pix_key_type: emp.pix_key_type || '',
      pix_key: emp.pix_key || '',
      location_name: emp.location_name || '—',
      total_records: 0,
      total_minutes: 0,
      unique_dates: new Set(),
      pairs: []
    };
  }

  let recSql = `
    SELECT r.employee_id, r.type, r.timestamp
    FROM time_records r
    WHERE 1=1
  `;
  const recParams = [];
  if (employeeId) {
    recSql += ' AND r.employee_id = ?';
    recParams.push(employeeId);
  }
  if (startDate) {
    recSql += ' AND r.timestamp >= ?';
    recParams.push(startDate);
  }
  if (endDate) {
    recSql += ' AND r.timestamp <= ?';
    recParams.push(endDate + ' 23:59:59');
  }
  recSql += ' ORDER BY r.employee_id, r.timestamp';

  const records = queryAll(recSql, recParams);

  for (const r of records) {
    if (summaryMap[r.employee_id]) {
      const dateStr = r.timestamp.split(' ')[0];
      summaryMap[r.employee_id].unique_dates.add(dateStr);
      summaryMap[r.employee_id].total_records++;
      summaryMap[r.employee_id].pairs.push(r);
    }
  }

  for (const emp of Object.values(summaryMap)) {
    let totalMinutes = 0;
    for (let i = 0; i < emp.pairs.length - 1; i++) {
      if (emp.pairs[i].type === 'entrada' && emp.pairs[i + 1].type === 'saida') {
        const start = new Date(emp.pairs[i].timestamp);
        const end = new Date(emp.pairs[i + 1].timestamp);
        const diffMinutes = (end - start) / (1000 * 60);
        if (diffMinutes > 0 && diffMinutes <= 24 * 60) {
          totalMinutes += diffMinutes;
        }
        i++; 
      }
    }
    emp.total_minutes = Math.round(totalMinutes);
    const hoursDecimal = totalMinutes / 60;
    emp.total_hours = hoursDecimal.toFixed(1);
    emp.days_worked = emp.unique_dates.size;

    const dailyRate = emp.daily_rate || 0;
    const hourlyRate = dailyRate > 0 ? (dailyRate / 8) : 0;

    const totalEarnings = hourlyRate * hoursDecimal;

    emp.hourly_rate = hourlyRate.toFixed(2);
    emp.total_earnings = totalEarnings.toFixed(2);
    emp.total_earnings_formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEarnings);
    emp.daily_rate_formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dailyRate);

    delete emp.unique_dates;
    delete emp.pairs;
  }

  return Object.values(summaryMap);
}

function verifyAdminLogin(username, password) {
  const admin = queryOne('SELECT * FROM admins WHERE username = ?', [username]);
  if (!admin) return null;

  const { hash } = hashPassword(password, admin.salt);
  if (hash === admin.password_hash) {
    return { id: admin.id, username: admin.username };
  }
  return null;
}

function changeAdminPassword(username, currentPassword, newPassword) {
  const admin = verifyAdminLogin(username, currentPassword);
  if (!admin) {
    throw new Error('Senha atual incorreta');
  }
  const { hash, salt } = hashPassword(newPassword);
  runSql('UPDATE admins SET password_hash = ?, salt = ? WHERE username = ?', [hash, salt, username]);
  return true;
}

function closeDb() {
  if (db) {
    persist();
    db.close();
    db = null;
    dbReady = null;
  }
}

function createFinancialTransaction({ type, description, amount, category, date }) {
  runSql(
    `INSERT INTO financial_transactions (type, description, amount, category, date) VALUES (?, ?, ?, ?, ?)`,
    [type, description, parseFloat(amount), category || '', date]
  );
  persist();
  return queryOne(`SELECT * FROM financial_transactions WHERE id = last_insert_rowid()`);
}

function getFinancialTransactions({ startDate, endDate } = {}) {
  let sql = `SELECT * FROM financial_transactions WHERE 1=1`;
  const params = [];
  if (startDate) { sql += ` AND date >= ?`; params.push(startDate); }
  if (endDate)   { sql += ` AND date <= ?`; params.push(endDate); }
  sql += ` ORDER BY date DESC, created_at DESC`;
  return queryAll(sql, params);
}

function deleteFinancialTransaction(id) {
  runSql(`DELETE FROM financial_transactions WHERE id = ?`, [id]);
  persist();
}

function getFinancialSummary({ startDate, endDate } = {}) {
  const transactions = getFinancialTransactions({ startDate, endDate });
  const totalEntradas = transactions
    .filter(t => t.type === 'entrada')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalSaidas = transactions
    .filter(t => t.type === 'saida')
    .reduce((acc, t) => acc + t.amount, 0);
  return {
    totalEntradas,
    totalSaidas,
    saldo: totalEntradas - totalSaidas,
    transactions
  };
}

module.exports = {
  initDatabase,
  createLocation,
  getAllLocations,
  getLocationById,
  deleteLocation,
  createEmployee,
  updateEmployee,
  getAllEmployees,
  getEmployeeById,
  getAllDescriptors,
  deleteEmployee,
  createRecord,
  getLastRecordForEmployee,
  getRecords,
  getRecordsSummary,
  verifyAdminLogin,
  changeAdminPassword,
  createFinancialTransaction,
  getFinancialTransactions,
  deleteFinancialTransaction,
  getFinancialSummary,
  closeDb
};
