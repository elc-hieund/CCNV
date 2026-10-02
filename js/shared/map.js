/**
 * CCNV REAL-WORLD GIS COMMAND CENTER MAP VIEW — TP. CẦN THƠ
 * Impeccable Design: High-contrast Dark GIS theme, Pill Capsule vehicle markers,
 * Floating Medical Hub badges, Tactical SOS Radar beacon, Animated Green-Wave route & HUD Overlays.
 */

(function (window) {
  'use strict';

  // 1. REAL-WORLD LOGICAL COORDINATES IN TP. CẦN THƠ (Distributed cleanly across key districts)
  const HOSP_COORDS = {
    'HOSP_BVDK': [10.0375, 105.7820],       // BV Đa khoa TP Cần Thơ (Châu Văn Liêm, Ninh Kiều)
    'HOSP_BVTU': [10.0267, 105.7540],       // BV Đa khoa Trung ương (Nguyễn Văn Linh, Ninh Kiều)
    'HOSP_BVUB': [10.0465, 105.7680],       // BV Ung bướu TP Cần Thơ (Nguyễn Văn Cừ)
    'HOSP_BVND': [10.0195, 105.7480],       // BV Nhi đồng TP Cần Thơ (An Bình)
    'HOSP_TTYT_BT': [10.0720, 105.7280],   // TTYT Quận Bình Thủy (Lê Hồng Phong)
    'HOSP_TTYT_CR': [10.0020, 105.7580]    // TTYT Quận Cái Răng (Trần Hưng Đạo)
  };

  // Vehicles distributed logically across patrol points & stations — NO OVERLAPPING
  const VEH_COORDS = {
    '65A-012.34': [10.0265, 105.7738],      // Đang vận chuyển ca cấp cứu Cầu Hưng Lợi -> BVĐK TP Cần Thơ (Đường 30/4)
    '65A-015.67': [10.0348, 105.7876],      // Chốt Bến Ninh Kiều / Tượng đài Bác Hồ (Type A ICU)
    '65A-011.15': [10.0395, 105.7800],      // Trạm Cấp cứu Trung tâm (Cổng Cấp cứu Châu Văn Liêm, Type B)
    '65A-016.88': [10.0298, 105.7685],      // Ngã 4 đường 3/2 & Nguyễn Văn Linh - ĐH Cần Thơ (Type A ICU)
    '65A-010.02': [10.0215, 105.7850],      // KDC Hưng Phú / Nam Cần Thơ - Gần Cầu Quang Trung (Type B)
    '65A-018.89': [10.0580, 105.7460],      // Trục Võ Văn Kiệt - Cửa ngõ Sân bay Bình Thủy (Type B)
    '65A-017.22': [10.0060, 105.7630],      // Trạm Cấp cứu Cái Răng (Gần Chợ nổi Cái Răng, Type C)
    '65A-019.99': [10.0880, 105.7050]       // Trục QL91 - Trạm Cấp cứu Ô Môn (Type C)
  };

  // Real emergency Green-Wave route from Cầu Hưng Lợi along 30 Tháng 4 & Châu Văn Liêm to BVĐK TP Cần Thơ
  const EMERGENCY_ROUTE = [
    [10.0210, 105.7725], // Cầu Hưng Lợi (Hiện trường TNGT)
    [10.0235, 105.7730], // Giao lộ 30/4 - Trần Hoàng Na
    [10.0265, 105.7738], // Vị trí hiện tại xe 65A-012.34
    [10.0290, 105.7750], // Ngã tư 30/4 - Nguyễn Văn Linh (Cây xăng Hưng Lợi)
    [10.0315, 105.7765], // Chợ Xuân Khánh / Vincom
    [10.0340, 105.7785], // Ngã 4 Đại lộ Hòa Bình & 30 Tháng 4
    [10.0360, 105.7805], // Rẽ vào đường Châu Văn Liêm
    [10.0375, 105.7820]  // Cổng Cấp cứu BV Đa khoa TP Cần Thơ
  ];

  class CanThoMap {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.options = options;
      this.map = null;
      this.vehicleMarkers = {};
      this.hospitalMarkers = {};
      this.incidentMarker = null;
      this.routeLineGlow = null;
      this.routeLineActive = null;
      this.timerId = null;
      this.routeStep = 2; // Index corresponding to 65A-012.34 current location
      this.activeLayer = 'all'; // 'all', 'vehicles', 'hospitals', 'incident', 'route'
    }

    render() {
      const container = document.getElementById(this.containerId);
      if (!container) return;

      const state = window.StateManager ? window.StateManager.getState() : (window.appState || window.SEED_DATA);
      if (!state) return;

      if (window.L) {
        this.renderLeafletMap(container, state);
      } else {
        this.renderSvgFallback(container, state);
      }
    }

    renderLeafletMap(container, state) {
      container.innerHTML = `
        <div id="leaflet-map-root" style="width:100%;height:100%;background:#050d17;"></div>

        <!-- TACTICAL LEGEND (Bottom Right) -->
        <div class="map-tactical-legend">
          <div class="legend-item">
            <span class="legend-dot" style="background:#10b981;box-shadow:0 0 6px #10b981;"></span>
            <span>Xe sẵn sàng</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#ef4444;box-shadow:0 0 6px #ef4444;"></span>
            <span>Xe vận chuyển khẩn</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#38bdf8;box-shadow:0 0 6px #38bdf8;"></span>
            <span>Bệnh viện tiếp nhận</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#f59e0b;box-shadow:0 0 6px #f59e0b;"></span>
            <span>Hiện trường SOS</span>
          </div>
        </div>
      `;

      // Center on Can Tho city center (Ninh Kiều / Sông Hậu)
      this.map = window.L.map('leaflet-map-root', {
        center: [10.0335, 105.7725],
        zoom: 14,
        minZoom: 11,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: true
      });

      // Move zoom controls to bottom left to avoid overlapping HUD
      this.map.zoomControl.setPosition('bottomleft');

      // CartoDB Dark Matter / ESRI Canvas with optimal contrast
      window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, DeLorme, NAVTEQ',
        maxNativeZoom: 16,
        maxZoom: 18
      }).addTo(this.map);

      window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        attribution: '',
        maxNativeZoom: 16,
        maxZoom: 18
      }).addTo(this.map);

      // --- 1. DRAW EMERGENCY GREEN-WAVE ROUTE WITH GLOW ---
      // Outer glow polyline
      this.routeLineGlow = window.L.polyline(EMERGENCY_ROUTE, {
        color: '#0284c7',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);

      // Main active neon dashed polyline
      this.routeLineActive = window.L.polyline(EMERGENCY_ROUTE, {
        color: '#38bdf8',
        weight: 3.5,
        opacity: 0.95,
        dashArray: '8, 6',
        lineCap: 'round'
      }).addTo(this.map);

      // --- 2. TACTICAL INCIDENT BEACON (CẦU HƯNG LỢI) ---
      const incidentIcon = window.L.divIcon({
        className: 'map-leaflet-marker',
        html: `
          <div class="map-incident-beacon-container">
            <div class="map-incident-radar-rings">
              <div class="ring"></div>
              <div class="ring"></div>
              <div class="ring"></div>
            </div>
            <div class="map-incident-banner">
              <span>🚨</span>
              <span>TNGT CẦU HƯNG LỢI</span>
              <span style="font-size:9.5px;padding:1px 4px;border-radius:4px;background:rgba(0,0,0,0.3);font-family:var(--font-mono);">ETA 4m</span>
            </div>
          </div>
        `,
        iconSize: [180, 40],
        iconAnchor: [90, 20]
      });

      this.incidentMarker = window.L.marker([10.0210, 105.7725], { icon: incidentIcon }).addTo(this.map);
      this.incidentMarker.bindPopup(`
        <div style="min-width:240px;color:#cbd5e1;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:8px;">
            <div style="color:#ef4444;font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px;">
              <span>🚨</span> HIỆN TRƯỜNG CẤP CỨU KHẨN
            </div>
            <span class="badge badge-emergency" style="font-size:10px;">TỐI KHẨN</span>
          </div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:5px;">
            <div>Vị trí: <strong style="color:#ffffff;">Cầu Hưng Lợi, Q. Cái Răng</strong></div>
            <div>Bệnh nhân: <strong style="color:#ffffff;">Phan Văn Đức (58T)</strong></div>
            <div>Tình trạng: <span style="color:#fbbf24;">Đa chấn thương phần mềm, xây xát</span></div>
            <div>Xe phụ trách: <strong style="color:#38bdf8;font-family:var(--font-mono);">65A-012.34</strong> (Kíp 3 Cái Răng)</div>
            <div>Bệnh viện đích: <strong style="color:#34d399;">BV Đa khoa TP Cần Thơ</strong></div>
          </div>
        </div>
      `);

      this.incidentMarker.on('click', () => {
        if (typeof this.onIncidentSelect === 'function') {
          this.onIncidentSelect();
        }
      });

      // --- 3. RENDER MODERN HOSPITAL HUB BADGES ---
      const hospitals = state.hospitals || [];
      hospitals.forEach(h => {
        const coords = HOSP_COORDS[h.id] || [10.0375, 105.7820];
        const isRestricted = h.status === 'RESTRICTED';

        const hospIcon = window.L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-hosp-hub-badge">
              <div class="map-hosp-shield ${isRestricted ? 'restricted' : ''}">
                <div class="map-hosp-cross-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round">
                    <line x1="12" y1="4" x2="12" y2="20"></line>
                    <line x1="4" y1="12" x2="20" y2="12"></line>
                  </svg>
                </div>
                <span class="map-hosp-title-text" title="${h.name}">${h.name.replace('Bệnh viện', 'BV')}</span>
                <span class="map-hosp-bed-chip" title="Số giường cấp cứu trống">${h.availableBeds}G</span>
              </div>
            </div>
          `,
          iconSize: [160, 36],
          iconAnchor: [80, 18]
        });

        const marker = window.L.marker(coords, { icon: hospIcon }).addTo(this.map);
        marker.bindPopup(this.createHospitalPopupHtml(h));
        marker.on('click', () => {
          if (typeof this.onHospitalSelect === 'function') {
            this.onHospitalSelect(h.id);
          }
        });
        this.hospitalMarkers[h.id] = { marker, coords, data: h };
      });

      // --- 4. RENDER VEHICLE PILL MARKERS ---
      // Ensure all 8 vehicles exist with clean data
      const vehicles = (state.vehicles && state.vehicles.length >= 6) ? state.vehicles : [
        { plate: '65A-012.34', type: 'Type A', status: 'EMERGENCY', statusText: 'Vận chuyển', speed: 52, station: 'Kíp 3 - Cái Răng', battery: 96, fuel: '85%' },
        { plate: '65A-015.67', type: 'Type A', status: 'READY', statusText: 'Sẵn sàng', speed: 0, station: 'Trạm Ninh Kiều', battery: 98, fuel: '92%' },
        { plate: '65A-011.15', type: 'Type B', status: 'READY', statusText: 'Sẵn sàng', speed: 0, station: 'Trạm Trung tâm BVĐK', battery: 95, fuel: '88%' },
        { plate: '65A-016.88', type: 'Type A', status: 'READY', statusText: 'Sẵn sàng', speed: 0, station: 'Chốt ĐH Cần Thơ', battery: 94, fuel: '80%' },
        { plate: '65A-010.02', type: 'Type B', status: 'READY', statusText: 'Sẵn sàng', speed: 0, station: 'KDC Nam Cần Thơ', battery: 97, fuel: '86%' },
        { plate: '65A-018.89', type: 'Type B', status: 'READY', statusText: 'Sẵn sàng', speed: 0, station: 'Trạm Bình Thủy', battery: 92, fuel: '75%' },
        { plate: '65A-017.22', type: 'Type C', status: 'READY', statusText: 'Sẵn sàng', speed: 0, station: 'Trạm Cái Răng', battery: 90, fuel: '82%' },
        { plate: '65A-019.99', type: 'Type C', status: 'READY', statusText: 'Sẵn sàng', speed: 0, station: 'Trạm Ô Môn', battery: 91, fuel: '79%' }
      ];

      vehicles.forEach(v => {
        const coords = VEH_COORDS[v.plate] || [10.0335, 105.7725];
        const isEmergency = v.status === 'EMERGENCY' || v.plate === '65A-012.34';

        const vehIcon = window.L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-veh-capsule ${isEmergency ? 'is-emergency' : ''}">
              <div class="map-veh-icon-bubble">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v9h2"></path>
                  <circle cx="7" cy="17" r="2"></circle>
                  <path d="M9 17h6"></path>
                  <circle cx="17" cy="17" r="2"></circle>
                </svg>
              </div>
              <span class="map-veh-plate">${v.plate}</span>
              <span class="map-veh-status-pill ${isEmergency ? 'emergency' : 'ready'}">
                ${isEmergency ? (v.speed ? v.speed + ' km/h' : '52 km/h') : 'Sẵn sàng'}
              </span>
            </div>
          `,
          iconSize: [140, 36],
          iconAnchor: [70, 18]
        });

        const marker = window.L.marker(coords, { icon: vehIcon }).addTo(this.map);
        marker.bindPopup(this.createVehiclePopupHtml(v));
        marker.on('click', () => {
          if (typeof this.onVehicleSelect === 'function') {
            this.onVehicleSelect(v.plate);
          }
        });
        this.vehicleMarkers[v.plate] = { marker, coords, data: v };
      });

      // Bind layer toggle buttons
      container.querySelectorAll('.map-layer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const layer = btn.getAttribute('data-layer');
          if (!layer) return;

          container.querySelectorAll('.map-layer-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.applyLayerFilter(layer);
        });
      });

      // Center Can Tho button
      container.querySelector('#btn-map-center-city')?.addEventListener('click', () => {
        if (this.map) {
          this.map.flyTo([10.0335, 105.7725], 14, { duration: 0.8 });
        }
      });

      // Force recalculation of container size after DOM attach
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 200);

      this.startRealtimeSimulation();
    }

    applyLayerFilter(layer) {
      this.activeLayer = layer;

      // Vehicles
      Object.values(this.vehicleMarkers).forEach(item => {
        if (!item.marker) return;
        if (layer === 'all' || layer === 'vehicles') {
          if (!this.map.hasLayer(item.marker)) this.map.addLayer(item.marker);
        } else {
          if (this.map.hasLayer(item.marker)) this.map.removeLayer(item.marker);
        }
      });

      // Hospitals
      Object.values(this.hospitalMarkers).forEach(item => {
        if (!item.marker) return;
        if (layer === 'all' || layer === 'hospitals') {
          if (!this.map.hasLayer(item.marker)) this.map.addLayer(item.marker);
        } else {
          if (this.map.hasLayer(item.marker)) this.map.removeLayer(item.marker);
        }
      });

      // Incident
      if (this.incidentMarker) {
        if (layer === 'all' || layer === 'incident') {
          if (!this.map.hasLayer(this.incidentMarker)) this.map.addLayer(this.incidentMarker);
        } else {
          if (this.map.hasLayer(this.incidentMarker)) this.map.removeLayer(this.incidentMarker);
        }
      }

      // Route
      if (this.routeLineGlow && this.routeLineActive) {
        if (layer === 'all' || layer === 'route') {
          if (!this.map.hasLayer(this.routeLineGlow)) this.map.addLayer(this.routeLineGlow);
          if (!this.map.hasLayer(this.routeLineActive)) this.map.addLayer(this.routeLineActive);
        } else {
          if (this.map.hasLayer(this.routeLineGlow)) this.map.removeLayer(this.routeLineGlow);
          if (!this.map.hasLayer(this.routeLineActive)) this.map.removeLayer(this.routeLineActive);
        }
      }
    }

    createVehiclePopupHtml(v) {
      const isEmergency = v.status === 'EMERGENCY' || v.plate === '65A-012.34';
      return `
        <div style="min-width:250px;color:#cbd5e1;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e3a56;padding-bottom:6px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <strong style="color:#ffffff;font-family:var(--font-mono);font-size:14px;">${v.plate}</strong>
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${isEmergency ? '#ef4444' : '#047857'};color:#ffffff;font-weight:700;">
                ${isEmergency ? 'ĐANG CẤP CỨU' : 'SẴN SÀNG'}
              </span>
            </div>
            <span style="font-size:11px;color:#94a3b8;font-weight:600;">${v.type}</span>
          </div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:5px;">
            <div>Trạm / Chốt: <strong style="color:#ffffff;">${v.station || 'Trạm Cấp cứu Ninh Kiều'}</strong></div>
            <div>Vận tốc GPS: <strong style="color:#fbbf24;">${isEmergency ? (v.speed || 52) + ' km/h' : '0 km/h (Đang đỗ)'}</strong></div>
            <div>Tín hiệu thiết bị: <strong style="color:#10b981;">● GPS Online</strong> <span style="font-size:10px;color:#64748b;">(Sai số ±2.8m)</span></div>
            <div>Nhiên liệu & Oxy: <span style="color:#38bdf8;">Xăng ${v.fuel || '85%'} · Bình O2 ${v.oxygen || '95%'}</span></div>
            ${isEmergency ? `
              <div style="background:#0f273d;padding:8px;border-radius:6px;margin-top:6px;border:1px solid rgba(56,189,248,0.3);">
                <div style="color:#f87171;font-weight:700;font-size:11px;margin-bottom:2px;">🚑 TUYẾN CẤP CỨU TỐI KHẨN: TNGT CẦU HƯNG LỢI</div>
                <div>Điểm đến: <strong style="color:#ffffff;">BV Đa khoa TP Cần Thơ</strong></div>
                <div>Dự kiến đến (ETA): <strong style="color:#f87171;font-size:13px;font-family:var(--font-mono);">~4 phút</strong> (1.4 km)</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    createHospitalPopupHtml(h) {
      return `
        <div style="min-width:260px;color:#cbd5e1;">
          <div style="border-bottom:1px solid #1e3a56;padding-bottom:6px;margin-bottom:8px;">
            <strong style="color:#ffffff;font-size:14px;display:block;">${h.name}</strong>
            <span style="font-size:11px;color:#94a3b8;">${h.address}</span>
          </div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:5px;">
            <div>Khả năng tiếp nhận: <strong style="color:${h.status === 'AVAILABLE' ? '#10b981' : '#f59e0b'};">${h.statusText || 'Đang nhận cấp cứu'}</strong></div>
            <div>Giường Cấp cứu trống: <strong style="color:#38bdf8;font-size:13px;">${h.availableBeds} / ${h.emergencyBeds} giường</strong></div>
            <div>Máy thở sẵn sàng: <strong style="color:#ffffff;">${h.ventilatorsAvailable} máy</strong></div>
            <div>Hotline Cấp cứu: <span style="font-family:var(--font-mono);color:#93c5fd;font-weight:700;">${h.hotline || '0292.3821.236'}</span></div>
          </div>
        </div>
      `;
    }

    showVehiclePopup(plate) {
      Object.values(this.vehicleMarkers).forEach(item => {
        const el = item.marker?.getElement();
        if (el) el.classList.remove('is-active-marker');
      });

      if (this.vehicleMarkers[plate]) {
        const item = this.vehicleMarkers[plate];
        const el = item.marker?.getElement();
        if (el) el.classList.add('is-active-marker');

        if (this.map) {
          this.map.flyTo(item.marker.getLatLng(), 15, { duration: 0.8 });
          item.marker.openPopup();
        }
      }
    }

    showHospitalPopup(hid) {
      if (this.hospitalMarkers[hid]) {
        const item = this.hospitalMarkers[hid];
        if (this.map) {
          this.map.flyTo(item.marker.getLatLng(), 15, { duration: 0.8 });
          item.marker.openPopup();
        }
      }
    }

    startRealtimeSimulation() {
      if (this.timerId) clearInterval(this.timerId);

      this.timerId = setInterval(() => {
        const emergencyVeh = this.vehicleMarkers['65A-012.34'];
        if (emergencyVeh && emergencyVeh.marker) {
          this.routeStep = (this.routeStep + 1) % EMERGENCY_ROUTE.length;
          const targetCoords = EMERGENCY_ROUTE[this.routeStep];

          emergencyVeh.marker.setLatLng(targetCoords);
          emergencyVeh.data.speed = Math.floor(48 + Math.random() * 10);
          emergencyVeh.data.lastUpdate = 'Vừa cập nhật';

          // Update speed badge text in DOM directly for smooth transition
          const pill = emergencyVeh.marker.getElement()?.querySelector('.map-veh-status-pill');
          if (pill) {
            pill.textContent = emergencyVeh.data.speed + ' km/h';
          }

          if (emergencyVeh.marker.isPopupOpen()) {
            emergencyVeh.marker.setPopupContent(this.createVehiclePopupHtml(emergencyVeh.data));
          }
        }
      }, 2500);
    }

    renderSvgFallback(container, state) {
      container.innerHTML = `
        <div style="width:100%;height:100%;position:relative;overflow:hidden;background:#071522;display:flex;align-items:center;justify-content:center;color:#64748B;">
          <span>Đang kết nối bản đồ số TP. Cần Thơ...</span>
        </div>
      `;
    }

    destroy() {
      if (this.timerId) clearInterval(this.timerId);
      if (this.map) {
        this.map.remove();
        this.map = null;
      }
    }
  }

  window.CanThoMap = CanThoMap;
})(window);
