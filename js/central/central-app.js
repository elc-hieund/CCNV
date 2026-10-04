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
        } else if (event === 'CASE_CREATED' || event === 'CASE_UPDATED' || event === 'PATIENT_UPDATED' || event === 'STORAGE_SYNC') {
          if (this.currentMenu === 'cases-list' || this.currentMenu === 'hospital-incoming' || this.currentMenu === 'realtime-map') {
            this.renderCurrentView();
          }
          // If case detail modal is open for this case, refresh it live
          const modalOverlay = document.getElementById('case-detail-modal-overlay');
          if (modalOverlay && modalOverlay.classList.contains('active') && this.selectedCaseId) {
            const currentC = window.StateManager.getState().cases.find(item => item.id === this.selectedCaseId || item.code === this.selectedCaseId);
            if (currentC) {
              this.showCaseDetailModal(currentC);
            }
          }
          // Toast notification on Central for patient sync from Driver app
          if (event === 'PATIENT_UPDATED' && payload?.patient) {
            if (window.CCNV_UI?.Toast) {
              const p = payload.patient;
              const vehText = payload.vehiclePlate ? `Xe ${payload.vehiclePlate} · ` : '';
              window.CCNV_UI.Toast.show(
                'ĐỒNG BỘ THÔNG TIN BỆNH NHÂN (ePCR)',
                `${vehText}Đã cập nhật: ${p.name || 'Bệnh nhân'} (${p.age || '—'}T, ${p.gender || '—'}) · Nhóm máu: ${p.bloodType || '—'} · Tiền sử: ${p.history || 'Không'}`,
                true
              );
            }
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
        // --- DISPATCHER ACCORDION (TRUNG TÂM ĐIỀU HÀNH - SITEMAP 8.1) ---
        const isCallCenterActive = ['call-current', 'call-history', 'call-directory', 'call-transfer', 'call-center'].includes(this.currentMenu);
        const isEmergencyActive = ['cases-list', 'case-lookup', 'receiving-incoming', 'receiving-handover', 'receiving-status'].includes(this.currentMenu);
        const isMonitoringActive = ['realtime-map', 'vehicles-status', 'crews-status', 'hospitals-status'].includes(this.currentMenu);
        const isShiftsActive = ['shifts-assignment', 'shifts-calendar', 'shifts-schedule'].includes(this.currentMenu);
        const isReportsActive = ['report-cases', 'reports-overview', 'reports-detail', 'reports-stats', 'reports'].includes(this.currentMenu);
        const isCategoriesActive = ['cat-vehicles', 'cat-hospitals', 'cat-directory', 'cat-incidents', 'cat-statuses', 'cat-equipment', 'cat-close-reasons', 'cat-templates', 'categories'].includes(this.currentMenu);
        const isAdminActive = ['admin-users', 'admin-roles', 'admin-audit', 'admin-backup', 'admin'].includes(this.currentMenu);

        html = `
          <!-- 1. TỔNG ĐÀI [Nhóm menu] -->
          <div class="nav-parent-item ${isCallCenterActive ? 'active' : ''}" data-menu="call-current" title="Tổng đài">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.phoneCall}</span>
            <span class="nav-parent-label">Tổng đài</span>
          </div>

          <!-- 2. CẤP CỨU [Menu đơn duy nhất - Toàn bộ Vòng đời & Tiếp nhận] -->
          <div class="nav-parent-item ${isEmergencyActive ? 'active' : ''}" data-menu="cases-list" title="Cấp cứu">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.ambulance}</span>
            <span class="nav-parent-label">Cấp cứu</span>
          </div>

          <!-- 3. GIÁM SÁT [Nhóm menu] -->
          <div class="nav-parent-item ${isMonitoringActive ? 'active expanded' : ''}" data-nav-group="monitoring" title="Giám sát">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.eye}</span>
            <span class="nav-parent-label">Giám sát</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'realtime-map' ? 'active' : ''}" data-menu="realtime-map">Bản đồ ca (GIS)</div>
            <div class="nav-subitem ${this.currentMenu === 'vehicles-status' ? 'active' : ''}" data-menu="vehicles-status">Tình trạng xe</div>
            <div class="nav-subitem ${this.currentMenu === 'crews-status' ? 'active' : ''}" data-menu="crews-status">Tình trạng kíp</div>
            <div class="nav-subitem ${this.currentMenu === 'hospitals-status' ? 'active' : ''}" data-menu="hospitals-status">Tình trạng bệnh viện</div>
          </div>

          <!-- 5. CA TRỰC [Nhóm menu] -->
          <div class="nav-parent-item ${isShiftsActive ? 'active expanded' : ''}" data-nav-group="shifts" title="Ca trực">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.calendar}</span>
            <span class="nav-parent-label">Ca trực</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'shifts-assignment' ? 'active' : ''}" data-menu="shifts-assignment">Phân công ca trực</div>
            <div class="nav-subitem ${['shifts-calendar', 'shifts-schedule'].includes(this.currentMenu) ? 'active' : ''}" data-menu="shifts-calendar">Lịch trực</div>
          </div>

          <!-- 6. BÁO CÁO [Nhóm menu] -->
          <div class="nav-parent-item ${isReportsActive ? 'active expanded' : ''}" data-nav-group="reports" title="Báo cáo">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.barChart}</span>
            <span class="nav-parent-label">Báo cáo</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${['report-cases', 'reports-overview', 'reports-detail', 'reports-stats', 'reports'].includes(this.currentMenu) ? 'active' : ''}" data-menu="report-cases">Số ca tiếp nhận</div>
          </div>

          <!-- 7. DANH MỤC & CẤU HÌNH [Nhóm menu] -->
          <div class="nav-parent-item ${isCategoriesActive ? 'active expanded' : ''}" data-nav-group="categories" title="Danh mục & cấu hình">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.layers}</span>
            <span class="nav-parent-label">Danh mục & cấu hình</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'cat-vehicles' ? 'active' : ''}" data-menu="cat-vehicles">Xe cứu thương</div>
            <div class="nav-subitem ${this.currentMenu === 'cat-hospitals' ? 'active' : ''}" data-menu="cat-hospitals">Bệnh viện</div>
            <div class="nav-subitem ${this.currentMenu === 'cat-directory' ? 'active' : ''}" data-menu="cat-directory">Danh bạ bệnh viện</div>
            <div class="nav-subitem ${this.currentMenu === 'cat-incidents' ? 'active' : ''}" data-menu="cat-incidents">Loại tình huống</div>
            <div class="nav-subitem ${this.currentMenu === 'cat-statuses' ? 'active' : ''}" data-menu="cat-statuses">Trạng thái</div>
            <div class="nav-subitem ${['cat-equipment', 'categories'].includes(this.currentMenu) ? 'active' : ''}" data-menu="cat-equipment">Trang thiết bị trên xe</div>
            <div class="nav-subitem ${this.currentMenu === 'cat-close-reasons' ? 'active' : ''}" data-menu="cat-close-reasons">Lý do kết thúc ca</div>
            <div class="nav-subitem ${this.currentMenu === 'cat-templates' ? 'active' : ''}" data-menu="cat-templates">Mẫu biểu</div>
          </div>

          <!-- 8. QUẢN TRỊ HỆ THỐNG [Nhóm menu] -->
          <div class="nav-parent-item ${isAdminActive ? 'active expanded' : ''}" data-nav-group="admin" title="Quản trị hệ thống">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.settings}</span>
            <span class="nav-parent-label">Quản trị hệ thống</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'admin-users' ? 'active' : ''}" data-menu="admin-users">Người dùng</div>
            <div class="nav-subitem ${this.currentMenu === 'admin-roles' ? 'active' : ''}" data-menu="admin-roles">Phân quyền</div>
            <div class="nav-subitem ${['admin-audit', 'admin'].includes(this.currentMenu) ? 'active' : ''}" data-menu="admin-audit">Nhật ký thao tác</div>
            <div class="nav-subitem ${this.currentMenu === 'admin-backup' ? 'active' : ''}" data-menu="admin-backup">Sao lưu & khôi phục</div>
          </div>
        `;
      } else {
        // --- HOSPITAL ACCORDION (TIẾP NHẬN BỆNH VIỆN - SITEMAP 8.2) ---
        const isIncomingActive = ['hospital-incoming', 'hospital-handover', 'hospital-epcr', 'hospital-reception-status', 'hospital-specialty'].includes(this.currentMenu);
        const isHospReportActive = ['hospital-report-detail', 'hospital-report-stats', 'hospital-reports'].includes(this.currentMenu);

        html = `
          <!-- 1. TIẾP NHẬN HỒ SƠ [Nhóm menu] -->
          <div class="nav-parent-item ${isIncomingActive ? 'active expanded' : ''}" data-nav-group="hospital-flow" title="Tiếp nhận hồ sơ">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.hospital}</span>
            <span class="nav-parent-label">Tiếp nhận hồ sơ</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'hospital-incoming' ? 'active' : ''}" data-menu="hospital-incoming">Ca đang đến</div>
            <div class="nav-subitem ${this.currentMenu === 'hospital-handover' ? 'active' : ''}" data-menu="hospital-handover">Tiếp nhận & bàn giao</div>
            <div class="nav-subitem ${this.currentMenu === 'hospital-epcr' ? 'active' : ''}" data-menu="hospital-epcr">Phiếu cấp cứu (ePCR)</div>
            <div class="nav-subitem ${this.currentMenu === 'hospital-reception-status' ? 'active' : ''}" data-menu="hospital-reception-status">Cập nhật trạng thái tiếp nhận</div>
            <div class="nav-subitem ${this.currentMenu === 'hospital-specialty' ? 'active' : ''}" data-menu="hospital-specialty">Khai báo chuyên khoa / năng lực</div>
          </div>

          <!-- 2. BÁO CÁO [Nhóm menu] -->
          <div class="nav-parent-item ${isHospReportActive ? 'active expanded' : ''}" data-nav-group="hospital-reports" title="Báo cáo">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.barChart}</span>
            <span class="nav-parent-label">Báo cáo</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${['hospital-report-detail', 'hospital-reports'].includes(this.currentMenu) ? 'active' : ''}" data-menu="hospital-report-detail">Chi tiết</div>
            <div class="nav-subitem ${this.currentMenu === 'hospital-report-stats' ? 'active' : ''}" data-menu="hospital-report-stats">Thống kê tiếp nhận</div>
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
        // 1. Tổng đài
        'call-current': 'Tổng đài — Cuộc gọi Hiện tại & Tiếp nhận Thông tin',
        'call-history': 'Tổng đài — Lịch sử Cuộc gọi Khẩn cấp 115',
        'call-directory': 'Tổng đài — Danh bạ Bệnh viện TP. Cần Thơ',
        'call-transfer': 'Tổng đài — Chuyển tiếp',
        'call-center': 'Tổng đài Tiếp nhận Khẩn cấp 115',
        // 2. Cấp cứu (Hợp nhất vòng đời & tiếp nhận)
        'cases-list': 'Quản lý Vòng đời Ca Cấp cứu & Tiếp nhận',
        'case-lookup': 'Quản lý Vòng đời Ca Cấp cứu & Tiếp nhận',
        'receiving-incoming': 'Quản lý Vòng đời Ca Cấp cứu & Tiếp nhận',
        'receiving-handover': 'Quản lý Vòng đời Ca Cấp cứu & Tiếp nhận',
        'receiving-status': 'Quản lý Vòng đời Ca Cấp cứu & Tiếp nhận',
        // 3. Giám sát
        'realtime-map': 'Bản đồ Realtime (GIS)',
        'vehicles-status': 'Tình trạng Xe cứu thương',
        'crews-status': 'Tình trạng Kíp trực',
        'hospitals-status': 'Mạng lưới Bệnh viện Tiếp nhận',
        // 4. Ca trực
        'shifts-assignment': 'Phân công Ca trực & Thành viên Kíp',
        'shifts-calendar': 'Lịch trực Ban 24/7 Các Trạm Vệ tinh',
        'shifts-schedule': 'Phân công & Lịch trực Ban',
        // 5. Báo cáo
        'reports-overview': 'Báo cáo Tổng quan & Đo lường KPI',
        'reports-detail': 'Báo cáo Chi tiết & Thời gian Xử lý Ca',
        'reports-stats': 'Báo cáo Thống kê & Phân tích Dữ liệu',
        'reports': 'Báo cáo Tổng hợp & Đo lường KPI',
        // 6. Danh mục & cấu hình
        'cat-vehicles': 'Danh mục Xe cứu thương',
        'cat-hospitals': 'Danh mục Bệnh viện & Cơ sở Y tế',
        'cat-directory': 'Quản lý Danh bạ Bệnh viện',
        'cat-incidents': 'Danh mục Loại tình huống Cấp cứu',
        'cat-statuses': 'Danh mục Trạng thái Xe & Ca',
        'cat-equipment': 'Danh mục Trang thiết bị trên Xe',
        'cat-close-reasons': 'Danh mục Lý do Kết thúc Ca',
        'cat-templates': 'Cấu hình Mẫu biểu & Phiếu ePCR',
        'categories': 'Danh mục Dữ liệu dùng chung',
        // 7. Quản trị hệ thống
        'admin-users': 'Quản lý Tài khoản Người dùng',
        'admin-roles': 'Phân quyền Vai trò & Đơn vị',
        'admin-audit': 'Nhật ký Thao tác Hệ thống (Audit Log)',
        'admin-backup': 'Sao lưu & Khôi phục Dữ liệu',
        'admin': 'Quản trị Hệ thống & Nhật ký Thao tác',
        // Web BV Tiếp nhận (Sitemap 8.2)
        'hospital-incoming': 'Khoa Cấp cứu — Tiếp nhận Ca đang đến',
        'hospital-handover': 'Biên bản Bàn giao & Tiếp nhận Bệnh nhân',
        'hospital-epcr': 'Hồ sơ Bệnh án Điện tử ePCR',
        'hospital-reception-status': 'Cập nhật Trạng thái Tiếp nhận Bệnh viện',
        'hospital-specialty': 'Khai báo Năng lực Chuyên khoa Tiếp nhận',
        'hospital-report-detail': 'Báo cáo Chi tiết Ca đã tiếp nhận (BV)',
        'hospital-report-stats': 'Thống kê Tiếp nhận Bệnh viện',
        'hospital-reports': 'Báo cáo Tiếp nhận Cấp cứu Bệnh viện'
      };

      const headerLeft = document.querySelector('.header-left');
      if (headerLeft) {
        const title = menuTitles[this.currentMenu] || 'Trung tâm Điều hành Cấp cứu 115';
        headerLeft.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text-white);font-weight:600;">
            <span style="color:#60A5FA;font-weight:500;">CCNV 115 Cần Thơ</span>
            <span style="color:var(--text-muted);font-size:11px;">/</span>
            <span>${title}</span>
          </div>
        `;
      }

      switch (this.currentMenu) {
        // 1. Tổng đài
        case 'call-center':
        case 'call-current':
          this.renderCallCenterView(container, 'active');
          break;
        case 'call-history':
          this.renderCallCenterView(container, 'history');
          break;
        case 'call-directory':
          this.renderCallCenterView(container, 'directory');
          break;
        case 'call-transfer':
          this.renderCallCenterView(container, 'transfer');
          break;

        // 2. Cấp cứu (Màn hình duy nhất quản lý toàn bộ vòng đời & tiếp nhận)
        case 'cases-list':
        case 'case-lookup':
        case 'receiving-incoming':
        case 'receiving-handover':
        case 'receiving-status':
          this.renderCasesListView(container);
          break;

        // 3. Giám sát
        case 'realtime-map':
          this.renderRealtimeMapView(container);
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

        // 5. Ca trực
        case 'shifts-assignment':
          this.renderShiftsAssignmentView(container);
          break;
        case 'shifts-calendar':
        case 'shifts-schedule':
          this.renderShiftsCalendarView(container);
          break;

        // 6. Báo cáo
        case 'reports':
        case 'report-cases':
        case 'reports-overview':
          this.renderReportCasesView(container, 'overview');
          break;
        case 'reports-detail':
          this.renderReportCasesView(container, 'detail');
          break;
        case 'reports-stats':
          this.renderReportCasesView(container, 'overview');
          break;

        // 7. Danh mục & cấu hình
        case 'cat-vehicles':
          this.renderCatVehiclesView(container);
          break;
        case 'cat-hospitals':
          this.renderCatHospitalsView(container);
          break;
        case 'cat-directory':
          this.renderCallCenterView(container, 'directory');
          break;
        case 'cat-incidents':
          this.renderCatIncidentsView(container);
          break;
        case 'cat-statuses':
          this.renderCatStatusesView(container);
          break;
        case 'categories':
        case 'cat-equipment':
          this.renderCatEquipmentView(container);
          break;
        case 'cat-close-reasons':
          this.renderCatCloseReasonsView(container);
          break;
        case 'cat-templates':
          this.renderCatTemplatesView(container);
          break;

        // 8. Quản trị hệ thống
        case 'admin-users':
          this.renderAdminUsersView(container);
          break;
        case 'admin-roles':
          this.renderAdminRolesView(container);
          break;
        case 'admin':
        case 'admin-audit':
          this.renderAdminAuditView(container);
          break;
        case 'admin-backup':
          this.renderAdminBackupView(container);
          break;

        // Web Bệnh viện tiếp nhận (Sitemap 8.2)
        case 'hospital-incoming':
          this.renderHospitalIncomingView(container);
          break;
        case 'hospital-handover':
          this.renderHospitalHandoverView(container);
          break;
        case 'hospital-epcr':
          this.renderHospitalEPCRView(container);
          break;
        case 'hospital-reception-status':
          this.renderHospitalReceptionStatusView(container);
          break;
        case 'hospital-specialty':
          this.renderHospitalSpecialtyView(container);
          break;
        case 'hospital-reports':
        case 'hospital-report-detail':
          this.renderHospitalReportDetailView(container);
          break;
        case 'hospital-report-stats':
          this.renderHospitalReportStatsView(container);
          break;

        default:
          this.renderRealtimeMapView(container);
      }
    }

    // --- 1. REALTIME MAP VIEW (COMMAND CENTER CORE) ---
    renderRealtimeMapView(container) {
      const state = window.StateManager.getState();
      const vehicles = state.vehicles || [];
      const activeCases = (state.cases || []).filter(c => !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(c.status));
      const caseOfPlate = (plate) => activeCases.find(c => c.dispatch?.vehiclePlate === plate);
      // Xe hiển thị mặc định ở dải dưới khi chưa chọn xe (ưu tiên xe đang có ca)
      const defaultVeh = vehicles.find(v => caseOfPlate(v.plate)) || vehicles[0];
      if (this.realtimeSelectedPlate && !vehicles.some(v => v.plate === this.realtimeSelectedPlate)) {
        this.realtimeSelectedPlate = null;
      }
      let currentSelectedPlate = this.realtimeSelectedPlate || null;
      const initialVeh = vehicles.find(v => v.plate === currentSelectedPlate) || defaultVeh;
      const initialCase = caseOfPlate(initialVeh?.plate);

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
            <div class="map-bottom-grid" id="realtime-bottom-strip">
              ${this.renderRealtimeBottomStrip(initialVeh, initialCase)}
            </div>
          </div>

          <!-- Right: Vehicle Fleet & Active Cases Panel -->
          <div class="side-panel-container">
            <div class="panel-header-tabs">
              <button class="panel-tab-btn active" id="tab-panel-vehicles">Đội xe Cứu thương (${vehicles.length})</button>
              <button class="panel-tab-btn" id="tab-panel-cases">Ca đang xử lý (${activeCases.length})</button>
            </div>

            <div class="panel-search-bar">
              <input type="text" id="filter-vehicle-input" placeholder="Tìm biển số xe, kíp trực, trạm..." />
            </div>

            <div class="panel-list-scroll" id="vehicle-card-list">
              ${this.renderVehicleCards(vehicles, currentSelectedPlate)}
            </div>
          </div>
        </div>
      `;

      // Mount Can Tho Map (hủy instance cũ để không rò vòng lặp animation)
      if (this.mapInstance) this.mapInstance.destroy();
      this.mapInstance = new window.CanThoMap('cantho-map-viewport');
      this.mapInstance.render();

      const listEl = container.querySelector('#vehicle-card-list');
      const bottomStrip = container.querySelector('#realtime-bottom-strip');

      const bindBottomFocusBtn = () => {
        bottomStrip?.querySelectorAll('.btn-focus-selected-vehicle, .btn-focus-incident-vehicle').forEach(btn => {
          btn.addEventListener('click', () => {
            const plate = btn.getAttribute('data-plate');
            if (!plate) return;
            if (plate === currentSelectedPlate) {
              this.mapInstance?.focusVehicle(plate); // canh lại khung nhìn
            } else {
              setSelection(plate);
            }
          });
        });
      };

      // Chọn xe (plate) hoặc hủy chọn (null) → đồng bộ panel, dải dưới và bản đồ
      const setSelection = (plate, { animate = true } = {}) => {
        currentSelectedPlate = plate;
        this.realtimeSelectedPlate = plate;

        listEl?.querySelectorAll('.vehicle-card').forEach(c => {
          const selected = !!plate && c.getAttribute('data-plate') === plate;
          c.classList.toggle('is-selected', selected);
          if (selected && animate) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        const targetVeh = (plate && vehicles.find(v => v.plate === plate)) || defaultVeh;
        if (bottomStrip) {
          bottomStrip.innerHTML = this.renderRealtimeBottomStrip(targetVeh, caseOfPlate(targetVeh?.plate));
          bindBottomFocusBtn();
        }

        if (!this.mapInstance) return;
        if (plate) this.mapInstance.focusVehicle(plate, { animate });
        else this.mapInstance.clearFocus();
      };

      // Thẻ xe: bấm lại thẻ đang chọn → hủy chọn, về giao diện bình thường
      const bindCardClicks = () => {
        if (!listEl) return;
        listEl.querySelectorAll('.vehicle-card').forEach(card => {
          card.addEventListener('click', () => {
            const plate = card.getAttribute('data-plate');
            if (!plate) return;
            setSelection(plate === currentSelectedPlate ? null : plate);
          });
        });
      };
      bindCardClicks();
      bindBottomFocusBtn();

      // Hook map marker clicks (vehicles, incident, hospitals)
      if (this.mapInstance) {
        this.mapInstance.onVehicleSelect = (plate) => {
          if (plate !== currentSelectedPlate) setSelection(plate);
        };

        this.mapInstance.onIncidentSelect = (caseId) => {
          const c = activeCases.find(item => item.id === caseId);
          const plate = c?.dispatch?.vehiclePlate;
          if (!plate) return;
          if (plate !== currentSelectedPlate) setSelection(plate);
          if (bottomStrip) {
            bottomStrip.innerHTML = this.renderRealtimeIncidentBottomStrip(c);
            bindBottomFocusBtn();
          }
        };

        this.mapInstance.onHospitalSelect = (hid) => {
          const h = (state.hospitals || []).find(item => item.id === hid);
          if (!h || !bottomStrip) return;
          bottomStrip.innerHTML = this.renderRealtimeHospitalBottomStrip(h);
          bottomStrip.querySelector('.btn-call-hosp-bottom')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Đang quay số...', `Kết nối Hotline Cấp cứu: ${h.name} (${h.hotline})`);
          });
        };

        // Khôi phục chế độ theo dõi sau khi view re-render (ví dụ khi ca được cập nhật)
        if (currentSelectedPlate) {
          this.mapInstance.focusVehicle(currentSelectedPlate, { animate: false });
        }
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
            listEl.innerHTML = this.renderVehicleCards(filtered, currentSelectedPlate);
            bindCardClicks();
          }
        });
      }

      // Tab switcher for right panel: Vehicles vs Active Cases
      const tabVehicles = container.querySelector('#tab-panel-vehicles');
      const tabCases = container.querySelector('#tab-panel-cases');
      if (tabVehicles && tabCases) {
        tabVehicles.addEventListener('click', () => {
          tabVehicles.classList.add('active');
          tabCases.classList.remove('active');
          if (listEl) {
            listEl.innerHTML = this.renderVehicleCards(vehicles, currentSelectedPlate);
            bindCardClicks();
          }
        });
        tabCases.addEventListener('click', () => {
          tabCases.classList.add('active');
          tabVehicles.classList.remove('active');
          if (listEl) {
            listEl.innerHTML = activeCases.map(c => `
              <div class="vehicle-card is-emergency ${c.dispatch?.vehiclePlate === currentSelectedPlate ? 'is-selected' : ''}" data-plate="${c.dispatch?.vehiclePlate}" style="margin-bottom:8px;">
                <div class="vehicle-card-top">
                  <span class="vehicle-plate" style="color:var(--red-vivid);">${c.code}</span>
                  <span class="status-pill status-pill-processing">${c.statusText}</span>
                </div>
                <div style="font-size:12px;color:var(--text-white);margin-top:2px;">${c.patient?.name} (${c.patient?.age}t, ${c.patient?.gender})</div>
                <div class="vehicle-meta-row">
                  <span>${c.incident?.name || '—'}</span>
                  <span>Xe: <strong style="color:var(--yellow-vivid);font-family:var(--font-mono);">${c.dispatch?.vehiclePlate}</strong></span>
                </div>
                <div class="vehicle-meta-row" style="border-top:1px dashed var(--border-main);padding-top:4px;margin-top:4px;">
                  <span style="font-size:11px;color:var(--text-muted);">Đến: ${c.dispatch?.hospitalName}</span>
                  <span style="color:var(--yellow-vivid);font-weight:600;">ETA: ${c.eta || '—'}</span>
                </div>
              </div>
            `).join('');
            bindCardClicks();
          }
        });
      }
    }

    renderRealtimeBottomStrip(v, activeCase) {
      if (!v) return '';

      const isEmergency = v.status === 'EMERGENCY';
      const isAvailable = v.status === 'AVAILABLE' || v.status === 'READY';
      const isMaintenance = v.status === 'MAINTENANCE';

      let leftStripHtml = '';

      if (isEmergency) {
        const destHospital = activeCase?.dispatch?.hospitalName || 'BV Đa khoa TP Cần Thơ';
        const patientDesc = activeCase?.patient?.name
          ? `BN ${activeCase.patient.name} (${activeCase.patient.symptom || 'chấn thương'})`
          : 'bệnh nhân cấp cứu';
        const locationText = activeCase?.location?.address || 'Cầu Hưng Lợi, P. Hưng Lợi, Q. Ninh Kiều';
        const etaText = activeCase?.eta || '~6 phút';

        leftStripHtml = `
          <div class="emergency-alert-strip" style="background: linear-gradient(90deg, rgba(229, 37, 33, 0.18) 0%, transparent 100%);">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span class="live-dot"></span>
                <strong style="color:var(--red-vivid);font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Đang cấp cứu</strong>
              </div>
              <div style="font-size:13px;color:var(--text-white);">
                Xe <strong style="color:var(--red-vivid);font-family:var(--font-mono);">${v.plate}</strong> đang vận chuyển ${patientDesc} về ${destHospital}
              </div>
              <div style="font-size:11px;color:var(--text-muted);">
                Vị trí: ${locationText} · Tốc độ: <strong style="color:var(--text-white);">${v.speed} km/h</strong> · ETA: <strong class="eta-value-live" style="color:var(--yellow-vivid);">${etaText}</strong>
              </div>
            </div>
            <button class="btn btn-emergency btn-sm btn-focus-selected-vehicle" data-plate="${v.plate}">Xem Vị Trí</button>
          </div>
        `;
      } else if (isAvailable) {
        leftStripHtml = `
          <div class="emergency-alert-strip" style="background: linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, transparent 100%);">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="width:8px;height:8px;border-radius:50%;background:#10B981;display:inline-block;box-shadow:0 0 8px #10B981;"></span>
                <strong style="color:#10B981;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Xe Sẵn Sàng Nhận Lệnh Điều Động</strong>
              </div>
              <div style="font-size:13px;color:var(--text-white);">
                Xe <strong style="color:#60A5FA;font-family:var(--font-mono);">${v.plate}</strong> · ${v.typeName} · ${v.station}
              </div>
              <div style="font-size:11px;color:var(--text-muted);">
                Trực ban tại: ${v.station} · Tốc độ: ${v.speed} km/h · Pin: <strong style="color:#10B981;">${v.battery}%</strong> · GPS: <span style="color:#10B981;">● ${v.gpsStatus}</span>
              </div>
            </div>
            <button class="btn btn-default btn-sm btn-focus-selected-vehicle" data-plate="${v.plate}">Xem Vị Trí</button>
          </div>
        `;
      } else if (isMaintenance) {
        leftStripHtml = `
          <div class="emergency-alert-strip" style="background: linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, transparent 100%);">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="width:8px;height:8px;border-radius:50%;background:#F59E0B;display:inline-block;"></span>
                <strong style="color:#F59E0B;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Phương Tiện Đang Bảo Trì / Kỹ Thuật</strong>
              </div>
              <div style="font-size:13px;color:var(--text-white);">
                Xe <strong style="color:#F59E0B;font-family:var(--font-mono);">${v.plate}</strong> · ${v.station}
              </div>
              <div style="font-size:11px;color:var(--text-muted);">
                Trạng thái: Tạm dừng trực điều động · Kiểm định trang thiết bị & xe cứu thương
              </div>
            </div>
            <button class="btn btn-default btn-sm btn-focus-selected-vehicle" data-plate="${v.plate}">Xem Vị Trí</button>
          </div>
        `;
      } else {
        leftStripHtml = `
          <div class="emergency-alert-strip">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span class="live-dot"></span>
                <strong style="color:var(--text-white);font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Thông tin Xe ${v.plate}</strong>
              </div>
              <div style="font-size:13px;color:var(--text-white);">
                Xe <strong style="color:#60A5FA;font-family:var(--font-mono);">${v.plate}</strong> · ${v.typeName} · ${v.station}
              </div>
              <div style="font-size:11px;color:var(--text-muted);">
                Tốc độ: ${v.speed} km/h · Pin: ${v.battery}% · GPS: ${v.gpsStatus}
              </div>
            </div>
            <button class="btn btn-default btn-sm btn-focus-selected-vehicle" data-plate="${v.plate}">Xem Vị Trí</button>
          </div>
        `;
      }

      const cameraLabel = isEmergency ? 'CAM KHOANG' : 'CAM TRƯỚC';
      const cameraDesc = isEmergency ? 'Camera Cabin Khoang Bệnh Nhân' : `Camera Hành Trình Trước Xe (${v.plate})`;
      const streamInfo = v.gpsStatus === 'ONLINE' ? `Xe ${v.plate} · 25 FPS · 1080p` : 'Ngoại tuyến / Chế độ chờ';
      const signalText = v.gpsStatus === 'ONLINE' ? 'Tín hiệu truyền ổn định (5G)' : 'Chế độ chờ (Standby)';
      const signalColor = v.gpsStatus === 'ONLINE' ? '#10B981' : '#F59E0B';

      const rightStripHtml = `
        <div class="live-camera-strip">
          <div class="camera-preview-box">
            <span style="font-size:10px;color:var(--text-muted);text-align:center;line-height:1.1;padding:2px;">${cameraLabel}</span>
            <div style="position:absolute;top:4px;right:4px;" class="${v.gpsStatus === 'ONLINE' ? 'live-dot' : ''}"></div>
          </div>
          <div style="font-size:12px;">
            <div style="color:var(--text-white);font-weight:600;">${cameraDesc}</div>
            <div style="color:var(--text-muted);font-size:11px;">${streamInfo}</div>
            <div style="color:${signalColor};font-size:11px;">${signalText}</div>
          </div>
        </div>
      `;

      return leftStripHtml + rightStripHtml;
    }

    renderRealtimeHospitalBottomStrip(h) {
      if (!h) return '';

      const isReady = h.status === 'READY' || h.status === 'AVAILABLE';
      const isLimited = h.status === 'LIMITED' || h.status === 'RESTRICTED';

      const leftStripHtml = `
        <div class="emergency-alert-strip" style="background: linear-gradient(90deg, rgba(59, 130, 246, 0.18) 0%, transparent 100%);">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="width:8px;height:8px;border-radius:50%;background:#3B82F6;display:inline-block;box-shadow:0 0 8px #3B82F6;"></span>
              <strong style="color:#60A5FA;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Điểm Tiếp Nhận Cấp Cứu — Bệnh Viện</strong>
            </div>
            <div style="font-size:13px;color:var(--text-white);">
              <strong style="color:#FFFFFF;">${h.name}</strong> · ${h.address}
            </div>
            <div style="font-size:11px;color:var(--text-muted);">
              Giường CC trống: <strong style="color:#10B981;">${h.availableBeds || 12} / ${h.emergencyBeds || 20}</strong> · Máy thở sẵn sàng: <strong style="color:#10B981;">${h.ventilatorsAvailable || 5} máy</strong> · Trạng thái: <strong style="color:${isReady ? '#10B981' : isLimited ? '#F59E0B' : '#EF4444'};">${h.statusText || 'Đang nhận'}</strong>
            </div>
          </div>
          <button class="btn btn-default btn-sm btn-call-hosp-bottom" data-hosp="${h.name}" data-phone="${h.hotline}">
            ${window.CCNV_UI.ICONS.phone} ${h.hotline}
          </button>
        </div>
      `;

      const rightStripHtml = `
        <div class="live-camera-strip">
          <div class="camera-preview-box">
            <span style="font-size:10px;color:var(--text-muted);text-align:center;line-height:1.1;padding:2px;">CAM BV</span>
            <div style="position:absolute;top:4px;right:4px;" class="live-dot"></div>
          </div>
          <div style="font-size:12px;">
            <div style="color:var(--text-white);font-weight:600;">Camera Khu Tiếp Nhận Cấp Cứu</div>
            <div style="color:var(--text-muted);font-size:11px;">Cổng Cấp cứu ${h.name} · 25 FPS · 1080p</div>
            <div style="color:#10B981;font-size:11px;">Luồng truyền camera BV ổn định</div>
          </div>
        </div>
      `;

      return leftStripHtml + rightStripHtml;
    }

    renderRealtimeIncidentBottomStrip(c = {}) {
      const plate = c.dispatch?.vehiclePlate || '—';
      const patient = c.patient?.name ? `BN ${c.patient.name}${c.patient.age ? ` ${c.patient.age}T` : ''}` : 'Chưa rõ danh tính';
      const leftStripHtml = `
        <div class="emergency-alert-strip" style="background: linear-gradient(90deg, rgba(229, 37, 33, 0.22) 0%, transparent 100%);">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span class="live-dot"></span>
              <strong style="color:var(--red-vivid);font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Điểm Hiện Trường Cấp Cứu Khẩn Cấp · ${c.code || ''}</strong>
            </div>
            <div style="font-size:13px;color:var(--text-white);">
              Hiện trường: <strong style="color:var(--red-vivid);">${c.location?.address || '—'}</strong> — ${c.incident?.name || 'Cấp cứu'} (${patient})
            </div>
            <div style="font-size:11px;color:var(--text-muted);">
              Xe phụ trách: <strong style="color:var(--yellow-vivid);font-family:var(--font-mono);">${plate}</strong>${c.dispatch?.crewName ? ` (${c.dispatch.crewName})` : ''} · Về: ${c.dispatch?.hospitalName || '—'}${c.eta ? ` · ETA: ${c.eta}` : ''}
            </div>
          </div>
          <button class="btn btn-emergency btn-sm btn-focus-incident-vehicle" data-plate="${plate}">Theo Dõi Xe</button>
        </div>
      `;

      const rightStripHtml = `
        <div class="live-camera-strip">
          <div class="camera-preview-box">
            <span style="font-size:10px;color:var(--text-muted);text-align:center;line-height:1.1;padding:2px;">CAM KHOANG</span>
            <div style="position:absolute;top:4px;right:4px;" class="live-dot"></div>
          </div>
          <div style="font-size:12px;">
            <div style="color:var(--text-white);font-weight:600;">Camera Cabin Khoang Bệnh Nhân</div>
            <div style="color:var(--text-muted);font-size:11px;">Xe ${plate} · 25 FPS · 1080p</div>
            <div style="color:#10B981;font-size:11px;">Tín hiệu truyền ổn định (5G)</div>
          </div>
        </div>
      `;

      return leftStripHtml + rightStripHtml;
    }

    renderVehicleCards(vehicles, selectedPlate = '65A-012.34') {
      if (!vehicles || vehicles.length === 0) {
        return `<div style="text-align:center;padding:24px;color:var(--text-muted);">Không tìm thấy phương tiện</div>`;
      }
      return vehicles.map(v => {
        const isEmergency = v.status === 'EMERGENCY';
        const isSelected = v.plate === selectedPlate;
        return `
          <div class="vehicle-card ${isEmergency ? 'is-emergency' : ''} ${isSelected ? 'is-selected' : ''}" data-plate="${v.plate}">
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

    // --- 2. CALL CENTER (TỔNG ĐÀI 115) VIEW (SITEMAP 8.1) ---
    renderCallCenterView(container, activeTab = 'active') {
      const state = window.StateManager.getState();
      const calls = state.callHistory || [];
      const hospitals = state.hospitals || [];
      const presets = state.locationPresets || [];
      const incidentTypes = state.incidentTypes || [];
      const activeCall = state.callScenarios?.[0] || {
        callerName: 'Trần Anh Vũ',
        callerPhone: '0913.882.115',
        patientName: 'Nguyễn Văn Hưng',
        patientAge: 34,
        patientGender: 'Nam',
        address: 'Chân cầu Hưng Lợi, P. Hưng Lợi, Q. Ninh Kiều, Cần Thơ',
        incidentCode: 'INC_TNGT',
        incidentName: 'Tai nạn giao thông có người bất tỉnh',
        severity: 'CRITICAL',
        sourceName: '115 Thoại',
        notes: 'Va chạm mạnh giữa 2 xe máy, nạn nhân bất tỉnh khoảng 2 phút, chảy máu nhiều vùng đầu, nghi gãy cẳng tay phải.'
      };

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:14px;">
            <h2 style="color:var(--text-white);font-size:18px;display:flex;align-items:center;gap:8px;">
              ${window.CCNV_UI.ICONS.phoneCall}
              <span>Tổng đài Tiếp nhận Cuộc gọi Khẩn cấp 115</span>
            </h2>
            <p style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              Tiếp nhận cuộc gọi thoại 115, tín hiệu SOS từ App Người dân, tích hợp và đàm thoại ghi âm
            </p>
          </div>

          <!-- Sub Navigation Tabs Bar (Sitemap 8.1) -->
          <div style="display:flex;gap:8px;border-bottom:1px solid var(--border-main);padding-bottom:10px;margin-bottom:16px;">
            <button class="btn ${activeTab === 'active' ? 'btn-emergency' : 'btn-default'} btn-sm call-tab-nav" data-tab="active">
              ${window.CCNV_UI.ICONS.phoneCall}
              <span>Cuộc gọi hiện tại</span>
              <span class="live-dot" style="margin-left:4px;"></span>
            </button>
            <button class="btn ${activeTab === 'history' ? 'btn-emergency' : 'btn-default'} btn-sm call-tab-nav" data-tab="history">
              ${window.CCNV_UI.ICONS.clock}
              <span>Lịch sử cuộc gọi (${calls.length})</span>
            </button>
            <button class="btn ${activeTab === 'directory' ? 'btn-emergency' : 'btn-default'} btn-sm call-tab-nav" data-tab="directory">
              ${window.CCNV_UI.ICONS.hospital}
              <span>Danh bạ bệnh viện (${hospitals.length})</span>
            </button>
            <button class="btn ${activeTab === 'transfer' ? 'btn-emergency' : 'btn-default'} btn-sm call-tab-nav" data-tab="transfer">
              ${window.CCNV_UI.ICONS.navigation}
              <span>Chuyển tiếp</span>
            </button>
          </div>

          <div id="call-tab-pane-container"></div>
        </div>
      `;

      const paneContainer = container.querySelector('#call-tab-pane-container');

      // Bind Top Sub-tabs
      container.querySelectorAll('.call-tab-nav').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-tab');
          this.renderCallCenterView(container, tab);
        });
      });



      // --- TAB 1: CUỘC GỌI HIỆN TẠI (ACTIVE CALL & ONE-HAND RAPID INTAKE PROTOCOL) ---
      if (activeTab === 'active') {
        // Clean up any previously attached key listener
        if (this._callCenterKeyHandler) {
          window.removeEventListener('keydown', this._callCenterKeyHandler);
          this._callCenterKeyHandler = null;
        }

        // SOP First Aid Guidance Database (Triage & Pre-arrival instructions for caller)
        const FIRST_AID_GUIDES = {
          INC_TNGT: [
            { num: '01', text: 'KHÔNG di chuyển nạn nhân nếu nghi ngờ chấn thương sọ não, cột sống cổ hoặc lưng.', vital: true },
            { num: '02', text: 'Dùng vải/gạc sạch đè chặt trực tiếp lên vết thương đầu để cầm máu liên tục.', vital: true },
            { num: '03', text: 'Nới lỏng cúc áo, giữ thông thoáng đường thở, KHÔNG cho uống nước hay cạo gió.', vital: false },
            { num: '04', text: 'Bảo vệ hiện trường, đặt vật chắn cảnh báo từ xa để tránh va chạm liên hoàn.', vital: false }
          ],
          INC_STROKE: [
            { num: '01', text: 'Ghi nhận chính xác mốc GIỜ KHỞI PHÁT triệu chứng đầu tiên (Giờ vàng cấp cứu < 4.5h).', vital: true },
            { num: '02', text: 'Đặt người bệnh nằm đầu cao 30 độ, nghiêng nhẹ một bên tránh trào ngược đờm dãi.', vital: true },
            { num: '03', text: 'Tuyệt đối KHÔNG tự ý cho uống thuốc hạ huyết áp, KHÔNG chích lể ngón tay hay cạo gió.', vital: true },
            { num: '04', text: 'Chuẩn bị sẵn thẻ BHYT, CCCD và các toa thuốc đang điều trị (nếu có).', vital: false }
          ],
          INC_CARDIAC: [
            { num: '01', text: 'ĐẶT NẠN NHÂN NẰM NGỬA TRÊN NỀN CỨNG BẰNG PHẲNG NGAY LẬP TỨC!', vital: true },
            { num: '02', text: 'ÉP TIM LIÊN TỤC 100 - 120 LẦN/PHÚT! Đặt 2 tay giữa ngực, ấn sâu ít nhất 5-6 cm.', vital: true },
            { num: '03', text: 'Không gián đoạn ép tim quá 10 giây. Đổi người ép mỗi 2 phút nếu mệt mỏi.', vital: true },
            { num: '04', text: 'Nếu khu vực có máy khử rung tự động (AED), hướng dẫn bật máy và dán điện cực.', vital: false }
          ],
          INC_RESPIRATORY: [
            { num: '01', text: 'Nếu do hóc dị vật đường thở: Hướng dẫn người nhà làm thủ thuật Heimlich ngay.', vital: true },
            { num: '02', text: 'Đặt người bệnh tư thế Fowler (nửa nằm nửa ngồi 45-60 độ), khuyên hít thở sâu chậm.', vital: true },
            { num: '03', text: 'Nới rộng cổ áo, thắt lưng, mở cửa sổ phòng cho thông thoáng dưỡng khí.', vital: false },
            { num: '04', text: 'Nếu người bệnh có bình xịt dãn phế quản (Salbutamol) cá nhân, hỗ trợ xịt 2 nhát.', vital: false }
          ],
          INC_TRAUMA: [
            { num: '01', text: 'Băng ép cầm máu tại chỗ bằng băng vô khuẩn hoặc vải sạch có sẵn.', vital: true },
            { num: '02', text: 'Cố định tạm thời chi gãy bằng nẹp hoặc thanh gỗ/bìa cứng, KHÔNG cố nắn xương.', vital: true },
            { num: '03', text: 'Ủ ấm cho nạn nhân, kê cao chân nhẹ nếu có dấu hiệu da tái lạnh, tụt huyết áp.', vital: false }
          ],
          INC_OBSTETRIC: [
            { num: '01', text: 'Đặt sản phụ nằm nghiêng trái để tránh chèn ép tĩnh mạch chủ dưới.', vital: true },
            { num: '02', text: 'Hướng dẫn sản phụ thở đều, KHÔNG rặn nếu chưa có chỉ định của cán bộ y tế.', vital: true },
            { num: '03', text: 'Chuẩn bị nước ấm, khăn sạch, bọc ấm nếu em bé lọt lòng trước khi xe đến.', vital: false }
          ],
          INC_PEDIATRIC: [
            { num: '01', text: 'Đặt trẻ nằm nghiêng sang một bên, tuyệt đối KHÔNG nhét vật cứng vào miệng trẻ!', vital: true },
            { num: '02', text: 'Cởi bớt quần áo, lau mát bằng nước ấm ở trán, nách, bẹn để hạ sốt.', vital: true },
            { num: '03', text: 'Ghi nhận thời gian cơn co giật kéo dài bao nhiêu phút để báo kíp cấp cứu.', vital: false }
          ],
          INC_OTHER: [
            { num: '01', text: 'Động viên, trấn an tinh thần người bệnh và người nhà bình tĩnh.', vital: false },
            { num: '02', text: 'Liên tục theo dõi tri giác, nhịp thở và màu sắc da niêm mạc.', vital: true },
            { num: '03', text: 'Cử người ra đầu ngõ/cổng đón đường và mở sẵn cửa cho xe cấp cứu vào.', vital: false }
          ]
        };

        // Current Form State
        let availableVehicles = (state.vehicles && state.vehicles.length >= 6) ? state.vehicles.slice(0, 6) : (state.vehicles || []);
        let currentSelectedPlates = new Set(['65A-015.67']); // Default select 1st vehicle (Type A)
        let currentVehicleTypes = new Set(['Type A']); // Synchronized types
        let currentVehicleType = 'Type A'; // Primary selected vehicle type

        // On-duty personnel for current shift (Bác sĩ, Điều dưỡng, Lái xe)
        let availablePersonnel = (state.personnel && state.personnel.length >= 6)
          ? state.personnel.filter(p => p.status === 'ON_DUTY').slice(0, 6)
          : (state.personnel ? state.personnel.slice(0, 6) : []);
        // Default select first team of 3 (1 Doctor, 1 Nurse, 1 Driver)
        let currentSelectedPersonnel = new Set(availablePersonnel.slice(0, 3).map(p => p.id));

        let currentSeverity = activeCall.severity || 'CRITICAL';
        let currentGender = activeCall.patientGender || 'Nam';
        let currentIncident = activeCall.incidentCode || 'INC_TNGT';
        let currentFocusedCard = 'card-patient';

        // Vehicle lookup helpers
        const getRecommendedVehicle = () => {
          const firstPlate = Array.from(currentSelectedPlates)[0];
          return availableVehicles.find(v => v.plate === firstPlate) || availableVehicles[0] || state.vehicles[0];
        };

        paneContainer.innerHTML = `
          <div style="display:grid;grid-template-columns: 380px 1fr; gap:16px; align-items:start;">
            <!-- LEFT COLUMN: Live Call HUD & SOP First Aid Guidance -->
            <div style="display:flex;flex-direction:column;gap:14px;">
              <!-- 1. Live Call Card -->
              <div class="content-card" style="border:1px solid rgba(239,68,68,0.45);padding:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                  <span class="status-pill status-pill-new" style="display:flex;align-items:center;gap:6px;font-weight:700;">
                    <span class="live-dot"></span> ĐANG ĐÀM THOẠI [01:42]
                  </span>
                </div>

                <div style="font-size:20px;font-weight:700;color:var(--text-white);margin-bottom:4px;font-family:var(--font-mono);letter-spacing:0.5px;">
                  ${activeCall.callerPhone}
                </div>
                <div style="font-size:13.5px;color:#93C5FD;font-weight:600;margin-bottom:12px;">
                </div>

                <!-- Cell-ID Card -->
                <div style="background:var(--bg-elevated);padding:10px 12px;border-radius:6px;border:1px solid var(--border-main);margin-bottom:12px;font-size:12px;">
                  <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">
                    Định vị:
                  </div>
                  <div style="color:var(--text-white);font-weight:600;font-size:13px;">
                    Phường Hưng Lợi, Thành phố Cần Thơ
                  </div>
                </div>

                <!-- Call Control Actions -->
                <div style="display:flex;gap:6px;">
                  <button class="btn btn-default btn-sm" id="btn-call-transfer-quick" style="flex:1;">
                    <span>Chuyển máy</span>
                  </button>
                  <button class="btn btn-default btn-sm" id="btn-call-hangup" style="flex:1;color:var(--red-vivid);border-color:rgba(239,68,68,0.35);">
                    <span>Gác máy</span>
                  </button>
                </div>
              </div>

              <!-- 2. Audio Recording Player Card -->
              <div class="content-card" style="padding:14px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <span style="font-size:12.5px;font-weight:600;color:var(--text-white);display:flex;align-items:center;gap:6px;">
                    ${window.CCNV_UI.ICONS.radio}
                    <span>Ghi âm & Nhận dạng giọng nói</span>
                  </span>
                  <span style="font-size:11px;color:#10B981;font-weight:700;"> 01:42</span>
                </div>

                <!-- Dynamic Waveform Visualizer -->
                <div style="background:var(--bg-main);border-radius:6px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:3px;height:42px;border:1px solid var(--border-main);margin-bottom:8px;">
                  ${[15, 28, 40, 22, 35, 18, 45, 30, 20, 38, 25, 12, 32, 42, 28, 16, 36, 44, 26, 18, 30, 40, 22, 14].map(h => `
                    <div style="flex:1;background:linear-gradient(to top, #3B82F6, #60A5FA);height:${h}px;border-radius:2px;opacity:0.85;"></div>
                  `).join('')}
                </div>

                <div style="background:rgba(30, 41, 59, 0.7);padding:8px 10px;border-radius:6px;font-size:11.5px;color:var(--text-slate);border:1px solid #1E3A8A;">
                  <em>"Bệnh nhân ngã xe máy bất tỉnh khoảng 2 phút, hiện đang thở dốc, chảy máu nhiều vùng trán..."</em>
                </div>
              </div>
            </div>

            <!-- RIGHT COLUMN: Rapid One-Hand Intake Deck -->
            <div style="display:flex;flex-direction:column;gap:12px;">
              <!-- FORM CARD 1: Thông tin cơ bản (Step 1: Họ tên, Tuổi, Giới tính) -->
              <div class="rapid-field-card is-active-step" id="card-patient" data-step-id="1">
                <div class="rapid-field-header">
                  <div class="rapid-field-title">
                    <span class="rapid-step-num">1</span>
                    <span>Thông tin cơ bản</span>
                  </div>
                  <div class="rapid-field-hint">
                    <span>Phím tắt:</span>
                    <kbd class="quick-kbd">Tab</kbd> chuyển trường / <kbd class="quick-kbd">1..3</kbd> Giới tính
                  </div>
                </div>

                <div style="display:grid;grid-template-columns: 1fr 130px; gap:12px; margin-bottom:12px;">
                  <div class="form-field">
                    <label class="form-label">Họ và tên bệnh nhân</label>
                    <input type="text" id="rapid-patient-name" value="${activeCall.patientName || 'Nguyễn Văn Hưng'}" placeholder="Nhập tên bệnh nhân hoặc Chưa rõ tên" />
                  </div>
                  <div class="form-field">
                    <label class="form-label">Tuổi ước tính</label>
                    <input type="number" id="rapid-patient-age" value="${activeCall.patientAge || 34}" min="0" max="120" />
                  </div>
                </div>

                <div class="form-field">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                    <label class="form-label" style="margin-bottom:0;">Giới tính</label>
                    <div style="font-size:11px;color:var(--text-muted);display:flex;gap:4px;align-items:center;">
                      <span>Bấm số:</span>
                      <kbd class="quick-kbd">1</kbd> Nam
                      <kbd class="quick-kbd">2</kbd> Nữ
                      <kbd class="quick-kbd">3</kbd> Chưa rõ
                    </div>
                  </div>
                  <div class="rapid-chip-grid rapid-chip-grid-3" id="card-gender" tabindex="0" style="outline:none;">
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentGender === 'Nam' ? 'active' : ''}" data-gender="Nam" data-key="1">
                      <kbd class="quick-kbd">1</kbd>
                      <div class="chip-content">
                        <span class="chip-title">Nam</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentGender === 'Nữ' ? 'active' : ''}" data-gender="Nữ" data-key="2">
                      <kbd class="quick-kbd">2</kbd>
                      <div class="chip-content">
                        <span class="chip-title">Nữ</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentGender === 'Chưa rõ' ? 'active' : ''}" data-gender="Chưa rõ" data-key="3">
                      <kbd class="quick-kbd">3</kbd>
                      <div class="chip-content">
                        <span class="chip-title">Chưa rõ</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <!-- FORM CARD 2: Hiện trường & Địa chỉ (Step 2) -->
              <div class="rapid-field-card" id="card-location" data-step-id="2">
                <div class="rapid-field-header">
                  <div class="rapid-field-title">
                    <span class="rapid-step-num">2</span>
                    <span>Hiện trường & Định vị Tọa độ</span>
                  </div>
                  <div class="rapid-field-hint">
                    <kbd class="quick-kbd">Alt+C</kbd> Nạp Cell-ID
                    <kbd class="quick-kbd">Tab</kbd> Chuyển tiếp
                  </div>
                </div>

                <div class="form-field">
                  <label class="form-label">Địa chỉ hiện trường đón cấp cứu</label>
                  <input type="text" id="rapid-address" value="${activeCall.address || 'Chân cầu Hưng Lợi, P. Hưng Lợi, Q. Ninh Kiều, Cần Thơ'}" placeholder="Số nhà, tên đường, phường/xã, điểm mốc nhận diện..." />
                </div>


              </div>

              <!-- FORM CARD 3: Tình huống cấp cứu (Step 3 - Incident Selector 1 to 8) -->
              <div class="rapid-field-card" id="card-incident" data-step-id="3" tabindex="0">
                <div class="rapid-field-header">
                  <div class="rapid-field-title">
                    <span class="rapid-step-num">3</span>
                    <span>Loại Tình huống Cấp cứu</span>
                  </div>
                  <div class="rapid-field-hint">
                    <span>Bấm phím số:</span>
                    <kbd class="quick-kbd">1..8</kbd> Chọn tình huống & xem hướng dẫn sơ cứu
                  </div>
                </div>

                <div class="rapid-chip-grid rapid-chip-grid-4">
                  <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_TNGT' ? 'active' : ''}" data-incident="INC_TNGT" data-key="1">
                    <kbd class="quick-kbd">1</kbd>
                    <div class="chip-content">
                      <span class="chip-title">Tai nạn GT</span>
                      <span class="chip-desc">Va chạm đường bộ</span>
                    </div>
                  </button>
                  <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_STROKE' ? 'active' : ''}" data-incident="INC_STROKE" data-key="2">
                    <kbd class="quick-kbd">2</kbd>
                    <div class="chip-content">
                      <span class="chip-title">Đột quỵ não</span>
                      <span class="chip-desc">Liệt mặt, yếu chi, nói khó</span>
                    </div>
                  </button>
                  <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_CARDIAC' ? 'active' : ''}" data-incident="INC_CARDIAC" data-key="3">
                    <kbd class="quick-kbd">3</kbd>
                    <div class="chip-content">
                      <span class="chip-title">Ngừng tim / CPR</span>
                      <span class="chip-desc">Đau thắt ngực, mất mạch</span>
                    </div>
                  </button>
                  <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_RESPIRATORY' ? 'active' : ''}" data-incident="INC_RESPIRATORY" data-key="4">
                    <kbd class="quick-kbd">4</kbd>
                    <div class="chip-content">
                      <span class="chip-title">Suy hô hấp</span>
                      <span class="chip-desc">Khó thở, tím tái, hóc dị vật</span>
                    </div>
                  </button>
                  <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_TRAUMA' ? 'active' : ''}" data-incident="INC_TRAUMA" data-key="5">
                    <kbd class="quick-kbd">5</kbd>
                    <div class="chip-content">
                      <span class="chip-title">Chấn thương</span>
                      <span class="chip-desc">Ngã cao, gãy xương lớn</span>
                    </div>
                  </button>
                  <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_OBSTETRIC' ? 'active' : ''}" data-incident="INC_OBSTETRIC" data-key="6">
                    <kbd class="quick-kbd">6</kbd>
                    <div class="chip-content">
                      <span class="chip-title">Sản khoa</span>
                      <span class="chip-desc">Chuyển dạ, băng huyết</span>
                    </div>
                  </button>
                  <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_PEDIATRIC' ? 'active' : ''}" data-incident="INC_PEDIATRIC" data-key="7">
                    <kbd class="quick-kbd">7</kbd>
                    <div class="chip-content">
                      <span class="chip-title">Co giật sốt cao</span>
                      <span class="chip-desc">Cấp cứu nhi khoa</span>
                    </div>
                  </button>
                  <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_OTHER' ? 'active' : ''}" data-incident="INC_OTHER" data-key="8">
                    <kbd class="quick-kbd">8</kbd>
                    <div class="chip-content">
                      <span class="chip-title">Khác...</span>
                      <span class="chip-desc">Tình huống chung</span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- FORM CARD 4: Mức độ khẩn (Step 4 - Triage Priority 1, 2, 3) -->
              <div class="rapid-field-card" id="card-severity" data-step-id="4" tabindex="0">
                <div class="rapid-field-header">
                  <div class="rapid-field-title">
                    <span class="rapid-step-num">4</span>
                    <span>Phân loại Mức độ Khẩn</span>
                  </div>
                  <div class="rapid-field-hint">
                    <span>Bấm số:</span>
                    <kbd class="quick-kbd kbd-red">1</kbd> Đỏ
                    <kbd class="quick-kbd kbd-amber">2</kbd> Cam
                    <kbd class="quick-kbd kbd-emerald">3</kbd> Xanh
                  </div>
                </div>

                <div class="rapid-chip-grid rapid-chip-grid-3">
                  <button type="button" tabindex="-1" class="rapid-chip-btn sev-critical ${currentSeverity === 'CRITICAL' ? 'active' : ''}" data-sev="CRITICAL" data-key="1">
                    <kbd class="quick-kbd kbd-red">1</kbd>
                    <div class="chip-content">
                      <span class="chip-title" style="color:#FCA5A5;">TỐI KHẨN</span>
                      <span class="chip-desc">Nguy kịch tính mạng</span>
                    </div>
                  </button>
                  <button type="button" tabindex="-1" class="rapid-chip-btn sev-emergency ${currentSeverity === 'EMERGENCY' ? 'active' : ''}" data-sev="EMERGENCY" data-key="2">
                    <kbd class="quick-kbd kbd-amber">2</kbd>
                    <div class="chip-content">
                      <span class="chip-title" style="color:#FCD34D;">KHẨN CẤP</span>
                      <span class="chip-desc">Cần can thiệp sớm</span>
                    </div>
                  </button>
                  <button type="button" tabindex="-1" class="rapid-chip-btn sev-routine ${currentSeverity === 'ROUTINE' ? 'active' : ''}" data-sev="ROUTINE" data-key="3">
                    <kbd class="quick-kbd kbd-emerald">3</kbd>
                    <div class="chip-content">
                      <span class="chip-title" style="color:#6EE7B7;">TIÊU CHUẨN</span>
                      <span class="chip-desc">Ổn định</span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- FORM CARD 5: Chọn Xe Cứu Thương trong danh sách hiện có (Step 5 - 6 xe: 2 Loại A, 2 Loại B, 2 Loại C) -->
              <div class="rapid-field-card is-active-step" id="card-vehicle-type" data-step-id="5" tabindex="0">
                <div class="rapid-field-header">
                  <div class="rapid-field-title">
                    <span class="rapid-step-num" style="background:#2563EB;color:#FFF;">5</span>
                    <span style="color:#60A5FA;">CHỌN XE CỨU THƯƠNG (CHỌN NHIỀU)</span>
                  </div>
                  <div class="rapid-field-hint">
                    <span>Bấm phím [1..6] chọn xe · [A/B/C] lọc theo loại:</span>
                  </div>
                </div>

                <div class="rapid-chip-grid" style="grid-template-columns: repeat(3, 1fr); gap: 10px;">
                  ${availableVehicles.map((v, idx) => {
          const isSelected = currentSelectedPlates.has(v.plate);
          const typeBadgeColor = v.type === 'Type A' ? '#93C5FD' : (v.type === 'Type B' ? '#5EEAD4' : '#C7D2FE');
          const typeClass = v.type === 'Type A' ? 'veh-type-a' : (v.type === 'Type B' ? 'veh-type-b' : 'veh-type-c');
          return `
                      <button type="button" tabindex="-1" class="rapid-chip-btn ${typeClass} ${isSelected ? 'active' : ''}" data-veh-plate="${v.plate}" data-veh-type="${v.type}" data-key="${idx + 1}" style="text-align:left;padding:9px 12px;height:auto;display:flex;align-items:flex-start;gap:9px;">
                        <kbd class="quick-kbd" style="margin-top:2px;">${idx + 1}</kbd>
                        <div class="chip-content" style="flex:1;">
                          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
                            <span class="chip-title" style="font-size:13px;font-family:var(--font-mono);font-weight:700;color:var(--text-white);">${v.plate}</span>
                            <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.08);color:${typeBadgeColor};">${v.type}</span>
                          </div>
                          <div class="chip-desc" style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${v.station}
                          </div>
                        </div>
                      </button>
                    `;
        }).join('')}
                </div>
              </div>

              <!-- FORM CARD 6: Chọn Kíp Cấp Cứu (Danh sách người trực trong ca hiện tại — Chọn nhiều) -->
              <div class="rapid-field-card" id="card-crew-members" data-step-id="6" tabindex="0">
                <div class="rapid-field-header">
                  <div class="rapid-field-title">
                    <span class="rapid-step-num" style="background:#0D9488;color:#FFF;">6</span>
                    <span style="color:#2DD4BF;">CHỌN KÍP CẤP CỨU TRỰC CA (CHỌN NHIỀU)</span>
                  </div>
                  <div class="rapid-field-hint">
                    <span>Bấm phím [1..6] chọn nhân sự trực ca:</span>
                  </div>
                </div>

                <div class="rapid-chip-grid" style="grid-template-columns: repeat(3, 1fr); gap: 10px;">
                  ${availablePersonnel.map((p, idx) => {
          const isSelected = currentSelectedPersonnel.has(p.id);
          const roleBadgeColor = p.role === 'DOCTOR' ? '#F87171' : (p.role === 'NURSE' ? '#34D399' : '#FBBF24');
          return `
                      <button type="button" tabindex="-1" class="rapid-chip-btn ${isSelected ? 'active' : ''}" data-person-id="${p.id}" data-key="${idx + 1}" style="text-align:left;padding:9px 12px;height:auto;display:flex;align-items:flex-start;gap:9px;">
                        <kbd class="quick-kbd" style="margin-top:2px;">${idx + 1}</kbd>
                        <div class="chip-content" style="flex:1;">
                          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
                            <span class="chip-title" style="font-size:12.5px;font-weight:700;color:var(--text-white);">${p.name}</span>
                            <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.08);color:${roleBadgeColor};">${p.roleName}</span>
                          </div>
                          <div class="chip-desc" style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${p.phone} · ${p.cert || 'Sẵn sàng'}
                          </div>
                        </div>
                      </button>
                    `;
        }).join('')}
                </div>
              </div>

              <!-- FORM CARD 7: Ghi chú & Triệu chứng tóm tắt (Step 7) -->
              <div class="rapid-field-card" id="card-notes" data-step-id="7">
                <div class="rapid-field-header">
                  <div class="rapid-field-title">
                    <span class="rapid-step-num">7</span>
                    <span>GHI CHÚ</span>
                  </div>
                  <div class="rapid-field-hint">
                    <kbd class="quick-kbd">Ctrl+Enter</kbd> Phát lệnh ngay
                  </div>
                </div>

                <div class="form-field">
                  <textarea id="rapid-symptoms-notes" rows="2" placeholder="Ghi nhận tóm tắt triệu chứng, đường tiếp cận, số lượng nạn nhân...">${activeCall.notes || 'Nạn nhân va chạm mạnh ngã đập đầu, bất tỉnh, đang chảy máu nhiều vùng trán và tai, nghi gãy cẳng tay phải.'}</textarea>
                </div>
              </div>

              <!-- COMMAND ACTION BAR (INSTANT ONE-TOUCH DISPATCH) -->
              <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
                <button type="button" class="btn-rapid-dispatch" id="btn-rapid-dispatch">
                  <kbd class="quick-kbd kbd-red" style="font-size:13px;height:24px;padding:0 8px;">Ctrl + Enter ↵</kbd>
                  <span style="font-size:16px;letter-spacing:0.5px;">PHÁT LỆNH ĐIỀU XE & TẠO CA CẤP CỨU</span>
                </button>

                <div style="display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;">
                  <button type="button" class="btn btn-ghost btn-sm" id="btn-rapid-hangup" style="color:var(--text-muted);">
                    <kbd class="quick-kbd">Esc</kbd>
                    <span>Gác máy</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- KEYBOARD SHORTCUTS CHEAT SHEET MODAL (OVERLAY) -->
          <div class="modal-overlay" id="shortcuts-cheat-modal-overlay">
            <div class="shortcuts-cheat-modal">
              <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-main);padding-bottom:12px;margin-bottom:16px;">
                <div style="display:flex;align-items:center;gap:10px;">
                  ${window.CCNV_UI.ICONS.settings}
                  <strong style="font-size:16px;color:var(--text-white);">HƯỚNG DẪN THAO TÁC NHANH 1 TAY CHO ĐIỀU PHỐI VIÊN 115</strong>
                </div>
                <button type="button" class="btn btn-ghost btn-sm" id="btn-close-cheat-modal">${window.CCNV_UI.ICONS.x}</button>
              </div>

              <p style="font-size:12.5px;color:var(--text-slate);line-height:1.5;">
                Thiết kế đặc thù cho điều phối viên: <strong>1 tay giữ điện thoại thoại, 1 tay thao tác bàn phím/numpad</strong>. Toàn bộ thông tin có thể hoàn thành trong 30 giây mà không cần dùng chuột!
              </p>

              <div class="cheat-grid">
                <div class="cheat-section">
                  <div class="cheat-section-title">1. Di chuyển & Điều hướng tuần tự</div>
                  <div class="cheat-row">
                    <span>Chuyển sang trường tiếp theo</span>
                    <kbd class="quick-kbd">Tab ⇥</kbd>
                  </div>
                  <div class="cheat-row">
                    <span>Lùi về trường trước</span>
                    <span><kbd class="quick-kbd">Shift</kbd> + <kbd class="quick-kbd">Tab</kbd></span>
                  </div>
                  <div class="cheat-row">
                    <span>Xác nhận & Chuyển ô tiếp theo</span>
                    <kbd class="quick-kbd">Enter ↵</kbd>
                  </div>
                  <div class="cheat-row">
                    <span>Mở / Đóng bảng phím tắt này</span>
                    <kbd class="quick-kbd">?</kbd>
                  </div>
                </div>

                <div class="cheat-section">
                  <div class="cheat-section-title">2. Phím số chọn nhanh (Tại các ô lựa chọn)</div>
                  <div class="cheat-row">
                    <span>Chọn Xe 1..6 (hoặc A/B/C)</span>
                    <span><kbd class="quick-kbd">1..6</kbd> / <kbd class="quick-kbd">A/B/C</kbd></span>
                  </div>
                  <div class="cheat-row">
                    <span>Chọn Mức độ Tối khẩn / Khẩn / Thường</span>
                    <span><kbd class="quick-kbd">1</kbd> <kbd class="quick-kbd">2</kbd> <kbd class="quick-kbd">3</kbd></span>
                  </div>
                  <div class="cheat-row">
                    <span>Chọn Giới tính Nam / Nữ / Chưa rõ</span>
                    <span><kbd class="quick-kbd">1</kbd> <kbd class="quick-kbd">2</kbd> <kbd class="quick-kbd">3</kbd></span>
                  </div>
                  <div class="cheat-row">
                    <span>Chọn Loại tình huống (TNGT, Đột quỵ...)</span>
                    <span><kbd class="quick-kbd">1</kbd> đến <kbd class="quick-kbd">8</kbd></span>
                  </div>
                </div>

                <div class="cheat-section">
                  <div class="cheat-section-title">3. Phím tắt Toàn cục (Global Hotkeys)</div>
                  <div class="cheat-row">
                    <span>Lấy nhanh vị trí Cell-ID vào hiện trường</span>
                    <span><kbd class="quick-kbd">Alt</kbd> + <kbd class="quick-kbd">C</kbd></span>
                  </div>
                  <div class="cheat-row">
                    <span>Chọn trực tiếp Xe Loại A (ICU)</span>
                    <span><kbd class="quick-kbd">Alt</kbd> + <kbd class="quick-kbd">1</kbd></span>
                  </div>
                  <div class="cheat-row">
                    <span>Chọn trực tiếp Xe Loại B (Chuẩn)</span>
                    <span><kbd class="quick-kbd">Alt</kbd> + <kbd class="quick-kbd">2</kbd></span>
                  </div>
                  <div class="cheat-row">
                    <span>Chọn trực tiếp Xe Loại C (Vận chuyển)</span>
                    <span><kbd class="quick-kbd">Alt</kbd> + <kbd class="quick-kbd">3</kbd></span>
                  </div>
                </div>

                <div class="cheat-section">
                  <div class="cheat-section-title">4. Phát lệnh & Kết thúc</div>
                  <div class="cheat-row">
                    <strong style="color:var(--red-vivid);">PHÁT LỆNH ĐIỀU XE & TẠO CA NGAY</strong>
                    <span><kbd class="quick-kbd kbd-red">Ctrl</kbd> + <kbd class="quick-kbd kbd-red">Enter</kbd> (hoặc <kbd class="quick-kbd">F1</kbd>)</span>
                  </div>
                </div>
              </div>

              <div style="display:flex;justify-content:flex-end;">
                <button type="button" class="btn btn-default" id="btn-cheat-close-footer">Đã hiểu, đóng hướng dẫn</button>
              </div>
            </div>
          </div>
        `;

        // Interactive UI Update Helpers
        const hudBadge = paneContainer.querySelector('#hud-current-step-badge');
        const hudHint = paneContainer.querySelector('#hud-current-step-hint');
        const firstAidStepsBox = paneContainer.querySelector('#first-aid-steps-container');
        const firstAidBadge = paneContainer.querySelector('#first-aid-active-incident-badge');
        const vehicleMatchBox = paneContainer.querySelector('#rapid-vehicle-match-box');

        const updateHud = (stepName, hint) => {
          if (hudBadge) hudBadge.textContent = stepName;
          if (hudHint) hudHint.textContent = hint;
        };

        const updateFirstAid = (code) => {
          if (!firstAidStepsBox) return;
          const steps = FIRST_AID_GUIDES[code] || FIRST_AID_GUIDES.INC_OTHER;
          const incObj = state.incidentTypes?.find(i => i.code === code);
          if (firstAidBadge) {
            firstAidBadge.textContent = incObj?.name?.split(' ')[0] || 'CẤP CỨU';
          }
          firstAidStepsBox.innerHTML = steps.map(s => `
            <div class="first-aid-step-item ${s.vital ? 'step-vital' : ''}">
              <span class="first-aid-step-num">${s.num}</span>
              <span>${s.text}</span>
            </div>
          `).join('');
        };

        const updateVehicleMatch = () => {
          if (!vehicleMatchBox) return;
          const selectedPlatesList = Array.from(currentSelectedPlates);
          const veh = getRecommendedVehicle();
          const targetHosp = state.hospitals?.[0] || { name: 'BVĐK TP Cần Thơ', availableBeds: 12 };
          const isCritical = currentSeverity === 'CRITICAL';

          const badgesHtml = selectedPlatesList.length > 0
            ? selectedPlatesList.map(plate => {
              const vObj = availableVehicles.find(v => v.plate === plate);
              const typeText = vObj ? vObj.type : '';
              return `<span class="badge ${typeText === 'Type A' ? 'badge-emergency' : 'badge-normal'}">${plate} (${typeText})</span>`;
            }).join(' ')
            : `<span class="badge badge-normal">Chưa chọn xe</span>`;

          vehicleMatchBox.className = `rapid-vehicle-match-card ${isCritical ? 'is-critical' : ''}`;
          vehicleMatchBox.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:36px;height:36px;border-radius:6px;background:#183449;border:1px solid #29465A;display:flex;align-items:center;justify-content:center;color:#60A5FA;">
                ${window.CCNV_UI.ICONS.ambulance}
              </div>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text-white);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span>Xe điều động (${selectedPlatesList.length} xe được chọn):</span>
                  ${badgesHtml}
                  <span style="color:#10B981;font-size:11px;">● Sẵn sàng xuất bến</span>
                </div>
                <div style="font-size:11.5px;color:var(--text-slate);margin-top:2px;">
                  Ưu tiên: <strong>${veh ? veh.plate : '65A-015.67'}</strong> (${veh ? veh.type : 'Type A'}) · Trạm: ${veh?.station || 'Trạm Cấp cứu Ninh Kiều (BVĐK)'} · ETA: <strong style="color:#93C5FD;">~4 phút (1.4 km)</strong>
                </div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px;color:var(--text-muted);">Bệnh viện tiếp nhận:</div>
              <div style="font-size:12.5px;font-weight:600;color:#93C5FD;">
                ${targetHosp.name} (${targetHosp.availableBeds} giường trống)
              </div>
            </div>
          `;
        };

        // Selection Actions
        const toggleVehiclePlate = (plate, playSound = true) => {
          if (currentSelectedPlates.has(plate)) {
            if (currentSelectedPlates.size > 1) {
              currentSelectedPlates.delete(plate);
            }
          } else {
            currentSelectedPlates.add(plate);
          }

          // Sync currentVehicleTypes
          currentVehicleTypes = new Set();
          currentSelectedPlates.forEach(p => {
            const vObj = availableVehicles.find(v => v.plate === p);
            if (vObj) currentVehicleTypes.add(vObj.type);
          });
          const activeVeh = getRecommendedVehicle();
          currentVehicleType = activeVeh ? activeVeh.type : 'Type A';

          paneContainer.querySelectorAll('.rapid-chip-btn[data-veh-plate]').forEach(btn => {
            const p = btn.getAttribute('data-veh-plate');
            btn.classList.toggle('active', currentSelectedPlates.has(p));
          });
          updateVehicleMatch();
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const toggleVehicleType = (type, playSound = true) => {
          const vehsOfType = availableVehicles.filter(v => v.type === type);
          const allSelected = vehsOfType.every(v => currentSelectedPlates.has(v.plate));

          if (allSelected) {
            // Deselect all of this type if other vehicles remain
            if (currentSelectedPlates.size > vehsOfType.length) {
              vehsOfType.forEach(v => currentSelectedPlates.delete(v.plate));
            }
          } else {
            vehsOfType.forEach(v => currentSelectedPlates.add(v.plate));
          }

          currentVehicleTypes = new Set();
          currentSelectedPlates.forEach(p => {
            const vObj = availableVehicles.find(v => v.plate === p);
            if (vObj) currentVehicleTypes.add(vObj.type);
          });
          const activeVeh = getRecommendedVehicle();
          currentVehicleType = activeVeh ? activeVeh.type : 'Type A';

          paneContainer.querySelectorAll('.rapid-chip-btn[data-veh-plate]').forEach(btn => {
            const p = btn.getAttribute('data-veh-plate');
            btn.classList.toggle('active', currentSelectedPlates.has(p));
          });
          updateVehicleMatch();
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const setVehicleType = (type, playSound = true) => {
          const vehsOfType = availableVehicles.filter(v => v.type === type);
          currentSelectedPlates = new Set(vehsOfType.map(v => v.plate));
          currentVehicleTypes = new Set([type]);
          currentVehicleType = type;

          paneContainer.querySelectorAll('.rapid-chip-btn[data-veh-plate]').forEach(btn => {
            const p = btn.getAttribute('data-veh-plate');
            btn.classList.toggle('active', currentSelectedPlates.has(p));
          });
          updateVehicleMatch();
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const togglePersonnel = (personId, playSound = true) => {
          if (currentSelectedPersonnel.has(personId)) {
            if (currentSelectedPersonnel.size > 1) {
              currentSelectedPersonnel.delete(personId);
            }
          } else {
            currentSelectedPersonnel.add(personId);
          }

          paneContainer.querySelectorAll('.rapid-chip-btn[data-person-id]').forEach(btn => {
            const pid = btn.getAttribute('data-person-id');
            btn.classList.toggle('active', currentSelectedPersonnel.has(pid));
          });
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const setSeverity = (sev, playSound = true) => {
          currentSeverity = sev;
          paneContainer.querySelectorAll('.rapid-chip-btn[data-sev]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-sev') === sev);
          });
          updateVehicleMatch();
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const setGender = (g, playSound = true) => {
          currentGender = g;
          paneContainer.querySelectorAll('.rapid-chip-btn[data-gender]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-gender') === g);
          });
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const setIncident = (code, playSound = true) => {
          currentIncident = code;
          paneContainer.querySelectorAll('.rapid-chip-btn[data-incident]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-incident') === code);
          });
          updateFirstAid(code);

          // Auto-suggest vehicle type based on incident
          const incObj = state.incidentTypes?.find(i => i.code === code);
          if (incObj?.suggestedType) {
            setVehicleType(incObj.suggestedType, false);
          }
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const injectCellId = () => {
          const addrInput = paneContainer.querySelector('#rapid-address');
          if (addrInput) {
            addrInput.value = 'BTS VTT-NK04 · P. Hưng Lợi, Q. Ninh Kiều, Cần Thơ';
            addrInput.focus();
            addrInput.classList.add('pulse-red-border');
            setTimeout(() => addrInput.classList.remove('pulse-red-border'), 1000);
            window.CCNV_UI.SoundFx.playBeep();
            window.CCNV_UI.Toast.show('Đã nạp vị trí Cell-ID', 'Tọa độ trạm phát sóng đã được đưa vào địa chỉ hiện trường');
          }
        };

        // Dispatch Handler
        const doDispatch = () => {
          const caller = activeCall.callerName;
          const phone = activeCall.callerPhone;
          const patientName = paneContainer.querySelector('#rapid-patient-name')?.value || 'Nguyễn Văn Hưng';
          const patientAge = Number(paneContainer.querySelector('#rapid-patient-age')?.value || 34);
          const address = paneContainer.querySelector('#rapid-address')?.value || 'Chân cầu Hưng Lợi, P. Hưng Lợi, Q. Ninh Kiều';
          const notes = paneContainer.querySelector('#rapid-symptoms-notes')?.value || activeCall.notes;
          const veh = getRecommendedVehicle();
          const targetHosp = state.hospitals?.[0] || { id: 'HOSP_BVDK', name: 'BV Đa khoa TP Cần Thơ' };
          const incObj = state.incidentTypes?.find(i => i.code === currentIncident);

          // 1. Play Emergency Tone
          window.CCNV_UI.SoundFx.playEmergencyTone();

          // Get selected crew personnel
          const assignedCrewMembers = availablePersonnel
            .filter(p => currentSelectedPersonnel.has(p.id))
            .map(p => ({ id: p.id, name: p.name, role: p.role, roleName: p.roleName, phone: p.phone }));

          // 2. Create Case in StateManager
          const newCase = window.StateManager.createCase({
            callerName: caller,
            callerPhone: phone,
            patient: {
              name: patientName,
              age: patientAge,
              gender: currentGender
            },
            location: {
              address: address,
              coords: [10.0248, 105.7695],
              mapPos: { x: 540, y: 440 }
            },
            incident: {
              code: currentIncident,
              name: incObj ? incObj.name : 'Cấp cứu 115',
              severity: currentSeverity,
              severityText: currentSeverity === 'CRITICAL' ? 'Tối khẩn' : (currentSeverity === 'EMERGENCY' ? 'Khẩn cấp' : 'Tiêu chuẩn'),
              description: notes
            },
            dispatch: {
              vehiclePlate: veh.plate,
              crewMembers: assignedCrewMembers,
              crewCount: assignedCrewMembers.length,
              hospitalId: targetHosp.id,
              hospitalName: targetHosp.name
            }
          });

          // 3. Audio & Notification Toast
          const selectedPlatesStr = Array.from(currentSelectedPlates).join(', ');
          const crewCountStr = `${assignedCrewMembers.length} nhân sự trực`;
          window.CCNV_UI.Toast.show(
            `ĐÃ PHÁT LỆNH ĐIỀU ĐỘNG: CA ${newCase.code}`,
            `Xuất xe ${selectedPlatesStr} · Kíp: ${crewCountStr} · Bệnh viện: ${targetHosp.name}`,
            true,
            5000
          );

          // 4. Switch to Cases list or update view
          setTimeout(() => {
            this.currentMenu = 'cases-list';
            this.renderSidebar();
            this.renderCurrentView();
          }, 800);
        };

        // Initialize display
        updateFirstAid(currentIncident);
        updateVehicleMatch(currentVehicleType);

        // Bind Clicks
        paneContainer.querySelectorAll('.rapid-chip-btn[data-veh-plate]').forEach(btn => {
          btn.addEventListener('click', () => toggleVehiclePlate(btn.getAttribute('data-veh-plate')));
        });

        paneContainer.querySelectorAll('.rapid-chip-btn[data-person-id]').forEach(btn => {
          btn.addEventListener('click', () => togglePersonnel(btn.getAttribute('data-person-id')));
        });

        paneContainer.querySelectorAll('.rapid-chip-btn[data-sev]').forEach(btn => {
          btn.addEventListener('click', () => setSeverity(btn.getAttribute('data-sev')));
        });

        paneContainer.querySelectorAll('.rapid-chip-btn[data-gender]').forEach(btn => {
          btn.addEventListener('click', () => setGender(btn.getAttribute('data-gender')));
        });

        paneContainer.querySelectorAll('.rapid-chip-btn[data-incident]').forEach(btn => {
          btn.addEventListener('click', () => setIncident(btn.getAttribute('data-incident')));
        });



        // Send Fast Guidance Documents to Caller
        paneContainer.querySelectorAll('.btn-send-doc-fast').forEach(btn => {
          btn.addEventListener('click', () => {
            const docType = btn.getAttribute('data-doc');
            const phone = activeCall.callerPhone;
            let docName = 'Tài liệu hướng dẫn sơ cứu';

            if (docType === 'CPR') {
              docName = 'Sổ tay đồ họa động: Kỹ thuật Ép tim & Hô hấp nhân tạo (CPR)';
            } else if (docType === 'BLEED') {
              docName = 'Hướng dẫn Cầm máu khẩn cấp & Cố định chấn thương';
            } else if (docType === 'LIVE_TRACK') {
              docName = 'Link bản đồ vệ tinh GPS theo dõi hành trình xe cấp cứu';
            }

            // Visual feedback on button
            const originalText = btn.innerHTML;
            btn.innerHTML = '✓ Đã gửi';
            btn.style.background = '#059669';
            btn.style.borderColor = '#10B981';
            btn.style.color = '#FFFFFF';
            setTimeout(() => {
              btn.innerHTML = originalText;
              btn.style.background = '';
              btn.style.borderColor = '';
              btn.style.color = '';
            }, 2500);

            window.CCNV_UI.SoundFx.playBeep();
            window.CCNV_UI.Toast.show(
              `ĐÃ GỬI TÀI LIỆU TỚI ${phone}`,
              `Nội dung: "${docName}" đã chuyển qua SMS & Zalo khẩn cấp.`,
              false,
              4000
            );
          });
        });

        paneContainer.querySelector('#btn-inject-cellid')?.addEventListener('click', injectCellId);
        paneContainer.querySelector('#btn-rapid-dispatch')?.addEventListener('click', doDispatch);

        paneContainer.querySelector('#btn-rapid-open-drawer')?.addEventListener('click', () => {
          const prefill = {
            callerName: activeCall.callerName,
            callerPhone: activeCall.callerPhone,
            patientName: paneContainer.querySelector('#rapid-patient-name')?.value,
            patientAge: paneContainer.querySelector('#rapid-patient-age')?.value,
            patientGender: currentGender,
            address: paneContainer.querySelector('#rapid-address')?.value,
            incidentCode: currentIncident,
            description: paneContainer.querySelector('#rapid-symptoms-notes')?.value
          };
          this.openCreateCaseDrawer(prefill);
        });

        paneContainer.querySelector('#btn-call-hold')?.addEventListener('click', (e) => {
          const btn = e.currentTarget;
          const isHolding = btn.classList.toggle('active');
          btn.style.background = isHolding ? 'rgba(234,179,8,0.2)' : '';
          btn.style.color = isHolding ? '#FBBF24' : '';
          window.CCNV_UI.Toast.show(isHolding ? 'Đang giữ máy' : 'Đã tiếp tục cuộc gọi', `Số máy ${activeCall.callerPhone}`);
        });

        paneContainer.querySelector('#btn-call-transfer-quick')?.addEventListener('click', () => {
          this.renderCallCenterView(container, 'transfer');
        });

        paneContainer.querySelector('#btn-call-hangup')?.addEventListener('click', () => {
          window.CCNV_UI.Toast.show('Đã gác máy', `Kết thúc cuộc gọi từ số ${activeCall.callerPhone}`);
        });

        paneContainer.querySelector('#btn-rapid-save-consult')?.addEventListener('click', () => {
          window.StateManager.addAuditLog(`Đóng cuộc gọi tư vấn y tế cho ${activeCall.callerPhone}`);
          window.CCNV_UI.Toast.show('Đã lưu tư vấn y tế', 'Cuộc gọi kết thúc không phát sinh lệnh điều xe.');
        });

        paneContainer.querySelector('#btn-rapid-transfer')?.addEventListener('click', () => {
          this.renderCallCenterView(container, 'transfer');
        });

        paneContainer.querySelector('#btn-rapid-hangup')?.addEventListener('click', () => {
          window.CCNV_UI.Toast.show('Đã gác máy', `Kết thúc cuộc gọi từ số ${activeCall.callerPhone}`);
        });

        // Cheat Modal toggle
        const cheatModalOverlay = paneContainer.querySelector('#shortcuts-cheat-modal-overlay');
        const openCheatModal = () => cheatModalOverlay?.classList.add('active');
        const closeCheatModal = () => cheatModalOverlay?.classList.remove('active');

        container.querySelectorAll('#btn-toggle-shortcuts-help').forEach(btn => btn.addEventListener('click', openCheatModal));
        paneContainer.querySelector('#btn-close-cheat-modal')?.addEventListener('click', closeCheatModal);
        paneContainer.querySelector('#btn-cheat-close-footer')?.addEventListener('click', closeCheatModal);

        // Step focus tracker bindings
        const stepCards = [
          { id: 'card-patient', name: '1. Thông tin cơ bản BN', hint: 'Tab qua Họ tên / Tuổi / Giới tính [1, 2, 3] · Tab tiếp sang Hiện trường' },
          { id: 'card-location', name: '2. Hiện trường & Tọa độ', hint: 'Bấm Alt+C để nạp Cell-ID · Tab sang Tình huống' },
          { id: 'card-incident', name: '3. Tình huống Cấp cứu', hint: 'Bấm số [1..8] để chọn tình huống · Tab sang Mức độ khẩn' },
          { id: 'card-severity', name: '4. Mức độ Khẩn', hint: 'Bấm [1] Đỏ / [2] Cam / [3] Xanh · Tab sang Chọn Loại xe' },
          { id: 'card-vehicle-type', name: '5. CHỌN XE CỨU THƯƠNG', hint: 'Bấm [1..6] chọn xe trong danh sách · [A/B/C] theo loại · Tab sang Kíp' },
          { id: 'card-crew-members', name: '6. CHỌN KÍP CẤP CỨU TRỰC CA', hint: 'Bấm [1..6] chọn nhân sự trực ca (BS, ĐD, Lái xe) · Tab sang Ghi chú' },
          { id: 'card-notes', name: '7. Triệu chứng & Ghi chú', hint: 'Bấm Ctrl+Enter để Phát lệnh xuất xe tức thì!' }
        ];

        stepCards.forEach(sc => {
          const cardEl = paneContainer.querySelector(`#${sc.id}`);
          if (cardEl) {
            cardEl.addEventListener('focusin', () => {
              currentFocusedCard = sc.id;
              paneContainer.querySelectorAll('.rapid-field-card').forEach(c => c.classList.remove('is-active-step'));
              cardEl.classList.add('is-active-step');
              updateHud(sc.name, sc.hint);
            });
          }
        });

        // Track focus on Gender chips inside Card 1 specifically
        const genderBox = paneContainer.querySelector('#card-gender');
        if (genderBox) {
          genderBox.addEventListener('focusin', () => {
            currentFocusedCard = 'card-gender';
            updateHud('1. Giới tính BN', 'Bấm phím [1] Nam / [2] Nữ / [3] Chưa rõ · Tab tiếp sang Hiện trường');
          });
        }

        // --- KEYBOARD CONTROLLER FOR 1-HAND OPERATION ---
        this._callCenterKeyHandler = (e) => {
          // If cheat modal is open, Escape closes it
          if (cheatModalOverlay && cheatModalOverlay.classList.contains('active')) {
            if (e.key === 'Escape') {
              e.preventDefault();
              closeCheatModal();
              return;
            }
          }

          // 1. Master Instant Dispatch: Ctrl + Enter or F1
          if ((e.ctrlKey && e.key === 'Enter') || e.key === 'F1') {
            e.preventDefault();
            doDispatch();
            return;
          }

          // 2. F2: Advanced Drawer
          if (e.key === 'F2') {
            e.preventDefault();
            paneContainer.querySelector('#btn-rapid-open-drawer')?.click();
            return;
          }

          // 3. F3: Save consult
          if (e.key === 'F3') {
            e.preventDefault();
            paneContainer.querySelector('#btn-rapid-save-consult')?.click();
            return;
          }

          // 4. F4: Fast transfer
          if (e.key === 'F4') {
            e.preventDefault();
            paneContainer.querySelector('#btn-rapid-transfer')?.click();
            return;
          }

          // 5. Alt + C: Inject Cell-ID
          if (e.altKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            injectCellId();
            return;
          }

          // 6. Global Alt+1, Alt+2, Alt+3 for Vehicle Type anywhere
          if (e.altKey && e.key === '1') {
            e.preventDefault();
            setVehicleType('Type A');
            return;
          }
          if (e.altKey && e.key === '2') {
            e.preventDefault();
            setVehicleType('Type B');
            return;
          }
          if (e.altKey && e.key === '3') {
            e.preventDefault();
            setVehicleType('Type C');
            return;
          }

          // 7. Toggle Help Modal: ? or i or I
          if ((e.key === '?' || e.key === 'i' || e.key === 'I') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            openCheatModal();
            return;
          }

          // 8. CONTEXTUAL NUMERIC KEYS (1, 2, 3...) WHEN NOT IN TEXT INPUT
          const isTextInput = (e.target.tagName === 'INPUT' && e.target.type === 'text') || e.target.tagName === 'TEXTAREA';

          if (!isTextInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // If on Vehicle Type card (Block 5 - 6 vehicles multi-select!)
            if (currentFocusedCard === 'card-vehicle-type') {
              const numKey = parseInt(e.key, 10);
              if (numKey >= 1 && numKey <= 6 && availableVehicles[numKey - 1]) {
                e.preventDefault();
                toggleVehiclePlate(availableVehicles[numKey - 1].plate);
                return;
              }
              if (e.key === 'a' || e.key === 'A') { e.preventDefault(); toggleVehicleType('Type A'); return; }
              if (e.key === 'b' || e.key === 'B') { e.preventDefault(); toggleVehicleType('Type B'); return; }
              if (e.key === 'c' || e.key === 'C') { e.preventDefault(); toggleVehicleType('Type C'); return; }
              if (e.key === 'Enter') {
                e.preventDefault();
                paneContainer.querySelector('#card-crew-members')?.focus();
                return;
              }
            }

            // If on Crew Members card (Block 6 - 6 personnel multi-select!)
            if (currentFocusedCard === 'card-crew-members') {
              const numKey = parseInt(e.key, 10);
              if (numKey >= 1 && numKey <= 6 && availablePersonnel[numKey - 1]) {
                e.preventDefault();
                togglePersonnel(availablePersonnel[numKey - 1].id);
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                paneContainer.querySelector('#card-notes')?.focus();
                return;
              }
            }

            // If on Severity card (Block 4)
            if (currentFocusedCard === 'card-severity') {
              if (e.key === '1') { e.preventDefault(); setSeverity('CRITICAL'); return; }
              if (e.key === '2') { e.preventDefault(); setSeverity('EMERGENCY'); return; }
              if (e.key === '3') { e.preventDefault(); setSeverity('ROUTINE'); return; }
              if (e.key === 'Enter') {
                e.preventDefault();
                paneContainer.querySelector('#card-vehicle-type')?.focus();
                return;
              }
            }

            // If on Gender selection (either focused directly or within card-patient)
            if (currentFocusedCard === 'card-gender' || (currentFocusedCard === 'card-patient' && e.target.id !== 'rapid-patient-name' && e.target.id !== 'rapid-patient-age')) {
              if (e.key === '1') { e.preventDefault(); setGender('Nam'); return; }
              if (e.key === '2') { e.preventDefault(); setGender('Nữ'); return; }
              if (e.key === '3') { e.preventDefault(); setGender('Chưa rõ'); return; }
              if (e.key === 'Enter') {
                e.preventDefault();
                paneContainer.querySelector('#rapid-address')?.focus();
                return;
              }
            }

            // If on Incident card (Block 3)
            if (currentFocusedCard === 'card-incident') {
              const incMap = {
                '1': 'INC_TNGT',
                '2': 'INC_STROKE',
                '3': 'INC_CARDIAC',
                '4': 'INC_RESPIRATORY',
                '5': 'INC_TRAUMA',
                '6': 'INC_OBSTETRIC',
                '7': 'INC_PEDIATRIC',
                '8': 'INC_OTHER'
              };
              if (incMap[e.key]) {
                e.preventDefault();
                setIncident(incMap[e.key]);
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                paneContainer.querySelector('#card-severity')?.focus();
                return;
              }
            }
          }

          // 9. Enter / Tab navigation across form blocks
          if (e.key === 'Tab') {
            const onGender = currentFocusedCard === 'card-gender' || e.target.id === 'card-gender' || e.target.closest('#card-gender');
            const onIncident = currentFocusedCard === 'card-incident' || e.target.id === 'card-incident' || e.target.closest('#card-incident');
            const onSeverity = currentFocusedCard === 'card-severity' || e.target.id === 'card-severity' || e.target.closest('#card-severity');
            const onVehicleType = currentFocusedCard === 'card-vehicle-type' || e.target.id === 'card-vehicle-type' || e.target.closest('#card-vehicle-type');

            if (onGender) {
              e.preventDefault();
              if (!e.shiftKey) {
                const nextField = paneContainer.querySelector('#rapid-address');
                if (nextField) { nextField.focus(); nextField.select(); }
              } else {
                paneContainer.querySelector('#rapid-patient-age')?.focus();
              }
              return;
            }

            if (onIncident) {
              e.preventDefault();
              if (!e.shiftKey) {
                paneContainer.querySelector('#card-severity')?.focus();
              } else {
                const prevField = paneContainer.querySelector('#rapid-address');
                if (prevField) { prevField.focus(); prevField.select(); }
              }
              return;
            }

            if (onSeverity) {
              e.preventDefault();
              if (!e.shiftKey) {
                paneContainer.querySelector('#card-vehicle-type')?.focus();
              } else {
                paneContainer.querySelector('#card-incident')?.focus();
              }
              return;
            }

            const onCrewMembers = currentFocusedCard === 'card-crew-members' || e.target.id === 'card-crew-members' || e.target.closest('#card-crew-members');

            if (onVehicleType) {
              e.preventDefault();
              if (!e.shiftKey) {
                paneContainer.querySelector('#card-crew-members')?.focus();
              } else {
                paneContainer.querySelector('#card-severity')?.focus();
              }
              return;
            }

            if (onCrewMembers) {
              e.preventDefault();
              if (!e.shiftKey) {
                paneContainer.querySelector('#card-notes')?.focus();
                paneContainer.querySelector('#rapid-symptoms-notes')?.focus();
              } else {
                paneContainer.querySelector('#card-vehicle-type')?.focus();
              }
              return;
            }
          }

          if (e.key === 'Enter') {
            if (e.target.id === 'rapid-patient-name') {
              e.preventDefault();
              paneContainer.querySelector('#rapid-patient-age')?.focus();
            } else if (e.target.id === 'rapid-patient-age') {
              e.preventDefault();
              paneContainer.querySelector('#card-gender')?.focus();
            } else if (e.target.id === 'rapid-address') {
              e.preventDefault();
              paneContainer.querySelector('#card-incident')?.focus();
            }
          }
        };

        window.addEventListener('keydown', this._callCenterKeyHandler);

        // Autofocus the patient name field to be ready immediately
        setTimeout(() => {
          const firstField = paneContainer.querySelector('#rapid-patient-name');
          if (firstField) {
            firstField.focus();
            firstField.select();
          }
        }, 150);
      }

      // --- TAB 2: LỊCH SỬ CUỘC GỌI ---
      else if (activeTab === 'history') {
        paneContainer.innerHTML = `
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="call-history-table-mount"></div>
          </div>
        `;

        new window.CCNV_UI.DataTable({
          containerId: 'call-history-table-mount',
          data: calls,
          pageSize: 10,
          exportTitle: 'Lịch sử Cuộc gọi 115',
          enableExport: false,
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
            { key: 'operator', title: 'Điều phối viên', sortable: true, render: item => item.operator || '<span style="color:#64748B;">Chưa gán</span>' },
            {
              key: 'actions',
              title: 'Ghi âm',
              sortable: false,
              render: () => `<button class="btn btn-default btn-sm" onclick="window.CCNV_UI.Toast.show('Nghe lại ghi âm', 'Đang phát lại đoạn ghi âm cuộc gọi 115...')">Nghe lại</button>`
            }
          ]
        }).render();
      }

      // --- TAB 3: DANH BẠ BỆNH VIỆN ---
      else if (activeTab === 'directory') {
        paneContainer.innerHTML = `
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="call-directory-table-mount"></div>
          </div>
        `;

        new window.CCNV_UI.DataTable({
          containerId: 'call-directory-table-mount',
          data: hospitals,
          pageSize: 10,
          exportTitle: 'Danh bạ Bệnh viện TP Cần Thơ',
          enableExport: false,
          searchPlaceholder: 'Tìm tên bệnh viện, số điện thoại hotline, địa chỉ...',
          defaultSortKey: 'id',
          defaultSortOrder: 'asc',
          columns: [
            { key: 'id', title: 'Mã BV', sortable: true, render: h => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${h.id}</strong>` },
            { key: 'name', title: 'Tên Bệnh viện / Cơ sở Y tế', sortable: true, render: h => `<strong>${h.name}</strong>` },
            { key: 'hotline', title: 'Hotline Cấp cứu 24/7', sortable: true, render: h => `<strong style="font-family:var(--font-mono);color:var(--red-vivid);">${h.hotline || '0292.3821.236'}</strong>` },
            { key: 'address', title: 'Địa chỉ', sortable: false, render: h => `<span style="font-size:12px;color:var(--text-slate);">${h.address}</span>` },

            {
              key: 'actions',
              title: 'Gọi nhanh',
              sortable: false,
              render: h => `
                <button class="btn btn-emergency btn-sm btn-call-hosp-hotline" data-hosp="${h.name}" data-phone="${h.hotline}">
                  ${window.CCNV_UI.ICONS.phone} Gọi
                </button>
              `
            }
          ]
        }).render();

        paneContainer.addEventListener('click', (e) => {
          const btn = e.target.closest('.btn-call-hosp-hotline');
          if (btn) {
            const hName = btn.getAttribute('data-hosp');
            const hPhone = btn.getAttribute('data-phone');
            window.CCNV_UI.Toast.show('Đang quay số...', `Kết nối trực tiếp đến Hotline Cấp cứu: ${hName} (${hPhone})`);
            window.StateManager.addAuditLog(`Gọi điện thoại hotline cấp cứu tới ${hName}`);
          }
        });
      }

      // --- TAB 4: CHUYỂN TIẾP (LỰC LƯỢNG PHỐI HỢP) ---
      else if (activeTab === 'transfer') {
        paneContainer.innerHTML = `
          <div style="display:grid;grid-template-columns: 1fr 1fr; gap:16px;">
            <!-- Left: Agency Cards -->
            <div style="display:flex;flex-direction:column;gap:12px;">
              <!-- 113 Police -->
              <div class="content-card" style="border-left:4px solid #3B82F6;padding:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <strong style="color:var(--text-white);font-size:15px;display:flex;align-items:center;gap:8px;">
                    ${window.CCNV_UI.ICONS.shield}
                    <span>113 — Cảnh sát Phản ứng nhanh TP. Cần Thơ</span>
                  </strong>
                  <span class="status-pill status-pill-completed">Trực chiến 24/7</span>
                </div>
                <p style="font-size:12px;color:var(--text-slate);margin-bottom:10px;">
                  Phối hợp bảo vệ hiện trường, an ninh trật tự, xử lý tắc đường và hỗ trợ giải cứu người bị kẹt.
                </p>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <span style="font-family:var(--font-mono);font-size:14px;color:#93C5FD;font-weight:700;">Hotline: 113 / 0292.3820.113</span>
                  <button class="btn btn-default btn-sm btn-call-agency" data-agency="113 - CS Phản ứng nhanh">Gọi nhanh</button>
                </div>
              </div>

              <!-- 114 Fire / Rescue -->
              <div class="content-card" style="border-left:4px solid var(--red-vivid);padding:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <strong style="color:var(--text-white);font-size:15px;display:flex;align-items:center;gap:8px;">
                    ${window.CCNV_UI.ICONS.alertTriangle}
                    <span>114 — Cảnh sát PCCC & Cứu nạn Cứu hộ TP. Cần Thơ</span>
                  </strong>
                  <span class="status-pill status-pill-completed">Trực chiến 24/7</span>
                </div>
                <p style="font-size:12px;color:var(--text-slate);margin-bottom:10px;">
                  Chuyên trách cắt phá cabin xe bẹp rúm, cứu hộ sập đổ công trình, cứu nạn dưới nước tại các nhánh sông Hậu.
                </p>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <span style="font-family:var(--font-mono);font-size:14px;color:var(--red-vivid);font-weight:700;">Hotline: 114 / 0292.3838.114</span>
                  <button class="btn btn-emergency btn-sm btn-call-agency" data-agency="114 - PCCC & CNCH">Gọi nhanh</button>
                </div>
              </div>

              <!-- Traffic Control -->
              <div class="content-card" style="border-left:4px solid #10B981;padding:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <strong style="color:var(--text-white);font-size:15px;display:flex;align-items:center;gap:8px;">
                    ${window.CCNV_UI.ICONS.navigation}
                    <span>Trung tâm Điều hành Giao thông Đô thị (Sở GTVT)</span>
                  </strong>
                  <span class="status-pill status-pill-completed">Sẵn sàng</span>
                </div>
                <p style="font-size:12px;color:var(--text-slate);margin-bottom:10px;">
                  Kích hoạt làn sóng xanh đèn tín hiệu giao thông trên các trục đường chính cho đoàn xe cấp cứu di chuyển.
                </p>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <span style="font-family:var(--font-mono);font-size:14px;color:#34D399;font-weight:700;">Hotline: 0292.3831.999</span>
                  <button class="btn btn-default btn-sm btn-call-agency" data-agency="Trung tâm Điều hành Giao thông">Gọi nhanh</button>
                </div>
              </div>
            </div>

            <!-- Right: Inter-agency Transfer Form -->
            <div class="content-card" style="padding:18px;">
              <h3 style="color:var(--text-white);font-size:15px;margin-bottom:6px;">Chuyển tiếp Dữ liệu Hiện trường sang Đơn vị Phối hợp</h3>
              <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">Chia sẻ vị trí GPS, thông tin số người bị nạn và yêu cầu chi viện</p>

              <div class="form-field" style="margin-bottom:12px;">
                <label class="form-label">Chọn ca cấp cứu cần chuyển tiếp thông tin</label>
                <select id="transfer-case-select">
                  ${state.cases.map(c => `
                    <option value="${c.id}">${c.code} — ${c.patient.name} (${c.location.address})</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-field" style="margin-bottom:12px;">
                <label class="form-label">Đơn vị nhận tin phối hợp</label>
                <select id="transfer-agency-select">
                  <option value="113">113 — Cảnh sát Phản ứng nhanh (An ninh hiện trường, giải tỏa giao thông)</option>
                  <option value="114">114 — Cứu nạn Cứu hộ (Cắt phá xe lật, kẹt người trong cabin)</option>
                  <option value="GTVT">Sở GTVT — Mở làn sóng xanh đèn tín hiệu</option>
                </select>
              </div>

              <div class="form-field" style="margin-bottom:14px;">
                <label class="form-label">Nội dung yêu cầu phối hợp cụ thể</label>
                <textarea id="transfer-notes-input" rows="3">Đề nghị CSGT 113 phân luồng giao thông tại chân Cầu Hưng Lợi hướng về BVĐK TP Cần Thơ để xe cấp cứu 65A-012.34 chở ca chấn thương nặng di chuyển thuận lợi.</textarea>
              </div>

              <div style="display:flex;justify-content:flex-end;">
                <button class="btn btn-emergency btn-lg" id="btn-submit-agency-transfer">
                  ${window.CCNV_UI.ICONS.navigation}
                  <span>Phát Lệnh Chuyển Tiếp Thông Tin</span>
                </button>
              </div>
            </div>
          </div>
        `;

        paneContainer.querySelectorAll('.btn-call-agency').forEach(btn => {
          btn.addEventListener('click', () => {
            const agency = btn.getAttribute('data-agency');
            window.CCNV_UI.Toast.show('Đang gọi liên ngành...', `Đang thiết lập kết nối thoại bảo mật với ${agency}`);
            window.StateManager.addAuditLog(`Gọi điện điều phối liên ngành tới ${agency}`);
          });
        });

        paneContainer.querySelector('#btn-submit-agency-transfer')?.addEventListener('click', () => {
          const agency = paneContainer.querySelector('#transfer-agency-select').value;
          window.CCNV_UI.Toast.show('Đã chuyển tiếp thông tin', `Dữ liệu ca cấp cứu và tọa độ GPS đã được gửi tự động sang lực lượng ${agency}`);
          window.StateManager.addAuditLog(`Chuyển tiếp thông tin phối hợp liên ngành sang lực lượng ${agency}`);
        });
      }
    }

    // --- 3. CASES LIST VIEW (DANH SÁCH CA CẤP CỨU) ---
    // --- 3. ALL-IN-ONE EMERGENCY CASES & RECEPTION CONSOLE (QUẢN LÝ VÒNG ĐỜI CA CẤP CỨU & TIẾP NHẬN) ---
    renderCasesListView(container) {
      const state = window.StateManager.getState();
      const activeRaw = state.cases || [];
      const historyRaw = state.historyCases || [];

      // 1. Chuẩn hóa dữ liệu toàn diện (Active + History)
      const activeList = activeRaw.map(c => ({
        id: c.id,
        code: c.code,
        createdAt: c.createdAt,
        patientName: c.patient?.name || '—',
        patientAge: c.patient?.age || '',
        patientGender: c.patient?.gender || '',
        incidentName: c.incident?.name || 'Cấp cứu',
        severity: c.incident?.severity || 'ROUTINE',
        locationAddress: c.location?.address || '—',
        vehiclePlate: c.dispatch?.vehiclePlate || '—',
        crewName: c.dispatch?.crewName || '—',
        hospitalName: c.dispatch?.hospitalName || '—',
        status: c.status,
        statusText: c.statusText || (c.status === 'DISPATCHED' ? 'Đã điều động' : c.status === 'TRANSPORTING' ? 'Đang đến viện' : c.status === 'COMPLETED' ? 'Hoàn tất' : 'Đã hủy'),
        eta: c.eta || (c.status === 'TRANSPORTING' ? '5 phút' : '—'),
        isHistory: false,
        raw: c
      }));

      const historyList = historyRaw.map(h => ({
        id: h.id,
        code: h.code,
        createdAt: h.createdAt,
        completedAt: h.completedAt,
        patientName: h.patientName || '—',
        patientAge: h.patientAge || '',
        patientGender: h.patientGender || 'Nam',
        incidentName: h.incidentName || 'Cấp cứu',
        severity: h.severity || 'ROUTINE',
        locationAddress: h.locationAddress || 'TP Cần Thơ',
        vehiclePlate: h.vehiclePlate || '—',
        crewName: h.crewName || 'Kíp trực 115',
        hospitalName: h.hospitalName || '—',
        status: h.status,
        statusText: h.statusText || (h.status === 'COMPLETED' ? 'Hoàn tất' : 'Đã hủy'),
        eta: '—',
        durations: h.durations,
        isHistory: true,
        raw: h
      }));

      // Gom ca theo mã duy nhất
      const caseMap = new Map();
      activeList.forEach(c => caseMap.set(c.code, c));
      historyList.forEach(h => {
        if (!caseMap.has(h.code)) caseMap.set(h.code, h);
      });
      const allCases = Array.from(caseMap.values());

      container.innerHTML = `
        <div class="view-container-full">
          <!-- Header Bar -->
          <div style="margin-bottom:14px;">
            <h2 style="color:var(--text-white);font-size:18px;display:flex;align-items:center;gap:8px;">
              <span>Quản lý Vòng đời Ca Cấp cứu & Tiếp nhận</span>
            </h2>
            <p style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              Điều hành tiếp nhận yêu cầu, điều phối hiện trường, đón tiếp & bàn giao tại viện và tra cứu bệnh án ePCR
            </p>
          </div>

          <!-- Main Table Mount Card -->
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="cases-list-table-mount"></div>
          </div>
        </div>
      `;

      // 2. Render DataTable với đầy đủ bộ lọc, tìm kiếm, sort
      new window.CCNV_UI.DataTable({
        containerId: 'cases-list-table-mount',
        data: allCases,
        pageSize: 10,
        exportTitle: 'Danh_sach_ca_cap_cuu_va_tiep_nhan',
        searchPlaceholder: 'Tìm mã ca, bệnh nhân, biển số xe, bệnh viện đích, tình huống...',
        defaultSortKey: 'createdAt',
        defaultSortOrder: 'desc',
        filterOptions: [
          { label: 'Tất cả ca', value: 'ALL', filterFn: () => true },
          { label: 'Xe đang đến viện (Tiếp nhận)', value: 'TRANSPORTING', filterFn: c => c.status === 'TRANSPORTING' },
          { label: 'Đang xử lý / Điều xe', value: 'ACTIVE', filterFn: c => c.status === 'DISPATCHED' || c.status === 'ON_SCENE' || c.status === 'NEW' },
          { label: 'Đã hoàn tất', value: 'COMPLETED', filterFn: c => c.status === 'COMPLETED' },
          { label: 'Tối khẩn / Nguy kịch', value: 'CRITICAL', filterFn: c => c.severity === 'CRITICAL' || c.severity === 'EMERGENCY' },
          { label: 'Đã hủy', value: 'CANCELLED', filterFn: c => c.status === 'CANCELLED' }
        ],
        columns: [
          {
            key: 'code',
            title: 'Mã ca',
            sortable: true,
            render: c => `<strong style="font-family:var(--font-mono);color:#60A5FA;cursor:pointer;" class="btn-open-case-detail" data-case-id="${c.id}">${c.code}</strong>`
          },
          {
            key: 'createdAt',
            title: 'Thời gian',
            sortable: true,
            render: c => {
              const d = new Date(c.createdAt);
              if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const seconds = String(d.getSeconds()).padStart(2, '0');
                return `<span style="font-family:var(--font-mono);font-size:12px;color:#CBD5E1;">${day}/${month}/${year} - ${hours}:${minutes}:${seconds}</span>`;
              }
              return `<span style="font-family:var(--font-mono);font-size:12px;">${c.createdAt}</span>`;
            }
          },
          {
            key: 'incidentName',
            title: 'Tình huống',
            sortable: true,
            render: c => `<span class="badge ${c.severity === 'CRITICAL' || c.severity === 'EMERGENCY' ? 'badge-emergency' : 'badge-normal'}">${c.incidentName}</span>`
          },
          {
            key: 'vehiclePlate',
            title: 'Biển số xe',
            sortable: true,
            render: c => `<span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">${c.vehiclePlate}</span>`
          },
          {
            key: 'hospitalName',
            title: 'Bệnh viện tiếp nhận',
            sortable: true,
            render: c => `
              <div>
                <span style="color:var(--text-white);font-weight:500;">${c.hospitalName}</span>
                ${c.status === 'TRANSPORTING' ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:rgba(245,158,11,0.2);color:#F59E0B;font-size:10.5px;font-weight:600;margin-left:6px;">ETA: ${c.eta}</span>` : ''}
              </div>
            `
          },
          {
            key: 'actions',
            title: 'Thao tác',
            sortable: false,
            render: c => {
              if (c.status === 'TRANSPORTING') {
                return `
                  <div style="display:flex;align-items:center;gap:6px;">
                    <button class="btn btn-emergency btn-sm btn-quick-handover" data-case-id="${c.id}" data-case-code="${c.code}" title="Xác nhận tiếp nhận và hoàn tất bàn giao người bệnh">
                      Bàn giao
                    </button>
                    <button class="btn btn-default btn-sm btn-open-case-detail" data-case-id="${c.id}">
                      Chi tiết
                    </button>
                  </div>
                `;
              }
              return `
                <div style="display:flex;align-items:center;gap:6px;">
                  <button class="btn btn-default btn-sm btn-open-case-detail" data-case-id="${c.id}">
                    Chi tiết
                  </button>
                </div>
              `;
            }
          }
        ]
      }).render();

      // Thao tác trên từng dòng (Bàn giao 1-click, Xem chi tiết, Nhấn vào hàng để xem detail)
      container.addEventListener('click', (e) => {
        // Nút Tiếp nhận & Bàn giao 1-Click
        const handoverBtn = e.target.closest('.btn-quick-handover');
        if (handoverBtn) {
          e.stopPropagation();
          const caseId = handoverBtn.getAttribute('data-case-id');
          const targetCase = state.cases.find(c => c.id === caseId || c.code === caseId);
          if (targetCase) {
            targetCase.status = 'COMPLETED';
            targetCase.statusText = 'Hoàn tất';
            targetCase.stageLabel = 'Đã bàn giao tại viện';
            targetCase.hospitalResponse = 'ACCEPTED';
            targetCase.hospitalResponseText = 'Đã bàn giao';

            // Giải phóng xe về trạng thái sẵn sàng
            const plate = targetCase.dispatch?.vehiclePlate;
            if (plate) {
              window.StateManager.updateVehicle(plate, {
                status: 'READY',
                statusText: 'Sẵn sàng',
                speed: 0
              });
            }

            window.StateManager.saveToSession();
            window.StateManager.addCaseLog(targetCase.id, `Khoa Cấp cứu ${targetCase.dispatch?.hospitalName || 'Bệnh viện'} xác nhận tiếp nhận & ký biên bản bàn giao. Ca hoàn tất.`);
            window.StateManager.addAuditLog(`Xác nhận tiếp nhận & bàn giao hoàn tất ca ${targetCase.code} tại ${targetCase.dispatch?.hospitalName || 'Bệnh viện'}`);

            window.CCNV_UI.Toast.show('Đã Tiếp Nhận & Bàn Giao', `Ca ${targetCase.code} đã hoàn tất bàn giao. Xe ${plate || ''} sẵn sàng nhận nhiệm vụ mới.`);
            this.renderCasesListView(container);
          }
          return;
        }

        // Nhấn vào hàng hoặc nút Chi tiết để xem chi tiết ca
        const tr = e.target.closest('tbody tr');
        if (tr) {
          const detailTarget = tr.querySelector('[data-case-id]');
          const caseId = detailTarget?.getAttribute('data-case-id');
          if (caseId) {
            this.openCaseDetailModal(caseId);
          }
        }
      });
    }

    renderCaseLookupView(container) {
      this.renderCasesListView(container);
    }

    // --- 6. RESOURCE MONITORING: VEHICLES, CREWS, HOSPITALS, SHIFTS ---
    renderVehiclesStatusView(container) {
      const state = window.StateManager.getState();
      const vehicles = state.vehicles || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:12px;">
            <h2 style="color:var(--text-white);font-size:18px;">Tình trạng Xe Cấp cứu</h2>
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
        showSortSelect: false,
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
          { key: 'battery', title: 'Mức Pin', sortable: false, render: v => window.CCNV_UI.renderBattery(v.battery) }
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
        showSortSelect: false,
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
            <h2 style="color:var(--text-white);font-size:18px;">Tình trạng Mạng lưới bệnh viện tiếp nhận</h2>
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
        searchPlaceholder: 'Tìm tên bệnh viện, số hotline...',
        defaultSortKey: 'name',
        defaultSortOrder: 'asc',
        showSortSelect: false,
        filterOptions: [
          { label: 'Đang nhận', value: 'AVAILABLE', filterFn: h => h.status === 'AVAILABLE' },
          { label: 'Hạn chế', value: 'RESTRICTED', filterFn: h => h.status === 'RESTRICTED' },
          { label: 'Tạm ngưng', value: 'SUSPENDED', filterFn: h => h.status === 'SUSPENDED' }
        ],
        columns: [
          { key: 'name', title: 'Bệnh viện', sortable: true, render: h => `<strong style="color:var(--text-white);">${h.name}</strong>` },
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
          { key: 'hotline', title: 'Hotline Cấp cứu', sortable: true, render: h => `<strong style="font-family:var(--font-mono);color:var(--red-vivid);">${h.hotline}</strong>` }
        ]
      }).render();
    }

    // ==========================================
    // --- 5. CA TRỰC (SITEMAP 8.1) ---
    // ==========================================
    renderShiftsAssignmentView(container) {
      const state = window.StateManager.getState();
      const crews = state.crews || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Phân công Ca trực & Thành viên Kíp</h2>
              <p style="font-size:12px;color:var(--text-muted);">Theo dõi phân công xe - nhân sự trong ca; Khai báo thành viên kíp trực cấp cứu</p>
            </div>
            <button class="btn btn-default" id="btn-add-crew-member">
              ${window.CCNV_UI.ICONS.users}
              <span>Khai báo / Đổi thành viên kíp</span>
            </button>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="shifts-assignment-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'shifts-assignment-table-mount',
        data: crews,
        pageSize: 10,
        exportTitle: 'Phân công Kíp trực Cấp cứu',
        searchPlaceholder: 'Tìm mã kíp, tên bác sĩ, xe cấp cứu, trạm...',
        defaultSortKey: 'id',
        defaultSortOrder: 'asc',
        columns: [
          { key: 'id', title: 'Mã kíp', sortable: true, render: c => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${c.id}</strong>` },
          { key: 'name', title: 'Tên kíp trực', sortable: true, render: c => `<strong>${c.name}</strong>` },
          { key: 'vehiclePlate', title: 'Xe phân công', sortable: true, render: c => `<span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">${c.vehiclePlate || '65A-012.34'}</span>` },
          { key: 'doctor', title: 'Bác sĩ trưởng kíp', sortable: true, render: c => c.doctor || 'BS. Võ Văn Kiệt' },
          { key: 'nurse', title: 'Điều dưỡng', sortable: true, render: c => c.nurse || 'ĐD. Lê Thị Mai' },
          { key: 'driver', title: 'Lái xe', sortable: true, render: c => c.driver || 'LX. Nguyễn Hoàng Nam' },
          { key: 'station', title: 'Trạm đóng quân', sortable: true, render: c => c.station || 'BVĐK TP Cần Thơ' },
          { key: 'shift', title: 'Ca trực', sortable: true, render: c => `<span class="badge badge-normal">${c.shift || 'Ca 1 (07h-15h)'}</span>` },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: c => {
              if (c.status === 'READY') return `<span class="status-pill status-pill-completed">Sẵn sàng</span>`;
              if (c.status === 'BUSY') return `<span class="status-pill status-pill-processing">Đang làm nhiệm vụ</span>`;
              return `<span class="status-pill status-pill-cancelled">Nghỉ giữa ca</span>`;
            }
          },
          {
            key: 'actions',
            title: 'Thao tác',
            sortable: false,
            render: c => `<button class="btn btn-default btn-sm btn-edit-crew" data-cid="${c.id}">Điều chỉnh</button>`
          }
        ]
      }).render();

      container.querySelector('#btn-add-crew-member')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Phân công kíp trực', 'Mở giao diện điều chỉnh nhân sự kíp trực');
      });

      container.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-edit-crew');
        if (btn) {
          const cid = btn.getAttribute('data-cid');
          window.CCNV_UI.Toast.show('Cập nhật kíp trực', `Đang mở cấu hình thành viên kíp ${cid}`);
        }
      });
    }

    renderShiftsCalendarView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Lịch trực Ban 24/7 Các Trạm Vệ tinh</h2>
              <p style="font-size:12px;color:var(--text-muted);">Quản lý lịch trực / tổ xe luân phiên tại 5 trạm vệ tinh Cần Thơ</p>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-default btn-sm" id="btn-export-shift-calendar">Xuất file Lịch trực (PDF)</button>
              <button class="btn btn-default btn-sm" id="btn-request-shift-swap">Đăng ký đổi ca</button>
            </div>
          </div>

          <div class="content-card" style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--border-main);padding-bottom:8px;">
              <strong style="color:var(--text-white);font-size:14px;">Tuần 40: Từ 28/09/2026 đến 04/10/2026</strong>
              <span class="badge badge-emergency">Hôm nay: Thứ Sáu 02/10/2026</span>
            </div>

            <!-- Calendar Schedule Matrix -->
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:center;">
                <thead>
                  <tr style="background:var(--bg-elevated);color:var(--text-white);border-bottom:1px solid var(--border-main);">
                    <th style="padding:10px;text-align:left;">Trạm trực vệ tinh</th>
                    <th style="padding:10px;">Thứ 2 (28/09)</th>
                    <th style="padding:10px;">Thứ 3 (29/09)</th>
                    <th style="padding:10px;">Thứ 4 (30/09)</th>
                    <th style="padding:10px;">Thứ 5 (01/10)</th>
                    <th style="padding:10px;background:#1E3A5F;color:#93C5FD;">Thứ 6 (Hôm nay)</th>
                    <th style="padding:10px;">Thứ 7 (03/10)</th>
                    <th style="padding:10px;">CN (04/10)</th>
                  </tr>
                </thead>
                <tbody style="color:var(--text-slate);">
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;text-align:left;font-weight:600;color:var(--text-white);">1. BVĐK TP Cần Thơ (TT115)</td>
                    <td style="padding:8px;">Kíp 01, 02</td>
                    <td style="padding:8px;">Kíp 02, 03</td>
                    <td style="padding:8px;">Kíp 01, 03</td>
                    <td style="padding:8px;">Kíp 01, 02</td>
                    <td style="padding:8px;background:rgba(30, 58, 95, 0.4);font-weight:600;color:#93C5FD;">Kíp 01, 02 (Trực chiến)</td>
                    <td style="padding:8px;">Kíp 03, 04</td>
                    <td style="padding:8px;">Kíp 01, 05</td>
                  </tr>
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;text-align:left;font-weight:600;color:var(--text-white);">2. Trạm TTYT Cái Răng</td>
                    <td style="padding:8px;">Kíp 03</td>
                    <td style="padding:8px;">Kíp 04</td>
                    <td style="padding:8px;">Kíp 02</td>
                    <td style="padding:8px;">Kíp 03</td>
                    <td style="padding:8px;background:rgba(30, 58, 95, 0.4);font-weight:600;color:#93C5FD;">Kíp 03 (Xe 65A-013.88)</td>
                    <td style="padding:8px;">Kíp 01</td>
                    <td style="padding:8px;">Kíp 02</td>
                  </tr>
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;text-align:left;font-weight:600;color:var(--text-white);">3. Trạm TTYT Bình Thủy</td>
                    <td style="padding:8px;">Kíp 04</td>
                    <td style="padding:8px;">Kíp 01</td>
                    <td style="padding:8px;">Kíp 04</td>
                    <td style="padding:8px;">Kíp 05</td>
                    <td style="padding:8px;background:rgba(30, 58, 95, 0.4);font-weight:600;color:#93C5FD;">Kíp 04 (Xe 65A-014.56)</td>
                    <td style="padding:8px;">Kíp 02</td>
                    <td style="padding:8px;">Kíp 03</td>
                  </tr>
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;text-align:left;font-weight:600;color:var(--text-white);">4. Trạm TTYT Ô Môn</td>
                    <td style="padding:8px;">Kíp 05</td>
                    <td style="padding:8px;">Kíp 05</td>
                    <td style="padding:8px;">Kíp 05</td>
                    <td style="padding:8px;">Kíp 04</td>
                    <td style="padding:8px;background:rgba(30, 58, 95, 0.4);font-weight:600;color:#93C5FD;">Kíp 05 (Xe 65A-015.67)</td>
                    <td style="padding:8px;">Kíp 05</td>
                    <td style="padding:8px;">Kíp 04</td>
                  </tr>
                  <tr>
                    <td style="padding:10px;text-align:left;font-weight:600;color:var(--text-white);">5. Trạm TTYT Thốt Nốt</td>
                    <td style="padding:8px;">Kíp 02</td>
                    <td style="padding:8px;">Kíp 03</td>
                    <td style="padding:8px;">Kíp 01</td>
                    <td style="padding:8px;">Kíp 02</td>
                    <td style="padding:8px;background:rgba(30, 58, 95, 0.4);font-weight:600;color:#93C5FD;">Kíp 02 (Xe 65A-016.78)</td>
                    <td style="padding:8px;">Kíp 04</td>
                    <td style="padding:8px;">Kíp 05</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-export-shift-calendar')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Xuất lịch trực', 'Đã tải xuống bảng phân công lịch trực ban tuần 40');
      });
      container.querySelector('#btn-request-shift-swap')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Đăng ký đổi ca', 'Gửi yêu cầu đổi ca trực đến Điều phối viên trưởng');
      });
    }

    // ==========================================
    // ==========================================
    // --- 6. BÁO CÁO (SITEMAP 8.1 - BÁO CÁO SỐ CA TIẾP NHẬN) ---
    // ==========================================
    renderReportCasesView(container, activeTab = 'overview') {
      const state = window.StateManager.getState();
      const stats = state.stats || {};

      // Prepare comprehensive data records for Chi tiết tab
      const rawHistory = state.historyCases || [];
      const rawActive = state.activeCases || [];

      // Unified records list with rich fields for reporting, sorting, filtering, and export
      const detailRecords = [
        ...rawActive.map(c => ({
          code: c.code || c.id,
          createdAt: c.createdAt || '2026-10-02T08:10:15',
          patientName: c.patient?.name || c.patientName || 'Nguyễn Văn Nam',
          patientAge: c.patient?.age || c.patientAge || 34,
          patientGender: c.patient?.gender || 'Nam',
          incidentName: c.incident?.name || c.incidentName || 'Tai nạn giao thông',
          severity: c.incident?.severity || c.severity || 'EMERGENCY',
          severityText: c.incident?.severityText || (c.severity === 'CRITICAL' ? 'Tối khẩn' : 'Khẩn cấp'),
          vehiclePlate: c.dispatch?.vehiclePlate || c.vehiclePlate || '65A-012.34',
          hospitalName: c.dispatch?.hospitalName || c.hospitalName || 'BV Đa khoa TP Cần Thơ',
          address: c.location?.address || c.address || 'Đoạn ngã tư 30/4 - Nguyễn Văn Linh, P. Hưng Lợi',
          district: c.location?.district || 'Ninh Kiều',
          status: 'IN_PROGRESS',
          statusText: 'Đang xử lý',
          callToDispatch: '0.8 phút',
          callToScene: '5.4 phút',
          duration: 'Đang thực hiện'
        })),
        ...rawHistory.map(h => ({
          code: h.code || h.id,
          createdAt: h.createdAt || '2026-10-01T21:40:00',
          patientName: h.patientName,
          patientAge: h.patientAge || 45,
          patientGender: h.patientAge > 50 ? 'Nữ' : 'Nam',
          incidentName: h.incidentName,
          severity: h.severity || 'EMERGENCY',
          severityText: h.severity === 'CRITICAL' ? 'Tối khẩn' : (h.severity === 'EMERGENCY' ? 'Khẩn cấp' : 'Tiêu chuẩn'),
          vehiclePlate: h.vehiclePlate,
          hospitalName: h.hospitalName,
          address: h.address || 'Đường 30/4, P. Xuân Khánh, Q. Ninh Kiều',
          district: h.district || 'Ninh Kiều',
          status: h.status || 'COMPLETED',
          statusText: h.status === 'COMPLETED' ? 'Hoàn tất bàn giao' : 'Đã hủy ca',
          callToDispatch: h.durations?.callToDispatch || '1.1 phút',
          callToScene: h.durations?.dispatchToScene || '6.3 phút',
          duration: h.durations?.totalTime || '45 phút'
        })),
        // Additional sample data to demonstrate full pagination, search & sort
        {
          code: 'CC-261001-015',
          createdAt: '2026-10-01T15:20:00',
          patientName: 'Phạm Thị Lan',
          patientAge: 68,
          patientGender: 'Nữ',
          incidentName: 'Đột quỵ não',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-015.67',
          hospitalName: 'BV Đa khoa TP Cần Thơ',
          address: '128 Đường 3/2, P. Xuân Khánh, Q. Ninh Kiều',
          district: 'Ninh Kiều',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '0.7 phút',
          callToScene: '5.1 phút',
          duration: '38 phút'
        },
        {
          code: 'CC-261001-014',
          createdAt: '2026-10-01T14:05:00',
          patientName: 'Hoàng Minh Khang',
          patientAge: 29,
          patientGender: 'Nam',
          incidentName: 'Tai nạn giao thông',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-012.34',
          hospitalName: 'BV Đa khoa TW Cần Thơ',
          address: 'Cầu Hưng Lợi, P. Hưng Phú, Q. Cái Răng',
          district: 'Cái Răng',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '0.9 phút',
          callToScene: '6.8 phút',
          duration: '42 phút'
        },
        {
          code: 'CC-261001-013',
          createdAt: '2026-10-01T11:45:00',
          patientName: 'Đỗ Thị Mai',
          patientAge: 54,
          patientGender: 'Nữ',
          incidentName: 'Ngừng tuần hoàn / Đau thắt ngực cấp',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-015.67',
          hospitalName: 'BV Tim mạch TP Cần Thơ',
          address: 'Chợ An Khánh, Q. Ninh Kiều',
          district: 'Ninh Kiều',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '0.6 phút',
          callToScene: '4.8 phút',
          duration: '35 phút'
        },
        {
          code: 'CC-261001-012',
          createdAt: '2026-10-01T09:30:00',
          patientName: 'Trần Bảo Long',
          patientAge: 7,
          patientGender: 'Nam',
          incidentName: 'Co giật sốt cao trẻ em',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-018.89',
          hospitalName: 'BV Nhi đồng Cần Thơ',
          address: 'Đường CMT8, P. An Thới, Q. Bình Thủy',
          district: 'Bình Thủy',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '0.8 phút',
          callToScene: '5.9 phút',
          duration: '32 phút'
        },
        {
          code: 'CC-261001-011',
          createdAt: '2026-10-01T08:15:00',
          patientName: 'Ngô Tấn Tài',
          patientAge: 41,
          patientGender: 'Nam',
          incidentName: 'Suy hô hấp cấp / Dị vật đường thở',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-011.15',
          hospitalName: 'BV Đa khoa TP Cần Thơ',
          address: 'KCN Trà Nóc 1, Q. Bình Thủy',
          district: 'Bình Thủy',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '0.9 phút',
          callToScene: '7.2 phút',
          duration: '44 phút'
        },
        {
          code: 'CC-261001-010',
          createdAt: '2026-10-01T06:50:00',
          patientName: 'Vũ Quốc Cường',
          patientAge: 36,
          patientGender: 'Nam',
          incidentName: 'Tai nạn giao thông',
          severity: 'ROUTINE',
          severityText: 'Tiêu chuẩn',
          vehiclePlate: '65A-019.99',
          hospitalName: 'TTYT Quận Ô Môn',
          address: 'Quốc lộ 91, Phường Châu Văn Liêm, Q. Ô Môn',
          district: 'Ô Môn',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '1.2 phút',
          callToScene: '8.4 phút',
          duration: '40 phút'
        }
      ];

      container.innerHTML = `
        <div class="view-container-full">
          <!-- Header Bar with Filter controls -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:12px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:rgba(229, 37, 33, 0.15);color:var(--red-vivid);border-radius:6px;">
                  ${window.CCNV_UI.ICONS.barChart}
                </span>
                <h2 style="color:var(--text-white);font-size:18px;margin:0;font-weight:700;">Báo Cáo Số Ca Tiếp Nhận</h2>
              </div>
              <p style="font-size:12.5px;color:var(--text-muted);margin:0;">
                Theo dõi toàn diện số lượng ca cấp cứu ngoại viện được kích hoạt, phân tích KPI đáp ứng và trích xuất dữ liệu chi tiết
              </p>
            </div>
          </div>

          <!-- Internal Tab Navigation (2 Tabs as requested) -->
          <div style="display:flex;gap:8px;border-bottom:1px solid var(--border-main);padding-bottom:10px;margin-bottom:16px;">
            <button class="btn ${activeTab === 'overview' ? 'btn-emergency' : 'btn-default'} btn-sm report-tab-btn" data-tab="overview">
              ${window.CCNV_UI.ICONS.barChart}
              <span>Tổng quan</span>
            </button>
            <button class="btn ${activeTab === 'detail' ? 'btn-emergency' : 'btn-default'} btn-sm report-tab-btn" data-tab="detail">
              ${window.CCNV_UI.ICONS.layers}
              <span>Chi tiết</span>
              <span class="badge ${activeTab === 'detail' ? 'badge-emergency' : 'badge-normal'}" style="margin-left:4px;padding:1px 6px;font-size:11px;">${detailRecords.length}</span>
            </button>
          </div>

          <!-- Tab Content Mount Container -->
          <div id="report-cases-pane"></div>
        </div>
      `;

      // Tab switcher event handlers
      container.querySelectorAll('.report-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-tab');
          this.renderReportCasesView(container, tab);
        });
      });

      const pane = container.querySelector('#report-cases-pane');
      if (!pane) return;

      // ==========================================
      // TAB 1: TỔNG QUAN (KPIs, Thống kê nhanh, Biểu đồ)
      // ==========================================
      if (activeTab === 'overview') {
        const totalCount = 1284;
        const criticalCount = 342;
        const avgSLA = '7.4 phút';
        const successRate = '98.6%';

        pane.innerHTML = `
          <!-- 1. Quick Stats & KPI Cards Grid -->
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;margin-bottom:18px;">
            <div class="kpi-card" style="position:relative;overflow:hidden;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Tổng ca tiếp nhận</span>
                <span style="font-size:11px;color:#10B981;font-weight:600;background:rgba(16,185,129,0.12);padding:2px 6px;border-radius:4px;">+12.4% ↑</span>
              </div>
              <span class="kpi-value" style="color:var(--text-white);">${totalCount.toLocaleString()}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Hôm nay: <strong style="color:#93C5FD;">${stats.todayCases || 14} ca</strong> · Tháng này: <strong style="color:var(--text-white);">${stats.monthCases || 348} ca</strong>
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Ca tối khẩn (Đỏ / Cam)</span>
                <span style="font-size:11px;color:var(--red-vivid);font-weight:600;background:rgba(229,37,33,0.12);padding:2px 6px;border-radius:4px;">26.6%</span>
              </div>
              <span class="kpi-value" style="color:var(--red-vivid);">${criticalCount}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Đột quỵ, ngừng tuần hoàn, đa chấn thương nguy kịch
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Thời gian tiếp cận TB (Call-to-Scene)</span>
                <span style="font-size:11px;color:#10B981;font-weight:600;background:rgba(16,185,129,0.12);padding:2px 6px;border-radius:4px;">Đạt chuẩn SLA</span>
              </div>
              <span class="kpi-value" style="color:#10B981;">${avgSLA}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Mục tiêu toàn TP: &lt; 10 phút (Nội ô &lt; 8 phút)
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Tỷ lệ bàn giao thành công</span>
                <span style="font-size:11px;color:#93C5FD;font-weight:600;background:rgba(59,130,246,0.12);padding:2px 6px;border-radius:4px;">Toàn mạng</span>
              </div>
              <span class="kpi-value" style="color:#93C5FD;">${successRate}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Số ca hủy / tự chuyển viện: <strong>1.4% (18 ca)</strong>
              </div>
            </div>
          </div>

          <!-- 2. Visual Charts Row (SVG Column Chart & Donut breakdown) -->
          <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-bottom:18px;">
            <!-- Column Chart: Cases by Time Slot -->
            <div class="content-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                  <h3 style="color:var(--text-white);font-size:14px;margin:0 0 2px 0;">Phân bố Số ca Tiếp nhận theo Khung giờ trong Ngày</h3>
                  <span style="font-size:12px;color:var(--text-muted);">Cao điểm tập trung khung giờ tan tầm và ban đêm</span>
                </div>
                <span class="badge badge-normal" style="font-size:11px;">24 Giờ</span>
              </div>

              <!-- SVG Bar Chart -->
              <div style="height:190px;background:var(--bg-elevated);border-radius:6px;padding:16px 12px 8px 12px;border:1px solid var(--border-main);display:flex;flex-direction:column;justify-content:space-between;">
                <div style="flex:1;display:flex;align-items:flex-end;gap:14px;padding:0 8px;">
                  <!-- Bar 1: 00h-04h -->
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;">
                    <span style="font-size:11px;color:#93C5FD;font-weight:600;">84</span>
                    <div style="width:100%;max-width:38px;height:24%;background:linear-gradient(to top, #1E3A8A, #3B82F6);border-radius:4px 4px 0 0;" title="00:00 - 04:00: 84 ca"></div>
                    <span style="font-size:10.5px;color:var(--text-muted);">00h-04h</span>
                  </div>
                  <!-- Bar 2: 04h-08h -->
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;">
                    <span style="font-size:11px;color:#93C5FD;font-weight:600;">146</span>
                    <div style="width:100%;max-width:38px;height:42%;background:linear-gradient(to top, #1E3A8A, #3B82F6);border-radius:4px 4px 0 0;" title="04:00 - 08:00: 146 ca"></div>
                    <span style="font-size:10.5px;color:var(--text-muted);">04h-08h</span>
                  </div>
                  <!-- Bar 3: 08h-12h -->
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;">
                    <span style="font-size:11px;color:#93C5FD;font-weight:600;">268</span>
                    <div style="width:100%;max-width:38px;height:76%;background:linear-gradient(to top, #1E3A8A, #3B82F6);border-radius:4px 4px 0 0;" title="08:00 - 12:00: 268 ca"></div>
                    <span style="font-size:10.5px;color:var(--text-muted);">08h-12h</span>
                  </div>
                  <!-- Bar 4: 12h-16h -->
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;">
                    <span style="font-size:11px;color:#93C5FD;font-weight:600;">215</span>
                    <div style="width:100%;max-width:38px;height:61%;background:linear-gradient(to top, #1E3A8A, #3B82F6);border-radius:4px 4px 0 0;" title="12:00 - 16:00: 215 ca"></div>
                    <span style="font-size:10.5px;color:var(--text-muted);">12h-16h</span>
                  </div>
                  <!-- Bar 5: 16h-20h (Peak) -->
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;">
                    <span style="font-size:11px;color:var(--red-vivid);font-weight:700;">352 ★</span>
                    <div style="width:100%;max-width:38px;height:100%;background:linear-gradient(to top, #B91C1C, #EF4444);border-radius:4px 4px 0 0;" title="16:00 - 20:00 (Giờ cao điểm): 352 ca"></div>
                    <span style="font-size:10.5px;color:var(--red-vivid);font-weight:600;">16h-20h</span>
                  </div>
                  <!-- Bar 6: 20h-24h -->
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;">
                    <span style="font-size:11px;color:#93C5FD;font-weight:600;">219</span>
                    <div style="width:100%;max-width:38px;height:62%;background:linear-gradient(to top, #1E3A8A, #3B82F6);border-radius:4px 4px 0 0;" title="20:00 - 24:00: 219 ca"></div>
                    <span style="font-size:10.5px;color:var(--text-muted);">20h-24h</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Horizontal Progress Bars: Incident Categories Breakdown -->
            <div class="content-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 style="color:var(--text-white);font-size:14px;margin:0;">Cơ cấu theo Loại tình huống</h3>
                <span style="font-size:11px;color:var(--text-muted);">1,284 ca</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:12px;font-size:12.5px;">
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Tai nạn giao thông (TNGT)</span>
                    <strong style="color:var(--red-vivid);">42% (539 ca)</strong>
                  </div>
                  <div style="height:7px;background:var(--bg-main);border-radius:4px;overflow:hidden;">
                    <div style="width:42%;height:100%;background:var(--red-vivid);border-radius:4px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Đột quỵ & Tim mạch cấp</span>
                    <strong style="color:#F59E0B;">26% (334 ca)</strong>
                  </div>
                  <div style="height:7px;background:var(--bg-main);border-radius:4px;overflow:hidden;">
                    <div style="width:26%;height:100%;background:#F59E0B;border-radius:4px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Suy hô hấp / Dị vật đường thở</span>
                    <strong style="color:#3B82F6;">18% (231 ca)</strong>
                  </div>
                  <div style="height:7px;background:var(--bg-main);border-radius:4px;overflow:hidden;">
                    <div style="width:18%;height:100%;background:#3B82F6;border-radius:4px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Tai nạn sinh hoạt, ngã cao & Khác</span>
                    <strong style="color:#10B981;">14% (180 ca)</strong>
                  </div>
                  <div style="height:7px;background:var(--bg-main);border-radius:4px;overflow:hidden;">
                    <div style="width:14%;height:100%;background:#10B981;border-radius:4px;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Bottom Row: Distribution by District and Destination Hospital -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <!-- District Distribution -->
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Phân bố Ca tiếp nhận theo Địa bàn Quận / Huyện</h3>
              <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span>Quận Ninh Kiều (Trung tâm)</span>
                    <strong style="color:#93C5FD;">54% (693 ca)</strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:54%;height:100%;background:#3B82F6;"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span>Quận Cái Răng</span>
                    <strong style="color:#93C5FD;">18% (231 ca)</strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:18%;height:100%;background:#10B981;"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span>Quận Bình Thủy</span>
                    <strong style="color:#93C5FD;">14% (180 ca)</strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:14%;height:100%;background:#F59E0B;"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span>Quận Ô Môn & Thốt Nốt</span>
                    <strong style="color:#93C5FD;">14% (180 ca)</strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:14%;height:100%;background:#8B5CF6;"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top Receiving Hospitals -->
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Top Bệnh viện Tiếp nhận Ca Cấp cứu</h3>
              <div style="display:flex;flex-direction:column;gap:9px;font-size:12.5px;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg-elevated);border-radius:4px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-weight:700;color:var(--red-vivid);width:16px;">1</span>
                    <span style="color:var(--text-white);font-weight:500;">BV Đa khoa TP Cần Thơ</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:12px;">
                    <strong style="color:#93C5FD;">582 ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(45.3%)</span>
                  </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg-elevated);border-radius:4px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-weight:700;color:#F59E0B;width:16px;">2</span>
                    <span style="color:var(--text-white);font-weight:500;">BV Đa khoa Trung ương Cần Thơ</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:12px;">
                    <strong style="color:#93C5FD;">416 ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(32.4%)</span>
                  </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg-elevated);border-radius:4px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-weight:700;color:#3B82F6;width:16px;">3</span>
                    <span style="color:var(--text-white);font-weight:500;">BV Nhi đồng Cần Thơ</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:12px;">
                    <strong style="color:#93C5FD;">148 ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(11.5%)</span>
                  </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg-elevated);border-radius:4px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-weight:700;color:#10B981;width:16px;">4</span>
                    <span style="color:var(--text-white);font-weight:500;">BV Tim mạch & TTYT Quận Huyện</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:12px;">
                    <strong style="color:#93C5FD;">138 ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(10.8%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // ==========================================
      // TAB 2: CHI TIẾT (Bản ghi, Search, Sort, Phân trang, Xuất Excel)
      // ==========================================
      else if (activeTab === 'detail') {
        pane.innerHTML = `
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="report-cases-detail-table-mount"></div>
          </div>
        `;

        new window.CCNV_UI.DataTable({
          containerId: 'report-cases-detail-table-mount',
          data: detailRecords,
          pageSize: 10,
          exportTitle: 'Báo cáo Chi tiết Số ca Tiếp nhận Cấp cứu Ngoại viện TP Cần Thơ',
          enableExport: true,
          showSortSelect: true,
          searchPlaceholder: 'Tìm mã ca, họ tên bệnh nhân, tình huống, xe, bệnh viện...',
          defaultSortKey: 'createdAt',
          defaultSortOrder: 'desc',
          filterOptions: [
            { label: 'Tất cả mức độ', value: 'ALL', filterFn: () => true },
            { label: 'Tối khẩn', value: 'CRITICAL', filterFn: item => item.severity === 'CRITICAL' },
            { label: 'Khẩn cấp', value: 'EMERGENCY', filterFn: item => item.severity === 'EMERGENCY' },
            { label: 'Tiêu chuẩn', value: 'ROUTINE', filterFn: item => item.severity === 'ROUTINE' },
            { label: 'Hoàn tất bàn giao', value: 'COMPLETED', filterFn: item => item.status === 'COMPLETED' },
            { label: 'Đang xử lý', value: 'IN_PROGRESS', filterFn: item => item.status === 'IN_PROGRESS' }
          ],
          columns: [
            {
              key: 'code',
              title: 'Mã ca',
              sortable: true,
              render: item => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${item.code}</strong>`
            },
            {
              key: 'createdAt',
              title: 'Thời điểm',
              sortable: true,
              render: item => `<span style="font-size:12px;color:var(--text-white);">${item.createdAt.replace('T', ' ')}</span>`
            },
            {
              key: 'patientName',
              title: 'Bệnh nhân',
              sortable: true,
              render: item => `<strong>${item.patientName}</strong> <span style="font-size:11.5px;color:var(--text-muted);">(${item.patientAge}T · ${item.patientGender})</span>`
            },
            {
              key: 'incidentName',
              title: 'Tình huống cấp cứu',
              sortable: true,
              render: item => `<span>${item.incidentName}</span>`
            },
            {
              key: 'severity',
              title: 'Mức độ',
              sortable: true,
              render: item => {
                if (item.severity === 'CRITICAL') return `<span class="badge badge-emergency" style="font-size:11px;">Tối khẩn</span>`;
                if (item.severity === 'EMERGENCY') return `<span class="badge" style="background:#F59E0B;color:#000;font-weight:600;font-size:11px;">Khẩn cấp</span>`;
                return `<span class="badge badge-normal" style="font-size:11px;">Tiêu chuẩn</span>`;
              }
            },
            {
              key: 'vehiclePlate',
              title: 'Xe tiếp nhận',
              sortable: true,
              render: item => `<span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">${item.vehiclePlate}</span>`
            },
            {
              key: 'hospitalName',
              title: 'Bệnh viện đích',
              sortable: true,
              render: item => `<span style="font-size:12px;">${item.hospitalName}</span>`
            },
            {
              key: 'callToScene',
              title: 'Tiếp cận',
              sortable: false,
              render: item => `<span style="font-family:var(--font-mono);color:#10B981;font-weight:600;">${item.callToScene}</span>`
            },
            {
              key: 'status',
              title: 'Trạng thái',
              sortable: true,
              render: item => {
                if (item.status === 'COMPLETED') return `<span class="status-pill status-pill-completed">Hoàn tất</span>`;
                if (item.status === 'IN_PROGRESS') return `<span class="status-pill status-pill-processing">Đang xử lý</span>`;
                return `<span class="status-pill status-pill-cancelled">Đã hủy</span>`;
              }
            }
          ]
        }).render();
      }
    }

    // ==========================================
    // --- 7. DANH MỤC & CẤU HÌNH (SITEMAP 8.1) ---
    // ==========================================
    renderCatVehiclesView(container) {
      const state = window.StateManager.getState();
      const vehicles = state.vehicles || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Danh mục Xe Cứu thương</h2>
              <p style="font-size:12px;color:var(--text-muted);">Quản lý danh sách phương tiện cứu thương, phân loại Type A/B/C và trạm đóng quân</p>
            </div>
            <button class="btn btn-emergency" id="btn-add-cat-vehicle">Thêm Xe Cứu Thương</button>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="cat-vehicles-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'cat-vehicles-table-mount',
        data: vehicles,
        pageSize: 10,
        exportTitle: 'Danh mục Xe cứu thương',
        searchPlaceholder: 'Tìm biển số xe, loại xe, trạm trực...',
        defaultSortKey: 'plate',
        defaultSortOrder: 'asc',
        columns: [
          { key: 'plate', title: 'Biển số', sortable: true, render: v => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${v.plate}</strong>` },
          { key: 'type', title: 'Phân loại', sortable: true, render: v => `<span class="badge ${v.type === 'Type A' ? 'badge-emergency' : 'badge-normal'}">${v.type || 'Type B'}</span>` },
          { key: 'station', title: 'Trạm trực', sortable: true, render: v => v.station || 'BVĐK TP Cần Thơ' },
          { key: 'model', title: 'Dòng xe', sortable: true, render: v => v.model || 'Ford Transit Emergency' },
          { key: 'status', title: 'Trạng thái hoạt động', sortable: true, render: v => `<span class="status-pill status-pill-completed">${v.statusText || 'Sẵn sàng'}</span>` },
          {
            key: 'actions',
            title: 'Thao tác',
            sortable: false,
            render: v => `<button class="btn btn-default btn-sm" onclick="window.CCNV_UI.Toast.show('Thông tin xe', 'Xem thông số kỹ thuật xe ${v.plate}')">Chi tiết</button>`
          }
        ]
      }).render();

      container.querySelector('#btn-add-cat-vehicle')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Thêm xe cứu thương', 'Mở form khai báo xe cứu thương mới vào hệ thống');
      });
    }

    renderCatHospitalsView(container) {
      const state = window.StateManager.getState();
      const hospitals = state.hospitals || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Danh mục Bệnh viện & Cơ sở Y tế</h2>
              <p style="font-size:12px;color:var(--text-muted);">Quản lý mạng lưới cơ sở y tế tiếp nhận cấp cứu tại TP. Cần Thơ</p>
            </div>
            <button class="btn btn-emergency" id="btn-add-cat-hosp">Thêm Bệnh viện</button>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="cat-hospitals-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'cat-hospitals-table-mount',
        data: hospitals,
        pageSize: 10,
        exportTitle: 'Danh mục Bệnh viện',
        searchPlaceholder: 'Tìm mã BV, tên bệnh viện, địa chỉ...',
        defaultSortKey: 'id',
        defaultSortOrder: 'asc',
        columns: [
          { key: 'id', title: 'Mã BV', sortable: true, render: h => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${h.id}</strong>` },
          { key: 'name', title: 'Tên Bệnh viện', sortable: true, render: h => `<strong>${h.name}</strong>` },
          { key: 'hotline', title: 'Hotline Cấp cứu', sortable: true, render: h => `<strong style="font-family:var(--font-mono);color:var(--red-vivid);">${h.hotline || '0292.3821.236'}</strong>` },
          { key: 'address', title: 'Địa chỉ', sortable: false, render: h => h.address },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: h => {
              if (h.status === 'READY') return `<span class="status-pill status-pill-completed">Đang nhận</span>`;
              if (h.status === 'LIMITED') return `<span class="status-pill status-pill-processing">Hạn chế</span>`;
              return `<span class="status-pill status-pill-cancelled">Tạm ngưng</span>`;
            }
          }
        ]
      }).render();

      container.querySelector('#btn-add-cat-hosp')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Thêm bệnh viện', 'Mở biểu mẫu khai báo bệnh viện tiếp nhận mới');
      });
    }

    renderCatIncidentsView(container) {
      const state = window.StateManager.getState();
      const incidents = state.incidentTypes || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Danh mục Loại tình huống Cấp cứu</h2>
              <p style="font-size:12px;color:var(--text-muted);">Phân loại tình huống, mức độ ưu tiên và loại xe kíp cấp cứu đề xuất</p>
            </div>
            <button class="btn btn-default" id="btn-add-cat-incident">Thêm Tình huống</button>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="cat-incidents-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'cat-incidents-table-mount',
        data: incidents,
        pageSize: 10,
        exportTitle: 'Danh mục Loại tình huống',
        searchPlaceholder: 'Tìm mã, tên tình huống...',
        defaultSortKey: 'code',
        defaultSortOrder: 'asc',
        columns: [
          { key: 'code', title: 'Mã tình huống', sortable: true, render: i => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${i.code}</strong>` },
          { key: 'name', title: 'Tên tình huống cấp cứu', sortable: true, render: i => `<strong>${i.name}</strong>` },
          {
            key: 'severity',
            title: 'Mức độ ưu tiên',
            sortable: true,
            render: i => `<span class="badge ${i.severity === 'CRITICAL' || i.severity === 'EMERGENCY' ? 'badge-emergency' : 'badge-normal'}">${i.severity}</span>`
          },
          { key: 'suggestedType', title: 'Loại xe / Kíp đề xuất', sortable: true, render: i => i.suggestedType || 'Type B' }
        ]
      }).render();

      container.querySelector('#btn-add-cat-incident')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Thêm tình huống', 'Mở cấu hình tình huống cấp cứu');
      });
    }

    renderCatStatusesView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <h2 style="color:var(--text-white);font-size:18px;margin-bottom:12px;">Cấu hình Danh mục Trạng thái (Xe & Ca Cấp cứu)</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">1. Danh mục Trạng thái Xe Cứu thương</h3>
              <ul style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-slate);list-style:none;padding:0;">
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>READY</strong> — Sẵn sàng xuất kích</span>
                  <span class="status-pill status-pill-completed">Sẵn sàng</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>DISPATCHED</strong> — Đã điều động tới hiện trường</span>
                  <span class="status-pill status-pill-processing">Đã điều động</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>ON_SCENE</strong> — Đang xử trí tại hiện trường</span>
                  <span class="status-pill status-pill-new">Tại hiện trường</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>TRANSPORTING</strong> — Đang vận chuyển về BV</span>
                  <span class="status-pill status-pill-new">Đang chở BN</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>MAINTENANCE</strong> — Đang bảo dưỡng / Nạp oxy</span>
                  <span class="status-pill status-pill-cancelled">Bảo trì</span>
                </li>
              </ul>
            </div>

            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">2. Danh mục Trạng thái Ca Cấp cứu</h3>
              <ul style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-slate);list-style:none;padding:0;">
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>NEW</strong> — Tiếp nhận cuộc gọi mới</span>
                  <span class="status-pill status-pill-new">Mới tạo</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>DISPATCHED</strong> — Đã phát lệnh điều xe</span>
                  <span class="status-pill status-pill-processing">Đã điều động</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>TRANSPORTING</strong> — Đang trên đường về BV</span>
                  <span class="status-pill status-pill-new">Đang chuyển</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>COMPLETED</strong> — Hoàn tất bàn giao cho BV</span>
                  <span class="status-pill status-pill-completed">Hoàn tất</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>CANCELLED</strong> — Hủy ca (có lý do)</span>
                  <span class="status-pill status-pill-cancelled">Đã hủy</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      `;
    }

    renderCatEquipmentView(container) {
      const state = window.StateManager.getState();
      const cats = state.categories || {};
      const eqs = cats.medicalEquipments || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:12px;">
            <h2 style="color:var(--text-white);font-size:18px;">Danh mục Trang Thiết bị trên Xe Cấp cứu</h2>
            <p style="font-size:12px;color:var(--text-muted);">Trang thiết bị y tế hồi sức, vali cấp cứu và máy khử rung tim trên xe</p>
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
        columns: [
          { key: 'id', title: 'Mã TB', sortable: true, render: eq => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${eq.id}</strong>` },
          { key: 'name', title: 'Tên thiết bị y tế', sortable: true, render: eq => `<strong>${eq.name}</strong>` },
          { key: 'unit', title: 'Đơn vị tính', sortable: true },
          { key: 'brand', title: 'Hãng sản xuất', sortable: true },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: () => `<span class="status-pill status-pill-completed">Hoạt động tốt</span>`
          }
        ]
      }).render();
    }

    renderCatCloseReasonsView(container) {
      const state = window.StateManager.getState();
      const reasons = state.terminationReasons || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Danh mục Lý do Kết thúc / Hủy ca</h2>
              <p style="font-size:12px;color:var(--text-muted);">Danh mục chuẩn hóa dùng khi kết thúc hoặc hủy ca cấp cứu trên hệ thống</p>
            </div>
            <button class="btn btn-default" id="btn-add-cat-reason">Thêm Lý do</button>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="cat-close-reasons-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'cat-close-reasons-table-mount',
        data: reasons,
        pageSize: 10,
        exportTitle: 'Danh mục Lý do Kết thúc Ca',
        searchPlaceholder: 'Tìm mã, nội dung lý do...',
        defaultSortKey: 'code',
        defaultSortOrder: 'asc',
        columns: [
          { key: 'code', title: 'Mã lý do', sortable: true, render: r => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${r.code}</strong>` },
          { key: 'name', title: 'Nội dung lý do kết thúc', sortable: true, render: r => `<strong>${r.name}</strong>` },
          {
            key: 'type',
            title: 'Nhóm lý do',
            sortable: true,
            render: r => `<span class="badge ${r.code.includes('CANCEL') || r.code.includes('DEAD') ? 'badge-emergency' : 'badge-normal'}">${r.code.includes('CANCEL') ? 'Hủy ca' : 'Hoàn tất'}</span>`
          }
        ]
      }).render();

      container.querySelector('#btn-add-cat-reason')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Thêm lý do', 'Mở biểu mẫu khai báo lý do kết thúc ca mới');
      });
    }

    renderCatTemplatesView(container) {
      const state = window.StateManager.getState();
      const templates = state.categories?.templates || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Cấu hình Mẫu biểu & Phiếu ePCR</h2>
              <p style="font-size:12px;color:var(--text-muted);">Quản lý phiên bản các biểu mẫu: Biên bản bàn giao, Phiếu cấp cứu ePCR, Biên bản từ chối</p>
            </div>
            <button class="btn btn-default" id="btn-add-cat-tpl">Tải lên Mẫu mới</button>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="cat-templates-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'cat-templates-table-mount',
        data: templates,
        pageSize: 10,
        exportTitle: 'Cấu hình Mẫu biểu',
        searchPlaceholder: 'Tìm mã, tên mẫu biểu...',
        defaultSortKey: 'id',
        defaultSortOrder: 'asc',
        columns: [
          { key: 'id', title: 'Mã mẫu', sortable: true, render: t => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${t.id}</strong>` },
          { key: 'name', title: 'Tên biểu mẫu', sortable: true, render: t => `<strong>${t.name}</strong>` },
          { key: 'version', title: 'Phiên bản', sortable: true, render: t => `<span class="badge badge-normal">${t.version}</span>` },
          { key: 'updatedAt', title: 'Ngày cập nhật', sortable: true },
          {
            key: 'actions',
            title: 'Thao tác',
            sortable: false,
            render: t => `<button class="btn btn-default btn-sm" onclick="window.CCNV_UI.Toast.show('Mẫu biểu', 'Xem chi tiết ${t.name}')">Xem mẫu</button>`
          }
        ]
      }).render();

      container.querySelector('#btn-add-cat-tpl')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Cấu hình mẫu biểu', 'Mở giao diện tải lên mẫu biểu chuẩn Bộ Y Tế');
      });
    }

    // ==========================================
    // --- 8. QUẢN TRỊ HỆ THỐNG (SITEMAP 8.1) ---
    // ==========================================
    renderAdminUsersView(container) {
      const state = window.StateManager.getState();
      const accounts = state.accounts || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Quản lý Tài khoản Người dùng</h2>
              <p style="font-size:12px;color:var(--text-muted);">Quản trị tài khoản Điều phối viên, Bác sĩ Khoa Cấp cứu BV và Kíp xe cấp cứu</p>
            </div>
            <button class="btn btn-emergency" id="btn-add-admin-user">Tạo Tài Khoản Mới</button>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="admin-users-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'admin-users-table-mount',
        data: accounts,
        pageSize: 10,
        exportTitle: 'Danh sách Người dùng Hệ thống',
        searchPlaceholder: 'Tìm tên đăng nhập, họ tên, vai trò, đơn vị...',
        defaultSortKey: 'id',
        defaultSortOrder: 'asc',
        columns: [
          { key: 'username', title: 'Tài khoản', sortable: true, render: u => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${u.username}</strong>` },
          { key: 'fullName', title: 'Họ và tên', sortable: true, render: u => `<strong>${u.fullName}</strong>` },
          { key: 'roleName', title: 'Vai trò', sortable: true, render: u => `<span class="badge ${u.role === 'DISPATCHER' ? 'badge-emergency' : 'badge-normal'}">${u.roleName}</span>` },
          { key: 'organization', title: 'Đơn vị công tác', sortable: true, render: u => u.organization },
          { key: 'badge', title: 'Phù hiệu trực', sortable: false, render: u => u.badge || 'Trực ban' },
          {
            key: 'actions',
            title: 'Thao tác',
            sortable: false,
            render: u => `
              <button class="btn btn-default btn-sm" onclick="window.CCNV_UI.Toast.show('Quản lý tài khoản', 'Đặt lại mật khẩu cho ${u.username}')">Đổi MK</button>
            `
          }
        ]
      }).render();

      container.querySelector('#btn-add-admin-user')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Tạo tài khoản', 'Mở biểu mẫu khởi tạo tài khoản cán bộ y tế mới');
      });
    }

    renderAdminRolesView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <h2 style="color:var(--text-white);font-size:18px;margin-bottom:12px;">Phân quyền Vai trò & Đơn vị</h2>
          <div class="content-card">
            <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Ma trận Phân quyền Chức năng Hệ thống</h3>
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:12.5px;color:var(--text-slate);">
                <thead>
                  <tr style="background:var(--bg-elevated);color:var(--text-white);border-bottom:1px solid var(--border-main);">
                    <th style="padding:10px;text-align:left;">Chức năng / Quyền hạn</th>
                    <th style="padding:10px;text-align:center;">Điều phối viên chính</th>
                    <th style="padding:10px;text-align:center;">Điều phối viên trực</th>
                    <th style="padding:10px;text-align:center;">Bác sĩ Cấp cứu BV</th>
                    <th style="padding:10px;text-align:center;">Kíp xe cấp cứu</th>
                    <th style="padding:10px;text-align:center;">Quản trị viên (Admin)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;font-weight:600;color:var(--text-white);">Tiếp nhận cuộc gọi 115 & Nhập thông tin</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                    <td style="text-align:center;color:#64748B;">- Không</td>
                    <td style="text-align:center;color:#64748B;">- Không</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                  </tr>
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;font-weight:600;color:var(--text-white);">Tạo ca & Phát lệnh điều xe cấp cứu</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                    <td style="text-align:center;color:#64748B;">- Không</td>
                    <td style="text-align:center;color:#64748B;">- Không</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                  </tr>
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;font-weight:600;color:var(--text-white);">Ký xác nhận Bàn giao Bệnh nhân</td>
                    <td style="text-align:center;color:#64748B;">- Xem</td>
                    <td style="text-align:center;color:#64748B;">- Xem</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                    <td style="text-align:center;color:#10B981;">✔ Ký giao</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                  </tr>
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;font-weight:600;color:var(--text-white);">Cập nhật Trạng thái Tiếp nhận Bệnh viện</td>
                    <td style="text-align:center;color:#64748B;">- Xem</td>
                    <td style="text-align:center;color:#64748B;">- Xem</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                    <td style="text-align:center;color:#64748B;">- Không</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                  </tr>
                  <tr>
                    <td style="padding:10px;font-weight:600;color:var(--text-white);">Cấu hình Danh mục, Xe & Người dùng</td>
                    <td style="text-align:center;color:#64748B;">- Xem</td>
                    <td style="text-align:center;color:#64748B;">- Xem</td>
                    <td style="text-align:center;color:#64748B;">- Không</td>
                    <td style="text-align:center;color:#64748B;">- Không</td>
                    <td style="text-align:center;color:#10B981;">✔ Toàn quyền</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    renderAdminAuditView(container) {
      const state = window.StateManager.getState();
      const logs = state.auditLogs || [];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:12px;">
            <h2 style="color:var(--text-white);font-size:18px;">Quản trị Hệ thống & Nhật ký Thao tác (Audit Log)</h2>
            <p style="font-size:12px;color:var(--text-muted);">Nhật ký kiểm toán ghi nhận toàn bộ thao tác của Điều phối viên, Bệnh viện và Kíp trực</p>
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

    renderAdminBackupView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Sao lưu & Khôi phục Dữ liệu Hệ thống</h2>
              <p style="font-size:12px;color:var(--text-muted);">Chính sách sao lưu snapshot tự động và cơ chế khôi phục dữ liệu điều hành</p>
            </div>
            <button class="btn btn-emergency" id="btn-create-backup-now">Tạo Bản Sao Lưu Ngay</button>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Cấu hình Sao lưu Tự động</h3>
              <div style="font-size:13px;display:flex;flex-direction:column;gap:8px;color:var(--text-slate);">
                <div>Lịch sao lưu: <strong style="color:var(--text-white);">Hàng ngày vào 02:00:00 (Ban đêm)</strong></div>
                <div>Lưu trữ đám mây: <strong style="color:#10B981;">Data Center Sở Y Tế TP Cần Thơ (Đã kết nối)</strong></div>
                <div>Thời gian lưu giữ: <strong style="color:var(--text-white);">10 năm (Theo quy định Bộ Y Tế cho hồ sơ cấp cứu)</strong></div>
                <div>Mã hóa: <strong style="color:#93C5FD;">AES-256 GCM</strong></div>
              </div>
            </div>

            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Các bản Sao lưu Gần nhất</h3>
              <ul style="display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--text-slate);list-style:none;padding:0;">
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <div>
                    <strong style="color:var(--text-white);">SNAPSHOT-20261002-020000</strong>
                    <div style="font-size:11px;color:var(--text-muted);">Hôm nay 02:00 · 14.8 MB · Toàn vẹn 100%</div>
                  </div>
                  <button class="btn btn-default btn-sm btn-restore-snap" data-snap="SNAPSHOT-20261002-020000">Khôi phục</button>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <div>
                    <strong style="color:var(--text-white);">SNAPSHOT-20261001-020000</strong>
                    <div style="font-size:11px;color:var(--text-muted);">Hôm qua 02:00 · 14.2 MB · Toàn vẹn 100%</div>
                  </div>
                  <button class="btn btn-default btn-sm btn-restore-snap" data-snap="SNAPSHOT-20261001-020000">Khôi phục</button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-create-backup-now')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Đang sao lưu...', 'Đã tạo thành công bản sao lưu SNAPSHOT-' + Date.now());
        window.StateManager.addAuditLog('Tạo bản sao lưu dữ liệu hệ thống thủ công');
      });

      container.querySelectorAll('.btn-restore-snap').forEach(btn => {
        btn.addEventListener('click', () => {
          const snap = btn.getAttribute('data-snap');
          window.CCNV_UI.Toast.show('Khôi phục dữ liệu', `Đã đồng bộ kiểm tra snapshot ${snap}`);
        });
      });
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

    renderReceivingIncomingView(container) {
      this.renderHospitalIncomingView(container);
    }

    renderHospitalReportsView(container) {
      this.renderHospitalReportDetailView(container);
    }

    renderHospitalReceptionStatusView(container) {
      const state = window.StateManager.getState();
      const currentUser = window.StateManager.getCurrentUser();
      const myHospId = currentUser?.hospitalId || 'HOSP_BVDK';
      const hosp = state.hospitals.find(h => h.id === myHospId) || state.hospitals[0];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:14px;">
            <h2 style="color:var(--text-white);font-size:18px;">Cập nhật Trạng thái Tiếp nhận — ${hosp.name}</h2>
            <p style="font-size:12px;color:var(--text-muted);">
              Cập nhật trạng thái nhận bệnh ngoại viện: Đang nhận / Hạn chế / Tạm ngưng (không chặn cuộc gọi hay điều phối nhưng cảnh báo cho ĐPV)
            </p>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="content-card" style="padding:18px;">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:14px;">Chọn Trạng thái Tiếp nhận Bệnh viện</h3>

              <div style="display:flex;flex-direction:column;gap:12px;">
                <label style="display:flex;align-items:center;gap:12px;padding:12px;background:${hosp.status === 'READY' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-elevated)'};border:2px solid ${hosp.status === 'READY' ? '#10B981' : 'var(--border-main)'};border-radius:8px;cursor:pointer;">
                  <input type="radio" name="hosp-status-opt" value="READY" ${hosp.status === 'READY' ? 'checked' : ''} style="width:16px;height:16px;" />
                  <div>
                    <strong style="color:#10B981;font-size:13.5px;display:block;"> ĐANG TIẾP NHẬN BÌNH THƯỜNG</strong>
                    <span style="font-size:12px;color:var(--text-slate);">Khoa Cấp cứu và các buồng hồi sức sẵn sàng đón mọi ca cấp cứu</span>
                  </div>
                </label>

                <label style="display:flex;align-items:center;gap:12px;padding:12px;background:${hosp.status === 'LIMITED' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-elevated)'};border:2px solid ${hosp.status === 'LIMITED' ? '#F59E0B' : 'var(--border-main)'};border-radius:8px;cursor:pointer;">
                  <input type="radio" name="hosp-status-opt" value="LIMITED" ${hosp.status === 'LIMITED' ? 'checked' : ''} style="width:16px;height:16px;" />
                  <div>
                    <strong style="color:#F59E0B;font-size:13.5px;display:block;">HẠN CHẾ TIẾP NHẬN (CẢNH BÁO)</strong>
                    <span style="font-size:12px;color:var(--text-slate);">Giường hồi sức cấp cứu đạt trên 90%, chỉ nhận ca tối khẩn nguy kịch</span>
                  </div>
                </label>

                <label style="display:flex;align-items:center;gap:12px;padding:12px;background:${hosp.status === 'SUSPENDED' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-elevated)'};border:2px solid ${hosp.status === 'SUSPENDED' ? 'var(--red-vivid)' : 'var(--border-main)'};border-radius:8px;cursor:pointer;">
                  <input type="radio" name="hosp-status-opt" value="SUSPENDED" ${hosp.status === 'SUSPENDED' ? 'checked' : ''} style="width:16px;height:16px;" />
                  <div>
                    <strong style="color:var(--red-vivid);font-size:13.5px;display:block;">TẠM NGƯNG TIẾP NHẬN NGOẠI VIỆN</strong>
                    <span style="font-size:12px;color:var(--text-slate);">Khoa Cấp cứu đang quá tải đột xuất hoặc có sự cố kỹ thuật nội bộ</span>
                  </div>
                </label>
              </div>

              <div class="form-field" style="margin-top:14px;">
                <label class="form-label">Lý do thay đổi trạng thái / Ghi chú gửi ĐPV</label>
                <textarea id="hosp-status-reason" rows="2" placeholder="Ví dụ: Khoa đang tiếp nhận đồng thời 4 ca TNGT nặng, đề nghị điều phối ca tiếp theo sang BVĐK Trung ương..."></textarea>
              </div>

              <div style="margin-top:16px;display:flex;justify-content:flex-end;">
                <button class="btn btn-emergency btn-lg" id="btn-save-hosp-status">
                  ${window.CCNV_UI.ICONS.check}
                  <span>Lưu & Cập nhật Toàn Mạng lưới</span>
                </button>
              </div>
            </div>

            <!-- Current Network Status Display -->
            <div class="content-card" style="padding:18px;">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Tình hình Tiếp nhận Hiện tại trên Bản đồ Điều phối</h3>
              <div style="background:var(--bg-elevated);padding:14px;border-radius:6px;border:1px solid var(--border-main);margin-bottom:14px;font-size:13px;">
                <div style="margin-bottom:6px;">Bệnh viện: <strong style="color:var(--text-white);">${hosp.name}</strong></div>
                <div style="margin-bottom:6px;">Trạng thái hiện hành: <span class="badge ${hosp.status === 'READY' ? 'badge-normal' : 'badge-emergency'}">${hosp.statusText || 'Đang nhận'}</span></div>
                <div style="margin-bottom:6px;">Số giường hồi sức cấp cứu: <strong style="color:#93C5FD;">${hosp.capacity?.icuBeds || 12} giường</strong></div>
                <div>Giường trống sẵn sàng: <strong style="color:#10B981;">${hosp.capacity?.availableBeds || 3} giường</strong></div>
              </div>

              <div style="font-size:12px;color:var(--text-muted);line-height:1.5;">
                * Lưu ý quy chế vận hành: Khi chuyển sang <em>Tạm ngưng tiếp nhận</em>, hệ thống CCNV sẽ hiển thị cảnh báo đỏ trên bản đồ của Điều phối viên 115 và gợi ý chuyển bệnh nhân tới bệnh viện lân cận phù hợp nhất.
              </div>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-save-hosp-status')?.addEventListener('click', () => {
        const selected = container.querySelector('input[name="hosp-status-opt"]:checked')?.value || 'READY';
        const reason = container.querySelector('#hosp-status-reason').value;
        const text = selected === 'READY' ? 'Đang nhận' : selected === 'LIMITED' ? 'Hạn chế' : 'Tạm ngưng';

        hosp.status = selected;
        hosp.statusText = text;
        window.StateManager.saveToSession();
        window.StateManager.addAuditLog(`${hosp.name} cập nhật trạng thái tiếp nhận thành: ${text} (${reason || 'Không có ghi chú'})`);
        window.CCNV_UI.Toast.show('Đã cập nhật trạng thái', `Đã đồng bộ trạng thái ${text} của ${hosp.name} lên Trung tâm Điều hành 115`);
        this.renderHospitalReceptionStatusView(container);
      });
    }

    renderHospitalSpecialtyView(container) {
      const state = window.StateManager.getState();
      const currentUser = window.StateManager.getCurrentUser();
      const myHospId = currentUser?.hospitalId || 'HOSP_BVDK';
      const hosp = state.hospitals.find(h => h.id === myHospId) || state.hospitals[0];

      container.innerHTML = `
        <div class="view-container-full">
          <div style="margin-bottom:14px;">
            <h2 style="color:var(--text-white);font-size:18px;">Khai báo Chuyên khoa & Năng lực Tiếp nhận — ${hosp.name}</h2>
            <p style="font-size:12px;color:var(--text-muted);">
              Công bố năng lực hồi sức cấp cứu, can thiệp tim mạch và phẫu thuật để Trung tâm 115 điều phối chính xác bệnh viện đích
            </p>
          </div>

          <div class="content-card" style="padding:18px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
              <!-- 1. Cấp cứu & ICU -->
              <div class="form-section">
                <div class="form-section-title">1. Khoa Cấp cứu & Hồi sức Tích cực (ICU)</div>
                <div class="form-grid-2">
                  <div class="form-field">
                    <label class="form-label">Số giường Cấp cứu đang mở</label>
                    <input type="number" id="spec-er-beds" value="20" />
                  </div>
                  <div class="form-field">
                    <label class="form-label">Giường Cấp cứu còn trống</label>
                    <input type="number" id="spec-er-avail" value="4" />
                  </div>
                </div>
                <div class="form-grid-2" style="margin-top:10px;">
                  <div class="form-field">
                    <label class="form-label">Tổng giường Hồi sức ICU</label>
                    <input type="number" id="spec-icu-beds" value="12" />
                  </div>
                  <div class="form-field">
                    <label class="form-label">Máy thở xách tay & thở máy sẵn sàng</label>
                    <input type="number" id="spec-ventilators" value="3" />
                  </div>
                </div>
              </div>

              <!-- 2. Tim mạch & Đột quỵ -->
              <div class="form-section">
                <div class="form-section-title">2. Can thiệp Tim mạch & Đột quỵ não (DSA)</div>
                <div class="form-field" style="margin-bottom:10px;">
                  <label class="form-label">Phòng can thiệp mạch máu (DSA)</label>
                  <select id="spec-dsa-status">
                    <option value="READY" selected>🟢 Sẵn sàng 24/7 (Kíp trực đang sẵn sàng tiếp nhận)</option>
                    <option value="BUSY">🟡 Đang thực hiện ca can thiệp (Chờ 45 phút)</option>
                    <option value="UNAVAILABLE">🔴 Tạm ngưng can thiệp</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">Thuốc tiêu sợi huyết (Alteplase) cấp cứu</label>
                  <select id="spec-thrombolytic">
                    <option value="YES" selected>Có sẵn trong tủ thuốc cấp cứu</option>
                    <option value="NO">Hết cơ số</option>
                  </select>
                </div>
              </div>

              <!-- 3. Ngoại Chấn thương & Phẫu thuật -->
              <div class="form-section">
                <div class="form-section-title">3. Ngoại Chấn thương & Phẫu thuật Cấp cứu</div>
                <div class="form-grid-2">
                  <div class="form-field">
                    <label class="form-label">Phòng mổ cấp cứu sẵn sàng</label>
                    <input type="number" id="spec-or-avail" value="2" />
                  </div>
                  <div class="form-field">
                    <label class="form-label">Kíp phẫu thuật Ngoại thần kinh / Lồng ngực</label>
                    <select id="spec-neuro-surgeons">
                      <option value="ON_SITE" selected>Đang trực tại viện</option>
                      <option value="ON_CALL">Trực On-call (15 phút)</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- 4. Sản - Nhi Cấp cứu -->
              <div class="form-section">
                <div class="form-section-title">4. Khả năng Tiếp nhận Sản - Nhi</div>
                <div class="form-grid-2">
                  <div class="form-field">
                    <label class="form-label">Cấp cứu Sản - Đỡ đẻ khẩn cấp</label>
                    <select id="spec-ob-status">
                      <option value="READY" selected>Sẵn sàng tiếp nhận</option>
                      <option value="TRANSFER">Đề nghị chuyển viện Chuyên khoa Sản</option>
                    </select>
                  </div>
                  <div class="form-field">
                    <label class="form-label">Hồi sức Sơ sinh (NICU)</label>
                    <select id="spec-peds-status">
                      <option value="READY" selected>Sẵn sàng lồng ấp sơ sinh</option>
                      <option value="TRANSFER">Đề nghị chuyển BV Nhi đồng Cần Thơ</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div style="margin-top:20px;display:flex;justify-content:flex-end;border-top:1px solid var(--border-main);padding-top:16px;">
              <button class="btn btn-emergency btn-lg" id="btn-save-specialty-info">
                ${window.CCNV_UI.ICONS.check}
                <span>Cập nhật & Công bố Năng lực Chuyên khoa</span>
              </button>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-save-specialty-info')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Đã công bố năng lực', `Đã cập nhật dữ liệu năng lực chuyên khoa của ${hosp.name} tới Trung tâm Điều hành 115 Cần Thơ`);
        window.StateManager.addAuditLog(`${hosp.name} cập nhật năng lực chuyên khoa: ICU trống 4 giường, DSA sẵn sàng, 2 phòng mổ cấp cứu`);
      });
    }

    renderHospitalReportDetailView(container) {
      const state = window.StateManager.getState();
      const currentUser = window.StateManager.getCurrentUser();
      const myHospId = currentUser?.hospitalId || 'HOSP_BVDK';
      const history = (state.historyCases || []).filter(h => h.hospitalId === myHospId || !h.hospitalId);

      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="color:var(--text-white);font-size:18px;">Báo cáo Chi tiết Ca Bệnh viện đã Tiếp nhận</h2>
              <p style="font-size:12px;color:var(--text-muted);">Danh sách toàn bộ các ca cấp cứu ngoại viện được chuyển đến Khoa Cấp cứu</p>
            </div>
            <button class="btn btn-default" id="btn-export-hosp-report">Xuất Báo cáo (Excel / PDF)</button>
          </div>
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="hosp-report-detail-table-mount"></div>
          </div>
        </div>
      `;

      new window.CCNV_UI.DataTable({
        containerId: 'hosp-report-detail-table-mount',
        data: history,
        pageSize: 10,
        exportTitle: 'Danh sách Ca đã Tiếp nhận Bệnh viện',
        searchPlaceholder: 'Tìm mã ca, bệnh nhân, chẩn đoán, xe chuyển...',
        defaultSortKey: 'createdAt',
        defaultSortOrder: 'desc',
        columns: [
          { key: 'code', title: 'Mã ca', sortable: true, render: h => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${h.code}</strong>` },
          { key: 'createdAt', title: 'Thời điểm đến', sortable: true, render: h => h.createdAt.replace('T', ' ') },
          { key: 'patientName', title: 'Bệnh nhân', sortable: true, render: h => `<strong>${h.patientName}</strong> (${h.patientAge}T)` },
          { key: 'incidentName', title: 'Chẩn đoán sơ bộ', sortable: true },
          { key: 'vehiclePlate', title: 'Xe chuyển đến', sortable: true, render: h => `<span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">${h.vehiclePlate}</span>` },
          { key: 'doctor', title: 'Bác sĩ tiếp nhận', sortable: false, render: () => `BS. Lê Hoàng Long` },
          {
            key: 'status',
            title: 'Trạng thái',
            sortable: true,
            render: () => `<span class="status-pill status-pill-completed">Đã tiếp nhận</span>`
          }
        ]
      }).render();

      container.querySelector('#btn-export-hosp-report')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Xuất báo cáo', 'Đã tải xuống danh sách ca tiếp nhận cấp cứu ngoại viện');
      });
    }

    renderHospitalReportStatsView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <h2 style="color:var(--text-white);font-size:18px;margin-bottom:12px;">Báo cáo Thống kê Tiếp nhận Bệnh viện</h2>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px;">
            <div class="kpi-card">
              <span class="kpi-label">Số ca tiếp nhận trong tuần</span>
              <span class="kpi-value">28 ca</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Ca tối khẩn (Đỏ) tiếp nhận</span>
              <span class="kpi-value" style="color:var(--red-vivid);">12 ca</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Thời gian bàn giao TB (Handover)</span>
              <span class="kpi-value" style="color:#10B981;">4.5 phút</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Tỷ lệ cảnh báo trước từ 115</span>
              <span class="kpi-value">100%</span>
            </div>
          </div>

          <div class="content-card" style="margin-top:16px;">
            <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Phân loại hướng xử trí sau bàn giao cấp cứu ngoại viện</h3>
            <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;text-align:center;">
              <div style="background:var(--bg-elevated);padding:14px;border-radius:6px;border:1px solid var(--border-main);">
                <div style="font-size:20px;font-weight:700;color:#93C5FD;margin-bottom:4px;">28%</div>
                <div style="font-size:12px;color:var(--text-slate);">Nhập viện Hồi sức Tích cực (ICU)</div>
              </div>
              <div style="background:var(--bg-elevated);padding:14px;border-radius:6px;border:1px solid var(--border-main);">
                <div style="font-size:20px;font-weight:700;color:var(--red-vivid);margin-bottom:4px;">22%</div>
                <div style="font-size:12px;color:var(--text-slate);">Chuyển thẳng Phòng Mổ Cấp Cứu</div>
              </div>
              <div style="background:var(--bg-elevated);padding:14px;border-radius:6px;border:1px solid var(--border-main);">
                <div style="font-size:20px;font-weight:700;color:#10B981;margin-bottom:4px;">36%</div>
                <div style="font-size:12px;color:var(--text-slate);">Theo dõi & Điều trị tại Khoa CC</div>
              </div>
              <div style="background:var(--bg-elevated);padding:14px;border-radius:6px;border:1px solid var(--border-main);">
                <div style="font-size:20px;font-weight:700;color:#F59E0B;margin-bottom:4px;">14%</div>
                <div style="font-size:12px;color:var(--text-slate);">Chuyển Viện Tuyến Trên</div>
              </div>
            </div>
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
                <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;">
                  <span>Phân loại mức độ khẩn</span>
                  <span style="font-size:11px;color:var(--text-muted);">Bấm phím <kbd class="quick-kbd">1</kbd> <kbd class="quick-kbd">2</kbd> <kbd class="quick-kbd">3</kbd></span>
                </label>
                <div class="severity-picker-grid">
                  <button type="button" class="severity-btn active sev-critical" data-sev="CRITICAL">
                    <kbd class="quick-kbd kbd-red" style="margin-right:4px;">1</kbd> TỐI KHẨN (ĐỎ)
                  </button>
                  <button type="button" class="severity-btn sev-emergency" data-sev="EMERGENCY">
                    <kbd class="quick-kbd kbd-amber" style="margin-right:4px;">2</kbd> KHẨN CẤP (CAM)
                  </button>
                  <button type="button" class="severity-btn sev-routine" data-sev="ROUTINE">
                    <kbd class="quick-kbd kbd-emerald" style="margin-right:4px;">3</kbd> THƯỜNG (XANH)
                  </button>
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
          window.CCNV_UI.SoundFx.playBeep();
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
        } else if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
          if (e.key === '1') {
            e.preventDefault();
            drawerOverlay.querySelector('.severity-btn[data-sev="CRITICAL"]')?.click();
          } else if (e.key === '2') {
            e.preventDefault();
            drawerOverlay.querySelector('.severity-btn[data-sev="EMERGENCY"]')?.click();
          } else if (e.key === '3') {
            e.preventDefault();
            drawerOverlay.querySelector('.severity-btn[data-sev="ROUTINE"]')?.click();
          }
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
      let c = state.cases.find(item => item.id === caseId || item.code === caseId);
      if (!c && state.historyCases) {
        const h = state.historyCases.find(item => item.id === caseId || item.code === caseId);
        if (h) {
          c = {
            id: h.id,
            code: h.code,
            createdAt: h.createdAt,
            completedAt: h.completedAt,
            status: h.status,
            statusText: h.statusText || 'Hoàn tất',
            patient: { name: h.patientName, age: h.patientAge || '—', gender: h.patientGender || 'Nam', history: 'Không có tiền sử dị ứng' },
            location: { address: h.locationAddress || 'Khu vực TP Cần Thơ' },
            incident: { name: h.incidentName, severity: h.severity || 'ROUTINE', description: 'Đã hoàn tất vận chuyển và bàn giao người bệnh' },
            dispatch: { vehiclePlate: h.vehiclePlate || '—', crewName: h.crewName || 'Kíp trực 115', hospitalName: h.hospitalName || '—' },
            epcr: h.epcr || { chiefComplaint: h.incidentName, diagnosis: h.incidentName, treatment: 'Sơ cứu tại hiện trường và hỗ trợ hô hấp, huyết động trên đường vận chuyển.' },
            milestones: [
              { name: 'Tiếp nhận cuộc gọi', time: h.createdAt ? h.createdAt.replace('T', ' ') : '—', done: true },
              { name: 'Xuất phát', time: '—', done: true },
              { name: 'Đến hiện trường', time: '—', done: true },
              { name: 'Bàn giao tại viện', time: h.completedAt ? h.completedAt.replace('T', ' ') : '—', done: true }
            ],
            logs: [
              { time: h.createdAt ? h.createdAt.replace('T', ' ') : '—', user: 'dpv01', action: `Tiếp nhận yêu cầu và phát lệnh điều xe ${h.vehiclePlate || ''}` },
              { time: h.completedAt ? h.completedAt.replace('T', ' ') : '—', user: 'Khoa Cấp cứu', action: `Bàn giao bệnh nhân tại ${h.hospitalName || 'Bệnh viện'}. Hoàn tất ca.` }
            ]
          };
        }
      }
      c = c || state.cases[0];
      if (!c) return;

      this.selectedCaseId = c.id;
      let modalOverlay = document.getElementById('case-detail-modal-overlay');
      if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'case-detail-modal-overlay';
        modalOverlay.className = 'modal-overlay';
        document.body.appendChild(modalOverlay);
      }

      // Helper format date time
      const formatDT = (dtStr, fallbackTime = '08:10:15') => {
        if (!dtStr) return `02/10/2026 - ${fallbackTime}`;
        if (dtStr.includes('T')) {
          const parts = dtStr.split('T');
          const dParts = parts[0].split('-');
          const t = parts[1].slice(0, 8);
          return `${dParts[2]}/${dParts[1]}/${dParts[0]} - ${t}`;
        }
        if (dtStr.includes(':') && !dtStr.includes('/')) {
          return `02/10/2026 - ${dtStr}`;
        }
        return dtStr;
      };

      const callTime = formatDT(c.createdAt, '08:10:15');
      const callTimeRaw = c.createdAt?.includes('T') ? c.createdAt.split('T')[1].slice(0, 8) : (c.createdAt || '08:10:15');
      const dispatchTime = formatDT(c.milestones?.find(m => m.step === 'DISPATCHED')?.time, '08:11:30');
      const endTime = c.status === 'COMPLETED'
        ? formatDT(c.completedAt || c.milestones?.find(m => m.step === 'HANDOVER_DONE')?.time, '08:45:00')
        : (c.status === 'CANCELLED' ? `Đã hủy ca (${c.cancelReason || 'Theo yêu cầu'})` : '<span class="badge badge-warning" style="animation:pulse 2s infinite;padding:2px 8px;font-size:11px;">Đang xử lý cấp cứu</span>');

      const receiverName = c.hospitalReceiver || `BS. Trực Cấp cứu (${c.dispatch?.hospitalName || 'BV Đa khoa TP Cần Thơ'})`;

      let processingResult = '';
      if (c.status === 'COMPLETED') {
        processingResult = `<span style="color:var(--emerald-light);font-weight:600;">✓ Tiếp nhận an toàn tại Khoa Cấp cứu</span>`;
      } else if (c.status === 'CANCELLED') {
        processingResult = `<span style="color:var(--red-light);font-weight:600;">✗ Đã hủy: ${c.cancelReason || 'Hủy theo yêu cầu'}</span>`;
      } else if (c.status === 'TRANSPORTING') {
        processingResult = `<span style="color:var(--amber-light);font-weight:600;">⟳ Đang vận chuyển khẩn cấp đến BV (ETA: ${c.eta || '6 phút'})</span>`;
      } else {
        processingResult = `<span style="color:var(--blue-light);font-weight:600;">⟳ Đang tiếp cận & sơ cứu ban đầu</span>`;
      }

      // Crews info
      const crewObj = (state.crews || []).find(cr => cr.id === c.dispatch?.crewId || cr.name === c.dispatch?.crewName) || {
        name: c.dispatch?.crewName || 'Kíp 1 - Ninh Kiều',
        doctor: 'BS. CKI. Nguyễn Văn Thành',
        nurse: 'ĐD. Trần Thị Mai',
        driver: 'Lê Văn Hùng'
      };

      modalOverlay.innerHTML = `
        <div class="modal-box" style="position:fixed;inset:0;width:100vw;height:100vh;max-width:100vw;max-height:100vh;border-radius:0;border:none;display:flex;flex-direction:column;background:var(--bg-panel);overflow:hidden;z-index:10001;">
          <!-- 1. MODAL HEADER CHUẨN COMMAND CENTER (FULL WIDTH) -->
          <div class="modal-header" style="flex-shrink:0;padding:12px 24px;background:linear-gradient(90deg, #091726 0%, #0d2138 100%);border-bottom:1px solid var(--border-accent);display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
              <div style="width:34px;height:34px;border-radius:8px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);display:flex;align-items:center;justify-content:center;color:#ef4444;">
                ${window.CCNV_UI.ICONS.activity || '🚑'}
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:10px;">
                  <strong style="color:var(--text-white);font-size:17px;letter-spacing:0.8px;font-family:var(--font-mono);">HỒ SƠ CHI TIẾT CA CẤP CỨU: ${c.code}</strong>
                  ${window.CCNV_UI.Badges.forCaseStatus(c.status)}
                  <span class="badge ${c.incident?.severity === 'CRITICAL' ? 'badge-emergency' : 'badge-amber'}" style="font-weight:700;letter-spacing:0.5px;">
                    ${c.incident?.severity === 'CRITICAL' ? '● TỐI KHẨN (ĐỎ)' : '● KHẨN CẤP (CAM)'}
                  </span>
                </div>
                <div style="font-size:11px;color:var(--text-slate);margin-top:2px;">
                  Hệ thống Điều phối Cấp cứu 115 · Trung tâm Thông tin Y tế Ngoại viện TP. Cần Thơ · Phiên bản đồng bộ ePCR Realtime
                </div>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:12px;">
              <button class="btn btn-ghost btn-sm" id="btn-call-audio-quick" title="Bản ghi âm 115" style="border:1px solid var(--border-main);background:rgba(255,255,255,0.03);">
                📞 Ghi âm tiếp nhận (${callTimeRaw})
              </button>
              <button class="btn btn-ghost btn-sm" id="btn-close-case-modal" title="Đóng toàn màn hình (Esc)" style="width:32px;height:32px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:6px;background:rgba(255,255,255,0.06);color:var(--text-white);">
                ${window.CCNV_UI.ICONS.x}
              </button>
            </div>
          </div>

          <!-- 2. PHẦN TỔNG QUAN: BẢN ĐỒ RADAR RỘNG + KHUNG 7 THÔNG TIN TỔNG QUAN 4 CỘT -->
          <!-- 2. PHẦN TỔNG QUAN: KHUNG 7 THÔNG TIN TỔNG QUAN ĐIỀU HÀNH (TRẢI ĐỀU 100% CHIỀU NGANG) -->
          <div style="flex-shrink:0;background:var(--bg-panel);border-bottom:1px solid var(--border-main);padding:14px 24px;">
            <div style="background:var(--bg-elevated);border-radius:8px;border:1px solid var(--border-main);padding:12px 20px;">
              <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-main);padding-bottom:8px;margin-bottom:10px;">
                <div style="font-size:13px;font-weight:700;color:var(--text-white);text-transform:uppercase;letter-spacing:0.6px;display:flex;align-items:center;gap:8px;">
                  <span style="color:var(--accent-cyan);font-size:14px;">✦</span> THÔNG TIN TỔNG QUAN ĐIỀU HÀNH CA CẤP CỨU
                </div>
                <div style="display:flex;align-items:center;gap:14px;">
                  <span style="font-size:11.5px;color:var(--text-muted);">Mã cuộc gọi: <strong style="color:var(--text-white);font-family:var(--font-mono);">${c.callId || 'CALL-115-01'}</strong></span>
                  <span style="font-size:11.5px;color:var(--text-muted);">· Mã phiên ePCR: <strong style="color:var(--accent-cyan);font-family:var(--font-mono);">${c.epcr?.id || 'EPCR-2610-09'}</strong></span>
                </div>
              </div>

              <!-- Lưới 4 cột rộng rãi cho 7 thông tin tổng quan -->
              <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px 24px;font-size:12px;">
                <!-- Cột 1: Cuộc gọi & Người tiếp nhận -->
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div>
                    <span style="color:var(--text-slate);font-size:11px;display:block;">1. Thời điểm phát hiện cuộc gọi:</span>
                    <strong style="color:var(--text-white);font-family:var(--font-mono);font-size:13px;">${callTime}</strong>
                  </div>
                  <div>
                    <span style="color:var(--text-slate);font-size:11px;display:block;">2. Người tiếp nhận:</span>
                    <strong style="color:var(--text-white);font-size:12.5px;">${c.dispatch?.dispatcherName || 'Nguyễn Văn An'}</strong>
                    <div style="color:var(--text-muted);font-size:10.5px;font-family:var(--font-mono);">(${c.dispatch?.dispatcherId || 'dpv01'} · Tổng đài 115)</div>
                  </div>
                </div>

                <!-- Cột 2: Thời gian gọi xe & Xe được điều động -->
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div>
                    <span style="color:var(--text-slate);font-size:11px;display:block;">3. Thời gian gọi xe:</span>
                    <strong style="color:var(--text-white);font-family:var(--font-mono);font-size:13px;">${dispatchTime}</strong>
                  </div>
                  <div>
                    <span style="color:var(--text-slate);font-size:11px;display:block;">4. Xe được điều động:</span>
                    <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                      <span class="badge badge-accent" style="font-family:var(--font-mono);font-weight:700;font-size:12px;">${c.dispatch?.vehiclePlate || '65A-012.34'}</span>
                      <span style="color:var(--text-light);font-size:11.5px;">(${c.dispatch?.crewName || crewObj.name})</span>
                    </div>
                  </div>
                </div>

                <!-- Cột 3: Bệnh viện tiếp nhận & Người nhận -->
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div>
                    <span style="color:var(--text-slate);font-size:11px;display:block;">Bệnh viện tiếp nhận:</span>
                    <strong style="color:var(--text-white);font-size:12.5px;">${c.dispatch?.hospitalName || 'BV Đa khoa TP Cần Thơ'}</strong>
                  </div>
                  <div>
                    <span style="color:var(--text-slate);font-size:11px;display:block;">6. Người nhận tại viện:</span>
                    <strong style="color:var(--text-white);font-size:12px;">${receiverName}</strong>
                  </div>
                </div>

                <!-- Cột 4: Thời gian kết thúc & Kết quả xử lý -->
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div>
                    <span style="color:var(--text-slate);font-size:11px;display:block;">5. Thời gian kết thúc:</span>
                    <div style="font-family:var(--font-mono);font-size:12.5px;">${endTime}</div>
                  </div>
                  <div>
                    <span style="color:var(--text-slate);font-size:11px;display:block;">7. Kết quả xử lý:</span>
                    <div style="font-size:12px;margin-top:1px;">${processingResult}</div>
                  </div>
                </div>
              </div>

              <!-- Thanh chỉ số tiến độ thời gian thực của ca -->
              <div style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--border-main);display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-slate);">
                <div style="display:flex;gap:20px;">
                  <span>Thời gian phản ứng: <strong style="color:var(--emerald-light);font-family:var(--font-mono);">01p 15s</strong></span>
                  <span>Tiếp cận hiện trường: <strong style="color:var(--text-white);font-family:var(--font-mono);">06p 50s</strong></span>
                  <span>Thời gian tại hiện trường: <strong style="color:var(--text-white);font-family:var(--font-mono);">05p 50s</strong></span>
                </div>
                <div style="color:var(--accent-cyan);font-weight:600;">
                  ✓ Đã thiết lập kênh thoại vô tuyến & truyền số liệu sinh tồn ePCR trực tiếp với Bệnh viện
                </div>
              </div>
            </div>
          </div>

          <!-- 3. THANH ĐIỀU HƯỚNG 4 TABS CHI TIẾT (FULL WIDTH) -->
          <div style="display:flex;background:var(--bg-elevated);border-bottom:1px solid var(--border-main);padding:0 24px;flex-shrink:0;">
            <button class="panel-tab-btn active" data-tab="tab-overview" style="padding:10px 22px;font-size:13px;font-weight:600;">Tab Tổng quan</button>
            <button class="panel-tab-btn" data-tab="tab-dispatch" style="padding:10px 22px;font-size:13px;font-weight:600;">Tab Phân công / Điều phối</button>
            <button class="panel-tab-btn" data-tab="tab-documents" style="padding:10px 22px;font-size:13px;font-weight:600;">Tab Hồ sơ</button>
            <button class="panel-tab-btn" data-tab="tab-logs" style="padding:10px 22px;font-size:13px;font-weight:600;">Tab Lịch sử (Log)</button>
          </div>

          <!-- 4. MODAL BODY (CHIẾM TRỌN KHÔNG GIAN CÒN LẠI CỦA MÀN HÌNH) -->
          <div class="modal-body" id="case-modal-body-content" style="flex:1;overflow-y:auto;padding:20px 24px;background:rgba(5,13,24,0.3);"></div>

        </div>
      `;

      modalOverlay.classList.add('active');

      const renderTab = (tabName) => {
        const body = modalOverlay.querySelector('#case-modal-body-content');
        if (!body) return;

        // --- TAB 1: TỔNG QUAN (Layout 50/50: Nửa Trái là Lâm sàng BN - Nửa Phải là Bản đồ Radar GIS) ---
        if (tabName === 'tab-overview') {
          body.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch;height:100%;">
              
              <!-- NỬA TRÁI (50% LAYOUT): THÔNG TIN NGƯỜI BỆNH, LÂM SÀNG & SINH HIỆU -->
              <div style="display:flex;flex-direction:column;gap:14px;">
                
                <!-- 1. THÔNG TIN CHUNG NGƯỜI BỆNH -->
                <div class="form-section">
                  <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span>THÔNG TIN CHUNG NGƯỜI BỆNH</span>
                      <span class="badge badge-accent">ID: ${c.patient?.id || 'BN-' + c.code}</span>
                    </div>
                    <button class="btn btn-default btn-xs" id="btn-toggle-edit-patient-central" style="border:1px solid var(--accent-cyan);color:var(--accent-cyan);font-size:11px;padding:3px 8px;display:flex;align-items:center;gap:4px;font-weight:600;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      <span>Sửa & Đồng bộ về xe</span>
                    </button>
                  </div>

                  <!-- Central Quick Edit Form for Dispatcher / Doctor -->
                  <div id="box-edit-patient-central" style="display:none;background:rgba(8,24,39,0.95);border:1px solid var(--accent-cyan);border-radius:8px;padding:12px;margin-bottom:12px;">
                    <div style="font-size:11px;color:var(--accent-cyan);font-weight:700;margin-bottom:8px;text-transform:uppercase;display:flex;align-items:center;gap:6px;">
                      <span>✦ ĐIỀU PHỐI VIÊN 115 CẬP NHẬT & ĐỒNG BỘ THÔNG TIN BỆNH NHÂN:</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 80px 100px 100px;gap:8px;margin-bottom:8px;">
                      <div>
                        <label style="font-size:10.5px;color:var(--text-slate);display:block;margin-bottom:2px;">Họ tên bệnh nhân</label>
                        <input type="text" id="central-input-patient-name" value="${c.patient?.name || ''}" class="form-input" style="padding:4px 8px;font-size:12px;width:100%;background:#061421;border:1px solid var(--border-accent);color:#FFFFFF;border-radius:4px;" />
                      </div>
                      <div>
                        <label style="font-size:10.5px;color:var(--text-slate);display:block;margin-bottom:2px;">Tuổi</label>
                        <input type="number" id="central-input-patient-age" value="${c.patient?.age || ''}" class="form-input" style="padding:4px 8px;font-size:12px;width:100%;background:#061421;border:1px solid var(--border-accent);color:#FFFFFF;border-radius:4px;" />
                      </div>
                      <div>
                        <label style="font-size:10.5px;color:var(--text-slate);display:block;margin-bottom:2px;">Giới tính</label>
                        <select id="central-input-patient-gender" class="form-select" style="padding:4px 8px;font-size:12px;width:100%;background:#061421;border:1px solid var(--border-accent);color:#FFFFFF;border-radius:4px;">
                          <option value="Nam" ${c.patient?.gender === 'Nam' ? 'selected' : ''}>Nam</option>
                          <option value="Nữ" ${c.patient?.gender === 'Nữ' ? 'selected' : ''}>Nữ</option>
                          <option value="Chưa rõ" ${c.patient?.gender === 'Chưa rõ' ? 'selected' : ''}>Chưa rõ</option>
                        </select>
                      </div>
                      <div>
                        <label style="font-size:10.5px;color:var(--text-slate);display:block;margin-bottom:2px;">Nhóm máu</label>
                        <select id="central-input-patient-blood" class="form-select" style="padding:4px 8px;font-size:12px;width:100%;background:#061421;border:1px solid var(--border-accent);color:#FFFFFF;border-radius:4px;">
                          <option value="O+" ${c.patient?.bloodType === 'O+' ? 'selected' : ''}>O+</option>
                          <option value="O-" ${c.patient?.bloodType === 'O-' ? 'selected' : ''}>O-</option>
                          <option value="A+" ${c.patient?.bloodType === 'A+' ? 'selected' : ''}>A+</option>
                          <option value="A-" ${c.patient?.bloodType === 'A-' ? 'selected' : ''}>A-</option>
                          <option value="B+" ${c.patient?.bloodType === 'B+' ? 'selected' : ''}>B+</option>
                          <option value="B-" ${c.patient?.bloodType === 'B-' ? 'selected' : ''}>B-</option>
                          <option value="AB+" ${c.patient?.bloodType === 'AB+' ? 'selected' : ''}>AB+</option>
                          <option value="AB-" ${c.patient?.bloodType === 'AB-' ? 'selected' : ''}>AB-</option>
                        </select>
                      </div>
                    </div>
                    <div style="display:grid;grid-template-columns:140px 1fr 1fr;gap:8px;margin-bottom:8px;">
                      <div>
                        <label style="font-size:10.5px;color:var(--text-slate);display:block;margin-bottom:2px;">Số điện thoại BN</label>
                        <input type="text" id="central-input-patient-phone" value="${c.patient?.phone || c.callerPhone || ''}" class="form-input" style="padding:4px 8px;font-size:12px;width:100%;background:#061421;border:1px solid var(--border-accent);color:#FFFFFF;border-radius:4px;" />
                      </div>
                      <div>
                        <label style="font-size:10.5px;color:var(--text-slate);display:block;margin-bottom:2px;">Tiền sử bệnh lý nền</label>
                        <input type="text" id="central-input-patient-history" value="${c.patient?.history || ''}" class="form-input" style="padding:4px 8px;font-size:12px;width:100%;background:#061421;border:1px solid var(--border-accent);color:#FFFFFF;border-radius:4px;" />
                      </div>
                      <div>
                        <label style="font-size:10.5px;color:var(--text-slate);display:block;margin-bottom:2px;">Dị ứng thuốc & thức ăn</label>
                        <input type="text" id="central-input-patient-allergies" value="${c.patient?.allergies || ''}" class="form-input" style="padding:4px 8px;font-size:12px;width:100%;background:#061421;border:1px solid var(--border-accent);color:#FFFFFF;border-radius:4px;" />
                      </div>
                    </div>
                    <div>
                      <label style="font-size:10.5px;color:var(--text-slate);display:block;margin-bottom:2px;">Chẩn đoán sơ bộ / Triệu chứng</label>
                      <input type="text" id="central-input-patient-symptom" value="${c.patient?.symptom || c.incident?.description || ''}" class="form-input" style="padding:4px 8px;font-size:12px;width:100%;background:#061421;border:1px solid var(--border-accent);color:#FFFFFF;border-radius:4px;" />
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
                      <button class="btn btn-default btn-xs" id="btn-cancel-edit-patient-central" style="padding:4px 10px;">Hủy</button>
                      <button class="btn btn-emergency btn-xs" id="btn-save-patient-central" style="padding:4px 14px;font-weight:700;">
                        LƯU & PHÁT ĐỒNG BỘ VỀ KÍP XE ➔
                      </button>
                    </div>
                  </div>
                  
                  <div style="display:flex;gap:14px;margin-bottom:10px;align-items:center;background:rgba(255,255,255,0.02);padding:8px 12px;border-radius:8px;border:1px solid var(--border-main);">
                    <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg, #1e293b, #0f172a);border:2px solid var(--border-accent);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
                      👤
                    </div>
                    <div style="flex:1;min-width:0;">
                      <div style="font-size:15px;font-weight:700;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.patient?.name || 'Không rõ danh tính'}</div>
                      <div style="font-size:12px;color:var(--text-slate);margin-top:2px;">
                        Tuổi: <strong style="color:var(--text-light);">${c.patient?.age || '—'}</strong> · 
                        Giới tính: <strong style="color:var(--text-light);">${c.patient?.gender || '—'}</strong> · 
                        Nhóm máu: <span class="badge badge-amber" style="padding:1px 6px;font-weight:700;">${c.patient?.bloodType || 'O+'}</span>
                      </div>
                    </div>
                  </div>

                  <div class="data-table-container" style="border:none;">
                    <table class="command-table" style="font-size:12px;">
                      <tbody>
                        <tr>
                          <td style="width:130px;color:var(--text-slate);">Địa chỉ hiện trường:</td>
                          <td><strong style="color:var(--text-white);">${c.location?.address || 'Chưa có thông tin'}</strong></td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Số điện thoại BN:</td>
                          <td><span style="font-family:var(--font-mono);font-size:12.5px;color:var(--accent-cyan);font-weight:600;">${c.patient?.phone || c.callerPhone || '—'}</span></td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Người báo tin:</td>
                          <td><strong>${c.callerName || 'Trần Văn Nam'}</strong> · ĐT: <span style="font-family:var(--font-mono);">${c.callerPhone || '0918.234.111'}</span></td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">CCCD / BHYT:</td>
                          <td><span style="font-family:var(--font-mono);">${c.patient?.nationalId || '092095001234'}</span> · <span style="font-family:var(--font-mono);color:var(--emerald-light);">${c.patient?.insuranceCode || 'GD4929210088992'}</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- 2. NGUYÊN NHÂN & LÂM SÀNG -->
                <div class="form-section">
                  <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                    <span>NGUYÊN NHÂN & LÂM SÀNG</span>
                    <span class="badge ${c.incident?.severity === 'CRITICAL' ? 'badge-emergency' : 'badge-amber'}">${c.incident?.severityText || 'Khẩn cấp'}</span>
                  </div>

                  <div style="margin-bottom:8px;">
                    <div style="font-size:11px;color:var(--text-slate);margin-bottom:2px;">Loại hình cấp cứu / Hoàn cảnh:</div>
                    <div style="font-size:13.5px;font-weight:700;color:var(--text-white);display:flex;align-items:center;gap:6px;">
                      <span>🚑</span> ${c.incident?.name || 'Tai nạn giao thông'}
                    </div>
                  </div>

                  <div style="margin-bottom:10px;">
                    <div style="font-size:11px;color:var(--text-slate);margin-bottom:3px;">Mô tả triệu chứng tiếp nhận hiện trường:</div>
                    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-main);border-radius:6px;padding:8px 10px;font-size:12px;color:var(--text-light);line-height:1.45;">
                      ${c.incident?.description || 'Nạn nhân va chạm giao thông tốc độ cao, đa chấn thương phần mềm và xây xát cẳng tay, tỉnh táo, đau tức ngực nhẹ.'}
                    </div>
                  </div>

                  <div class="data-table-container" style="border:none;">
                    <table class="command-table" style="font-size:12px;">
                      <tbody>
                        <tr>
                          <td style="width:120px;color:var(--text-slate);">Tiền sử bệnh nền:</td>
                          <td><strong style="color:#fbbf24;">${c.patient?.history || 'Tăng huyết áp, Đái tháo đường Type 2'}</strong></td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Dị ứng thuốc:</td>
                          <td><span style="color:var(--red-light);font-weight:600;">${c.patient?.allergies || 'Dị ứng Penicillin'}</span></td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Tình trạng tri giác:</td>
                          <td><span class="badge badge-emerald">Tỉnh táo, tiếp xúc tốt</span> · BS tư vấn: CKI. Lê Quốc Trí</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- 3. DẤU HIỆU SINH TỒN NGOẠI VIỆN (VITALS DASHBOARD + DẢI SÓNG ECG) -->
                <div class="form-section">
                  <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                    <span>DẤU HIỆU SINH TỒN NGOẠI VIỆN (VITALS)</span>
                    <span class="badge badge-emerald" style="font-family:var(--font-mono);">MONITOR LIVE</span>
                  </div>

                  <!-- 6 Ô SINH TỒN NGOẠI VIỆN -->
                  <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:10px;">
                    <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;padding:6px 8px;text-align:center;">
                      <div style="font-size:10px;color:var(--text-slate);">Mạch (Pulse)</div>
                      <div style="font-size:15px;font-weight:700;color:var(--text-white);font-family:var(--font-mono);margin-top:1px;">${c.epcr?.vitals?.pulse || 88} <span style="font-size:9.5px;color:var(--text-muted);font-weight:normal;">bpm</span></div>
                    </div>
                    <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;padding:6px 8px;text-align:center;">
                      <div style="font-size:10px;color:var(--text-slate);">Huyết áp (BP)</div>
                      <div style="font-size:15px;font-weight:700;color:var(--text-white);font-family:var(--font-mono);margin-top:1px;">${c.epcr?.vitals?.bp || '130/80'} <span style="font-size:9.5px;color:var(--text-muted);font-weight:normal;">mmHg</span></div>
                    </div>
                    <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;padding:6px 8px;text-align:center;">
                      <div style="font-size:10px;color:var(--text-slate);">SpO2</div>
                      <div style="font-size:15px;font-weight:700;color:#38bdf8;font-family:var(--font-mono);margin-top:1px;">${c.epcr?.vitals?.spO2 || 97}%</div>
                    </div>
                    <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;padding:6px 8px;text-align:center;">
                      <div style="font-size:10px;color:var(--text-slate);">Nhịp thở</div>
                      <div style="font-size:15px;font-weight:700;color:var(--text-white);font-family:var(--font-mono);margin-top:1px;">${c.epcr?.vitals?.rr || 18} <span style="font-size:9.5px;color:var(--text-muted);font-weight:normal;">l/p</span></div>
                    </div>
                    <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;padding:6px 8px;text-align:center;">
                      <div style="font-size:10px;color:var(--text-slate);">Thân nhiệt</div>
                      <div style="font-size:15px;font-weight:700;color:var(--text-white);font-family:var(--font-mono);margin-top:1px;">${c.epcr?.vitals?.temp || 36.8}°C</div>
                    </div>
                    <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;padding:6px 8px;text-align:center;">
                      <div style="font-size:10px;color:var(--text-slate);">Glasgow</div>
                      <div style="font-size:15px;font-weight:700;color:#34d399;font-family:var(--font-mono);margin-top:1px;">15 <span style="font-size:9.5px;color:var(--text-muted);font-weight:normal;">điểm</span></div>
                    </div>
                  </div>

                  <!-- Dải sóng Monitor ECG Mini tích hợp -->
                  <div style="background:#06121f;border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:6px 10px;position:relative;overflow:hidden;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;font-size:10px;">
                      <span style="color:#22c55e;font-weight:700;font-family:var(--font-mono);">LEAD II · ECG 25mm/s</span>
                      <span style="color:var(--text-slate);font-family:var(--font-mono);">HR: ${c.epcr?.vitals?.pulse || 88} bpm</span>
                    </div>
                    <svg width="100%" height="40" viewBox="0 0 380 40" style="background:#040b13;border-radius:4px;">
                      <path d="M 0 22 L 30 22 L 40 22 L 45 10 L 52 35 L 58 4 L 65 28 L 72 22 L 120 22 L 130 22 L 135 10 L 142 35 L 148 4 L 155 28 L 162 22 L 210 22 L 220 22 L 225 10 L 232 35 L 238 4 L 245 28 L 252 22 L 300 22 L 310 22 L 315 10 L 322 35 L 328 4 L 335 28 L 342 22 L 380 22" fill="none" stroke="#22c55e" stroke-width="2" />
                    </svg>
                  </div>
                </div>

              </div>

              <!-- NỬA PHẢI (50% LAYOUT): BẢN ĐỒ GIS RADAR GIÁM SÁT THỜI GIAN THỰC LỚN -->
              <div class="form-section" style="display:flex;flex-direction:column;padding:0;overflow:hidden;background:#06101c;border:1px solid var(--border-accent);min-height:550px;">
                <!-- Header mini map -->
                <div style="height:36px;background:rgba(7,19,32,0.92);backdrop-filter:blur(8px);z-index:10;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:11.5px;color:var(--text-slate);flex-shrink:0;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 10px #10b981;"></span>
                    <strong style="color:var(--text-white);letter-spacing:0.8px;">GIÁM SÁT GIS RADAR 115</strong>
                  </div>
                  <span style="font-family:var(--font-mono);color:var(--accent-cyan);font-weight:600;">GPS LIVE ±3m · TẦNG SỐ VÔ TUYẾN 154.200 MHz</span>
                </div>

                <!-- SVG Radar Canvas 50/50 Large Size -->
                <div style="flex:1;position:relative;width:100%;min-height:480px;">
                  <svg viewBox="0 0 650 500" style="position:absolute;inset:0;width:100%;height:100%;background:radial-gradient(circle at 50% 50%, #0d2640 0%, #050d18 100%);">
                    <defs>
                      <pattern id="radarGridHalf" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(56, 189, 248, 0.08)" stroke-width="1"/>
                      </pattern>
                      <radialGradient id="redGlowHalf" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#ef4444" stop-opacity="0.9"/>
                        <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
                      </radialGradient>
                      <radialGradient id="amberGlowHalf" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.9"/>
                        <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
                      </radialGradient>
                    </defs>

                    <rect width="650" height="500" fill="url(#radarGridHalf)" />

                    <!-- Vòng quét Radar -->
                    <circle cx="325" cy="270" r="160" fill="none" stroke="rgba(56, 189, 248, 0.12)" stroke-width="1" />
                    <circle cx="325" cy="270" r="240" fill="none" stroke="rgba(56, 189, 248, 0.08)" stroke-width="1" />

                    <!-- Dải Sông Cần Thơ mềm mại -->
                    <path d="M 0 140 Q 180 230 320 120 T 650 200 L 650 310 Q 460 210 310 240 T 0 260 Z" fill="#0b2c47" opacity="0.65" />
                    
                    <!-- Trục đường lộ TP Cần Thơ -->
                    <path d="M 40 450 L 320 280 L 580 130" stroke="rgba(148, 163, 184, 0.3)" stroke-width="6" stroke-linecap="round" />
                    <path d="M 100 40 L 320 280 L 420 460" stroke="rgba(148, 163, 184, 0.22)" stroke-width="4.5" stroke-linecap="round" />
                    <path d="M 210 460 L 530 60" stroke="rgba(148, 163, 184, 0.22)" stroke-width="3.5" stroke-linecap="round" />

                    <!-- Tuyến lộ trình: Xe cứu thương -> Hiện trường -> Bệnh viện -->
                    <polyline points="150,370 320,280 520,150" fill="none" stroke="#38bdf8" stroke-width="4" stroke-dasharray="9,5" stroke-linecap="round">
                      <animate attributeName="stroke-dashoffset" values="28;0" dur="1.2s" repeatCount="indefinite" />
                    </polyline>

                    <!-- 1. VỊ TRÍ CA CẤP CỨU (HIỆN TRƯỜNG) -->
                    <g transform="translate(320, 280)">
                      <circle r="30" fill="url(#redGlowHalf)">
                        <animate attributeName="r" values="14;38;14" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle r="9" fill="#ef4444" stroke="#ffffff" stroke-width="2.5" />
                      <!-- Label Hiện trường -->
                      <rect x="-60" y="14" width="120" height="22" rx="4" fill="rgba(239, 68, 68, 0.95)" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                      <text x="0" y="30" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">HIỆN TRƯỜNG CA</text>
                    </g>

                    <!-- 2. VỊ TRÍ XE CỨU THƯƠNG -->
                    <g transform="translate(150, 370)">
                      <circle r="22" fill="url(#amberGlowHalf)">
                        <animate attributeName="r" values="10;26;10" dur="2.5s" repeatCount="indefinite" />
                      </circle>
                      <rect x="-14" y="-12" width="28" height="24" rx="5" fill="#f59e0b" stroke="#ffffff" stroke-width="2" />
                      <path d="M -7 -3 L 7 -3 M -7 3 L 7 3" stroke="#000" stroke-width="2" stroke-linecap="round" />
                      <!-- Label Biển số -->
                      <rect x="-65" y="-36" width="130" height="20" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#f59e0b" stroke-width="1.2" />
                      <text x="0" y="-22" fill="#f59e0b" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle">${c.dispatch?.vehiclePlate || '65A-012.34'} · ${c.speed || 52}km/h</text>
                    </g>

                    <!-- 3. VỊ TRÍ BỆNH VIỆN TIẾP NHẬN -->
                    <g transform="translate(520, 150)">
                      <circle r="20" fill="rgba(16, 185, 129, 0.35)" />
                      <rect x="-16" y="-16" width="32" height="32" rx="6" fill="#047857" stroke="#ffffff" stroke-width="2.5" />
                      <!-- Chữ thập y tế -->
                      <path d="M -3 -10 L 3 -10 L 3 -3 L 10 -3 L 10 3 L 3 3 L 3 10 L -3 10 L -3 3 L -10 3 L -10 -3 L -3 -3 Z" fill="#ffffff" />
                      <!-- Label Bệnh viện -->
                      <rect x="-75" y="-40" width="150" height="21" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#10b981" stroke-width="1.2" />
                      <text x="0" y="-25" fill="#10b981" font-size="11" font-weight="bold" text-anchor="middle">${c.dispatch?.hospitalName?.includes('TW') ? 'BVĐK TRUNG ƯƠNG' : 'BVĐK TP CẦN THƠ'}</text>
                    </g>
                  </svg>
                </div>

                <!-- Footer mini map -->
                <div style="height:34px;background:rgba(7,19,32,0.92);backdrop-filter:blur(8px);z-index:10;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-top:1px solid rgba(255,255,255,0.08);font-size:11.5px;flex-shrink:0;">
                  <span style="color:var(--text-slate);display:flex;align-items:center;gap:6px;">
                    📍 <strong style="color:var(--text-white);">${c.location?.address ? c.location.address : 'Khu vực TP Cần Thơ'}</strong>
                  </span>
                  <span style="color:var(--accent-amber);font-weight:700;font-size:12px;">ETA đến BV: ~${c.eta || '6 phút'}</span>
                </div>
              </div>

            </div>
          `;

          // Gắn sự kiện sửa & đồng bộ thông tin BN về kíp xe
          body.querySelector('#btn-toggle-edit-patient-central')?.addEventListener('click', () => {
            const box = body.querySelector('#box-edit-patient-central');
            if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
          });
          body.querySelector('#btn-cancel-edit-patient-central')?.addEventListener('click', () => {
            const box = body.querySelector('#box-edit-patient-central');
            if (box) box.style.display = 'none';
          });
          body.querySelector('#btn-save-patient-central')?.addEventListener('click', () => {
            const name = body.querySelector('#central-input-patient-name')?.value.trim() || 'Chưa rõ';
            const age = Number(body.querySelector('#central-input-patient-age')?.value) || 0;
            const gender = body.querySelector('#central-input-patient-gender')?.value || 'Nam';
            const phone = body.querySelector('#central-input-patient-phone')?.value.trim() || '';
            const bloodType = body.querySelector('#central-input-patient-blood')?.value || 'O+';
            const history = body.querySelector('#central-input-patient-history')?.value.trim() || '';
            const allergies = body.querySelector('#central-input-patient-allergies')?.value.trim() || '';
            const symptom = body.querySelector('#central-input-patient-symptom')?.value.trim() || '';

            const patch = { name, age, gender, phone, bloodType, history, allergies, symptom };
            window.StateManager.updateCasePatient(c.id, patch);
            if (window.CCNV_UI?.Toast) {
              window.CCNV_UI.Toast.show(
                'ĐÃ ĐỒNG BỘ VỀ XE CẤP CỨU',
                `Đã cập nhật thông tin BN "${name}" (${age}T, ${gender}) và phát tín hiệu đồng bộ realtime tới app tài xế & kíp cấp cứu.`,
                true
              );
            }
            renderTab('tab-overview');
          });
        }

        // --- TAB 2: PHÂN CÔNG / ĐIỀU PHỐI (Layout Mở Rộng 3 Cột) ---
        else if (tabName === 'tab-dispatch') {
          body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:16px;">
              <!-- LƯỚI 2 CỘT LỚN CÂN ĐỐI -->
              <div class="form-grid-2">

                <!-- KHỐI 1: XE NHẬN CA -->
                <div class="form-section">
                  <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                    <span>1. XE NHẬN CA & VẬN HÀNH</span>
                    <span class="badge badge-accent" style="font-family:var(--font-mono);font-size:13px;">${c.dispatch?.vehiclePlate || '65A-012.34'}</span>
                  </div>

                  <div class="data-table-container" style="border:none;">
                    <table class="command-table" style="font-size:12.5px;">
                      <tbody>
                        <tr>
                          <td style="width:140px;color:var(--text-slate);">Biển số xe:</td>
                          <td><strong style="color:var(--text-white);font-family:var(--font-mono);font-size:14px;">${c.dispatch?.vehiclePlate || '65A-012.34'}</strong></td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Phân loại xe:</td>
                          <td><span class="badge badge-emergency">Type A (Hồi sức Cấp cứu Chuyên sâu)</span></td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Trạm đóng quân:</td>
                          <td>${c.dispatch?.stationName || 'Trạm Cấp cứu Ninh Kiều - 115 Cần Thơ'}</td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Vận tốc & Trạng thái:</td>
                          <td><strong style="color:#f59e0b;">${c.speed || 52} km/h</strong> · Đang bật còi ưu tiên & đèn khẩn cấp</td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Nhiên liệu & Oxy:</td>
                          <td>Xăng: <strong style="color:var(--emerald-light);">78%</strong> · Bình Oxy y tế: <strong style="color:var(--emerald-light);">92%</strong></td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Trang thiết bị xe:</td>
                          <td style="font-size:12px;color:var(--text-light);">Monitor 5 thông số, Máy sốc tim khử rung AED, Bộ nẹp cố định chi, Máy hút đờm di động</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- KHỐI 2: BỆNH VIỆN TIẾP NHẬN & NGƯỜI NHẬN -->
                <div class="form-section">
                  <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                    <span>2. BỆNH VIỆN TIẾP NHẬN & NGƯỜI NHẬN</span>
                    <span class="badge badge-emerald">ĐÃ XÁC NHẬN SẴN SÀNG</span>
                  </div>

                  <div class="data-table-container" style="border:none;">
                    <table class="command-table" style="font-size:12.5px;">
                      <tbody>
                        <tr>
                          <td style="width:150px;color:var(--text-slate);">Bệnh viện tiếp nhận:</td>
                          <td><strong style="color:var(--text-white);font-size:13.5px;">${c.dispatch?.hospitalName || 'BV Đa khoa TP Cần Thơ'}</strong></td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Địa chỉ BV:</td>
                          <td>Số 04 Châu Văn Liêm, P. An Lạc, Q. Ninh Kiều, TP. Cần Thơ</td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Người nhận tại viện:</td>
                          <td><strong style="color:var(--accent-cyan);font-size:13px;">${receiverName}</strong></td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Khoa tiếp nhận:</td>
                          <td>Khoa Hồi sức Cấp cứu (A9) · Buồng Cấp cứu Ngoại</td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Năng lực tiếp nhận:</td>
                          <td><strong style="color:var(--emerald-light);">12 giường cấp cứu trống</strong> · 5 máy thở sẵn sàng</td>
                        </tr>
                        <tr>
                          <td style="color:var(--text-slate);">Hotline trực viện:</td>
                          <td><span style="font-family:var(--font-mono);color:var(--text-white);">0292.3821.236</span> (Trực cấp cứu 24/7)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              <!-- KHỐI 3: DANH SÁCH KÍP CẤP CỨU ĐƯỢC PHÂN CÔNG (FULL WIDTH TABLE) -->
              <div class="form-section">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                  <span>3. DANH SÁCH KÍP CẤP CỨU NGOẠI VIỆN (${c.dispatch?.crewName || crewObj.name})</span>
                  <span style="font-size:11.5px;color:var(--text-slate);">Ca trực: 07:00 - 15:00 · Trực tổng đài điều động</span>
                </div>

                <div class="data-table-container">
                  <table class="command-table" style="font-size:12.5px;">
                    <thead>
                      <tr>
                        <th style="width:220px;">Vai trò nhiệm vụ</th>
                        <th>Họ và tên nhân sự</th>
                        <th style="width:240px;">Số điện thoại</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span class="badge badge-emergency" style="font-size:11.5px;">Bác sĩ Kíp trưởng</span></td>
                        <td><strong style="color:var(--text-white);font-size:13px;">${crewObj.doctor || 'BS. CKI. Nguyễn Văn Thành'}</strong></td>
                        <td><span style="font-family:var(--font-mono);color:var(--accent-cyan);font-weight:600;font-size:13px;">0913.111.222</span></td>
                      </tr>
                      <tr>
                        <td><span class="badge badge-accent" style="font-size:11.5px;">Điều dưỡng Cấp cứu</span></td>
                        <td><strong style="color:var(--text-white);font-size:13px;">${crewObj.nurse || 'ĐD. Trần Thị Mai'}</strong></td>
                        <td><span style="font-family:var(--font-mono);color:var(--accent-cyan);font-weight:600;font-size:13px;">0913.333.444</span></td>
                      </tr>
                      <tr>
                        <td><span class="badge badge-default" style="font-size:11.5px;">Lái xe Cứu thương</span></td>
                        <td><strong style="color:var(--text-white);font-size:13px;">${crewObj.driver || 'Lê Văn Hùng'}</strong></td>
                        <td><span style="font-family:var(--font-mono);color:var(--accent-cyan);font-weight:600;font-size:13px;">0913.555.666</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- KHỐI 4: THAO TÁC NGHIỆP VỤ ĐIỀU PHỐI (ĐỔI XE / ĐỔI BV / HỦY CA) -->
              <div class="form-section">
                <div class="form-section-title">4. THAO TÁC ĐIỀU CHỈNH PHÂN CÔNG ĐIỀU PHỐI (NẾU CẦN THIẾT)</div>
                <div class="form-grid-2">
                  <div>
                    <label class="form-label">Thu hồi & Đổi sang xe cứu thương khác</label>
                    <div style="display:flex;gap:8px;margin-top:6px;">
                      <select id="modal-change-vehicle-select" style="flex:1;">
                        <option value="65A-015.67">65A-015.67 (Type A - Trạm Ninh Kiều)</option>
                        <option value="65A-018.89">65A-018.89 (Type B - Trạm Bình Thủy)</option>
                        <option value="65A-019.99">65A-019.99 (Type C - Trạm Ô Môn)</option>
                      </select>
                      <button class="btn btn-default" id="btn-action-change-vehicle">Đổi Xe</button>
                    </div>
                  </div>
                  <div>
                    <label class="form-label">Chuyển sang Bệnh viện tiếp nhận khác</label>
                    <div style="display:flex;gap:8px;margin-top:6px;">
                      <select id="modal-change-hosp-select" style="flex:1;">
                        <option value="HOSP_BVTU">BV Đa khoa TW Cần Thơ</option>
                        <option value="HOSP_BVND">BV Nhi đồng Cần Thơ</option>
                        <option value="HOSP_BVUB">BV Ung bướu Cần Thơ</option>
                      </select>
                      <button class="btn btn-default" id="btn-action-change-hosp">Đổi BV</button>
                    </div>
                  </div>
                </div>

                <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--border-main);">
                  <div class="form-grid-2">
                    <div class="form-field">
                      <label class="form-label" style="color:var(--red-light);">Lý do Hủy ca cấp cứu (nếu hủy)</label>
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

            </div>
          `;

          // Gán sự kiện đổi xe, đổi BV, hủy ca
          body.querySelector('#btn-action-change-vehicle')?.addEventListener('click', () => {
            const newPlate = body.querySelector('#modal-change-vehicle-select').value;
            window.StateManager.updateCase(c.id, {
              dispatch: { ...c.dispatch, vehiclePlate: newPlate }
            });
            window.StateManager.addCaseLog(c.id, `Thu hồi lệnh cũ, đổi sang xe ${newPlate}`);
            window.CCNV_UI.Toast.show('Đã đổi xe cứu thương', `Xe ${newPlate} đã được gán cho ca ${c.code}`);
            renderTab('tab-dispatch');
          });

          body.querySelector('#btn-action-change-hosp')?.addEventListener('click', () => {
            const hospText = body.querySelector('#modal-change-hosp-select').selectedOptions[0].text;
            window.StateManager.updateCase(c.id, {
              dispatch: { ...c.dispatch, hospitalName: hospText }
            });
            window.StateManager.addCaseLog(c.id, `Thay đổi bệnh viện tiếp nhận sang ${hospText}`);
            window.CCNV_UI.Toast.show('Đã đổi Bệnh viện', `Bệnh viện tiếp nhận mới: ${hospText}`);
            renderTab('tab-dispatch');
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
            const mainViewport = document.getElementById('main-content-viewport');
            if (mainViewport) this.renderCasesListView(mainViewport);
          });
        }

        // --- TAB 3: HỒ SƠ (Thư viện hình ảnh & Tệp tin đính kèm) ---
        else if (tabName === 'tab-documents') {
          body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:16px;">
              
              <!-- PHẦN 1: BỘ SƯU TẬP HÌNH ẢNH HIỆN TRƯỜNG & Y TẾ -->
              <div class="form-section">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                  <span>1. THƯ VIỆN HÌNH ẢNH HIỆN TRƯỜNG & Y TẾ (4 HÌNH ẢNH)</span>
                  <button class="btn btn-default btn-sm" id="btn-upload-more-photo">
                    📷 + Chụp / Tải ảnh lên
                  </button>
                </div>

                <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px;margin-top:10px;">
                  
                  <!-- Ảnh 1: Hiện trường -->
                  <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
                    <div style="height:150px;background:#0c1929;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;" class="img-preview-card" data-title="Ảnh Hiện trường va chạm">
                      <svg width="100%" height="100%" viewBox="0 0 160 120">
                        <rect width="160" height="120" fill="#0f2338"/>
                        <path d="M 0 100 L 160 80" stroke="#334155" stroke-width="12" />
                        <circle cx="80" cy="70" r="14" fill="#ef4444" opacity="0.3" />
                        <text x="80" y="65" fill="#f87171" font-size="24" text-anchor="middle">🏍️</text>
                        <text x="80" y="105" fill="#94a3b8" font-size="9" text-anchor="middle">HIỆN TRƯỜNG TAI NẠN</text>
                      </svg>
                      <span class="badge badge-emergency" style="position:absolute;top:8px;left:8px;font-size:10px;">Hiện trường</span>
                    </div>
                    <div style="padding:10px 12px;font-size:12px;">
                      <div style="font-weight:600;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">IMG_HienTruong_01.jpg</div>
                      <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">Chụp lúc 08:18 · 1.8 MB</div>
                    </div>
                  </div>

                  <!-- Ảnh 2: Tổn thương & Nẹp -->
                  <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
                    <div style="height:150px;background:#0c1929;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;" class="img-preview-card" data-title="Ảnh Sơ cứu nẹp cố định tay">
                      <svg width="100%" height="100%" viewBox="0 0 160 120">
                        <rect width="160" height="120" fill="#132338"/>
                        <circle cx="80" cy="55" r="20" fill="#38bdf8" opacity="0.2" />
                        <text x="80" y="62" fill="#38bdf8" font-size="24" text-anchor="middle">🩹</text>
                        <text x="80" y="105" fill="#94a3b8" font-size="9" text-anchor="middle">BĂNG NẸP CHI TRÊN</text>
                      </svg>
                      <span class="badge badge-accent" style="position:absolute;top:8px;left:8px;font-size:10px;">Y tế</span>
                    </div>
                    <div style="padding:10px 12px;font-size:12px;">
                      <div style="font-weight:600;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">IMG_SoCuu_NepTay_02.jpg</div>
                      <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">Chụp lúc 08:21 · 2.1 MB</div>
                    </div>
                  </div>

                  <!-- Ảnh 3: Điện tim ECG -->
                  <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
                    <div style="height:150px;background:#0c1929;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;" class="img-preview-card" data-title="Ảnh Sóng điện tâm đồ ECG">
                      <svg width="100%" height="100%" viewBox="0 0 160 120">
                        <rect width="160" height="120" fill="#0b1e30"/>
                        <path d="M 0 60 L 30 60 L 40 40 L 50 80 L 60 20 L 70 90 L 80 60 L 110 60 L 120 45 L 130 75 L 160 60" fill="none" stroke="#22c55e" stroke-width="2" />
                        <text x="80" y="105" fill="#22c55e" font-size="9" font-weight="bold" text-anchor="middle">ECG 12 LEADS (NHỊP XOANG)</text>
                      </svg>
                      <span class="badge badge-emerald" style="position:absolute;top:8px;left:8px;font-size:10px;">ECG</span>
                    </div>
                    <div style="padding:10px 12px;font-size:12px;">
                      <div style="font-weight:600;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">ECG_Monitor_12Leads.png</div>
                      <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">Chụp lúc 08:23 · 950 KB</div>
                    </div>
                  </div>

                  <!-- Ảnh 4: Sảnh Bệnh viện -->
                  <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
                    <div style="height:150px;background:#0c1929;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;" class="img-preview-card" data-title="Ảnh Sảnh Cấp cứu Bệnh viện">
                      <svg width="100%" height="100%" viewBox="0 0 160 120">
                        <rect width="160" height="120" fill="#142236"/>
                        <circle cx="80" cy="55" r="20" fill="#f59e0b" opacity="0.2" />
                        <text x="80" y="62" fill="#f59e0b" font-size="24" text-anchor="middle">🏥</text>
                        <text x="80" y="105" fill="#94a3b8" font-size="9" text-anchor="middle">SẢNH TIẾP NHẬN BV</text>
                      </svg>
                      <span class="badge badge-amber" style="position:absolute;top:8px;left:8px;font-size:10px;">Bàn giao</span>
                    </div>
                    <div style="padding:10px 12px;font-size:12px;">
                      <div style="font-weight:600;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">IMG_SanhCapCuu_BVDK.jpg</div>
                      <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">Chụp lúc 08:35 · 2.4 MB</div>
                    </div>
                  </div>

                </div>
              </div>

              <!-- PHẦN 2: DANH MỤC TỆP TIN (FILE) ĐÍNH KÈM -->
              <div class="form-section">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                  <span>2. DANH MỤC TỆP TIN ĐÍNH KÈM (FILES & DOCUMENTS)</span>
                  <button class="btn btn-default btn-sm" id="btn-upload-attachment">
                    📁 + Đính kèm tệp tin mới
                  </button>
                </div>

                <div class="data-table-container">
                  <table class="command-table" style="font-size:12.5px;">
                    <thead>
                      <tr>
                        <th>Tên tệp tin</th>
                        <th style="width:180px;">Loại tài liệu</th>
                        <th style="width:120px;">Kích thước</th>
                        <th style="width:190px;">Thời gian đính kèm</th>
                        <th style="width:200px;">Người tải lên</th>
                        <th style="width:140px;">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <!-- File 1: ePCR PDF -->
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:20px;">📄</span>
                            <div>
                              <strong style="color:var(--text-white);font-family:var(--font-mono);">ePCR_${c.code}.pdf</strong>
                              <div style="font-size:11px;color:var(--text-muted);">Phiếu bệnh án cấp cứu ngoại viện điện tử</div>
                            </div>
                          </div>
                        </td>
                        <td><span class="badge badge-emergency">Bệnh án ePCR</span></td>
                        <td>148 KB</td>
                        <td style="font-family:var(--font-mono);">08:30:15 - 02/10/2026</td>
                        <td>${crewObj.doctor || 'BS. Nguyễn Văn Thành'}</td>
                        <td>
                          <div style="display:flex;gap:6px;">
                            <button class="btn btn-ghost btn-sm" id="btn-view-doc-epcr" style="color:var(--accent-cyan);">Xem</button>
                            <button class="btn btn-ghost btn-sm" id="btn-download-doc-epcr">Tải về</button>
                          </div>
                        </td>
                      </tr>

                      <!-- File 2: Biên bản bàn giao người bệnh PDF -->
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:20px;">📝</span>
                            <div>
                              <strong style="color:var(--text-white);font-family:var(--font-mono);">BienBan_BanGiao_${c.code}.pdf</strong>
                              <div style="font-size:11px;color:var(--text-muted);">Biên bản tiếp nhận & bàn giao người bệnh tại BV</div>
                            </div>
                          </div>
                        </td>
                        <td><span class="badge badge-emerald">Biên bản bàn giao</span></td>
                        <td>92 KB</td>
                        <td style="font-family:var(--font-mono);">08:42:00 - 02/10/2026</td>
                        <td>${receiverName}</td>
                        <td>
                          <div style="display:flex;gap:6px;">
                            <button class="btn btn-ghost btn-sm" id="btn-view-doc-handover" style="color:var(--accent-cyan);">Xem</button>
                            <button class="btn btn-ghost btn-sm">Tải về</button>
                          </div>
                        </td>
                      </tr>

                      <!-- File 3: Ghi âm cuộc gọi WAV -->
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:20px;">🎧</span>
                            <div>
                              <strong style="color:var(--text-white);font-family:var(--font-mono);">Record_Call_115_${c.callId || 'CALL-001'}.wav</strong>
                              <div style="font-size:11px;color:var(--text-muted);">File âm thanh cuộc gọi tiếp nhận 115 · Thời lượng 02:04</div>
                            </div>
                          </div>
                        </td>
                        <td><span class="badge badge-accent">Ghi âm 115</span></td>
                        <td>2.3 MB</td>
                        <td style="font-family:var(--font-mono);">08:12:00 - 02/10/2026</td>
                        <td>Hệ thống Tổng đài</td>
                        <td>
                          <div style="display:flex;gap:6px;">
                            <button class="btn btn-default btn-sm" id="btn-play-doc-audio" style="color:#f59e0b;">▶ Nghe lại</button>
                            <button class="btn btn-ghost btn-sm">Tải về</button>
                          </div>
                        </td>
                      </tr>

                      <!-- File 4: ECG Waveform XML -->
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:20px;">📊</span>
                            <div>
                              <strong style="color:var(--text-white);font-family:var(--font-mono);">ECG_Digital_Waveform.xml</strong>
                              <div style="font-size:11px;color:var(--text-muted);">Dữ liệu số sóng điện tim 12 chuyển đạo xuất từ Monitor</div>
                            </div>
                          </div>
                        </td>
                        <td><span class="badge badge-default">Dữ liệu thô</span></td>
                        <td>42 KB</td>
                        <td style="font-family:var(--font-mono);">08:24:00 - 02/10/2026</td>
                        <td>Monitor Xe ${c.dispatch?.vehiclePlate || '65A-012.34'}</td>
                        <td>
                          <div style="display:flex;gap:6px;">
                            <button class="btn btn-ghost btn-sm">Tải về</button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- KHU VỰC DROPZONE TẢI LÊN FILE MỚI -->
              <div style="border:2px dashed var(--border-accent);border-radius:8px;padding:22px;text-align:center;background:rgba(255,255,255,0.02);">
                <div style="font-size:28px;margin-bottom:6px;">📤</div>
                <div style="color:var(--text-white);font-weight:600;font-size:13.5px;">Kéo & Thả tài liệu, hình ảnh hoặc tệp tin ghi âm vào đây</div>
                <div style="color:var(--text-muted);font-size:11.5px;margin-top:4px;">Hỗ trợ định dạng: PDF, DOCX, JPG, PNG, WAV, MP3 · Dung lượng tối đa: 50MB</div>
              </div>

            </div>
          `;

          // Sự kiện xem preview ảnh
          body.querySelectorAll('.img-preview-card').forEach(card => {
            card.addEventListener('click', () => {
              const title = card.getAttribute('data-title');
              window.CCNV_UI.Toast.show('Xem hình ảnh', `Đang mở chế độ xem phóng to: ${title}`);
            });
          });

          // Sự kiện xem ePCR
          body.querySelector('#btn-view-doc-epcr')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Mở phiếu ePCR', `Đang tải mẫu ePCR của ca ${c.code}`);
          });

          // Sự kiện phát ghi âm
          body.querySelector('#btn-play-doc-audio')?.addEventListener('click', () => {
            window.CCNV_UI.SoundFx.playBeep();
            window.CCNV_UI.Toast.show('Đang phát ghi âm', 'Đang phát lại đoạn trao đổi giữa ĐPV và người báo tin.');
          });

          body.querySelector('#btn-upload-more-photo')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Tải ảnh', 'Mở hộp thoại chọn tệp hình ảnh từ thiết bị');
          });

          body.querySelector('#btn-upload-attachment')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Đính kèm', 'Mở hộp thoại chọn tệp tài liệu từ thiết bị');
          });
        }

        // --- TAB 4: LỊCH SỬ LOG (Nhật ký sự kiện toàn diện full-width) ---
        else if (tabName === 'tab-logs') {
          const logsList = (c.logs && c.logs.length >= 3) ? c.logs : [
            { time: '08:10:15 - 02/10/2026', type: 'CALL', badge: 'NHẬN CUỘC GỌI', color: '#38bdf8', user: 'dpv01 (Nguyễn Văn An)', action: 'Tiếp nhận cuộc gọi khẩn cấp 115 từ số 0918.234.111. Báo tin va chạm giao thông tại Cầu Hưng Lợi.' },
            { time: '08:11:30 - 02/10/2026', type: 'DISPATCH', badge: 'ĐIỀU XE', color: '#fbbf24', user: 'dpv01 (Nguyễn Văn An)', action: `Tạo ca cấp cứu ${c.code}, phát lệnh điều động xe cứu thương ${c.dispatch?.vehiclePlate || '65A-012.34'} và gửi cảnh báo trước đến ${c.dispatch?.hospitalName || 'BV Đa khoa TP Cần Thơ'}.` },
            { time: '08:12:10 - 02/10/2026', type: 'HOSPITAL', badge: 'BV PHẢN HỒI', color: '#34d399', user: 'bvdk.tiepnhan', action: `${c.dispatch?.hospitalName || 'BV Đa khoa TP Cần Thơ'} xác nhận sẵn sàng tiếp nhận người bệnh tại Khoa Cấp cứu (A9).` },
            { time: '08:12:45 - 02/10/2026', type: 'STATUS', badge: 'ĐỔI TRẠNG THÁI', color: '#38bdf8', user: crewObj.driver || 'Lê Văn Hùng', action: 'Kíp cấp cứu xác nhận lên xe xuất phát từ trạm, bật còi ưu tiên di chuyển về phía hiện trường.' },
            { time: '08:18:20 - 02/10/2026', type: 'STATUS', badge: 'ĐỔI TRẠNG THÁI', color: '#38bdf8', user: crewObj.doctor || 'BS. Nguyễn Văn Thành', action: 'Xe tiếp cận hiện trường tai nạn tại Khu vực Cầu Hưng Lợi, bắt đầu tiếp cận và thăm khám nạn nhân.' },
            { time: '08:20:00 - 02/10/2026', type: 'MEDICAL', badge: 'Y TẾ', color: '#f472b6', user: crewObj.doctor || 'BS. Nguyễn Văn Thành', action: 'Đo sinh hiệu (HA 130/80, SpO2 97%), băng ép vô trùng cẳng tay phải, đặt nẹp cố định mềm chi trên.' },
            { time: '08:24:10 - 02/10/2026', type: 'STATUS', badge: 'ĐỔI TRẠNG THÁI', color: '#fbbf24', user: crewObj.driver || 'Lê Văn Hùng', action: `Đưa người bệnh lên xe cứu thương an toàn, bắt đầu vận chuyển khẩn cấp về ${c.dispatch?.hospitalName || 'BV Đa khoa TP Cần Thơ'}.` },
            { time: '08:42:00 - 02/10/2026', type: 'HANDOVER', badge: 'BÀN GIAO', color: '#c084fc', user: receiverName, action: 'Xe đến sảnh cấp cứu viện, kíp trực tiến hành bàn giao hồ sơ bệnh án ePCR và người bệnh cho Bác sĩ trực khoa Cấp cứu.' }
          ];

          body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:16px;">
              <!-- TIMELINE NHẬT KÝ SỰ KIỆN DỌC TỪ TRÊN XUỐNG DƯỚI -->
              <div class="form-section">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;border-bottom:1px solid var(--border-main);padding-bottom:10px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:var(--accent-cyan);">⏱</span>
                    <span>TIẾN TRÌNH VÒNG ĐỜI CA CẤP CỨU (DÒNG THỜI GIAN DỌC)</span>
                  </div>
                  <span style="font-size:11.5px;color:var(--text-slate);font-family:var(--font-mono);">Tổng cộng: ${logsList.length} mốc sự kiện · Sắp xếp theo trình tự thời gian</span>
                </div>

                <!-- Khung chứa Timeline Dọc -->
                <div style="position:relative;padding:10px 10px 20px 24px;max-width:1100px;margin:0 auto;">
                  <!-- Trục line dọc xuyên suốt -->
                  <div style="position:absolute;left:42px;top:15px;bottom:20px;width:2px;background:linear-gradient(180deg, #38bdf8 0%, #fbbf24 35%, #34d399 75%, #c084fc 100%);"></div>

                  <!-- Danh sách các node mốc thời gian -->
                  <div style="display:flex;flex-direction:column;gap:22px;">
                    ${logsList.map((l, idx) => {
            let nodeColor = '#38bdf8';
            let iconSymbol = '📞';
            let badgeBg = 'rgba(56,189,248,0.15)';
            let badgeBorder = 'rgba(56,189,248,0.35)';
            let badgeText = 'NHẬN CUỘC GỌI';

            if (l.type === 'CALL' || l.action.toLowerCase().includes('cuộc gọi')) {
              nodeColor = '#38bdf8';
              iconSymbol = '📞';
              badgeBg = 'rgba(56,189,248,0.15)';
              badgeBorder = 'rgba(56,189,248,0.35)';
              badgeText = 'NHẬN CUỘC GỌI';
            } else if (l.type === 'DISPATCH' || l.action.toLowerCase().includes('điều xe') || l.action.toLowerCase().includes('lệnh')) {
              nodeColor = '#fbbf24';
              iconSymbol = '🚨';
              badgeBg = 'rgba(245,158,11,0.15)';
              badgeBorder = 'rgba(245,158,11,0.35)';
              badgeText = 'ĐIỀU ĐỘNG XE';
            } else if (l.type === 'HOSPITAL' || l.action.toLowerCase().includes('sẵn sàng') || l.action.toLowerCase().includes('khoa cấp cứu')) {
              nodeColor = '#10b981';
              iconSymbol = '🏥';
              badgeBg = 'rgba(16,185,129,0.15)';
              badgeBorder = 'rgba(16,185,129,0.35)';
              badgeText = 'BV TIẾP NHẬN';
            } else if (l.type === 'MEDICAL' || l.action.toLowerCase().includes('sinh hiệu') || l.action.toLowerCase().includes('băng')) {
              nodeColor = '#f472b6';
              iconSymbol = '🩹';
              badgeBg = 'rgba(244,114,182,0.15)';
              badgeBorder = 'rgba(244,114,182,0.35)';
              badgeText = 'CAN THIỆP Y TẾ';
            } else if (l.type === 'HANDOVER' || l.action.toLowerCase().includes('bàn giao')) {
              nodeColor = '#c084fc';
              iconSymbol = '🤝';
              badgeBg = 'rgba(192,132,252,0.15)';
              badgeBorder = 'rgba(192,132,252,0.35)';
              badgeText = 'BÀN GIAO TẠI VIỆN';
            } else {
              nodeColor = '#34d399';
              iconSymbol = '🚑';
              badgeBg = 'rgba(52,211,153,0.15)';
              badgeBorder = 'rgba(52,211,153,0.35)';
              badgeText = 'TIẾN TRÌNH DI CHUYỂN';
            }

            const timeStr = l.time.includes('-') ? l.time : formatDT(l.time);

            return `
                        <div style="position:relative;display:flex;align-items:flex-start;gap:22px;">
                          <!-- Node tròn trên trục dọc -->
                          <div style="width:38px;height:38px;border-radius:50%;background:#091726;border:2px solid ${nodeColor};box-shadow:0 0 12px ${nodeColor}55;display:flex;align-items:center;justify-content:center;font-size:15px;z-index:2;flex-shrink:0;">
                            ${iconSymbol}
                          </div>

                          <!-- Khung nội dung sự kiện bên phải -->
                          <div style="flex:1;background:var(--bg-elevated);border:1px solid var(--border-main);border-left:3px solid ${nodeColor};border-radius:8px;padding:14px 18px;box-shadow:0 4px 14px rgba(0,0,0,0.25);">
                            <!-- Hàng tiêu đề của sự kiện: Badge + Thời gian + Tác nhân -->
                            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                              <div style="display:flex;align-items:center;gap:10px;">
                                <span class="badge" style="background:${badgeBg};color:${nodeColor};border:1px solid ${badgeBorder};font-weight:700;font-size:11px;letter-spacing:0.5px;padding:3px 8px;">
                                  ${badgeText}
                                </span>
                                <span style="font-size:12.5px;color:var(--text-white);display:flex;align-items:center;gap:6px;">
                                  <span style="color:var(--text-slate);">Người thực hiện:</span>
                                  <strong style="color:var(--accent-cyan);">${l.user}</strong>
                                </span>
                              </div>
                              <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-slate);background:rgba(255,255,255,0.03);padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.06);">
                                🕒 ${timeStr}
                              </div>
                            </div>

                            <!-- Nội dung chi tiết của sự kiện -->
                            <div style="font-size:13px;color:var(--text-light);line-height:1.55;background:rgba(0,0,0,0.18);padding:10px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.03);">
                              ${l.action}
                            </div>
                          </div>
                        </div>
                      `;
          }).join('')}
                  </div>
                </div>
              </div>

            </div>
          `;
        }
      };

      // Gắn sự kiện chuyển tab
      modalOverlay.querySelectorAll('.panel-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          modalOverlay.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderTab(btn.getAttribute('data-tab'));
        });
      });

      // Render tab mặc định: Tab Tổng quan
      renderTab('tab-overview');

      const closeModal = () => modalOverlay.classList.remove('active');
      modalOverlay.querySelector('#btn-close-case-modal')?.addEventListener('click', closeModal);
      modalOverlay.querySelector('#btn-close-case-modal-footer')?.addEventListener('click', closeModal);

      // Nghe nhanh ghi âm từ header/footer
      modalOverlay.querySelector('#btn-call-audio-quick')?.addEventListener('click', () => {
        window.CCNV_UI.SoundFx.playBeep();
        window.CCNV_UI.Toast.show('Đang phát ghi âm', `Phát bản ghi âm cuộc gọi 115 tiếp nhận lúc ${callTime}`);
      });

      // Nút Xác nhận bàn giao trực tiếp từ Modal
      modalOverlay.querySelector('#btn-handover-case-modal')?.addEventListener('click', () => {
        c.status = 'COMPLETED';
        c.statusText = 'Hoàn tất';
        c.stageLabel = 'Đã bàn giao tại viện';
        c.hospitalResponse = 'ACCEPTED';
        c.hospitalResponseText = 'Đã bàn giao';
        const plate = c.dispatch?.vehiclePlate;
        if (plate) {
          window.StateManager.updateVehicle(plate, { status: 'READY', statusText: 'Sẵn sàng', speed: 0 });
        }
        window.StateManager.saveToSession();
        window.StateManager.addCaseLog(c.id, `Khoa Cấp cứu xác nhận tiếp nhận & ký biên bản bàn giao. Ca chuyển sang Hoàn tất.`);
        window.StateManager.addAuditLog(`Xác nhận tiếp nhận & bàn giao hoàn tất ca ${c.code}`);
        window.CCNV_UI.Toast.show('Đã Bàn Giao Thành Công', `Ca ${c.code} đã hoàn tất bàn giao. Xe ${plate || ''} sẵn sàng nhận nhiệm vụ mới.`);
        closeModal();
        const mainViewport = document.getElementById('main-content-viewport');
        if (mainViewport) this.renderCasesListView(mainViewport);
      });

      // Nút In PDF từ Modal
      modalOverlay.querySelector('#btn-print-case-modal')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Xuất Hồ sơ PDF', `Đang kết xuất phiếu cấp cứu ngoại viện cho ca ${c.code}...`);
        setTimeout(() => window.print(), 800);
      });
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
