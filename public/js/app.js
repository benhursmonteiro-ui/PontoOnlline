/* ═══════════════════════════════════════
   App — Main Application Logic
   ═══════════════════════════════════════ */

(async function () {
  'use strict';

  // ── DOM References ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const loadingOverlay = $('#loading-overlay');
  const loaderText = $('.loader-text');
  const headerClock = $('#header-clock');

  // Clock section
  const clockVideo = $('#clock-video');
  const clockCanvas = $('#clock-canvas');
  const clockStatus = $('#clock-status');
  const recognizedName = $('#recognized-name');
  const nextRecordType = $('#next-record-type');
  const lastRecordInfo = $('#last-record-info');
  const recognitionCard = $('#recognition-card');
  const btnManualClock = $('#btn-manual-clock');
  const clockToast = $('#clock-toast');
  const toastTitle = $('#toast-title');
  const toastMessage = $('#toast-message');

  // Register section
  const registerVideo = $('#register-video');
  const registerCanvas = $('#register-canvas');
  const regName = $('#reg-name');
  const regRole = $('#reg-role');
  const regDailyRate = $('#reg-daily-rate');
  const regPaymentMethod = $('#reg-payment-method');
  const regPixKeyType = $('#reg-pix-key-type');
  const regPixKey = $('#reg-pix-key');
  const regLocation = $('#reg-location');
  const btnCapture = $('#btn-capture');
  const btnRegister = $('#btn-register');
  const captureText = $('#capture-text');
  const employeesContainer = $('#employees-container');

  // Locations section
  const formAddLocation = $('#form-add-location');
  const locName = $('#loc-name');
  const locAddress = $('#loc-address');
  const locationsContainer = $('#locations-container');

  // Records section
  const filterEmployee = $('#filter-employee');
  const filterLocation = $('#filter-location');
  const filterStart = $('#filter-start');
  const filterEnd = $('#filter-end');
  const btnFilter = $('#btn-filter');
  const btnExportPDF = $('#btn-export-pdf');
  const btnTriggerPaymentModal = $('#btn-trigger-payment-modal');
  const btnNavPaymentDay = $('#btn-nav-payment-day');
  const summaryCards = $('#summary-cards');
  const recordsTbody = $('#records-tbody');

  // Payment Day Modal references
  const modalPaymentDay = $('#modal-payment-day');
  const btnClosePayModal = $('#btn-close-pay-modal');
  const btnClosePayModalFoot = $('#btn-close-pay-modal-foot');
  const payPeriodType = $('#pay-period-type');
  const payStartDate = $('#pay-start-date');
  const payEndDate = $('#pay-end-date');
  const btnRecalculatePay = $('#btn-recalculate-pay');
  const payTotalEmployees = $('#pay-total-employees');
  const payTotalDays = $('#pay-total-days');
  const payTotalAmount = $('#pay-total-amount');
  const payTbody = $('#pay-tbody');
  const btnExportPayrollPDF = $('#btn-export-payroll-pdf');

  // Admin Controls & Modals
  const btnAdminLoginTrigger = $('#btn-admin-login-trigger');
  const adminUserBadge = $('#admin-user-badge');
  const btnChangePassTrigger = $('#btn-change-pass-trigger');
  const btnAdminLogout = $('#btn-admin-logout');

  const modalAdminLogin = $('#modal-admin-login');
  const btnCloseLoginModal = $('#btn-close-login-modal');
  const btnCancelLogin = $('#btn-cancel-login');
  const formAdminLogin = $('#form-admin-login');
  const adminUsername = $('#admin-username');
  const adminPassword = $('#admin-password');
  const loginError = $('#login-error');

  const modalChangePassword = $('#modal-change-password');
  const btnClosePassModal = $('#btn-close-pass-modal');
  const btnCancelPass = $('#btn-cancel-pass');
  const formChangePassword = $('#form-change-password');
  const passCurrent = $('#pass-current');
  const passNew = $('#pass-new');
  const passConfirm = $('#pass-confirm');
  const passError = $('#pass-error');
  const passSuccess = $('#pass-success');

  // Modal Edit Employee
  const modalEditEmployee = $('#modal-edit-employee');
  const btnCloseEditModal = $('#btn-close-edit-modal');
  const btnCancelEdit = $('#btn-cancel-edit');
  const formEditEmployee = $('#form-edit-employee');
  const editEmpId = $('#edit-emp-id');
  const editEmpName = $('#edit-emp-name');
  const editEmpRole = $('#edit-emp-role');
  const editEmpDailyRate = $('#edit-emp-daily-rate');
  const editEmpLocation = $('#edit-emp-location');
  const editEmpPaymentMethod = $('#edit-emp-payment-method');
  const editEmpPixKeyType = $('#edit-emp-pix-key-type');
  const editEmpPixKey = $('#edit-emp-pix-key');
  const editEmpError = $('#edit-emp-error');

  // ── State ──
  let currentSection = 'clock';
  let capturedDescriptors = [];
  let capturedPhoto = null;
  let detectionLoop = null;
  let faceMatcher = null;
  let currentMatchedEmployee = null;
  let isRegistering = false;
  let lastRegisteredTime = 0;
  let lastRegisteredEmpId = null;
  let noFaceCount = 0;
  let successFeedbackTimeout = null;
  let currentAdminUser = sessionStorage.getItem('adminUser') || null;
  let targetSectionAfterLogin = null;
  let cachedEmployees = [];
  let cachedLocations = [];

  // ── Header Clock ──
  function updateClock() {
    const now = new Date();
    headerClock.textContent = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ── Admin Authorization & UI ──
  function isAdminLoggedIn() {
    return !!currentAdminUser;
  }

  function updateAdminUI() {
    const loggedIn = isAdminLoggedIn();

    if (loggedIn) {
      $$('.admin-only').forEach(el => el.classList.remove('hidden'));
      btnAdminLoginTrigger.classList.add('hidden');
      adminUserBadge.classList.remove('hidden');
    } else {
      $$('.admin-only').forEach(el => el.classList.add('hidden'));
      btnAdminLoginTrigger.classList.remove('hidden');
      adminUserBadge.classList.add('hidden');

      if (currentSection !== 'clock') {
        switchSection('clock');
      }
    }
  }

  // ── Navigation ──
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (!section) return;
      switchSection(section);
    });
  });

  function switchSection(section) {
    if (!section) return;

    // Update nav
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    const targetNav = $(`[data-section="${section}"]`);
    if (targetNav) targetNav.classList.add('active');

    // Update sections
    $$('.section').forEach(s => s.classList.remove('active'));
    const targetSec = $(`#section-${section}`);
    if (targetSec) targetSec.classList.add('active');

    // Stop previous camera/loops
    if (currentSection === 'clock' && section !== 'clock') {
      if (detectionLoop) detectionLoop.stop();
      FaceRecognition.stopCamera(clockVideo);
    }
    if (currentSection === 'register' && section !== 'register') {
      FaceRecognition.stopCamera(registerVideo);
    }

    currentSection = section;

    // Initialize section
    if (section === 'clock') initClockSection();
    if (section === 'register') initRegisterSection();
    if (section === 'locations') initLocationsSection();
    if (section === 'records') initRecordsSection();
    if (section === 'dashboard') initDashboardSection();
    if (section === 'financeiro') initFinanceiroSection();
    if (section === 'pagamento') initPagamentoSection();
  }

  window.switchSection = switchSection;

  // ═══════════════════════════════════
  // CLOCK SECTION
  // ═══════════════════════════════════

  async function initClockSection() {
    clockStatus.className = 'camera-status';
    clockStatus.querySelector('span').textContent = 'Solicitando acesso à câmera...';

    // Start camera
    const started = await FaceRecognition.startCamera(clockVideo);
    if (!started) {
      clockStatus.className = 'camera-status error';
      clockStatus.querySelector('span').textContent = 'Erro: Câmera não permitida ou indisponível. Verifique as permissões do navegador.';
      return;
    }

    clockStatus.className = 'camera-status active';
    clockStatus.querySelector('span').textContent = 'Câmera Ativa — Carregando IA...';

    // Load models
    try {
      await FaceRecognition.loadModels((msg) => {
        if (clockStatus) clockStatus.querySelector('span').textContent = msg;
      });
      if (clockStatus) clockStatus.querySelector('span').textContent = 'Câmera Ativa — Escaneando...';
    } catch (e) {
      console.warn('Erro ao carregar IA:', e);
    }

    // Load face descriptors and create matcher
    try {
      const descriptors = await Api.getDescriptors();
      if (descriptors.length > 0) {
        faceMatcher = FaceRecognition.createMatcher(descriptors, 0.5);
      } else {
        faceMatcher = null;
        recognizedName.textContent = 'Nenhum colaborador cadastrado';
      }
    } catch (err) {
      console.error('Error loading descriptors:', err);
    }

    // Start detection loop
    if (detectionLoop) detectionLoop.stop();
    detectionLoop = FaceRecognition.startDetectionLoop(
      clockVideo,
      clockCanvas,
      faceMatcher,
      onFaceMatched,
      onNoFace
    );
  }

  async function fetchEmployeeTodayStatus(employeeId) {
    try {
      const todayStr = formatDate(new Date());
      const records = await Api.getRecords({ employeeId, startDate: todayStr, limit: 1 });
      if (records && records.length > 0) {
        const last = records[0];
        nextRecordType.textContent = last.type === 'entrada' ? 'Saída' : 'Entrada';
        lastRecordInfo.innerHTML = `${last.type === 'entrada' ? '↗ Entrada' : '↙ Saída'} às ${formatTime(last.timestamp)}`;
      } else {
        nextRecordType.textContent = 'Entrada';
        lastRecordInfo.textContent = 'Nenhum registro hoje';
      }
    } catch (err) {
      console.warn('Could not fetch employee status:', err);
    }
  }

  async function onFaceMatched(match) {
    noFaceCount = 0;

    const isNewMatch = !currentMatchedEmployee || currentMatchedEmployee.employeeId !== match.employeeId;
    currentMatchedEmployee = match;

    recognitionCard.classList.add('recognized');
    recognizedName.textContent = match.name;

    if (isNewMatch) {
      fetchEmployeeTodayStatus(match.employeeId);
    }

    const now = Date.now();
    const canRegister = !isRegistering && (now - lastRegisteredTime > 5000 || lastRegisteredEmpId !== match.employeeId);

    if (canRegister) {
      registerTimeClock(match.employeeId, match.name);
    } else if (!isRegistering) {
      if (lastRegisteredEmpId === match.employeeId && (now - lastRegisteredTime <= 5000)) {
        btnManualClock.disabled = true;
        btnManualClock.classList.add('btn-success');
        btnManualClock.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>✔ PONTO REGISTRADO COM SUCESSO!</span>
        `;
      } else {
        btnManualClock.disabled = false;
      }
    }
  }

  function onNoFace() {
    noFaceCount++;
    if (noFaceCount >= 3) {
      if (!isRegistering) {
        const now = Date.now();
        if (now - lastRegisteredTime > 4000) {
          currentMatchedEmployee = null;
          recognitionCard.classList.remove('recognized');
          recognizedName.textContent = 'Aguardando...';
          resetClockButton();
          nextRecordType.textContent = '—';
          lastRecordInfo.textContent = 'Nenhum registro hoje';
        }
      }
    }
  }

  function resetClockButton() {
    btnManualClock.classList.remove('btn-success');
    if (currentMatchedEmployee) {
      btnManualClock.disabled = false;
      btnManualClock.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Registrar Ponto</span>
      `;
    } else {
      btnManualClock.disabled = true;
      btnManualClock.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Registrar Ponto</span>
      `;
    }
  }

  async function registerTimeClock(employeeId, employeeName) {
    if (isRegistering) return;
    isRegistering = true;

    btnManualClock.disabled = true;
    btnManualClock.classList.remove('btn-success');
    btnManualClock.innerHTML = `
      <div class="loader-ring" style="width:16px;height:16px;border-width:2px;margin:0 6px 0 0;display:inline-block;vertical-align:middle;"></div>
      <span>Registrando...</span>
    `;

    try {
      const record = await Api.createRecord(employeeId);
      lastRegisteredTime = Date.now();
      lastRegisteredEmpId = employeeId;

      nextRecordType.textContent = record.type === 'entrada' ? 'Saída' : 'Entrada';
      lastRecordInfo.innerHTML = `<span style="color: var(--success); font-weight: 700;">${record.type === 'entrada' ? '↗ Entrada' : '↙ Saída'} às ${formatTime(record.timestamp)} ${record.isOffline ? '(Offline)' : ''}</span>`;

      btnManualClock.disabled = true;
      btnManualClock.classList.add('btn-success');
      btnManualClock.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${record.isOffline ? '✔ PONTO SALVO OFFLINE!' : '✔ PONTO REGISTRADO COM SUCESSO!'}</span>
      `;

      if (record.isOffline) {
        showToast(
          record.type === 'entrada' ? 'Entrada Registrada (OFFLINE)' : 'Saída Registrada (OFFLINE)',
          `${employeeName} — Salvo no aparelho. Será enviado à nuvem quando a internet voltar!`,
          record.type
        );
      } else {
        showToast(
          record.type === 'entrada' ? 'Entrada Registrada!' : 'Saída Registrada!',
          `${employeeName} — ${formatTime(record.timestamp)}`,
          record.type
        );
      }

      if (successFeedbackTimeout) clearTimeout(successFeedbackTimeout);
      successFeedbackTimeout = setTimeout(() => {
        isRegistering = false;
        resetClockButton();
      }, 5000);

    } catch (err) {
      console.error('Error registering:', err);
      showToast('Erro ao Registrar', err.message || 'Tente novamente', 'saida');
      isRegistering = false;
      resetClockButton();
    }
  }

  // ── Network Status & Offline Sync Listeners ──
  window.addEventListener('online', () => {
    console.log('[Offline Sync] Conexão restabelecida! Sincronizando dados com o servidor...');
    Api.syncOfflineRecords();
  });

  window.addEventListener('offlineSyncComplete', (e) => {
    showToast(
      'Sincronização Concluída!',
      `${e.detail.count} registro(s) de ponto enviado(s) para a nuvem com sucesso.`,
      'entrada'
    );
  });

  // Auto-sync pending records on load
  setTimeout(() => Api.syncOfflineRecords(), 3000);

  btnManualClock.addEventListener('click', () => {
    if (currentMatchedEmployee && !isRegistering) {
      registerTimeClock(currentMatchedEmployee.employeeId, currentMatchedEmployee.name);
    }
  });

  function showToast(title, message, type) {
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    clockToast.className = `toast show ${type === 'saida' ? 'toast-saida' : ''}`;
    setTimeout(() => clockToast.classList.remove('show'), 4000);
  }

  // ═══════════════════════════════════
  // LOCATIONS SECTION
  // ═══════════════════════════════════

  async function initLocationsSection() {
    loadLocations();
  }

  async function loadLocations() {
    try {
      cachedLocations = await Api.getLocations();

      // Render Locations List
      if (cachedLocations.length === 0) {
        locationsContainer.innerHTML = '<p class="empty-state">Nenhum local cadastrado</p>';
      } else {
        locationsContainer.innerHTML = cachedLocations.map(loc => `
          <div class="employee-item animate-slide-up">
            <div class="employee-info">
              <div>
                <div class="employee-name">${loc.name}</div>
                <div class="employee-role">${loc.address || 'Sem endereço'} • <strong>${loc.employee_count || 0} colaboradores</strong></div>
              </div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteLocation(${loc.id})" title="Remover Local">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `).join('');
      }

      // Update location dropdowns
      updateLocationDropdowns(cachedLocations);
    } catch (err) {
      console.error('Error loading locations:', err);
    }
  }

  function updateLocationDropdowns(locations) {
    if (!locations || !Array.isArray(locations)) return;
    cachedLocations = locations;

    const curReg = regLocation ? regLocation.value : '';
    const curFilter = filterLocation ? filterLocation.value : '';
    const curEdit = editEmpLocation ? editEmpLocation.value : '';

    const optionsHtml = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');

    if (regLocation) {
      regLocation.innerHTML = '<option value="">Selecione um local...</option>' + optionsHtml;
      if (curReg) regLocation.value = curReg;
    }

    if (filterLocation) {
      filterLocation.innerHTML = '<option value="">Todos os Locais</option>' + optionsHtml;
      if (curFilter) filterLocation.value = curFilter;
    }

    if (editEmpLocation) {
      editEmpLocation.innerHTML = '<option value="">Selecione um local...</option>' + optionsHtml;
      if (curEdit) editEmpLocation.value = curEdit;
    }
  }

  formAddLocation.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = locName.value.trim();
    const address = locAddress.value.trim();

    if (!name) return;

    try {
      await Api.createLocation(name, address);
      locName.value = '';
      locAddress.value = '';
      loadLocations();
    } catch (err) {
      alert('Erro ao criar local: ' + err.message);
    }
  });

  window.deleteLocation = async function (id) {
    if (!confirm('Deseja remover este local de trabalho? Os colaboradores vinculados ficarão sem local definido.')) return;
    try {
      await Api.deleteLocation(id);
      loadLocations();
    } catch (err) {
      alert('Erro ao remover local: ' + err.message);
    }
  };

  // ═══════════════════════════════════
  // REGISTER SECTION
  // ═══════════════════════════════════

  async function initRegisterSection() {
    resetCaptureState();
    loadLocations();
    loadEmployeesList();

    captureText.textContent = 'Iniciando câmera...';
    const cameraOk = await FaceRecognition.startCamera(registerVideo);
    if (!cameraOk) {
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        captureText.textContent = '❌ Câmera bloqueada em HTTP remoto pelo navegador. Acesse a aplicação via HTTPS.';
      } else {
        captureText.textContent = '❌ Câmera não permitida ou indisponível. Verifique as permissões do navegador.';
      }
      btnCapture.disabled = true;
      return;
    }

    captureText.textContent = 'Carregando inteligência artificial...';
    try {
      await FaceRecognition.loadModels((msg) => {
        if (captureText) captureText.textContent = msg;
      });
      captureText.textContent = 'Clique para capturar 3 amostras';
      btnCapture.disabled = false;
    } catch (err) {
      console.error('Erro ao carregar IA:', err);
      captureText.textContent = '❌ Erro ao carregar modelos de IA para reconhecimento.';
      btnCapture.disabled = true;
    }
  }

  function resetCaptureState() {
    capturedDescriptors = [];
    capturedPhoto = null;
    [1, 2, 3].forEach(i => {
      const dot = $(`#dot-${i}`);
      if (dot) dot.classList.remove('captured');
    });
    if (registerCanvas) {
      const ctx = registerCanvas.getContext('2d');
      ctx.clearRect(0, 0, registerCanvas.width, registerCanvas.height);
    }
    captureText.textContent = 'Clique para capturar 3 amostras';
    btnCapture.disabled = false;
    btnRegister.disabled = true;
  }

  btnCapture.addEventListener('click', async () => {
    if (capturedDescriptors.length >= 3) return;

    btnCapture.disabled = true;
    captureText.textContent = 'Detectando face...';

    try {
      const result = await FaceRecognition.captureFaceDescriptor(registerVideo);

      if (!result) {
        captureText.textContent = '❌ Nenhuma face detectada. Olhe para a câmera e tente novamente.';
        btnCapture.disabled = false;
        return;
      }

      // Draw bounding box feedback
      if (registerCanvas && result.box) {
        FaceRecognition.drawBox(registerVideo, registerCanvas, result.box, `Amostra ${capturedDescriptors.length + 1}/3`);
      }

      capturedDescriptors.push(result.descriptor);
      const idx = capturedDescriptors.length;
      const dot = $(`#dot-${idx}`);
      if (dot) dot.classList.add('captured');

      // Capture photo on first sample
      if (idx === 1) {
        capturedPhoto = FaceRecognition.capturePhoto(registerVideo);
      }

      if (idx < 3) {
        captureText.textContent = `✓ Amostra ${idx}/3 capturada! Mova levemente a cabeça e clique para a próxima.`;
        btnCapture.disabled = false;
      } else {
        captureText.textContent = '✓ 3 amostras capturadas! Preencha o nome e clique em Cadastrar.';
        btnRegister.disabled = false;
      }
    } catch (err) {
      console.error('Erro na captura:', err);
      captureText.textContent = `❌ Erro ao capturar: ${err.message || 'Câmera ou IA indisponível'}`;
      btnCapture.disabled = false;
    }
  });

  btnRegister.addEventListener('click', async () => {
    const name = regName.value.trim();
    const role = regRole.value.trim();
    const dailyRate = parseFloat(regDailyRate.value) || 0;
    const paymentMethod = regPaymentMethod.value;
    const pixKeyType = regPixKeyType.value;
    const pixKey = regPixKey.value.trim();
    const locationId = regLocation.value ? parseInt(regLocation.value) : null;

    if (!name) {
      regName.focus();
      regName.style.borderColor = 'var(--danger)';
      setTimeout(() => regName.style.borderColor = '', 2000);
      return;
    }

    if (capturedDescriptors.length < 3) return;

    btnRegister.disabled = true;
    btnRegister.textContent = 'Cadastrando...';

    try {
      await Api.createEmployee({
        name,
        role,
        dailyRate,
        paymentMethod,
        pixKeyType,
        pixKey,
        locationId,
        faceDescriptors: capturedDescriptors,
        photo: capturedPhoto
      });

      // Reset form
      regName.value = '';
      regRole.value = '';
      regDailyRate.value = '';
      regPixKey.value = '';
      regLocation.value = '';
      resetCaptureState();

      captureText.textContent = '✓ Colaborador cadastrado com sucesso!';
      captureText.style.color = 'var(--success)';
      setTimeout(() => captureText.style.color = '', 3000);

      loadEmployeesList();
    } catch (err) {
      captureText.textContent = `❌ Erro: ${err.message}`;
      btnRegister.disabled = false;
    }

    btnRegister.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
      Cadastrar
    `;
  });

  async function loadEmployeesList() {
    try {
      cachedEmployees = await Api.getEmployees();

      if (cachedEmployees.length === 0) {
        employeesContainer.innerHTML = '<p class="empty-state">Nenhum colaborador cadastrado</p>';
        return;
      }

      employeesContainer.innerHTML = cachedEmployees.map(emp => `
        <div class="employee-item animate-slide-up">
          <div class="employee-info">
            <div class="employee-avatar">
              ${emp.photo
                ? `<img src="${emp.photo}" alt="${emp.name}">`
                : getInitials(emp.name)
              }
            </div>
            <div>
              <div class="employee-name">
                <a href="javascript:void(0)" onclick="openEmployeeTimesheet(${emp.id})" class="clickable-emp-name" title="Abrir Folha de Ponto de ${emp.name.replace(/'/g, "\\'")} no período de pagamento">
                  ${emp.name} ↗
                </a>
              </div>
              <div class="employee-role">${emp.role || '—'}</div>
              <div class="employee-meta">
                ${emp.location_name ? `<span class="badge badge-location">📍 ${emp.location_name}</span>` : ''}
                ${emp.daily_rate > 0 ? `<span class="employee-daily">Diária: R$ ${emp.daily_rate.toFixed(2)}</span>` : ''}
                ${emp.pix_key ? `<span class="badge badge-pix">PIX (${emp.pix_key_type}): ${emp.pix_key}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="employee-actions">
            <button class="btn btn-secondary btn-sm" onclick="openEmployeeTimesheet(${emp.id})" title="Ver Folha de Ponto">
              📋 Folha
            </button>
            <button class="btn btn-secondary btn-sm" onclick="editEmployee(${emp.id})" title="Editar / Mudar Local">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteEmployee(${emp.id})" title="Remover">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `).join('');

      updateEmployeeFilter(cachedEmployees);
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  }

  // Global Edit Function
  window.editEmployee = async function (id) {
    const emp = cachedEmployees.find(e => String(e.id) === String(id));
    if (!emp) return;

    if (!cachedLocations || cachedLocations.length === 0) {
      try {
        cachedLocations = await Api.getLocations();
      } catch (err) {}
    }
    updateLocationDropdowns(cachedLocations);

    editEmpId.value = emp.id;
    editEmpName.value = emp.name;
    editEmpRole.value = emp.role || '';
    editEmpDailyRate.value = emp.daily_rate || '';
    editEmpPaymentMethod.value = emp.payment_method || 'PIX';
    editEmpPixKeyType.value = emp.pix_key_type || 'CPF';
    editEmpPixKey.value = emp.pix_key || '';
    editEmpLocation.value = emp.location_id ? String(emp.location_id) : '';

    editEmpError.classList.add('hidden');
    modalEditEmployee.classList.remove('hidden');
  };

  btnCloseEditModal.addEventListener('click', () => modalEditEmployee.classList.add('hidden'));
  btnCancelEdit.addEventListener('click', () => modalEditEmployee.classList.add('hidden'));

  formEditEmployee.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editEmpId.value;
    const name = editEmpName.value.trim();
    const role = editEmpRole.value.trim();
    const dailyRate = parseFloat(editEmpDailyRate.value) || 0;
    const locationId = editEmpLocation.value ? parseInt(editEmpLocation.value) : null;
    const paymentMethod = editEmpPaymentMethod.value;
    const pixKeyType = editEmpPixKeyType.value;
    const pixKey = editEmpPixKey.value.trim();

    if (!name) return;

    editEmpError.classList.add('hidden');

    try {
      await Api.updateEmployee(id, {
        name,
        role,
        dailyRate,
        locationId,
        paymentMethod,
        pixKeyType,
        pixKey
      });

      modalEditEmployee.classList.add('hidden');
      loadEmployeesList();
      loadLocations();
    } catch (err) {
      editEmpError.textContent = err.message;
      editEmpError.classList.remove('hidden');
    }
  });

  // Global delete function
  window.deleteEmployee = async function (id) {
    if (!confirm('Tem certeza que deseja remover este colaborador?')) return;
    try {
      await Api.deleteEmployee(id);
      loadEmployeesList();
    } catch (err) {
      alert('Erro ao remover: ' + err.message);
    }
  };

  // ═══════════════════════════════════
  // RECORDS & TIMESHEET SECTION
  // ═══════════════════════════════════

  window.openEmployeeTimesheet = async function (employeeId, startDate, endDate) {
    if (!employeeId) return;

    switchSection('records');

    if (!filterEmployee || filterEmployee.options.length <= 1) {
      try {
        const employees = await Api.getEmployees();
        updateEmployeeFilter(employees);
      } catch (err) {}
    }

    if (filterEmployee) {
      filterEmployee.value = String(employeeId);
    }

    const sDate = startDate || (payStartDate && payStartDate.value) || (filterStart && filterStart.value);
    const eDate = endDate || (payEndDate && payEndDate.value) || (filterEnd && filterEnd.value);

    if (sDate && filterStart) filterStart.value = sDate;
    if (eDate && filterEnd) filterEnd.value = eDate;

    await loadRecords();

    const secRecords = $('#section-records');
    if (secRecords) {
      secRecords.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  async function initRecordsSection() {
    if (payStartDate && payStartDate.value && payEndDate && payEndDate.value) {
      if (filterStart) filterStart.value = payStartDate.value;
      if (filterEnd) filterEnd.value = payEndDate.value;
    } else if (!filterStart.value || !filterEnd.value) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      filterStart.value = formatDate(firstDay);
      filterEnd.value = formatDate(now);
    }

    try {
      const [employees, locations] = await Promise.all([
        Api.getEmployees(),
        Api.getLocations()
      ]);
      updateEmployeeFilter(employees);
      updateLocationDropdowns(locations);
    } catch (err) {
      console.error(err);
    }

    loadRecords();
  }

  function updateEmployeeFilter(employees) {
    const current = filterEmployee.value;
    filterEmployee.innerHTML = '<option value="">Todos os Colaboradores</option>';
    employees.forEach(emp => {
      filterEmployee.innerHTML += `<option value="${emp.id}">${emp.name}</option>`;
    });
    filterEmployee.value = current;
  }

  btnFilter.addEventListener('click', loadRecords);
  btnExportPDF.addEventListener('click', exportTimesheetPDF);

  async function loadRecords() {
    const params = {
      employeeId: filterEmployee.value || undefined,
      locationId: filterLocation.value || undefined,
      startDate: filterStart.value || undefined,
      endDate: filterEnd.value || undefined
    };

    try {
      const [records, summary] = await Promise.all([
        Api.getRecords(params),
        Api.getRecordsSummary(params)
      ]);

      renderSummaryCards(summary);
      renderRecordsTable(records);
    } catch (err) {
      console.error('Error loading records:', err);
    }
  }

  function renderSummaryCards(summary) {
    if (summary.length === 0) {
      summaryCards.innerHTML = '';
      return;
    }

    summaryCards.innerHTML = summary.map(s => `
      <div class="summary-card animate-scale-in" style="cursor: pointer;" onclick="openEmployeeTimesheet(${s.employee_id})" title="Clique para filtrar a folha de ponto de ${s.employee_name.replace(/'/g, "\\'")}">
        <div class="summary-card-name">
          <a href="javascript:void(0)" onclick="event.stopPropagation(); openEmployeeTimesheet(${s.employee_id})" class="clickable-emp-name">
            ${s.employee_name} ↗
          </a>
          <span class="badge badge-location">${s.location_name || '—'}</span>
        </div>
        <div class="summary-card-stats">
          <div class="summary-stat">
            <span class="summary-stat-value">${s.total_hours}h</span>
            <span class="summary-stat-label">Horas</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-value">${s.daily_rate_formatted}</span>
            <span class="summary-stat-label">Diária</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-value currency">${s.total_earnings_formatted}</span>
            <span class="summary-stat-label">A Receber</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderRecordsTable(records) {
    if (records.length === 0) {
      recordsTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum registro encontrado</td></tr>';
      return;
    }

    recordsTbody.innerHTML = records.map(r => {
      const dt = new Date(r.timestamp);
      return `
        <tr>
          <td>
            <a href="javascript:void(0)" onclick="openEmployeeTimesheet(${r.employee_id})" class="clickable-emp-name" title="Abrir folha de ponto de ${r.employee_name.replace(/'/g, "\\'")}">
              <strong>${r.employee_name}</strong> ↗
            </a>
          </td>
          <td><span class="badge badge-location">${r.location_name || 'Sede'}</span></td>
          <td><span class="badge badge-${r.type}">${r.type === 'entrada' ? '↗ Entrada' : '↙ Saída'}</span></td>
          <td>${dt.toLocaleDateString('pt-BR')}</td>
          <td>${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
        </tr>
      `;
    }).join('');
  }

  // ═══════════════════════════════════
  // EXPORT TIMESHEET PDF
  // ═══════════════════════════════════

  async function exportTimesheetPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('A biblioteca de geração de PDF não pôde ser carregada. Verifique sua conexão.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const empId = filterEmployee.value || undefined;
    const locId = filterLocation.value || undefined;
    const startDate = filterStart.value || undefined;
    const endDate = filterEnd.value || undefined;

    try {
      const [records, summary] = await Promise.all([
        Api.getRecords({ employeeId: empId, locationId: locId, startDate, endDate, limit: 1000 }),
        Api.getRecordsSummary({ employeeId: empId, locationId: locId, startDate, endDate })
      ]);

      if (records.length === 0) {
        alert('Nenhum registro encontrado para exportar a folha de ponto.');
        return;
      }

      // Title Header
      doc.setFillColor(10, 10, 15);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('PONTO FACIAL — FOLHA DE PONTO', 14, 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 130, 18);

      let currentY = 36;

      // Render summary info box for filtered employees
      summary.forEach(s => {
        doc.setDrawColor(99, 102, 241);
        doc.setFillColor(248, 249, 254);
        doc.roundedRect(14, currentY, 182, 30, 2, 2, 'FD');

        doc.setTextColor(30, 30, 50);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`Colaborador: ${s.employee_name}`, 18, currentY + 8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Cargo: ${s.role || '—'}  |  Local: ${s.location_name || '—'}`, 18, currentY + 16);
        doc.text(`Pagamento: ${s.payment_method} (${s.pix_key_type || 'PIX'}: ${s.pix_key || 'Não informado'})`, 18, currentY + 24);

        doc.setFont('helvetica', 'bold');
        doc.text(`Diária: ${s.daily_rate_formatted}`, 125, currentY + 16);
        doc.setTextColor(34, 197, 94);
        doc.text(`Total a Pagar: ${s.total_earnings_formatted} (${s.total_hours}h)`, 125, currentY + 24);

        currentY += 36;
      });

      // Render Records Table
      const tableData = records.map(r => {
        const dt = new Date(r.timestamp);
        return [
          r.employee_name,
          r.location_name || '—',
          r.type === 'entrada' ? 'ENTRADA' : 'SAÍDA',
          dt.toLocaleDateString('pt-BR'),
          dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        ];
      });

      doc.autoTable({
        startY: currentY,
        head: [['Colaborador', 'Local de Trabalho', 'Tipo de Registro', 'Data', 'Horário']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 2.5 }
      });

      const finalY = doc.lastAutoTable.finalY + 35;
      if (finalY < 270) {
        doc.setDrawColor(150, 150, 150);
        doc.line(20, finalY, 90, finalY);
        doc.line(120, finalY, 190, finalY);

        doc.setFontSize(8.5);
        doc.setTextColor(80, 80, 80);
        doc.text('Assinatura do Colaborador', 30, finalY + 5);
        doc.text('Assinatura do Empregador / Admin', 125, finalY + 5);
      }

      const filename = `Folha_de_Ponto_${startDate || 'Geral'}_${endDate || ''}.pdf`;
      doc.save(filename);
    } catch (err) {
      alert('Erro ao gerar PDF: ' + err.message);
    }
  }

  // ═══════════════════════════════════
  // DIA DE PAGAMENTO (PAYMENT DAY LOGIC)
  // ═══════════════════════════════════

  function updatePayDatesByPreset() {
    const preset = payPeriodType.value;
    const now = new Date();

    if (preset === 'weekly') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      payStartDate.value = formatDate(start);
      payEndDate.value = formatDate(now);
    } else if (preset === 'fortnight') {
      const year = now.getFullYear();
      const month = now.getMonth();
      if (now.getDate() <= 15) {
        payStartDate.value = formatDate(new Date(year, month, 1));
        payEndDate.value = formatDate(new Date(year, month, 15));
      } else {
        payStartDate.value = formatDate(new Date(year, month, 16));
        payEndDate.value = formatDate(new Date(year, month + 1, 0));
      }
    } else if (preset === 'monthly') {
      const year = now.getFullYear();
      const month = now.getMonth();
      payStartDate.value = formatDate(new Date(year, month, 1));
      payEndDate.value = formatDate(new Date(year, month + 1, 0));
    }
  }

  async function loadPaymentSummary() {
    const startDate = payStartDate.value;
    const endDate = payEndDate.value;

    try {
      const summary = await Api.getRecordsSummary({ startDate, endDate });

      if (!summary || summary.length === 0) {
        payTotalEmployees.textContent = '0';
        payTotalDays.textContent = '0 dias';
        payTotalAmount.textContent = 'R$ 0,00';
        payTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum registro de ponto encontrado neste período</td></tr>';
        return;
      }

      let grandTotalDays = 0;
      let grandTotalAmount = 0;

      summary.forEach(s => {
        grandTotalDays += (s.days_worked || 0);
        grandTotalAmount += parseFloat(s.total_earnings || 0);
      });

      payTotalEmployees.textContent = summary.length;
      payTotalDays.textContent = `${grandTotalDays} ${grandTotalDays === 1 ? 'dia' : 'dias'}`;
      payTotalAmount.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grandTotalAmount);

      const sStartDate = startDate || '';
      const sEndDate = endDate || '';

      payTbody.innerHTML = summary.map(s => {
        const paidKey = `paid_${sStartDate}_${sEndDate}_${s.employee_id}`;
        const isPaid = localStorage.getItem(paidKey) === 'true';

        const nameStyle = isPaid
          ? 'color: #22c55e; font-weight: 800; font-size: 1.05rem;'
          : 'font-weight: 700;';
        const paidBadge = isPaid ? ' <span class="badge badge-paid">✓ PAGO</span>' : '';
        const buttonClass = isPaid ? 'btn btn-success btn-sm btn-paid-active' : 'btn btn-outline-success btn-sm';
        const buttonText = isPaid ? '✓ Pago' : 'Pago';

        return `
        <tr class="${isPaid ? 'row-paid' : ''}">
          <td>
            <a href="javascript:void(0)" onclick="openEmployeeTimesheet(${s.employee_id}, '${sStartDate}', '${sEndDate}')" class="clickable-emp-name" title="Abrir Folha de Ponto de ${s.employee_name.replace(/'/g, "\\'")} neste período">
              <strong style="${nameStyle}">${s.employee_name}</strong> ↗
            </a>${paidBadge}<br>
            <small style="color: var(--text-secondary);">${s.role || '—'}</small>
          </td>
          <td><span class="badge badge-location">${s.location_name || '—'}</span></td>
          <td title="Diária: ${s.daily_rate_formatted}">R$ ${s.hourly_rate}/h</td>
          <td><strong style="color: var(--accent-light); font-size: 0.95rem;">${s.days_worked || 0} dias</strong></td>
          <td>${s.total_hours}h</td>
          <td><strong style="color: var(--success); font-size: 1.05rem;">${s.total_earnings_formatted}</strong></td>
          <td>
            ${s.payment_method}
            ${s.pix_key ? `<br><button class="btn-copy-pix" onclick="copyPixKey('${s.pix_key.replace(/'/g, "\\'")}')" title="Copiar Chave PIX">📋 ${s.pix_key_type || 'PIX'}: ${s.pix_key}</button>` : ''}
          </td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="${buttonClass}" onclick="togglePaymentStatus(${s.employee_id}, '${sStartDate}', '${sEndDate}')" title="Alternar status de pagamento">
                ${buttonText}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="exportReceiptPDF(${s.employee_id}, '${s.employee_name.replace(/'/g, "\\'")}', '${sStartDate}', '${sEndDate}')" title="Gerar Recibo Individual">
                📄 Recibo
              </button>
            </div>
          </td>
        </tr>
      `;
      }).join('');
    } catch (err) {
      console.error('Error loading payment summary:', err);
      payTbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="color: var(--danger);">Erro ao carregar resumo de pagamento</td></tr>';
    }
  }

  window.togglePaymentStatus = function (employeeId, startDate, endDate) {
    const paidKey = `paid_${startDate}_${endDate}_${employeeId}`;
    const current = localStorage.getItem(paidKey) === 'true';
    if (current) {
      localStorage.removeItem(paidKey);
      showToast('Status Atualizado', 'Pagamento marcado como Pendente', 'saida');
    } else {
      localStorage.setItem(paidKey, 'true');
      showToast('Pagamento Confirmado!', 'Colaborador marcado como PAGO', 'entrada');
    }
    loadPaymentSummary();
  };

  function initPagamentoSection() {
    try {
      updatePayDatesByPreset();
      loadPaymentSummary();
    } catch (err) {
      console.error('Error in initPagamentoSection:', err);
    }
  }

  window.initPagamentoSection = initPagamentoSection;
  window.openPaymentModal = () => switchSection('pagamento');
  window.closePaymentModal = () => switchSection('dashboard');

  if (payPeriodType) {
    payPeriodType.addEventListener('change', () => {
      updatePayDatesByPreset();
      loadPaymentSummary();
    });
  }

  if (payStartDate) {
    payStartDate.addEventListener('change', () => {
      payPeriodType.value = 'custom';
      loadPaymentSummary();
    });
  }

  if (payEndDate) {
    payEndDate.addEventListener('change', () => {
      payPeriodType.value = 'custom';
      loadPaymentSummary();
    });
  }

  if (btnRecalculatePay) btnRecalculatePay.addEventListener('click', loadPaymentSummary);

  async function exportPayrollPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('A biblioteca de geração de PDF não pôde ser carregada.');
      return;
    }

    const startDate = payStartDate.value;
    const endDate = payEndDate.value;

    try {
      const summary = await Api.getRecordsSummary({ startDate, endDate });

      if (!summary || summary.length === 0) {
        alert('Nenhum registro de pagamento encontrado para exportar neste período.');
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFillColor(10, 10, 15);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('RELATÓRIO GERAL DE PAGAMENTOS — FECHAMENTO DE FOLHA', 14, 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${startDate || 'Geral'} até ${endDate || 'Hoje'}`, 130, 25);
      doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 25);

      let grandTotalDays = 0;
      let grandTotalAmount = 0;
      summary.forEach(s => {
        grandTotalDays += (s.days_worked || 0);
        grandTotalAmount += parseFloat(s.total_earnings || 0);
      });
      const grandTotalAmountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grandTotalAmount);

      doc.setDrawColor(34, 197, 94);
      doc.setFillColor(245, 252, 247);
      doc.roundedRect(14, 36, 182, 20, 2, 2, 'FD');

      doc.setTextColor(30, 30, 50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Total Colaboradores: ${summary.length}`, 20, 48);
      doc.text(`Total de Diárias: ${grandTotalDays} dias`, 80, 48);
      doc.setTextColor(34, 197, 94);
      doc.setFontSize(11);
      doc.text(`TOTAL A PAGAR: ${grandTotalAmountFormatted}`, 135, 48);

      const tableBody = summary.map(s => {
        const paidKey = `paid_${startDate || ''}_${endDate || ''}_${s.employee_id}`;
        const isPaid = localStorage.getItem(paidKey) === 'true';
        const statusTag = isPaid ? ' [PAGO]' : ' [PENDENTE]';

        return [
          `${s.employee_name}${statusTag}`,
          s.role || '—',
          s.location_name || '—',
          `R$ ${s.hourly_rate}/h`,
          `${s.days_worked || 0} dias`,
          `${s.total_hours}h`,
          s.total_earnings_formatted,
          `${s.payment_method}${s.pix_key ? `\n(${s.pix_key_type || 'PIX'}: ${s.pix_key})` : ''}`
        ];
      });

      doc.autoTable({
        startY: 62,
        head: [['Colaborador', 'Cargo', 'Local', 'Valor/Hora', 'Dias Trab.', 'Horas', 'Total a Pagar', 'Pagamento / PIX']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 22 },
          4: { cellWidth: 18 },
          5: { cellWidth: 16 },
          6: { cellWidth: 24, fontStyle: 'bold', textColor: [34, 197, 94] },
          7: { cellWidth: 20 }
        }
      });

      const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120) + 35;
      if (finalY < 270) {
        doc.setDrawColor(150, 150, 150);
        doc.line(20, finalY, 90, finalY);
        doc.line(120, finalY, 190, finalY);

        doc.setFontSize(8.5);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.text('Visto do Responsável pelo Pagamento', 25, finalY + 5);
        doc.text('Assinatura da Diretoria / Admin', 125, finalY + 5);
      }

      doc.save(`Fechamento_Folha_Pagamento_${startDate || 'Geral'}_a_${endDate || 'Fim'}.pdf`);
    } catch (err) {
      alert('Erro ao gerar relatório de pagamento: ' + err.message);
    }
  }

  if (btnExportPayrollPDF) btnExportPayrollPDF.addEventListener('click', exportPayrollPDF);

  window.copyPixKey = function (key) {
    if (!key) return;
    navigator.clipboard.writeText(key).then(() => {
      showToast('Chave PIX Copiada!', key, 'entrada');
    }).catch(() => {
      alert('Chave PIX: ' + key);
    });
  };

  window.exportReceiptPDF = async function (employeeId, employeeName, startDate, endDate) {
    if (!window.jspdf || !window.jspdf.jsPDF) return alert('Biblioteca de PDF não disponível');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const cleanStart = (startDate && startDate !== 'undefined') ? startDate : '';
    const cleanEnd = (endDate && endDate !== 'undefined') ? endDate : '';

    try {
      const summary = await Api.getRecordsSummary({ employeeId, startDate: cleanStart, endDate: cleanEnd });
      if (!summary || summary.length === 0) return alert('Nenhum registro encontrado');
      const s = summary[0];

      doc.setFillColor(10, 10, 15);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('RECIBO DE PAGAMENTO DE DIÁRIAS', 14, 20);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${cleanStart || 'Geral'} até ${cleanEnd || 'Hoje'}`, 130, 20);

      let y = 45;
      doc.setTextColor(30, 30, 50);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`COLABORADOR: ${s.employee_name}`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cargo / Função: ${s.role || '—'}`, 14, y + 8);
      doc.text(`Local de Trabalho: ${s.location_name || '—'}`, 14, y + 16);

      y += 30;
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(245, 247, 255);
      doc.roundedRect(14, y, 182, 45, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('DEMONSTRATIVO DE DIÁRIAS', 20, y + 12);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Valor da Diária: ${s.daily_rate_formatted}`, 20, y + 24);
      doc.text(`Dias Trabalhados no Período: ${s.days_worked} dias`, 20, y + 34);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.setFontSize(13);
      doc.text(`TOTAL A RECEBER: ${s.total_earnings_formatted}`, 110, y + 34);

      y += 60;
      doc.setTextColor(30, 30, 50);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('DADOS PARA PAGAMENTO:', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`Forma de Pagamento: ${s.payment_method}`, 14, y + 8);
      doc.text(`Chave PIX (${s.pix_key_type || 'PIX'}): ${s.pix_key || 'Não informada'}`, 14, y + 16);

      y += 50;
      doc.setDrawColor(120, 120, 120);
      doc.line(20, y, 90, y);
      doc.line(120, y, 190, y);

      doc.setFontSize(9);
      doc.text('Assinatura do Colaborador', 28, y + 6);
      doc.text('Assinatura da Empresa / Admin', 125, y + 6);

      doc.save(`Recibo_${s.employee_name.replace(/\s+/g, '_')}_${cleanStart}_a_${cleanEnd}.pdf`);
    } catch (err) {
      alert('Erro ao gerar recibo: ' + err.message);
    }
  };

  // ═══════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getInitials(name) {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  // ═══════════════════════════════════
  // DASHBOARD SECTION
  // ═══════════════════════════════════

  async function initDashboardSection() {
    try {
      // Load employees count
      const employees = await Api.getEmployees();
      const dashTotalEmp = $('#dash-total-employees');
      if (dashTotalEmp) dashTotalEmp.textContent = employees.length;

      // Load locations count
      const locations = await Api.getLocations();
      const dashTotalLoc = $('#dash-total-locations');
      if (dashTotalLoc) dashTotalLoc.textContent = locations.length;

      // Load today's records
      const todayStr = formatDate(new Date());
      const todayRecords = await Api.getRecords({ startDate: todayStr, endDate: todayStr, limit: 100 });
      const dashTodayRec = $('#dash-today-records');
      if (dashTodayRec) dashTodayRec.textContent = todayRecords.length;

      // Render today's list
      const dashTodayList = $('#dash-today-list');
      if (dashTodayList) {
        if (todayRecords.length === 0) {
          dashTodayList.innerHTML = '<p class="empty-state">Nenhum registro hoje</p>';
        } else {
          dashTodayList.innerHTML = todayRecords.slice(0, 10).map(r => `
            <div class="dash-record-item">
              <div class="dash-record-avatar">${getInitials(r.employee_name || '?')}</div>
              <div class="dash-record-info">
                <strong>${r.employee_name || 'Desconhecido'}</strong>
                <span class="badge badge-${r.type}">${r.type === 'entrada' ? '▶ Entrada' : '■ Saída'}</span>
              </div>
              <div class="dash-record-time">${new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          `).join('');
        }
      }

      // Load month payroll estimate
      const now = new Date();
      const startOfMonth = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const summary = await Api.getRecordsSummary({ startDate: startOfMonth, endDate: todayStr });
      const total = summary.reduce((acc, s) => acc + parseFloat(s.total_earnings || 0), 0);
      const dashPayroll = $('#dash-month-payroll');
      if (dashPayroll) dashPayroll.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch (err) {
      console.error('Dashboard error:', err);
    }
  }

  // ═══════════════════════════════════
  // FINANCEIRO SECTION
  // ═══════════════════════════════════

  let finInitialized = false;

  window.setFinType = function (type) {
    const hiddenInput = $('#fin-type');
    const btnEntrada = $('#btn-type-entrada');
    const btnSaida = $('#btn-type-saida');
    if (!hiddenInput) return;
    hiddenInput.value = type;
    if (btnEntrada) btnEntrada.classList.toggle('active', type === 'entrada');
    if (btnSaida) btnSaida.classList.toggle('active', type === 'saida');
  };

  window.deleteFinancialTx = async function (id) {
    if (!confirm('Remover este lançamento?')) return;
    try {
      await Api.deleteFinancialTransaction(id);
      await loadFinanceiroData();
    } catch (err) {
      alert('Erro ao remover: ' + err.message);
    }
  };

  async function loadFinanceiroData() {
    const finStart = $('#fin-start');
    const finEnd = $('#fin-end');
    const finTbody = $('#fin-tbody');
    const finTotalEntradas = $('#fin-total-entradas');
    const finTotalSaidas = $('#fin-total-saidas');
    const finSaldo = $('#fin-saldo');
    const finSaldoCard = $('#fin-kpi-saldo-card');

    const start = finStart ? finStart.value : '';
    const end = finEnd ? finEnd.value : '';
    if (!start || !end) return;

    try {
      if (finTbody) finTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Carregando...</td></tr>';
      const summary = await Api.getFinancialSummary({ startDate: start, endDate: end });

      const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      if (finTotalEntradas) finTotalEntradas.textContent = fmt(summary.totalEntradas);
      if (finTotalSaidas)   finTotalSaidas.textContent   = fmt(summary.totalSaidas);
      if (finSaldo) {
        finSaldo.textContent = fmt(summary.saldo);
        finSaldo.style.color = summary.saldo >= 0 ? 'var(--success)' : 'var(--danger)';
      }
      if (finSaldoCard) {
        finSaldoCard.style.borderColor = summary.saldo >= 0
          ? 'rgba(34, 197, 94, 0.4)'
          : 'rgba(239, 68, 68, 0.4)';
      }

      if (finTbody) {
        if (summary.transactions.length === 0) {
          finTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum lançamento no período</td></tr>';
        } else {
          finTbody.innerHTML = summary.transactions.map(t => {
            const isEntrada = t.type === 'entrada';
            const dateStr = new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR');
            const amtStr = parseFloat(t.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            return `
              <tr>
                <td>
                  <span class="fin-badge-type ${isEntrada ? 'fin-badge-entrada' : 'fin-badge-saida'}">
                    ${isEntrada ? '▲ Entrada' : '▼ Saída'}
                  </span>
                </td>
                <td><strong>${t.description}</strong></td>
                <td><small style="color: var(--text-secondary);">${t.category || '—'}</small></td>
                <td style="color: var(--text-secondary);">${dateStr}</td>
                <td>
                  <strong style="color: ${isEntrada ? 'var(--success)' : 'var(--danger)'}; font-size: 1rem;">
                    ${isEntrada ? '+' : '-'}${amtStr}
                  </strong>
                </td>
                <td>
                  <button class="btn btn-danger btn-sm" onclick="deleteFinancialTx(${t.id})" title="Remover">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  </button>
                </td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (err) {
      console.error('Financeiro error:', err);
      if (finTbody) finTbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="color: var(--danger);">Erro ao carregar dados</td></tr>';
    }
  }

  async function initFinanceiroSection() {
    const finPeriod = $('#fin-period');
    const finStart = $('#fin-start');
    const finEnd = $('#fin-end');
    const btnFinFilter = $('#btn-fin-filter');
    const formFinTx = $('#form-fin-transaction');
    const finFormError = $('#fin-form-error');

    function setFinDates() {
      const now = new Date();
      const todayStr = formatDate(now);
      const period = finPeriod ? finPeriod.value : 'month';
      if (period === 'month') {
        if (finStart) finStart.value = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
        if (finEnd) finEnd.value = todayStr;
      } else if (period === 'week') {
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
        if (finStart) finStart.value = formatDate(monday);
        if (finEnd) finEnd.value = todayStr;
      }
    }

    // Set today as default for the date field
    const finDate = $('#fin-date');
    if (finDate && !finDate.value) finDate.value = formatDate(new Date());

    if (!finInitialized) {
      setFinDates();
      finInitialized = true;

      if (finPeriod) {
        finPeriod.onchange = () => {
          if (finPeriod.value !== 'custom') setFinDates();
        };
      }

      if (btnFinFilter) btnFinFilter.onclick = loadFinanceiroData;

      if (formFinTx) {
        formFinTx.addEventListener('submit', async (e) => {
          e.preventDefault();
          const type = $('#fin-type')?.value || 'entrada';
          const description = $('#fin-description')?.value.trim();
          const amount = parseFloat($('#fin-amount')?.value);
          const category = $('#fin-category')?.value.trim();
          const date = $('#fin-date')?.value;
          const submitBtn = $('#btn-fin-submit');

          if (finFormError) finFormError.classList.add('hidden');

          try {
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...'; }
            await Api.createFinancialTransaction({ type, description, amount, category, date });

            // Reset form fields
            if ($('#fin-description')) $('#fin-description').value = '';
            if ($('#fin-amount')) $('#fin-amount').value = '';
            if ($('#fin-category')) $('#fin-category').value = '';

            showToast('Lançamento Salvo!', `${type === 'entrada' ? 'Entrada' : 'Saída'} de ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} registrada`, type === 'entrada' ? 'success' : 'saida');
            await loadFinanceiroData();
          } catch (err) {
            if (finFormError) {
              finFormError.textContent = err.message;
              finFormError.classList.remove('hidden');
            }
          } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Adicionar Lançamento'; }
          }
        });
      }
    }

    await loadFinanceiroData();
  }


  // ═══════════════════════════════════
  // ADMIN MODALS & LOGIC
  // ═══════════════════════════════════

  function openLoginModal() {
    loginError.classList.add('hidden');
    loginError.textContent = '';
    adminUsername.value = 'admin';
    adminPassword.value = '';
    modalAdminLogin.classList.remove('hidden');
    setTimeout(() => adminPassword.focus(), 100);
  }

  function closeLoginModal() {
    modalAdminLogin.classList.add('hidden');
    targetSectionAfterLogin = null;
  }

  btnAdminLoginTrigger.addEventListener('click', openLoginModal);
  btnCloseLoginModal.addEventListener('click', closeLoginModal);
  btnCancelLogin.addEventListener('click', closeLoginModal);

  modalAdminLogin.addEventListener('click', (e) => {
    if (e.target === modalAdminLogin) closeLoginModal();
  });

  formAdminLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = adminUsername.value.trim();
    const password = adminPassword.value.trim();

    if (!username || !password) return;

    loginError.classList.add('hidden');
    const submitBtn = $('#btn-submit-login');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando...';

    try {
      const res = await Api.adminLogin(username, password);
      currentAdminUser = res.admin.username;
      sessionStorage.setItem('adminUser', currentAdminUser);

      updateAdminUI();
      closeLoginModal();

      if (targetSectionAfterLogin) {
        if (targetSectionAfterLogin === 'payment') {
          openPaymentModal();
        } else {
          switchSection(targetSectionAfterLogin);
        }
        targetSectionAfterLogin = null;
      } else {
        // Default admin landing page: dashboard
        switchSection('dashboard');
      }
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
  });

  btnAdminLogout.addEventListener('click', () => {
    if (confirm('Deseja realmente sair da Área do Administrador?')) {
      currentAdminUser = null;
      sessionStorage.removeItem('adminUser');
      updateAdminUI();
    }
  });

  // Change Password Modal
  function openChangePassModal() {
    passError.classList.add('hidden');
    passSuccess.classList.add('hidden');
    passCurrent.value = '';
    passNew.value = '';
    passConfirm.value = '';
    modalChangePassword.classList.remove('hidden');
    setTimeout(() => passCurrent.focus(), 100);
  }

  function closeChangePassModal() {
    modalChangePassword.classList.add('hidden');
  }

  btnChangePassTrigger.addEventListener('click', openChangePassModal);
  btnClosePassModal.addEventListener('click', closeChangePassModal);
  btnCancelPass.addEventListener('click', closeChangePassModal);

  modalChangePassword.addEventListener('click', (e) => {
    if (e.target === modalChangePassword) closeChangePassModal();
  });

  formChangePassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPass = passCurrent.value.trim();
    const newPass = passNew.value.trim();
    const confirmPass = passConfirm.value.trim();

    passError.classList.add('hidden');
    passSuccess.classList.add('hidden');

    if (newPass !== confirmPass) {
      passError.textContent = 'A nova senha e a confirmação não conferem.';
      passError.classList.remove('hidden');
      return;
    }

    const submitBtn = $('#btn-submit-pass');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    try {
      await Api.changeAdminPassword(currentAdminUser, currentPass, newPass);
      passSuccess.textContent = 'Senha alterada com sucesso!';
      passSuccess.classList.remove('hidden');
      setTimeout(() => {
        closeChangePassModal();
      }, 1500);
    } catch (err) {
      passError.textContent = err.message;
      passError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Salvar Nova Senha';
    }
  });

  // ═══════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════

  async function init() {
    updateAdminUI();
    loadLocations();
    if (loadingOverlay) loadingOverlay.classList.add('hidden');

    if (isAdminLoggedIn()) {
      switchSection('dashboard');
    } else {
      initClockSection();
    }

    // Load AI models non-blockingly in the background
    FaceRecognition.loadModels((msg) => {
      if (loaderText) loaderText.textContent = msg;
    }).catch(err => {
      console.warn('Aviso no carregamento dos modelos de IA:', err);
    });
  }

  init();
})();
