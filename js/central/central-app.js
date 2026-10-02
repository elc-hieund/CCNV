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
        // --- DISPATCHER ACCORDION (TRUNG TÂM ĐIỀU HÀNH - SITEMAP 8.1) ---
        const isCallCenterActive = ['call-current', 'call-history', 'call-directory', 'call-transfer', 'call-center'].includes(this.currentMenu);
        const isEmergencyActive = ['cases-list', 'coordination', 'case-lookup'].includes(this.currentMenu);
        const isReceivingActive = ['receiving-incoming', 'receiving-handover', 'receiving-status', 'receiving-specialty', 'receiving-report-detail', 'receiving-report-stats'].includes(this.currentMenu);
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

          <!-- 2. CẤP CỨU [Nhóm menu] -->
          <div class="nav-parent-item ${isEmergencyActive ? 'active expanded' : ''}" data-nav-group="emergency" title="Cấp cứu">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.ambulance}</span>
            <span class="nav-parent-label">Cấp cứu</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'cases-list' ? 'active' : ''}" data-menu="cases-list">Danh sách ca</div>
            <div class="nav-subitem ${this.currentMenu === 'coordination' ? 'active' : ''}" data-menu="coordination">Liên lạc & phối hợp</div>
            <div class="nav-subitem ${this.currentMenu === 'case-lookup' ? 'active' : ''}" data-menu="case-lookup">Tra cứu hồ sơ</div>
          </div>

          <!-- 3. TIẾP NHẬN HỒ SƠ [Nhóm menu] (phần bệnh viện tiếp nhận của BVĐK) -->
          <div class="nav-parent-item ${isReceivingActive ? 'active expanded' : ''}" data-nav-group="receiving" title="Tiếp nhận hồ sơ (BVĐK)">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.hospital}</span>
            <span class="nav-parent-label">Tiếp nhận hồ sơ</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'receiving-incoming' ? 'active' : ''}" data-menu="receiving-incoming">Ca đang đến</div>
            <div class="nav-subitem ${this.currentMenu === 'receiving-handover' ? 'active' : ''}" data-menu="receiving-handover">Tiếp nhận & bàn giao</div>
            <div class="nav-subitem ${this.currentMenu === 'receiving-status' ? 'active' : ''}" data-menu="receiving-status">Cập nhật trạng thái tiếp nhận</div>
            <div class="nav-subitem ${this.currentMenu === 'receiving-specialty' ? 'active' : ''}" data-menu="receiving-specialty">Khai báo chuyên khoa</div>
            <div class="nav-subitem ${this.currentMenu === 'receiving-report-detail' ? 'active' : ''}" data-menu="receiving-report-detail">Báo cáo chi tiết</div>
            <div class="nav-subitem ${this.currentMenu === 'receiving-report-stats' ? 'active' : ''}" data-menu="receiving-report-stats">Thống kê tiếp nhận</div>
          </div>

          <!-- 4. GIÁM SÁT [Nhóm menu] -->
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
        // 2. Cấp cứu
        'cases-list': 'Danh sách Ca Cấp cứu đang xử lý',
        'coordination': 'Liên lạc & Phối hợp Liên ngành',
        'case-lookup': 'Tra cứu Hồ sơ Ca Cấp cứu',
        // 3. Tiếp nhận hồ sơ (BVĐK)
        'receiving-incoming': 'Tiếp nhận Hồ sơ — Ca đang đến Bệnh viện',
        'receiving-handover': 'Biên bản Bàn giao & Tiếp nhận Bệnh nhân',
        'receiving-status': 'Cập nhật Trạng thái Tiếp nhận Bệnh viện',
        'receiving-specialty': 'Khai báo Chuyên khoa & Năng lực Tiếp nhận',
        'receiving-report-detail': 'Báo cáo Chi tiết Ca đã tiếp nhận',
        'receiving-report-stats': 'Thống kê Tiếp nhận Bệnh viện',
        // 4. Giám sát
        'realtime-map': 'Bản đồ Realtime (GIS)',
        'vehicles-status': 'Tình trạng Xe cứu thương',
        'crews-status': 'Tình trạng Kíp trực',
        'hospitals-status': 'Mạng lưới Bệnh viện Tiếp nhận',
        // 5. Ca trực
        'shifts-assignment': 'Phân công Ca trực & Thành viên Kíp',
        'shifts-calendar': 'Lịch trực Ban 24/7 Các Trạm Vệ tinh',
        'shifts-schedule': 'Phân công & Lịch trực Ban',
        // 6. Báo cáo
        'reports-overview': 'Báo cáo Tổng quan & Đo lường KPI',
        'reports-detail': 'Báo cáo Chi tiết & Thời gian Xử lý Ca',
        'reports-stats': 'Báo cáo Thống kê & Phân tích Dữ liệu',
        'reports': 'Báo cáo Tổng hợp & Đo lường KPI',
        // 7. Danh mục & cấu hình
        'cat-vehicles': 'Danh mục Xe cứu thương',
        'cat-hospitals': 'Danh mục Bệnh viện & Cơ sở Y tế',
        'cat-directory': 'Quản lý Danh bạ Bệnh viện',
        'cat-incidents': 'Danh mục Loại tình huống Cấp cứu',
        'cat-statuses': 'Danh mục Trạng thái Xe & Ca',
        'cat-equipment': 'Danh mục Trang thiết bị trên Xe',
        'cat-close-reasons': 'Danh mục Lý do Kết thúc Ca',
        'cat-templates': 'Cấu hình Mẫu biểu & Phiếu ePCR',
        'categories': 'Danh mục Dữ liệu dùng chung',
        // 8. Quản trị hệ thống
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

        // 2. Cấp cứu
        case 'cases-list':
          this.renderCasesListView(container);
          break;
        case 'coordination':
          this.renderCoordinationView(container);
          break;
        case 'case-lookup':
          this.renderCaseLookupView(container);
          break;

        // 3. Tiếp nhận hồ sơ (BVĐK)
        case 'receiving-incoming':
          this.renderReceivingIncomingView(container);
          break;
        case 'receiving-handover':
          this.renderHospitalHandoverView(container);
          break;
        case 'receiving-status':
          this.renderHospitalReceptionStatusView(container);
          break;
        case 'receiving-specialty':
          this.renderHospitalSpecialtyView(container);
          break;
        case 'receiving-report-detail':
          this.renderHospitalReportDetailView(container);
          break;
        case 'receiving-report-stats':
          this.renderHospitalReportStatsView(container);
          break;

        // 4. Giám sát
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
      const activeCases = state.activeCases || [];
      let currentSelectedPlate = '65A-012.34';
      const initialVeh = vehicles.find(v => v.plate === currentSelectedPlate) || vehicles[0];
      const initialCase = activeCases.find(c => c.dispatch?.vehiclePlate === initialVeh?.plate);

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

      // Mount Can Tho SVG Map
      this.mapInstance = new window.CanThoMap('cantho-map-viewport');
      this.mapInstance.render();

      const listEl = container.querySelector('#vehicle-card-list');

      // Helper to update selected vehicle & bottom strip
      const updateSelectedVehicle = (plate) => {
        currentSelectedPlate = plate;
        const targetVeh = vehicles.find(v => v.plate === plate);
        if (!targetVeh) return;

        // 1. Update selection styling on list
        if (listEl) {
          listEl.querySelectorAll('.vehicle-card').forEach(c => {
            if (c.getAttribute('data-plate') === plate) {
              c.classList.add('is-selected');
              c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
              c.classList.remove('is-selected');
            }
          });
        }

        // 2. Find active case if any
        const currentCase = activeCases.find(c => c.dispatch?.vehiclePlate === plate);

        // 3. Update bottom strip
        const bottomStrip = container.querySelector('#realtime-bottom-strip');
        if (bottomStrip) {
          bottomStrip.innerHTML = this.renderRealtimeBottomStrip(targetVeh, currentCase);

          // Re-bind focus button in bottom strip
          bottomStrip.querySelector('.btn-focus-selected-vehicle')?.addEventListener('click', () => {
            if (this.mapInstance) {
              this.mapInstance.showVehiclePopup(plate);
            }
          });
        }

        // 4. Focus vehicle on map
        if (this.mapInstance) {
          this.mapInstance.showVehiclePopup(plate);
        }
      };

      // Bind vehicle card clicks
      const bindCardClicks = () => {
        if (!listEl) return;
        listEl.querySelectorAll('.vehicle-card').forEach(card => {
          card.addEventListener('click', () => {
            const plate = card.getAttribute('data-plate');
            if (plate) {
              updateSelectedVehicle(plate);
            }
          });
        });
      };
      bindCardClicks();

      // Hook map marker clicks (vehicles, incident, hospitals)
      if (this.mapInstance) {
        this.mapInstance.onVehicleSelect = (plate) => {
          updateSelectedVehicle(plate);
        };

        this.mapInstance.onIncidentSelect = () => {
          updateSelectedVehicle('65A-012.34');
          const bottomStrip = container.querySelector('#realtime-bottom-strip');
          if (bottomStrip) {
            bottomStrip.innerHTML = this.renderRealtimeIncidentBottomStrip();
            bottomStrip.querySelector('.btn-focus-incident-vehicle')?.addEventListener('click', () => {
              updateSelectedVehicle('65A-012.34');
            });
          }
        };

        this.mapInstance.onHospitalSelect = (hid) => {
          const h = (state.hospitals || []).find(item => item.id === hid);
          if (!h) return;
          const bottomStrip = container.querySelector('#realtime-bottom-strip');
          if (bottomStrip) {
            bottomStrip.innerHTML = this.renderRealtimeHospitalBottomStrip(h);
            bottomStrip.querySelector('.btn-call-hosp-bottom')?.addEventListener('click', () => {
              window.CCNV_UI.Toast.show('Đang quay số...', `Kết nối Hotline Cấp cứu: ${h.name} (${h.hotline})`);
            });
          }
        };
      }

      // Initial binding for focus button in bottom strip
      container.querySelector('#realtime-bottom-strip .btn-focus-selected-vehicle')?.addEventListener('click', () => {
        if (this.mapInstance) {
          this.mapInstance.showVehiclePopup(currentSelectedPlate);
        }
      });

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
                  <span>${c.patient?.symptom}</span>
                  <span>Xe: <strong style="color:var(--yellow-vivid);font-family:var(--font-mono);">${c.dispatch?.vehiclePlate}</strong></span>
                </div>
                <div class="vehicle-meta-row" style="border-top:1px dashed var(--border-main);padding-top:4px;margin-top:4px;">
                  <span style="font-size:11px;color:var(--text-muted);">Đến: ${c.dispatch?.hospitalName}</span>
                  <span style="color:var(--yellow-vivid);font-weight:600;">ETA: ${c.eta}</span>
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
                <strong style="color:var(--red-vivid);font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Cảnh báo Cấp cứu Khẩn cấp</strong>
              </div>
              <div style="font-size:13px;color:var(--text-white);">
                Xe <strong style="color:var(--red-vivid);font-family:var(--font-mono);">${v.plate}</strong> đang vận chuyển ${patientDesc} về ${destHospital}
              </div>
              <div style="font-size:11px;color:var(--text-muted);">
                Vị trí: ${locationText} · Tốc độ: <strong style="color:var(--text-white);">${v.speed} km/h</strong> · ETA: <strong style="color:var(--yellow-vivid);">${etaText}</strong>
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

    renderRealtimeIncidentBottomStrip() {
      const leftStripHtml = `
        <div class="emergency-alert-strip" style="background: linear-gradient(90deg, rgba(229, 37, 33, 0.22) 0%, transparent 100%);">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span class="live-dot"></span>
              <strong style="color:var(--red-vivid);font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Điểm Hiện Trường Cấp Cứu Khẩn Cấp</strong>
            </div>
            <div style="font-size:13px;color:var(--text-white);">
              Hiện trường: <strong style="color:var(--red-vivid);">Cầu Hưng Lợi</strong> — Tai nạn giao thông (BN Phan Văn Đức 34T)
            </div>
            <div style="font-size:11px;color:var(--text-muted);">
              Xe phụ trách: <strong style="color:var(--yellow-vivid);font-family:var(--font-mono);">65A-012.34</strong> (Kíp Cái Răng) · Hướng di chuyển: Về BVĐK TP Cần Thơ · ETA: ~6 phút
            </div>
          </div>
          <button class="btn btn-emergency btn-sm btn-focus-incident-vehicle" data-plate="65A-012.34">Theo Dõi Xe</button>
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
            <div style="color:var(--text-muted);font-size:11px;">Xe 65A-012.34 · 25 FPS · 1080p</div>
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
              Tiếp nhận cuộc gọi thoại 115, tín hiệu SOS từ App Người dân, tích hợp Cell-ID và đàm thoại ghi âm
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



      // --- TAB 1: CUỘC GỌI HIỆN TẠI (ACTIVE CALL & INTAKE FORM) ---
      if (activeTab === 'active') {
        paneContainer.innerHTML = `
          <div style="display:grid;grid-template-columns: 420px 1fr; gap:16px; align-items:start;">
            <!-- Left: Active Call Card & Audio Waveform Player -->
            <div style="display:flex;flex-direction:column;gap:14px;">
              <!-- Call Status Card -->
              <div class="content-card" style="border-left:4px solid var(--red-vivid);padding:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                  <span class="status-pill status-pill-new" style="display:flex;align-items:center;gap:6px;font-weight:700;">
                    <span class="live-dot"></span> ĐANG ĐÀM THOẠI [01:42]
                  </span>
                  <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">Kênh 115 Thoại</span>
                </div>

                <div style="font-size:18px;font-weight:700;color:var(--text-white);margin-bottom:4px;font-family:var(--font-mono);">
                  ${activeCall.callerPhone}
                </div>
                <div style="font-size:13px;color:#93C5FD;font-weight:600;margin-bottom:10px;">
                  Người gọi: ${activeCall.callerName} (Định danh Viettel Telecom)
                </div>

                <div style="background:var(--bg-elevated);padding:10px;border-radius:6px;border:1px solid var(--border-main);margin-bottom:12px;font-size:12px;">
                  <div style="color:var(--text-muted);margin-bottom:2px;">Vị trí Cell-ID ước tính:</div>
                  <div style="color:var(--text-white);font-weight:500;">
                    BTS VTT-NK04 · P. Hưng Lợi, Q. Ninh Kiều, Cần Thơ (±85m)
                  </div>
                </div>

                <!-- Call Control Actions -->
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <button class="btn btn-default btn-sm" id="btn-call-hold" style="flex:1;">
                    <span>Giữ cuộc gọi</span>
                  </button>
                  <button class="btn btn-default btn-sm" id="btn-call-transfer-quick" style="flex:1;">
                    <span>Chuyển máy</span>
                  </button>
                  <button class="btn btn-ghost btn-sm" id="btn-call-hangup" style="color:var(--red-vivid);">
                    <span>Gác máy</span>
                  </button>
                </div>
              </div>

              <!-- Audio Recording Player Card -->
              <div class="content-card" style="padding:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                  <span style="font-size:13px;font-weight:600;color:var(--text-white);display:flex;align-items:center;gap:6px;">
                    ${window.CCNV_UI.ICONS.radio}
                    <span>Ghi âm cuộc gọi thời gian thực</span>
                  </span>
                  <span style="font-size:11px;color:#10B981;font-weight:600;">REC ● 01:42</span>
                </div>

                <!-- Dynamic Waveform Visualizer -->
                <div style="background:var(--bg-main);border-radius:6px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:3px;height:50px;border:1px solid var(--border-main);margin-bottom:10px;">
                  ${[15, 28, 40, 22, 35, 18, 45, 30, 20, 38, 25, 12, 32, 42, 28, 16, 36, 44, 26, 18, 30, 40, 22, 14].map(h => `
                    <div style="flex:1;background:linear-gradient(to top, #3B82F6, #60A5FA);height:${h}px;border-radius:2px;opacity:0.85;"></div>
                  `).join('')}
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:10px;">
                  <span>01:42</span>
                  <span>Tổng thời lượng: 03:10</span>
                </div>

                <div style="background:rgba(30, 41, 59, 0.7);padding:8px 12px;border-radius:6px;font-size:12px;color:var(--text-slate);border-left:2px solid #3B82F6;margin-bottom:12px;">
                  <em>"Bệnh nhân ngã xe máy bất tỉnh khoảng 2 phút, hiện đang thở dốc, chảy máu nhiều vùng trán..."</em>
                </div>

                <div style="display:flex;gap:8px;">
                  <button class="btn btn-default btn-sm" id="btn-audio-pause-play" style="flex:1;">
                    <span>Tạm dừng ghi</span>
                  </button>
                  <button class="btn btn-default btn-sm" id="btn-audio-download">
                    <span>Tải tệp ghi âm</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Right: In-call Intake Form (Form Nhập Thông Tin Tiếp Nhận Cuộc Gọi) -->
            <div class="content-card" style="padding:18px;">
              <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-main);padding-bottom:10px;margin-bottom:14px;">
                <div>
                  <h3 style="color:var(--text-white);font-size:15px;margin-bottom:2px;">Biểu mẫu Tiếp nhận Thông tin Cuộc gọi</h3>
                  <p style="font-size:12px;color:var(--text-muted);">Ghi nhận nhanh thông tin hiện trường, bệnh nhân và tình huống cấp cứu</p>
                </div>
                <span class="badge badge-normal" style="font-size:11px;">Mã tạm: #CALL-${Date.now().toString().slice(-4)}</span>
              </div>

              <!-- 1. Caller Info Grid -->
              <div class="form-section" style="margin-bottom:14px;">
                <div class="form-section-title">1. Thông tin Người báo tin & Kênh tiếp nhận</div>
                <div class="form-grid-3">
                  <div class="form-field">
                    <label class="form-label">Người báo tin</label>
                    <input type="text" id="intake-caller-name" value="${activeCall.callerName}" />
                  </div>
                  <div class="form-field">
                    <label class="form-label">Số điện thoại</label>
                    <input type="text" id="intake-caller-phone" value="${activeCall.callerPhone}" />
                  </div>
                  <div class="form-field">
                    <label class="form-label">Kênh tiếp nhận</label>
                    <select id="intake-call-channel">
                      <option value="VOICE" selected>115 Thoại trực tiếp</option>
                      <option value="APP">App Người dân SOS</option>
                      <option value="113">Chuyển từ Công an 113</option>
                      <option value="114">Chuyển từ Cứu hỏa 114</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- 2. Patient Info Grid -->
              <div class="form-section" style="margin-bottom:14px;">
                <div class="form-section-title">2. Thông tin Bệnh nhân / Nạn nhân</div>
                <div class="form-grid-3">
                  <div class="form-field">
                    <label class="form-label">Họ tên Bệnh nhân</label>
                    <input type="text" id="intake-patient-name" value="${activeCall.patientName}" />
                  </div>
                  <div class="form-field">
                    <label class="form-label">Tuổi ước tính</label>
                    <input type="number" id="intake-patient-age" value="${activeCall.patientAge}" />
                  </div>
                  <div class="form-field">
                    <label class="form-label">Giới tính</label>
                    <select id="intake-patient-gender">
                      <option value="Nam" ${activeCall.patientGender === 'Nam' ? 'selected' : ''}>Nam</option>
                      <option value="Nữ" ${activeCall.patientGender === 'Nữ' ? 'selected' : ''}>Nữ</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- 3. Location Field -->
              <div class="form-section" style="margin-bottom:14px;">
                <div class="form-section-title">3. Hiện trường & Định vị Tọa độ</div>
                <div class="form-field">
                  <label class="form-label">Địa chỉ hiện trường</label>
                  <input type="text" id="intake-location-address" value="${activeCall.address}" style="width:100%;" />
                </div>
              </div>

              <!-- 4. Incident Type & Symptoms -->
              <div class="form-section" style="margin-bottom:18px;">
                <div class="form-section-title">4. Tình huống Cấp cứu & Triệu chứng ban đầu</div>
                <div class="form-grid-2" style="margin-bottom:10px;">
                  <div class="form-field">
                    <label class="form-label">Loại tình huống cấp cứu</label>
                    <select id="intake-incident-select">
                      ${incidentTypes.map(inc => `
                        <option value="${inc.code}" ${inc.code === activeCall.incidentCode ? 'selected' : ''}>
                          ${inc.name} [${inc.suggestedType}]
                        </option>
                      `).join('')}
                    </select>
                  </div>
                  <div class="form-field">
                    <label class="form-label">Mức độ Ưu tiên</label>
                    <select id="intake-severity-select">
                      <option value="CRITICAL" ${activeCall.severity === 'CRITICAL' ? 'selected' : ''}>🔴 Tối khẩn (Nguy kịch, ưu tiên 1)</option>
                      <option value="EMERGENCY" ${activeCall.severity === 'EMERGENCY' ? 'selected' : ''}>🟡 Khẩn cấp (Ưu tiên 2)</option>
                      <option value="URGENT">🟢 Tiêu chuẩn (Ưu tiên 3)</option>
                    </select>
                  </div>
                </div>
                <div class="form-field">
                  <label class="form-label">Triệu chứng & Diễn biến qua điện thoại</label>
                  <textarea id="intake-symptoms-notes" rows="2">${activeCall.notes}</textarea>
                </div>
              </div>

              <!-- Primary Actions Bar -->
              <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border-main);padding-top:14px;flex-wrap:wrap;gap:10px;">
                <div style="display:flex;gap:8px;">
                  <button class="btn btn-default" id="btn-intake-save-consult">
                    <span>Lưu tư vấn y tế & Đóng</span>
                  </button>
                  <button class="btn btn-default" id="btn-intake-fast-transfer">
                    <span>Chuyển tiếp 113 / 114</span>
                  </button>
                </div>
                <button class="btn btn-emergency btn-lg" id="btn-intake-create-and-dispatch">
                  ${window.CCNV_UI.ICONS.ambulance}
                  <span>TẠO CA CẤP CỨU & MỞ FORM ĐIỀU XE (F1)</span>
                </button>
              </div>
            </div>
          </div>
        `;



        paneContainer.querySelector('#btn-intake-create-and-dispatch')?.addEventListener('click', () => {
          const prefill = {
            callerName: paneContainer.querySelector('#intake-caller-name').value,
            callerPhone: paneContainer.querySelector('#intake-caller-phone').value,
            patientName: paneContainer.querySelector('#intake-patient-name').value,
            patientAge: paneContainer.querySelector('#intake-patient-age').value,
            patientGender: paneContainer.querySelector('#intake-patient-gender').value,
            address: paneContainer.querySelector('#intake-location-address').value,
            incidentCode: paneContainer.querySelector('#intake-incident-select').value,
            notes: paneContainer.querySelector('#intake-symptoms-notes').value
          };
          window.CCNV_UI.Toast.show('Nạp dữ liệu vào Lệnh Điều Động', 'Mở drawer tạo ca cấp cứu với dữ liệu đã tiếp nhận từ cuộc gọi');
          this.openCreateCaseDrawer(prefill);
        });

        paneContainer.querySelector('#btn-intake-save-consult')?.addEventListener('click', () => {
          window.StateManager.addAuditLog(`Đóng cuộc gọi tư vấn y tế cho ${activeCall.callerPhone}`);
          window.CCNV_UI.Toast.show('Đã lưu cuộc gọi', 'Ghi nhận cuộc gọi tư vấn y tế thành công');
        });

        paneContainer.querySelector('#btn-intake-fast-transfer')?.addEventListener('click', () => {
          this.renderCallCenterView(container, 'transfer');
        });

        paneContainer.querySelector('#btn-call-hangup')?.addEventListener('click', () => {
          window.CCNV_UI.Toast.show('Đã kết thúc cuộc gọi', 'Cuộc gọi từ số 0913.882.115 đã được gác máy');
        });
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
                <span class="badge badge-normal" style="font-size:11px;">Mẫu báo cáo chuẩn</span>
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
            { label: '🔴 Tối khẩn (Đỏ)', value: 'CRITICAL', filterFn: item => item.severity === 'CRITICAL' },
            { label: '🟡 Khẩn cấp (Vàng)', value: 'EMERGENCY', filterFn: item => item.severity === 'EMERGENCY' },
            { label: '🟢 Tiêu chuẩn (Xanh)', value: 'ROUTINE', filterFn: item => item.severity === 'ROUTINE' },
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
                    <strong style="color:#10B981;font-size:13.5px;display:block;">🟢 ĐANG TIẾP NHẬN BÌNH THƯỜNG</strong>
                    <span style="font-size:12px;color:var(--text-slate);">Khoa Cấp cứu và các buồng hồi sức sẵn sàng đón mọi ca cấp cứu</span>
                  </div>
                </label>

                <label style="display:flex;align-items:center;gap:12px;padding:12px;background:${hosp.status === 'LIMITED' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-elevated)'};border:2px solid ${hosp.status === 'LIMITED' ? '#F59E0B' : 'var(--border-main)'};border-radius:8px;cursor:pointer;">
                  <input type="radio" name="hosp-status-opt" value="LIMITED" ${hosp.status === 'LIMITED' ? 'checked' : ''} style="width:16px;height:16px;" />
                  <div>
                    <strong style="color:#F59E0B;font-size:13.5px;display:block;">🟡 HẠN CHẾ TIẾP NHẬN (CẢNH BÁO)</strong>
                    <span style="font-size:12px;color:var(--text-slate);">Giường hồi sức cấp cứu đạt trên 90%, chỉ nhận ca tối khẩn nguy kịch</span>
                  </div>
                </label>

                <label style="display:flex;align-items:center;gap:12px;padding:12px;background:${hosp.status === 'SUSPENDED' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-elevated)'};border:2px solid ${hosp.status === 'SUSPENDED' ? 'var(--red-vivid)' : 'var(--border-main)'};border-radius:8px;cursor:pointer;">
                  <input type="radio" name="hosp-status-opt" value="SUSPENDED" ${hosp.status === 'SUSPENDED' ? 'checked' : ''} style="width:16px;height:16px;" />
                  <div>
                    <strong style="color:var(--red-vivid);font-size:13.5px;display:block;">🔴 TẠM NGƯNG TIẾP NHẬN NGOẠI VIỆN</strong>
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
