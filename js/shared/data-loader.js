/**
 * CCNV DATA LOADER & IN-MEMORY STATE MANAGER
 * Loads data.json and provides state operations across tabs without backend CRUD
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_STATE = 'ccnv_in_memory_state';
  const STORAGE_KEY_CURRENT_USER = 'ccnv_current_user';

  class StateManager {
    constructor() {
      this.state = null;
      this.listeners = [];
      this.currentUser = null;

      // Realtime cross-tab communication bus
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        try {
          this.channel = new BroadcastChannel('ccnv_realtime_bus');
          this.channel.onmessage = (msg) => {
            if (msg.data && msg.data.state) {
              this.state = msg.data.state;
              if (Array.isArray(this.state?.vehicles)) {
                this.state.vehicles = this.state.vehicles.filter(v => v.plate !== '65A-017.22' && v.plate !== '65A-015.67');
              }
              window.appState = this.state;
              const { event, payload } = msg.data;
              this.listeners.forEach(fn => {
                try { fn(event, payload, this.state); } catch (e) { console.error('Error in listener:', e); }
              });
              window.dispatchEvent(new CustomEvent('ccnvStateUpdate', { detail: { event, payload, fromRemote: true } }));
            }
          };
        } catch (e) {
          console.warn('BroadcastChannel init warning:', e);
        }
      }

      // Storage event fallback for cross-tab sync
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
          if (e.key === STORAGE_KEY_STATE && e.newValue) {
            try {
              this.state = JSON.parse(e.newValue);
              if (Array.isArray(this.state?.vehicles)) {
                this.state.vehicles = this.state.vehicles.filter(v => v.plate !== '65A-017.22' && v.plate !== '65A-015.67');
              }
              window.appState = this.state;
              this.listeners.forEach(fn => {
                try { fn('STORAGE_SYNC', null, this.state); } catch (err) { console.error(err); }
              });
              window.dispatchEvent(new CustomEvent('ccnvStateUpdate', { detail: { event: 'STORAGE_SYNC', fromRemote: true } }));
            } catch (err) {}
          }
        });
      }
    }

    async init() {
      // Check local/session storage first or fetch data.json
      let cached = localStorage.getItem(STORAGE_KEY_STATE) || sessionStorage.getItem(STORAGE_KEY_STATE);
      if (cached) {
        try {
          this.state = JSON.parse(cached);
          const seedVersion = window.SEED_DATA?.system?.version || '3.3.0';
          const hasOldPlates = Array.isArray(this.state?.vehicles) && this.state.vehicles.some(v => v.plate === '65A-017.22' || v.plate === '65A-015.67');
          const invalidVehicleCount = Array.isArray(this.state?.vehicles) && this.state.vehicles.length !== 6;

          if (this.state?.system?.version !== seedVersion || hasOldPlates || invalidVehicleCount) {
            // Dữ liệu mẫu đã đổi phiên bản hoặc còn sót xe cũ → xóa sạch cache cũ, nạp lại mới
            this.state = null;
            try {
              localStorage.removeItem(STORAGE_KEY_STATE);
              sessionStorage.removeItem(STORAGE_KEY_STATE);
            } catch (err) {}
          } else if (window.SEED_DATA) {
            if (window.SEED_DATA.accounts) this.state.accounts = window.SEED_DATA.accounts;
            if (window.SEED_DATA.hospitals) this.state.hospitals = window.SEED_DATA.hospitals;
            if (window.SEED_DATA.vehicles) this.state.vehicles = window.SEED_DATA.vehicles;
            if (window.SEED_DATA.incidentTypes) this.state.incidentTypes = window.SEED_DATA.incidentTypes;
          }
          if (Array.isArray(this.state?.vehicles)) {
            this.state.vehicles = this.state.vehicles.filter(v => v.plate !== '65A-017.22' && v.plate !== '65A-015.67');
          }
        } catch (e) {
          console.warn('Failed to parse cached state, reloading from data.json');
        }
      }

      if (!this.state) {
        try {
          const resp = await fetch('data.json');
          if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
          this.state = await resp.json();
          this.saveToSession();
        } catch (err) {
          console.warn('Fetch data.json failed or running via file:// protocol, checking window.SEED_DATA fallback:', err);
          if (window.SEED_DATA) {
            this.state = JSON.parse(JSON.stringify(window.SEED_DATA));
            this.saveToSession();
          } else {
            console.error('Fatal: No seed data available');
            throw err;
          }
        }
      }

      // Initialize current user (Support URL search params override e.g. ?role=hospital, ?role=dispatcher)
      let paramUser = null;
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const qRole = (urlParams.get('role') || '').toLowerCase();
          const qAcc = urlParams.get('account') || urlParams.get('user');
          if (qAcc && this.state.accounts.some(a => a.id === qAcc || a.username === qAcc)) {
            paramUser = this.state.accounts.find(a => a.id === qAcc || a.username === qAcc);
          } else if (qRole === 'hospital' || qRole === 'benhvien') {
            paramUser = this.state.accounts.find(a => a.role === 'HOSPITAL_RECEIVER') || this.state.accounts[0];
          } else if (qRole === 'dispatcher' || qRole === 'central' || qRole === 'trungtam') {
            paramUser = this.state.accounts.find(a => a.role === 'DISPATCHER') || this.state.accounts[0];
          }
        } catch (e) {
          console.warn('Error parsing URL query params:', e);
        }
      }

      if (paramUser) {
        this.currentUser = paramUser;
        sessionStorage.setItem(STORAGE_KEY_CURRENT_USER, this.currentUser.id);
        sessionStorage.setItem('ccnv_logged_in_user', this.currentUser.id);
      } else {
        const savedUser = sessionStorage.getItem(STORAGE_KEY_CURRENT_USER);
        if (savedUser && this.state.accounts.some(a => a.id === savedUser)) {
          this.currentUser = this.state.accounts.find(a => a.id === savedUser);
        } else {
          // Default to dispatcher 01
          this.currentUser = this.state.accounts[0];
          sessionStorage.setItem(STORAGE_KEY_CURRENT_USER, this.currentUser.id);
        }
      }

      window.appState = this.state;
      window.currentUser = this.currentUser;
      this.notify('INIT', this.state);
      return this.state;
    }

    saveToSession() {
      try {
        const serialized = JSON.stringify(this.state);
        localStorage.setItem(STORAGE_KEY_STATE, serialized);
        sessionStorage.setItem(STORAGE_KEY_STATE, serialized);
      } catch (e) {
        console.warn('Storage save warning:', e);
      }
    }

    subscribe(fn) {
      if (typeof fn === 'function') {
        this.listeners.push(fn);
      }
      return () => {
        this.listeners = this.listeners.filter(l => l !== fn);
      };
    }

    notify(event, payload) {
      this.saveToSession();
      if (this.channel) {
        try {
          this.channel.postMessage({ event, payload, state: this.state });
        } catch (e) {}
      }
      this.listeners.forEach(fn => {
        try {
          fn(event, payload, this.state);
        } catch (e) {
          console.error('Error in state subscriber:', e);
        }
      });
      // Also dispatch custom DOM event
      window.dispatchEvent(new CustomEvent('ccnvStateUpdate', { detail: { event, payload } }));
    }

    // --- State Accessors ---
    getState() { return this.state; }
    getCurrentUser() { return this.currentUser; }
    getVehicles() { return this.state.vehicles || []; }
    getHospitals() { return this.state.hospitals || []; }
    getCrews() { return this.state.crews || []; }
    getCases() { return this.state.cases || []; }
    getCallScenarios() { return this.state.callScenarios || []; }
    getCallHistory() { return this.state.callHistory || []; }

    setCurrentUser(userId) {
      const acc = this.state.accounts.find(a => a.id === userId);
      if (acc) {
        this.currentUser = acc;
        sessionStorage.setItem(STORAGE_KEY_CURRENT_USER, userId);
        window.currentUser = this.currentUser;
        this.notify('USER_CHANGED', this.currentUser);
      }
    }

    // --- Core State Mutators ---
    createCase(caseData) {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
      const serial = String(this.state.cases.length + 2).padStart(3, '0');
      const code = `CC-${dateStr}-${serial}`;

      const newCase = {
        id: code,
        code: code,
        createdAt: now.toISOString(),
        status: 'DISPATCHED',
        statusText: 'Đang điều xe',
        stageLabel: 'Chờ kíp xác nhận',
        orderStatus: 'NOT_CONFIRMED',
        orderStatusText: 'Chưa xác nhận',
        hospitalResponse: 'PENDING',
        hospitalResponseText: 'Chờ phản hồi',
        ...caseData,
        milestones: [
          { step: 'CALL_RECEIVED', name: 'Tiếp nhận cuộc gọi', time: timeStr, done: true },
          { step: 'DISPATCHED', name: 'Phát lệnh điều xe', time: timeStr, done: true },
          { step: 'CREW_CONFIRMED', name: 'Kíp xuất phát', time: null, done: false },
          { step: 'SCENE_ARRIVED', name: 'Đến hiện trường', time: null, done: false },
          { step: 'LEAVING_SCENE', name: 'Rời hiện trường', time: null, done: false },
          { step: 'HOSPITAL_ARRIVED', name: 'Đến bệnh viện', time: null, done: false },
          { step: 'HANDOVER_DONE', name: 'Hoàn tất bàn giao', time: null, done: false }
        ],
        logs: [
          { time: timeStr, user: this.currentUser?.id || 'dpv01', action: `Tiếp nhận cuộc gọi tạo ca ${code}` },
          { time: timeStr, user: this.currentUser?.id || 'dpv01', action: `Phát lệnh điều động tới xe ${caseData.dispatch.vehiclePlate} và gửi cảnh báo trước tới ${caseData.dispatch.hospitalName}` }
        ],
        epcr: {
          patientStatus: 'Đang tiếp cận kiểm tra',
          vitals: { pulse: null, bp: '', spO2: null, temp: null, rr: null },
          interventions: [],
          medications: [],
          progression: 'Kíp đang trên đường tiếp cận hiện trường'
        }
      };

      // Update vehicle status to DISPATCHING
      const veh = this.state.vehicles.find(v => v.plate === caseData.dispatch.vehiclePlate);
      if (veh) {
        veh.status = 'DISPATCHING';
        veh.statusText = 'Đang điều xe';
        veh.currentCaseId = code;
      }

      this.state.cases.unshift(newCase);
      this.addAuditLog(`Tạo ca cấp cứu mới ${code} và phát lệnh điều động`, this.currentUser?.id);
      this.notify('CASE_CREATED', newCase);
      return newCase;
    }

    updateCase(caseId, patch) {
      const c = this.state.cases.find(item => item.id === caseId || item.code === caseId);
      if (!c) return null;

      Object.assign(c, patch);
      this.notify('CASE_UPDATED', c);
      return c;
    }

    updateVehicle(vehicleId, patch) {
      const v = this.state.vehicles.find(item => item.id === vehicleId || item.plate === vehicleId);
      if (!v) return null;

      Object.assign(v, patch);
      this.notify('VEHICLE_UPDATED', v);
      return v;
    }

    addCaseLog(caseId, actionText, user) {
      const c = this.state.cases.find(item => item.id === caseId || item.code === caseId);
      if (!c) return;
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      c.logs = c.logs || [];
      c.logs.unshift({
        time: timeStr,
        user: user || this.currentUser?.id || 'Hệ thống',
        action: actionText
      });
      this.notify('CASE_LOG_ADDED', { caseId, actionText });
    }

    addAuditLog(actionText, user) {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const logEntry = {
        id: `LOG-${Date.now()}`,
        time: timeStr,
        user: user || this.currentUser?.id || 'Hệ thống',
        action: actionText
      };
      this.state.auditLogs = this.state.auditLogs || [];
      this.state.auditLogs.unshift(logEntry);
      this.notify('AUDIT_LOG_ADDED', logEntry);
    }

    updateCasePatient(caseId, patientPatch) {
      const c = this.state.cases.find(item => item.id === caseId || item.code === caseId);
      if (!c) return null;
      c.patient = c.patient || {};
      Object.assign(c.patient, patientPatch);
      if (patientPatch.symptom && c.incident) {
        c.incident.description = patientPatch.symptom;
      }
      this.addCaseLog(caseId, `Cập nhật thông tin bệnh nhân: ${c.patient.name || 'Bệnh nhân'}`);
      this.notify('PATIENT_UPDATED', { caseId, patient: c.patient, vehiclePlate: c.dispatch?.vehiclePlate });
      return c;
    }

    resetAllData() {
      localStorage.removeItem(STORAGE_KEY_STATE);
      sessionStorage.removeItem(STORAGE_KEY_STATE);
      sessionStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      window.location.reload();
    }
  }

  window.StateManager = new StateManager();
})(window);
