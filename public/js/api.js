
const API_BASE = window.location.origin + '/api';

const Api = {
  
  getOfflineQueue() {
    try {
      return JSON.parse(localStorage.getItem('ponto_offline_queue') || '[]');
    } catch (e) {
      return [];
    }
  },

  setOfflineQueue(queue) {
    localStorage.setItem('ponto_offline_queue', JSON.stringify(queue));
    this.notifyOfflineQueueChange();
  },

  notifyOfflineQueueChange() {
    const queue = this.getOfflineQueue();
    const event = new CustomEvent('offlineQueueUpdated', { detail: { count: queue.length, isOnline: navigator.onLine } });
    window.dispatchEvent(event);
  },

  async syncOfflineRecords() {
    if (!navigator.onLine) return;
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return;

    console.log(`[Offline Sync] Tentando enviar ${queue.length} registro(s) pendente(s)...`);
    const remaining = [];
    let syncedCount = 0;

    for (const record of queue) {
      try {
        const res = await fetch(`${API_BASE}/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: record.employeeId,
            locationId: record.locationId,
            timestamp: record.timestamp,
            type: record.type
          })
        });

        if (res.ok) {
          syncedCount++;
        } else {
          remaining.push(record);
        }
      } catch (err) {
        console.warn('[Offline Sync] Falha ao enviar registro:', err);
        remaining.push(record);
      }
    }

    this.setOfflineQueue(remaining);

    if (syncedCount > 0) {
      console.log(`[Offline Sync] ${syncedCount} registro(s) sincronizado(s) com sucesso!`);
      const event = new CustomEvent('offlineSyncComplete', { detail: { count: syncedCount } });
      window.dispatchEvent(event);
    }
  },

  async getLocations() {
    try {
      const res = await fetch(`${API_BASE}/locations`);
      if (!res.ok) throw new Error('Erro ao buscar locais de trabalho');
      const data = await res.json();
      localStorage.setItem('cached_locations', JSON.stringify(data));
      return data;
    } catch (err) {
      const cached = localStorage.getItem('cached_locations');
      if (cached) return JSON.parse(cached);
      throw err;
    }
  },

  async createLocation(name, address) {
    const res = await fetch(`${API_BASE}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao criar local');
    }
    return res.json();
  },

  async deleteLocation(id) {
    const res = await fetch(`${API_BASE}/locations/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao remover local de trabalho');
    }
    return res.json();
  },

  async getEmployees() {
    try {
      const res = await fetch(`${API_BASE}/employees`);
      if (!res.ok) throw new Error('Erro ao buscar colaboradores');
      const data = await res.json();
      localStorage.setItem('cached_employees', JSON.stringify(data));
      return data;
    } catch (err) {
      const cached = localStorage.getItem('cached_employees');
      if (cached) return JSON.parse(cached);
      throw err;
    }
  },

  async getEmployee(id) {
    try {
      const res = await fetch(`${API_BASE}/employees/${id}`);
      if (!res.ok) throw new Error('Colaborador não encontrado');
      return res.json();
    } catch (err) {
      const cached = localStorage.getItem('cached_employees');
      if (cached) {
        const list = JSON.parse(cached);
        const emp = list.find(e => String(e.id) === String(id));
        if (emp) return emp;
      }
      throw err;
    }
  },

  async createEmployee(data) {
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Erro ao cadastrar');
    }
    return res.json();
  },

  async updateEmployee(id, data) {
    const res = await fetch(`${API_BASE}/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Erro ao atualizar colaborador');
    }
    return res.json();
  },

  async deleteEmployee(id) {
    const res = await fetch(`${API_BASE}/employees/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao remover colaborador');
    }
    return res.json();
  },

  async getDescriptors() {
    try {
      const res = await fetch(`${API_BASE}/descriptors`);
      if (!res.ok) throw new Error('Erro ao buscar descritores');
      const data = await res.json();
      localStorage.setItem('cached_descriptors', JSON.stringify(data));
      return data;
    } catch (err) {
      console.warn('[Offline Mode] Servidor offline. Usando descritores faciais em cache local...');
      const cached = localStorage.getItem('cached_descriptors');
      if (cached) return JSON.parse(cached);
      throw new Error('Sem conexão com o servidor e nenhum descritor salvo em cache local.');
    }
  },

  async createRecord(employeeId, locationId) {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const localTimestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    try {
      const res = await fetch(`${API_BASE}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, locationId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao registrar ponto');
      }
      const record = await res.json();
      
      this.syncOfflineRecords();
      return record;
    } catch (err) {
      console.warn('[Offline Mode] Falha na requisição. Registrando ponto offline no navegador...', err);

      const queue = this.getOfflineQueue();
      const empOfflineRecords = queue.filter(r => String(r.employeeId) === String(employeeId));
      const lastOffline = empOfflineRecords.length > 0 ? empOfflineRecords[empOfflineRecords.length - 1] : null;
      
      let type = 'entrada';
      if (lastOffline) {
        type = lastOffline.type === 'entrada' ? 'saida' : 'entrada';
      }

      const offlineRecord = {
        id: 'offline_' + Date.now(),
        employeeId,
        locationId,
        type,
        timestamp: localTimestamp,
        isOffline: true
      };

      queue.push(offlineRecord);
      this.setOfflineQueue(queue);

      return offlineRecord;
    }
  },

  async getRecords({ employeeId, locationId, startDate, endDate, limit } = {}) {
    try {
      const params = new URLSearchParams();
      if (employeeId) params.set('employee_id', employeeId);
      if (locationId) params.set('location_id', locationId);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (limit) params.set('limit', limit);

      const res = await fetch(`${API_BASE}/records?${params}`);
      if (!res.ok) throw new Error('Erro ao buscar registros');
      return res.json();
    } catch (err) {
      const queue = this.getOfflineQueue();
      let records = queue.map(r => ({
        id: r.id,
        employee_id: r.employeeId,
        employee_name: 'Pendente Sync (Offline)',
        type: r.type,
        timestamp: r.timestamp,
        isOffline: true
      }));

      if (employeeId) records = records.filter(r => String(r.employee_id) === String(employeeId));
      return records;
    }
  },

  async getRecordsSummary({ employeeId, locationId, startDate, endDate } = {}) {
    try {
      const params = new URLSearchParams();
      if (employeeId) params.set('employee_id', employeeId);
      if (locationId) params.set('location_id', locationId);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await fetch(`${API_BASE}/records/summary?${params}`);
      if (!res.ok) throw new Error('Erro ao buscar resumo');
      return res.json();
    } catch (err) {
      return [];
    }
  },

  async adminLogin(username, password) {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao realizar login');
    }
    return data;
  },

  async changeAdminPassword(username, currentPassword, newPassword) {
    const res = await fetch(`${API_BASE}/admin/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao alterar senha');
    }
    return data;
  },

  async getFinancialSummary({ startDate, endDate } = {}) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate)   params.set('endDate', endDate);
    const res = await fetch(`${API_BASE}/financial/summary?${params}`);
    if (!res.ok) throw new Error('Erro ao buscar resumo financeiro');
    return res.json();
  },

  async createFinancialTransaction(data) {
    const res = await fetch(`${API_BASE}/financial/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erro ao criar lançamento');
    return result;
  },

  async deleteFinancialTransaction(id) {
    const res = await fetch(`${API_BASE}/financial/transactions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao remover lançamento');
    }
    return res.json();
  }
};
