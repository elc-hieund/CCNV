/**
 * CCNV REAL-WORLD GIS MAP VIEW FOR TP. CẦN THƠ
 * Uses Leaflet.js with CartoDB Dark Matter tile layer (External API / Repo)
 * Displays real streets, rivers (Sông Hậu, Sông Cần Thơ), bridges, vehicles, hospitals & route simulation.
 */

(function (window) {
  'use strict';

  // Real-world coordinates in TP. Cần Thơ (WGS84 Lat/Lng)
  const HOSP_COORDS = {
    'HOSP_BVDK': [10.0375, 105.7820],       // BV Đa khoa TP Cần Thơ (Châu Văn Liêm, Ninh Kiều)
    'HOSP_BVTU': [10.0267, 105.7600],       // BV Đa khoa Trung ương (Nguyễn Văn Linh, Ninh Kiều)
    'HOSP_BVUB': [10.0465, 105.7680],       // BV Ung bướu TP Cần Thơ
    'HOSP_BVND': [10.0195, 105.7530],       // BV Nhi đồng TP Cần Thơ (Nguyễn Văn Cừ nối dài)
    'HOSP_TTYT_BT': [10.0650, 105.7350],   // TTYT Quận Bình Thủy
    'HOSP_TTYT_CR': [10.0020, 105.7580]    // TTYT Quận Cái Răng
  };

  const VEH_COORDS = {
    '65A-012.34': [10.0270, 105.7740],      // Đang cấp cứu trên đường 30/4 về BVĐK
    '65A-011.15': [10.0380, 105.7830],      // Trạm Cấp cứu Ninh Kiều (BVĐK)
    '65A-015.67': [10.0368, 105.7810],      // Trạm Cấp cứu Ninh Kiều (BVĐK)
    '65A-018.89': [10.0645, 105.7345],      // Trạm Cấp cứu Bình Thủy
    '65A-019.99': [10.1150, 105.6250],      // Trạm Cấp cứu Ô Môn
    '65A-010.02': [10.0390, 105.7840]       // Xưởng bảo trì Ninh Kiều
  };

  // Real route from Cầu Hưng Lợi along 30 Tháng 4 & Châu Văn Liêm to BVĐK TP Cần Thơ
  const EMERGENCY_ROUTE = [
    [10.0210, 105.7725], // Cầu Hưng Lợi (Hiện trường TNGT)
    [10.0235, 105.7730],
    [10.0265, 105.7738],
    [10.0290, 105.7750],
    [10.0315, 105.7765],
    [10.0340, 105.7785], // Ngã 4 Đại lộ Hòa Bình / 30 Tháng 4
    [10.0360, 105.7805],
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
      this.routeLine = null;
      this.timerId = null;
      this.routeStep = 0;
    }

    render() {
      const container = document.getElementById(this.containerId);
      if (!container) return;

      const state = window.StateManager ? window.StateManager.getState() : (window.appState || window.SEED_DATA);
      if (!state) return;

      // If Leaflet is loaded from CDN, use real CartoDB Dark Matter GIS tiles!
      if (window.L) {
        this.renderLeafletMap(container, state);
      } else {
        // Fallback to vector SVG if offline
        this.renderSvgFallback(container, state);
      }
    }

    renderLeafletMap(container, state) {
      container.innerHTML = `<div id="leaflet-map-root" style="width:100%;height:100%;background:#06121E;"></div>`;

      // Center on Can Tho city center (Ninh Kiều / Sông Cần Thơ)
      this.map = window.L.map('leaflet-map-root', {
        center: [10.0342, 105.7745],
        zoom: 14,
        minZoom: 11,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: true
      });

      // ESRI World Dark Gray Canvas (Clean GIS map without watermark or API key)
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

      // 1. Draw Real Emergency Route Polyline
      this.routeLine = window.L.polyline(EMERGENCY_ROUTE, {
        color: '#EF4444',
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 6',
        lineCap: 'round'
      }).addTo(this.map);

      // 2. Incident Beacon Marker (Cầu Hưng Lợi)
      const incidentIcon = window.L.divIcon({
        className: 'map-leaflet-marker',
        html: `
          <div class="map-incident-pin pulse-red">
            <span style="font-size:13px;">🚨</span>
            <span>HT: TNGT Cầu Hưng Lợi</span>
          </div>
        `,
        iconSize: [160, 30],
        iconAnchor: [80, 15]
      });

      this.incidentMarker = window.L.marker([10.0210, 105.7725], { icon: incidentIcon }).addTo(this.map);
      this.incidentMarker.bindPopup(`
        <div style="font-weight:700;color:#EF4444;font-size:13px;margin-bottom:4px;">🚨 HIỆN TRƯỜNG CẤP CỨU KHẨN CẤP</div>
        <div>Vị trí: <strong>Cầu Hưng Lợi, Q. Cái Răng</strong></div>
        <div>Tình huống: <span class="badge badge-emergency">Tai nạn giao thông</span></div>
        <div>Bệnh nhân: <strong>Phan Văn Đức (34T)</strong> - Đa chấn thương</div>
        <div>Xe ứng cứu: <strong>65A-012.34</strong> (Kíp Cái Răng)</div>
      `);
      this.incidentMarker.on('click', () => {
        if (typeof this.onIncidentSelect === 'function') {
          this.onIncidentSelect();
        }
      });

      // 3. Render Hospital Markers
      const hospitals = state.hospitals || [];
      hospitals.forEach(h => {
        const coords = HOSP_COORDS[h.id] || [h.mapPos?.y ? 10.0 + (h.mapPos.y / 15000) : 10.0342, 105.7 + (h.mapPos?.x ? h.mapPos.x / 15000 : 0.0745)];
        const isCenter = h.isCenter;

        const hospIcon = window.L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-hosp-pin ${isCenter ? 'center' : ''}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isCenter ? '#EF4444' : '#FFFFFF'}" stroke-width="3" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <div class="map-hosp-bed-badge" style="background:${h.status === 'AVAILABLE' ? '#10B981' : h.status === 'RESTRICTED' ? '#F59E0B' : '#EF4444'};">
                ${h.availableBeds}
              </div>
            </div>
            <div class="map-hosp-tag">${h.name}</div>
          `,
          iconSize: [140, 50],
          iconAnchor: [70, 25]
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

      // 4. Render Vehicle Markers
      const vehicles = state.vehicles || [];
      vehicles.forEach(v => {
        const coords = VEH_COORDS[v.plate] || [10.0342, 105.7745];
        const isEmergency = v.status === 'EMERGENCY';

        const vehIcon = window.L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-veh-tag">${v.plate}</div>
            <div class="map-veh-pin ${isEmergency ? 'emergency pulse-red' : ''}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v9h2"></path>
                <circle cx="7" cy="17" r="2"></circle>
                <path d="M9 17h6"></path>
                <circle cx="17" cy="17" r="2"></circle>
              </svg>
            </div>
          `,
          iconSize: [90, 52],
          iconAnchor: [45, 26]
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

      // Force recalculation of container size after DOM attach
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 200);

      this.startRealtimeSimulation();
    }

    createVehiclePopupHtml(v) {
      const isEmergency = v.status === 'EMERGENCY';
      return `
        <div style="min-width:240px;color:#CBD5E1;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1E3A56;padding-bottom:6px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <strong style="color:#FFFFFF;font-family:var(--font-mono);font-size:14px;">${v.plate}</strong>
              <span style="font-size:10px;padding:2px 6px;border-radius:3px;background:${isEmergency ? '#EF4444' : '#1E293B'};color:#FFF;font-weight:700;">
                ${v.statusText}
              </span>
            </div>
            <span style="font-size:11px;color:#94A3B8;">${v.type}</span>
          </div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:5px;">
            <div><span style="color:#94A3B8;">Trạm trực:</span> <strong style="color:#FFFFFF;">${v.station}</strong></div>
            <div><span style="color:#94A3B8;">Tốc độ:</span> <strong style="color:#FFFFFF;">${v.speed} km/h</strong></div>
            <div><span style="color:#94A3B8;">Định vị GPS:</span> <strong style="color:#10B981;">● ${v.gpsStatus}</strong> <span style="font-size:10px;color:#64748B;">(${v.lastUpdate})</span></div>
            <div><span style="color:#94A3B8;">Mức Pin:</span> ${window.CCNV_UI?.renderBattery ? window.CCNV_UI.renderBattery(v.battery) : `Pin: ${v.battery}%`}</div>
            ${v.route ? `
              <div style="background:#0F273D;padding:8px;border-radius:5px;margin-top:6px;border:1px solid #1E4976;">
                <div style="color:#EF4444;font-weight:700;font-size:11px;margin-bottom:2px;">🚑 ĐANG VẬN CHUYỂN CẤP CỨU</div>
                <div>Điểm đến: <strong style="color:#FFFFFF;">${v.route.to}</strong></div>
                <div>ETA: <strong style="color:#EF4444;font-size:13px;">${v.route.eta}</strong> (${v.route.distance})</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    createHospitalPopupHtml(h) {
      return `
        <div style="min-width:240px;color:#CBD5E1;">
          <div style="border-bottom:1px solid #1E3A56;padding-bottom:6px;margin-bottom:8px;">
            <strong style="color:#FFFFFF;font-size:14px;display:block;">${h.name}</strong>
            <span style="font-size:11px;color:#94A3B8;">${h.address}</span>
          </div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:5px;">
            <div><span style="color:#94A3B8;">Trạng thái:</span> <strong style="color:${h.status === 'AVAILABLE' ? '#10B981' : '#EF4444'};">${h.statusText}</strong></div>
            <div><span style="color:#94A3B8;">Giường Cấp cứu trống:</span> <strong style="color:#FFFFFF;">${h.availableBeds} / ${h.emergencyBeds}</strong></div>
            <div><span style="color:#94A3B8;">Máy thở sẵn sàng:</span> <strong style="color:#FFFFFF;">${h.ventilatorsAvailable} máy</strong></div>
            <div><span style="color:#94A3B8;">Hotline:</span> <span style="font-family:var(--font-mono);color:#93C5FD;">${h.hotline}</span></div>
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
          this.map.flyTo(item.marker.getLatLng(), 15, { duration: 1.0 });
          item.marker.openPopup();
        }
      }
    }

    startRealtimeSimulation() {
      if (this.timerId) clearInterval(this.timerId);

      this.timerId = setInterval(() => {
        const emergencyVeh = this.vehicleMarkers['65A-012.34'];
        if (emergencyVeh && emergencyVeh.marker) {
          // Advance vehicle along actual route
          this.routeStep = (this.routeStep + 1) % EMERGENCY_ROUTE.length;
          const targetCoords = EMERGENCY_ROUTE[this.routeStep];

          emergencyVeh.marker.setLatLng(targetCoords);
          emergencyVeh.data.speed = Math.floor(45 + Math.random() * 12);
          emergencyVeh.data.lastUpdate = 'Vừa cập nhật';

          // Update popup content if open
          if (emergencyVeh.marker.isPopupOpen()) {
            emergencyVeh.marker.setPopupContent(this.createVehiclePopupHtml(emergencyVeh.data));
          }
        }
      }, 3000);
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
