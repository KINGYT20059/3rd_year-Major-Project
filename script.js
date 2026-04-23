/**
 * SmartRFID Attendance System â€” app.js
 * Full frontend simulation using LocalStorage
 * No backend required â€” all logic is mocked
 */

/* ============================================================
   STATE
   ============================================================ */
const State = {
  currentTeacher: null,   // { name, id }
  currentBatch: null,     // { id, name, dept, year, sem, teacherId }
  currentStudent: null,   // { name, id, batchId, rfidTag }
  codeTimer: null,        // Interval reference
};

/* ============================================================
   STORAGE HELPERS
   ============================================================ */
const Store = {
  getAll(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },
  setAll(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },
  // Teachers
  getTeachers()       { return Store.getAll('rfid_teachers'); },
  saveTeacher(t)      { const all = Store.getTeachers(); const idx = all.findIndex(x=>x.id===t.id); if(idx>-1) all[idx]=t; else all.push(t); Store.setAll('rfid_teachers', all); },
  findTeacherByName(n){ return Store.getTeachers().find(t => t.name.toLowerCase() === n.toLowerCase()); },

  // Batches
  getBatches()        { return Store.getAll('rfid_batches'); },
  saveBatch(b)        { const all = Store.getBatches(); const idx = all.findIndex(x=>x.id===b.id); if(idx>-1) all[idx]=b; else all.push(b); Store.setAll('rfid_batches', all); },
  getBatchesForTeacher(tid){ return Store.getBatches().filter(b => b.teacherId === tid); },
  getBatchById(id)    { return Store.getBatches().find(b => b.id === id); },

  // Students
  getStudents()       { return Store.getAll('rfid_students'); },
  saveStudent(s)      { const all = Store.getStudents(); const idx = all.findIndex(x=>x.id===s.id); if(idx>-1) all[idx]=s; else all.push(s); Store.setAll('rfid_students', all); },
  findStudentByName(name, batchId){ return Store.getStudents().find(s => s.name.toLowerCase()===name.toLowerCase() && s.batchId===batchId); },
  getStudentsForBatch(bid){ return Store.getStudents().filter(s => s.batchId === bid); },

  // Attendance
  getAttendance()     { return Store.getAll('rfid_attendance'); },
  saveAttendance(rec) { const all = Store.getAttendance(); all.push(rec); Store.setAll('rfid_attendance', all); },
  getAttendanceForBatch(bid){ return Store.getAttendance().filter(a => a.batchId === bid); },
  hasMarkedToday(studentId) {
    const today = new Date().toLocaleDateString('en-IN');
    return Store.getAttendance().some(a => a.studentId === studentId && a.date === today);
  },

  // Codes
  getCodes()          { return Store.getAll('rfid_codes'); },
  saveCode(c)         { const all = Store.getCodes(); const idx = all.findIndex(x=>x.batchId===c.batchId); if(idx>-1) all[idx]=c; else all.push(c); Store.setAll('rfid_codes', all); },
  getCodeForBatch(bid){ return Store.getCodes().find(c => c.batchId === bid); },
  findActiveCode(code){ return Store.getCodes().find(c => c.code === code.toUpperCase() && c.expiresAt > Date.now()); },
};

/* ============================================================
   UTILITIES
   ============================================================ */
const Utils = {
  uid: () => 'id_' + Math.random().toString(36).substr(2, 9),
  rfidTag: () => 'RFID-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
  codeGen: () => Math.random().toString(36).substr(2, 6).toUpperCase(),
  now: () => new Date(),

  formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  },
  formatTime(d) {
    return new Date(d).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  },
  formatDateKey(d) {
    return new Date(d).toLocaleDateString('en-IN');
  },
  greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  },
  formatCountdown(ms) {
    if (ms <= 0) return '00:00:00';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  },
};

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
const Toast = {
  show(msg, type='info', duration=3500) {
    const icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info', warning:'fa-triangle-exclamation' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 350);
    }, duration);
  },
  success(m) { this.show(m, 'success'); },
  error(m)   { this.show(m, 'error'); },
  info(m)    { this.show(m, 'info'); },
  warn(m)    { this.show(m, 'warning'); },
};

/* ============================================================
   LOADING
   ============================================================ */
