/**
 * CCNV CENTRAL COMMAND APPLICATION LOGIC
 * Manages Dispatcher View (TT-01 to TT-21, TT-D1..8, TT-Q1..4)
 * and Receiving Hospital View (BV-01 to BV-07) with seamless role switching.
 */

(function (window) {
  'use strict';

  class CentralApp {
    constructor() {
      this.currentMenu = 'realtime-map';
      this.mapInstance = null;
      this.activeTabCaseDetail = 'tab-overview';
      this.activeIncomingCall = null;
      this.selectedCaseId = null;
    }

    async init() {
      // 1. Initialize State
      await window.StateManager.init();
      
      // 2. Start Header Clock
      this.initClock();

      // 3. Render Header User Profile & Initialize Dedicated Login Screen
      this.initLoginScreen();
      this.updateHeaderProfile();

      // 4. Render Sidebar based on current user role
      this.renderSidebar();

      // 5. Update KPI Bar
      this.updateKpiBar();

      // 6. Mount Current View
      this.renderCurrentView();

      // 7. Bind Global Events & Demo Controls
      this.bindGlobalEvents();

      // 8. Listen to state changes
      window.StateManager.subscribe((event, payload) => {
        this.updateKpiBar();
        this.renderSidebarBadges();
        if (event === 'USER_CHANGED') {
          this.renderSidebar();
          // Reset default menu for role
          const role = window.StateManager.getCurrentUser()?.role;
          this.currentMenu = (role === 'HOSPITAL_RECEIVER') ? 'hospital-incoming' : 'realtime-map';
          this.renderCurrentView();
        } else if (event === 'CASE_CREATED' || event === 'CASE_UPDATED') {
          if (this.currentMenu === 'cases-list' || this.currentMenu === 'hospital-incoming') {
            this.renderCurrentView();
          }
        }
      });
    }

    initClock() {
      const update = () => {
        const now = new Date();
        const timeEl = document.getElementById('header-live-clock');
        const dateEl = document.getElementById('header-live-date');
        if (timeEl) {
          timeEl.textContent = now.toTimeString().split(' ')[0];
        }
        if (dateEl) {
          const d = String(now.getDate()).padStart(2, '0');
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const y = now.getFullYear();
          dateEl.textContent = `${d}/${m}/${y}`;
        }
      };
      update();
      setInterval(update, 1000);
    }

    initLoginScreen() {
      const loginOverlay = document.getElementById('login-screen-overlay');
      const loginForm = document.getElementById('login-form');
      const quickList = document.getElementById('login-quick-accounts-list');
      const state = window.StateManager.getState();
      if (!loginOverlay || !state) return;

      const loggedInUserId = sessionStorage.getItem('ccnv_logged_in_user');
      if (loggedInUserId && state.accounts.some(a => a.id === loggedInUserId)) {
        window.StateManager.setCurrentUser(loggedInUserId);
        loginOverlay.classList.add('hidden');
      } else {
        loginOverlay.classList.remove('hidden');
      }

      // Populate Quick Accounts
      if (quickList) {
        quickList.innerHTML = state.accounts.map(acc => {
          const isDisp = acc.role === 'DISPATCHER';
          return `
            <button type="button" class="login-quick-account-btn" data-account-id="${acc.id}">
              <div>
                <div class="login-acc-name">${acc.fullName}</div>
                <div class="login-acc-role">${acc.roleName} · ${acc.organization}</div>
              </div>
              <span class="login-acc-tag" style="background:${isDisp ? 'rgba(59, 130, 246, 0.18)' : 'rgba(16, 185, 129, 0.18)'};color:${isDisp ? '#60A5FA' : '#34D399'};border:1px solid ${isDisp ? '#2563EB' : '#059669'};">
                ${isDisp ? 'TRUNG TÂM 115' : 'BỆNH VIỆN TIẾP NHẬN'}
              </span>
            </button>
          `;
        }).join('');

        quickList.querySelectorAll('.login-quick-account-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const accId = btn.getAttribute('data-account-id');
            this.loginAs(accId);
          });
        });
      }

      // Handle Form Submit
      if (loginForm && !loginForm._bound) {
        loginForm._bound = true;
        loginForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const usernameInput = document.getElementById('login-username-input');
          const val = usernameInput ? usernameInput.value.trim() : 'dpv01';
          const matched = state.accounts.find(a => a.username.toLowerCase() === val.toLowerCase() || a.id.toLowerCase() === val.toLowerCase()) || state.accounts[0];
          this.loginAs(matched.id);
        });
      }
    }

    loginAs(accountId) {
      const state = window.StateManager.getState();
      const acc = state.accounts.find(a => a.id === accountId) || state.accounts[0];
      sessionStorage.setItem('ccnv_logged_in_user', acc.id);
      window.StateManager.setCurrentUser(acc.id);

      const loginOverlay = document.getElementById('login-screen-overlay');
      if (loginOverlay) loginOverlay.classList.add('hidden');

      this.updateHeaderProfile();
      this.renderSidebar();
      
      const role = acc.role;
      this.currentMenu = (role === 'HOSPITAL_RECEIVER') ? 'hospital-incoming' : 'realtime-map';
      this.renderCurrentView();

      window.CCNV_UI.Toast.show(
        'Đăng nhập thành công',
        `Chào mừng ${acc.fullName} (${acc.roleName} · ${acc.organization})`
      );
    }

    updateHeaderProfile() {
      const user = window.StateManager.getCurrentUser();
      if (!user) return;

      const avatarEl = document.getElementById('header-user-avatar');
      const nameEl = document.getElementById('header-user-name');
      const roleEl = document.getElementById('header-user-role');
      const logoutBtn = document.getElementById('btn-logout');

      if (avatarEl) avatarEl.textContent = user.avatar || user.fullName.split(' ').pop().slice(0, 2).toUpperCase();
      if (nameEl) nameEl.textContent = user.fullName;
      if (roleEl) roleEl.textContent = user.role === 'DISPATCHER' ? 'Điều phối viên 115' : 'Tiếp nhận BV';

      if (logoutBtn && !logoutBtn._bound) {
        logoutBtn._bound = true;
        logoutBtn.addEventListener('click', () => {
          sessionStorage.removeItem('ccnv_logged_in_user');
          const loginOverlay = document.getElementById('login-screen-overlay');
          if (loginOverlay) loginOverlay.classList.remove('hidden');
          window.CCNV_UI.Toast.show('Đã đăng xuất', 'Vui lòng chọn hoặc nhập tài khoản để đăng nhập lại.');
        });
      }
    }

    updateKpiBar() {
      const state = window.StateManager.getState();
      if (!state) return;

      const vehicles = state.vehicles || [];
      const totalVehicles = vehicles.length;
      const activeVehicles = vehicles.filter(v => v.status !== 'MAINTENANCE').length;
      const movingVehicles = vehicles.filter(v => v.speed > 0).length;
      const emergencyVehicles = vehicles.filter(v => v.status === 'EMERGENCY').length;
      const disconnectedVehicles = vehicles.filter(v => v.gpsStatus !== 'ONLINE').length;
      const gpsWarnings = vehicles.filter(v => v.gpsSignal === 'FAIR' || v.gpsSignal === 'POOR').length;

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val).padStart(2, '0');
      };

      setVal('kpi-total-vehicles', totalVehicles);
      setVal('kpi-active-vehicles', activeVehicles);
      setVal('kpi-moving-vehicles', movingVehicles);
      setVal('kpi-emergency-vehicles', emergencyVehicles);
      setVal('kpi-disconnected-vehicles', disconnectedVehicles);
      setVal('kpi-gps-warnings', gpsWarnings);

      const totalFormatted = String(totalVehicles).padStart(2, '0');
      document.querySelectorAll('.kpi-max-total').forEach(el => {
        el.textContent = totalFormatted;
      });
    }

    renderSidebar() {
      const sidebarContainer = document.getElementById('sidebar-menu-wrapper');
      const sidebarEl = document.getElementById('main-command-sidebar');
      const toggleBtn = document.getElementById('btn-toggle-sidebar');
      if (!sidebarContainer) return;

      const currentUser = window.StateManager.getCurrentUser();
      const isHospital = currentUser?.role === 'HOSPITAL_RECEIVER';
      const chevronSvg = `<svg class="nav-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

      // Initialize collapse toggle button event
      if (toggleBtn && !toggleBtn._bound) {
        toggleBtn._bound = true;
        toggleBtn.addEventListener('click', () => {
          if (sidebarEl) {
            sidebarEl.classList.toggle('collapsed');
            const isCollapsed = sidebarEl.classList.contains('collapsed');
            sessionStorage.setItem('ccnv_sidebar_collapsed', isCollapsed ? '1' : '0');
          }
        });
      }

      // Restore collapsed state
      if (sessionStorage.getItem('ccnv_sidebar_collapsed') === '1' && sidebarEl) {
        sidebarEl.classList.add('collapsed');
      }

      let html = '';

      if (!isHospital) {
        // --- DISPATCHER ACCORDION (TRUNG TÂM ĐIỀU HÀNH) ---
        const isMonitoringActive = ['realtime-map', 'vehicles-status', 'crews-status', 'hospitals-status'].includes(this.currentMenu);
        const isEmergencyActive = ['cases-list', 'coordination', 'case-lookup'].includes(this.currentMenu);
        const isCallCenterActive = this.currentMenu === 'call-center';
        const isShiftsActive = this.currentMenu === 'shifts-schedule';
        const isReportsActive = this.currentMenu === 'reports';
        const isCategoriesActive = this.currentMenu === 'categories';
        const isAdminActive = this.currentMenu === 'admin';

        html = `
          <!-- 1. GIÁM SÁT (Parent with Sub-items) -->
          <div class="nav-parent-item ${isMonitoringActive ? 'active expanded' : ''}" data-nav-group="monitoring" title="Giám sát">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.eye}</span>
            <span class="nav-parent-label">Giám sát</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'realtime-map' ? 'active' : ''}" data-menu="realtime-map">Bản đồ Realtime (GIS)</div>
            <div class="nav-subitem ${this.currentMenu === 'vehicles-status' ? 'active' : ''}" data-menu="vehicles-status">Tình trạng Xe cứu thương</div>
            <div class="nav-subitem ${this.currentMenu === 'crews-status' ? 'active' : ''}" data-menu="crews-status">Tình trạng Kíp trực</div>
            <div class="nav-subitem ${this.currentMenu === 'hospitals-status' ? 'active' : ''}" data-menu="hospitals-status">Tình trạng Bệnh viện</div>
          </div>

          <!-- 2. QUẢN LÝ CẤP CỨU (Parent with Sub-items) -->
          <div class="nav-parent-item ${isEmergencyActive ? 'active expanded' : ''}" data-nav-group="emergency" title="Quản lý Cấp cứu">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.ambulance}</span>
            <span class="nav-parent-label">Quản lý Cấp cứu</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'cases-list' ? 'active' : ''}" data-menu="cases-list">Danh sách Ca đang xử lý</div>
            <div class="nav-subitem ${this.currentMenu === 'coordination' ? 'active' : ''}" data-menu="coordination">Liên lạc & Phối hợp</div>
            <div class="nav-subitem ${this.currentMenu === 'case-lookup' ? 'active' : ''}" data-menu="case-lookup">Tra cứu Hồ sơ</div>
          </div>

          <!-- 3. TỔNG ĐÀI 115 (Leaf item) -->
          <div class="nav-parent-item ${isCallCenterActive ? 'active' : ''}" data-menu="call-center" title="Tổng đài & Cuộc gọi 115">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.phone}</span>
            <span class="nav-parent-label">Tổng đài & Cuộc gọi 115</span>
          </div>

          <!-- 4. LỊCH TRỰC & CA KÍP (Leaf item) -->
          <div class="nav-parent-item ${isShiftsActive ? 'active' : ''}" data-menu="shifts-schedule" title="Phân công & Lịch trực">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.calendar}</span>
            <span class="nav-parent-label">Phân công & Lịch trực</span>
          </div>

          <!-- 5. BÁO CÁO (Parent with Sub-items) -->
          <div class="nav-parent-item ${isReportsActive ? 'active expanded' : ''}" data-nav-group="reports" title="Báo cáo">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.barChart}</span>
            <span class="nav-parent-label">Báo cáo</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'reports' ? 'active' : ''}" data-menu="reports">Báo cáo Tổng quan (KPI)</div>
          </div>

          <!-- 6. DANH MỤC HỆ THỐNG (Leaf item) -->
          <div class="nav-parent-item ${isCategoriesActive ? 'active' : ''}" data-menu="categories" title="Thiết bị & Danh mục">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.layers}</span>
            <span class="nav-parent-label">Thiết bị & Danh mục</span>
          </div>

          <!-- 7. CÀI ĐẶT & QUẢN TRỊ (Parent with Sub-items) -->
          <div class="nav-parent-item ${isAdminActive ? 'active expanded' : ''}" data-nav-group="admin" title="Cài đặt & Quản trị">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.settings}</span>
            <span class="nav-parent-label">Cài đặt & Quản trị</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'admin' ? 'active' : ''}" data-menu="admin">Nhật ký Thao tác (Audit Log)</div>
          </div>
        `;
      } else {
        // --- HOSPITAL ACCORDION (TIẾP NHẬN BỆNH VIỆN) ---
        const isIncomingActive = ['hospital-incoming', 'hospital-handover', 'hospital-epcr'].includes(this.currentMenu);
        const isHospReportActive = this.currentMenu === 'hospital-reports';

        html = `
          <!-- 1. TIẾP NHẬN CẤP CỨU -->
          <div class="nav-parent-item ${isIncomingActive ? 'active expanded' : ''}" data-nav-group="hospital-flow" title="Tiếp nhận Cấp cứu">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.hospital}</span>
            <span class="nav-parent-label">Tiếp nhận Cấp cứu</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'hospital-incoming' ? 'active' : ''}" data-menu="hospital-incoming">Ca đang đến BV</div>
            <div class="nav-subitem ${this.currentMenu === 'hospital-handover' ? 'active' : ''}" data-menu="hospital-handover">Bàn giao & Check-in</div>
            <div class="nav-subitem ${this.currentMenu === 'hospital-epcr' ? 'active' : ''}" data-menu="hospital-epcr">Hồ sơ ePCR tiếp nhận</div>
          </div>

          <!-- 2. BÁO CÁO BỆNH VIỆN -->
          <div class="nav-parent-item ${isHospReportActive ? 'active' : ''}" data-menu="hospital-reports" title="Báo cáo Tiếp nhận BV">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.barChart}</span>
            <span class="nav-parent-label">Báo cáo Tiếp nhận BV</span>
          </div>
        `;
      }

      sidebarContainer.innerHTML = html;

      // 1. Accordion Toggle for Parent Items
      sidebarContainer.querySelectorAll('.nav-parent-item[data-nav-group]').forEach(parent => {
        parent.addEventListener('click', (e) => {
          // If sidebar is collapsed, expand it on click
          if (sidebarEl && sidebarEl.classList.contains('collapsed')) {
            sidebarEl.classList.remove('collapsed');
            sessionStorage.setItem('ccnv_sidebar_collapsed', '0');
          }
          parent.classList.toggle('expanded');
        });
      });

      // 2. Click handler for Single Parent Items (Leaf items without sub-items)
      sidebarContainer.querySelectorAll('.nav-parent-item[data-menu]').forEach(item => {
        item.addEventListener('click', () => {
          sidebarContainer.querySelectorAll('.nav-parent-item, .nav-subitem').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          this.currentMenu = item.getAttribute('data-menu');
          this.renderCurrentView();
        });
      });

      // 3. Click handler for Subitems
      sidebarContainer.querySelectorAll('.nav-subitem').forEach(subitem => {
        subitem.addEventListener('click', (e) => {
          e.stopPropagation();
          sidebarContainer.querySelectorAll('.nav-parent-item, .nav-subitem').forEach(el => el.classList.remove('active'));
          subitem.classList.add('active');

          // Highlight parent
          const parent = subitem.closest('.nav-submenu')?.previousElementSibling;
          if (parent && parent.classList.contains('nav-parent-item')) {
            parent.classList.add('active');
            parent.classList.add('expanded');
          }

          this.currentMenu = subitem.getAttribute('data-menu');
          this.renderCurrentView();
        });
      });

      this.renderSidebarBadges();
    }

    renderSidebarBadges() {
      // Kept clean without cluttering
    }

    renderCurrentView() {
      const container = document.getElementById('main-content-viewport');
      if (!container) return;

      // Clean up previous map if switching away
      if (this.mapInstance && this.currentMenu !== 'realtime-map') {
        this.mapInstance.destroy();
        this.mapInstance = null;
      }

      const menuTitles = {
        'realtime-map': 'Bản đồ Realtime (GIS)',
        'call-center': 'Tổng đài Tiếp nhận Khẩn cấp 115',
        'cases-list': 'Danh sách Ca Cấp cứu đang xử lý',
        'coordination': 'Liên lạc & Phối hợp Liên ngành',
        'case-lookup': 'Tra cứu Hồ sơ Ca Cấp cứu',
        'vehicles-status': 'Tình trạng Xe cứu thương',
        'crews-status': 'Tình trạng Kíp trực',
        'hospitals-status': 'Mạng lưới Bệnh viện Tiếp nhận',
        'shifts-schedule': 'Phân công & Lịch trực Ban',
        'reports': 'Báo cáo Tổng hợp & Đo lường KPI',
        'categories': 'Danh mục Dữ liệu dùng chung',
        'admin': 'Quản trị Hệ thống & Nhật ký Thao tác',
        'hospital-incoming': 'Khoa Cấp cứu — Tiếp nhận Ca đang đến',
        'hospital-handover': 'Biên bản Bàn giao & Tiếp nhận Bệnh nhân',
        'hospital-epcr': 'Hồ sơ Bệnh án Điện tử ePCR',
        'hospital-reports': 'Báo cáo Tiếp nhận Cấp cứu Bệnh viện'
      };

      const titleEl = document.getElementById('header-breadcrumb-title');
      if (titleEl) {
        titleEl.textContent = '';
      }

      switch (this.currentMenu) {
        case 'realtime-map':
          this.renderRealtimeMapView(container);
          break;
        case 'call-center':
          this.renderCallCenterView(container);
          break;
        case 'cases-list':
          this.renderCasesListView(container);
          break;
        case 'coordination':
          this.renderCoordinationView(container);
          break;
        case 'case-lookup':
          this.renderCaseLookupView(container);
          break;
        case 'vehicles-status':
          this.renderVehiclesStatusView(container);
          break;
        case 'crews-status':
          this.renderCrewsStatusView(container);
          break;
        case 'hospitals-status':
          this.renderHospitalsStatusView(container);
          break;
        case 'shifts-schedule':
          this.renderShiftsScheduleView(container);
          break;
        case 'reports':
          this.renderReportsView(container);
          break;
        case 'categories':
          this.renderCategoriesView(container);
          break;
        case 'admin':
          this.renderAdminView(container);
          break;
        // Hospital Specific Views:
        case 'hospital-incoming':
          this.renderHospitalIncomingView(container);
          break;
        case 'hospital-handover':
          this.renderHospitalHandoverView(container);
          break;
        case 'hospital-epcr':
          this.renderHospitalEPCRView(container);
          break;
        case 'hospital-reports':
          this.renderHospitalReportsView(container);
          break;
        default:
          this.renderRealtimeMapView(container);
      }
    }

    // --- 1. REALTIME MAP VIEW (COMMAND CENTER CORE) ---
    renderRealtimeMapView(container) {
      const state = window.StateManager.getState();
      const vehicles = state.vehicles || [];

      container.innerHTML = `
        <div class="command-viewport">
          <!-- Left: Realtime Map (~60% Space) -->
          <div class="map-area-container">
            <div class="map-toolbar">
              <div class="map-title">
                ${window.CCNV_UI.ICONS.map}
                <span>BẢN ĐỒ GIÁM SÁT THỜI GIAN THỰC — TP. CẦN THƠ</span>
              </div>
            </div>

            <!-- SVG Map Wrapper -->
            <div id="cantho-map-viewport" class="map-svg-wrapper"></div>

            <!-- Bottom Split: Emergency Alert + Live Camera -->
            <div class="map-bottom-grid">
              <div class="emergency-alert-strip">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span class="live-dot"></span>
                    <strong style="color:var(--red-vivid);font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Cảnh báo Cấp cứu Khẩn cấp</strong>
                  </div>
                  <div style="font-size:13px;color:var(--text-white);">
                    Xe <strong style="color:var(--red-vivid);font-family:var(--font-mono);">65A-012.34</strong> đang vận chuyển BN chấn thương về BV Đa khoa TP Cần Thơ
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);">Vị trí: Cầu Hưng Lợi · Tốc độ: 52 km/h · ETA: ~6 phút</div>
                </div>
                <button class="btn btn-emergency btn-sm" id="btn-focus-emergency-vehicle">Xem Vị Trí</button>
              </div>

              <div class="live-camera-strip">
                <div class="camera-preview-box">
                  <span style="font-size:10px;color:var(--text-muted);">CAMERA 01</span>
                  <div style="position:absolute;top:4px;right:4px;" class="live-dot"></div>
                </div>
                <div style="font-size:12px;">
                  <div style="color:var(--text-white);font-weight:600;">Camera Cabin Khoang Bệnh Nhân</div>
                  <div style="color:var(--text-muted);font-size:11px;">Xe 65A-012.34 · 25 FPS · 1080p</div>
                  <div style="color:#10B981;font-size:11px;">Tín hiệu truyền ổn định</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Vehicle Fleet & Active Cases Panel -->
          <div class="side-panel-container">
            <div class="panel-header-tabs">
              <button class="panel-tab-btn active" id="tab-panel-vehicles">Đội xe Cứu thương (${vehicles.length})</button>
              <button class="panel-tab-btn" id="tab-panel-cases">Ca đang xử lý</button>
            </div>

            <div class="panel-search-bar">
              <input type="text" id="filter-vehicle-input" placeholder="Tìm biển số xe, kíp trực, trạm..." />
            </div>

            <div class="panel-list-scroll" id="vehicle-card-list">
              ${this.renderVehicleCards(vehicles)}
            </div>
          </div>
        </div>
      `;

      // Mount Can Tho SVG Map
      this.mapInstance = new window.CanThoMap('cantho-map-viewport');
      this.mapInstance.render();

      // Bind vehicle cards click
      const listEl = container.querySelector('#vehicle-card-list');
      if (listEl) {
        listEl.querySelectorAll('.vehicle-card').forEach(card => {
          card.addEventListener('click', () => {
            const plate = card.getAttribute('data-plate');
            if (this.mapInstance) {
              this.mapInstance.showVehiclePopup(plate);
            }
          });
        });
      }

      // Filter vehicle search input
      const searchInput = container.querySelector('#filter-vehicle-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const q = e.target.value.toLowerCase().trim();
          const filtered = vehicles.filter(v => 
            v.plate.toLowerCase().includes(q) || 
            v.station.toLowerCase().includes(q) ||
            v.type.toLowerCase().includes(q)
          );
          if (listEl) {
            listEl.innerHTML = this.renderVehicleCards(filtered);
          }
        });
      }

      // Quick focus button
      const btnFocus = container.querySelector('#btn-focus-emergency-vehicle');
      if (btnFocus) {
        btnFocus.addEventListener('click', () => {
          if (this.mapInstance) {
            this.mapInstance.showVehiclePopup('65A-012.34');
          }
        });
      }
    }

    renderVehicleCards(vehicles) {
      if (!vehicles || vehicles.length === 0) {
        return `<div style="text-align:center;padding:24px;color:var(--text-muted);">Không tìm thấy phương tiện</div>`;
      }
      return vehicles.map(v => {
        const isEmergency = v.status === 'EMERGENCY';
        return `
          <div class="vehicle-card ${isEmergency ? 'is-emergency' : ''}" data-plate="${v.plate}">
            <div class="vehicle-card-top">
              <span class="vehicle-plate">${v.plate}</span>
              ${window.CCNV_UI.Badges.forVehicleStatus(v.status)}
            </div>
            <div style="font-size:12px;color:var(--text-white);margin-top:2px;">${v.station}</div>
            <div class="vehicle-meta-row">
              <span>${v.typeName}</span>
              <span>Tốc độ: <strong style="color:var(--text-white);">${v.speed} km/h</strong></span>
            </div>
            <div class="vehicle-meta-row" style="border-top:1px dashed var(--border-main);padding-top:4px;margin-top:4px;display:flex;align-items:center;justify-content:space-between;">
              ${window.CCNV_UI.renderBattery(v.battery)}
              <span style="color:${v.gpsStatus === 'ONLINE' ? '#10B981' : '#EF4444'};">● GPS ${v.gpsStatus}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // --- 2. CALL CENTER (TỔNG ĐÀI 115) VIEW ---
    renderCallCenterView(container) {
      const state = window.StateManager.getState();
      const calls = state.callHistory || [];
      const scenarios = state.callScenarios || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:12px;">
            <h2 style="color:var(--text-white);font-size:18px;">Tổng đài Tiếp nhận Khẩn cấp 115</h2>
            <p style="font-size:12px;color:var(--text-muted);">Ghi nhận cuộc gọi, tích hợp định vị Cell-ID và App Cấp cứu Cần Thơ</p>
          </div>

          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="call-center-table-mount"></div>
          </div>
        </div>
      `;

      // Mount DataTable
      new window.CCNV_UI.DataTable({
        containerId: 'call-center-table-mount',
        data: calls,
        pageSize: 10,
        exportTitle: 'Lịch sử Cuộc gọi 115',
        searchPlaceholder: 'Tìm số điện thoại, người gọi, ĐPV tiếp nhận...',
        defaultSortKey: 'time',
        defaultSortOrder: 'desc',
        filterOptions: [
          { label: 'Kênh 115 thoại', value: 'VOICE', filterFn: item => item.type === '115' },
          { label: 'Kênh Cấp cứu App', value: 'APP', filterFn: item => item.type === 'APP' },
          { label: 'Đã tạo ca cấp cứu', value: 'COMPLETED', filterFn: item => item.status === 'COMPLETED' },
          { label: 'Cuộc gọi nhỡ', value: 'MISSED', filterFn: item => item.status === 'MISSED' }
        ],
        columns: [
          { key: 'id', title: 'Mã cuộc gọi', sortable: true, render: item => `<span style="font-family:var(--font-mono);font-weight:600;color:#93C5FD;">${item.id}</span>` },
          { key: 'time', title: 'Thời điểm', sortable: true },
          { key: 'caller', title: 'Người báo tin', sortable: true, render: item => `<strong>${item.caller}</strong>` },
          { key: 'phone', title: 'Số điện thoại', sortable: true, render: item => `<span style="font-family:var(--font-mono);">${item.phone}</span>` },
          { key: 'type', title: 'Kênh tiếp nhận', sortable: true, render: item => `<span class="badge ${item.type === 'APP' ? 'badge-emergency' : 'badge-normal'}">${item.type}</span>` },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: item => {
              if (item.status === 'COMPLETED') return `<span class="status-pill status-pill-completed">Đã tạo ca</span>`;
              if (item.status === 'CONSULT_CLOSED') return `<span class="status-pill status-pill-cancelled">Tư vấn xong</span>`;
              return `<span class="status-pill status-pill-new">Cuộc gọi nhỡ</span>`;
            }
          },
          { key: 'duration', title: 'Thời lượng', sortable: true },
          { key: 'operator', title: 'Điều phối viên', sortable: true, render: item => item.operator || '<span style="color:#64748B;">Chưa gán</span>' }
        ]
      }).render();
    }

    // --- 3. CASES LIST VIEW (DANH SÁCH CA CẤP CỨU) ---
    renderCasesListView(container) {
      const state = window.StateManager.getState();
      const cases = state.cases || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Danh sách Ca Cấp cứu đang xử lý</h2>
              <p style="font-size:12px;color:var(--text-muted);">Theo dõi tiến độ, mốc nhiệm vụ và hồ sơ từng ca theo thời gian thực</p>
            </div>
            <button class="btn btn-emergency" id="btn-manual-create-case">
              ${window.CCNV_UI.ICONS.plus}
              <span>Tạo ca Cấp cứu Mới</span>
            </button>
          </div>

          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="cases-list-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'cases-list-table-mount',
        data: cases,
        pageSize: 10,
        exportTitle: 'Danh sách Ca Cấp cứu',
        searchPlaceholder: 'Tìm mã ca, bệnh nhân, biển số xe, bệnh viện...',
        defaultSortKey: 'createdAt',
        defaultSortOrder: 'desc',
        filterOptions: [
          { label: 'Tối khẩn / Khẩn cấp', value: 'EMERGENCY', filterFn: c => c.incident.severity === 'CRITICAL' || c.incident.severity === 'EMERGENCY' },
          { label: 'Đang vận chuyển', value: 'TRANSPORTING', filterFn: c => c.status === 'TRANSPORTING' },
          { label: 'Đã điều động', value: 'DISPATCHED', filterFn: c => c.status === 'DISPATCHED' },
          { label: 'Đã hoàn tất', value: 'COMPLETED', filterFn: c => c.status === 'COMPLETED' }
        ],
        columns: [
          { key: 'code', title: 'Mã ca', sortable: true, render: c => `<strong style="font-family:var(--font-mono);color:#60A5FA;">${c.code}</strong>` },
          { key: 'createdAt', title: 'Thời gian', sortable: true, render: c => new Date(c.createdAt).toTimeString().split(' ')[0] },
          { key: 'patient', title: 'Bệnh nhân', sortable: false, render: c => `<strong>${c.patient.name}</strong> (${c.patient.age}T, ${c.patient.gender})` },
          {
            key: 'incident',
            title: 'Tình huống',
            sortable: false,
            render: c => `<span class="badge ${c.incident.severity === 'CRITICAL' || c.incident.severity === 'EMERGENCY' ? 'badge-emergency' : 'badge-normal'}">${c.incident.name}</span>`
          },
          { key: 'location', title: 'Địa điểm hiện trường', sortable: false, render: c => `<span style="font-size:12px;color:#CBD5E1;">${c.location.address}</span>` },
          { key: 'vehiclePlate', title: 'Xe điều động', sortable: true, render: c => `<span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">${c.dispatch.vehiclePlate}</span>` },
          { key: 'hospitalName', title: 'Bệnh viện đích', sortable: true, render: c => c.dispatch.hospitalName },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: c => {
              if (c.status === 'DISPATCHED') return `<span class="status-pill status-pill-processing">Đã điều động</span>`;
              if (c.status === 'TRANSPORTING') return `<span class="status-pill status-pill-new">Đang vận chuyển</span>`;
              if (c.status === 'COMPLETED') return `<span class="status-pill status-pill-completed">Hoàn tất</span>`;
              return `<span class="status-pill status-pill-cancelled">Đã hủy</span>`;
            }
          },
          {
            key: 'actions',
            title: 'Thao tác',
            sortable: false,
            render: c => `<button class="btn btn-default btn-sm btn-open-case-detail" data-case-id="${c.id}">Xem Hồ Sơ</button>`
          }
        ]
      }).render();

      container.querySelector('#btn-manual-create-case')?.addEventListener('click', () => {
        this.openCreateCaseDrawer();
      });

      // Bind row actions
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-open-case-detail');
        if (btn) {
          const caseId = btn.getAttribute('data-case-id');
          this.openCaseDetailModal(caseId);
        }
      });
    }

    // --- 4. COORDINATION VIEW (LIÊN LẠC & PHỐI HỢP TT-10) ---
    renderCoordinationView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <h2 style="color:var(--text-white);font-size:18px;">Liên lạc & Phối hợp Liên ngành</h2>
          <p style="font-size:12px;color:var(--text-muted);">Kết nối nhanh kíp cấp cứu, bệnh viện tiếp nhận và các lực lượng phối hợp (Công an, PCCC & CNCH)</p>

          <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;margin-top:12px;">
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:15px;margin-bottom:12px;">1. Phối hợp với Kíp Cấp cứu</h3>
              <p style="font-size:13px;color:var(--text-slate);margin-bottom:16px;">Kênh liên lạc bộ đàm IP và cuộc gọi trực tiếp tới tài xế/bác sĩ kíp trực trên xe đang cấp cứu.</p>
              <div style="display:flex;gap:12px;">
                <button class="btn btn-default" id="btn-call-crew">Gọi thoại tới Kíp Xe 65A-012.34</button>
                <button class="btn btn-default" id="btn-msg-crew">Gửi tin nhắn chỉ đạo nhanh</button>
              </div>
            </div>

            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:15px;margin-bottom:12px;">2. Phối hợp Bệnh viện Tiếp nhận</h3>
              <p style="font-size:13px;color:var(--text-slate);margin-bottom:16px;">Gửi thông tin lâm sàng tóm tắt và kích hoạt báo động Đỏ nội viện tại Khoa Cấp cứu.</p>
              <div style="display:flex;gap:12px;">
                <button class="btn btn-emergency" id="btn-call-hospital">Gửi dữ liệu & Báo động BV</button>
              </div>
            </div>

            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:15px;margin-bottom:12px;">3. Chuyển Lực lượng Phối hợp (Công An / CSGT)</h3>
              <p style="font-size:13px;color:var(--text-slate);margin-bottom:16px;">Yêu cầu hỗ trợ phân luồng giao thông mở đường ưu tiên hoặc bảo đảm an ninh hiện trường.</p>
              <div style="display:flex;gap:12px;">
                <button class="btn btn-default" id="btn-call-police">Chuyển thông tin sang Công An / CSGT</button>
              </div>
            </div>

            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:15px;margin-bottom:12px;">4. Hướng dẫn Sơ cấp cứu Người dân</h3>
              <p style="font-size:13px;color:var(--text-slate);margin-bottom:16px;">Đẩy thẻ hướng dẫn sơ cứu tức thời xuống App Người dân đang gọi cấp cứu.</p>
              <div style="display:flex;gap:12px;">
                <button class="btn btn-default" id="btn-send-guide">Gửi Hướng dẫn Sơ cứu qua App</button>
              </div>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-call-crew')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Đang kết nối Kíp trực', 'Đang thiết lập kênh bộ đàm với BS. Võ Văn Kiệt (Xe 65A-012.34)');
        window.StateManager.addAuditLog('Gọi thoại kết nối Kíp trực Xe 65A-012.34');
      });

      container.querySelector('#btn-call-hospital')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Đã gửi thông tin tới Bệnh viện', 'Khoa Cấp cứu BV Đa khoa TP Cần Thơ đã nhận thông tin lâm sàng ca CC-261002-001', true);
        window.StateManager.addAuditLog('Phát tín hiệu báo động trước tới BV Đa khoa TP Cần Thơ');
      });

      container.querySelector('#btn-call-police')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Chuyển thông tin liên ngành', 'Đã chuyển tọa độ hiện trường Cầu Hưng Lợi sang Trung tâm CSGT TP Cần Thơ để hỗ trợ phân luồng');
        window.StateManager.addAuditLog('Chuyển thông tin hiện trường tới CSGT TP Cần Thơ');
      });

      container.querySelector('#btn-send-guide')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Đã gửi Hướng dẫn Sơ cứu', 'Người dân gọi từ SĐT 0918.234.111 đã nhận được các bước sơ cứu cố định cột sống cổ.');
        window.StateManager.addAuditLog('Đẩy thẻ hướng dẫn sơ cứu cho người báo tin');
      });
    }

    // --- 5. CASE LOOKUP & ARCHIVE (TT-11, TT-12) ---
    renderCaseLookupView(container) {
      const state = window.StateManager.getState();
      const history = state.historyCases || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Tra cứu Hồ sơ Ca Cấp cứu</h2>
              <p style="font-size:12px;color:var(--text-muted);">Lưu trữ toàn bộ hồ sơ ca hoàn tất, xuất báo cáo PDF và kiểm tra mốc thời gian</p>
            </div>
            <button class="btn btn-default" id="btn-export-pdf">In / Xuất PDF Hồ sơ</button>
          </div>

          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="case-lookup-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'case-lookup-table-mount',
        data: history,
        pageSize: 10,
        exportTitle: 'Hồ sơ Cấp cứu Lưu trữ',
        searchPlaceholder: 'Tìm mã ca, bệnh nhân, tình huống, bệnh viện...',
        defaultSortKey: 'createdAt',
        defaultSortOrder: 'desc',
        filterOptions: [
          { label: 'Hoàn tất bàn giao', value: 'COMPLETED', filterFn: h => h.status === 'COMPLETED' },
          { label: 'Đã hủy ca', value: 'CANCELLED', filterFn: h => h.status === 'CANCELLED' }
        ],
        columns: [
          { key: 'code', title: 'Mã ca', sortable: true, render: h => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${h.code}</strong>` },
          { key: 'createdAt', title: 'Thời điểm', sortable: true, render: h => h.createdAt.replace('T', ' ') },
          { key: 'patientName', title: 'Bệnh nhân', sortable: true, render: h => `<strong>${h.patientName}</strong> (${h.patientAge}T)` },
          { key: 'incidentName', title: 'Tình huống', sortable: true },
          { key: 'vehiclePlate', title: 'Xe cấp cứu', sortable: true, render: h => `<span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">${h.vehiclePlate}</span>` },
          { key: 'hospitalName', title: 'Bệnh viện bàn giao', sortable: true },
          { key: 'durations', title: 'Thời gian đáp ứng', sortable: false, render: h => `<span style="color:#10B981;font-weight:600;">${h.durations?.totalTime || '—'}</span>` },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: h => {
              if (h.status === 'COMPLETED') return `<span class="status-pill status-pill-completed">Hoàn tất</span>`;
              return `<span class="status-pill status-pill-cancelled">Đã hủy</span>`;
            }
          }
        ]
      }).render();

      container.querySelector('#btn-export-pdf')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Xuất Hồ sơ PDF', 'Đang kết xuất phiếu cấp cứu ngoại viện chuẩn Bộ Y Tế ra định dạng PDF...');
        setTimeout(() => window.print(), 800);
      });
    }

    // --- 6. RESOURCE MONITORING: VEHICLES, CREWS, HOSPITALS, SHIFTS ---
    renderVehiclesStatusView(container) {
      const state = window.StateManager.getState();
      const vehicles = state.vehicles || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:12px;">
            <h2 style="color:var(--text-white);font-size:18px;">Giám sát Nguồn lực: Tình trạng Xe Cấp cứu</h2>
            <p style="font-size:12px;color:var(--text-muted);">Trạng thái sẵn sàng, bảo trì, thông số oxy, pin và tín hiệu GPS thời gian thực</p>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="vehicles-status-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'vehicles-status-table-mount',
        data: vehicles,
        pageSize: 10,
        exportTitle: 'Đội xe Cấp cứu',
        searchPlaceholder: 'Tìm biển số, phân loại, trạm trực...',
        defaultSortKey: 'plate',
        defaultSortOrder: 'asc',
        filterOptions: [
          { label: 'Sẵn sàng', value: 'READY', filterFn: v => v.status === 'READY' },
          { label: 'Đang cấp cứu', value: 'EMERGENCY', filterFn: v => v.status === 'EMERGENCY' },
          { label: 'Đang điều xe', value: 'DISPATCHING', filterFn: v => v.status === 'DISPATCHING' },
          { label: 'Bảo trì', value: 'MAINTENANCE', filterFn: v => v.status === 'MAINTENANCE' }
        ],
        columns: [
          { key: 'plate', title: 'Biển số', sortable: true, render: v => `<strong style="font-family:var(--font-mono);color:var(--text-white);font-size:13.5px;">${v.plate}</strong>` },
          { key: 'typeName', title: 'Phân loại', sortable: true },
          { key: 'station', title: 'Trạm trực', sortable: true },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: v => {
              if (v.status === 'READY') return `<span class="status-pill status-pill-completed">Sẵn sàng</span>`;
              if (v.status === 'EMERGENCY') return `<span class="status-pill status-pill-new">Đang cấp cứu</span>`;
              if (v.status === 'DISPATCHING') return `<span class="status-pill status-pill-processing">Đang điều xe</span>`;
              return `<span class="status-pill status-pill-cancelled">Bảo trì</span>`;
            }
          },
          { key: 'speed', title: 'Tốc độ', sortable: true, render: v => `${v.speed} km/h` },
          { key: 'gpsStatus', title: 'Vị trí GPS', sortable: true, render: v => `<span style="color:#10B981;">● ${v.gpsStatus}</span> <span style="font-size:11px;color:#64748B;">(${v.lastUpdate})</span>` },
          { key: 'battery', title: 'Mức Pin', sortable: false, render: v => window.CCNV_UI.renderBattery(v.battery) },
          {
            key: 'actions',
            title: 'Thao tác',
            sortable: false,
            render: v => `
              <button class="btn btn-default btn-sm btn-toggle-maint" data-plate="${v.plate}">
                ${v.status === 'MAINTENANCE' ? 'Đưa vào Sẵn sàng' : 'Chuyển Bảo trì'}
              </button>
            `
          }
        ]
      }).render();

      container.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-toggle-maint');
        if (btn) {
          const plate = btn.getAttribute('data-plate');
          const v = state.vehicles.find(item => item.plate === plate);
          if (v) {
            const newStatus = v.status === 'MAINTENANCE' ? 'READY' : 'MAINTENANCE';
            const newText = newStatus === 'MAINTENANCE' ? 'Bảo trì' : 'Sẵn sàng';
            window.StateManager.updateVehicle(plate, { status: newStatus, statusText: newText });
            window.CCNV_UI.Toast.show('Cập nhật trạng thái xe', `Xe ${plate} đã chuyển sang: ${newText}`);
            this.renderVehiclesStatusView(container);
          }
        }
      });
    }

    renderCrewsStatusView(container) {
      const state = window.StateManager.getState();
      const crews = state.crews || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:12px;">
            <h2 style="color:var(--text-white);font-size:18px;">Tình trạng Kíp Cấp cứu</h2>
            <p style="font-size:12px;color:var(--text-muted);">Quản trị nhân lực kíp trực: Bác sĩ, điều dưỡng, lái xe và nhiệm vụ đang thực hiện</p>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="crews-status-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'crews-status-table-mount',
        data: crews,
        pageSize: 10,
        exportTitle: 'Kíp Cấp cứu Ngoại viện',
        searchPlaceholder: 'Tìm tên kíp, bác sĩ, điều dưỡng, lái xe...',
        defaultSortKey: 'name',
        defaultSortOrder: 'asc',
        filterOptions: [
          { label: 'Sẵn sàng làm nhiệm vụ', value: 'READY', filterFn: cr => cr.status === 'READY' },
          { label: 'Đang làm nhiệm vụ', value: 'ON_MISSION', filterFn: cr => cr.status === 'ON_MISSION' }
        ],
        columns: [
          { key: 'name', title: 'Tên Kíp', sortable: true, render: cr => `<strong style="color:var(--text-white);">${cr.name}</strong>` },
          { key: 'shift', title: 'Ca trực', sortable: true },
          { key: 'doctor', title: 'Bác sĩ phụ trách', sortable: true, render: cr => `<strong>${cr.doctor}</strong>` },
          { key: 'nurse', title: 'Điều dưỡng', sortable: true },
          { key: 'driver', title: 'Lái xe cấp cứu', sortable: true },
          { key: 'defaultVehicle', title: 'Xe phân công', sortable: true, render: cr => `<span style="font-family:var(--font-mono);color:#93C5FD;">${cr.defaultVehicle}</span>` },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: cr => {
              if (cr.status === 'ON_MISSION') return `<span class="status-pill status-pill-new">Đang làm nhiệm vụ</span>`;
              return `<span class="status-pill status-pill-completed">Sẵn sàng</span>`;
            }
          }
        ]
      }).render();
    }

    renderHospitalsStatusView(container) {
      const state = window.StateManager.getState();
      const hospitals = state.hospitals || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:12px;">
            <h2 style="color:var(--text-white);font-size:18px;">Tình trạng Mạng lưới Bệnh viện Tiếp nhận</h2>
            <p style="font-size:12px;color:var(--text-muted);">Theo dõi năng lực tiếp nhận, giường cấp cứu trống, máy thở và chuyển trạng thái</p>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="hospitals-status-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'hospitals-status-table-mount',
        data: hospitals,
        pageSize: 10,
        exportTitle: 'Mạng lưới Bệnh viện Tiếp nhận',
        searchPlaceholder: 'Tìm tên bệnh viện, phân hạng, số hotline...',
        defaultSortKey: 'name',
        defaultSortOrder: 'asc',
        filterOptions: [
          { label: 'Đang nhận', value: 'AVAILABLE', filterFn: h => h.status === 'AVAILABLE' },
          { label: 'Hạn chế', value: 'RESTRICTED', filterFn: h => h.status === 'RESTRICTED' },
          { label: 'Tạm ngưng', value: 'SUSPENDED', filterFn: h => h.status === 'SUSPENDED' }
        ],
        columns: [
          { key: 'name', title: 'Bệnh viện', sortable: true, render: h => `<strong style="color:var(--text-white);">${h.name}</strong>` },
          { key: 'grade', title: 'Phân hạng', sortable: true },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: h => {
              if (h.status === 'AVAILABLE') return `<span class="status-pill status-pill-completed">Đang nhận</span>`;
              if (h.status === 'RESTRICTED') return `<span class="status-pill status-pill-processing">Hạn chế</span>`;
              return `<span class="status-pill status-pill-new">Tạm ngưng</span>`;
            }
          },
          { key: 'availableBeds', title: 'Giường Cấp cứu Trống', sortable: true, render: h => `<strong style="color:var(--text-white);">${h.availableBeds}</strong> / ${h.emergencyBeds} giường` },
          { key: 'ventilatorsAvailable', title: 'Máy thở sẵn sàng', sortable: true, render: h => `${h.ventilatorsAvailable} máy` },
          { key: 'hotline', title: 'Hotline Cấp cứu', sortable: true, render: h => `<span style="font-family:var(--font-mono);">${h.hotline}</span>` },
          {
            key: 'actions',
            title: 'Đổi trạng thái',
            sortable: false,
            render: h => `
              <select class="hosp-status-changer" data-hid="${h.id}">
                <option value="AVAILABLE" ${h.status === 'AVAILABLE' ? 'selected' : ''}>Đang nhận</option>
                <option value="RESTRICTED" ${h.status === 'RESTRICTED' ? 'selected' : ''}>Hạn chế</option>
                <option value="SUSPENDED" ${h.status === 'SUSPENDED' ? 'selected' : ''}>Tạm ngưng</option>
              </select>
            `
          }
        ]
      }).render();

      container.addEventListener('change', (e) => {
        const sel = e.target.closest('.hosp-status-changer');
        if (sel) {
          const hid = sel.getAttribute('data-hid');
          const newStatus = sel.value;
          const statusText = newStatus === 'AVAILABLE' ? 'Đang nhận' : newStatus === 'RESTRICTED' ? 'Hạn chế' : 'Tạm ngưng';
          const h = state.hospitals.find(item => item.id === hid);
          if (h) {
            h.status = newStatus;
            h.statusText = statusText;
            window.StateManager.saveToSession();
            window.CCNV_UI.Toast.show('Cập nhật năng lực tiếp nhận', `${h.name} chuyển sang: ${statusText}`);
          }
        }
      });
    }

    renderShiftsScheduleView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <h2 style="color:var(--text-white);font-size:18px;">Phân công Ca trực & Lịch xe</h2>
          <div class="content-card">
            <p style="font-size:13px;color:var(--text-slate);margin-bottom:16px;">
              Lịch trực ban cấp cứu 24/7 tại 5 trạm vệ tinh Cần Thơ (Ninh Kiều, Cái Răng, Bình Thủy, Ô Môn, Thốt Nốt).
            </p>
            <div style="background:var(--bg-elevated);padding:16px;border-radius:6px;border:1px solid var(--border-main);">
              <h4 style="color:var(--text-white);margin-bottom:10px;">Ca trực hôm nay: Thứ Sáu, ngày 02/10/2026</h4>
              <ul style="padding-left:20px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-slate);">
                <li><strong>Ca Sáng (07:00 - 15:00):</strong> 5 Kíp trực hoàn toàn sẵn sàng, 1 ca đang vận chuyển.</li>
                <li><strong>Ca Chiều (15:00 - 23:00):</strong> Đã chốt danh sách bàn giao thiết bị.</li>
                <li><strong>Ca Đêm (23:00 - 07:00 hôm sau):</strong> 3 Kíp cơ động trực chiến tại BVĐK TP Cần Thơ.</li>
              </ul>
            </div>
          </div>
        </div>
      `;
    }

    renderReportsView(container) {
      const state = window.StateManager.getState();
      const stats = state.stats || {};

      container.innerHTML = `
        <div class="view-container-full">
          <h2 style="color:var(--text-white);font-size:18px;">Báo cáo Tổng hợp & Đo lường KPI</h2>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px;">
            <div class="kpi-card">
              <span class="kpi-label">Số ca tiếp nhận hôm nay</span>
              <span class="kpi-value">${stats.todayCases || 14}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Tổng ca trong tháng</span>
              <span class="kpi-value">${stats.monthCases || 348}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Thời gian đáp ứng TB (SLA)</span>
              <span class="kpi-value" style="color:#10B981;">${stats.avgResponseTime || '7.4 phút'}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Tỷ lệ bàn giao thành công</span>
              <span class="kpi-value">${stats.handoverSuccessRate || '98.6%'}</span>
            </div>
          </div>

          <div class="content-card" style="margin-top:16px;">
            <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Biểu đồ phân bố thời gian các mốc cấp cứu ngoại viện (Phút)</h3>
            <div style="height:180px;background:var(--bg-elevated);border-radius:6px;display:flex;align-items:flex-end;gap:30px;padding:20px;border:1px solid var(--border-main);">
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div style="width:100%;height:45px;background:#385468;border-radius:4px;"></div>
                <span style="font-size:11px;">Nhấc máy (1.2m)</span>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div style="width:100%;height:35px;background:#2B5D80;border-radius:4px;"></div>
                <span style="font-size:11px;">Phát lệnh (0.8m)</span>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div style="width:100%;height:110px;background:#E52521;border-radius:4px;"></div>
                <span style="font-size:11px;">Tới hiện trường (5.4m)</span>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div style="width:100%;height:95px;background:#10B981;border-radius:4px;"></div>
                <span style="font-size:11px;">Xử trí hiện trường (12m)</span>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div style="width:100%;height:80px;background:#3B7BB5;border-radius:4px;"></div>
                <span style="font-size:11px;">Chuyển về BV (8.2m)</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    renderCategoriesView(container) {
      const state = window.StateManager.getState();
      const cats = state.categories || {};
      const eqs = cats.medicalEquipments || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:12px;">
            <h2 style="color:var(--text-white);font-size:18px;">Danh mục Dữ liệu Dùng chung</h2>
            <p style="font-size:12px;color:var(--text-muted);">Trang thiết bị y tế trên xe cứu thương, vật tư tiêu hao và các loại hình phương tiện</p>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="categories-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'categories-table-mount',
        data: eqs,
        pageSize: 10,
        exportTitle: 'Danh mục Thiết bị Cấp cứu',
        searchPlaceholder: 'Tìm mã TB, tên thiết bị, hãng sản xuất...',
        defaultSortKey: 'id',
        defaultSortOrder: 'asc',
        filterOptions: [
          { label: 'Hoạt động tốt', value: 'ACTIVE', filterFn: eq => eq.status === 'ACTIVE' }
        ],
        columns: [
          { key: 'id', title: 'Mã TB', sortable: true, render: eq => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${eq.id}</strong>` },
          { key: 'name', title: 'Tên thiết bị y tế', sortable: true, render: eq => `<strong>${eq.name}</strong>` },
          { key: 'unit', title: 'Đơn vị tính', sortable: true },
          { key: 'brand', title: 'Hãng sản xuất', sortable: true },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: eq => `<span class="status-pill status-pill-completed">Hoạt động tốt</span>`
          }
        ]
      }).render();
    }

    renderAdminView(container) {
      const state = window.StateManager.getState();
      const logs = state.auditLogs || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:12px;">
            <h2 style="color:var(--text-white);font-size:18px;">Quản trị Hệ thống & Nhật ký Thao tác</h2>
            <p style="font-size:12px;color:var(--text-muted);">Nhật ký kiểm toán (Audit Trail) ghi nhận toàn bộ thao tác của ĐPV, Bệnh viện và Kíp trực</p>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="admin-audit-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'admin-audit-table-mount',
        data: logs,
        pageSize: 10,
        exportTitle: 'Nhật ký Thao tác Hệ thống',
        searchPlaceholder: 'Tìm thời điểm, tài khoản, nội dung thao tác...',
        defaultSortKey: 'time',
        defaultSortOrder: 'desc',
        filterOptions: [
          { label: 'Điều phối viên (dpv01, dpv02)', value: 'DPV', filterFn: l => l.user.includes('dpv') },
          { label: 'Bệnh viện tiếp nhận', value: 'BV', filterFn: l => l.user.includes('bv') },
          { label: 'Hệ thống tự động', value: 'SYS', filterFn: l => l.user === 'Hệ thống' }
        ],
        columns: [
          { key: 'time', title: 'Thời điểm', sortable: true, render: l => `<span style="font-family:var(--font-mono);">${l.time}</span>` },
          { key: 'user', title: 'Tài khoản', sortable: true, render: l => `<strong style="color:var(--text-white);">${l.user}</strong>` },
          { key: 'action', title: 'Nội dung thao tác', sortable: false, render: l => l.action }
        ]
      }).render();
    }

    // --- HOSPITAL VIEWS (BV-01 to BV-07) ---
    renderHospitalIncomingView(container) {
      const state = window.StateManager.getState();
      const currentUser = window.StateManager.getCurrentUser();
      const myHospId = currentUser?.hospitalId || 'HOSP_BVDK';
      const myCases = (state.cases || []).filter(c => c.dispatch.hospitalId === myHospId && c.status !== 'COMPLETED');

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Khoa Cấp cứu — Tiếp nhận Ca đang đến</h2>
              <p style="font-size:12px;color:var(--text-muted);">${currentUser?.organization} · Sẵn sàng đón tiếp bệnh nhân</p>
            </div>
            <button class="btn btn-emergency" id="btn-trigger-hospital-alert">Giả lập: Nhận Cảnh báo Ca mới</button>
          </div>

          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="hospital-incoming-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'hospital-incoming-table-mount',
        data: myCases,
        pageSize: 10,
        exportTitle: 'Ca Cấp cứu Đang đến BV',
        searchPlaceholder: 'Tìm mã ca, bệnh nhân, xe chở, tình huống...',
        defaultSortKey: 'code',
        defaultSortOrder: 'asc',
        filterOptions: [
          { label: 'Đã xác nhận tiếp nhận', value: 'ACCEPTED', filterFn: c => c.hospitalResponse === 'ACCEPTED' },
          { label: 'Chờ bệnh viện phản hồi', value: 'PENDING', filterFn: c => c.hospitalResponse !== 'ACCEPTED' }
        ],
        columns: [
          { key: 'code', title: 'Mã ca', sortable: true, render: c => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${c.code}</strong>` },
          { key: 'patient', title: 'Bệnh nhân', sortable: false, render: c => `<strong>${c.patient.name}</strong> (${c.patient.age}T, ${c.patient.gender})` },
          { key: 'incident', title: 'Tình trạng', sortable: false, render: c => `<span class="badge badge-emergency">${c.incident.name}</span>` },
          { key: 'vehiclePlate', title: 'Xe đang chở', sortable: true, render: c => `<span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">${c.dispatch.vehiclePlate}</span>` },
          { key: 'crewName', title: 'Kíp trực', sortable: true, render: c => c.dispatch.crewName },
          { key: 'eta', title: 'ETA', sortable: false, render: c => `<strong style="color:var(--red-vivid);font-size:13.5px;">${c.eta || '6 phút'}</strong>` },
          {
            key: 'hospitalResponse',
            title: 'Phản hồi của BV',
            sortable: true,
            render: c => {
              if (c.hospitalResponse === 'ACCEPTED') return `<span class="status-pill status-pill-completed">Đã xác nhận</span>`;
              return `<span class="status-pill status-pill-processing">Chờ phản hồi</span>`;
            }
          },
          {
            key: 'actions',
            title: 'Thao tác',
            sortable: false,
            render: c => `
              <button class="btn btn-emergency btn-sm btn-hosp-accept" data-case-id="${c.id}">Xác nhận Đón</button>
              <button class="btn btn-default btn-sm btn-open-case-detail" data-case-id="${c.id}" style="margin-left:6px;">Hồ sơ ePCR</button>
            `
          }
        ]
      }).render();

      container.querySelector('#btn-trigger-hospital-alert')?.addEventListener('click', () => {
        this.showHospitalIncomingAlert(myCases[0] || state.cases[0]);
      });

      container.addEventListener('click', (e) => {
        const acceptBtn = e.target.closest('.btn-hosp-accept');
        if (acceptBtn) {
          const cid = acceptBtn.getAttribute('data-case-id');
          window.StateManager.updateCase(cid, {
            hospitalResponse: 'ACCEPTED',
            hospitalResponseText: 'Đã xác nhận'
          });
          window.StateManager.addCaseLog(cid, `${currentUser?.organization} xác nhận sẵn sàng tiếp nhận bệnh nhân`);
          window.CCNV_UI.Toast.show('Đã xác nhận tiếp nhận', `Khoa Cấp cứu sẵn sàng đón nhận ca ${cid}`);
          this.renderHospitalIncomingView(container);
        }

        const detailBtn = e.target.closest('.btn-open-case-detail');
        if (detailBtn) {
          const cid = detailBtn.getAttribute('data-case-id');
          this.openCaseDetailModal(cid);
        }
      });
    }

    renderHospitalHandoverView(container) {
      const state = window.StateManager.getState();
      const targetCase = state.cases.find(c => c.status !== 'COMPLETED') || state.cases[0];

      container.innerHTML = `
        <div class="view-container-full">
          <h2 style="color:var(--text-white);font-size:18px;">Check-in & Lập Biên bản Bàn giao Bệnh nhân</h2>
          <div class="content-card">
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-main);padding-bottom:12px;margin-bottom:16px;">
              <div>
                <strong style="color:var(--text-white);font-size:16px;">Hồ sơ ca: ${targetCase ? targetCase.code : 'CC-261002-001'}</strong>
                <div style="font-size:12px;color:var(--text-muted);">Bệnh nhân: ${targetCase ? targetCase.patient.name : 'Phan Văn Đức'} · Xe ${targetCase ? targetCase.dispatch.vehiclePlate : '65A-012.34'}</div>
              </div>
              <button class="btn btn-default" id="btn-checkin-vehicle">1. Check-in Xe Cập Bến</button>
            </div>

            <div class="form-grid-2">
              <div class="form-field">
                <label class="form-label">Chẩn đoán tiếp nhận tại Khoa Cấp cứu</label>
                <textarea id="handover-diagnosis" rows="2">Đa chấn thương do tai nạn giao thông, rách phần mềm cẳng tay phải, theo dõi chấn động não.</textarea>
              </div>
              <div class="form-field">
                <label class="form-label">Tình trạng người bệnh khi bàn giao</label>
                <textarea id="handover-condition" rows="2">Bệnh nhân tỉnh táo, tiếp xúc tốt, huyết động ổn định. Mạch 88, HA 130/80.</textarea>
              </div>
            </div>

            <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:12px;">
              <button class="btn btn-emergency btn-lg" id="btn-confirm-handover">
                ${window.CCNV_UI.ICONS.check}
                <span>Xác nhận Bàn giao (Ca Hoàn tất)</span>
              </button>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-checkin-vehicle')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Check-in Xe Thành Công', 'Đã ghi nhận giờ xe cứu thương cập bến sảnh cấp cứu.');
        window.StateManager.addAuditLog('Check-in xe cứu thương tại sảnh Cấp cứu');
      });

      container.querySelector('#btn-confirm-handover')?.addEventListener('click', () => {
        if (!targetCase) return;
        window.StateManager.updateCase(targetCase.id, {
          status: 'COMPLETED',
          statusText: 'Hoàn tất',
          stageLabel: 'Đã bàn giao'
        });

        // Set vehicle back to ready
        window.StateManager.updateVehicle(targetCase.dispatch.vehiclePlate, {
          status: 'READY',
          statusText: 'Sẵn sàng',
          speed: 0
        });

        window.StateManager.addCaseLog(targetCase.id, 'Bác sĩ Khoa Cấp cứu ký xác nhận bàn giao người bệnh. Ca hoàn tất.');
        window.CCNV_UI.Toast.show('Ca Cấp cứu Đã Hoàn Tất', `Đã hoàn tất bàn giao ca ${targetCase.code}. Xe ${targetCase.dispatch.vehiclePlate} trở về trạng thái Sẵn sàng.`);
        this.renderHospitalIncomingView(container);
      });
    }

    renderHospitalEPCRView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <h2 style="color:var(--text-white);font-size:18px;">Hồ sơ Bệnh án Cấp cứu Ngoại viện (ePCR)</h2>
          <div class="content-card" id="hospital-epcr-form-container"></div>
        </div>
      `;

      const state = window.StateManager.getState();
      const currentCase = state.cases[0];
      window.EPCRForm.render('hospital-epcr-form-container', currentCase?.epcr || {}, false, (updated) => {
        if (currentCase) {
          currentCase.epcr = updated;
          window.StateManager.saveToSession();
          window.StateManager.addCaseLog(currentCase.id, 'Bác sĩ tiếp nhận cập nhật diễn biến hồ sơ ePCR');
        }
      });
    }

    renderHospitalReportsView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <h2 style="color:var(--text-white);font-size:18px;">Báo cáo Tiếp nhận Cấp cứu Bệnh viện</h2>
          <div class="content-card">
            <p style="font-size:13px;color:var(--text-slate);">
              Tổng số ca tiếp nhận trong tuần: <strong>28 ca</strong>. 100% được cảnh báo trước qua hệ thống CCNV.
            </p>
          </div>
        </div>
      `;
    }

    // --- 7. DRAWER: CREATE CASE (TT-07) ---
    openCreateCaseDrawer(prefill = null) {
      const drawerOverlay = document.getElementById('drawer-create-case-overlay');
      if (!drawerOverlay) return;

      const state = window.StateManager.getState();
      const vehicles = (state.vehicles || []).filter(v => v.status === 'READY');
      const crews = state.crews || [];
      const hospitals = (state.hospitals || []).filter(h => h.status !== 'SUSPENDED');
      const incidentTypes = state.incidentTypes || [];
      const presets = state.locationPresets || [];

      const callerName = prefill?.callerName || 'Trần Anh Vũ';
      const callerPhone = prefill?.callerPhone || '0913.882.115';
      const address = prefill?.address || presets[0]?.name || '';
      const defaultIncident = prefill?.incidentCode || 'INC_TNGT';

      drawerOverlay.innerHTML = `
        <div class="drawer-container">
          <!-- P0: Critical Incident Focus Mode Banner -->
          <div class="focus-mode-banner">
            <span>⚡ CHẾ ĐỘ TẬP TRUNG XỬ LÝ KHẨN CẤP (FOCUS MODE)</span>
            <div class="focus-mode-shortcuts">
              <span>Phím tắt:</span>
              <span class="kbd-shortcut">Enter</span> Phát lệnh
              <span class="kbd-shortcut">Esc</span> Đóng
            </div>
          </div>

          <div class="drawer-header">
            <div style="display:flex;align-items:center;gap:10px;">
              ${window.CCNV_UI.ICONS.ambulance}
              <strong style="color:var(--text-white);font-size:16px;">TẠO CA CẤP CỨU & PHÁT LỆNH ĐIỀU ĐỘNG</strong>
            </div>
            <button class="btn btn-ghost btn-sm" id="btn-close-create-drawer">${window.CCNV_UI.ICONS.x}</button>
          </div>

          <div class="drawer-body">
            <!-- 1. CALLER & PATIENT INFO -->
            <div class="form-section">
              <div class="form-section-title">1. Thông tin Người báo tin & Bệnh nhân</div>
              <div class="form-grid-2">
                <div class="form-field">
                  <label class="form-label">Người báo tin</label>
                  <input type="text" id="form-caller-name" value="${callerName}" />
                </div>
                <div class="form-field">
                  <label class="form-label">Số điện thoại</label>
                  <input type="text" id="form-caller-phone" value="${callerPhone}" />
                </div>
              </div>
              <div class="form-grid-3" style="margin-top:10px;">
                <div class="form-field">
                  <label class="form-label">Họ tên Bệnh nhân</label>
                  <input type="text" id="form-patient-name" value="${prefill?.patientName || 'Nguyễn Văn Hưng'}" />
                </div>
                <div class="form-field">
                  <label class="form-label">Tuổi</label>
                  <input type="number" id="form-patient-age" value="${prefill?.patientAge || 34}" />
                </div>
                <div class="form-field">
                  <label class="form-label">Giới tính</label>
                  <select id="form-patient-gender">
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- 2. LOCATION (LOCATION PICKER) -->
            <div class="form-section">
              <div class="form-section-title">2. Định vị Hiện trường</div>
              <div class="form-field">
                <label class="form-label">Địa chỉ hiện trường</label>
                <input type="text" id="form-location-address" value="${address}" />
              </div>
              <div style="margin-top:8px;">
                <label class="form-label" style="display:block;margin-bottom:4px;">Gợi ý điểm đến TP. Cần Thơ:</label>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  ${presets.slice(0, 4).map(p => `
                    <button type="button" class="btn btn-default btn-sm btn-preset-loc" data-addr="${p.name}">
                      ${p.landmark || p.name}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- 3. INCIDENT & SEVERITY -->
            <div class="form-section">
              <div class="form-section-title">3. Tình huống & Mức độ Ưu tiên</div>
              <div class="form-field">
                <label class="form-label">Loại tình huống cấp cứu</label>
                <select id="form-incident-select">
                  ${incidentTypes.map(inc => `
                    <option value="${inc.code}" ${inc.code === defaultIncident ? 'selected' : ''}>
                      ${inc.name} — [Gợi ý: ${inc.suggestedType}]
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-field" style="margin-top:10px;">
                <label class="form-label">Mô tả triệu chứng / Hiện trường</label>
                <textarea id="form-incident-desc" rows="2">${prefill?.description || 'Nạn nhân ngã đập đầu, bất tỉnh, đang chảy máu.'}</textarea>
              </div>
              <div class="form-field" style="margin-top:10px;">
                <label class="form-label">Phân loại mức độ khẩn</label>
                <div class="severity-picker-grid">
                  <button type="button" class="severity-btn active sev-critical" data-sev="CRITICAL">TỐI KHẨN (ĐỎ)</button>
                  <button type="button" class="severity-btn sev-emergency" data-sev="EMERGENCY">KHẨN CẤP (CAM)</button>
                  <button type="button" class="severity-btn sev-routine" data-sev="ROUTINE">THƯỜNG (XANH)</button>
                </div>
              </div>
            </div>

            <!-- 4. DISPATCH: VEHICLE, CREW, HOSPITAL -->
            <div class="form-section">
              <div class="form-section-title">4. Phương án Điều phối & Tiếp nhận</div>
              <div class="form-grid-3">
                <div class="form-field">
                  <label class="form-label">Chọn Xe Cứu thương</label>
                  <select id="form-vehicle-select">
                    ${vehicles.map(v => `
                      <option value="${v.plate}">${v.plate} (${v.type})</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">Chọn Kíp Trực</label>
                  <select id="form-crew-select">
                    ${crews.map(cr => `
                      <option value="${cr.id}">${cr.name}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">Bệnh viện Tiếp nhận</label>
                  <select id="form-hospital-select">
                    ${hospitals.map(h => `
                      <option value="${h.id}">${h.name} (${h.availableBeds} giường trống)</option>
                    `).join('')}
                  </select>
                </div>
              </div>
              <div class="suggestion-banner">
                <strong>GỢI Ý TỰ ĐỘNG:</strong> Xe 65A-015.67 (Type A - ICU) cách 1.4km · ETA ~4 phút · BVĐK TP Cần Thơ sẵn sàng phòng mổ sọ não
              </div>
            </div>
          </div>

          <div class="drawer-footer">
            <button class="btn btn-default" id="btn-cancel-without-case">Đóng (Không tạo ca)</button>
            <button class="btn btn-emergency btn-lg" id="btn-confirm-create-case">
              ${window.CCNV_UI.ICONS.check}
              <span>Xác nhận Tạo ca & Phát lệnh Điều xe</span>
            </button>
          </div>
        </div>
      `;

      drawerOverlay.classList.add('active');
      document.body.classList.add('critical-focus-active');

      // Bind Preset clicks
      drawerOverlay.querySelectorAll('.btn-preset-loc').forEach(btn => {
        btn.addEventListener('click', () => {
          drawerOverlay.querySelector('#form-location-address').value = btn.getAttribute('data-addr');
        });
      });

      // Bind Severity buttons
      const sevBtns = drawerOverlay.querySelectorAll('.severity-btn');
      let selectedSeverity = 'CRITICAL';
      sevBtns.forEach(sb => {
        sb.addEventListener('click', () => {
          sevBtns.forEach(b => b.classList.remove('active'));
          sb.classList.add('active');
          selectedSeverity = sb.getAttribute('data-sev');
        });
      });

      // Close handlers
      const closeDrawer = () => {
        document.body.classList.remove('critical-focus-active');
        drawerOverlay.classList.remove('active');
        if (this._drawerKeyHandler) {
          window.removeEventListener('keydown', this._drawerKeyHandler);
          this._drawerKeyHandler = null;
        }
      };
      drawerOverlay.querySelector('#btn-close-create-drawer')?.addEventListener('click', closeDrawer);

      // Keyboard shortcuts for Critical Incident Focus Mode
      this._drawerKeyHandler = (e) => {
        if (e.key === 'Escape') {
          closeDrawer();
        } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          drawerOverlay.querySelector('#btn-confirm-create-case')?.click();
        }
      };
      window.addEventListener('keydown', this._drawerKeyHandler);

      // Cancel without case (B7 branch)
      drawerOverlay.querySelector('#btn-cancel-without-case')?.addEventListener('click', () => {
        closeDrawer();
        window.StateManager.addAuditLog('Kết thúc cuộc gọi mà không tạo ca cấp cứu');
        window.CCNV_UI.Toast.show('Cuộc gọi kết thúc', 'Đã lưu lịch sử cuộc gọi tư vấn, không phát sinh ca.');
      });

      // Confirm & Dispatch Case
      drawerOverlay.querySelector('#btn-confirm-create-case')?.addEventListener('click', () => {
        const caller = drawerOverlay.querySelector('#form-caller-name').value;
        const phone = drawerOverlay.querySelector('#form-caller-phone').value;
        const patientName = drawerOverlay.querySelector('#form-patient-name').value;
        const patientAge = Number(drawerOverlay.querySelector('#form-patient-age').value);
        const patientGender = drawerOverlay.querySelector('#form-patient-gender').value;
        const address = drawerOverlay.querySelector('#form-location-address').value;
        const incidentCode = drawerOverlay.querySelector('#form-incident-select').value;
        const desc = drawerOverlay.querySelector('#form-incident-desc').value;
        const vehiclePlate = drawerOverlay.querySelector('#form-vehicle-select').value;
        const crewId = drawerOverlay.querySelector('#form-crew-select').value;
        const hospId = drawerOverlay.querySelector('#form-hospital-select').value;

        const targetHosp = state.hospitals.find(h => h.id === hospId);
        const targetCrew = state.crews.find(c => c.id === crewId);
        const incObj = state.incidentTypes.find(i => i.code === incidentCode);

        const newCase = window.StateManager.createCase({
          callerName: caller,
          callerPhone: phone,
          patient: {
            name: patientName,
            age: patientAge,
            gender: patientGender
          },
          location: {
            address: address,
            coords: [10.0248, 105.7695],
            mapPos: { x: 540, y: 440 }
          },
          incident: {
            code: incidentCode,
            name: incObj ? incObj.name : 'Cấp cứu',
            severity: selectedSeverity,
            severityText: selectedSeverity === 'CRITICAL' ? 'Tối khẩn' : 'Khẩn cấp',
            description: desc
          },
          dispatch: {
            vehiclePlate: vehiclePlate,
            crewId: crewId,
            crewName: targetCrew ? targetCrew.name : 'Kíp trực',
            hospitalId: hospId,
            hospitalName: targetHosp ? targetHosp.name : 'Bệnh viện ĐK TP Cần Thơ'
          }
        });

        closeDrawer();
        window.CCNV_UI.Toast.show(
          `Đã tạo ca ${newCase.code}`,
          `Phát lệnh tới xe ${vehiclePlate} và gửi cảnh báo trước tới ${targetHosp.name}`,
          true
        );

        // Switch to cases list to view created case
        this.currentMenu = 'cases-list';
        this.renderSidebar();
        this.renderCurrentView();
      });
    }

    // --- 8. INCOMING CALL BANNER (TT-05) ---
    triggerIncomingCall(scenario) {
      this.activeIncomingCall = scenario;
      let alertBox = document.getElementById('incoming-call-alert-banner');
      if (!alertBox) {
        alertBox = document.createElement('div');
        alertBox.id = 'incoming-call-alert-banner';
        alertBox.className = 'incoming-call-alert';
        document.body.appendChild(alertBox);
      }

      window.CCNV_UI.SoundFx.playEmergencyTone();

      alertBox.innerHTML = `
        <div class="call-115-icon pulse-red">
          ${window.CCNV_UI.ICONS.phoneCall}
        </div>
        <div>
          <div style="font-size:11px;color:#FFB8B6;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
            ĐANG ĐỔ CHUÔNG CUỘC GỌI KHẨN CẤP [KÊNH ${scenario.sourceName}]
          </div>
          <div style="font-size:15px;font-weight:700;color:#FFF;">
            ${scenario.callerPhone} — ${scenario.callerName}
          </div>
          <div style="font-size:12px;color:#CBD5E1;">${scenario.address}</div>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-emergency btn-sm" id="btn-answer-call">Nhấc Máy</button>
          <button class="btn btn-default btn-sm" id="btn-dismiss-call">Bỏ qua</button>
        </div>
      `;

      alertBox.querySelector('#btn-answer-call')?.addEventListener('click', () => {
        alertBox.remove();
        window.StateManager.addAuditLog(`Nhấc máy tiếp nhận cuộc gọi từ ${scenario.callerPhone}`);
        this.openCreateCaseDrawer(scenario);
      });

      alertBox.querySelector('#btn-dismiss-call')?.addEventListener('click', () => {
        alertBox.remove();
      });
    }

    // --- 9. CASE DETAIL MODAL WITH 7 TABS (TT-08) ---
    openCaseDetailModal(caseId) {
      const state = window.StateManager.getState();
      const c = state.cases.find(item => item.id === caseId || item.code === caseId) || state.cases[0];
      if (!c) return;

      this.selectedCaseId = c.id;
      let modalOverlay = document.getElementById('case-detail-modal-overlay');
      if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'case-detail-modal-overlay';
        modalOverlay.className = 'modal-overlay';
        document.body.appendChild(modalOverlay);
      }

      modalOverlay.innerHTML = `
        <div class="modal-box" style="max-width:880px;height:85vh;">
          <div class="modal-header">
            <div style="display:flex;align-items:center;gap:12px;">
              <strong style="color:var(--text-white);font-size:16px;">HỒ SƠ CA CẤP CỨU: ${c.code}</strong>
              ${window.CCNV_UI.Badges.forCaseStatus(c.status)}
            </div>
            <button class="btn btn-ghost btn-sm" id="btn-close-case-modal">${window.CCNV_UI.ICONS.x}</button>
          </div>

          <div style="display:flex;background:var(--bg-elevated);border-bottom:1px solid var(--border-main);padding:0 16px;">
            <button class="panel-tab-btn active" data-tab="tab-overview">Tổng quan</button>
            <button class="panel-tab-btn" data-tab="tab-dispatch">Điều phối</button>
            <button class="panel-tab-btn" data-tab="tab-epcr">Phiếu ePCR</button>
            <button class="panel-tab-btn" data-tab="tab-milestones">Mốc thời gian</button>
            <button class="panel-tab-btn" data-tab="tab-logs">Lịch sử Log</button>
            <button class="panel-tab-btn" data-tab="tab-audio">Ghi âm cuộc gọi</button>
          </div>

          <div class="modal-body" id="case-modal-body-content"></div>

          <div class="modal-footer">
            <button class="btn btn-default" id="btn-close-case-modal-footer">Đóng</button>
          </div>
        </div>
      `;

      modalOverlay.classList.add('active');

      const renderTab = (tabName) => {
        const body = modalOverlay.querySelector('#case-modal-body-content');
        if (!body) return;

        if (tabName === 'tab-overview') {
          body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:14px;">
              <div class="form-grid-2">
                <div class="form-section">
                  <div class="form-section-title">Thông tin Bệnh nhân</div>
                  <div style="font-size:13px;display:flex;flex-direction:column;gap:4px;">
                    <div>Họ tên: <strong style="color:var(--text-white);">${c.patient.name}</strong></div>
                    <div>Tuổi: ${c.patient.age} · Giới tính: ${c.patient.gender}</div>
                    <div>Tiền sử: ${c.patient.history || 'Không rõ'}</div>
                  </div>
                </div>
                <div class="form-section">
                  <div class="form-section-title">Hiện trường & Tình huống</div>
                  <div style="font-size:13px;display:flex;flex-direction:column;gap:4px;">
                    <div>Hiện trường: <strong style="color:var(--text-white);">${c.location.address}</strong></div>
                    <div>Loại tình huống: <span class="badge badge-emergency">${c.incident.name}</span></div>
                    <div>Mô tả: ${c.incident.description}</div>
                  </div>
                </div>
              </div>

              <div class="form-section">
                <div class="form-section-title">Phương án Điều phối Hiện tại</div>
                <div class="form-grid-3" style="font-size:13px;">
                  <div>Xe cấp cứu: <strong style="color:var(--text-white);font-family:var(--font-mono);">${c.dispatch.vehiclePlate}</strong></div>
                  <div>Kíp trực: ${c.dispatch.crewName}</div>
                  <div>Bệnh viện tiếp nhận: <strong style="color:var(--text-white);">${c.dispatch.hospitalName}</strong></div>
                </div>
              </div>
            </div>
          `;
        } else if (tabName === 'tab-dispatch') {
          // TT-09 Dispatch tab
          body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:16px;">
              <div class="form-section">
                <div class="form-section-title">Thay đổi Phương án Điều phối</div>
                <div class="form-grid-2">
                  <div>
                    <label class="form-label">Thu hồi & Đổi xe cứu thương khác</label>
                    <div style="display:flex;gap:8px;margin-top:6px;">
                      <select id="modal-change-vehicle-select">
                        <option value="65A-015.67">65A-015.67 (Type A - Trạm Ninh Kiều)</option>
                        <option value="65A-018.89">65A-018.89 (Type B - Trạm Bình Thủy)</option>
                      </select>
                      <button class="btn btn-default" id="btn-action-change-vehicle">Đổi Xe</button>
                    </div>
                  </div>
                  <div>
                    <label class="form-label">Chuyển sang Bệnh viện khác</label>
                    <div style="display:flex;gap:8px;margin-top:6px;">
                      <select id="modal-change-hosp-select">
                        <option value="HOSP_BVTU">BV Đa khoa TW Cần Thơ</option>
                        <option value="HOSP_BVND">BV Nhi đồng Cần Thơ</option>
                      </select>
                      <button class="btn btn-default" id="btn-action-change-hosp">Đổi BV</button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-section" style="border-color:var(--red-border);">
                <div class="form-section-title" style="color:var(--red-vivid);">Hủy Ca Cấp cứu kèm Lý do</div>
                <div class="form-grid-2">
                  <div class="form-field">
                    <label class="form-label">Lý do hủy</label>
                    <select id="modal-cancel-reason-select">
                      ${state.terminationReasons.map(r => `<option value="${r.name}">${r.name}</option>`).join('')}
                    </select>
                  </div>
                  <div style="display:flex;align-items:flex-end;">
                    <button class="btn btn-emergency" id="btn-action-cancel-case">Xác nhận Hủy Ca</button>
                  </div>
                </div>
              </div>
            </div>
          `;

          body.querySelector('#btn-action-change-vehicle')?.addEventListener('click', () => {
            const newPlate = body.querySelector('#modal-change-vehicle-select').value;
            window.StateManager.updateCase(c.id, {
              dispatch: { ...c.dispatch, vehiclePlate: newPlate }
            });
            window.StateManager.addCaseLog(c.id, `Thu hồi lệnh cũ, đổi sang xe ${newPlate}`);
            window.CCNV_UI.Toast.show('Đã đổi xe cứu thương', `Xe ${newPlate} đã được gán cho ca ${c.code}`);
            renderTab('tab-overview');
          });

          body.querySelector('#btn-action-change-hosp')?.addEventListener('click', () => {
            const hospText = body.querySelector('#modal-change-hosp-select').selectedOptions[0].text;
            window.StateManager.updateCase(c.id, {
              dispatch: { ...c.dispatch, hospitalName: hospText }
            });
            window.StateManager.addCaseLog(c.id, `Thay đổi bệnh viện tiếp nhận sang ${hospText}`);
            window.CCNV_UI.Toast.show('Đã đổi Bệnh viện', `Bệnh viện tiếp nhận mới: ${hospText}`);
            renderTab('tab-overview');
          });

          body.querySelector('#btn-action-cancel-case')?.addEventListener('click', () => {
            const reason = body.querySelector('#modal-cancel-reason-select').value;
            window.StateManager.updateCase(c.id, {
              status: 'CANCELLED',
              statusText: 'Đã hủy',
              cancelReason: reason
            });
            window.StateManager.addCaseLog(c.id, `Hủy ca cấp cứu. Lý do: ${reason}`);
            window.CCNV_UI.Toast.show('Đã hủy ca', `Ca ${c.code} đã hủy với lý do: ${reason}`);
            modalOverlay.classList.remove('active');
            this.renderCasesListView(document.getElementById('main-content-viewport'));
          });
        } else if (tabName === 'tab-epcr') {
          body.innerHTML = `<div id="modal-epcr-form-wrap"></div>`;
          window.EPCRForm.render('modal-epcr-form-wrap', c.epcr || {}, false, (updated) => {
            c.epcr = updated;
            window.StateManager.saveToSession();
            window.StateManager.addCaseLog(c.id, 'Cập nhật phiếu ePCR');
          });
        } else if (tabName === 'tab-milestones') {
          body.innerHTML = `
            <div style="padding:10px 0;">
              <h4 style="color:var(--text-white);margin-bottom:12px;">Tiến trình Mốc thời gian tự động:</h4>
              <div class="stepper-row">
                ${(c.milestones || []).map((m, idx) => `
                  <div class="step-node ${m.done ? 'completed' : ''}">
                    <div class="step-circle">${m.done ? '✓' : idx + 1}</div>
                    <span class="step-title">${m.name}</span>
                    <span style="font-size:10px;color:var(--text-muted);">${m.time || '—'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        } else if (tabName === 'tab-logs') {
          body.innerHTML = `
            <div class="data-table-container">
              <table class="command-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Nội dung sự kiện</th>
                  </tr>
                </thead>
                <tbody>
                  ${(c.logs || []).map(l => `
                    <tr>
                      <td style="font-family:var(--font-mono);">${l.time}</td>
                      <td><strong style="color:var(--text-white);">${l.user}</strong></td>
                      <td>${l.action}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        } else if (tabName === 'tab-audio') {
          body.innerHTML = `
            <div style="background:var(--bg-elevated);border-radius:8px;padding:24px;text-align:center;border:1px solid var(--border-main);">
              <h4 style="color:var(--text-white);margin-bottom:8px;">Bản ghi âm cuộc gọi tiếp nhận 115 (Mã ghi âm: REC-20261002-001)</h4>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Thời lượng: 02:04 · Định dạng: WAV 16bit 44.1kHz</div>
              <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
                <button class="btn btn-default" id="btn-simulate-play-audio">▶ Phát lại Ghi âm</button>
              </div>
            </div>
          `;
          body.querySelector('#btn-simulate-play-audio')?.addEventListener('click', () => {
            window.CCNV_UI.SoundFx.playBeep();
            window.CCNV_UI.Toast.show('Đang phát ghi âm', 'Đang phát lại đoạn trao đổi giữa ĐPV và người báo tin.');
          });
        }
      };

      // Tab switcher
      modalOverlay.querySelectorAll('.panel-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          modalOverlay.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderTab(btn.getAttribute('data-tab'));
        });
      });

      renderTab('tab-overview');

      const closeModal = () => modalOverlay.classList.remove('active');
      modalOverlay.querySelector('#btn-close-case-modal')?.addEventListener('click', closeModal);
      modalOverlay.querySelector('#btn-close-case-modal-footer')?.addEventListener('click', closeModal);
    }

    // --- 10. SOS ALERT MODAL (TT-04) ---
    triggerSosAlert() {
      let sosModal = document.getElementById('sos-alert-modal');
      if (!sosModal) {
        sosModal = document.createElement('div');
        sosModal.id = 'sos-alert-modal';
        sosModal.className = 'modal-overlay';
        document.body.appendChild(sosModal);
      }

      window.CCNV_UI.SoundFx.playEmergencyTone();

      sosModal.innerHTML = `
        <div class="modal-box" style="border:2px solid var(--red-primary);box-shadow:0 0 40px var(--red-glow);max-width:540px;">
          <div class="modal-header" style="background:var(--red-deep);border-bottom-color:var(--red-primary);">
            <div style="display:flex;align-items:center;gap:10px;color:var(--red-vivid);">
              ${window.CCNV_UI.ICONS.alertTriangle}
              <strong style="font-size:16px;text-transform:uppercase;">BÁO ĐỘNG SOS TỪ KÍP CẤP CỨU TRÊN XE</strong>
            </div>
          </div>
          <div class="modal-body" style="background:#0e131b;">
            <p style="font-size:14px;color:var(--text-white);margin-bottom:8px;">
              Xe <strong style="color:var(--red-vivid);font-family:var(--font-mono);">65A-012.34</strong> vừa kích hoạt nút SOS Khẩn cấp!
            </p>
            <div style="font-size:13px;color:var(--text-slate);display:flex;flex-direction:column;gap:6px;">
              <div>Vị trí: Cầu Hưng Lợi, Q. Cái Răng</div>
              <div>Lý do: Va chạm giao thông thứ cấp / Sự cố kíp xe cần hỗ trợ ngay lập tức</div>
              <div>Thời điểm: ${new Date().toTimeString().split(' ')[0]}</div>
            </div>
          </div>
          <div class="modal-footer" style="background:#0e131b;">
            <button class="btn btn-default" id="btn-dismiss-sos">Đã Tiếp nhận</button>
            <button class="btn btn-emergency" id="btn-dispatch-backup-vehicle">Điều xe Thay thế Ngay</button>
          </div>
        </div>
      `;

      sosModal.classList.add('active');

      sosModal.querySelector('#btn-dismiss-sos')?.addEventListener('click', () => {
        sosModal.classList.remove('active');
        window.CCNV_UI.Toast.show('Đã tiếp nhận tín hiệu SOS', 'ĐPV đang liên hệ trực tiếp với tài xế');
        window.StateManager.addAuditLog('Tiếp nhận và xử lý tín hiệu SOS từ xe 65A-012.34');
      });

      sosModal.querySelector('#btn-dispatch-backup-vehicle')?.addEventListener('click', () => {
        sosModal.classList.remove('active');
        window.CCNV_UI.Toast.show('Điều xe thay thế', 'Đã phát lệnh điều xe 65A-015.67 tới hiện trường Cầu Hưng Lợi', true);
        window.StateManager.addAuditLog('Điều động xe cứu thương thay thế 65A-015.67 ứng cứu sự cố SOS');
      });
    }

    // --- 11. HOSPITAL INCOMING ALERT (BV-01) ---
    showHospitalIncomingAlert(caseObj) {
      if (!caseObj) return;

      let alertModal = document.getElementById('hospital-incoming-alert-modal');
      if (!alertModal) {
        alertModal = document.createElement('div');
        alertModal.id = 'hospital-incoming-alert-modal';
        alertModal.className = 'modal-overlay';
        document.body.appendChild(alertModal);
      }

      window.CCNV_UI.SoundFx.playEmergencyTone();

      alertModal.innerHTML = `
        <div class="modal-box" style="border:2px solid var(--red-primary);box-shadow:0 0 30px var(--red-glow);max-width:580px;">
          <div class="modal-header" style="background:var(--red-deep);border-bottom:1px solid var(--red-primary);">
            <div style="display:flex;align-items:center;gap:10px;color:var(--red-vivid);">
              ${window.CCNV_UI.ICONS.ambulance}
              <strong style="font-size:16px;">CẢNH BÁO XE CẤP CỨU ĐANG ĐẾN</strong>
            </div>
          </div>
          <div class="modal-body" style="background:#0B1C2A;">
            <div style="font-size:14px;color:var(--text-white);margin-bottom:10px;">
              Xe <strong style="color:var(--red-vivid);font-family:var(--font-mono);">${caseObj.dispatch.vehiclePlate}</strong> đang chở người bệnh về Khoa Cấp cứu!
            </div>
            <div style="font-size:13px;display:flex;flex-direction:column;gap:6px;color:var(--text-slate);">
              <div>Bệnh nhân: <strong style="color:var(--text-white);">${caseObj.patient.name}</strong> (${caseObj.patient.age}T)</div>
              <div>Tình trạng: <span class="badge badge-emergency">${caseObj.incident.name}</span></div>
              <div>Thời gian dự kiến cập bến (ETA): <strong style="color:var(--red-vivid);font-size:15px;">~6 phút</strong></div>
              <div>Hiện trường xuất phát: ${caseObj.location.address}</div>
            </div>
          </div>
          <div class="modal-footer" style="background:#0B1C2A;">
            <button class="btn btn-default" id="btn-hosp-reject">Từ chối (Quá tải)</button>
            <button class="btn btn-emergency btn-lg" id="btn-hosp-confirm-ready">Xác nhận Sẵn sàng Tiếp nhận</button>
          </div>
        </div>
      `;

      alertModal.classList.add('active');

      alertModal.querySelector('#btn-hosp-confirm-ready')?.addEventListener('click', () => {
        alertModal.classList.remove('active');
        window.StateManager.updateCase(caseObj.id, {
          hospitalResponse: 'ACCEPTED',
          hospitalResponseText: 'Đã xác nhận sẵn sàng'
        });
        window.CCNV_UI.Toast.show('Đã phản hồi Tiếp nhận', 'Đã báo về Trung tâm: Khoa Cấp cứu sẵn sàng đón nhận');
      });

      alertModal.querySelector('#btn-hosp-reject')?.addEventListener('click', () => {
        alertModal.classList.remove('active');
        window.StateManager.updateCase(caseObj.id, {
          hospitalResponse: 'REJECTED',
          hospitalResponseText: 'Từ chối (Quá tải)'
        });
        window.CCNV_UI.Toast.show('Đã từ chối tiếp nhận', 'Đã gửi thông báo từ chối về Trung tâm điều hành để ĐPV chuyển viện', true);
      });
    }

    // --- 12. BIND GLOBAL EVENTS ---
    bindGlobalEvents() {
      // 115 Bottom Banner click in sidebar
      document.getElementById('sidebar-call-115-btn')?.addEventListener('click', () => {
        const state = window.StateManager.getState();
        this.triggerIncomingCall(state.callScenarios[0]);
      });

      // Global F1 shortcut: Tạo ca cấp cứu & Mở chế độ tập trung Focus Mode
      window.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
          e.preventDefault();
          const drawer = document.getElementById('drawer-create-case-overlay');
          if (drawer && !drawer.classList.contains('active')) {
            this.openCreateCaseDrawer();
          }
        }
      });
    }
  }

  window.CentralApp = new CentralApp();
})(window);
