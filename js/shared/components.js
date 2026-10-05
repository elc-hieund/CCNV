/**
 * CCNV STANDARDIZED UI COMPONENTS & ICON SET
 * Provides clean SVGs (Lucide style, 2px stroke, no emoji icons),
 * Toasts, Modals, Drawers, Badges, and Notification Sound synthesizers.
 */

(function (window) {
  'use strict';

  // --- 1. STANDARDIZED LUCIDE SVG ICONS ---
  const ICONS = {
    cross: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/></svg>`,
    ambulance: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10h4"/><path d="M19 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-.73-1.54L19 7h-5v10h5z"/><path d="M14 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/><circle cx="8" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>`,
    map: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
    phone: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    phoneCall: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    hospital: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M10 9h4"/><path d="M12 7v4"/></svg>`,
    list: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    calendar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    barChart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
    database: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    bell: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    alertTriangle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    camera: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
    radio: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>`,
    search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    fileText: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    check: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    x: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    activity: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    navigation: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`,
    eye: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    layers: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  // --- 2. AUDIO SYNTHESIZER (No external MP3 files needed) ---
  const SoundFx = {
    playEmergencyTone() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch (e) {
        // Audio policy ignore
      }
    },
    playBeep() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch (e) {}
    }
  };

  // --- 3. TOAST SYSTEM ---
  const Toast = {
    show(title, desc = '', isEmergency = false, duration = 4000) {
      // Disabled toast notifications across all screens per user request
      return;
    }
  };

  // --- 4. BADGE GENERATORS ---
  const Badges = {
    forCaseStatus(status) {
      switch (status) {
        case 'DISPATCHED':
          return `<span class="badge badge-moving">ĐÃ ĐIỀU ĐỘNG</span>`;
        case 'TRANSPORTING':
          return `<span class="badge badge-emergency">ĐANG VẬN CHUYỂN</span>`;
        case 'COMPLETED':
          return `<span class="badge badge-normal">HOÀN TẤT</span>`;
        case 'CANCELLED':
          return `<span class="badge badge-maintenance">ĐÃ HỦY</span>`;
        default:
          return `<span class="badge badge-normal">${status}</span>`;
      }
    },
    forVehicleStatus(status) {
      switch (status) {
        case 'READY':
          return `<span class="badge badge-ready">SẴN SÀNG</span>`;
        case 'DISPATCHING':
          return `<span class="badge badge-moving">ĐANG ĐIỀU XE</span>`;
        case 'EMERGENCY':
          return `<span class="badge badge-emergency">ĐANG CẤP CỨU</span>`;
        case 'MAINTENANCE':
          return `<span class="badge badge-maintenance">BẢO TRÌ</span>`;
        default:
          return `<span class="badge badge-normal">${status}</span>`;
      }
    },
    forHospitalStatus(status) {
      switch (status) {
        case 'AVAILABLE':
          return `<span class="badge badge-ready">ĐANG NHẬN</span>`;
        case 'RESTRICTED':
          return `<span class="badge badge-moving">HẠN CHẾ</span>`;
        case 'SUSPENDED':
          return `<span class="badge badge-emergency">TẠM NGƯNG</span>`;
        default:
          return `<span class="badge badge-normal">${status}</span>`;
      }
    }
  };

  // --- 4. BATTERY STATUS RENDERER WITH DYNAMIC ICON & COLOR ---
  function renderBattery(batteryPct) {
    const pct = parseInt(batteryPct, 10) || 0;
    let color = '#10B981'; // Green for high (>50%)
    if (pct <= 20) {
      color = '#EF4444'; // Red for low (<=20%)
    } else if (pct <= 50) {
      color = '#F59E0B'; // Amber for medium (21-50%)
    }

    const fillWidth = Math.max(2, Math.min(10, Math.round(10 * (pct / 100))));

    return `
      <span style="display:inline-flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:12px;color:${color};font-weight:600;">
        <svg width="18" height="12" viewBox="0 0 22 12" fill="none" style="flex-shrink:0;">
          <rect x="0.75" y="0.75" width="17.5" height="10.5" rx="2.5" stroke="${color}" stroke-width="1.5" />
          <path d="M20 4.2V7.8" stroke="${color}" stroke-width="1.8" stroke-linecap="round" />
          <rect x="2.5" y="2.5" width="${fillWidth}" height="7" rx="1.5" fill="${color}" />
        </svg>
        <span>Pin: ${pct}%</span>
      </span>
    `;
  }

  // --- 5. REUSABLE DATA TABLE COMPONENT (SEARCH, SORT, FILTER, PAGINATION) ---
  class DataTable {
    constructor(options) {
      this.containerId = options.containerId;
      this.data = options.data || [];
      this.columns = options.columns || []; // [{ key, title, sortable: true, render: fn }]
      this.searchPlaceholder = options.searchPlaceholder || 'Tìm kiếm...';
      this.filterOptions = options.filterOptions || []; // [{ label, value, filterFn }]
      this.exportTitle = options.exportTitle || 'Dữ liệu';
      this.enableExport = options.enableExport !== undefined ? options.enableExport : (options.showExport !== undefined ? options.showExport : true);
      this.showSortSelect = options.showSortSelect !== undefined ? options.showSortSelect : (options.enableSortSelect !== undefined ? options.enableSortSelect : true);
      this.pageSize = options.pageSize || 10;
      this.currentPage = 1;
      this.searchQuery = '';
      this.currentFilter = 'ALL';
      this.selectedStatus = 'ALL';
      this.selectedCategory = 'ALL';
      this.fromDateTime = '';
      this.toDateTime = '';
      this.filterDropdownOpen = false;
      this.statusOptions = options.statusOptions || null;
      this.categoryOptions = options.categoryOptions || null;
      this.sortDirection = (options.defaultSortOrder === 'OLDEST' || options.defaultSortOrder === 'desc') ? 'OLDEST' : 'NEWEST';
      this.onRowClick = options.onRowClick || null;
      this.emptyText = options.emptyText || 'Không có ca nào hiện tại';
    }

    getAvailableStatuses() {
      if (this.statusOptions && this.statusOptions.length > 0) return this.statusOptions;
      const map = new Map();
      this.data.forEach(item => {
        const val = item.status || item.statusCode || '';
        const text = item.statusText || item.statusLabel || item.status || '';
        if (val && !map.has(val)) {
          map.set(val, text || val);
        }
      });
      if (map.size === 0) {
        return [
          { value: 'EMERGENCY', label: 'Đang cấp cứu' },
          { value: 'AVAILABLE', label: 'Sẵn sàng' },
          { value: 'BUSY', label: 'Bận' },
          { value: 'COMPLETED', label: 'Hoàn tất' }
        ];
      }
      return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
    }

    getAvailableCategories() {
      if (this.categoryOptions && this.categoryOptions.length > 0) return this.categoryOptions;
      const set = new Set();
      this.data.forEach(item => {
        const val = item.category || item.typeName || item.type || item.classification || item.role || item.priorityText;
        if (val) set.add(val);
      });
      if (set.size === 0) {
        return [
          { value: 'Tai nạn giao thông', label: 'Tai nạn giao thông' },
          { value: 'Cấp cứu nội khoa', label: 'Cấp cứu nội khoa' },
          { value: 'Chấn thương', label: 'Chấn thương' },
          { value: 'Tư vấn y tế', label: 'Tư vấn y tế' }
        ];
      }
      return Array.from(set).map(c => ({ value: c, label: c }));
    }

    getItemTimestamp(item) {
      const raw = item.timestamp || item.createdAt || item.time || item.date || item.lastUpdate;
      if (!raw) return null;
      if (typeof raw === 'number') return raw;

      if (typeof raw === 'string') {
        let d = new Date(raw);
        if (!isNaN(d.getTime())) return d.getTime();

        const match = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const year = parseInt(match[3], 10);

          let hour = 0, min = 0, sec = 0;
          const timeMatch = raw.match(/(\d{1,2}):(\d{1,2})(:(\d{1,2}))?/);
          if (timeMatch) {
            hour = parseInt(timeMatch[1], 10);
            min = parseInt(timeMatch[2], 10);
            if (timeMatch[4]) sec = parseInt(timeMatch[4], 10);
          }
          return new Date(year, month, day, hour, min, sec).getTime();
        }
      }
      return null;
    }

    render() {
      const container = typeof this.containerId === 'string' ? document.getElementById(this.containerId) : this.containerId;
      if (!container) return;

      // 1. Process Filter & Search
      let filtered = [...this.data];

      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase().trim();
        filtered = filtered.filter(item => {
          return Object.values(item).some(val => {
            if (val === null || val === undefined) return false;
            if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(q);
            return String(val).toLowerCase().includes(q);
          });
        });
      }

      if (this.currentFilter !== 'ALL') {
        const opt = this.filterOptions.find(f => f.value === this.currentFilter);
        if (opt && typeof opt.filterFn === 'function') {
          filtered = filtered.filter(opt.filterFn);
        }
      }

      // 1b. Filter by Status
      if (this.selectedStatus && this.selectedStatus !== 'ALL') {
        filtered = filtered.filter(item => {
          return item.status === this.selectedStatus ||
                 item.statusText === this.selectedStatus ||
                 item.statusCode === this.selectedStatus ||
                 item.statusLabel === this.selectedStatus;
        });
      }

      // 1c. Filter by Classification (Phân loại)
      if (this.selectedCategory && this.selectedCategory !== 'ALL') {
        filtered = filtered.filter(item => {
          return item.category === this.selectedCategory ||
                 item.typeName === this.selectedCategory ||
                 item.type === this.selectedCategory ||
                 item.classification === this.selectedCategory ||
                 item.role === this.selectedCategory ||
                 item.priorityText === this.selectedCategory ||
                 item.priority === this.selectedCategory;
        });
      }

      // 1d. Filter by Date - Time (ngày - giờ)
      if (this.fromDateTime) {
        const fromTs = new Date(this.fromDateTime).getTime();
        if (!isNaN(fromTs)) {
          filtered = filtered.filter(item => {
            const itemTs = this.getItemTimestamp(item);
            return itemTs ? itemTs >= fromTs : true;
          });
        }
      }
      if (this.toDateTime) {
        const toTs = new Date(this.toDateTime).getTime();
        if (!isNaN(toTs)) {
          filtered = filtered.filter(item => {
            const itemTs = this.getItemTimestamp(item);
            return itemTs ? itemTs <= toTs : true;
          });
        }
      }

      // 2. Sort by Newest / Oldest
      filtered.sort((a, b) => {
        const valA = a.time || a.createdAt || a.lastUpdate || a.code || a.id || a.plate || '';
        const valB = b.time || b.createdAt || b.lastUpdate || b.code || b.id || b.plate || '';
        if (this.sortDirection === 'OLDEST') {
          return String(valA).localeCompare(String(valB), 'vi', { numeric: true });
        } else {
          return String(valB).localeCompare(String(valA), 'vi', { numeric: true });
        }
      });

      const totalItems = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / this.pageSize));
      if (this.currentPage > totalPages) this.currentPage = totalPages;
      if (this.currentPage < 1) this.currentPage = 1;

      const startIndex = (this.currentPage - 1) * this.pageSize;
      const endIndex = Math.min(startIndex + this.pageSize, totalItems);
      const pageItems = filtered.slice(startIndex, endIndex);

      const hasActiveFilters = (this.selectedStatus && this.selectedStatus !== 'ALL') ||
                               (this.selectedCategory && this.selectedCategory !== 'ALL') ||
                               !!this.fromDateTime || !!this.toDateTime;

      const availableStatuses = this.getAvailableStatuses();
      const availableCategories = this.getAvailableCategories();

      // 3. Render HTML
      container.innerHTML = `
        <div class="data-table-container">
          <!-- Toolbar -->
          <div class="table-toolbar">
            <div class="table-toolbar-left">
              <!-- Filter Dropdown Popover Wrapper -->
              <div class="filter-dropdown-wrapper">
                <button type="button" class="btn-table-filter ${this.filterDropdownOpen ? 'active' : ''} ${hasActiveFilters ? 'has-filter' : ''}" id="${this.containerId}-btn-filter">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                  <span>Bộ lọc</span>
                  ${hasActiveFilters ? '<span class="filter-active-dot"></span>' : ''}
                </button>

                <!-- Filter Popover Dropdown Panel -->
                <div class="filter-dropdown-popover ${this.filterDropdownOpen ? 'show' : ''}" id="${this.containerId}-filter-popover">
                  <!-- 1. Trạng thái -->
                  <div class="filter-group">
                    <label class="filter-group-label">Trạng thái</label>
                    <div class="filter-select-wrapper">
                      <select class="filter-control-select" id="${this.containerId}-filter-status">
                        <option value="ALL">Tất cả trạng thái</option>
                        ${availableStatuses.map(s => `<option value="${s.value}" ${this.selectedStatus === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                      </select>
                    </div>
                  </div>

                  <!-- 2. Chọn thời gian: ngày - giờ -->
                  <div class="filter-group">
                    <label class="filter-group-label">Khoảng thời gian (ngày - giờ)</label>
                    <div class="filter-datetime-range">
                      <div class="filter-datetime-field">
                        <span class="filter-datetime-icon">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                        </span>
                        <input type="datetime-local" class="filter-control-datetime" id="${this.containerId}-filter-from" value="${this.fromDateTime || ''}" title="Từ ngày - giờ" />
                      </div>
                      <span class="filter-datetime-sep">—</span>
                      <div class="filter-datetime-field">
                        <input type="datetime-local" class="filter-control-datetime" id="${this.containerId}-filter-to" value="${this.toDateTime || ''}" title="Đến ngày - giờ" />
                      </div>
                    </div>
                  </div>

                  <!-- 3. Phân loại -->
                  <div class="filter-group">
                    <label class="filter-group-label">Phân loại</label>
                    <div class="filter-select-wrapper">
                      <select class="filter-control-select" id="${this.containerId}-filter-category">
                        <option value="ALL">Tất cả phân loại</option>
                        ${availableCategories.map(c => `<option value="${c.value}" ${this.selectedCategory === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
                      </select>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="filter-popover-footer">
                    <button type="button" class="btn-filter-reset" id="${this.containerId}-popover-reset">Đặt lại</button>
                    <button type="button" class="btn-filter-apply" id="${this.containerId}-popover-apply">Áp dụng</button>
                  </div>
                </div>
              </div>

              <div class="table-search-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="${this.containerId}-search-input" value="${this.searchQuery}" placeholder="${this.searchPlaceholder}" />
              </div>

              ${this.showSortSelect ? `
              <select class="table-select-filter" id="${this.containerId}-select-sort">
                <option value="NEWEST" ${this.sortDirection === 'NEWEST' ? 'selected' : ''}>Mới nhất</option>
                <option value="OLDEST" ${this.sortDirection === 'OLDEST' ? 'selected' : ''}>Cũ nhất</option>
              </select>
              ` : ''}

              <button class="btn-table-action" id="${this.containerId}-btn-reset" title="Đặt lại bộ lọc">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                  <path d="M21 3v5h-5"></path>
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                  <path d="M3 21v-5h5"></path>
                </svg>
                <span>Đặt lại</span>
              </button>
            </div>

            <div class="table-toolbar-right">
              ${this.enableExport ? `
              <button class="btn-table-action" id="${this.containerId}-btn-export">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Xuất Excel</span>
              </button>
              ` : ''}
            </div>
          </div>

          <!-- Table Content -->
          <div class="table-scroll-wrapper">
            <table class="command-table">
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">STT</th>
                  ${this.columns.map(col => `
                    <th style="${col.width ? `width:${col.width};` : ''}">
                      <span>${col.title}</span>
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${pageItems.length === 0 ? `
                  <tr>
                    <td colspan="${this.columns.length + 1}" style="text-align: center; padding: 42px 20px; color: var(--text-muted);">
                      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
                        <span style="font-size:20px;opacity:0.6;">📋</span>
                        <span style="font-size:13.5px;color:var(--text-slate);font-weight:500;">${this.emptyText || 'Không có ca nào hiện tại'}</span>
                      </div>
                    </td>
                  </tr>
                ` : pageItems.map((item, rowIdx) => {
                  const stt = startIndex + rowIdx + 1;
                  return `
                    <tr data-row-index="${startIndex + rowIdx}">
                      <td style="text-align: center; color: #88A2BC; font-weight: 500;">${stt}</td>
                      ${this.columns.map(col => {
                        let cellContent = item[col.key];
                        if (typeof col.render === 'function') {
                          cellContent = col.render(item, cellContent, rowIdx);
                        } else if (cellContent === undefined || cellContent === null) {
                          cellContent = '—';
                        }
                        return `<td>${cellContent}</td>`;
                      }).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Pagination Footer -->
          <div class="table-pagination-footer">
            <div class="pagination-info-left">
              <span class="total-count-text">
                Hiển thị ${totalItems > 0 ? startIndex + 1 : 0} – ${endIndex} / ${totalItems} sự kiện
              </span>
              <span class="last-update-text">
                Cập nhật gần nhất: ${new Date().toLocaleTimeString('vi-VN')} 02/10/2026
              </span>
            </div>

            <div class="pagination-controls-right">
              <div class="page-size-selector">
                <select id="${this.containerId}-page-size-select">
                  <option value="5" ${this.pageSize === 5 ? 'selected' : ''}>5/trang</option>
                  <option value="10" ${this.pageSize === 10 ? 'selected' : ''}>10/trang</option>
                  <option value="20" ${this.pageSize === 20 ? 'selected' : ''}>20/trang</option>
                  <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50/trang</option>
                </select>
              </div>

              <div class="pagination-nav">
                <button class="page-btn" id="${this.containerId}-btn-prev" ${this.currentPage <= 1 ? 'disabled' : ''}>&lt;</button>
                ${this.renderPaginationButtons(totalPages)}
                <button class="page-btn" id="${this.containerId}-btn-next" ${this.currentPage >= totalPages ? 'disabled' : ''}>&gt;</button>
              </div>

              <div class="page-jump-box">
                <span>Tới trang</span>
                <input type="number" id="${this.containerId}-jump-input" min="1" max="${totalPages}" value="${this.currentPage}" />
              </div>
            </div>
          </div>
        </div>
      `;

      this.bindEvents(container, totalPages);
    }

    renderPaginationButtons(totalPages) {
      let buttonsHtml = '';
      const current = this.currentPage;

      // Smart pagination window
      let pages = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        if (current <= 4) {
          pages = [1, 2, 3, 4, 5, '...', totalPages];
        } else if (current >= totalPages - 3) {
          pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
          pages = [1, '...', current - 1, current, current + 1, '...', totalPages];
        }
      }

      pages.forEach(p => {
        if (p === '...') {
          buttonsHtml += `<span style="padding: 0 4px; color: #64748B;">...</span>`;
        } else {
          buttonsHtml += `
            <button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}">
              ${p}
            </button>
          `;
        }
      });
      return buttonsHtml;
    }

    bindEvents(container, totalPages) {
      // 1. Search Box
      const searchInput = container.querySelector(`#${this.containerId}-search-input`);
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value;
          this.currentPage = 1;
          this.render();
          // Maintain focus
          const nextInput = document.getElementById(`${this.containerId}-search-input`);
          if (nextInput) {
            nextInput.focus();
            nextInput.selectionStart = nextInput.selectionEnd = nextInput.value.length;
          }
        });
      }

      // 2. Sort Select (Mới nhất / Cũ nhất)
      const sortSelect = container.querySelector(`#${this.containerId}-select-sort`);
      if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
          this.sortDirection = e.target.value;
          this.currentPage = 1;
          this.render();
        });
      }

      // Filter button (toggle popover)
      const filterBtn = container.querySelector(`#${this.containerId}-btn-filter`);
      const filterPopover = container.querySelector(`#${this.containerId}-filter-popover`);

      if (filterBtn && filterPopover) {
        filterBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = filterPopover.classList.contains('show');
          if (isOpen) {
            filterPopover.classList.remove('show');
            filterBtn.classList.remove('active');
            this.filterDropdownOpen = false;
          } else {
            // Close any other open popovers
            document.querySelectorAll('.filter-dropdown-popover.show').forEach(p => p.classList.remove('show'));
            document.querySelectorAll('.btn-table-filter.active').forEach(b => b.classList.remove('active'));
            filterPopover.classList.add('show');
            filterBtn.classList.add('active');
            this.filterDropdownOpen = true;
          }
        });

        filterPopover.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        const popoverApply = filterPopover.querySelector(`#${this.containerId}-popover-apply`);
        if (popoverApply) {
          popoverApply.addEventListener('click', () => {
            const stSel = filterPopover.querySelector(`#${this.containerId}-filter-status`);
            const catSel = filterPopover.querySelector(`#${this.containerId}-filter-category`);
            const fromInp = filterPopover.querySelector(`#${this.containerId}-filter-from`);
            const toInp = filterPopover.querySelector(`#${this.containerId}-filter-to`);

            if (stSel) this.selectedStatus = stSel.value;
            if (catSel) this.selectedCategory = catSel.value;
            if (fromInp) this.fromDateTime = fromInp.value;
            if (toInp) this.toDateTime = toInp.value;

            this.currentPage = 1;
            this.filterDropdownOpen = false;
            this.render();
          });
        }

        const popoverReset = filterPopover.querySelector(`#${this.containerId}-popover-reset`);
        if (popoverReset) {
          popoverReset.addEventListener('click', () => {
            this.selectedStatus = 'ALL';
            this.selectedCategory = 'ALL';
            this.fromDateTime = '';
            this.toDateTime = '';
            this.currentPage = 1;
            this.filterDropdownOpen = false;
            this.render();
          });
        }
      }

      // Close popover when clicking outside
      if (!window._ccnv_filter_click_bound) {
        document.addEventListener('click', (e) => {
          const openPopover = document.querySelector('.filter-dropdown-popover.show');
          if (openPopover && !openPopover.contains(e.target)) {
            const wrapper = openPopover.closest('.filter-dropdown-wrapper');
            const btn = wrapper?.querySelector('.btn-table-filter');
            if (btn && !btn.contains(e.target)) {
              openPopover.classList.remove('show');
              btn.classList.remove('active');
            }
          }
        });
        window._ccnv_filter_click_bound = true;
      }

      // 3. Reset Button (top toolbar)
      const resetBtn = container.querySelector(`#${this.containerId}-btn-reset`);
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.searchQuery = '';
          this.currentFilter = 'ALL';
          this.selectedStatus = 'ALL';
          this.selectedCategory = 'ALL';
          this.fromDateTime = '';
          this.toDateTime = '';
          this.sortDirection = 'NEWEST';
          this.currentPage = 1;
          this.filterDropdownOpen = false;
          this.render();
        });
      }

      // 4. Export Excel Mock
      const exportBtn = container.querySelector(`#${this.containerId}-btn-export`);
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          window.CCNV_UI.Toast.show('Xuất tệp Excel thành công', `Đã xuất danh sách [${this.exportTitle}] ra tệp .xlsx`);
        });
      }

      // 6. Pagination Navigation Buttons
      container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          const page = parseInt(btn.getAttribute('data-page'), 10);
          if (page && page !== this.currentPage) {
            this.currentPage = page;
            this.render();
          }
        });
      });

      container.querySelector(`#${this.containerId}-btn-prev`)?.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.render();
        }
      });

      container.querySelector(`#${this.containerId}-btn-next`)?.addEventListener('click', () => {
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.render();
        }
      });

      // 7. Page Size Select
      container.querySelector(`#${this.containerId}-page-size-select`)?.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value, 10);
        this.currentPage = 1;
        this.render();
      });

      // 8. Jump to Page
      const jumpInput = container.querySelector(`#${this.containerId}-jump-input`);
      if (jumpInput) {
        jumpInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const page = parseInt(jumpInput.value, 10);
            if (page >= 1 && page <= totalPages) {
              this.currentPage = page;
              this.render();
            }
          }
        });
      }

      // 9. Row Click
      if (typeof this.onRowClick === 'function') {
        container.querySelectorAll('tbody tr[data-row-index]').forEach(tr => {
          tr.style.cursor = 'pointer';
          tr.addEventListener('click', () => {
            const idx = parseInt(tr.getAttribute('data-row-index'), 10);
            const item = this.data[idx];
            if (item) this.onRowClick(item, idx);
          });
        });
      }
    }

    setData(newData) {
      this.data = newData || [];
      this.render();
    }
  }

  window.CCNV_UI = {
    ICONS,
    SoundFx,
    Toast,
    Badges,
    DataTable,
    renderBattery
  };

})(window);