const Loading = {
  show(text='Processing...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.remove('hidden');
  },
  hide() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  },
  async run(fn, text='Processing...') {
    this.show(text);
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    this.hide();
    fn();
  }
};

/* ============================================================
   SCREEN NAVIGATION
   ============================================================ */
const App = {

  goTo(screenId) {
    const current = document.querySelector('.screen.active');
    const next = document.getElementById(screenId);
    if (!next || current === next) return;

    if (current) {
      current.classList.add('exit');
      setTimeout(() => current.classList.remove('active', 'exit'), 400);
    }
    next.classList.add('active');
    window.scrollTo(0, 0);
  },

  /* ---- TEACHER MODE TOGGLE ---- */
  _teacherMode: 'new',
  setTeacherMode(mode) {
    this._teacherMode = mode;
    document.getElementById('btnNewTeacher').classList.toggle('active', mode === 'new');
    document.getElementById('btnExistingTeacher').classList.toggle('active', mode === 'existing');

    const batchSel = document.getElementById('existingBatchSelector');
    if (mode === 'existing') {
      batchSel.classList.remove('hidden');
      this._populateExistingBatchDropdown();
    } else {
      batchSel.classList.add('hidden');
    }
  },

  _populateExistingBatchDropdown() {
    const name = document.getElementById('teacherName').value.trim();
    const sel = document.getElementById('existingBatchSelect');
    sel.innerHTML = '<option value="">-- Select your batch --</option>';
    if (!name) return;
    const teacher = Store.findTeacherByName(name);
    if (!teacher) return;
    const batches = Store.getBatchesForTeacher(teacher.id);
    batches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} â€” ${b.dept} (${b.year}, ${b.sem})`;
      sel.appendChild(opt);
    });
  },

  teacherLogin() {
    const name = document.getElementById('teacherName').value.trim();
    if (!name) { Toast.error('Please enter your name.'); return; }

    Loading.run(() => {
      let teacher = Store.findTeacherByName(name);

      if (this._teacherMode === 'existing') {
        if (!teacher) { Toast.error('No teacher found with that name.'); return; }
        const batchId = document.getElementById('existingBatchSelect').value;
        if (!batchId) { Toast.error('Please select a batch.'); return; }
        State.currentTeacher = teacher;
        State.currentBatch = Store.getBatchById(batchId);
        Toast.success(`Welcome back, ${teacher.name}!`);
        this._loadDashboard();
      } else {
        // New teacher
        if (!teacher) {
          teacher = { id: Utils.uid(), name };
          Store.saveTeacher(teacher);
        }
        State.currentTeacher = teacher;
        this.goTo('screen-batch-create');
      }
    }, 'Verifying credentials...');
  },

  createBatch() {
    const name = document.getElementById('batchName').value.trim();
    const dept = document.getElementById('batchDept').value;
    const year = document.getElementById('batchYear').value;
    const sem  = document.getElementById('batchSem').value;
    if (!name || !dept || !year || !sem) { Toast.error('Please fill in all batch fields.'); return; }

    Loading.run(() => {
      const batch = {
        id: Utils.uid(),
        name, dept, year, sem,
        teacherId: State.currentTeacher.id,
        createdAt: Date.now(),
      };
      Store.saveBatch(batch);
      State.currentBatch = batch;
      Toast.success(`Batch "${name}" created!`);
      this._loadDashboard();
    }, 'Creating batch...');
  },

  _loadDashboard() {
    document.getElementById('teacherNavName').textContent = State.currentTeacher.name;
    const greeting = Utils.greeting();
    document.getElementById('dashWelcome').textContent = `${greeting}, ${State.currentTeacher.name}`;
    document.getElementById('dashDateLine').textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    this._updateBatchDisplay();
    this._updateStats();
    this._restoreCode();
    this.renderAttendanceTable();
    this.goTo('screen-teacher-dashboard');
    this.switchTab('overview');
  },

  _updateBatchDisplay() {
    if (!State.currentBatch) return;
    document.getElementById('activeBatchName').textContent = State.currentBatch.name;
    document.getElementById('activeBatchMeta').textContent =
      `${State.currentBatch.dept} - ${State.currentBatch.year} - ${State.currentBatch.sem}`;
  },

  _updateStats() {
    if (!State.currentBatch) return;
    const students = Store.getStudentsForBatch(State.currentBatch.id);
    const today = Utils.formatDateKey(Date.now());
    const todayPresent = Store.getAttendanceForBatch(State.currentBatch.id)
      .filter(a => a.date === today).length;
    document.getElementById('statTotalStudents').textContent = students.length;
    document.getElementById('statTodayPresent').textContent = todayPresent;
  },

  switchTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`tab-content-${tab}`).classList.add('active');
    if (tab === 'attendance') this.renderAttendanceTable();
    if (tab === 'overview') this._updateStats();
  },

  /* ---- BATCH SWITCHER ---- */
  showBatchSwitcher() {
    const sw = document.getElementById('batchSwitcher');
    sw.classList.toggle('hidden');
    if (!sw.classList.contains('hidden')) {
      this.filterBatches();
      document.getElementById('batchSearchInput').focus();
    }
  },

  filterBatches() {
    const q = document.getElementById('batchSearchInput').value.toLowerCase();
    const batches = Store.getBatchesForTeacher(State.currentTeacher.id)
      .filter(b => !q || b.name.toLowerCase().includes(q) || b.dept.toLowerCase().includes(q));

    const res = document.getElementById('batchSearchResults');
    res.innerHTML = '';

    if (batches.length === 0) {
      res.innerHTML = '<div class="batch-result-item">No batches found. <button class="btn-ghost" onclick="App.openModal(\'batchModal\')">+ Add</button></div>';
      return;
    }

    batches.forEach(b => {
      const div = document.createElement('div');
      div.className = 'batch-result-item' + (State.currentBatch?.id === b.id ? ' active-item' : '');
      div.innerHTML = `<strong>${b.name}</strong> &nbsp;Â·&nbsp; <small>${b.dept} - ${b.year} - ${b.sem}</small>`;
      div.onclick = () => this._switchBatch(b.id);
      res.appendChild(div);
    });

    // Add new batch option
    const addDiv = document.createElement('div');
    addDiv.className = 'batch-result-item';
    addDiv.style.color = 'var(--teacher)';
    addDiv.innerHTML = '<i class="fa-solid fa-plus" style="margin-right:6px"></i> Add New Batch';
    addDiv.onclick = () => this.openModal('batchModal');
    res.appendChild(addDiv);
  },

  _switchBatch(batchId) {
    State.currentBatch = Store.getBatchById(batchId);
    document.getElementById('batchSwitcher').classList.add('hidden');
    this._updateBatchDisplay();
    this._updateStats();
    this._restoreCode();
    Toast.info(`Switched to "${State.currentBatch.name}"`);
  },

  addBatchFromModal() {
    const name = document.getElementById('modalBatchName').value.trim();
    const dept = document.getElementById('modalBatchDept').value;
    const year = document.getElementById('modalBatchYear').value;
    const sem  = document.getElementById('modalBatchSem').value;
    if (!name || !dept || !year || !sem) { Toast.error('Fill in all fields.'); return; }
    const batch = { id: Utils.uid(), name, dept, year, sem, teacherId: State.currentTeacher.id, createdAt: Date.now() };
    Store.saveBatch(batch);
    State.currentBatch = batch;
    this.closeModal('batchModal');
    this._updateBatchDisplay();
    this._updateStats();
    Toast.success(`Batch "${name}" added!`);
    document.getElementById('modalBatchName').value = '';
  },

  /* ---- CODE GENERATION ---- */
  _codeInterval: null,

  generateCode() {
    let time=document.getElementById('codeDurationSelect');
    if (!State.currentBatch) { Toast.warn('No active batch.'); return; }
    const code = Utils.codeGen();
    const expiresAt = Date.now() + parseInt(time.value) * 60 * 1000; // Duration in minutes
    const rec = { batchId: State.currentBatch.id, code, expiresAt, createdAt: Date.now() };
    Store.saveCode(rec);
    this._showCode(rec);
    Toast.success('Code generated!');
    time.style.display = 'none';
  },

  regenerateCode() {
    clearInterval(this._codeInterval);
    this.generateCode();
  },

  _restoreCode() {
    if (!State.currentBatch) return;
    const rec = Store.getCodeForBatch(State.currentBatch.id);
    if (rec && rec.expiresAt > Date.now()) {
      this._showCode(rec);
    } else {
      this._showNoCode();
    }
  },

  _showCode(rec) {
    const area = document.getElementById('codeDisplayArea');
    area.innerHTML = `
      <div class="code-active-display">
        <div class="code-value" id="activeCodeVal">${rec.code}</div>
        <div class="code-timer">
          <i class="fa-regular fa-clock"></i>
          Expires in &nbsp;<span class="code-timer-count" id="codeTimerCount">--:--:--</span>
        </div>
      </div>
    `;
    document.getElementById('codeStatusBadge').textContent = 'Active';
    document.getElementById('codeStatusBadge').className = 'section-badge active-badge';
    document.getElementById('btnGenerateCode').style.display = 'none';
    document.getElementById('btnRegenCode').style.display = '';
    document.getElementById('btnShareCode').style.display = '';

    clearInterval(this._codeInterval);
    this._codeInterval = setInterval(() => {
      const remaining = rec.expiresAt - Date.now();
      const el = document.getElementById('codeTimerCount');
      if (!el) { clearInterval(this._codeInterval); return; }
      if (remaining <= 0) {
        clearInterval(this._codeInterval);
        this._showNoCode();
        Toast.warn('Attendance code expired.');
        return;
      }
      el.textContent = Utils.formatCountdown(remaining);
      if (remaining < 60000) el.classList.add('expiring-soon');
    }, 1000);
  },

  _showNoCode() {
    document.getElementById('codeDisplayArea').innerHTML = `
      <div class="code-placeholder">
        <i class="fa-regular fa-clock"></i>
        <span>No active code. Generate one below.</span>
      </div>
    `;
    document.getElementById('codeStatusBadge').textContent = 'Inactive';
    document.getElementById('codeStatusBadge').className = 'section-badge';
    document.getElementById('btnGenerateCode').style.display = '';
    document.getElementById('btnRegenCode').style.display = 'none';
    document.getElementById('btnShareCode').style.display = 'none';
  },

  /* ---- SHARE MODAL ---- */
  openShareModal() {
    const rec = Store.getCodeForBatch(State.currentBatch?.id);
    if (!rec) { Toast.warn('No active code.'); return; }
    document.getElementById('shareCodeValue').textContent = rec.code;
    this.openModal('shareModal');
  },

  shareVia(platform) {
    const rec = Store.getCodeForBatch(State.currentBatch?.id);
    const code = rec?.code || '';
    const msg = `ðŸ“š Attendance Code: ${code} â€” Valid for 5 hours. Use SmartRFID to mark attendance.`;
    const urls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(msg)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=&quote=${encodeURIComponent(msg)}`,
      instagram: null,
    };
    if (platform === 'instagram') {
      Toast.info('Copy the code and share on Instagram Story!');
      return;
    }
    if (urls[platform]) window.open(urls[platform], '_blank');
    Toast.success(`Opening ${platform.charAt(0).toUpperCase() + platform.slice(1)}...`);
  },

  copyCode() {
    const rec = Store.getCodeForBatch(State.currentBatch?.id);
    if (!rec) return;
    navigator.clipboard?.writeText(rec.code).then(() => {
      Toast.success('Code copied to clipboard!');
    }).catch(() => {
      Toast.info(`Code: ${rec.code}`);
    });
    this.closeModal('shareModal');
  },

  /* ---- ATTENDANCE TABLE ---- */
  renderAttendanceTable() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    let records = State.currentBatch
      ? Store.getAttendanceForBatch(State.currentBatch.id)
      : Store.getAttendance();

    const filterDate = document.getElementById('filterDate')?.value;
    if (filterDate) {
      const fd = new Date(filterDate).toLocaleDateString('en-IN');
      records = records.filter(r => r.date === fd);
    }

    records.sort((a, b) => b.timestamp - a.timestamp);

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6" style="display:table-cell; text-align:center; padding:60px; color:var(--text-muted)">
            <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
              <i class="fa-regular fa-folder-open" style="font-size:32px;opacity:0.3"></i>
              <span>No attendance records found.</span>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = records.map((r, i) => {
      const batch = Store.getBatchById(r.batchId);
      return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${r.studentName}</strong></td>
          <td>${r.date}</td>
          <td>${r.time}</td>
          <td><span class="status-present"><i class="fa-solid fa-circle-check"></i> Present</span></td>
          <td>${batch?.name || 'â€”'}</td>
        </tr>`;
    }).join('');
  },

  /* ---- STUDENT LOGIN ---- */
  studentLogin() {
    const name     = document.getElementById('studentName').value.trim();
    const password = document.getElementById('studentPassword').value.trim();
    const code     = document.getElementById('attendanceCode').value.trim().toUpperCase();

    if (!name)     { Toast.error('Please enter your name.'); return; }
    if (!password) { Toast.error('Please enter a password.'); return; }
    if (!code)     { Toast.error('Please enter the attendance code.'); return; }

    Loading.run(() => {
      // Verify code
      const codeRec = Store.findActiveCode(code);
      if (!codeRec) { Toast.error('Invalid or expired attendance code!'); return; }

      const batch = Store.getBatchById(codeRec.batchId);
      if (!batch) { Toast.error('Batch not found.'); return; }

      // Find or create student
      let student = Store.findStudentByName(name, batch.id);
      if (!student) {
        // First-time registration
        student = {
          id: Utils.uid(),
          name,
          password,
          batchId: batch.id,
          rfidTag: Utils.rfidTag(),
          registeredAt: Date.now(),
        };
        Store.saveStudent(student);
        Toast.success(`Welcome, ${name}! You've been registered.`);
      } else {
        Toast.success(`Welcome back, ${name}!`);
      }

      State.currentStudent = student;
      State.currentBatch = batch;

      // Go to RFID scan
      document.getElementById('rfidStudentGreet').textContent = `Hello, ${name}`;
      this.goTo('screen-rfid-scan');
    }, 'Verifying...');
  },

  /* ---- RFID SCAN SIMULATION ---- */
  _scanning: false,
  simulateScan() {
    if (this._scanning) return;
    this._scanning = true;
    const btn = document.getElementById('btnScanNow');
    const instruction = document.getElementById('rfidInstruction');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scanning...';
    instruction.textContent = ' Scanning RFID tag...';

    // Simulate scan delay
    setTimeout(() => {
      const student = State.currentStudent;

      if (!student) {
        Toast.error('No student session found.');
        this._resetScanBtn();
        return;
      }

      // Check if already marked today
      if (Store.hasMarkedToday(student.id)) {
        Toast.warn('Attendance already marked today!');
        instruction.textContent = 'Already marked today!';
        this._resetScanBtn();
        return;
      }

      // Mark attendance
      const now = Date.now();
      const rec = {
        id: Utils.uid(),
        studentId: student.id,
        studentName: student.name,
        batchId: student.batchId,
        rfidTag: student.rfidTag,
        date: Utils.formatDateKey(now),
        time: Utils.formatTime(now),
        timestamp: now,
        status: 'present',
      };
      Store.saveAttendance(rec);

      // Fill confirmation screen
      document.getElementById('confirmStudentName').textContent = student.name;
      document.getElementById('confirmBatch').textContent = Store.getBatchById(student.batchId)?.name || 'â€”';
      document.getElementById('confirmDate').textContent = Utils.formatDate(now);
      document.getElementById('confirmTime').textContent = Utils.formatTime(now);
      document.getElementById('confirmRFID').textContent = student.rfidTag;

      Toast.success('Attendance marked successfully!');
      App.goTo('screen-confirmation');
      App._launchParticles();
      App._scanning = false;
    }, 2200);
  },

  _resetScanBtn() {
    this._scanning = false;
    const btn = document.getElementById('btnScanNow');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-rss"></i> Scan Now';
    }
    const instruction = document.getElementById('rfidInstruction');
    if (instruction) instruction.textContent = 'ðŸ‘‰ Please scan your RFID tag on the sensor';
  },

  _launchParticles() {
    const container = document.getElementById('successParticles');
    if (!container) return;
    const colors = ['#0db37c', '#3a6cf4', '#f0a040', '#f04a4a', '#9b5cf6'];
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 6 + Math.random() * 8;
      const angle = (i / 18) * 360;
      const dist = 60 + Math.random() * 40;
      p.style.cssText = `
        position: absolute;
        width: ${size}px; height: ${size}px;
        background: ${color};
        border-radius: 50%;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        animation: particleFly 0.8s ease-out ${i * 30}ms forwards;
        --tx: ${Math.cos(angle * Math.PI / 180) * dist}px;
        --ty: ${Math.sin(angle * Math.PI / 180) * dist}px;
      `;
      container.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }
  },

  /* ---- PASSWORD TOGGLE ---- */
  togglePwd(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.innerHTML = isText ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
  },

  /* ---- MODALS ---- */
  openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  },
  closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  },

  /* ---- LOGOUT ---- */
  logout() {
    clearInterval(this._codeInterval);
    State.currentTeacher = null;
    State.currentBatch = null;
    State.currentStudent = null;
    // Reset form fields
    document.getElementById('teacherName').value = '';
    Toast.info('Logged out.');
    this.goTo('screen-landing');
  },
};

