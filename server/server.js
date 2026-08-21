const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/locations', (req, res) => {
  try {
    const locations = db.getAllLocations();
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/locations', (req, res) => {
  try {
    const { name, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do local é obrigatório' });
    const location = db.createLocation({ name, address });
    res.status(201).json(location);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/locations/:id', (req, res) => {
  try {
    db.deleteLocation(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/employees', (req, res) => {
  try {
    const employees = db.getAllEmployees();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/employees/:id', (req, res) => {
  try {
    const employee = db.getEmployeeById(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Colaborador não encontrado' });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', (req, res) => {
  try {
    const { name, role, dailyRate, paymentMethod, pixKeyType, pixKey, locationId, faceDescriptors, photo } = req.body;
    if (!name || !faceDescriptors || !faceDescriptors.length) {
      return res.status(400).json({ error: 'Nome e descritores faciais são obrigatórios' });
    }
    const employee = db.createEmployee({
      name, role, dailyRate, paymentMethod, pixKeyType, pixKey, locationId, faceDescriptors, photo
    });
    res.status(201).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', (req, res) => {
  try {
    const { name, role, dailyRate, paymentMethod, pixKeyType, pixKey, locationId, photo } = req.body;
    const employee = db.updateEmployee(req.params.id, {
      name, role, dailyRate, paymentMethod, pixKeyType, pixKey, locationId, photo
    });
    res.json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', (req, res) => {
  try {
    const result = db.deleteEmployee(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Colaborador não encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/descriptors', (req, res) => {
  try {
    const descriptors = db.getAllDescriptors();
    res.json(descriptors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/records', (req, res) => {
  try {
    const { employeeId, locationId, timestamp, type } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'ID do colaborador é obrigatório' });

    const record = db.createRecord({ employeeId, locationId, timestamp, type });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/records', (req, res) => {
  try {
    const { employee_id, location_id, start_date, end_date, limit } = req.query;
    const records = db.getRecords({
      employeeId: employee_id,
      locationId: location_id,
      startDate: start_date,
      endDate: end_date,
      limit: limit ? parseInt(limit) : 100
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/records/summary', (req, res) => {
  try {
    const { employee_id, location_id, start_date, end_date } = req.query;
    const summary = db.getRecordsSummary({
      employeeId: employee_id,
      locationId: location_id,
      startDate: start_date,
      endDate: end_date
    });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const admin = db.verifyAdminLogin(username, password);
    if (!admin) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      admin: { username: admin.username }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/change-password', (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres' });
    }

    db.changeAdminPassword(username, currentPassword, newPassword);
    res.json({ success: true, message: 'Senha alterada com sucesso!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/financial/summary', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = db.getFinancialSummary({ startDate, endDate });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/financial/transactions', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const txs = db.getFinancialTransactions({ startDate, endDate });
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/financial/transactions', (req, res) => {
  try {
    const { type, description, amount, category, date } = req.body;
    if (!type || !description || !amount || !date) {
      return res.status(400).json({ error: 'Tipo, descrição, valor e data são obrigatórios' });
    }
    if (!['entrada', 'saida'].includes(type)) {
      return res.status(400).json({ error: 'Tipo deve ser "entrada" ou "saida"' });
    }
    const tx = db.createFinancialTransaction({ type, description, amount, category, date });
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/financial/transactions/:id', (req, res) => {
  try {
    db.deleteFinancialTransaction(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

(async () => {
  try {
    await db.initDatabase();
    console.log('✅ Banco de dados inicializado');

    const ip = getLocalIp();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Ponto Facial Server rodando:`);
      console.log(`   ➜ HTTP  (Computador): http://localhost:${PORT}`);
      console.log(`   ➜ HTTP  (Celulares):  http://${ip}:${PORT}`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Porta ${PORT} em uso. Servidor já está rodando.`);
      } else {
        console.error('❌ Erro no servidor:', err);
      }
    });

    const certPath = path.join(__dirname, 'certs', 'cert.pem');
    const keyPath = path.join(__dirname, 'certs', 'key.pem');
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      const https = require('https');
      const HTTPS_PORT = process.env.HTTPS_PORT || 3002;
      const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      https.createServer(options, app).listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`   🔒 HTTPS (iPhone / Câmera): https://${ip}:${HTTPS_PORT}\n`);
      }).on('error', () => {});
    }
  } catch (err) {
    console.error('❌ Erro ao inicializar:', err);
    process.exit(1);
  }
})();

process.on('SIGINT', () => {
  db.closeDb();
  process.exit(0);
});
