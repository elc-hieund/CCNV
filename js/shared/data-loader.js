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
    }

    async init() {
      // Check session storage first or fetch data.json
      let cached = sessionStorage.getItem(STORAGE_KEY_STATE);
      if (cached) {
        try {
          this.state = JSON.parse(cached);
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

      // Initialize current user
      const savedUser = sessionStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (savedUser && this.state.accounts.some(a => a.id === savedUser)) {
        this.currentUser = this.state.accounts.find(a => a.id === savedUser);
      } else {
        // Default to dispatcher 01
        this.currentUser = this.state.accounts[0];
        sessionStorage.setItem(STORAGE_KEY_CURRENT_USER, this.currentUser.id);
      }

      window.appState = this.state;
      window.currentUser = this.currentUser;
      this.notify('INIT', this.state);
      return this.state;
    }

    saveToSession() {
      try {
        sessionStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(this.state));
      } catch (e) {
        console.warn('Session storage save warning:', e);
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

    resetAllData() {
      sessionStorage.removeItem(STORAGE_KEY_STATE);
      sessionStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      window.location.reload();
    }
  }

  window.StateManager = new StateManager();
})(window);