/* ============================================================
   BACKGROUND CANVAS â€” Animated tech pattern
   ============================================================ */
(function initCanvas() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');

  let W, H, nodes;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createNodes() {
    const count = Math.floor((W * H) / 18000);
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 2 + Math.random() * 2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(58, 108, 244, ${0.12 * (1 - dist / 140)})`;
          ctx.lineWidth = 1;
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(58, 108, 244, 0.25)';
      ctx.fill();

      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    });

    requestAnimationFrame(draw);
  }

  resize();
  createNodes();
  draw();
  window.addEventListener('resize', () => { resize(); createNodes(); });
})();

/* ============================================================
   PARTICLE CSS (injected dynamically)
   ============================================================ */
(function injectParticleCSS() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes particleFly {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
})();

/* ============================================================
   SEED MOCK DATA (for demo purposes)
   ============================================================ */
(function seedMockData() {
  // Only seed if no data exists
  if (Store.getTeachers().length > 0) return;

  const teacher = { id: 'demo_teacher_1', name: 'Dr. Ananya Sharma' };
  Store.saveTeacher(teacher);

  const batch1 = { id: 'demo_batch_1', name: 'CS-A Morning Batch', dept: 'Computer Science', year: '3rd Year', sem: 'Sem 5', teacherId: teacher.id, createdAt: Date.now() };
  const batch2 = { id: 'demo_batch_2', name: 'IT-B Evening Batch', dept: 'Information Technology', year: '2nd Year', sem: 'Sem 3', teacherId: teacher.id, createdAt: Date.now() };
  Store.saveBatch(batch1);
  Store.saveBatch(batch2);

  const students = [
    { id: Utils.uid(), name: 'Rohit Kumar', password: 'pass123', batchId: 'demo_batch_1', rfidTag: Utils.rfidTag(), registeredAt: Date.now() },
    { id: Utils.uid(), name: 'Priya Singh', password: 'pass123', batchId: 'demo_batch_1', rfidTag: Utils.rfidTag(), registeredAt: Date.now() },
    { id: Utils.uid(), name: 'Arjun Das', password: 'pass123', batchId: 'demo_batch_1', rfidTag: Utils.rfidTag(), registeredAt: Date.now() },
  ];
  students.forEach(s => Store.saveStudent(s));

  // Seed some attendance records
  const now = Date.now();
  const yesterday = now - 86400000;
  [
    { studentId: students[0].id, studentName: students[0].name, batchId: 'demo_batch_1', rfidTag: students[0].rfidTag, date: Utils.formatDateKey(yesterday), time: '09:15 AM', timestamp: yesterday },
    { studentId: students[1].id, studentName: students[1].name, batchId: 'demo_batch_1', rfidTag: students[1].rfidTag, date: Utils.formatDateKey(yesterday), time: '09:22 AM', timestamp: yesterday + 420000 },
    { studentId: students[2].id, studentName: students[2].name, batchId: 'demo_batch_1', rfidTag: students[2].rfidTag, date: Utils.formatDateKey(now), time: '10:05 AM', timestamp: now - 3600000 },
  ].forEach(r => Store.saveAttendance({ id: Utils.uid(), ...r, status: 'present' }));

  console.log('âœ… SmartRFID: Demo data seeded. Teacher: "Dr. Ananya Sharma"');
})();

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  console.log('ðŸš€ SmartRFID Attendance System â€” Ready');
  // Set today's date as default filter
  const filterDate = document.getElementById('filterDate');
  if (filterDate) filterDate.valueAsDate = new Date();
});