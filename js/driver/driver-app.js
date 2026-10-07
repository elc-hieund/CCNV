document.addEventListener('DOMContentLoaded', async () => {
      // 1. Initialize State Manager
      await window.StateManager.init();
      const state = window.StateManager.getState();

      // =========================================================================
      // REALTIME PATIENT SYNCHRONIZATION ENGINE WITH CENTRAL COMMAND (TT-115)
      // =========================================================================
      let currentPlate = '65A-012.34';

      function getActiveCase() {
        const s = window.StateManager.getState();
        const cases = s.cases || [];
        // Ưu tiên ca cấp cứu đang gán cho xe hiện tại
        const byVeh = cases.find(c => c.dispatch?.vehiclePlate === currentPlate && c.status !== 'COMPLETED' && c.status !== 'CANCELLED');
        if (byVeh) return byVeh;
        // Hoặc ca đang xử lý bất kỳ
        const anyActive = cases.find(c => c.status !== 'COMPLETED' && c.status !== 'CANCELLED');
        return anyActive || cases[0] || null;
      }

      function flashSyncHighlight(elementIds) {
        elementIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.classList.add('sync-highlight');
            setTimeout(() => el.classList.remove('sync-highlight'), 1800);
          }
        });
      }

      function renderCaseAndPatient(c, isRemoteUpdate = false) {
        if (!c) return;

        const p = c.patient || {};
        const inc = c.incident || {};
        const loc = c.location || {};
        const disp = c.dispatch || {};

        // 1. Tab 1: Nhiệm vụ
        const caseCodeEl = document.getElementById('driver-case-code');
        const caseEtaEl = document.getElementById('driver-case-eta');
        const pNameEl = document.getElementById('driver-patient-name');
        const pDemoEl = document.getElementById('driver-patient-demographics');
        const pSymptomsEl = document.getElementById('driver-patient-symptoms');
        const sceneAddrEl = document.getElementById('driver-scene-address');
        const hospNameEl = document.getElementById('driver-hospital-name');
        const btnCallCitizen = document.getElementById('btn-call-citizen');

        if (caseCodeEl) caseCodeEl.textContent = c.code || 'CC-261002-001';
        const caseTitleEl = document.getElementById('driver-case-title');
        if (caseTitleEl) caseTitleEl.textContent = `${(inc.name || 'CẤP CỨU').toUpperCase()} — ${loc.district ? loc.district.toUpperCase() : 'CẦN THƠ'}`;
        if (caseEtaEl) caseEtaEl.textContent = c.eta || '~4 PHÚT';
        if (pNameEl) pNameEl.textContent = p.name || 'Không rõ danh tính';
        if (pDemoEl) {
          const ageStr = p.age ? `${p.age} tuổi` : '—';
          const genderStr = p.gender || '—';
          const bloodStr = p.bloodType ? ` · Máu ${p.bloodType}` : '';
          pDemoEl.textContent = `(${ageStr}, ${genderStr}${bloodStr})`;
        }
        if (pSymptomsEl) {
          pSymptomsEl.textContent = p.symptom || inc.description || 'Chấn thương sọ não, đa chấn thương';
        }
        if (sceneAddrEl) sceneAddrEl.textContent = loc.address || 'Hiện trường Cần Thơ';
        if (hospNameEl) hospNameEl.textContent = disp.hospitalName || 'Bệnh viện Đa khoa thành phố Cần Thơ';
        if (btnCallCitizen) {
          btnCallCitizen.href = `tel:${p.phone || c.callerPhone || '115'}`;
        }

        // 2. Tab 2: Bản đồ dẫn đường
        const navHospName = document.getElementById('nav-hospital-name');
        const navPatientInfo = document.getElementById('nav-patient-info');
        if (navHospName) navHospName.textContent = disp.hospitalName || 'Bệnh viện Đa khoa thành phố Cần Thơ';
        if (navPatientInfo) {
          const ageText = p.age ? `${p.age}T` : '—';
          navPatientInfo.textContent = `BN: ${p.name || 'Chưa rõ'} (${ageText}, ${p.gender || '—'}) · ${p.bloodType || 'O+'}`;
        }

        // 3. Tab 3: ePCR Fields
        const epcrTitle = document.getElementById('epcr-patient-title');
        const inputName = document.getElementById('epcr-input-name');
        const inputAge = document.getElementById('epcr-input-age');
        const inputGender = document.getElementById('epcr-input-gender');
        const inputPhone = document.getElementById('epcr-input-phone');
        const inputBlood = document.getElementById('epcr-input-blood');
        const inputHistory = document.getElementById('epcr-input-history');
        const inputAllergies = document.getElementById('epcr-input-allergies');
        const inputSymptom = document.getElementById('epcr-input-symptom');

        if (epcrTitle) {
          epcrTitle.textContent = `${p.name || 'Bệnh nhân'} · ${p.age ? p.age + 'T' : '—'} · ${p.gender || '—'}`;
        }
        if (inputName) inputName.value = p.name || '';
        if (inputAge) inputAge.value = p.age || '';
        if (inputGender && p.gender) inputGender.value = p.gender;
        if (inputPhone) inputPhone.value = p.phone || c.callerPhone || '';
        if (inputBlood && p.bloodType) inputBlood.value = p.bloodType;
        if (inputHistory) inputHistory.value = p.history || '';
        if (inputAllergies) inputAllergies.value = p.allergies || '';
        if (inputSymptom) inputSymptom.value = p.symptom || inc.description || '';

        // Vitals
        if (c.epcr?.vitals) {
          const v = c.epcr.vitals;
          if (v.pulse && document.getElementById('v-pulse')) document.getElementById('v-pulse').value = v.pulse;
          if (v.bp && document.getElementById('v-bp')) document.getElementById('v-bp').value = v.bp;
          if (v.spO2 && document.getElementById('v-spo2')) document.getElementById('v-spo2').value = v.spO2;
          if (v.temp && document.getElementById('v-temp')) document.getElementById('v-temp').value = v.temp;
          if (v.rr && document.getElementById('v-rr')) document.getElementById('v-rr').value = v.rr;
          if (v.glasgow && document.getElementById('v-glasgow')) document.getElementById('v-glasgow').value = v.glasgow;
        }

        // Progression
        if (c.epcr?.progression && document.getElementById('epcr-progression-text')) {
          document.getElementById('epcr-progression-text').value = c.epcr.progression;
        }

        if (isRemoteUpdate) {
          flashSyncHighlight([
            'driver-patient-name',
            'driver-patient-demographics',
            'driver-patient-symptoms',
            'nav-patient-info',
            'epcr-input-name',
            'epcr-input-age',
            'epcr-input-gender',
            'epcr-input-blood',
            'epcr-input-history',
            'epcr-input-allergies',
            'epcr-input-symptom'
          ]);
        }
      }

      function savePatientData(showToast = true) {
        const c = getActiveCase();
        if (!c) return;

        const inputName = document.getElementById('epcr-input-name');
        const inputAge = document.getElementById('epcr-input-age');
        const inputGender = document.getElementById('epcr-input-gender');
        const inputPhone = document.getElementById('epcr-input-phone');
        const inputBlood = document.getElementById('epcr-input-blood');
        const inputHistory = document.getElementById('epcr-input-history');
        const inputAllergies = document.getElementById('epcr-input-allergies');
        const inputSymptom = document.getElementById('epcr-input-symptom');

        const patch = {
          name: inputName ? inputName.value.trim() : c.patient?.name,
          age: inputAge && inputAge.value ? Number(inputAge.value) : c.patient?.age,
          gender: inputGender ? inputGender.value : c.patient?.gender,
          phone: inputPhone ? inputPhone.value.trim() : c.patient?.phone,
          bloodType: inputBlood ? inputBlood.value : c.patient?.bloodType,
          history: inputHistory ? inputHistory.value.trim() : c.patient?.history,
          allergies: inputAllergies ? inputAllergies.value.trim() : c.patient?.allergies,
          symptom: inputSymptom ? inputSymptom.value.trim() : c.patient?.symptom
        };

        // Đồng thời lưu sinh hiệu & diễn biến
        const pulse = document.getElementById('v-pulse')?.value;
        const bp = document.getElementById('v-bp')?.value;
        const spO2 = document.getElementById('v-spo2')?.value;
        const temp = document.getElementById('v-temp')?.value;
        const rr = document.getElementById('v-rr')?.value;
        const glasgow = document.getElementById('v-glasgow')?.value;
        const prog = document.getElementById('epcr-progression-text')?.value;

        c.epcr = c.epcr || {};
        c.epcr.vitals = {
          pulse: pulse ? Number(pulse) : null,
          bp: bp || '',
          spO2: spO2 ? Number(spO2) : null,
          temp: temp ? Number(temp) : null,
          rr: rr ? Number(rr) : null,
          glasgow: glasgow ? Number(glasgow) : null
        };
        if (prog) c.epcr.progression = prog;

        // Cập nhật StateManager (Lưu localStorage + broadcast sang central.html)
        window.StateManager.updateCasePatient(c.id, patch);

        // Cập nhật giao diện nội bộ app lái xe ngay
        renderCaseAndPatient(c, false);

        if (showToast && window.CCNV_UI?.Toast) {
          window.CCNV_UI.Toast.show(
            'ĐÃ ĐỒNG BỘ VỚI TRUNG TÂM 115',
            `Thông tin BN "${patch.name}" (${patch.age}T, ${patch.gender}, máu ${patch.bloodType}) đã lưu & phát tức thời về Trung tâm điều hành 115 và Bệnh viện tiếp nhận.`,
            true
          );
        }
      }

      // Khởi tạo thông tin bệnh nhân từ StateManager
      const initialCase = getActiveCase();
      if (initialCase) {
        renderCaseAndPatient(initialCase, false);
      }



      // Tự động đồng bộ khi thay đổi các trường thông tin bệnh nhân (Auto-sync with Central)
      let syncDebounceTimer = null;
      document.querySelectorAll('.epcr-patient-input').forEach(input => {
        input.addEventListener('change', () => {
          clearTimeout(syncDebounceTimer);
          syncDebounceTimer = setTimeout(() => savePatientData(false), 300);
        });
      });


      // Lắng nghe tín hiệu đồng bộ từ Trung tâm 115 & các tab khác
      window.StateManager.subscribe((event, payload, state) => {
        if (event === 'PATIENT_UPDATED' || event === 'CASE_UPDATED' || event === 'STORAGE_SYNC') {
          const c = getActiveCase();
          if (c) {
            renderCaseAndPatient(c, true);
            if (event === 'PATIENT_UPDATED' && payload?.patient) {
              const p = payload.patient;
              if (window.CCNV_UI?.Toast) {
                window.CCNV_UI.Toast.show(
                  'ĐỒNG BỘ TỪ TRUNG TÂM 115',
                  `Trung tâm đã cập nhật: ${p.name || 'Bệnh nhân'} (${p.age || '—'}T, ${p.gender || '—'}) · Nhóm máu ${p.bloodType || '—'} · Tiền sử: ${p.history || 'Không'}`,
                  true
                );
              }
            }
          }
        }
      });

      // 2. Realtime Mobile Clock
      function updateClock() {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const el = document.getElementById('mobile-clock');
        if (el) el.textContent = `${hrs}:${mins}`;
      }
      setInterval(updateClock, 1000);
      updateClock();

      // =========================================================================
      // 3. DRIVER GPS NAVIGATION & REALTIME SIMULATION ENGINE (4 STATES)
      // =========================================================================

      // Tọa độ chuẩn hệ thống CCNV Cần Thơ
      const COORDS = {
        station: [10.0105, 105.7700],   // Trạm Cái Răng (Vị trí đỗ thường trực xe 65A-012.34)
        scene: [10.0298, 105.7702],     // Chân Cầu Hưng Lợi / Cổng ĐH Cần Thơ (Hiện trường ca CC-261002-002)
        hospital: [10.0265, 105.7588],  // Bệnh viện Đa khoa thành phố Cần Thơ (Bệnh viện tiếp nhận)
        center: [10.0200, 105.7680]
      };

      // Tuyến đường thực tế bám sát mạng lưới giao thông TP Cần Thơ
      const FALLBACK_LEG1 = [
        [10.0105, 105.7700], // Trạm Cái Răng
        [10.0122, 105.7725], // Dốc Cầu Hưng Lợi
        [10.0145, 105.7752], // Cầu Hưng Lợi vượt sông Cần Thơ
        [10.0175, 105.7762], // Nút giao đường 30/4
        [10.0205, 105.7755], // Trục đường 30/4
        [10.0232, 105.7745], // Đường 30/4 qua Xuân Khánh
        [10.0255, 105.7735], // Ngã tư 30/4 - Trần Văn Hoài
        [10.0272, 105.7722], // Rẽ sang đường 3/2
        [10.0288, 105.7710], // Đường 3/2 tiếp cận ĐH Cần Thơ
        [10.0298, 105.7702]  // Đến Hiện trường Cầu Hưng Lợi
      ];

      const FALLBACK_LEG2 = [
        [10.0298, 105.7702], // Hiện trường Cầu Hưng Lợi
        [10.0290, 105.7682], // Đường 3/2
        [10.0282, 105.7655], // Nút giao 3/2 - Nguyễn Văn Linh
        [10.0275, 105.7625], // Trục đường Nguyễn Văn Linh
        [10.0268, 105.7602], // Đoạn Nguyễn Văn Linh tiếp cận Bệnh viện
        [10.0265, 105.7588]  // Bệnh viện Đa khoa thành phố Cần Thơ
      ];

      // OSRM Routing Helper có Fallback
      async function fetchRoadRoute(a, b, fallbackPoints) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 3500);
          const url = `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
          const res = await fetch(url, { signal: ctrl.signal });
          clearTimeout(timer);
          const json = await res.json();
          if (json.routes && json.routes[0] && json.routes[0].geometry) {
            const pts = json.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            return [a, ...pts, b];
          }
        } catch (e) {
          // Bỏ qua lỗi mạng OSRM, sử dụng fallback bám sát đường phố Cần Thơ
        }
        return fallbackPoints;
      }

      function buildPath(points) {
        const L = window.L;
        const ll = points.map(p => L.latLng(p[0], p[1]));
        const cum = [0];
        for (let i = 1; i < ll.length; i++) {
          cum.push(cum[i - 1] + ll[i - 1].distanceTo(ll[i]));
        }
        return { ll, cum, total: cum[cum.length - 1] };
      }

      function pointAt(path, d) {
        const L = window.L;
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
        return {
          latlng: L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t),
          idx: lo
        };
      }

      // Các biến trạng thái chính
      let driverMap = null;
      let vehMarker = null;
      let hospMarker = null;
      let sceneMarker = null;
      let routeBgLeg1 = null;
      let routeBgLeg2 = null;
      let focusLines = null;
      let isMissionActive = false;
      let simRafId = null;

      // Trạng thái mô phỏng 4 State
      // 1: Xuất phát (TO_SCENE)
      // 2: Đến hiện trường (PICKUP - dừng 3.5s)
      // 3: Di chuyển tới viện (TO_HOSP)
      // 4: Bàn giao bệnh nhân (COMPLETED - bàn giao xong & quay về map mặc định)
      const simState = {
        stateNum: 1, // 1, 2, 3, 4
        phase: 'IDLE', // IDLE, TO_SCENE, PICKUP, TO_HOSP, COMPLETED
        dist: 0,
        pauseUntil: 0,
        lastTs: 0,
        speedKmH: 52,
        lastSpeedUpdate: 0,
        leg1: null,
        leg2: null,
        pos: null
      };

      const SIM_SPEED_MPS = 58; // Tốc độ di chuyển mô phỏng mượt mà ~58 m/s

      // DOM Elements
      const navFloatingHud = document.getElementById('nav-floating-hud');
      const missionDock = document.getElementById('driver-mission-dock');
      const dockDetails = document.getElementById('dock-details-body');
      const dockExpandIcon = document.getElementById('dock-expand-icon');
      const btnDockExpand = document.getElementById('btn-dock-toggle-expand');
      const dockHandle = document.getElementById('dock-handle-bar');
      const btnToggleSheet = document.getElementById('btn-toggle-mission-sheet');
      const btnDriverSos = document.getElementById('driver-btn-sos');
      const badgeHeaderPhase = document.getElementById('badge-header-phase');

      // Top HUD Texts
      const navDestType = document.getElementById('nav-hospital-name') || document.getElementById('nav-dest-type');
      const navInstructionDist = document.getElementById('nav-next-dist') || document.getElementById('nav-instruction-dist');
      const navInstructionText = document.getElementById('nav-next-street') || document.getElementById('nav-instruction-text');
      const navNextStreetHint = document.getElementById('nav-next-street-hint');
      const navTelemetrySpeed = document.getElementById('nav-telemetry-speed');
      const navTelemetryDist = document.getElementById('nav-telemetry-dist');
      const navTelemetryEta = document.getElementById('nav-telemetry-eta');

      // Stepper & Slider
      const stepperCols = document.querySelectorAll('.driver-step-col');
      const sliderTrack = document.getElementById('slider-track');
      const sliderKnob = document.getElementById('slider-knob');
      const sliderFill = document.getElementById('slider-fill');
      const sliderLabel = document.getElementById('slider-label');

      // Modals
      const dispatchModal = document.getElementById('modal-dispatch-alert');
      const btnCloseDispatch = document.getElementById('btn-close-dispatch-order');
      const btnRejectDispatch = document.getElementById('btn-reject-dispatch-order');
      const dispatchTrack = document.getElementById('dispatch-slider-track');
      const dispatchKnob = document.getElementById('dispatch-slider-knob');
      const dispatchFill = document.getElementById('dispatch-slider-fill');
      const dispatchLabel = document.getElementById('dispatch-slider-label');

      // Khởi tạo bản đồ chính
      function initDriverMap() {
        const container = document.getElementById('driver-map-container');
        if (!container || !window.L) return;

        driverMap = window.L.map('driver-map-container', {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true,
          doubleClickZoom: false
        }).setView(COORDS.station, 14);

        // ArcGIS Dark Base & Reference
        window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          maxNativeZoom: 16,
          maxZoom: 18,
          pane: 'tilePane'
        }).addTo(driverMap);

        window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          maxNativeZoom: 16,
          maxZoom: 18,
          pane: 'tilePane'
        }).addTo(driverMap);

        // Marker Xe cấp cứu (Ban đầu ở trạng thái MẶC ĐỊNH SẴN SÀNG)
        createVehicleMarker(COORDS.station, 'SẴN SÀNG', false);

        // Nút điều khiển bản đồ (+, -, Định vị xe / Mở ca cấp cứu)
        document.getElementById('btn-driver-zoom-in')?.addEventListener('click', (e) => {
          e.stopPropagation();
          driverMap.zoomIn();
        });
        document.getElementById('btn-driver-zoom-out')?.addEventListener('click', (e) => {
          e.stopPropagation();
          driverMap.zoomOut();
        });
        document.getElementById('btn-driver-recenter')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!isMissionActive) {
            // Khi ở map mặc định: Nhấn vào icon định vị để mở popup nhận lệnh điều động
            openDispatchAlertPopup();
          } else {
            // Khi đang trong nhiệm vụ: Đưa góc nhìn bản đồ về vị trí xe
            recenterDriverMap();
          }
        });

        // Thiết lập chế độ mặc định ban đầu: Chỉ có map và vị trí xe
        resetToDefaultIdleMap(false);
      }

      function createVehicleMarker(latlng, statusText, isMission) {
        if (vehMarker) {
          driverMap.removeLayer(vehMarker);
          vehMarker = null;
        }

        const iconHtml = isMission
          ? `
            <div class="map-veh-capsule is-mission" id="map-veh-capsule-el">
              <div class="map-veh-icon-bubble">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v9h2"></path>
                  <circle cx="7" cy="17" r="2"></circle>
                  <path d="M9 17h6"></path>
                  <circle cx="17" cy="17" r="2"></circle>
                </svg>
              </div>
              <span class="map-veh-plate">65A-012.34</span>
              <span class="map-veh-status-pill mission" id="map-veh-pill-text">${statusText}</span>
            </div>
          `
          : `
            <div class="map-veh-capsule" style="background:#081827;border:1.5px solid #10B981;">
              <div class="map-veh-icon-bubble" style="background:#10B981;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v9h2"></path>
                  <circle cx="7" cy="17" r="2"></circle>
                  <path d="M9 17h6"></path>
                  <circle cx="17" cy="17" r="2"></circle>
                </svg>
              </div>
              <span class="map-veh-plate" style="color:#FFFFFF;">65A-012.34</span>
              <span class="map-veh-status-pill" id="map-veh-pill-text" style="background:rgba(16,185,129,0.22);color:#34D399;border:1px solid rgba(16,185,129,0.45);">${statusText}</span>
            </div>
          `;

        const vehIcon = window.L.divIcon({
          className: 'map-leaflet-marker',
          html: iconHtml,
          iconSize: [160, 36],
          iconAnchor: [80, 18]
        });

        vehMarker = window.L.marker(latlng, { icon: vehIcon, zIndexOffset: 1000 }).addTo(driverMap);

        // Nhấn vào xe hoặc icon định vị để mở lệnh điều động khi ở màn hình mặc định
        vehMarker.on('click', () => {
          if (!isMissionActive) {
            openDispatchAlertPopup();
          } else {
            recenterDriverMap();
          }
        });
      }

      function updateVehiclePill(text, isMissionPhase) {
        const pill = document.getElementById('map-veh-pill-text');
        if (pill) {
          pill.textContent = text;
          if (isMissionPhase) {
            pill.className = 'map-veh-status-pill mission';
          }
        }
      }

      function recenterDriverMap() {
        if (!driverMap) return;
        if (isMissionActive && vehMarker) {
          driverMap.setView(vehMarker.getLatLng(), 15, { animate: true });
        } else if (vehMarker) {
          driverMap.setView(COORDS.station, 14, { animate: true });
        }
      }

      // =========================================================================
      // THIẾT LẬP MẶC ĐỊNH: CHỈ CÓ MAP VÀ NÚT SOS (TX-00)
      // =========================================================================
      function resetToDefaultIdleMap(showNotification = true) {
        stopSimulation();
        isMissionActive = false;
        simState.phase = 'IDLE';
        simState.stateNum = 1;
        simState.dist = 0;
        simState.pauseUntil = 0;

        // 0. Hiển thị lại Header mặc định khi chưa nhận ca
        const defaultHeader = document.getElementById('driver-default-header');
        if (defaultHeader) defaultHeader.style.display = 'flex';

        // 1. Ẩn HUD dẫn đường và Dock điều khiển
        if (navFloatingHud) navFloatingHud.style.display = 'none';
        if (missionDock) {
          missionDock.style.display = 'none';
          missionDock.classList.remove('expanded');
        }
        document.getElementById('driver-map-controls')?.classList.remove('in-mission');
        if (dockDetails) dockDetails.style.display = 'none';
        if (dockExpandIcon) dockExpandIcon.textContent = '▲';

        // 2. Nút định vị hiển thị rõ ràng
        const btnRecenter = document.getElementById('btn-driver-recenter');
        if (btnRecenter) {
          btnRecenter.setAttribute('title', 'Nhấn vào icon này để nhận lệnh điều động');
        }

        // 3. Header badge về trạng thái SẴN SÀNG
        if (badgeHeaderPhase) {
          badgeHeaderPhase.textContent = 'SẴN SÀNG';
          badgeHeaderPhase.style.background = '#10B981';
          badgeHeaderPhase.style.color = '#FFFFFF';
        }

        // 4. Xóa tuyến đường và điểm tai nạn khỏi bản đồ
        clearMissionMapLayers();

        // 5. Đưa xe về trạm Cái Răng ở trạng thái Sẵn sàng và tập trung góc nhìn vào xe
        createVehicleMarker(COORDS.station, 'SẴN SÀNG', false);
        if (driverMap) {
          driverMap.setView(COORDS.station, 15, { animate: true });
        }

        // 6. Reset Stepper và Slider về Bước 1
        updateStepperUI(1);
        resetSlider(1);

      }

      function clearMissionMapLayers() {
        if (!driverMap) return;
        if (sceneMarker) {
          driverMap.removeLayer(sceneMarker);
          sceneMarker = null;
        }
        if (hospMarker) {
          driverMap.removeLayer(hospMarker);
          hospMarker = null;
        }
        if (routeBgLeg1) {
          driverMap.removeLayer(routeBgLeg1);
          routeBgLeg1 = null;
        }
        if (routeBgLeg2) {
          driverMap.removeLayer(routeBgLeg2);
          routeBgLeg2 = null;
        }
        if (focusLines) {
          if (focusLines.glow1) driverMap.removeLayer(focusLines.glow1);
          if (focusLines.line1) driverMap.removeLayer(focusLines.line1);
          if (focusLines.glow2) driverMap.removeLayer(focusLines.glow2);
          if (focusLines.line2) driverMap.removeLayer(focusLines.line2);
          focusLines = null;
        }
      }

      // =========================================================================
      // POPUP NHẬN THÔNG TIN CA & XÁC NHẬN (SLIDE-TO-CONFIRM & TỪ CHỐI)
      // =========================================================================
      function resetDispatchSlider() {
        if (!dispatchKnob || !dispatchFill || !dispatchLabel) return;
        dispatchKnob.style.transition = 'none';
        dispatchFill.style.transition = 'none';
        dispatchKnob.style.transform = 'translateX(0px)';
        dispatchFill.style.width = '0%';
        dispatchLabel.style.opacity = '1';
        dispatchLabel.textContent = 'VUỐT SANG PHẢI: XÁC NHẬN NHẬN LỆNH ❯❯❯';
      }

      function openDispatchAlertPopup() {
        if (dispatchModal) {
          resetDispatchSlider();
          dispatchModal.classList.add('active');
          playEmergencyAlarm();
          if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 400]);
        }
      }

      btnCloseDispatch?.addEventListener('click', () => {
        dispatchModal.classList.remove('active');
      });

      // Bấm nút Từ chối nhận ca
      btnRejectDispatch?.addEventListener('click', () => {
        dispatchModal.classList.remove('active');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      });

      // Vuốt từ trái sang phải để xác nhận nhận lệnh (Slide-to-Confirm)
      let isDispatchDragging = false;
      let dispatchStartX = 0;
      let dispatchCurrentX = 0;

      function onDispatchDragStart(e) {
        if (!dispatchKnob || !dispatchTrack) return;
        isDispatchDragging = true;
        dispatchStartX = (e.touches ? e.touches[0].clientX : e.clientX);
        dispatchKnob.style.transition = 'none';
        dispatchFill.style.transition = 'none';
      }

      function onDispatchDragMove(e) {
        if (!isDispatchDragging || !dispatchKnob || !dispatchTrack) return;
        const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
        const trackWidth = dispatchTrack.clientWidth || 300;
        const knobWidth = dispatchKnob.clientWidth || 46;
        const maxDist = trackWidth - knobWidth - 8;
        
        dispatchCurrentX = Math.max(0, Math.min(clientX - dispatchStartX, maxDist));
        dispatchKnob.style.transform = `translateX(${dispatchCurrentX}px)`;
        const percent = (dispatchCurrentX / maxDist) * 100;
        dispatchFill.style.width = `${percent}%`;
        if (dispatchLabel) {
          dispatchLabel.style.opacity = `${Math.max(0, 1 - (percent / 60))}`;
        }
      }

      function onDispatchDragEnd() {
        if (!isDispatchDragging || !dispatchKnob || !dispatchTrack) return;
        isDispatchDragging = false;
        
        const trackWidth = dispatchTrack.clientWidth || 300;
        const knobWidth = dispatchKnob.clientWidth || 46;
        const maxDist = trackWidth - knobWidth - 8;

        if (dispatchCurrentX >= maxDist * 0.72) {
          // Vuốt thành công sang phải
          dispatchKnob.style.transition = 'transform 0.15s ease';
          dispatchFill.style.transition = 'width 0.15s ease';
          dispatchKnob.style.transform = `translateX(${maxDist}px)`;
          dispatchFill.style.width = '100%';
          if (dispatchLabel) {
            dispatchLabel.textContent = '✔ ĐÃ TIẾP NHẬN LỆNH ĐIỀU ĐỘNG';
            dispatchLabel.style.opacity = '1';
          }

          if (navigator.vibrate) navigator.vibrate([150, 80, 200]);

          setTimeout(() => {
            dispatchModal.classList.remove('active');
            startMissionNavigation();
          }, 220);
        } else {
          // Chưa vuốt tới ngưỡng -> Trả về ban đầu
          dispatchKnob.style.transition = 'transform 0.25s ease';
          dispatchFill.style.transition = 'width 0.25s ease';
          dispatchKnob.style.transform = 'translateX(0px)';
          dispatchFill.style.width = '0%';
          if (dispatchLabel) {
            dispatchLabel.style.opacity = '1';
          }
        }
      }

      // Gắn sự kiện kéo/vuốt cho thanh Slide-to-Confirm Nhận lệnh
      if (dispatchKnob) {
        dispatchKnob.addEventListener('mousedown', onDispatchDragStart);
        window.addEventListener('mousemove', onDispatchDragMove);
        window.addEventListener('mouseup', onDispatchDragEnd);

        dispatchKnob.addEventListener('touchstart', onDispatchDragStart, { passive: true });
        window.addEventListener('touchmove', onDispatchDragMove, { passive: true });
        window.addEventListener('touchend', onDispatchDragEnd);
      }

      // Bấm nút Xem lệnh ca trên header mặc định
      document.getElementById('btn-header-open-dispatch')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openDispatchAlertPopup();
      });

      // =========================================================================
      // BẮT ĐẦU ĐIỀU XE & MÔ PHỎNG DI CHUYỂN 4 STATE GIỐNG APP TRUNG TÂM
      // =========================================================================
      async function startMissionNavigation() {
        isMissionActive = true;

        // 0. Ẩn Header mặc định khi chuyển sang chế độ dẫn đường chiến thuật
        const defaultHeader = document.getElementById('driver-default-header');
        if (defaultHeader) defaultHeader.style.display = 'none';

        // 1. Hiển thị HUD dẫn đường trên và Dock thông tin dưới
        if (navFloatingHud) navFloatingHud.style.display = 'flex';
        if (missionDock) missionDock.style.display = 'block';
        document.getElementById('driver-map-controls')?.classList.add('in-mission');

        // 2. Nút định vị xe
        const btnRecenter = document.getElementById('btn-driver-recenter');
        if (btnRecenter) {
          btnRecenter.setAttribute('title', 'Định vị lại xe');
        }

        // 3. Header badge: ĐANG ĐẾN HT
        if (badgeHeaderPhase) {
          badgeHeaderPhase.textContent = 'ĐANG ĐẾN HT';
          badgeHeaderPhase.style.background = 'var(--red-primary)';
          badgeHeaderPhase.style.color = '#FFFFFF';
        }

        // 4. Khởi tạo/Đảm bảo Marker Hiện trường và Bệnh viện đích luôn hiển thị
        ensureMissionMarkers();

        // 5. Cập nhật Marker xe sang chế độ Mission (Amber/Hổ phách)
        createVehicleMarker(COORDS.station, '52 km/h', true);

        // 6. Tải tuyến đường OSRM hoặc Fallback
        const [pts1, pts2] = await Promise.all([
          fetchRoadRoute(COORDS.station, COORDS.scene, FALLBACK_LEG1),
          fetchRoadRoute(COORDS.scene, COORDS.hospital, FALLBACK_LEG2)
        ]);

        simState.leg1 = buildPath(pts1);
        simState.leg2 = buildPath(pts2);
        simState.stateNum = 1;
        simState.phase = 'TO_SCENE';
        simState.dist = 0;
        simState.pauseUntil = 0;
        simState.lastTs = 0;
        simState.speedKmH = 52;

        setupMissionPolylines();
        updateStepperUI(1);
        resetSlider(1);

        // Fit khung nhìn bao quát tuyến đường
        try {
          driverMap.fitBounds([COORDS.station, COORDS.scene, COORDS.hospital], {
            padding: [40, 40],
            maxZoom: 15
          });
        } catch (e) {}



        // Bắt đầu vòng lặp chuyển động mượt mà 60fps
        stopSimulation();
        simRafId = requestAnimationFrame(tickSimulation);
      }

      function ensureMissionMarkers() {
        if (!driverMap) return;

        // Tọa độ chính xác theo chặng đường đã tải (hoặc fallback COORDS)
        const scenePt = simState.leg1 ? simState.leg1.ll[simState.leg1.ll.length - 1] : COORDS.scene;
        const hospPt = simState.leg2 ? simState.leg2.ll[simState.leg2.ll.length - 1] : COORDS.hospital;

        // 1. Marker Hiện trường tai nạn (Pulse đỏ)
        if (!sceneMarker) {
          const sceneIcon = window.L.divIcon({
            className: 'map-leaflet-marker',
            html: `
              <div class="map-incident-capsule">
                <span class="legend-dot-pulse"></span>
                <span style="font-weight:700;font-size:11px;color:#fca5a5;letter-spacing:0.3px;">VỊ TRÍ TAI NẠN</span>
              </div>
            `,
            iconSize: [140, 30],
            iconAnchor: [70, 15]
          });

          sceneMarker = window.L.marker(scenePt, { icon: sceneIcon, zIndexOffset: 500 })
            .addTo(driverMap)
            .bindPopup('<b>VỊ TRÍ TAI NẠN</b><br>Chân Cầu Hưng Lợi (hướng Cái Răng sang Ninh Kiều)');
        } else {
          sceneMarker.setLatLng(scenePt);
        }

        // 2. Marker Bệnh viện đích (Thiết kế lại nổi bật, dễ nhìn)
        if (!hospMarker) {
          const hospIcon = window.L.divIcon({
            className: 'map-leaflet-marker',
            html: `
              <div class="map-hosp-hub-badge driver-hosp-pin">
                <div class="map-hosp-shield" style="border-color:#10B981;box-shadow:0 0 16px rgba(16,185,129,0.5);">
                  <div class="map-hosp-cross-icon" style="background:linear-gradient(135deg, #10B981, #047857);box-shadow:0 0 10px rgba(16,185,129,0.8);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </div>
                  <div style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2;">
                    <span class="map-hosp-title-text" style="color:#FFFFFF;font-weight:700;font-size:11.5px;letter-spacing:0.2px;">BVĐK TP CẦN THƠ</span>
                    <span class="map-hosp-bed-chip" style="background:rgba(16,185,129,0.25);color:#34D399;font-weight:600;font-size:10px;padding:1px 5px;border-radius:4px;margin-top:1px;">🏥 ĐÍCH TIẾP NHẬN • SẴN SÀNG</span>
                  </div>
                </div>
              </div>
            `,
            iconSize: [220, 42],
            iconAnchor: [110, 42]
          });

          hospMarker = window.L.marker(hospPt, { icon: hospIcon, zIndexOffset: 300 })
            .addTo(driverMap)
            .bindPopup('<b>BỆNH VIỆN TIẾP NHẬN</b><br>Bệnh viện Đa khoa TP Cần Thơ (Cổng Cấp cứu)');
        } else {
          hospMarker.setLatLng(hospPt);
        }
      }

      function clearRouteLinesOnly() {
        if (!driverMap) return;
        if (routeBgLeg1) {
          driverMap.removeLayer(routeBgLeg1);
          routeBgLeg1 = null;
        }
        if (routeBgLeg2) {
          driverMap.removeLayer(routeBgLeg2);
          routeBgLeg2 = null;
        }
        if (focusLines) {
          if (focusLines.glow1) driverMap.removeLayer(focusLines.glow1);
          if (focusLines.line1) driverMap.removeLayer(focusLines.line1);
          if (focusLines.glow2) driverMap.removeLayer(focusLines.glow2);
          if (focusLines.line2) driverMap.removeLayer(focusLines.line2);
          focusLines = null;
        }
      }

      function setupMissionPolylines() {
        if (!driverMap || !simState.leg1 || !simState.leg2) return;
        const L = window.L;

        // Chỉ xóa tuyến đường cũ (KHÔNG xóa marker bệnh viện và điểm tai nạn)
        clearRouteLinesOnly();

        // Đảm bảo marker Hiện trường và Bệnh viện luôn hiển thị trên bản đồ khi thực hiện nhiệm vụ
        ensureMissionMarkers();

        // 1. Toàn tuyến mờ ở nền (Leg 1 amber, Leg 2 cyan)
        routeBgLeg1 = L.polyline(simState.leg1.ll, {
          color: '#f59e0b',
          weight: 3.5,
          opacity: 0.25,
          dashArray: '6, 8'
        }).addTo(driverMap);

        routeBgLeg2 = L.polyline(simState.leg2.ll, {
          color: '#38bdf8',
          weight: 3.5,
          opacity: 0.25,
          dashArray: '5, 7'
        }).addTo(driverMap);

        // 2. Tuyến sáng trước đầu xe (Co dần lại khi xe di chuyển)
        focusLines = {
          glow1: L.polyline([], { color: '#f59e0b', weight: 8, opacity: 0.3, lineCap: 'round' }).addTo(driverMap),
          line1: L.polyline([], { color: '#fbbf24', weight: 3.5, opacity: 0.95, dashArray: '7, 6', lineCap: 'round' }).addTo(driverMap),
          glow2: L.polyline([], { color: '#0284c7', weight: 8, opacity: 0.3, lineCap: 'round' }).addTo(driverMap),
          line2: L.polyline([], { color: '#38bdf8', weight: 3.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(driverMap)
        };

        updateRemainingPolylines(simState.pos || { latlng: simState.leg1.ll[0], idx: 0 });
      }

      function updateRemainingPolylines(pos) {
        if (!focusLines || !simState.leg1 || !simState.leg2) return;
        const phase = simState.phase;
        const remaining = (leg) => [pos.latlng, ...leg.ll.slice(pos.idx + 1)];

        let rem1 = [], rem2 = [];
        if (phase === 'TO_SCENE') {
          rem1 = remaining(simState.leg1);
          rem2 = simState.leg2.ll;
        } else if (phase === 'PICKUP') {
          rem1 = [];
          rem2 = simState.leg2.ll;
        } else if (phase === 'TO_HOSP') {
          rem1 = [];
          rem2 = remaining(simState.leg2);
        } else {
          rem1 = [];
          rem2 = [];
        }

        focusLines.glow1.setLatLngs(rem1);
        focusLines.line1.setLatLngs(rem1);
        focusLines.glow2.setLatLngs(rem2);
        focusLines.line2.setLatLngs(rem2);
      }

      function stopSimulation() {
        if (simRafId) {
          cancelAnimationFrame(simRafId);
          simRafId = null;
        }
      }

      // =========================================================================
      // VÒNG LẶP TICK SIMULATION: NỘI SUY, XOAY HƯỚNG, CẬP NHẬT TEXT THEO XE
      // =========================================================================
      function tickSimulation(now) {
        if (!isMissionActive) return;

        const m = simState;
        if (!m.leg1 || !m.leg2) {
          simRafId = requestAnimationFrame(tickSimulation);
          return;
        }

        const dt = m.lastTs ? Math.min((now - m.lastTs) / 1000, 0.1) : 0;
        m.lastTs = now;

        // Xử lý tạm dừng ở State 2 (Đón bệnh nhân 3.5 giây tại hiện trường)
        if (m.pauseUntil) {
          if (now < m.pauseUntil) {
            simRafId = requestAnimationFrame(tickSimulation);
            return;
          }
          m.pauseUntil = 0;
          if (m.phase === 'PICKUP') {
            // Chuyển sang State 3: Di chuyển tới viện
            transitionToState(3);
          }
        }

        if (m.phase === 'COMPLETED') {
          return;
        }

        const currentLeg = m.phase === 'TO_SCENE' ? m.leg1 : m.leg2;
        m.dist += SIM_SPEED_MPS * dt;

        // Kiểm tra về đích của từng chặng
        if (m.dist >= currentLeg.total) {
          m.dist = currentLeg.total;
          if (m.phase === 'TO_SCENE') {
            // Vừa đến hiện trường: Chuyển sang State 2
            transitionToState(2, now);
            simRafId = requestAnimationFrame(tickSimulation);
            return;
          } else if (m.phase === 'TO_HOSP') {
            // Vừa đến bệnh viện: Chuyển sang State 4
            transitionToState(4, now);
            return;
          }
        }

        // Lấy vị trí nội suy mượt mà
        m.pos = pointAt(currentLeg, m.dist);
        if (vehMarker && m.pos) {
          vehMarker.setLatLng(m.pos.latlng);
        }

        // Cập nhật đường vẽ co lại trước xe
        updateRemainingPolylines(m.pos);

        // Cập nhật tốc độ dao động ngẫu nhiên 48-56 km/h
        if (now - m.lastSpeedUpdate > 1800) {
          m.lastSpeedUpdate = now;
          if (m.phase === 'PICKUP') {
            updateVehiclePill('Đón BN (3.5s)', true);
          } else if (m.phase === 'COMPLETED') {
            updateVehiclePill('Đã đến Bệnh viện', true);
          } else {
            m.speedKmH = Math.floor(48 + Math.random() * 8);
            updateVehiclePill(`${m.speedKmH} km/h`, true);
          }
        }

        // CẬP NHẬT TOÀN BỘ TEXT THEO TIẾN TRÌNH DI CHUYỂN
        updateNavigationTextsLive(m);

        simRafId = requestAnimationFrame(tickSimulation);
      }

      // Chuyển đổi giữa 4 State
      function transitionToState(targetState, now = performance.now()) {
        const m = simState;
        m.stateNum = targetState;

        if (targetState === 1) {
          // State 1: Xuất phát
          m.phase = 'TO_SCENE';
          m.dist = 0;
          m.pauseUntil = 0;
          updateStepperUI(1);
          resetSlider(1);
          if (badgeHeaderPhase) {
            badgeHeaderPhase.textContent = 'ĐANG ĐẾN HT';
            badgeHeaderPhase.style.background = 'var(--red-primary)';
          }
        } else if (targetState === 2) {
          // State 2: Đến hiện trường
          m.phase = 'PICKUP';
          m.pauseUntil = now + 3500; // Dừng đón bệnh nhân 3.5 giây
          updateStepperUI(2);
          resetSlider(2);
          updateVehiclePill('Đón BN (3.5s)', true);
          if (badgeHeaderPhase) {
            badgeHeaderPhase.textContent = 'TẠI HIỆN TRƯỜNG';
            badgeHeaderPhase.style.background = '#F59E0B';
          }
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        } else if (targetState === 3) {
          // State 3: Di chuyển tới viện
          m.phase = 'TO_HOSP';
          m.dist = 0;
          m.pauseUntil = 0;
          updateStepperUI(3);
          resetSlider(3);
          updateVehiclePill('52 km/h', true);
          if (badgeHeaderPhase) {
            badgeHeaderPhase.textContent = 'CHUYỂN VIỆN';
            badgeHeaderPhase.style.background = '#0284C7';
          }
        } else if (targetState === 4) {
          // State 4: Bàn giao bệnh nhân
          m.phase = 'COMPLETED';
          m.pauseUntil = 0;
          updateStepperUI(4);
          if (badgeHeaderPhase) {
            badgeHeaderPhase.textContent = 'BÀN GIAO';
            badgeHeaderPhase.style.background = '#10B981';
          }
          updateVehiclePill('Đã đến Bệnh viện', true);
          updateNavigationTextsLive(m);

          // Cập nhật thanh trượt hoàn tất
          if (sliderLabel) sliderLabel.textContent = '✔ ĐÃ HOÀN TẤT BÀN GIAO';
          if (sliderFill) sliderFill.style.width = '100%';
          if (sliderKnob) sliderKnob.style.transform = `translateX(${(sliderTrack?.clientWidth || 280) - 50}px)`;

          if (navigator.vibrate) navigator.vibrate([250, 100, 250]);

          // Dừng mô phỏng
          stopSimulation();

          // TỰ ĐỘNG QUAY VỀ MÀN HÌNH MẶC ĐỊNH SAU 2.8 GIÂY
          setTimeout(() => {
            resetToDefaultIdleMap(true);
          }, 2800);
        }
      }

      // =========================================================================
      // CẬP NHẬT LIVE CÁC THÔNG TIN TEXT THEO QUÁ TRÌNH DI CHUYỂN
      // =========================================================================
      function updateNavigationTextsLive(m) {
        if (!navFloatingHud) return;

        if (m.phase === 'TO_SCENE') {
          const remDist = Math.max(0, (m.leg1?.total || 2100) - m.dist);
          const remSec = Math.max(1, Math.round(remDist / SIM_SPEED_MPS));
          const progressRatio = m.leg1?.total ? (m.dist / m.leg1.total) : 0;

          if (navDestType) navDestType.textContent = 'HIỆN TRƯỜNG: CẦU HƯNG LỢI';

          if (progressRatio < 0.3) {
            if (navInstructionDist) navInstructionDist.textContent = 'trong 350 m';
            if (navInstructionText) navInstructionText.textContent = 'Đi thẳng qua Cầu Hưng Lợi';
            if (navNextStreetHint) navNextStreetHint.textContent = 'Chuẩn bị nhập vào đường 30/4';
          } else if (progressRatio < 0.65) {
            if (navInstructionDist) navInstructionDist.textContent = 'trong 280 m';
            if (navInstructionText) navInstructionText.textContent = 'Đi thẳng trục đường 30/4';
            if (navNextStreetHint) navNextStreetHint.textContent = 'Chuẩn bị rẽ phải vào đường Trần Văn Hoài';
          } else if (progressRatio < 0.85) {
            if (navInstructionDist) navInstructionDist.textContent = 'trong 150 m';
            if (navInstructionText) navInstructionText.textContent = 'Rẽ phải vào Trần Văn Hoài';
            if (navNextStreetHint) navNextStreetHint.textContent = 'Đi tiếp 120m rẽ trái sang đường 3/2';
          } else {
            if (navInstructionDist) navInstructionDist.textContent = 'trong 50 m';
            if (navInstructionText) navInstructionText.textContent = 'Đi thẳng đường 3/2 đến Cổng ĐHCT';
            if (navNextStreetHint) navNextStreetHint.textContent = 'Hiện trường tai nạn ở làn bên phải';
          }

          if (navTelemetrySpeed) navTelemetrySpeed.textContent = `● ${m.speedKmH || 52} km/h`;
          if (navTelemetryDist) navTelemetryDist.textContent = remDist > 300 ? `Còn ${(remDist / 1000).toFixed(1)} km` : `Còn ${Math.round(remDist)} m`;
          if (navTelemetryEta) navTelemetryEta.textContent = remSec > 60 ? `ETA ~${Math.ceil(remSec / 60)} phút` : `ETA ${remSec} giây`;

        } else if (m.phase === 'PICKUP') {
          if (navDestType) navDestType.textContent = 'HIỆN TRƯỜNG: CHÂN CẦU HƯNG LỢI';
          if (navInstructionDist) navInstructionDist.textContent = '0 m';
          if (navInstructionText) navInstructionText.textContent = 'ĐÃ ĐẾN HIỆN TRƯỜNG - ĐÓN BỆNH NHÂN';
          if (navNextStreetHint) navNextStreetHint.textContent = 'Kíp cấp cứu đang cố định và chuyển bệnh nhân lên xe';
          if (navTelemetrySpeed) navTelemetrySpeed.textContent = '● 0 km/h';
          if (navTelemetryDist) navTelemetryDist.textContent = 'Còn 0 m';
          if (navTelemetryEta) navTelemetryEta.textContent = 'Tại hiện trường';

        } else if (m.phase === 'TO_HOSP') {
          const remDist = Math.max(0, (m.leg2?.total || 2400) - m.dist);
          const remSec = Math.max(1, Math.round(remDist / SIM_SPEED_MPS));
          const progressRatio = m.leg2?.total ? (m.dist / m.leg2.total) : 0;

          if (navDestType) navDestType.textContent = 'BỆNH VIỆN ĐA KHOA THÀNH PHỐ CẦN THƠ';

          if (progressRatio < 0.4) {
            if (navInstructionDist) navInstructionDist.textContent = 'trong 400 m';
            if (navInstructionText) navInstructionText.textContent = 'Đi thẳng trục đường 3/2';
            if (navNextStreetHint) navNextStreetHint.textContent = 'Chuẩn bị rẽ vào Nguyễn Văn Linh';
          } else if (progressRatio < 0.75) {
            if (navInstructionDist) navInstructionDist.textContent = 'trong 250 m';
            if (navInstructionText) navInstructionText.textContent = 'Rẽ phải vào đường Nguyễn Văn Linh';
            if (navNextStreetHint) navNextStreetHint.textContent = 'Chạy thẳng theo hướng Bệnh viện Đa khoa thành phố Cần Thơ';
          } else {
            if (navInstructionDist) navInstructionDist.textContent = 'trong 80 m';
            if (navInstructionText) navInstructionText.textContent = 'Rẽ vào Cổng Cấp Cứu Bệnh viện Đa khoa';
            if (navNextStreetHint) navNextStreetHint.textContent = 'Lối xe cứu thương vào sảnh cấp cứu tiếp nhận';
          }

          if (navTelemetrySpeed) navTelemetrySpeed.textContent = `● ${m.speedKmH || 50} km/h`;
          if (navTelemetryDist) navTelemetryDist.textContent = remDist > 300 ? `Còn ${(remDist / 1000).toFixed(1)} km` : `Còn ${Math.round(remDist)} m`;
          if (navTelemetryEta) navTelemetryEta.textContent = remSec > 60 ? `ETA ~${Math.ceil(remSec / 60)} phút` : `ETA ${remSec} giây`;

        } else if (m.phase === 'COMPLETED') {
          if (navDestType) navDestType.textContent = 'BỆNH VIỆN ĐA KHOA THÀNH PHỐ CẦN THƠ';
          if (navInstructionDist) navInstructionDist.textContent = '0 m';
          if (navInstructionText) navInstructionText.textContent = 'ĐÃ ĐẾN BỆNH VIỆN - HOÀN TẤT BÀN GIAO';
          if (navNextStreetHint) navNextStreetHint.textContent = 'Đã bàn giao hồ sơ & bệnh nhân cho Khoa Cấp cứu';
          if (navTelemetrySpeed) navTelemetrySpeed.textContent = '● 0 km/h';
          if (navTelemetryDist) navTelemetryDist.textContent = 'Đã đến Bệnh viện';
          if (navTelemetryEta) navTelemetryEta.textContent = 'Hoàn tất ca';
        }
      }

      // =========================================================================
      // STEPPER & SLIDE-TO-CONFIRM CONTROLS (TƯƠNG TÁC CHUYỂN MỐC)
      // =========================================================================
      function updateStepperUI(activeStepNum) {
        stepperCols.forEach(col => {
          const s = parseInt(col.getAttribute('data-step'), 10);
          col.classList.remove('active', 'done');
          if (s < activeStepNum) {
            col.classList.add('done');
          } else if (s === activeStepNum) {
            col.classList.add('active');
          }
        });
      }

      function resetSlider(stepNum) {
        if (!sliderKnob || !sliderFill || !sliderLabel) return;
        sliderKnob.style.transform = 'translateX(0px)';
        sliderFill.style.width = '0%';

        const labels = {
          1: 'VUỐT SANG PHẢI: ĐÃ ĐẾN HIỆN TRƯỜNG',
          2: 'VUỐT SANG PHẢI: XUẤT PHÁT ĐẾN VIỆN',
          3: 'VUỐT SANG PHẢI: HOÀN TẤT BÀN GIAO',
          4: '✔ ĐÃ HOÀN TẤT CA CẤP CỨU'
        };
        sliderLabel.textContent = labels[stepNum] || 'VUỐT ĐỂ XÁC NHẬN';
      }

      // Bấm trực tiếp vào các mốc trên Stepper để đổi mốc tiến trình (chỉ đổi status, không ảnh hưởng gì khác)
      stepperCols.forEach(col => {
        col.addEventListener('click', () => {
          if (!isMissionActive) return;
          const targetStep = parseInt(col.getAttribute('data-step'), 10);
          if (targetStep >= 1 && targetStep <= 4) {
            updateStepperUI(targetStep);
            resetSlider(targetStep);
          }
        });
      });

      // Vuốt thanh Slide-To-Confirm
      let isDragging = false;
      let startX = 0;
      let currentDragX = 0;

      function onDragStart(e) {
        if (!isMissionActive || simState.phase === 'COMPLETED') return;
        isDragging = true;
        startX = (e.touches ? e.touches[0].clientX : e.clientX);
        sliderKnob.style.transition = 'none';
        sliderFill.style.transition = 'none';
      }

      function onDragMove(e) {
        if (!isDragging) return;
        const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
        const maxDist = (sliderTrack.clientWidth || 300) - (sliderKnob.clientWidth || 50) - 6;
        currentDragX = Math.max(0, Math.min(clientX - startX, maxDist));
        sliderKnob.style.transform = `translateX(${currentDragX}px)`;
        sliderFill.style.width = `${(currentDragX / maxDist) * 100}%`;
      }

      function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;
        sliderKnob.style.transition = 'transform 0.25s ease';
        sliderFill.style.transition = 'width 0.25s ease';

        const maxDist = (sliderTrack.clientWidth || 300) - (sliderKnob.clientWidth || 50) - 6;
        if (currentDragX >= maxDist * 0.75) {
          // Kéo đủ xa -> Chỉ cập nhật trạng thái của tiến trình 1 2 3 4
          if (navigator.vibrate) navigator.vibrate(80);

          let currentStep = 1;
          stepperCols.forEach(col => {
            if (col.classList.contains('active')) {
              currentStep = parseInt(col.getAttribute('data-step'), 10) || 1;
            }
          });

          const nextStep = Math.min(4, currentStep + 1);
          updateStepperUI(nextStep);

          if (nextStep === 4) {
            sliderKnob.style.transform = `translateX(${maxDist}px)`;
            sliderFill.style.width = '100%';
            if (sliderLabel) sliderLabel.textContent = '✔ ĐÃ BÀN GIAO BỆNH NHÂN';
          } else {
            resetSlider(nextStep);
          }
        } else {
          // Trả về vị trí cũ
          sliderKnob.style.transform = 'translateX(0px)';
          sliderFill.style.width = '0%';
        }
      }

      sliderKnob?.addEventListener('mousedown', onDragStart);
      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('mouseup', onDragEnd);

      sliderKnob?.addEventListener('touchstart', onDragStart, { passive: true });
      window.addEventListener('touchmove', onDragMove, { passive: true });
      window.addEventListener('touchend', onDragEnd);

      // =========================================================================
      // DOCK MỞ RỘNG / THU GỌN
      // =========================================================================
      function toggleMissionDock(forceOpen) {
        if (!dockDetails) return;
        const isCurrentlyOpen = dockDetails.style.display !== 'none';
        const willOpen = forceOpen !== undefined ? forceOpen : !isCurrentlyOpen;

        dockDetails.style.display = willOpen ? 'block' : 'none';
        if (missionDock) missionDock.classList.toggle('expanded', willOpen);

        if (dockExpandIcon) dockExpandIcon.textContent = willOpen ? '▼' : '▲';
        if (btnToggleSheet) btnToggleSheet.classList.toggle('active', willOpen);
        if (navigator.vibrate) navigator.vibrate(25);
      }

      btnDockExpand?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMissionDock();
      });

      dockHandle?.addEventListener('click', () => {
        toggleMissionDock();
      });

      btnToggleSheet?.addEventListener('click', () => {
        toggleMissionDock();
      });

      // Nút SOS: Không có tương tác gì theo yêu cầu
      btnDriverSos?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      // Modal Đổi xe (Vehicle Switcher)
      const vehModal = document.getElementById('modal-vehicle-picker');
      const btnOpenVeh = document.getElementById('btn-open-vehicle-picker');
      const btnCloseVeh = document.getElementById('btn-close-veh-modal');
      const vehListEl = document.getElementById('vehicle-picker-list');

      function renderVehiclePicker() {
        if (!vehListEl) return;
        const vehicles = state.vehicles || [];
        vehListEl.innerHTML = vehicles.map(v => `
          <div class="bottom-sheet-reason-btn ${v.plate === currentPlate ? 'selected' : ''}" data-plate="${v.plate}" style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <strong style="color:#FFFFFF;font-family:var(--font-mono);font-size:13.5px;">${v.plate}</strong>
              <div style="font-size:11.5px;color:#94A3B8;">${v.type} · ${v.station || 'Trạm Cần Thơ'}</div>
            </div>
            <span class="badge ${v.status === 'EMERGENCY' ? 'badge-emergency' : 'badge-success'}" style="font-size:10px;">
              ${v.statusText || 'Sẵn sàng'}
            </span>
          </div>
        `).join('');

        vehListEl.querySelectorAll('.bottom-sheet-reason-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const plate = btn.getAttribute('data-plate');
            currentPlate = plate;
            const headerPlate = document.getElementById('header-plate-text');
            if (headerPlate) headerPlate.textContent = plate;
            vehModal.classList.remove('active');
            renderCaseAndPatient(getActiveCase());
            if (window.CCNV_UI?.Toast) {
              window.CCNV_UI.Toast.show('Đã đổi phương tiện', `Giao diện đang gắn với xe cứu thương ${plate}.`);
            }
          });
        });
      }

      btnOpenVeh?.addEventListener('click', () => {
        renderVehiclePicker();
        vehModal?.classList.add('active');
      });

      btnCloseVeh?.addEventListener('click', () => {
        vehModal?.classList.remove('active');
      });

      // Web Audio API Synthesizer for Emergency Alarm
      function playEmergencyAlarm() {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(750, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1250, ctx.currentTime + 0.3);
          osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.6);
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.85);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.85);
        } catch (e) {
          console.warn('AudioContext not allowed without user gesture yet:', e);
        }
      }

      // Audio summary player for patient info & call recording
      let summaryAudioObj = null;
      let isAudioPlaying = false;

      window.playPatientAudioSummary = function() {
        const floatAudioBtn = document.getElementById('driver-btn-audio-summary');
        
        // Nếu đang phát thì nhấn lại để dừng
        if (isAudioPlaying) {
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          if (summaryAudioObj) {
            summaryAudioObj.pause();
            summaryAudioObj.currentTime = 0;
          }
          isAudioPlaying = false;
          if (floatAudioBtn) floatAudioBtn.classList.remove('is-playing');
          return;
        }

        const pName = document.getElementById('driver-patient-name')?.innerText || 'Phan Văn Đức';
        const pDemo = document.getElementById('driver-patient-demographics')?.innerText || '58 tuổi, Nam';
        const pSymp = document.getElementById('driver-patient-symptoms')?.innerText || 'Chấn thương sọ não, đa chấn thương phần mềm';
        const pLoc = document.getElementById('driver-scene-address')?.innerText || 'Chân Cầu Hưng Lợi (hướng Cái Răng sang Ninh Kiều)';

        const textToSpeech = `Tóm tắt ca cấp cứu: Bệnh nhân ${pName}, ${pDemo}. Tình trạng: ${pSymp}. Vị trí hiện trường: ${pLoc}. Bệnh viện tiếp nhận dự kiến: Bệnh viện Đa khoa thành phố Cần Thơ. Đang phát lại đoạn ghi âm cuộc gọi tiếp nhận tin báo từ tổng đài 115.`;

        isAudioPlaying = true;
        if (floatAudioBtn) floatAudioBtn.classList.add('is-playing');

        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(textToSpeech);
          utterance.lang = 'vi-VN';
          utterance.rate = 0.95;
          utterance.onend = () => {
            isAudioPlaying = false;
            if (floatAudioBtn) floatAudioBtn.classList.remove('is-playing');
          };
          utterance.onerror = () => {
            isAudioPlaying = false;
            if (floatAudioBtn) floatAudioBtn.classList.remove('is-playing');
          };
          window.speechSynthesis.speak(utterance);
        } else {
          // Fallback nếu trình duyệt không hỗ trợ Web Speech
          setTimeout(() => {
            isAudioPlaying = false;
            if (floatAudioBtn) floatAudioBtn.classList.remove('is-playing');
          }, 8000);
        }
      };

      // Ghi âm gửi trước cho Bệnh viện tiếp nhận
      let isHospitalRecording = false;

      function toggleRecordForHospital() {
        const floatRecBtn = document.getElementById('driver-btn-record-hospital');
        const dockRecBtn = document.getElementById('btn-record-hospital-dock');
        const dockRecLabel = document.getElementById('dock-rec-label');

        isHospitalRecording = !isHospitalRecording;

        if (isHospitalRecording) {
          // Bắt đầu ghi âm
          if (floatRecBtn) {
            floatRecBtn.classList.add('is-recording');
            floatRecBtn.setAttribute('title', 'Đang ghi âm cho BV... Bấm để dừng & gửi');
          }
          if (dockRecBtn) {
            dockRecBtn.style.color = '#EF4444';
            dockRecBtn.style.borderColor = 'rgba(239,68,68,0.5)';
            dockRecBtn.style.background = 'rgba(239,68,68,0.15)';
          }
          if (dockRecLabel) dockRecLabel.textContent = 'Đang ghi âm...';
          if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
        } else {
          // Dừng và gửi ghi âm cho bệnh viện
          if (floatRecBtn) {
            floatRecBtn.classList.remove('is-recording');
            floatRecBtn.setAttribute('title', 'Ghi âm báo trước cho Bệnh viện tiếp nhận');
          }
          if (dockRecBtn) {
            dockRecBtn.style.color = '#34D399';
            dockRecBtn.style.borderColor = 'rgba(16,185,129,0.35)';
            dockRecBtn.style.background = 'rgba(8, 22, 38, 0.95)';
          }
          if (dockRecLabel) dockRecLabel.textContent = 'Đã gửi ghi âm';
          if (navigator.vibrate) navigator.vibrate([80, 50, 80]);

          setTimeout(() => {
            if (dockRecLabel && !isHospitalRecording) {
              dockRecLabel.textContent = 'Ghi âm cho BV';
            }
          }, 2500);
        }
      }

      document.getElementById('driver-btn-record-hospital')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleRecordForHospital();
      });

      document.getElementById('btn-record-hospital-dock')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleRecordForHospital();
      });

      // Gắn sự kiện click cho nút tròn nghe tóm tắt trên nút SOS
      document.getElementById('driver-btn-audio-summary')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.playPatientAudioSummary();
      });

      // Khởi động bản đồ Leaflet
      setTimeout(() => {
        initDriverMap();
      }, 50);
    });