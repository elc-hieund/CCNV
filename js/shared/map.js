/**
 * CCNV REAL-WORLD GIS COMMAND CENTER MAP VIEW — TP. CẦN THƠ
 * - Overview: toàn bộ xe (xanh lá), bệnh viện tiếp nhận (xanh nước biển), hiện trường (đỏ + rung)
 * - Focus: chọn 1 xe → ẩn đối tượng khác, hiện lộ trình xe → hiện trường → bệnh viện đích
 * - Xe di chuyển mượt bằng requestAnimationFrame, bám đường thật qua OSRM (fallback đường thẳng)
 */

(function (window) {
  'use strict';

  const CITY_CENTER = [10.0335, 105.7725];
  const CITY_ZOOM = 14;
  const SIM_SPEED_MPS = 55;        // Tốc độ mô phỏng trên bản đồ (m/s) — chậm, mượt
  const PICKUP_PAUSE_MS = 3000;    // Dừng tại hiện trường đón bệnh nhân
  const ARRIVED_PAUSE_MS = 5000;   // Dừng tại bệnh viện trước khi chạy lại demo
  const INACTIVE_STATUSES = ['COMPLETED', 'CANCELLED', 'CLOSED'];

  // Vị trí trực / xuất phát của xe (đã tinh chỉnh tránh chồng lấn). Fallback: vehicle.coords
  const VEH_COORDS = {
    '65A-012.34': [10.0105, 105.7700],      // Kíp 3 - Trạm Cái Răng (xuất phát ca Cầu Hưng Lợi)
    '65A-011.15': [10.0395, 105.7800],      // Trạm Cấp cứu Trung tâm
    '65A-016.88': [10.0298, 105.7685],      // Chốt ĐH Cần Thơ
    '65A-010.02': [10.0215, 105.7850],      // KDC Hưng Phú
    '65A-018.89': [10.0580, 105.7460],      // Trục Võ Văn Kiệt
    '65A-019.99': [10.0880, 105.7050]       // Trạm Ô Môn
  };

  // Bảng mã màu khẩn cấp bệnh viện
  const EMERGENCY_CODES = [
    { key: 'BLUE', color: '#3b82f6', desc: 'Cấp cứu y tế: ngừng tim, ngừng thở, đột quỵ, tụt huyết áp nặng', note: 'Phổ biến nhất. Trẻ em dùng Pink' },
    { key: 'PINK', color: '#ec4899', desc: 'Cấp cứu y tế ở trẻ em', note: 'Biến thể của Blue' },
    { key: 'RED', color: '#ef4444', desc: 'Lửa, khói, nguy cơ cháy nổ', note: 'R.A.C.E: Remove, Alert, Contain, Evacuate' },
    { key: 'BLACK', color: '#111827', desc: 'Đe dọa bom, bưu kiện khả nghi, mối đe dọa đối với bệnh viện', note: '' },
    { key: 'WHITE', color: '#f8fafc', desc: 'Đối tượng bạo hành vượt khả năng kiểm soát', note: '3 cấp: lời nói thô bạo; đe dọa dùng vũ lực; hành hung' },
    { key: 'YELLOW', color: '#facc15', desc: 'Nhân viên hoặc người bệnh đi lạc, mất tích', note: 'Trẻ em dùng Amber' },
    { key: 'BROWN', color: '#a16207', desc: 'Tràn, rò rỉ, nhiễm bẩn chất không xác định', note: 'Một số nơi dùng Orange' },
    { key: 'GREEN', color: '#22c55e', desc: 'Khu vực không an toàn, cần sơ tán', note: '' },
    { key: 'ORANGE', color: '#f97316', desc: 'Thảm họa bên ngoài bệnh viện', note: 'Một số nơi dùng Brown' },
    { key: 'GREY', color: '#9ca3af', desc: 'Mất tiện ích (điện, nước, viễn thông)', note: 'Một số nơi dùng cho hành vi bạo lực, đe dọa' }
  ];
  const CODE_BY_KEY = Object.fromEntries(EMERGENCY_CODES.map(c => [c.key, c]));

  // Ánh xạ loại sự cố → mã màu
  function emergencyCodeFor(c) {
    const victims = c.victimCount || (Array.isArray(c.patients) ? c.patients.length : 1);
    if (victims >= 3) return CODE_BY_KEY.ORANGE;
    if (c.incident?.code === 'INC_PEDIATRIC') return CODE_BY_KEY.PINK;
    return CODE_BY_KEY.BLUE;
  }

  // --- Routing (OSRM, cache dùng chung giữa các lần render) ---
  const routeCache = new Map();
  async function fetchRoadRoute(a, b) {
    const key = `${a.join(',')};${b.join(',')}`;
    if (routeCache.has(key)) return routeCache.get(key);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const url = `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      const json = await res.json();
      const pts = json.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const route = [a, ...pts, b];
      routeCache.set(key, route);
      return route;
    } catch (e) {
      console.warn('OSRM routing unavailable, fallback to straight line:', e);
      return [a, b];
    }
  }

  function buildPath(points) {
    const ll = points.map(p => window.L.latLng(p));
    const cum = [0];
    for (let i = 1; i < ll.length; i++) cum.push(cum[i - 1] + ll[i - 1].distanceTo(ll[i]));
    return { ll, cum, total: cum[cum.length - 1] };
  }

  function pointAt(path, d) {
    const last = path.ll.length - 1;
    if (d <= 0 || last === 0) return { latlng: path.ll[0], idx: 0 };
    if (d >= path.total) return { latlng: path.ll[last], idx: last };
    let lo = 0, hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (path.cum[mid] <= d) lo = mid; else hi = mid;
    }
    const seg = path.cum[hi] - path.cum[lo];
    const t = seg ? (d - path.cum[lo]) / seg : 0;
    const a = path.ll[lo], b = path.ll[hi];
    return { latlng: window.L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t), idx: lo };
  }

  // Tiến trình xe được giữ qua các lần re-render (theo mã ca)
  const missionProgress = {};

  function initialPhase(status) {
    if (['LEAVING_SCENE', 'LEFT_SCENE'].includes(status)) return 'TO_HOSP';
    return 'TO_SCENE';
  }

  class CanThoMap {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.options = options;
      this.map = null;
      this.vehicleMarkers = {};
      this.hospitalMarkers = {};
      this.incidentMarkers = {};
      this.missions = {};          // caseId → mission
      this.focusPlate = null;
      this.focusLayer = null;
      this.focusLines = null;
      this.rafId = null;
      this.lastTs = 0;
      this.lastRouteRedraw = 0;
      this.lastSpeedUpdate = 0;
      this._tick = this.tick.bind(this);
    }

    render() {
      const container = document.getElementById(this.containerId);
      if (!container) return;

      const state = window.StateManager ? window.StateManager.getState() : (window.appState || window.SEED_DATA);
      if (!state) return;

      if (window.L) {
        this.renderLeafletMap(container, state);
      } else {
        container.innerHTML = `
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#071522;color:#64748B;">
            <span>Đang kết nối bản đồ số TP. Cần Thơ...</span>
          </div>`;
      }
    }

    renderLegendHtml() {
      const infoIcon = (window.CCNV_UI && window.CCNV_UI.ICONS && window.CCNV_UI.ICONS.info)
        ? window.CCNV_UI.ICONS.info
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

      return `
        <div class="map-top-right-controls">
          <div class="map-unified-cluster">
            <button type="button" class="map-unified-btn map-legend-info-btn" id="btn-map-legend-info" title="Xem chú thích bản đồ" aria-expanded="false" aria-label="Chú thích bản đồ">
              ${infoIcon}
            </button>
            <button type="button" class="map-unified-btn" id="btn-map-zoom-in" title="Phóng to (+)" aria-label="Phóng to">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button type="button" class="map-unified-btn" id="btn-map-zoom-out" title="Thu nhỏ (-)" aria-label="Thu nhỏ">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="map-tactical-legend is-collapsed" id="map-tactical-legend" hidden>
          <div class="legend-header">
            <div class="legend-title">CHÚ THÍCH</div>
            <button type="button" class="legend-close-btn" id="btn-map-legend-close" title="Đóng chú thích" style="display:flex;align-items:center;justify-content:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="legend-item"><span class="legend-dot" style="--c:#10b981;"></span><span>Xe cứu thương</span></div>
          <div class="legend-item"><span class="legend-dot" style="--c:#38bdf8;"></span><span>Bệnh viện tiếp nhận</span></div>
          <div class="legend-item"><span class="legend-dot legend-dot-pulse" style="--c:#ef4444;"></span><span>Hiện trường sự cố</span></div>
          <div class="legend-item"><span class="legend-line legend-line-dashed"></span><span>Lộ trình đến hiện trường</span></div>
          <div class="legend-item"><span class="legend-line"></span><span>Lộ trình về bệnh viện</span></div>
          <button type="button" class="legend-toggle" id="btn-map-legend-codes" aria-expanded="false">
            <span>Mã màu khẩn cấp</span><span class="legend-caret">▾</span>
          </button>
          <div class="legend-codes" id="map-legend-codes" hidden>
            ${EMERGENCY_CODES.map(c => `
              <div class="legend-code-row">
                <span class="legend-code-swatch" style="--c:${c.color};"></span>
                <div>
                  <div class="legend-code-name">Code ${c.key.charAt(0)}${c.key.slice(1).toLowerCase()}</div>
                  <div class="legend-code-desc">${c.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    renderLeafletMap(container, state) {
      const rootId = `leaflet-root-${this.containerId}`;
      container.innerHTML = `
        <div id="${rootId}" style="width:100%;height:100%;background:#050d17;"></div>
        ${this.renderLegendHtml()}
      `;

      this.map = window.L.map(rootId, {
        center: CITY_CENTER,
        zoom: CITY_ZOOM,
        minZoom: 11,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: true
      });
      this.initTopRightControls(container);

      window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, DeLorme, NAVTEQ · Routing © OSRM',
        maxNativeZoom: 16,
        maxZoom: 18
      }).addTo(this.map);
      window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        attribution: '',
        maxNativeZoom: 16,
        maxZoom: 18
      }).addTo(this.map);

      this.focusLayer = window.L.layerGroup().addTo(this.map);

      const hospitals = state.hospitals || [];
      const vehicles = state.vehicles || [];
      const activeCases = (state.cases || []).filter(c =>
        !INACTIVE_STATUSES.includes(c.status) && c.dispatch?.vehiclePlate && c.location?.coords
      );

      // 1. Missions (ca đang hoạt động gắn với xe)
      activeCases.forEach(c => {
        const veh = vehicles.find(v => v.plate === c.dispatch.vehiclePlate);
        const hosp = hospitals.find(h => h.id === c.dispatch.hospitalId) || hospitals[0];
        if (!veh || !hosp) return;
        if (!missionProgress[c.id]) {
          missionProgress[c.id] = { phase: initialPhase(c.status), dist: 0, pauseUntil: 0 };
        }
        this.missions[c.id] = {
          caseId: c.id,
          caseData: c,
          plate: veh.plate,
          hospId: hosp.id,
          hosp,
          origin: VEH_COORDS[veh.plate] || veh.coords || CITY_CENTER,
          scene: c.location.coords,
          code: emergencyCodeFor(c),
          leg1: null,
          leg2: null,
          pos: null,
          progress: missionProgress[c.id]
        };
      });

      // 2. Hospitals (xanh nước biển, Bệnh viện Đa khoa thành phố Cần Thơ làm nổi bật vì là trung tâm)
      hospitals.forEach(h => {
        const coords = h.coords || CITY_CENTER;
        const isRestricted = h.status === 'RESTRICTED';
        const isCenter = h.isCenter || h.id === 'HOSP_BVDK' || h.name?.includes('Đa khoa thành phố Cần Thơ') || h.name?.includes('Đa khoa TP Cần Thơ');
        const statusLabel = h.statusText || (isRestricted ? 'Hạn chế' : 'Đang nhận');
        const displayName = h.name.startsWith('BV ') ? h.name.replace(/^BV\s+/, 'Bệnh viện ') : h.name;
        const icon = window.L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-hosp-hub-badge ${isCenter ? 'is-center-hospital' : ''}">
              <div class="map-hosp-shield ${isCenter ? 'is-center' : ''} ${isRestricted ? 'restricted' : ''}">
                <div class="map-hosp-cross-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round">
                    <line x1="12" y1="4" x2="12" y2="20"></line>
                    <line x1="4" y1="12" x2="20" y2="12"></line>
                  </svg>
                </div>
                <span class="map-hosp-title-text" title="${displayName}">${displayName}</span>
                <span class="map-hosp-bed-chip" title="Trạng thái tiếp nhận cấp cứu">${isCenter ? 'TRUNG TÂM · ' + statusLabel : statusLabel}</span>
              </div>
            </div>
          `,
          iconSize: [280, 40],
          iconAnchor: [140, 20]
        });
        const marker = window.L.marker(coords, { icon, zIndexOffset: isCenter ? 250 : 100 }).addTo(this.map);
        marker.bindPopup(this.createHospitalPopupHtml(h), { autoPan: false });
        marker.on('click', () => this.onHospitalSelect?.(h.id));
        this.hospitalMarkers[h.id] = { marker, data: h };
      });

      // 3. Incidents (đỏ + rung + nhãn mã màu)
      Object.values(this.missions).forEach(m => {
        const c = m.caseData;
        const shortName = (c.incident?.name || 'Cấp cứu').split('/')[0].trim().toUpperCase();
        const icon = window.L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-incident-beacon-container">
              <div class="map-incident-radar-rings">
                <div class="ring"></div><div class="ring"></div><div class="ring"></div>
              </div>
              <div class="map-incident-shake">
                <div class="map-incident-banner">
                  <span class="map-incident-code" style="--code-color:${m.code.color};">CODE ${m.code.key}</span>
                  <span>${shortName}</span>
                  ${c.eta ? `<span class="map-incident-eta">ETA ${c.eta}</span>` : ''}
                </div>
              </div>
            </div>
          `,
          iconSize: [300, 40],
          iconAnchor: [150, 20]
        });
        const marker = window.L.marker(m.scene, { icon, zIndexOffset: 500 }).addTo(this.map);
        marker.bindPopup(this.createIncidentPopupHtml(m), { autoPan: false });
        marker.on('click', () => this.onIncidentSelect?.(m.caseId));
        this.incidentMarkers[m.caseId] = { marker, mission: m };
      });

      // 4. Vehicles (xanh lá)
      vehicles.forEach(v => {
        const mission = this.missionByPlate(v.plate);
        const startCoords = mission
          ? (mission.progress.phase === 'TO_SCENE' ? mission.origin : mission.scene)
          : (v.coords || VEH_COORDS[v.plate] || CITY_CENTER);
        const icon = window.L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-veh-capsule ${mission ? 'is-mission' : ''}">
              <div class="map-veh-icon-bubble">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v9h2"></path>
                  <circle cx="7" cy="17" r="2"></circle>
                  <path d="M9 17h6"></path>
                  <circle cx="17" cy="17" r="2"></circle>
                </svg>
              </div>
              <span class="map-veh-plate">${v.plate}</span>
              <span class="map-veh-status-pill ${mission ? 'mission' : 'ready'}">${mission ? (v.speed || 50) + ' km/h' : 'Sẵn sàng'}</span>
            </div>
          `,
          iconSize: [150, 36],
          iconAnchor: [75, 18]
        });
        const marker = window.L.marker(startCoords, { icon, zIndexOffset: mission ? 1000 : 200 }).addTo(this.map);
        marker.bindPopup(() => this.createVehiclePopupHtml(v), { autoPan: false });
        marker.on('click', () => this.onVehicleSelect?.(v.plate));
        this.vehicleMarkers[v.plate] = { marker, data: v };
      });

      this.bindLegend(container);
      setTimeout(() => this.map?.invalidateSize(), 200);

      // 5. Load routes then animate
      Object.values(this.missions).forEach(m => this.loadMissionRoute(m));
      this.rafId = requestAnimationFrame(this._tick);
    }

    bindLegend(container) {
      const infoBtn = container.querySelector('#btn-map-legend-info');
      const legend = container.querySelector('#map-tactical-legend');
      const closeBtn = container.querySelector('#btn-map-legend-close');

      if (infoBtn && legend) {
        const toggleLegend = (forceOpen) => {
          const isCurrentlyHidden = legend.hasAttribute('hidden');
          const shouldOpen = forceOpen !== undefined ? forceOpen : isCurrentlyHidden;
          legend.toggleAttribute('hidden', !shouldOpen);
          legend.classList.toggle('is-collapsed', !shouldOpen);
          infoBtn.setAttribute('aria-expanded', String(shouldOpen));
          infoBtn.classList.toggle('is-active', shouldOpen);
        };

        infoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleLegend();
        });

        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLegend(false);
          });
        }

        // Close on click outside inside the map container
        document.addEventListener('click', (e) => {
          if (!legend.hasAttribute('hidden') && !legend.contains(e.target) && !infoBtn.contains(e.target)) {
            toggleLegend(false);
          }
        });

        if (window.L) {
          window.L.DomEvent.disableClickPropagation(infoBtn);
        }
      }

      const btn = container.querySelector('#btn-map-legend-codes');
      const panel = container.querySelector('#map-legend-codes');
      if (btn && panel) {
        btn.addEventListener('click', () => {
          const open = panel.hasAttribute('hidden');
          panel.toggleAttribute('hidden', !open);
          btn.setAttribute('aria-expanded', String(open));
          btn.classList.toggle('is-open', open);
        });
      }
      // Không cho thao tác trên chú thích kéo/zoom bản đồ
      if (legend && window.L) {
        window.L.DomEvent.disableClickPropagation(legend);
        window.L.DomEvent.disableScrollPropagation(legend);
      }
    }

    initTopRightControls(container) {
      const zoomInBtn = container.querySelector('#btn-map-zoom-in');
      const zoomOutBtn = container.querySelector('#btn-map-zoom-out');
      const zoomExtentBtn = container.querySelector('#btn-map-zoom-extent');

      if (zoomInBtn) {
        zoomInBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.map) this.map.zoomIn();
        });
      }

      if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.map) this.map.zoomOut();
        });
      }

      if (zoomExtentBtn) {
        zoomExtentBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!this.map) return;
          // Hủy trạng thái focus xe cụ thể nếu có để về toàn cảnh thành phố
          if (this.focusPlate) {
            this.clearFocus();
          } else {
            this.map.flyTo(CITY_CENTER, CITY_ZOOM, { duration: 0.8 });
          }
          window.CCNV_UI?.Toast?.show(
            'BẢN ĐỒ TOÀN CẢNH',
            'Đã chuyển góc nhìn về toàn cảnh TP. Cần Thơ',
            true,
            2000
          );
        });
      }

      const ctrlContainer = container.querySelector('.map-top-right-controls');
      if (ctrlContainer && window.L) {
        window.L.DomEvent.disableClickPropagation(ctrlContainer);
        window.L.DomEvent.disableScrollPropagation(ctrlContainer);
      }
    }

    async loadMissionRoute(m) {
      const [leg1, leg2] = await Promise.all([
        fetchRoadRoute(m.origin, m.scene),
        fetchRoadRoute(m.scene, m.hosp.coords)
      ]);
      if (!this.map) return; // destroyed while loading
      m.leg1 = buildPath(leg1);
      m.leg2 = buildPath(leg2);
      if (this.focusPlate === m.plate) {
        this.drawFocusRoute();
        this.fitFocus(true);
      }
    }

    missionByPlate(plate) {
      return Object.values(this.missions).find(m => m.plate === plate) || null;
    }

    // --- Animation ---
    tick(now) {
      if (!this.map) return;
      const dt = this.lastTs ? Math.min((now - this.lastTs) / 1000, 0.1) : 0;
      this.lastTs = now;

      Object.values(this.missions).forEach(m => this.advanceMission(m, dt, now));

      if (now - this.lastRouteRedraw > 200) {
        this.updateFocusRemaining();
        this.lastRouteRedraw = now;
      }
      if (now - this.lastSpeedUpdate > 2000) {
        this.updateSpeedPills();
        this.lastSpeedUpdate = now;
      }
      this.rafId = requestAnimationFrame(this._tick);
    }

    advanceMission(m, dt, now) {
      if (!m.leg1 || !m.leg2) return;
      const p = m.progress;

      if (p.pauseUntil) {
        if (now < p.pauseUntil) return;
        p.pauseUntil = 0;
        if (p.phase === 'PICKUP') {
          p.phase = 'TO_HOSP';
          p.dist = 0;
          this.applyVisibility(); // Ẩn điểm tai nạn sau 3s dừng đón
        } else if (p.phase === 'ARRIVED') {
          p.phase = 'COMPLETED';
          if (!p.completedTriggered) {
            p.completedTriggered = true;
            this.onMissionCompleted?.(m);
          }
          return;
        }
      }

      if (p.phase === 'COMPLETED') return;

      const leg = p.phase === 'TO_SCENE' ? m.leg1 : m.leg2;
      p.dist += SIM_SPEED_MPS * dt;
      if (p.dist >= leg.total) {
        p.dist = leg.total;
        if (p.phase === 'TO_SCENE') {
          p.phase = 'PICKUP';
          p.pauseUntil = now + PICKUP_PAUSE_MS;
        } else if (p.phase === 'TO_HOSP' || p.phase !== 'ARRIVED') {
          p.phase = 'ARRIVED';
          p.pauseUntil = now + 1200; // Dừng lại 1.2 giây tại bệnh viện cho quan sát viên thấy xe đã cập bến
        }
      }

      m.pos = pointAt(leg, p.dist);
      this.vehicleMarkers[m.plate]?.marker.setLatLng(m.pos.latlng);

      // Cập nhật ETA giảm dần theo khoảng cách thực tế còn lại
      this.updateMissionETA(m);
    }

    updateMissionETA(m) {
      const p = m.progress;
      let etaStr = '';

      if (p.phase === 'TO_SCENE') {
        const remainingDist = Math.max(0, (m.leg1?.total || 1800) - p.dist);
        const remSec = Math.round(remainingDist / SIM_SPEED_MPS);
        if (remSec <= 5) {
          etaStr = 'Đang tiếp cận';
        } else if (remSec < 60) {
          etaStr = `${remSec} giây`;
        } else {
          const mRemain = Math.ceil(remSec / 60);
          etaStr = `${mRemain} phút`;
        }
      } else if (p.phase === 'PICKUP') {
        etaStr = 'Đã đến điểm đón';
      } else if (p.phase === 'TO_HOSP') {
        const remainingDist = Math.max(0, (m.leg2?.total || 2200) - p.dist);
        const remSec = Math.round(remainingDist / SIM_SPEED_MPS);
        if (remSec <= 5) {
          etaStr = 'Sắp đến BV';
        } else if (remSec < 60) {
          etaStr = `${remSec} giây`;
        } else {
          const mRemain = Math.ceil(remSec / 60);
          etaStr = `${mRemain} phút`;
        }
      } else if (p.phase === 'ARRIVED') {
        etaStr = 'Đã đến BV';
      }

      m.currentEta = etaStr;

      // 1. Cập nhật thẻ ETA trực tiếp trên marker hiện trường (nếu đang hiển thị)
      const incItem = this.incidentMarkers[m.caseId];
      if (incItem?.marker) {
        const etaEl = incItem.marker.getElement()?.querySelector('.map-incident-eta');
        if (etaEl) {
          etaEl.textContent = `ETA ${etaStr}`;
        }
      }

      // 2. Cập nhật nhãn trạng thái và ETA trong thanh Strip bên dưới (Central)
      const bottomStrip = document.getElementById('realtime-bottom-strip');
      if (bottomStrip && this.focusPlate === m.plate) {
        const etaValueEl = bottomStrip.querySelector('.eta-value-live');
        if (etaValueEl) {
          etaValueEl.textContent = etaStr;
        }
      }

      // 3. Cập nhật HUD dẫn đường trên giao diện Tài xế (Driver HUD)
      const driverHudDist = document.querySelector('.nav-telemetry-row');
      if (driverHudDist && this.focusPlate === m.plate) {
        const remM = p.phase === 'TO_SCENE'
          ? Math.max(0, (m.leg1?.total || 1800) - p.dist)
          : Math.max(0, (m.leg2?.total || 2200) - p.dist);
        const kmStr = remM >= 1000 ? `${(remM / 1000).toFixed(1)} km` : `${Math.round(remM)} m`;
        const speedVal = this.vehicleMarkers[m.plate]?.data?.speed || 52;
        driverHudDist.innerHTML = `
          <span style="color:#10B981;font-weight:700;">● ${speedVal} km/h</span>
          <span style="color:#64748B;">·</span>
          <span style="color:#CBD5E1;">Còn ${kmStr}</span>
          <span style="color:#64748B;">·</span>
          <span style="color:#38BDF8;font-weight:700;">ETA ${etaStr}</span>
        `;
      }
    }

    updateSpeedPills() {
      Object.values(this.missions).forEach(m => {
        const item = this.vehicleMarkers[m.plate];
        const pill = item?.marker.getElement()?.querySelector('.map-veh-status-pill');
        if (!pill) return;
        const phase = m.progress.phase;
        if (phase === 'PICKUP') pill.textContent = 'Đón BN (3s)';
        else if (phase === 'ARRIVED' || phase === 'COMPLETED') pill.textContent = 'Đã đến BV';
        else {
          item.data.speed = Math.floor(45 + Math.random() * 12);
          pill.textContent = item.data.speed + ' km/h';
        }
      });
    }

    // --- Focus mode ---
    focusVehicle(plate, { animate = true } = {}) {
      if (!this.map || !this.vehicleMarkers[plate]) return;
      this.focusPlate = plate;
      this.map.closePopup();

      Object.entries(this.vehicleMarkers).forEach(([p, item]) => {
        item.marker.getElement()?.classList.toggle('is-active-marker', p === plate);
      });

      this.applyVisibility();
      this.drawFocusRoute();
      this.fitFocus(animate);
    }

    clearFocus() {
      if (!this.map) return;
      this.focusPlate = null;
      this.map.closePopup();
      Object.values(this.vehicleMarkers).forEach(item => item.marker.getElement()?.classList.remove('is-active-marker'));
      this.focusLayer.clearLayers();
      this.focusLines = null;
      this.applyVisibility();
      this.map.flyTo(CITY_CENTER, CITY_ZOOM, { duration: 0.8 });
    }

    applyVisibility() {
      const focus = this.focusPlate;
      const m = focus ? this.missionByPlate(focus) : null;
      const setVisible = (marker, visible) => {
        const has = this.map.hasLayer(marker);
        if (visible && !has) this.map.addLayer(marker);
        if (!visible && has) this.map.removeLayer(marker);
      };

      Object.entries(this.vehicleMarkers).forEach(([plate, item]) => setVisible(item.marker, !focus || plate === focus));
      Object.entries(this.hospitalMarkers).forEach(([id, item]) => setVisible(item.marker, !focus || (m && m.hospId === id)));

      // Marker điểm tai nạn (sự cố): Ẩn đi khi xe đã đón bệnh nhân xong (sau 3s, chuyển sang TO_HOSP hoặc ARRIVED)
      Object.entries(this.incidentMarkers).forEach(([cid, item]) => {
        const mission = item.mission || Object.values(this.missions).find(mis => mis.caseId === cid);
        const isPastPickup = mission && (mission.progress.phase === 'TO_HOSP' || mission.progress.phase === 'ARRIVED');
        const shouldShow = (!focus || (m && m.caseId === cid)) && !isPastPickup;
        setVisible(item.marker, shouldShow);
      });

      // Re-apply highlight (marker element is recreated when re-added)
      if (focus) this.vehicleMarkers[focus]?.marker.getElement()?.classList.add('is-active-marker');
    }

    drawFocusRoute() {
      this.focusLayer.clearLayers();
      this.focusLines = null;
      const m = this.focusPlate ? this.missionByPlate(this.focusPlate) : null;
      if (!m || !m.leg1 || !m.leg2) return;
      const L = window.L;

      // Toàn tuyến (mờ) — thể hiện chặng đã đi qua
      L.polyline(m.leg1.ll, { color: '#f87171', weight: 3, opacity: 0.22, dashArray: '6, 8' }).addTo(this.focusLayer);
      L.polyline(m.leg2.ll, { color: '#38bdf8', weight: 3, opacity: 0.22 }).addTo(this.focusLayer);

      // Chặng còn lại (sáng)
      this.focusLines = {
        glow1: L.polyline([], { color: '#ef4444', weight: 9, opacity: 0.25, lineCap: 'round' }).addTo(this.focusLayer),
        line1: L.polyline([], { color: '#fca5a5', weight: 3.5, opacity: 0.95, dashArray: '8, 7', lineCap: 'round' }).addTo(this.focusLayer),
        glow2: L.polyline([], { color: '#0284c7', weight: 9, opacity: 0.3, lineCap: 'round' }).addTo(this.focusLayer),
        line2: L.polyline([], { color: '#38bdf8', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(this.focusLayer)
      };
      this.updateFocusRemaining();
    }

    updateFocusRemaining() {
      if (!this.focusLines) return;
      const m = this.missionByPlate(this.focusPlate);
      if (!m || !m.leg1 || !m.leg2) return;
      const phase = m.progress.phase;
      const pos = m.pos || pointAt(phase === 'TO_SCENE' ? m.leg1 : m.leg2, m.progress.dist);
      const remaining = (leg) => [pos.latlng, ...leg.ll.slice(pos.idx + 1)];

      let rem1 = [], rem2 = [];
      if (phase === 'TO_SCENE') { rem1 = remaining(m.leg1); rem2 = m.leg2.ll; }
      else if (phase === 'PICKUP') { rem2 = m.leg2.ll; }
      else if (phase === 'TO_HOSP') { rem2 = remaining(m.leg2); }

      this.focusLines.glow1.setLatLngs(rem1);
      this.focusLines.line1.setLatLngs(rem1);
      this.focusLines.glow2.setLatLngs(rem2);
      this.focusLines.line2.setLatLngs(rem2);
    }

    fitFocus(animate = true) {
      if (!this.map || !this.focusPlate) return;
      const vehMarker = this.vehicleMarkers[this.focusPlate]?.marker;
      const m = this.missionByPlate(this.focusPlate);
      if (!vehMarker) return;

      if (!m) {
        animate ? this.map.flyTo(vehMarker.getLatLng(), 16, { duration: 0.8 }) : this.map.setView(vehMarker.getLatLng(), 16);
        return;
      }
      const pts = [vehMarker.getLatLng(), window.L.latLng(m.scene), window.L.latLng(m.hosp.coords)];
      if (m.leg1) pts.push(...m.leg1.ll, ...m.leg2.ll);
      const bounds = window.L.latLngBounds(pts);
      const opts = { paddingTopLeft: [40, 60], paddingBottomRight: [230, 40], maxZoom: 16 };
      animate ? this.map.flyToBounds(bounds, { ...opts, duration: 0.8 }) : this.map.fitBounds(bounds, opts);
    }

    // --- Popups ---
    createVehiclePopupHtml(v) {
      const m = this.missionByPlate(v.plate);
      return `
        <div style="min-width:250px;color:#cbd5e1;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e3a56;padding-bottom:6px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <strong style="color:#ffffff;font-family:var(--font-mono);font-size:14px;">${v.plate}</strong>
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${m ? '#059669' : '#047857'};color:#ffffff;font-weight:700;">
                ${m ? 'ĐANG LÀM NHIỆM VỤ' : 'SẴN SÀNG'}
              </span>
            </div>
            <span style="font-size:11px;color:#94a3b8;font-weight:600;">${v.type}</span>
          </div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:5px;">
            <div>Trạm / Chốt: <strong style="color:#ffffff;">${v.station || '—'}</strong></div>
            <div>Vận tốc GPS: <strong style="color:#fbbf24;">${m ? (v.speed || 50) + ' km/h' : '0 km/h (Đang đỗ)'}</strong></div>
            <div>Tín hiệu thiết bị: <strong style="color:#10b981;">● GPS Online</strong></div>
            ${m ? `
              <div style="background:#0f273d;padding:8px;border-radius:6px;margin-top:6px;border:1px solid rgba(56,189,248,0.3);">
                <div style="color:#f87171;font-weight:700;font-size:11px;margin-bottom:2px;display:flex;align-items:center;gap:5px;">
                  <span style="display:inline-flex;color:#f87171;">${window.CCNV_UI?.ICONS?.ambulance || ''}</span>
                  <span>${m.caseData.incident?.name || 'Ca cấp cứu'} · CODE ${m.code.key}</span>
                </div>
                <div>Hiện trường: <strong style="color:#ffffff;">${m.caseData.location?.address || '—'}</strong></div>
                <div>Điểm đến: <strong style="color:#38bdf8;">${m.hosp.name}</strong></div>
                ${m.caseData.eta ? `<div>Dự kiến đến (ETA): <strong style="color:#f87171;font-family:var(--font-mono);">${m.caseData.eta}</strong></div>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    createIncidentPopupHtml(m) {
      const c = m.caseData;
      return `
        <div style="min-width:240px;color:#cbd5e1;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:8px;">
            <div style="color:#ef4444;font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px;">
              <span style="display:inline-flex;color:#ef4444;">${window.CCNV_UI?.ICONS?.alertTriangle || ''}</span>
              <span>HIỆN TRƯỜNG ${c.code}</span>
            </div>
            <span style="font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;border:1px solid ${m.code.color};color:#fff;">CODE ${m.code.key}</span>
          </div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:5px;">
            <div>Vị trí: <strong style="color:#ffffff;">${c.location?.address || '—'}</strong></div>
            <div>Bệnh nhân: <strong style="color:#ffffff;">${c.patient?.name || 'Chưa rõ'}${c.patient?.age ? ` (${c.patient.age}T)` : (c.patient?.ageGroupText ? ` (${c.patient.ageGroupText})` : '')}</strong></div>
            <div>Tình trạng: <span style="color:#fbbf24;">${c.incident?.name || '—'} · ${c.incident?.severityText || ''}</span></div>
            <div>Xe phụ trách: <strong style="color:#34d399;font-family:var(--font-mono);">${m.plate}</strong></div>
            <div>Bệnh viện đích: <strong style="color:#38bdf8;">${m.hosp.name}</strong></div>
          </div>
        </div>
      `;
    }

    createHospitalPopupHtml(h) {
      return `
        <div style="min-width:240px;color:#cbd5e1;">
          <div style="border-bottom:1px solid #1e3a56;padding-bottom:6px;margin-bottom:8px;">
            <strong style="color:#ffffff;font-size:14px;display:block;">${h.name}</strong>
            <span style="font-size:11px;color:#94a3b8;">${h.address}</span>
          </div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:5px;">
            <div>Khả năng tiếp nhận: <strong style="color:${h.status === 'AVAILABLE' ? '#10b981' : '#f59e0b'};">${h.statusText || 'Đang nhận cấp cứu'}</strong></div>
            <div>Hotline Cấp cứu: <span style="font-family:var(--font-mono);color:#93c5fd;font-weight:700;">${h.hotline || '—'}</span></div>
          </div>
        </div>
      `;
    }

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      if (this.map) {
        this.map.remove();
        this.map = null;
      }
    }
  }

  // Cho xe của ca chạy lại từ trạm (dùng khi demo phát lệnh hoặc kết thúc demo)
  CanThoMap.resetMission = (caseId) => {
    if (caseId) {
      delete missionProgress[caseId];
    } else {
      Object.keys(missionProgress).forEach(k => delete missionProgress[k]);
    }
  };

  window.CanThoMap = CanThoMap;
})(window);
