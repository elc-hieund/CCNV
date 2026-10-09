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
      this.demoRunning = false;
      this.hospitalDemoRunning = false;
      this.hospitalAlertTriggered = false;
      this.demo = null;
      this.caseTabOffset = 0;
      this.activeCameraMode = 'FRONT'; // 'FRONT' (Cam trước) hoặc 'REAR' (Cam sau/khoang)
    }

    async init() {
      // Tắt toàn bộ thông báo popup toast ở app trung tâm
      if (window.CCNV_UI && window.CCNV_UI.Toast) {
        window.CCNV_UI.Toast.show = () => { };
      }

      // 1. Initialize State
      await window.StateManager.init();

      const currentUser = window.StateManager.getCurrentUser();
      const isHospital = currentUser?.role === 'HOSPITAL_RECEIVER';
      if (isHospital) {
        this.currentMenu = 'hospital-map';
        document.body.classList.add('hospital-mode');
        // Mặc định ở màn Bệnh viện tiếp nhận: Không có ca nào, chỉ hiện vị trí bệnh viện
        try { sessionStorage.removeItem('ccnv_hospital_confirmed'); } catch (e) { }
        this.hospitalDemoRunning = false;
        this.hospitalAlertTriggered = false;
        this.resetAllToReady();
      } else {
        document.body.classList.remove('hospital-mode');
        this.currentMenu = 'realtime-map';
        this.realtimeSelectedPlate = null;
        if (!this.demoRunning) {
          this.resetAllToReady();
        }
      }

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
          this.currentMenu = (role === 'HOSPITAL_RECEIVER') ? 'hospital-map' : 'realtime-map';
          this.closeCaseDetailModal();
          this.renderCurrentView();
        } else if (event === 'CASE_CREATED' || event === 'CASE_UPDATED' || event === 'PATIENT_UPDATED' || event === 'STORAGE_SYNC') {
          const isModalOpen = Boolean(document.getElementById('case-detail-modal-overlay')?.classList.contains('active'));
          if (['cases-list', 'hospital-cases', 'hospital-incoming', 'hospital-map', 'realtime-map'].includes(this.currentMenu)) {
            this.renderCurrentView({ keepModal: isModalOpen });
          }
          // If case detail modal is open for this case, refresh it live
          if (isModalOpen && this.selectedCaseId) {
            const currentC = window.StateManager.getState().cases.find(item => item.id === this.selectedCaseId || item.code === this.selectedCaseId);
            if (currentC) {
              this.openCaseDetailModal(currentC.id, currentC);
            }
          }
          // Toast notification on Central for patient sync from Driver app
          if (event === 'PATIENT_UPDATED' && payload?.patient) {
            if (window.CCNV_UI?.Toast) {
              const p = payload.patient;
              const vehText = payload.vehiclePlate ? `Xe ${payload.vehiclePlate} · ` : '';
              window.CCNV_UI.Toast.show(
                'ĐỒNG BỘ THÔNG TIN BỆNH NHÂN (ePCR)',
                `${vehText}Đã cập nhật: ${p.name || 'Bệnh nhân'} (${p.age || '-'}T, ${p.gender || '-'}) · Nhóm máu: ${p.bloodType || '-'} · Tiền sử: ${p.history || 'Không'}`,
                true
              );
            }
          }
        } else if (event === 'VEHICLE_SOS' || event === 'SOS_ALERT') {
          // Instant SOS notification received at Central
          if (window.CCNV_UI?.Toast) {
            const plate = payload?.plate || payload?.vehiclePlate || '65A-012.34';
            const reason = payload?.reason || 'Yêu cầu cứu trợ khẩn cấp';
            window.CCNV_UI.Toast.show(
              `CẢNH BÁO SOS TỪ XE ${plate}!`,
              `Lái xe phát tín hiệu SOS khẩn cấp: ${reason}. Tọa độ GPS và tình trạng xe đã được ghim ưu tiên trên bản đồ giám sát.`,
              true
            );
          }
          if (['realtime-map', 'hospital-map', 'cases-list'].includes(this.currentMenu)) {
            this.renderCurrentView();
          }
        }
      });
    }

    initClock() {
      const update = () => {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        const dateStr = `${d}/${m}/${y}`;
        const dtEl = document.getElementById('header-live-datetime');
        if (dtEl) {
          dtEl.innerHTML = `<span id="header-live-date">${dateStr}</span> - <span id="header-live-clock">${timeStr}</span>`;
        } else {
          const timeEl = document.getElementById('header-live-clock');
          const dateEl = document.getElementById('header-live-date');
          if (timeEl) timeEl.textContent = timeStr;
          if (dateEl) dateEl.textContent = dateStr;
        }
      };
      update();
      setInterval(update, 1000);
    }

    formatDateTime(val, fallbackDate = '02/10/2026') {
      if (!val || val === '-') return '-';
      const str = String(val).trim();

      // Match ISO or YYYY-MM-DD: 2026-10-02T08:10:15 or 2026-10-02 08:10:15
      const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
      if (isoMatch) {
        const [, year, month, day, hours, minutes, seconds = '00'] = isoMatch;
        return `${day}/${month}/${year} - ${hours}:${minutes}:${seconds}`;
      }

      // Match time only: HH:mm:ss or HH:mm
      const timeMatch = str.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
      if (timeMatch) {
        const [, hours, minutes, seconds = '00'] = timeMatch;
        return `${fallbackDate} - ${hours}:${minutes}:${seconds}`;
      }

      // Standard Date parsing fallback
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} - ${hours}:${minutes}:${seconds}`;
      }

      return str;
    }

    initLoginScreen() {
      const loginOverlay = document.getElementById('login-screen-overlay');
      const loginForm = document.getElementById('login-form');
      const quickList = document.getElementById('login-quick-accounts-list');
      const state = window.StateManager.getState();
      if (!loginOverlay || !state) return;

      const urlParams = new URLSearchParams(window.location.search);
      const hasUrlParam = urlParams.get('role') || urlParams.get('account') || urlParams.get('user');

      let loggedInUserId = sessionStorage.getItem('ccnv_logged_in_user');
      if (loggedInUserId === 'bvdk.tn') {
        loggedInUserId = 'bvtu.tn';
        sessionStorage.setItem('ccnv_logged_in_user', 'bvtu.tn');
      }
      if (hasUrlParam || (loggedInUserId && state.accounts.some(a => a.id === loggedInUserId))) {
        const activeUser = window.StateManager.getCurrentUser();
        if (activeUser) {
          window.StateManager.setCurrentUser(activeUser.id);
        }
        loginOverlay.classList.add('hidden');
      } else {
        loginOverlay.classList.remove('hidden');
      }

      // Populate Quick Accounts
      if (quickList) {
        quickList.innerHTML = `
          <div class="login-accounts-divider">
            <span>HOẶC CHỌN NHANH TÀI KHOẢN MẪU HỆ THỐNG</span>
          </div>
          ${(state.accounts || []).map(acc => {
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
        }).join('')}
        `;

        quickList.querySelectorAll('.login-quick-account-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
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
          let val = usernameInput ? usernameInput.value.trim() : 'dpv01';
          if (val.toLowerCase() === 'bvdk.tn') val = 'bvtu.tn';
          const matched = (state.accounts || []).find(a => a.username.toLowerCase() === val.toLowerCase() || a.id.toLowerCase() === val.toLowerCase()) || state.accounts[0];
          this.loginAs(matched.id);
        });
      }
    }

    loginAs(accountId) {
      if (accountId === 'bvdk.tn') accountId = 'bvtu.tn';
      const state = window.StateManager.getState();
      const acc = state.accounts.find(a => a.id === accountId) || state.accounts.find(a => a.role === 'HOSPITAL_RECEIVER') || state.accounts[0];
      sessionStorage.setItem('ccnv_logged_in_user', acc.id);
      window.StateManager.setCurrentUser(acc.id);

      const loginOverlay = document.getElementById('login-screen-overlay');
      if (loginOverlay) loginOverlay.classList.add('hidden');

      this.updateHeaderProfile();
      this.renderSidebar();

      const role = acc.role;
      this.currentMenu = (role === 'HOSPITAL_RECEIVER') ? 'hospital-map' : 'realtime-map';
      this.renderCurrentView();

      window.CCNV_UI.Toast.show(
        'Đăng nhập thành công',
        `Chào mừng ${acc.fullName} (${acc.roleName} · ${acc.organization})`
      );
    }

    updateHeaderProfile() {
      const user = window.StateManager.getCurrentUser();
      if (!user) return;

      const isHospital = user.role === 'HOSPITAL_RECEIVER';
      document.body.classList.toggle('hospital-mode', isHospital);

      const brandTitleEl = document.querySelector('.sidebar-brand-title');
      if (brandTitleEl) {
        brandTitleEl.innerHTML = isHospital
          ? 'CỔNG TIẾP NHẬN<br> & CẤP CỨU'
          : 'TRUNG TÂM GIÁM SÁT<br> & ĐIỀU HÀNH';
      }
      document.title = isHospital
        ? 'CỔNG TIẾP NHẬN & CẤP CỨU — BỆNH VIỆN TIẾP NHẬN'
        : 'TRUNG TÂM GIÁM SÁT & ĐIỀU HÀNH — THÀNH PHỐ CẦN THƠ';

      const avatarEl = document.getElementById('header-user-avatar');
      const logoutBtn = document.getElementById('btn-logout');

      if (avatarEl) avatarEl.textContent = user.avatar || user.fullName.split(' ').pop().slice(0, 2).toUpperCase();
      if (logoutBtn) {
        logoutBtn.title = `${user.fullName} (${isHospital ? 'Tiếp nhận Bệnh viện' : 'Điều phối viên 115'}) - Click để Đăng xuất`;
      }

      // Demo: Khả dụng cho cả Trung tâm và Bệnh viện tiếp nhận
      const demoBtn = document.getElementById('btn-demo-start');
      if (demoBtn) {
        if (isHospital) {
          demoBtn.title = this.hospitalDemoRunning
            ? 'Kết thúc demo tiếp nhận bệnh nhân'
            : 'Bắt đầu demo: Thông báo nhận bệnh nhân → Xác nhận / Xem chi tiết → Hiển thị ca tiếp nhận';
          this.setDemoButton(Boolean(this.hospitalDemoRunning));
        } else {
          demoBtn.title = this.demoRunning
            ? 'Kết thúc ca demo và đưa tất cả xe về trạng thái sẵn sàng'
            : 'Chạy kịch bản demo: cuộc gọi đến → nhập thông tin → điều xe trên bản đồ';
          this.setDemoButton(Boolean(this.demoRunning));
        }
      } else {
        this.setDemoButton(isHospital ? Boolean(this.hospitalDemoRunning) : Boolean(this.demoRunning));
      }

      // Ẩn thanh stats header cho tài khoản bệnh viện tiếp nhận nếu cần
      const headerStats = document.getElementById('header-stats-widget');
      if (headerStats) {
        headerStats.style.display = isHospital ? 'none' : 'flex';
      }

      if (logoutBtn && !logoutBtn._bound) {
        logoutBtn._bound = true;
        logoutBtn.addEventListener('click', () => {
          sessionStorage.removeItem('ccnv_logged_in_user');
          sessionStorage.removeItem('ccnv_hospital_confirmed');
          this.hospitalDemoRunning = false;
          this.realtimeSelectedPlate = null;
          document.body.classList.remove('hospital-mode');
          const loginOverlay = document.getElementById('login-screen-overlay');
          if (loginOverlay) loginOverlay.classList.remove('hidden');
          window.CCNV_UI.Toast.show('Đã đăng xuất', 'Vui lòng chọn hoặc nhập tài khoản để đăng nhập lại.');
        });
      }
    }

    updateKpiBar() {
      const state = window.StateManager.getState();
      if (!state) return;

      const user = window.StateManager.getCurrentUser();
      const isHospital = user?.role === 'HOSPITAL_RECEIVER';
      document.body.classList.toggle('hospital-mode', isHospital);

      const headerStats = document.getElementById('header-stats-widget');
      if (headerStats) {
        headerStats.style.display = isHospital ? 'none' : 'flex';
      }
      if (isHospital) return;

      // Bảo đảm loại bỏ triệt để mọi tàn dư xe cũ nếu có
      if (Array.isArray(state.vehicles)) {
        const cleaned = state.vehicles.filter(v => v.plate !== '65A-017.22' && v.plate !== '65A-015.67');
        if (cleaned.length !== state.vehicles.length) {
          state.vehicles = cleaned;
          window.StateManager.saveToSession?.();
        }
      }

      const vehicles = state.vehicles || [];
      const totalVehicles = vehicles.length;
      const readyVehicles = vehicles.filter(v => v.status === 'AVAILABLE' || v.status === 'READY' || (v.status !== 'MAINTENANCE' && v.status !== 'EMERGENCY')).length;
      const emergencyVehicles = vehicles.filter(v => v.status === 'EMERGENCY').length;

      // Cập nhật Số xe sẵn sàng / Tổng số xe & Xe đang cấp cứu
      const statReadyEl = document.getElementById('header-stat-ready');
      const statEmergEl = document.getElementById('header-stat-emergency');
      if (statReadyEl) statReadyEl.textContent = `${String(readyVehicles).padStart(2, '0')}/${String(totalVehicles).padStart(2, '0')}`;
      if (statEmergEl) statEmergEl.textContent = String(emergencyVehicles).padStart(2, '0');

      // Ca đang xử lý (chỉ lấy ca đang trực tiếp xử lý/active trong state.cases)
      const activeCasesList = (state.cases || []).filter(c => c.status !== 'CANCELLED' && c.status !== 'COMPLETED');

      const targetCases = activeCasesList.map(c => ({
        id: c.id || c.code,
        code: c.code || c.id,
        status: c.status,
        severity: c.incident?.severity || 'EMERGENCY',
        patientAgeGroupText: c.patient?.ageGroupText || 'Người trưởng thành',
        location: c.location?.address || c.address || 'thành phố Cần Thơ',
        raw: c
      }));

      const tabsContainer = document.getElementById('header-cases-tabs');
      if (tabsContainer) {
        if (targetCases.length === 0) {
          tabsContainer.innerHTML = '';
        } else {
          // Pagination window: 2 ca cùng lúc
          const pageSize = 2;
          const totalCases = targetCases.length;
          if (this.caseTabOffset >= totalCases) {
            this.caseTabOffset = 0;
          }
          if (this.caseTabOffset < 0) {
            this.caseTabOffset = Math.max(0, totalCases - pageSize);
          }

          // Lấy các ca hiển thị theo offset hiện tại (tuần hoàn)
          const visibleCases = [];
          for (let i = 0; i < Math.min(pageSize, totalCases); i++) {
            const idx = (this.caseTabOffset + i) % totalCases;
            visibleCases.push(targetCases[idx]);
          }

          const hiddenCount = Math.max(0, totalCases - visibleCases.length);

          let tabsHtml = '';

          // Nút lùi ca trước (Backward) khi có nhiều hơn pageSize ca
          if (totalCases > pageSize) {
            tabsHtml += `
              <button class="browser-case-nav-btn prev-cases" id="btn-case-nav-prev" title="Ca trước">‹</button>
            `;
          }

          // Render các tab ca hiện tại
          tabsHtml += visibleCases.map(c => {
            const code = c.code || c.id || 'CA';
            const location = c.location || 'Cần Thơ';
            const shortLoc = location.length > 20 ? location.substring(0, 20) + '...' : location;
            return `
              <div class="browser-case-tab ${c.status === 'EMERGENCY' || c.severity === 'EMERGENCY' ? 'is-emergency' : ''}" data-case-id="${c.id}" title="Ca ${code}: ${location} - Click để xem vị trí xe trên bản đồ">
                <span class="tab-title"><strong>${code}</strong>: ${shortLoc}</span>
                <span class="tab-close-btn" title="Xem trên bản đồ">›</span>
              </div>
            `;
          }).join('');

          // Nút tiến ca sau (Forward) khi có nhiều hơn pageSize ca
          if (totalCases > pageSize) {
            tabsHtml += `
              <button class="browser-case-nav-btn next-cases" id="btn-case-nav-next" title="Ca tiếp theo">›</button>
            `;
          }

          // Hiển thị pill: chỉ cần "+ số ca khác" khi còn ca chưa hiển thị
          if (hiddenCount > 0) {
            tabsHtml += `
              <div class="browser-case-more-pill" id="btn-header-more-cases" title="Nhấn để xem lần lượt các ca tiếp theo (+${hiddenCount} ca khác)">
                <span>+${hiddenCount} ca khác</span>
              </div>
            `;
          }

          tabsContainer.innerHTML = tabsHtml;

          // Bind click event: Click vào 1 ca -> Zoom vào xe tiếp nhận ca đó trên bản đồ
          tabsContainer.querySelectorAll('.browser-case-tab[data-case-id]').forEach(tab => {
            tab.addEventListener('click', (e) => {
              e.stopPropagation();
              const caseId = tab.getAttribute('data-case-id');
              const foundCase = targetCases.find(tc => tc.id === caseId || tc.code === caseId);

              // Tìm biển số xe tiếp nhận ca này
              let targetPlate = foundCase?.raw?.dispatch?.vehiclePlate;
              if (!targetPlate) {
                const state = window.StateManager?.getState();
                const matchedVeh = (state?.vehicles || []).find(v => v.currentCaseId === caseId || v.plate === foundCase?.raw?.dispatch?.vehiclePlate);
                targetPlate = matchedVeh?.plate;
              }
              if (!targetPlate) {
                targetPlate = '65A-012.34'; // Xe cấp cứu mặc định
              }

              // Đặt biển số xe được chọn
              this.realtimeSelectedPlate = targetPlate;

              if (this.currentMenu !== 'realtime-map') {
                this.currentMenu = 'realtime-map';
                this.renderSidebar();
                this.renderCurrentView();
              } else {
                if (this.mapInstance) {
                  this.mapInstance.focusVehicle(targetPlate, { animate: true });
                }
              }

              window.CCNV_UI?.Toast?.show(
                `ĐANG THEO DÕI XE TIẾP NHẬN CA ${foundCase?.code || caseId}`,
                `Xe ${targetPlate} đang phụ trách ca ${foundCase?.code || caseId}`,
                true,
                3000
              );
            });
          });

          // Nút Lùi (Backward): chuyển về ca trước đó
          const prevBtn = tabsContainer.querySelector('#btn-case-nav-prev');
          if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.caseTabOffset = (this.caseTabOffset - 1 + totalCases) % totalCases;
              this.updateKpiBar();
            });
          }

          // Nút Tiến (Forward): chuyển sang ca tiếp theo
          const nextBtn = tabsContainer.querySelector('#btn-case-nav-next');
          if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.caseTabOffset = (this.caseTabOffset + 1) % totalCases;
              this.updateKpiBar();
            });
          }

          // Nhấn vào "+ ca khác": hiển thị lần lượt các ca (move forward)
          const moreBtn = tabsContainer.querySelector('#btn-header-more-cases');
          if (moreBtn) {
            moreBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.caseTabOffset = (this.caseTabOffset + 1) % totalCases;
              this.updateKpiBar();
            });
          }
        }
      }
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
        const isMonitoringActive = ['realtime-map', 'vehicles-status', 'hospitals-status'].includes(this.currentMenu);
        const isShiftsActive = ['shifts-assignment', 'shifts-calendar', 'shifts-schedule'].includes(this.currentMenu);
        const isReportsActive = ['report-cases', 'report-sla', 'reports-overview', 'reports-detail', 'reports-stats', 'reports'].includes(this.currentMenu);
        const isCategoriesActive = ['cat-vehicles', 'cat-hospitals', 'cat-directory', 'cat-incidents', 'categories'].includes(this.currentMenu);
        const isAdminActive = ['admin-users', 'admin-roles', 'admin-audit', 'admin'].includes(this.currentMenu);

        html = `
          <!-- 1. GIÁM SÁT [Nhóm menu] -->
          <div class="nav-parent-item ${isMonitoringActive ? 'active expanded' : ''}" data-nav-group="monitoring" title="Giám sát">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.eye}</span>
            <span class="nav-parent-label">Giám sát</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'realtime-map' ? 'active' : ''}" data-menu="realtime-map">Bản đồ</div>
            <div class="nav-subitem ${this.currentMenu === 'vehicles-status' ? 'active' : ''}" data-menu="vehicles-status">Xe cứu thương</div>
            <div class="nav-subitem ${this.currentMenu === 'hospitals-status' ? 'active' : ''}" data-menu="hospitals-status">Đơn vị cấp cứu</div>
          </div>

          <!-- 2. CẤP CỨU [Menu đơn duy nhất - Toàn bộ Vòng đời & Tiếp nhận] -->
          <div class="nav-parent-item ${isEmergencyActive ? 'active' : ''}" data-menu="cases-list" title="Cấp cứu">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.ambulance}</span>
            <span class="nav-parent-label">Cấp cứu</span>
          </div>

          <!-- 3. TỔNG ĐÀI [Nhóm menu] -->
          <div class="nav-parent-item ${isCallCenterActive ? 'active expanded' : ''}" data-nav-group="call-center" title="Tổng đài">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.phoneCall}</span>
            <span class="nav-parent-label">Tổng đài</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'call-history' ? 'active' : ''}" data-menu="call-history">Lịch sử cuộc gọi</div>
            <div class="nav-subitem ${this.currentMenu === 'call-directory' ? 'active' : ''}" data-menu="call-directory">Danh bạ</div>
          </div>

          <!-- 4. CA TRỰC [Menu đơn duy nhất - Lịch trực] -->
          <div class="nav-parent-item ${isShiftsActive ? 'active' : ''}" data-menu="shifts-calendar" title="Ca trực">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.calendar}</span>
            <span class="nav-parent-label">Ca trực</span>
          </div>

          <!-- 5. BÁO CÁO [Nhóm menu] -->
          <div class="nav-parent-item ${isReportsActive ? 'active expanded' : ''}" data-nav-group="reports" title="Báo cáo">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.barChart}</span>
            <span class="nav-parent-label">Báo cáo</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${['report-cases', 'reports-overview', 'reports-detail', 'reports-stats', 'reports'].includes(this.currentMenu) ? 'active' : ''}" data-menu="report-cases">Số ca tiếp nhận</div>
            <div class="nav-subitem ${this.currentMenu === 'report-sla' ? 'active' : ''}" data-menu="report-sla">Thời gian đáp ứng chuẩn</div>
          </div>

          <!-- 6. DANH MỤC & CẤU HÌNH [Nhóm menu] -->
          <div class="nav-parent-item ${isCategoriesActive ? 'active expanded' : ''}" data-nav-group="categories" title="Danh mục & cấu hình">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.layers}</span>
            <span class="nav-parent-label">Danh mục & cấu hình</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'cat-vehicles' ? 'active' : ''}" data-menu="cat-vehicles">Xe cứu thương</div>
            <div class="nav-subitem ${this.currentMenu === 'cat-hospitals' ? 'active' : ''}" data-menu="cat-hospitals">Bệnh viện</div>
            <div class="nav-subitem ${this.currentMenu === 'cat-directory' ? 'active' : ''}" data-menu="cat-directory">Danh bạ liên hệ</div>
            <div class="nav-subitem ${['cat-incidents', 'categories'].includes(this.currentMenu) ? 'active' : ''}" data-menu="cat-incidents">Loại tình huống</div>
          </div>

          <!-- 7. QUẢN TRỊ HỆ THỐNG [Nhóm menu] -->
          <div class="nav-parent-item ${isAdminActive ? 'active expanded' : ''}" data-nav-group="admin" title="Quản trị hệ thống">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.settings}</span>
            <span class="nav-parent-label">Quản trị hệ thống</span>
            ${chevronSvg}
          </div>
          <div class="nav-submenu">
            <div class="nav-subitem ${this.currentMenu === 'admin-users' ? 'active' : ''}" data-menu="admin-users">Người dùng</div>
            <div class="nav-subitem ${this.currentMenu === 'admin-roles' ? 'active' : ''}" data-menu="admin-roles">Phân quyền</div>
            <div class="nav-subitem ${['admin-audit', 'admin'].includes(this.currentMenu) ? 'active' : ''}" data-menu="admin-audit">Nhật ký thao tác</div>
          </div>
        `;
      } else {
        // --- HOSPITAL ACCORDION (TIẾP NHẬN BỆNH VIỆN - SITEMAP 8.2) ---
        const isMapActive = this.currentMenu === 'hospital-map';
        const isCasesActive = ['hospital-cases', 'hospital-incoming', 'hospital-handover', 'hospital-epcr'].includes(this.currentMenu);
        const isReceptionStatusActive = ['hospital-reception-status', 'hospital-specialty'].includes(this.currentMenu);
        const isHospReportActive = ['hospital-report-detail', 'hospital-report-stats', 'hospital-reports'].includes(this.currentMenu);

        html = `
          <!-- 1. BẢN ĐỒ [Menu đơn] -->
          <div class="nav-parent-item ${isMapActive ? 'active' : ''}" data-menu="hospital-map" title="Bản đồ">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.map}</span>
            <span class="nav-parent-label">Bản đồ</span>
          </div>

          <!-- 2. CẤP CỨU [Menu đơn duy nhất] -->
          <div class="nav-parent-item ${isCasesActive ? 'active' : ''}" data-menu="hospital-cases" title="Cấp cứu">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.ambulance}</span>
            <span class="nav-parent-label">Cấp cứu</span>
          </div>

          <!-- 3. TRẠNG THÁI TIẾP NHẬN & CHUYÊN KHOA [Gộp chung thành 1 menu] -->
          <div class="nav-parent-item ${isReceptionStatusActive ? 'active' : ''}" data-menu="hospital-reception-status" title="Trạng thái & Chuyên khoa tiếp nhận">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.hospital}</span>
            <span class="nav-parent-label">Trạng thái & Chuyên khoa</span>
          </div>

          <!-- 4. BÁO CÁO TIẾP NHẬN [Menu đơn gộp - Clone app trung tâm với Tab Tổng quan & Chi tiết] -->
          <div class="nav-parent-item ${isHospReportActive ? 'active' : ''}" data-menu="hospital-reports" title="Báo cáo tiếp nhận">
            <span class="nav-parent-icon">${window.CCNV_UI.ICONS.barChart}</span>
            <span class="nav-parent-label">Báo cáo tiếp nhận</span>
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
          this.closeCaseDetailModal();
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
          this.closeCaseDetailModal();
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

      // 4. Click handler for Brand Logo/Title: Return to default map view
      const sidebarBrand = document.querySelector('.sidebar-brand');
      if (sidebarBrand && !sidebarBrand._hasCentralNavClick) {
        sidebarBrand._hasCentralNavClick = true;
        sidebarBrand.style.cursor = 'pointer';
        sidebarBrand.title = 'Về màn hình chính';
        sidebarBrand.addEventListener('click', () => {
          this.navigateTo(this.isHospitalMode() ? 'hospital-map' : 'realtime-map');
        });
      }

      this.renderSidebarBadges();
    }

    renderSidebarBadges() {
      // Kept clean without cluttering
    }

    isHospitalMode() {
      const user = window.StateManager.getCurrentUser();
      return user?.role === 'HOSPITAL_RECEIVER';
    }

    closeCaseDetailModal() {
      if (this.modalMapInstance) {
        try {
          this.modalMapInstance.destroy();
        } catch (e) {
          console.warn('Error destroying modal map:', e);
        }
        this.modalMapInstance = null;
      }
      const modalOverlay = document.getElementById('case-detail-modal-overlay');
      if (modalOverlay) {
        modalOverlay.classList.remove('active');
        modalOverlay.style.display = 'none';
        modalOverlay.innerHTML = '';
      }
      this.selectedCaseId = null;
      const detailBreadcrumb = document.getElementById('breadcrumb-case-detail-item');
      if (detailBreadcrumb) {
        detailBreadcrumb.remove();
      }
      const headerBreadcrumb = document.querySelector('.header-left > div');
      if (headerBreadcrumb) {
        headerBreadcrumb.style.cursor = '';
        headerBreadcrumb.title = '';
        headerBreadcrumb.onclick = null;
      }
      if (this._caseModalKeyHandler) {
        window.removeEventListener('keydown', this._caseModalKeyHandler);
        this._caseModalKeyHandler = null;
      }
    }

    showCaseDetailModal(caseIdOrObj, fallbackCase = null) {
      if (typeof caseIdOrObj === 'object' && caseIdOrObj !== null) {
        this.openCaseDetailModal(caseIdOrObj.id, caseIdOrObj);
      } else {
        this.openCaseDetailModal(caseIdOrObj, fallbackCase);
      }
    }

    navigateTo(menuId) {
      this.closeCaseDetailModal();
      const sidebarContainer = document.getElementById('sidebar-menu-wrapper');
      if (sidebarContainer) {
        sidebarContainer.querySelectorAll('.nav-parent-item, .nav-subitem').forEach(el => el.classList.remove('active'));
        const targetEl = sidebarContainer.querySelector(`[data-menu="${menuId}"]`);
        if (targetEl) {
          targetEl.classList.add('active');
          const parent = targetEl.closest('.nav-submenu')?.previousElementSibling;
          if (parent && parent.classList.contains('nav-parent-item')) {
            parent.classList.add('active');
            parent.classList.add('expanded');
          }
        }
      }
      this.currentMenu = menuId;
      this.renderCurrentView();
    }

    renderCurrentView(options = {}) {
      if (!options?.keepModal) {
        this.closeCaseDetailModal();
      }

      const container = document.getElementById('main-content-viewport');
      if (!container) return;

      // Clean up previous map if switching away
      if (this.mapInstance && this.currentMenu !== 'realtime-map' && this.currentMenu !== 'hospital-map') {
        this.mapInstance.destroy();
        this.mapInstance = null;
      }

      const menuTitles = {
        // 1. Tổng đài
        'call-history': 'Tổng đài / Lịch sử cuộc gọi',
        'call-directory': 'Tổng đài / Danh bạ',
        'call-center': 'Tổng đài',
        'call-current': 'Tổng đài',
        'call-transfer': 'Tổng đài',
        // 2. Cấp cứu
        'cases-list': 'Cấp cứu',
        'case-lookup': 'Cấp cứu',
        'receiving-incoming': 'Cấp cứu',
        'receiving-handover': 'Cấp cứu',
        'receiving-status': 'Cấp cứu',
        // 3. Giám sát
        'realtime-map': 'Giám sát / Bản đồ',
        'vehicles-status': 'Giám sát / Xe cứu thương',
        'crews-status': 'Giám sát / Kíp trực',
        'hospitals-status': 'Giám sát / Đơn vị cấp cứu',
        // 4. Ca trực
        'shifts-calendar': 'Ca trực',
        'shifts-schedule': 'Ca trực',
        // 5. Báo cáo
        'report-cases': 'Báo cáo / Số ca tiếp nhận',
        'report-sla': 'Báo cáo / Thời gian đáp ứng chuẩn',
        'reports-overview': 'Báo cáo / Số ca tiếp nhận',
        'reports-detail': 'Báo cáo / Số ca tiếp nhận',
        'reports-stats': 'Báo cáo / Số ca tiếp nhận',
        'reports': 'Báo cáo',
        // 6. Danh mục & cấu hình
        'cat-vehicles': 'Danh mục & cấu hình / Xe cứu thương',
        'cat-hospitals': 'Danh mục & cấu hình / Bệnh viện',
        'cat-directory': 'Danh mục & cấu hình / Danh bạ liên hệ',
        'cat-incidents': 'Danh mục & cấu hình / Loại tình huống',
        'cat-statuses': 'Danh mục & cấu hình',
        'cat-equipment': 'Danh mục & cấu hình',
        'cat-close-reasons': 'Danh mục & cấu hình',
        'cat-templates': 'Danh mục & cấu hình',
        'categories': 'Danh mục & cấu hình',
        // 7. Quản trị hệ thống
        'admin-users': 'Quản trị hệ thống / Người dùng',
        'admin-roles': 'Quản trị hệ thống / Phân quyền',
        'admin-audit': 'Quản trị hệ thống / Nhật ký thao tác',
        'admin-backup': 'Quản trị hệ thống',
        'admin': 'Quản trị hệ thống',
        // Web BV Tiếp nhận (Sitemap 8.2)
        'hospital-map': 'Bản đồ',
        'hospital-cases': 'Cấp cứu',
        'hospital-incoming': 'Cấp cứu',
        'hospital-handover': 'Cấp cứu',
        'hospital-epcr': 'Cấp cứu',
        'hospital-reception-status': 'Trạng thái & Chuyên khoa',
        'hospital-specialty': 'Trạng thái & Chuyên khoa',
        'hospital-report-detail': 'Báo cáo tiếp nhận',
        'hospital-report-stats': 'Báo cáo tiếp nhận',
        'hospital-reports': 'Báo cáo tiếp nhận'
      };

      const headerLeft = document.querySelector('.header-left');
      if (headerLeft) {
        const rawTitle = menuTitles[this.currentMenu] || 'Trung tâm Điều hành Cấp cứu 115';
        const parts = rawTitle.split('/').map(p => p.trim());
        const titleHtml = parts.map(p => `<span>${p}</span>`).join('<span style="color:var(--text-muted);font-size:11px;margin:0 2px;">/</span>');
        headerLeft.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text-white);font-weight:600;">
            <span style="color:#60A5FA;font-weight:600;letter-spacing:0.2px;">TRUNG TÂM GIÁM SÁT & ĐIỀU HÀNH</span>
            <span style="color:var(--text-muted);font-size:11px;">/</span>
            ${titleHtml}
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
        case 'report-sla':
          this.renderReportSlaView(container, 'overview');
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
        case 'hospital-map':
          this.renderRealtimeMapView(container);
          break;
        case 'hospital-cases':
        case 'hospital-incoming':
        case 'hospital-handover':
        case 'hospital-epcr':
          this.renderHospitalCasesView(container);
          break;
        case 'hospital-reception-status':
        case 'hospital-specialty':
          this.renderHospitalReceptionStatusView(container);
          break;
        case 'hospital-reports':
        case 'hospital-report-stats':
          this.renderHospitalReportsView(container, 'overview');
          break;
        case 'hospital-report-detail':
          this.renderHospitalReportsView(container, 'detail');
          break;

        default:
          this.renderRealtimeMapView(container);
      }
    }

    // --- 1. REALTIME MAP VIEW (COMMAND CENTER CORE) ---
    renderRealtimeMapView(container) {
      const state = window.StateManager.getState();
      const currentUser = window.StateManager.getCurrentUser();
      // Phân định rõ ràng:
      // - hospital-map: Màn hình Bệnh viện tiếp nhận (mặc định chỉ hiện vị trí bệnh viện của mình)
      // - realtime-map: Màn hình Trung tâm giám sát & điều hành 115 (mặc định hiển thị toàn cảnh tất cả các bệnh viện và xe)
      const isHospital = this.currentMenu === 'hospital-map' || (this.isHospitalMode() && this.currentMenu !== 'realtime-map');
      const myHospId = currentUser?.hospitalId || 'HOSP_BVTU';
      const myHospName = currentUser?.organization;

      const isHospConfirmed = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ccnv_hospital_confirmed') === 'true';

      const vehicles = state.vehicles || [];
      const activeCases = (state.cases || []).filter(c => !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(c.status));

      // Lọc danh sách ca thuộc bệnh viện tiếp nhận:
      // Mặc định CHƯA TIẾP NHẬN thì không có ca nào (0 ca) và không hiển thị thông báo trên layer bên trái.
      // Khi đã bấm xác nhận (isHospConfirmed = true) thì mới hiển thị ca tiếp nhận.
      const hospitalCases = isHospital
        ? (isHospConfirmed ? activeCases.filter(c => {
          if (c.hospitalResponse !== 'ACCEPTED') return false;
          return !c.dispatch?.hospitalId ||
            c.dispatch?.hospitalId === myHospId ||
            c.dispatch?.hospitalName === myHospName ||
            (myHospName && c.dispatch?.hospitalName && myHospName.includes(c.dispatch.hospitalName)) ||
            (c.dispatch?.hospitalName && myHospName && c.dispatch.hospitalName.includes(myHospName));
        }) : [])
        : activeCases;

      const displayCases = isHospital ? hospitalCases : activeCases;

      const caseOfPlate = (plate) => {
        if (!plate) return null;
        return activeCases.find(c => c.dispatch?.vehiclePlate === plate || c.currentVehiclePlate === plate)
          || (state.cases || []).find(c => (c.dispatch?.vehiclePlate === plate || c.currentVehiclePlate === plate) && !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(c.status))
          || ((this.demoRunning || state.demoRunning) && state.demoCase?.dispatch?.vehiclePlate === plate ? state.demoCase : null);
      };

      // Mặc định ở Trung tâm: Không tự động focus vào 1 xe nào để bản đồ luôn hiển thị toàn cảnh tất cả các bệnh viện và xe
      if (this.realtimeSelectedPlate && !vehicles.some(v => v.plate === this.realtimeSelectedPlate)) {
        this.realtimeSelectedPlate = null;
      }
      let currentSelectedPlate = this.realtimeSelectedPlate || null;
      const initialVeh = currentSelectedPlate ? vehicles.find(v => v.plate === currentSelectedPlate) : null;
      const initialCase = caseOfPlate(initialVeh?.plate);

      container.innerHTML = `
        <div class="command-viewport map-fullscreen-mode">
          <!-- Full-bleed Realtime Map Container (100% Length & Width) -->
          <div class="map-area-container">
            <!-- SVG / Leaflet Map Viewport (Takes 100% Space) -->
            <div id="cantho-map-viewport" class="map-svg-wrapper"></div>

            <!-- Left Floating Widget: Đội xe Cứu thương / Ca xử lý Panel & Widgets Hub -->
            <div class="side-panel-container left-floating-widget" id="fleet-side-panel">
              <div class="panel-header-tabs">
                <button class="map-layers-widget-btn" id="btn-toggle-layers-widget" title="${isHospital ? 'Ẩn / Hiện widget Ca xử lý' : 'Ẩn / Hiện widget Đội xe & Ca xử lý'}" aria-label="${isHospital ? 'Ẩn / Hiện widget Ca xử lý' : 'Ẩn / Hiện widget Đội xe & Ca xử lý'}">
                  ${window.CCNV_UI?.ICONS?.layers || `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`}
                </button>
                <div class="panel-tabs-wrapper" style="display:flex;align-items:center;gap:6px;overflow:hidden;">
                  ${isHospital ? `
                    <button class="panel-tab-btn active" id="tab-panel-cases" style="cursor:default;font-weight:700;">Ca xử lý (${displayCases.length})</button>
                  ` : `
                    <button class="panel-tab-btn active" id="tab-panel-vehicles">Đội xe (${vehicles.length})</button>
                    <button class="panel-tab-btn" id="tab-panel-cases">Ca xử lý (${activeCases.length})</button>
                  `}
                </div>
              </div>

              <div class="panel-search-bar" style="gap:6px;align-items:center;position:relative;">
                <input type="text" id="filter-vehicle-input" placeholder="${isHospital ? 'Tìm mã ca, tình huống, xe chuyển...' : 'Tìm biển số xe, kíp trực, trạm...'}" style="flex:1;" />
                
                ${isHospital ? '' : `
                <!-- Sort Icon Button with Popover Dropdown List -->
                <div style="position:relative;">
                  <button type="button" class="btn-sort-icon-trigger" id="btn-sort-vehicle-trigger" title="Sắp xếp danh sách đội xe" aria-label="Sắp xếp danh sách đội xe">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="4" y1="6" x2="16" y2="6"></line>
                      <line x1="4" y1="12" x2="11" y2="12"></line>
                      <line x1="4" y1="18" x2="7" y2="18"></line>
                      <polyline points="15 15 18 18 21 15"></polyline>
                      <line x1="18" y1="9" x2="18" y2="18"></line>
                    </svg>
                  </button>

                  <!-- Popover Dropdown Menu -->
                  <div class="veh-sort-dropdown-menu" id="veh-sort-dropdown-menu" style="display:none;">
                    <div class="sort-menu-header">SẮP XẾP ĐỘI XE</div>
                    <button type="button" class="sort-option-item active" data-sort-val="default">
                      <span>Mặc định</span>
                      <span class="sort-check">✓</span>
                    </button>
                    <button type="button" class="sort-option-item" data-sort-val="status">
                      <span>Trạng thái (Sẵn sàng trước)</span>
                      <span class="sort-check">✓</span>
                    </button>
                    <button type="button" class="sort-option-item" data-sort-val="speed">
                      <span>Tốc độ di chuyển (Cao → Thấp)</span>
                      <span class="sort-check">✓</span>
                    </button>
                    <button type="button" class="sort-option-item" data-sort-val="battery">
                      <span>Pin GPS (Cao → Thấp)</span>
                      <span class="sort-check">✓</span>
                    </button>
                    <button type="button" class="sort-option-item" data-sort-val="plate">
                      <span>Biển số xe (A → Z)</span>
                      <span class="sort-check">✓</span>
                    </button>
                  </div>
                </div>
                `}
              </div>

              <div class="panel-list-scroll" id="vehicle-card-list">
                ${isHospital
          ? this.renderHospitalCaseCards(displayCases, currentSelectedPlate)
          : this.renderVehicleCards(vehicles, currentSelectedPlate)}
              </div>
            </div>
          </div>
        </div>
      `;

      // Mount Can Tho Map (hủy instance cũ để không rò vòng lặp animation)
      if (this.mapInstance) this.mapInstance.destroy();
      this.mapInstance = new window.CanThoMap('cantho-map-viewport', {
        isHospital: isHospital,
        hospitalId: myHospId,
        hospitalName: myHospName
      });
      this.mapInstance.onMissionCompleted = (m) => {
        if (isHospital) {
          this.endHospitalDemo?.();
        } else {
          this.completeDemoAtHospital(m);
        }
      };
      this.mapInstance.render();

      const listEl = container.querySelector('#vehicle-card-list');
      const bottomStrip = container.querySelector('#realtime-bottom-strip');
      const fleetPanel = container.querySelector('#fleet-side-panel');
      const btnToggleLayers = container.querySelector('#btn-toggle-layers-widget');
      const tabVehicles = container.querySelector('#tab-panel-vehicles');
      const tabCases = container.querySelector('#tab-panel-cases');
      const searchInput = container.querySelector('#filter-vehicle-input');
      const btnSortTrigger = container.querySelector('#btn-sort-vehicle-trigger');
      const sortDropdown = container.querySelector('#veh-sort-dropdown-menu');
      let currentSortMode = 'default';

      const getFilteredVehicles = () => {
        const q = (searchInput?.value || '').toLowerCase().trim();
        let result = vehicles.filter(v =>
          !q ||
          v.plate.toLowerCase().includes(q) ||
          v.station.toLowerCase().includes(q) ||
          v.type.toLowerCase().includes(q)
        );

        if (currentSortMode === 'status') {
          result.sort((a, b) => (a.status === 'READY' ? -1 : 1));
        } else if (currentSortMode === 'speed') {
          result.sort((a, b) => (b.speed || 0) - (a.speed || 0));
        } else if (currentSortMode === 'battery') {
          result.sort((a, b) => (b.fuel || 90) - (a.fuel || 90));
        } else if (currentSortMode === 'plate') {
          result.sort((a, b) => a.plate.localeCompare(b.plate));
        }
        return result;
      };

      const updateVehicleList = () => {
        if (isHospital || (tabCases && tabCases.classList.contains('active'))) {
          const currentCases = isHospital ? displayCases : activeCases;
          const q = (searchInput?.value || '').toLowerCase().trim();
          const filtered = currentCases.filter(c => {
            const code = (c.code || c.id || '').toLowerCase();
            const incident = (c.incident?.name || '').toLowerCase();
            const plate = (c.dispatch?.vehiclePlate || '').toLowerCase();
            const addr = (c.location?.address || '').toLowerCase();
            const ageGroup = (c.patient?.ageGroupText || '').toLowerCase();
            const hospital = (c.dispatch?.hospitalName || '').toLowerCase();
            return !q || code.includes(q) || incident.includes(q) || plate.includes(q) || addr.includes(q) || ageGroup.includes(q) || hospital.includes(q);
          });

          if (listEl) {
            listEl.innerHTML = this.renderHospitalCaseCards(filtered, currentSelectedPlate);
            bindCardClicks();
          }
          return;
        }

        const result = getFilteredVehicles();
        if (listEl) {
          listEl.innerHTML = this.renderVehicleCards(result, currentSelectedPlate);
          bindCardClicks();
        }
      };

      // Widget Toggle Handler trực tiếp khi nhấn vào Icon Layer
      const toggleFleetPanel = (show) => {
        const isCollapsed = show !== undefined ? !show : !fleetPanel?.classList.contains('is-collapsed');
        fleetPanel?.classList.toggle('is-collapsed', isCollapsed);
        btnToggleLayers?.classList.toggle('active', !isCollapsed);
        setTimeout(() => this.mapInstance?.invalidateSize?.(), 250);
      };

      btnToggleLayers?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFleetPanel();
      });

      const bindBottomControls = () => {
        // Nút xem vị trí xe
        bottomStrip?.querySelectorAll('.btn-focus-selected-vehicle, .btn-focus-incident-vehicle').forEach(btn => {
          btn.addEventListener('click', () => {
            const plate = btn.getAttribute('data-plate');
            if (!plate) return;
            if (plate === currentSelectedPlate) {
              this.mapInstance?.focusVehicle(plate);
            } else {
              setSelection(plate);
            }
          });
        });

        // Nút chuyển đổi Cam Trước / Cam Sau (Khoang)
        bottomStrip?.querySelectorAll('.cam-switch-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const mode = btn.getAttribute('data-mode');
            if (mode && this.activeCameraMode !== mode) {
              this.activeCameraMode = mode;
              const targetVeh = (currentSelectedPlate && vehicles.find(v => v.plate === currentSelectedPlate)) || defaultVeh;
              bottomStrip.innerHTML = this.renderRealtimeBottomStrip(targetVeh, caseOfPlate(targetVeh?.plate));
              bindBottomControls();
              window.CCNV_UI?.SoundFx?.playClick?.();
            }
          });
        });

        // Nút chụp ảnh ekip kíp trực / khoang xe hiện tại
        bottomStrip?.querySelectorAll('.btn-capture-crew').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const plate = btn.getAttribute('data-plate') || currentSelectedPlate || 'Xe cứu thương';

            // Hiệu ứng flash máy ảnh
            const flash = document.createElement('div');
            flash.className = 'cam-flash-overlay';
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 400);

            // Âm thanh chụp
            window.CCNV_UI?.SoundFx?.playBeep?.();

            const isFront = this.activeCameraMode === 'FRONT';
            const camType = isFront ? 'Camera trước hành trình' : 'Camera cabin khoang bệnh nhân & kíp trực';

            window.CCNV_UI?.Toast?.show?.(
              'ĐÃ CHỤP ẢNH EKIP TRỰC THÀNH CÔNG',
              `Đã chụp khoảnh khắc từ ${camType} của xe ${plate}. Ảnh đã lưu vào nhật trình ca điều động.`
            );
          });
        });
      };

      // Handler sự kiện nút trên chi tiết xe
      const bindDetailPanelEvents = (targetVeh) => {
        if (!listEl || !targetVeh) return;

        // Nút quay lại danh sách xe
        listEl.querySelector('#btn-back-to-veh-list')?.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelection(null);
        });

        // Nút Chi tiết (đẩy vào màn hình Xe cứu thương)
        listEl.querySelector('#btn-veh-goto-detail')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const plate = e.currentTarget.getAttribute('data-plate') || targetVeh.plate;
          this.navigateTo('vehicles-status');
          setTimeout(() => {
            const tableMount = document.getElementById('vehicles-status-table-mount');
            const searchInput = tableMount?.querySelector('input[type="search"], input[type="text"]');
            if (searchInput) {
              searchInput.value = plate;
              searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, 150);
        });

        // Nút chuyển chế độ Camera (Cam trước / Cam sau)
        listEl.querySelectorAll('.veh-cam-tab-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const mode = btn.getAttribute('data-cam-mode');
            if (mode && this.activeCameraMode !== mode) {
              this.activeCameraMode = mode;
              const activeCase = caseOfPlate(targetVeh.plate);
              listEl.innerHTML = this.renderVehicleDetailPanel(targetVeh, activeCase);
              bindDetailPanelEvents(targetVeh);

              if (bottomStrip) {
                bottomStrip.innerHTML = this.renderRealtimeBottomStrip(targetVeh, activeCase);
                bindBottomControls();
              }
              window.CCNV_UI?.SoundFx?.playClick?.();
            }
          });
        });

        // Nút chụp ảnh kíp trực
        listEl.querySelector('.btn-capture-crew')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const flash = document.createElement('div');
          flash.className = 'cam-flash-overlay';
          document.body.appendChild(flash);
          setTimeout(() => flash.remove(), 400);

          window.CCNV_UI?.SoundFx?.playBeep?.();
          const isFront = this.activeCameraMode === 'FRONT';
          const camType = isFront ? 'Camera trước hành trình' : 'Camera cabin khoang bệnh nhân & kíp trực';

          window.CCNV_UI?.Toast?.show?.(
            'ĐÃ CHỤP ẢNH EKIP TRỰC THÀNH CÔNG',
            `Đã chụp khoảnh khắc từ ${camType} của xe ${targetVeh.plate}. Ảnh đã lưu vào nhật trình ca điều động.`
          );
        });

        // Nút định vị xe trên bản đồ
        listEl.querySelector('.btn-focus-selected-vehicle')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.mapInstance?.focusVehicle(targetVeh.plate, { animate: true });
        });

        // Nút bật/tắt mô phỏng điều động (khi xe đang ở chế độ chờ)
        listEl.querySelector('.btn-toggle-sim-dispatch')?.addEventListener('click', (e) => {
          e.stopPropagation();
          targetVeh.isDispatchedSimulated = !targetVeh.isDispatchedSimulated;
          const activeCase = caseOfPlate(targetVeh.plate);
          listEl.innerHTML = this.renderVehicleDetailPanel(targetVeh, activeCase);
          bindDetailPanelEvents(targetVeh);
          window.CCNV_UI?.SoundFx?.playClick?.();
        });

        // Nút mở modal chi tiết ca từ widget xe
        listEl.querySelector('.btn-open-case-from-veh')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const caseId = e.currentTarget.getAttribute('data-case-id');
          if (caseId) this.openCaseDetailModal(caseId);
        });

        // Nút Gọi nhanh khẩn cấp (4 luồng cuộc gọi theo vai trò)
        listEl.querySelectorAll('.btn-veh-call-action').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = btn.getAttribute('data-call-target');
            const title = btn.getAttribute('data-title');
            const name = btn.getAttribute('data-name');
            const phone = btn.getAttribute('data-phone');
            const activeCase = caseOfPlate(targetVeh.plate);
            const caseCode = btn.getAttribute('data-case-code') || activeCase?.code;
            this.openLiveCallModal({ title, name, phone, type: target, plate: targetVeh.plate, caseCode });
          });
        });

        // Chat: Tự động cuộn xuống tin nhắn mới nhất
        const chatStreamEl = listEl.querySelector('#veh-chat-stream');
        if (chatStreamEl) {
          chatStreamEl.scrollTop = chatStreamEl.scrollHeight;
        }

        // Chat: Gửi tin nhắn trao đổi
        const chatInputEl = listEl.querySelector('#veh-chat-input');
        const chatSendBtn = listEl.querySelector('#btn-veh-chat-send');

        const doSendChat = (txt) => {
          const messageText = txt !== undefined ? txt : (chatInputEl?.value || '');
          if (!messageText || !messageText.trim()) return;

          const chatBoxEl = listEl.querySelector('.veh-chat-box');
          const caseKeyFromDom = chatBoxEl?.getAttribute('data-case-key');
          const activeCase = caseOfPlate(targetVeh.plate);
          const caseKey = caseKeyFromDom || activeCase?.code || targetVeh.plate;
          const msg = this.sendVehicleChatMessage(caseKey, messageText, targetVeh, activeCase);

          if (chatInputEl) chatInputEl.value = '';

          if (chatStreamEl && msg) {
            const bubbleEl = document.createElement('div');
            bubbleEl.className = 'veh-chat-bubble mine';
            bubbleEl.innerHTML = `
              <div class="veh-chat-bubble-header">
                <span class="veh-chat-sender-tag ${msg.badgeClass}">${msg.badge} ${msg.senderName}</span>
                <span class="veh-chat-time">${msg.time}</span>
              </div>
              <div class="veh-chat-bubble-body">${msg.text}</div>
            `;
            chatStreamEl.appendChild(bubbleEl);
            chatStreamEl.scrollTop = chatStreamEl.scrollHeight;
          }
        };

        chatSendBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          doSendChat();
        });

        chatInputEl?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.stopPropagation();
            doSendChat();
          }
        });

        // Chat: Quick chips gợi ý phản hồi nhanh
        listEl.querySelectorAll('.veh-chat-chip').forEach(chip => {
          chip.addEventListener('click', (e) => {
            e.stopPropagation();
            const chipMsg = chip.getAttribute('data-msg') || chip.textContent;
            doSendChat(chipMsg);
          });
        });
      };

      // Chọn theo dõi xe (showDetail = false) hoặc mở bảng chi tiết xe (showDetail = true)
      const setSelection = (plate, { animate = true, showDetail = false } = {}) => {
        currentSelectedPlate = plate;
        this.realtimeSelectedPlate = plate;

        const targetVeh = (plate && (vehicles.find(v => v.plate === plate || v.plate?.replace(/[\s.-]/g, '') === plate.replace(/[\s.-]/g, ''))
          || { plate, typeName: 'Xe Cứu thương Cấp cứu 115', station: 'Trạm Cấp cứu 115', status: 'EMERGENCY', speed: 45, battery: 96 })) || null;

        const searchBarEl = fleetPanel?.querySelector('.panel-search-bar');

        if (isHospital) {
          // Bệnh viện tiếp nhận: hỗ trợ xem chi tiết xe và kíp trực giống bên trung tâm điều phối
          if (searchBarEl) {
            searchBarEl.style.display = (targetVeh && showDetail) ? 'none' : 'flex';
          }

          if (listEl) {
            if (targetVeh && showDetail) {
              // Nhấn nút "Chi tiết" → Xem chi tiết xe và kíp trực
              listEl.innerHTML = this.renderVehicleDetailPanel(targetVeh, caseOfPlate(targetVeh.plate));
              bindDetailPanelEvents(targetVeh);
            } else {
              const isDetailPanelOpen = Boolean(listEl.querySelector('.vehicle-detail-panel-box'));
              if (isDetailPanelOpen) {
                // Thoát khỏi bảng chi tiết xe → render lại danh sách ca bệnh viện
                updateVehicleList();
              } else {
                // Đang ở danh sách ca: toggle class is-selected cho ca của xe tương ứng
                listEl.querySelectorAll('.vehicle-card').forEach(card => {
                  const cardPlate = card.getAttribute('data-plate');
                  card.classList.toggle('is-selected', Boolean(plate && cardPlate === plate));
                });
              }
            }
          }
        } else {
          // Trung tâm điều hành: nếu đang ở tab Ca xử lý thì highlight thẻ ca hoặc xem chi tiết xe
          const isCasesTab = tabCases?.classList.contains('active');
          if (isCasesTab) {
            if (searchBarEl) {
              searchBarEl.style.display = (targetVeh && showDetail) ? 'none' : 'flex';
            }
            if (listEl) {
              if (targetVeh && showDetail) {
                // Nhấn nút "Chi tiết" trên ca xử lý → Xem chi tiết xe
                listEl.innerHTML = this.renderVehicleDetailPanel(targetVeh, caseOfPlate(targetVeh.plate));
                bindDetailPanelEvents(targetVeh);
              } else {
                const isDetailPanelOpen = Boolean(listEl.querySelector('.vehicle-detail-panel-box'));
                if (isDetailPanelOpen) {
                  updateVehicleList();
                } else {
                  listEl.querySelectorAll('.vehicle-card').forEach(card => {
                    const cardPlate = card.getAttribute('data-plate');
                    card.classList.toggle('is-selected', Boolean(plate && cardPlate === plate));
                  });
                }
              }
            }
          } else {
            const searchBarEl = fleetPanel?.querySelector('.panel-search-bar');
            if (searchBarEl) {
              searchBarEl.style.display = (targetVeh && showDetail) ? 'none' : 'flex';
            }

            if (listEl) {
              if (targetVeh && showDetail) {
                // Nhấn nút "Chi tiết" → Xem chi tiết xe
                listEl.innerHTML = this.renderVehicleDetailPanel(targetVeh, caseOfPlate(targetVeh.plate));
                bindDetailPanelEvents(targetVeh);
              } else {
                const isDetailPanelOpen = Boolean(listEl.querySelector('.vehicle-detail-panel-box'));
                if (isDetailPanelOpen) {
                  const currentVehicles = getFilteredVehicles();
                  listEl.innerHTML = this.renderVehicleCards(currentVehicles, plate);
                  bindCardClicks();
                } else {
                  // Đang ở danh sách xe: toggle class is-selected cho xe được chọn (hoặc bỏ chọn nếu plate == null)
                  listEl.querySelectorAll('.vehicle-card').forEach(card => {
                    const cardPlate = card.getAttribute('data-plate');
                    card.classList.toggle('is-selected', Boolean(plate && cardPlate === plate));
                  });
                }
              }
            }
          }
        }

        const vehForBottom = targetVeh;
        if (bottomStrip) {
          if (vehForBottom) {
            bottomStrip.style.display = '';
            bottomStrip.innerHTML = this.renderRealtimeBottomStrip(vehForBottom, caseOfPlate(vehForBottom?.plate));
            bindBottomControls();
          } else {
            bottomStrip.style.display = 'none';
          }
        }

        if (!this.mapInstance) return;
        if (plate) this.mapInstance.focusVehicle(plate, { animate });
        else this.mapInstance.clearFocus(animate);
      };

      // Thẻ xe & Thẻ ca: bấm vào thẻ → chọn xe / mở chi tiết ca
      const bindCardClicks = () => {
        if (!listEl) return;

        listEl.querySelectorAll('.vehicle-card').forEach(card => {
          card.addEventListener('click', (e) => {
            // Nút Chi tiết trên thẻ xe hoặc thẻ ca (xem chi tiết xe như bên trung tâm điều phối)
            if (e.target.closest('.btn-card-veh-detail, .btn-hosp-veh-detail')) {
              e.stopPropagation();
              const detailBtn = e.target.closest('.btn-card-veh-detail, .btn-hosp-veh-detail');
              const plate = detailBtn.getAttribute('data-plate') || card.getAttribute('data-plate');
              if (plate) {
                setSelection(plate, { showDetail: true });
              }
              return;
            }

            // Nút mở modal chi tiết hồ sơ bệnh án
            if (e.target.closest('.btn-view-case-detail')) {
              e.stopPropagation();
              const caseId = e.target.closest('.btn-view-case-detail').getAttribute('data-case-id');
              const targetCase = (state.cases || []).find(c => c.id === caseId || c.code === caseId)
                || (state.demoCase && (state.demoCase.id === caseId || state.demoCase.code === caseId) ? state.demoCase : null);
              if (targetCase) {
                this.showCaseDetailModal(targetCase.id, targetCase);
              }
              return;
            }

            // Nút Xác nhận ca trực tiếp từ Thẻ ca (Khoa Cấp cứu tiếp nhận)
            if (e.target.closest('.btn-confirm-hospital-case-btn')) {
              e.stopPropagation();
              const caseId = e.target.closest('.btn-confirm-hospital-case-btn').getAttribute('data-case-id');
              const targetCase = (state.cases || []).find(c => c.id === caseId || c.code === caseId)
                || (state.demoCase && (state.demoCase.id === caseId || state.demoCase.code === caseId) ? state.demoCase : null);
              if (targetCase) {
                this.confirmHospitalCase(targetCase);
              }
              return;
            }

            // Nút định vị xe chở ca
            if (e.target.closest('.btn-track-case-veh')) {
              e.stopPropagation();
              const plate = e.target.closest('.btn-track-case-veh').getAttribute('data-plate');
              if (plate) setSelection(plate, { showDetail: false });
              return;
            }

            const plate = card.getAttribute('data-plate');
            const caseId = card.getAttribute('data-case-id');
            const targetCase = (state.cases || []).find(c => c.id === caseId || c.code === caseId)
              || (state.demoCase && (state.demoCase.id === caseId || state.demoCase.code === caseId) ? state.demoCase : null);

            // Ở màn Bệnh viện tiếp nhận: Nếu chưa xác nhận ca thì click card sẽ mở chi tiết bệnh án để tiếp nhận
            if (isHospital && targetCase && targetCase.hospitalResponse !== 'ACCEPTED') {
              this.showCaseDetailModal(targetCase.id, targetCase);
              return;
            }

            if (plate) {
              if (plate === currentSelectedPlate) {
                // Nhấn lại vào xe đang chọn thì hủy chọn xe, quay lại xem toàn bộ xe và bệnh viện
                setSelection(null);
              } else {
                // Nhấn vào xe đó thì là theo dõi 1 xe trên bản đồ
                setSelection(plate, { showDetail: false });
              }
            } else if (caseId) {
              if (targetCase) {
                if (targetCase.dispatch?.vehiclePlate) {
                  if (targetCase.dispatch.vehiclePlate === currentSelectedPlate) {
                    setSelection(null);
                  } else {
                    setSelection(targetCase.dispatch.vehiclePlate, { showDetail: false });
                  }
                }
                this.showCaseDetailModal(targetCase.id, targetCase);
              }
            }
          });
        });
      };
      bindCardClicks();
      bindBottomControls();



      // Hook map marker clicks (vehicles, incident, hospitals)
      if (this.mapInstance) {
        this.mapInstance.onVehicleSelect = (plate) => {
          if (plate !== currentSelectedPlate) {
            setSelection(plate);
          } else {
            setSelection(null);
          }
        };

        this.mapInstance.onClearFocus = () => {
          if (currentSelectedPlate) {
            setSelection(null);
          }
        };

        this.mapInstance.onMapClick = () => {
          if (currentSelectedPlate) {
            setSelection(null);
          }
        };

        this.mapInstance.onIncidentSelect = (caseId) => {
          const c = activeCases.find(item => item.id === caseId);
          const plate = c?.dispatch?.vehiclePlate;
          if (!plate) return;
          if (plate !== currentSelectedPlate) setSelection(plate);
          if (bottomStrip) {
            bottomStrip.style.display = '';
            bottomStrip.innerHTML = this.renderRealtimeIncidentBottomStrip(c);
            bindBottomControls();
          }
        };

        this.mapInstance.onHospitalSelect = (hid) => {
          const h = (state.hospitals || []).find(item => item.id === hid);
          if (!h || !bottomStrip) return;
          bottomStrip.style.display = '';
          bottomStrip.innerHTML = this.renderRealtimeHospitalBottomStrip(h);
          bottomStrip.querySelector('.btn-call-hosp-bottom')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Đang quay số...', `Kết nối Hotline Cấp cứu: ${h.name} (${h.hotline})`);
          });
        };

        // Khôi phục chế độ theo dõi sau khi view re-render (chỉ khi người dùng đã chủ động chọn 1 xe cụ thể)
        if (currentSelectedPlate && this.realtimeSelectedPlate) {
          this.mapInstance.focusVehicle(currentSelectedPlate, { animate: false });
        } else {
          this.mapInstance.clearFocus();
        }
      }

      if (searchInput) searchInput.addEventListener('input', updateVehicleList);

      // Toggle sort popover dropdown (chỉ hiển thị ở vai trò Trung tâm điều hành)
      if (btnSortTrigger && sortDropdown) {
        btnSortTrigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = sortDropdown.style.display === 'block';
          sortDropdown.style.display = isOpen ? 'none' : 'block';
          btnSortTrigger.classList.toggle('active', !isOpen);
        });

        // Click outside to close sort dropdown
        document.addEventListener('click', (e) => {
          if (!e.target.closest('#btn-sort-vehicle-trigger') && !e.target.closest('#veh-sort-dropdown-menu')) {
            sortDropdown.style.display = 'none';
            btnSortTrigger.classList.remove('active');
          }
        });

        // Option item click inside dropdown
        sortDropdown.querySelectorAll('.sort-option-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const sortVal = item.getAttribute('data-sort-val');
            currentSortMode = sortVal || 'default';

            sortDropdown.querySelectorAll('.sort-option-item').forEach(opt => opt.classList.remove('active'));
            item.classList.add('active');

            sortDropdown.style.display = 'none';
            btnSortTrigger.classList.remove('active');
            btnSortTrigger.classList.toggle('has-filter', currentSortMode !== 'default');

            updateVehicleList();
          });
        });
      }

      // Tab switcher for right panel: Vehicles vs Active Cases (chỉ có ở vai trò Trung tâm điều hành)
      if (tabVehicles && tabCases) {
        tabVehicles.addEventListener('click', () => {
          tabVehicles.classList.add('active');
          tabCases.classList.remove('active');
          if (searchInput) searchInput.placeholder = 'Tìm biển số xe, kíp trực, trạm...';
          if (btnSortTrigger) btnSortTrigger.style.display = '';
          // Nếu đang có xe được chọn theo dõi, bấm vào tab Đội xe sẽ hủy chọn để quay lại xem toàn bộ xe và bệnh viện
          if (currentSelectedPlate) {
            setSelection(null);
          } else if (listEl) {
            listEl.innerHTML = this.renderVehicleCards(getFilteredVehicles(), null);
            bindCardClicks();
          }
        });
        tabCases.addEventListener('click', () => {
          tabCases.classList.add('active');
          tabVehicles.classList.remove('active');
          if (searchInput) searchInput.placeholder = 'Tìm mã ca, tình huống, xe chuyển...';
          if (btnSortTrigger) btnSortTrigger.style.display = 'none';
          if (listEl) {
            listEl.innerHTML = this.renderHospitalCaseCards(activeCases, currentSelectedPlate);
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
        const destHospital = activeCase?.dispatch?.hospitalName || 'BV Đa khoa thành phố Cần Thơ';
        const patientDesc = activeCase?.patient?.ageGroupText
          ? `nạn nhân (${activeCase.patient.ageGroupText}, ${activeCase.patient.gender || 'Nam'})`
          : 'nạn nhân cấp cứu';
        const locationText = activeCase?.location?.address || 'Cầu Hưng Lợi, P. Hưng Lợi, thành phố Cần Thơ';
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
                Trực ban tại: ${v.station} · Tốc độ: ${v.speed} km/h · Pin: <strong style="color:#10B981;">${v.battery}%</strong>
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
                Tốc độ: ${v.speed} km/h · Pin: ${v.battery}%
              </div>
            </div>
            <button class="btn btn-default btn-sm btn-focus-selected-vehicle" data-plate="${v.plate}">Xem Vị Trí</button>
          </div>
        `;
      }

      const isCamFront = this.activeCameraMode === 'FRONT';
      const cameraLabel = isCamFront ? 'CAM TRƯỚC' : 'CAM KHOANG';
      const cameraDesc = isCamFront
        ? `Camera Hành Trình Trước Xe (${v.plate})`
        : `Camera Khoang Xe / Bệnh Nhân (${v.plate})`;
      const streamInfo = v.gpsStatus === 'ONLINE' ? `Xe ${v.plate} · 25 FPS · 1080p` : 'Ngoại tuyến / Chế độ chờ';
      const signalText = v.gpsStatus === 'ONLINE' ? 'Tín hiệu truyền ổn định (5G)' : 'Chế độ chờ (Standby)';
      const signalColor = v.gpsStatus === 'ONLINE' ? '#10B981' : '#F59E0B';

      const rightStripHtml = `
        <div class="live-camera-strip">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <div class="camera-preview-box">
              <span style="font-size:10px;color:var(--text-white);font-weight:600;text-align:center;line-height:1.1;padding:2px;">${cameraLabel}</span>
            </div>
            <div style="font-size:12px;min-width:0;">
              <div style="color:var(--text-white);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cameraDesc}</div>
              <div style="color:var(--text-muted);font-size:11px;">${streamInfo}</div>
              <div style="color:${signalColor};font-size:11px;">${signalText}</div>
            </div>
          </div>

          <div class="cam-controls-group">
            <div style="display:flex;background:rgba(15,23,42,0.8);border:1px solid var(--border-main);border-radius:5px;padding:2px;gap:2px;">
              <button class="cam-switch-btn ${isCamFront ? 'active' : ''}" data-mode="FRONT" title="Chuyển sang Camera hành trình phía trước">
                Cam Trước
              </button>
              <button class="cam-switch-btn ${!isCamFront ? 'active' : ''}" data-mode="REAR" title="Chuyển sang Camera khoang cấp cứu trong xe">
                Cam Sau (Khoang)
              </button>
            </div>
            <button class="cam-snapshot-btn btn-capture-crew" data-plate="${v.plate}" title="Chụp ảnh ekip trực / khoang xe hiện tại">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              <span>Chụp ảnh kíp trực</span>
            </button>
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
              <strong style="color:#60A5FA;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Điểm Tiếp Nhận Cấp Cứu - Bệnh Viện</strong>
            </div>
            <div style="font-size:13px;color:var(--text-white);">
              <strong style="color:#FFFFFF;">${h.name}</strong> · ${h.address}
            </div>
            <div style="font-size:11px;color:var(--text-muted);">
              Khả năng tiếp nhận: <strong style="color:${isReady ? '#10B981' : isLimited ? '#F59E0B' : '#EF4444'};">${h.statusText || 'Đang nhận'}</strong>
            </div>
          </div>
          <button class="btn btn-default btn-sm btn-call-hosp-bottom" data-hosp="${h.name}" data-phone="${h.hotline}">
            ${window.CCNV_UI.ICONS.phone} ${h.hotline}
          </button>
        </div>
      `;

      const rightStripHtml = `
        <div class="live-camera-strip">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="camera-preview-box">
              <span style="font-size:10px;color:var(--text-muted);text-align:center;line-height:1.1;padding:2px;">CAM BỆNH VIỆN</span>
              <div style="position:absolute;top:4px;right:4px;" class="live-dot"></div>
            </div>
            <div style="font-size:12px;">
              <div style="color:var(--text-white);font-weight:600;">Camera Khu Tiếp Nhận Cấp Cứu</div>
              <div style="color:var(--text-muted);font-size:11px;">Cổng Cấp cứu ${h.name} · 25 FPS · 1080p</div>
              <div style="color:#10B981;font-size:11px;">Luồng truyền camera BV ổn định</div>
            </div>
          </div>
        </div>
      `;

      return leftStripHtml + rightStripHtml;
    }

    renderRealtimeIncidentBottomStrip(c = {}) {
      const plate = c.dispatch?.vehiclePlate || '-';
      const patient = c.patient?.ageGroupText
        ? `Nạn nhân · ${c.patient.ageGroupText} (${c.patient.gender || 'Nam'})`
        : 'Nạn nhân';
      const leftStripHtml = `
        <div class="emergency-alert-strip" style="background: linear-gradient(90deg, rgba(229, 37, 33, 0.22) 0%, transparent 100%);">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span class="live-dot"></span>
              <strong style="color:var(--red-vivid);font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Điểm Hiện Trường Cấp Cứu Khẩn Cấp · ${c.code || ''}</strong>
            </div>
            <div style="font-size:13px;color:var(--text-white);">
              Hiện trường: <strong style="color:var(--red-vivid);">${c.location?.address || '-'}</strong> - ${c.incident?.name || 'Cấp cứu'} (${patient})
            </div>
            <div style="font-size:11px;color:var(--text-muted);">
              Xe phụ trách: <strong style="color:var(--yellow-vivid);font-family:var(--font-mono);">${plate}</strong>${c.dispatch?.crewName ? ` (${c.dispatch.crewName})` : ''} · Về: ${c.dispatch?.hospitalName || '-'}${c.eta ? ` · ETA: ${c.eta}` : ''}
            </div>
          </div>
          <button class="btn btn-emergency btn-sm btn-focus-incident-vehicle" data-plate="${plate}">Theo Dõi Xe</button>
        </div>
      `;

      const isCamFront = this.activeCameraMode === 'FRONT';
      const cameraLabel = isCamFront ? 'CAM TRƯỚC' : 'CAM KHOANG';
      const cameraDesc = isCamFront
        ? `Camera Hành Trình Trước Xe (${plate})`
        : `Camera Cabin Khoang Bệnh Nhân (${plate})`;

      const rightStripHtml = `
        <div class="live-camera-strip">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <div class="camera-preview-box">
              <span style="font-size:10px;color:var(--text-white);font-weight:600;text-align:center;line-height:1.1;padding:2px;">${cameraLabel}</span>
              <div style="position:absolute;top:4px;right:4px;" class="live-dot"></div>
            </div>
            <div style="font-size:12px;min-width:0;">
              <div style="color:var(--text-white);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cameraDesc}</div>
              <div style="color:var(--text-muted);font-size:11px;">Xe ${plate} · 25 FPS · 1080p</div>
              <div style="color:#10B981;font-size:11px;">Tín hiệu truyền ổn định (5G)</div>
            </div>
          </div>

          <div class="cam-controls-group">
            <div style="display:flex;background:rgba(15,23,42,0.8);border:1px solid var(--border-main);border-radius:5px;padding:2px;gap:2px;">
              <button class="cam-switch-btn ${isCamFront ? 'active' : ''}" data-mode="FRONT" title="Chuyển sang Camera hành trình phía trước">
                Cam Trước
              </button>
              <button class="cam-switch-btn ${!isCamFront ? 'active' : ''}" data-mode="REAR" title="Chuyển sang Camera cabin bệnh nhân trong xe">
                Cam Sau
              </button>
            </div>
            <button class="cam-snapshot-btn btn-capture-crew" data-plate="${plate}" title="Chụp ảnh ekip trực / khoang xe hiện tại">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              <span>Chụp ảnh kíp trực</span>
            </button>
          </div>
        </div>
      `;

      return leftStripHtml + rightStripHtml;
    }

    // --- MODAL CUỘC GỌI TRỰC TIẾP KHẨN CẤP (4 LUỒNG KẾT NỐI) ---
    openLiveCallModal({ title, name, phone, type, plate, caseCode }) {
      document.getElementById('veh-call-overlay-modal')?.remove();

      window.CCNV_UI?.SoundFx?.playClick?.();
      window.CCNV_UI?.Toast?.show?.('ĐANG QUAY SỐ...', `Kết nối thoại khẩn cấp đến: ${name} (${phone})`);
      window.StateManager?.addAuditLog?.(`Thực hiện cuộc gọi đàm thoại khẩn cấp đến ${title}: ${name} (${phone})`);

      const callTypeClass = type ? type.toLowerCase() : 'center';
      const iconSvg = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;

      const modalEl = document.createElement('div');
      modalEl.className = 'veh-call-overlay-modal';
      modalEl.id = 'veh-call-overlay-modal';
      modalEl.innerHTML = `
        <div class="veh-call-modal-dialog">
          <div class="call-dialog-status-pill">
            <span class="live-call-dot"></span>
            <span>ĐANG ĐÀM THOẠI KHẨN CẤP</span>
          </div>

          <div class="call-avatar-circle ${callTypeClass}">
            <div class="call-ripple-ring"></div>
            <div class="call-ripple-ring delay"></div>
            ${iconSvg}
          </div>

          <div class="call-contact-target-role">${title}</div>
          <div class="call-contact-name">${name}</div>
          <div class="call-contact-phone">${phone}</div>
          ${caseCode ? `
            <div style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#38bdf8;background:rgba(56,189,248,0.12);padding:3px 10px;border-radius:20px;border:1px solid rgba(56,189,248,0.3);margin:2px auto 6px auto;font-family:var(--font-mono);font-weight:700;">
              <span>🚨 CA CẤP CỨU:</span><span>${caseCode}</span>
            </div>
          ` : ''}

          <div class="call-timer-display" id="call-timer-counter">00:01</div>

          <div class="call-wave-visualizer">
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
          </div>

          <div class="call-actions-row">
            <button type="button" class="call-sub-btn" id="btn-call-modal-mute" title="Bật/Tắt Mic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              <span>Mic</span>
            </button>
            <button type="button" class="btn-modal-hangup" id="btn-call-modal-hangup" title="Kết thúc cuộc gọi">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="23" y1="1" x2="1" y2="23"></line><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path></svg>
            </button>
            <button type="button" class="call-sub-btn active" id="btn-call-modal-speaker" title="Bật/Tắt Loa ngoài">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              <span>Loa</span>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modalEl);

      let seconds = 1;
      const timerEl = modalEl.querySelector('#call-timer-counter');
      const timerInterval = setInterval(() => {
        seconds++;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
      }, 1000);

      const hangupCall = () => {
        clearInterval(timerInterval);
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        const durationStr = `${mins}:${secs}`;
        modalEl.remove();
        window.CCNV_UI?.SoundFx?.playClick?.();
        window.CCNV_UI?.Toast?.show?.('ĐÃ KẾT THÚC CUỘC GỌI', `Cuộc gọi với ${name} đã kết thúc. Thời lượng: ${durationStr}`);
        window.StateManager?.addAuditLog?.(`Kết thúc cuộc gọi thoại với ${title}: ${name} (${durationStr})`);
      };

      modalEl.querySelector('#btn-call-modal-hangup')?.addEventListener('click', hangupCall);

      modalEl.querySelector('#btn-call-modal-mute')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.classList.toggle('active');
        const isMuted = btn.classList.contains('active');
        btn.querySelector('span').textContent = isMuted ? 'Đã tắt mic' : 'Mic';
      });

      modalEl.querySelector('#btn-call-modal-speaker')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.classList.toggle('active');
      });
    }

    // --- KÊNH CHAT TRAO ĐỔI TRỰC TIẾP CA CẤP CỨU & XE ---
    getVehicleChatMessages(caseKey, v, c) {
      const storageKey = `ccnv_case_chat_${caseKey}`;
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Error reading chat from storage:', e);
      }

      const caseCode = c?.code || caseKey || 'CC-261002-001';
      const incidentName = c?.incident?.name || c?.incidentName || 'Cấp cứu y tế';
      const locAddr = c?.location?.address || 'hiện trường';
      const hospName = c?.dispatch?.hospitalName || c?.hospitalName || c?.hospital || 'BV Đa khoa Trung ương Cần Thơ';
      const patientSummary = c?.patient ? `${c.patient.gender ? c.patient.gender + ' ' : ''}${c.patient.ageGroupText || (c.patient.age ? c.patient.age + 'T' : '')} - ${c.incident?.description || c.patient?.symptoms || incidentName}` : incidentName;

      const defaultMessages = [
        {
          id: 'cm-1',
          senderRole: 'DRIVER',
          senderName: 'Kíp xe (LX. Trần Văn Bình)',
          badge: 'LX',
          badgeClass: 'crew',
          time: '08:12:45',
          text: `Xe ${v?.plate || '65A-012.34'} đã tiếp nhận lệnh điều động ca ${caseCode}. Kíp trực đang xuất phát khẩn cấp tới ${locAddr}.`
        },
        {
          id: 'cm-2',
          senderRole: 'DISPATCHER',
          senderName: 'Trung tâm Điều phối 115',
          badge: '115',
          badgeClass: 'dispatch',
          time: '08:14:20',
          text: `Ca ${caseCode} (${incidentName}): Đã thông báo kíp ứng trực và yêu cầu CSGT hỗ trợ phân luồng trên lộ trình di chuyển.`
        },
        {
          id: 'cm-3',
          senderRole: 'DOCTOR',
          senderName: 'Kíp xe (BS. Võ Văn Kiệt)',
          badge: 'BS',
          badgeClass: 'crew',
          time: '08:18:40',
          text: `Đã tiếp cận hiện trường ${locAddr}. Nạn nhân: ${patientSummary}. Đang tiến hành sơ cấp cứu và chuẩn bị chuyển viện.`
        },
        {
          id: 'cm-4',
          senderRole: 'HOSPITAL',
          senderName: hospName,
          badge: 'BV',
          badgeClass: 'hospital',
          time: '08:21:15',
          text: `Khoa Cấp cứu [${hospName}] đã sẵn sàng tiếp nhận nạn nhân ca ${caseCode}.`
        }
      ];

      try {
        sessionStorage.setItem(storageKey, JSON.stringify(defaultMessages));
      } catch (e) { }

      return defaultMessages;
    }

    sendVehicleChatMessage(caseKey, text, targetVeh, activeCase) {
      if (!text || !text.trim()) return;
      const cleanText = text.trim();
      const storageKey = `ccnv_case_chat_${caseKey}`;
      const messages = this.getVehicleChatMessages(caseKey, targetVeh, activeCase);

      const isHospitalUser = this.isHospitalMode();
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const newMsg = {
        id: 'cm-' + Date.now(),
        senderRole: isHospitalUser ? 'HOSPITAL' : 'DISPATCHER',
        senderName: isHospitalUser ? 'BV tiếp nhận (Bạn)' : 'Trung tâm 115 (Bạn)',
        badge: isHospitalUser ? 'BV' : '115',
        badgeClass: isHospitalUser ? 'hospital' : 'dispatch',
        time: timeStr,
        text: cleanText
      };

      messages.push(newMsg);

      try {
        sessionStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (e) { }

      window.CCNV_UI?.SoundFx?.playClick?.();
      window.StateManager?.addAuditLog?.(`Gửi tin nhắn trao đổi ca ${caseKey}: "${cleanText}"`);

      return newMsg;
    }

    renderVehicleDetailPanel(v, activeCase = null) {
      if (!v) return '';

      const isEmergency = v.status === 'EMERGENCY';
      const statusBadge = isEmergency
        ? `<span class="status-pill status-pill-emergency" style="font-size:11px;">ĐANG CẤP CỨU</span>`
        : ``;

      const isCamFront = this.activeCameraMode === 'FRONT';
      const camTitle = isCamFront ? 'CAM 01 · HÀNH TRÌNH PHÍA TRƯỚC' : 'CAM 02 · KHOANG BỆNH NHÂN';

      // Match crew for this vehicle
      const state = window.StateManager?.getState();
      const matchedCrew = (state?.crews || []).find(c => c.defaultVehicle === v.plate || c.stationId === v.stationId) || {
        doctor: 'BS. Võ Văn Kiệt',
        nurse: 'ĐD. Nguyễn Thị Thúy',
        driver: 'Trần Văn Bình'
      };

      const equipmentList = v.equipment || [
        'Máy thở đa năng', 'Monitor 7 thông số', 'Máy sốc tim AED', 'Bơm tiêm điện', 'Bộ nẹp cố định chấn thương'
      ];

      // Tìm ca điều động ĐANG HOẠT ĐỘNG gắn với xe này
      const allActiveCases = (state?.cases || []).filter(c => !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(c.status));
      const isDemoActive = Boolean(this.demoRunning || state?.demoRunning);

      let resolvedCase = null;
      if (activeCase && !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(activeCase.status)) {
        resolvedCase = activeCase;
      } else {
        resolvedCase = allActiveCases.find(c => c.dispatch?.vehiclePlate === v.plate || c.currentVehiclePlate === v.plate || c.id === v.currentCaseId) || null;
      }

      if (!resolvedCase && isDemoActive && state?.demoCase && (state.demoCase.dispatch?.vehiclePlate === v.plate || v.plate === '65A-012.34')) {
        resolvedCase = state.demoCase;
      }

      if (!resolvedCase && v.isDispatchedSimulated) {
        resolvedCase = allActiveCases[0] || state?.demoCase || window.SEED_DATA?.demoCase || null;
      }

      // Xe chỉ coi là ĐANG TRONG CA CẤP CỨU khi:
      // - v.status thuộc nhóm đang điều động / cấp cứu
      // - hoặc v.isDispatchedSimulated
      // - hoặc (isDemoActive && v.plate === '65A-012.34')
      // - VÀ phải có resolvedCase hợp lệ
      const isEmergencyStatus = v.status === 'EMERGENCY' || v.status === 'DISPATCHED' || v.status === 'EN_ROUTE' || v.status === 'TRANSPORTING';
      const isDispatched = Boolean(
        resolvedCase && (
          isEmergencyStatus ||
          v.isDispatchedSimulated ||
          (isDemoActive && (state?.demoCase?.dispatch?.vehiclePlate === v.plate || v.plate === '65A-012.34'))
        )
      );

      // Nếu không có ca cấp cứu đang thực hiện thì reset resolvedCase để không hiển thị thông tin ca cũ
      if (!isDispatched) {
        resolvedCase = null;
      }

      // 4 LUỒNG CUỘC GỌI THEO YÊU CẦU:
      // 1. Tới người gọi báo tin
      // 2. Tới bệnh viện trung tâm (115)
      // 3. Tới bệnh viện tiếp nhận
      // 4. Tới lái xe
      // Nguyên tắc: Không gọi cho chính mình ->
      // - Đang ở Trung tâm: bỏ gọi tới trung tâm (còn: Người báo tin, Bệnh viện tiếp nhận, Lái xe)
      // - Đang ở Bệnh viện tiếp nhận: bỏ gọi tới bệnh viện tiếp nhận (còn: Người báo tin, Trung tâm 115, Lái xe)
      const isHospitalUser = this.isHospitalMode();

      const callerName = resolvedCase?.caller?.name || resolvedCase?.callerName || 'Người dân báo tin';
      const callerPhone = resolvedCase?.caller?.phone || resolvedCase?.callerPhone || '0913.882.115';
      const callerLocation = resolvedCase?.location?.address || 'Hiện trường ca cấp cứu';

      const centerName = 'Tổng đài Điều phối Cấp cứu 115 Cần Thơ';
      const centerPhone = '115 (0292.115.115)';

      const hospName = resolvedCase?.dispatch?.hospitalName || resolvedCase?.hospitalName || resolvedCase?.hospital || 'BV Đa khoa Trung ương Cần Thơ';
      const hospPhone = resolvedCase?.dispatch?.hospitalPhone || resolvedCase?.hospitalPhone || '0292.3820.071';

      const driverName = matchedCrew.driver || 'LX. Trần Văn Bình';
      const driverPhone = matchedCrew.driverPhone || '0913.555.666';

      const callTargets = [];

      // 1. Tới người gọi báo tin (luôn có)
      callTargets.push({
        type: 'CALLER',
        title: 'Người gọi báo tin',
        name: callerName,
        phone: callerPhone,
        iconClass: 'caller',
        desc: `Hiện trường: ${callerLocation}`
      });

      // 2. Tới bệnh viện trung tâm (Chỉ hiển thị khi là Bệnh viện tiếp nhận)
      if (isHospitalUser) {
        callTargets.push({
          type: 'CENTER',
          title: 'Bệnh viện trung tâm (Điều phối 115)',
          name: centerName,
          phone: centerPhone,
          iconClass: 'center',
          desc: `Điều phối ca ${resolvedCase?.code || ''}`
        });
      }

      // 3. Tới bệnh viện tiếp nhận (Chỉ hiển thị khi là Trung tâm điều hành)
      if (!isHospitalUser) {
        callTargets.push({
          type: 'HOSPITAL',
          title: 'Bệnh viện tiếp nhận',
          name: hospName,
          phone: hospPhone,
          iconClass: 'hospital',
          desc: `Khoa Cấp cứu tiếp nhận ca ${resolvedCase?.code || ''}`
        });
      }

      // 4. Tới lái xe (Cả 2 bên đều có)
      callTargets.push({
        type: 'DRIVER',
        title: 'Lái xe cứu thương',
        name: `${driverName} (${v.plate})`,
        phone: driverPhone,
        iconClass: 'driver',
        desc: `Kíp xe ${v.plate}`
      });

      // Kênh chat trao đổi trực tiếp
      const caseKey = resolvedCase?.code || v.plate;
      const chatMessages = (isDispatched && resolvedCase) ? this.getVehicleChatMessages(caseKey, v, resolvedCase) : [];

      // Tạo HTML 2 thanh timeline dạng ngang (Thời gian SLA & Thời gian thực tế chia theo mốc)
      let timelineSectionHtml = '';
      if (isDispatched) {
        const cCode = resolvedCase?.code || 'CC-261002-001';
        const cSeverity = resolvedCase?.incident?.severityText || resolvedCase?.severityText || 'Khẩn cấp';
        const cIncident = resolvedCase?.incident?.name || resolvedCase?.incidentName || 'Tai nạn giao thông';
        const cLocation = resolvedCase?.location?.address || 'Cầu Hưng Lợi, TP. Cần Thơ';
        const cHospName = resolvedCase?.dispatch?.hospitalName || 'BV Đa khoa Trung ương Cần Thơ';
        const ms = resolvedCase?.milestones || [];

        const getMilestoneTime = (stepKey, defaultTime) => {
          const m = ms.find(item => item.step === stepKey);
          return (m && m.time) ? m.time : defaultTime;
        };

        const milestones = [
          {
            name: 'Điều xe',
            fullName: 'Phát lệnh điều xe',
            actual: getMilestoneTime('DISPATCHED', '08:11:30'),
            durationText: '45s',
            sla: '08:12:00',
            slaStd: '≤ 2p',
            diff: 'Sớm 1p15s',
            isWithinSla: true,
            status: 'done'
          },
          {
            name: 'Xuất phát',
            fullName: 'Kíp rời trạm',
            actual: getMilestoneTime('CREW_CONFIRMED', '08:12:45'),
            durationText: '1p 15s',
            sla: '08:14:00',
            slaStd: '≤ 2p',
            diff: 'Sớm 45s',
            isWithinSla: true,
            status: 'done'
          },
          {
            name: 'Hiện trường',
            fullName: 'Đến hiện trường',
            actual: getMilestoneTime('SCENE_ARRIVED', '08:18:20'),
            durationText: '5p 35s',
            sla: '08:22:00',
            slaStd: '≤ 8p',
            diff: 'Sớm 2p25s',
            isWithinSla: true,
            status: 'done'
          },
          {
            name: 'Đến viện',
            fullName: 'Tiếp cận sảnh cấp cứu viện',
            actual: getMilestoneTime('HOSPITAL_ARRIVED', '08:28:40'),
            durationText: '10p 20s',
            sla: '08:32:00',
            slaStd: '≤ 10p',
            diff: 'Vượt 20s',
            isWithinSla: false, // Chặng này 10p20s > 10p SLA -> ĐỎ
            status: resolvedCase?.status === 'COMPLETED' ? 'done' : 'active'
          },
          {
            name: 'Bàn giao',
            fullName: 'Ký bàn giao khoa Cấp cứu',
            actual: getMilestoneTime('HANDOVER_DONE', '08:36:00'),
            durationText: '--',
            sla: '08:42:00',
            slaStd: '≤ 10p',
            diff: 'Mục tiêu',
            isWithinSla: true,
            status: resolvedCase?.status === 'COMPLETED' ? 'done' : 'pending'
          }
        ];

        // 4 phân đoạn giữa 5 mốc tính SLA độc lập
        const segments = [
          milestones[1],
          milestones[2],
          milestones[3],
          milestones[4]
        ];

        const hasExceededMilestone = milestones.some(m => m.status !== 'pending' && !m.isWithinSla);

        timelineSectionHtml = `
          <!-- KHỐI 1 THANH TIMELINE DẠNG NGANG (SLA TÍNH ĐỘC LẬP TỪNG MỐC) -->
          <div class="veh-dispatch-timeline-box">
            <!-- Header thông tin ca & Đánh giá SLA -->
            <div class="veh-dispatch-header">
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="live-dot" style="width:7px;height:7px;background:${hasExceededMilestone ? '#ef4444' : '#10b981'};"></span>
                <span style="font-size:11px;font-weight:700;color:var(--text-white);letter-spacing:0.3px;">TIẾN ĐỘ ĐIỀU ĐỘNG & THEO DÕI SLA</span>
              </div>
              <span class="badge ${hasExceededMilestone ? 'badge-warning' : 'badge-emerald'}" style="font-size:10px;font-weight:700;font-family:var(--font-mono);padding:2px 7px;${hasExceededMilestone ? 'background:rgba(239,68,68,0.18);color:#ef4444;border:1px solid rgba(239,68,68,0.45);' : ''}">
                ${hasExceededMilestone ? '⚠ 1 MỐC VƯỢT SLA' : '✔ CÁC MỐC ĐẠT SLA'}
              </span>
            </div>

            <!-- Tóm tắt ca đang phụ trách -->
            <div class="veh-dispatch-mission-card">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-family:var(--font-mono);font-weight:700;color:var(--accent-cyan);">Ca ${cCode}</span>
                <span class="badge badge-emergency" style="font-size:9.5px;padding:1px 5px;">${cSeverity}</span>
              </div>
              <div style="color:var(--text-white);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${cIncident} · ${cHospName}
              </div>
              <div style="font-size:10.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                Điểm đón: ${cLocation}
              </div>
            </div>

            <!-- THANH TIMELINE 1 LINE DUY NHẤT: CHIA THEO TỪNG MỐC, TÍNH SLA ĐỘC LẬP (XANH / ĐỎ) -->
            <div class="veh-horizontal-timelines">
              <div class="timeline-row">
                <div class="timeline-row-label">
                  <span style="color:#38bdf8;display:flex;align-items:center;gap:5px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Tiến trình SLA (Từng mốc độc lập)
                  </span>
                  <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:9.5px;">
                    Đã chạy: <strong style="color:var(--yellow-vivid);">17p 10s</strong> / Định mức: <strong style="color:#10b981;">≤ 32p</strong>
                  </span>
                </div>

                <!-- 1 Line timeline bar chia mốc với phân đoạn chuyển màu xanh / đỏ -->
                <div class="timeline-track-wrap">
                  <div class="timeline-segments-track">
                    ${segments.map(seg => {
          let segClass = 'pending';
          if (seg.status === 'done') {
            segClass = seg.isWithinSla ? 'ok' : 'fail';
          } else if (seg.status === 'active') {
            segClass = seg.isWithinSla ? 'active-ok' : 'active-fail';
          }
          return `<div class="timeline-segment-piece ${segClass}" title="${seg.fullName}: ${seg.isWithinSla ? 'Đạt SLA' : 'Vượt SLA'} (${seg.diff})"></div>`;
        }).join('')}
                  </div>

                  <!-- 5 Mốc Node -->
                  ${milestones.map((m, idx) => {
          let dotClass = 'pending';
          let iconContent = idx + 1;
          if (m.status === 'done') {
            dotClass = m.isWithinSla ? 'sla-ok' : 'sla-fail';
            iconContent = m.isWithinSla ? '✓' : '!';
          } else if (m.status === 'active') {
            dotClass = m.isWithinSla ? 'sla-active-ok' : 'sla-active-fail';
            iconContent = m.isWithinSla ? '●' : '!';
          }
          return `
                      <div class="timeline-node-item" title="${m.fullName}: Thực tế ${m.actual} · SLA ${m.slaStd} (${m.diff})">
                        <span class="timeline-node-name">${m.name}</span>
                        <div class="timeline-node-dot ${dotClass}">${iconContent}</div>
                        <span class="timeline-node-time" style="${!m.isWithinSla && m.status !== 'pending' ? 'color:#ef4444;font-weight:700;' : ''}">${m.actual}</span>
                      </div>
                    `;
        }).join('')}
                </div>
              </div>

            </div>
          </div>
        `;
      } else {
        // Nút mô phỏng nếu xe đang ở chế độ chờ (READY)
        timelineSectionHtml = `
          <div style="display:flex;justify-content:flex-end;margin-top:-4px;margin-bottom:2px;">
            <button type="button" class="btn btn-ghost btn-xs btn-toggle-sim-dispatch" data-plate="${v.plate}" style="color:var(--accent-cyan);font-size:10.5px;padding:2px 8px;display:inline-flex;align-items:center;gap:4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Xem mô phỏng tiến trình SLA xe này</span>
            </button>
          </div>
        `;
      }

      return `
        <div class="vehicle-detail-panel-box">
          <!-- Navigation header: Back to list button & Goto full detail button -->
          <div class="veh-detail-nav-header">
            <button type="button" class="btn-back-to-veh-list" id="btn-back-to-veh-list" title="${this.isHospitalMode() ? 'Quay lại danh sách ca tiếp nhận' : 'Quay lại danh sách xe'}">
              ‹ Quay lại danh sách
            </button>
            ${!this.isHospitalMode() ? `
            <button type="button" class="btn-veh-goto-detail" id="btn-veh-goto-detail" data-plate="${v.plate}" title="Xem chi tiết phương tiện trên màn Xe cứu thương">
              <span>Chi tiết</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            ` : ''}
          </div>

          <!-- Main Vehicle Overview Header -->
          <div class="veh-detail-card-main">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span class="vehicle-plate" style="font-size:17px;letter-spacing:0.5px;color:var(--text-white);">${v.plate}</span>
              ${statusBadge}
            </div>
            <div style="font-size:12px;color:#60A5FA;font-weight:600;margin-bottom:4px;">
              ${v.typeName || 'Xe Cứu thương Cấp cứu 115'}
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
              <span>${v.station || 'Trạm Cấp cứu 115'}</span>
            </div>
          </div>

          <!-- Realtime Stats Bar (Speed & Battery only) -->
          <div class="veh-detail-stats-grid" style="grid-template-columns:1fr 1fr;">
            <div class="veh-stat-item">
              <span class="stat-lbl">Tốc độ</span>
              <strong class="stat-val" style="color:var(--yellow-vivid);">${v.speed || 0} km/h</strong>
            </div>
            <div class="veh-stat-item">
              <span class="stat-lbl">Pin GPS</span>
              <strong class="stat-val" style="color:#10B981;">${v.battery || 96}%</strong>
            </div>
          </div>

          <!-- 2 THANH TIMELINE DẠNG NGANG & ĐỐI CHIẾU MỐC SLA KHI XE ĐƯỢC ĐIỀU ĐỘNG -->
          ${timelineSectionHtml}

          <!-- Kíp trực phụ trách xe -->
          <div class="veh-detail-section">
            <div class="veh-section-title">KÍP TRỰC PHỤ TRÁCH THƯỜNG TRỰC</div>
            <div class="veh-crew-list">
              <div class="veh-crew-row">
                <span class="crew-role-badge doc">BS</span>
                <span class="crew-name">${matchedCrew.doctor || 'BS. Võ Văn Kiệt'}</span>
              </div>
              <div class="veh-crew-row">
                <span class="crew-role-badge nur">ĐD</span>
                <span class="crew-name">${matchedCrew.nurse || 'ĐD. Nguyễn Thị Thúy'}</span>
              </div>
              <div class="veh-crew-row">
                <span class="crew-role-badge drv">LX</span>
                <span class="crew-name">${matchedCrew.driver || 'Trần Văn Bình'}</span>
              </div>
            </div>
          </div>

          ${isDispatched && resolvedCase ? `
          <!-- CUỘC GỌI KHẨN CẤP (3 LUỒNG THEO VAI TRÒ) - CHỈ HIỂN THỊ TRONG CA CẤP CỨU -->
          <div class="veh-detail-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <div class="veh-section-title" style="margin-bottom:0;display:flex;align-items:center;gap:6px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                <span>LIÊN HỆ KHẨN CẤP</span>
              </div>
              <span class="badge badge-accent" style="font-size:10px;font-family:var(--font-mono);font-weight:700;padding:2px 7px;">CA: ${resolvedCase.code}</span>
            </div>

            <div class="veh-call-list">
              ${callTargets.map(tgt => `
                <button type="button" class="btn-veh-call-action" data-call-target="${tgt.type}" data-title="${tgt.title}" data-name="${tgt.name}" data-phone="${tgt.phone}" data-case-code="${resolvedCase.code}" title="Gọi đến ${tgt.title}: ${tgt.name}">
                  <div class="veh-call-btn-left">
                    <div class="veh-call-icon-wrap ${tgt.iconClass}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </div>
                    <div class="veh-call-btn-info">
                      <div class="veh-call-btn-target">${tgt.title}</div>
                    </div>
                  </div>
                  <span class="veh-call-btn-badge">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    <span>Gọi</span>
                  </span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- TRAO ĐỔI TRỰC TIẾP - CHỈ HIỂN THỊ TRONG CA CẤP CỨU -->
          <div class="veh-detail-section veh-chat-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <div class="veh-section-title" style="margin-bottom:0;display:flex;align-items:center;gap:6px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>TRAO ĐỔI TRỰC TIẾP · ${resolvedCase.code}</span>
              </div>
              <span class="live-status-tag" style="background:rgba(16,185,129,0.15);color:#34d399;border-color:rgba(16,185,129,0.35);">
                Đang trực tuyến
              </span>
            </div>

            <div class="veh-chat-box" data-case-key="${caseKey}">
              <!-- Chat message stream -->
              <div class="veh-chat-stream" id="veh-chat-stream">
                ${chatMessages.map(m => {
                  const isMine = isHospitalUser ? m.senderRole === 'HOSPITAL' : m.senderRole === 'DISPATCHER';
                  return `
                    <div class="veh-chat-bubble ${isMine ? 'mine' : 'other'}">
                      <div class="veh-chat-bubble-header">
                        <span class="veh-chat-sender-tag ${m.badgeClass || 'dispatch'}">${m.badge || ''} ${m.senderName}</span>
                        <span class="veh-chat-time">${m.time}</span>
                      </div>
                      <div class="veh-chat-bubble-body">${m.text}</div>
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Quick reply suggestion chips theo ca -->
              <div class="veh-chat-quick-chips">
                <button type="button" class="veh-chat-chip" data-msg="Cập nhật sinh hiệu mới nhất của nạn nhân ca ${resolvedCase.code}?">Sinh hiệu ca ${resolvedCase.code}?</button>
                <button type="button" class="veh-chat-chip" data-msg="Xe ${v.plate} cách ${hospName ? hospName.replace(/Bệnh viện|Đa khoa/g, '').trim() : 'bệnh viện tiếp nhận'} bao xa?">Khoảng cách đến viện?</button>
                <button type="button" class="veh-chat-chip" data-msg="Khoa Cấp cứu đã sẵn sàng phòng can thiệp đón nạn nhân ca ${resolvedCase.code}.">Sẵn sàng phòng cấp cứu</button>
                <button type="button" class="veh-chat-chip" data-msg="Hiện trường tại ${resolvedCase.location?.address || 'điểm sự cố'} có ùn tắc không?">Tình hình hiện trường?</button>
              </div>

              <!-- Chat input bar -->
              <div class="veh-chat-input-bar">
                <input type="text" class="veh-chat-input" id="veh-chat-input" placeholder="Nhập tin nhắn trao đổi nhanh..." maxlength="200" autocomplete="off" />
                <button type="button" class="btn-veh-chat-send" id="btn-veh-chat-send" title="Gửi tin nhắn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          ` : `
          <!-- TRẠNG THÁI SẴN SÀNG THƯỜNG TRỰC (KHÔNG TRONG CA CẤP CỨU) -->
          <div class="veh-detail-section veh-standby-section">
            <div style="background:rgba(16,185,129,0.06);border:1px dashed rgba(16,185,129,0.25);border-radius:8px;padding:14px 16px;text-align:center;">
              <div style="display:flex;align-items:center;justify-content:center;gap:7px;color:#34d399;font-weight:700;font-size:12.5px;margin-bottom:5px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;"></span>
                <span>PHƯƠNG TIỆN SẴN SÀNG ĐIỀU ĐỘNG</span>
              </div>
              <div style="font-size:11.5px;color:var(--text-muted);line-height:1.5;">
                Xe và kíp trực đang ở trạng thái thường trực sẵn sàng tại trạm. Kênh <strong>Liên hệ khẩn cấp</strong> và <strong>Trao đổi trực tiếp</strong> sẽ tự động kích hoạt khi xe nhận lệnh điều động ca cấp cứu.
              </div>
            </div>
          </div>
          `}

          <!-- Trang thiết bị y tế trên xe -->
          <div class="veh-detail-section">
            <div class="veh-section-title">TRANG THIẾT BỊ Y TẾ TRÊN XE</div>
            <div class="veh-equip-tags">
              ${equipmentList.map(eq => `<span class="veh-equip-chip">${eq}</span>`).join('')}
            </div>
          </div>

          <!-- Live Video Stream Window (Cam Trước / Cam Sau) -->
          <div class="veh-detail-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <div class="veh-section-title" style="margin-bottom:0;">LUỒNG GHI HÌNH THỰC TẾ</div>
              <span class="live-status-tag"><span class="live-dot" style="width:6px;height:6px;margin-right:4px;"></span>LIVE</span>
            </div>

            <!-- Cam Switcher Tabs -->
            <div class="veh-cam-tabs">
              <button type="button" class="veh-cam-tab-btn ${isCamFront ? 'active' : ''}" data-cam-mode="FRONT">
                Cam trước
              </button>
              <button type="button" class="veh-cam-tab-btn ${!isCamFront ? 'active' : ''}" data-cam-mode="REAR">
                Cam sau
              </button>
            </div>

            <!-- Live Camera Feed Video Window -->
            <div class="veh-cam-feed-container ${isCamFront ? 'is-front' : 'is-rear'}">
              <div class="cam-feed-hud-top">
                <span>${camTitle}</span>
                <span>REC 🔴</span>
              </div>
              
              <!-- Video / Simulated Feed Canvas visual -->
              <div class="cam-feed-viewport">
                <div class="cam-grid-overlay"></div>
                <div class="cam-feed-center-info">
                  <div class="cam-feed-text" style="font-size:13px;font-weight:700;">${isCamFront ? 'Cam trước' : 'Cam sau'}</div>
                </div>
              </div>

              <div class="cam-feed-hud-bottom">
                <span>XE ${v.plate} · ${v.speed || 0} KM/H</span>
                <span>5G ONLINE</span>
              </div>
            </div>

            <!-- Action buttons below camera feed -->
            <div style="display:flex;gap:6px;margin-top:10px;">
              <button type="button" class="btn btn-default btn-xs btn-capture-crew" data-plate="${v.plate}" style="flex:1;justify-content:center;">
                Chụp ảnh
              </button>
              <button type="button" class="btn btn-default btn-xs btn-focus-selected-vehicle" data-plate="${v.plate}" style="flex:1;justify-content:center;">
                Vị trí hiện tại
              </button>
            </div>
          </div>
        </div>
      `;
    }

    renderVehicleCards(vehicles, selectedPlate = null) {
      if (!vehicles || vehicles.length === 0) {
        return `<div style="text-align:center;padding:24px;color:var(--text-muted);">Không tìm thấy phương tiện</div>`;
      }

      const state = window.StateManager?.getState();
      const allCases = (state?.cases || []).filter(c => !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(c.status));

      // Chỉ kiểm tra phân công khi đang chạy demo hoặc thực sự có ca điều động được phát lệnh
      const isDemoActive = Boolean(this.demoRunning || state?.demoRunning);

      // Hàm kiểm tra xe có đang được phân công/điều động thực hiện ca cấp cứu hay không
      const isVehicleDispatched = (v) => {
        if (!v) return false;
        // Nếu không trong chế độ demo và không có ca active nào thì tất cả xe ở trạng thái bình thường
        if (!isDemoActive && allCases.length === 0 && !v.isDispatchedSimulated) {
          return false;
        }

        if (v.status === 'EMERGENCY' || v.status === 'DISPATCHED' || v.status === 'EN_ROUTE' || v.status === 'TRANSPORTING') return true;
        if (v.isDispatchedSimulated) return true;
        if (v.currentCaseId) return true;
        const hasCase = allCases.some(c => c.dispatch?.vehiclePlate === v.plate || c.currentVehiclePlate === v.plate);
        if (hasCase) return true;
        if (isDemoActive && state?.demoCase && state.demoCase.dispatch?.vehiclePlate === v.plate) return true;
        return false;
      };

      // Tự động đẩy xe đang được phân công lên đầu danh sách (chỉ khi có xe nhận ca)
      const sortedVehicles = [...vehicles].sort((a, b) => {
        const aDisp = isVehicleDispatched(a) ? 1 : 0;
        const bDisp = isVehicleDispatched(b) ? 1 : 0;
        if (aDisp !== bDisp) {
          return bDisp - aDisp; // 1 (được phân công) đứng trước 0
        }
        return 0; // Giữ nguyên thứ tự ban đầu nếu chưa có ca
      });

      return sortedVehicles.map(v => {
        const isEmergency = isVehicleDispatched(v);
        const isSelected = v.plate === selectedPlate;
        return `
          <div class="vehicle-card ${isEmergency ? 'is-emergency' : ''} ${isSelected ? 'is-selected' : ''}" data-plate="${v.plate}">
            <div class="vehicle-card-top">
              <span class="vehicle-plate">${v.plate}</span>
              ${window.CCNV_UI.Badges.forVehicleStatus(isEmergency ? 'EMERGENCY' : v.status)}
            </div>
            <div style="font-size:12px;color:var(--text-white);margin-top:2px;">${v.station}</div>
            <div class="vehicle-meta-row">
              <span>${v.typeName}</span>
              <span>Tốc độ: <strong style="color:var(--text-white);">${v.speed} km/h</strong></span>
            </div>
            <div class="vehicle-meta-row" style="border-top:1px dashed var(--border-main);padding-top:4px;margin-top:4px;display:flex;align-items:center;justify-content:space-between;">
              ${window.CCNV_UI.renderBattery(v.battery)}
              <button type="button" class="btn-card-veh-detail" data-plate="${v.plate}" title="Xem chi tiết kỹ thuật và kíp trực của xe ${v.plate}">
                <span>Chi tiết</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    renderHospitalCaseCards(casesList, selectedPlate = null) {
      if (!casesList || casesList.length === 0) {
        return `
          <div style="padding:36px 16px;text-align:center;color:var(--text-muted);font-size:12.5px;">
            <div style="font-size:36px;margin-bottom:10px;opacity:0.85;">🏥</div>
            <div style="font-weight:700;color:var(--text-white);font-size:13.5px;margin-bottom:6px;">Sẵn sàng tiếp nhận cấp cứu</div>
            <div style="font-size:12px;color:var(--text-slate);line-height:1.5;">Khoa Cấp cứu đang trong trạng thái sẵn sàng. Khi có tín hiệu chuyển nạn nhân từ Trung tâm 115, hãy nhấn vào biểu tượng quả chuông ở góc trên bên phải để mở thông báo và xác nhận tiếp nhận.</div>
          </div>
        `;
      }

      return casesList.map(c => {
        const plate = c.dispatch?.vehiclePlate || '';
        const isSelected = Boolean(plate && plate === selectedPlate);
        const ageText = c.patient?.ageGroupText || 'Người trưởng thành';
        const genderText = c.patient?.gender ? ` (${c.patient.gender})` : '';
        const incidentName = c.incident?.name || 'Cấp cứu';
        const isAccepted = c.hospitalResponse === 'ACCEPTED';
        const statusText = isAccepted
          ? (c.statusText || (c.status === 'TRANSPORTING' ? 'Đang đến viện' : 'Đã tiếp nhận'))
          : 'Chờ xác nhận';
        const hospitalName = c.dispatch?.hospitalName || 'Bệnh viện tiếp nhận';
        const etaText = c.eta || (c.status === 'TRANSPORTING' ? '4 phút' : '-');

        return `
          <div class="vehicle-card is-emergency ${isSelected ? 'is-selected' : ''} ${!isAccepted ? 'is-pending-confirm' : ''}" data-plate="${plate}" data-case-id="${c.id}" style="margin-bottom:8px;cursor:pointer;transition:border-color 0.2s, background-color 0.2s;${!isAccepted ? 'border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.05);' : ''}">
            <div class="vehicle-card-top" style="display:flex;align-items:center;justify-content:space-between;">
              <span class="vehicle-plate" style="color:${isAccepted ? 'var(--red-vivid)' : '#f59e0b'};font-weight:700;letter-spacing:0.3px;">${c.code}</span>
              ${!isAccepted ? `
                <span class="status-pill" style="font-size:10.5px;padding:2px 8px;background:rgba(245,158,11,0.22);color:#fbbf24;border:1px solid rgba(245,158,11,0.5);font-weight:700;animation:pulse 2s infinite;">
                  ● Chờ xác nhận
                </span>
              ` : `
                <span class="status-pill status-pill-completed" style="font-size:10.5px;padding:2px 8px;background:rgba(16,185,129,0.2);color:#34d399;border:1px solid rgba(16,185,129,0.5);font-weight:700;">
                  ✓ Đã tiếp nhận
                </span>
              `}
            </div>
            
            <div style="font-size:12.5px;color:var(--text-white);margin-top:4px;font-weight:600;">
              Nạn nhân: ${ageText}${genderText}
            </div>

            <div class="vehicle-meta-row" style="margin-top:4px;">
              <span style="color:var(--text-white);">${incidentName}</span>
              <span>Xe: <strong style="color:var(--yellow-vivid);font-family:var(--font-mono);">${plate || 'Chưa gán'}</strong></span>
            </div>

            <div class="vehicle-meta-row" style="border-top:1px dashed var(--border-main);padding-top:5px;margin-top:5px;font-size:11px;">
              <span style="color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;" title="${hospitalName}">Đến: ${hospitalName}</span>
              <span style="color:var(--yellow-vivid);font-weight:700;">ETA: ${etaText}</span>
            </div>

            ${!isAccepted ? `
              <div style="font-size:11px;color:#fbbf24;margin-top:6px;padding:5px 8px;background:rgba(245,158,11,0.12);border-radius:6px;border:1px dashed rgba(245,158,11,0.35);line-height:1.35;">
                ⚠️ <strong>Chưa nhận ca:</strong> Bản đồ chỉ hiện vị trí bệnh viện. Bấm <strong>"Xác nhận ca"</strong> để theo dõi xe đang đến.
              </div>
            ` : ''}

            <div style="display:flex;gap:6px;margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.06);">
              <button type="button" class="btn btn-xs btn-default btn-view-case-detail" data-case-id="${c.id}" style="flex:1;padding:4px 6px;font-size:11px;" title="Xem hồ sơ bệnh án điện tử">
                Hồ sơ ePCR
              </button>
              ${!isAccepted ? `
                <button type="button" class="btn btn-xs btn-emergency btn-confirm-hospital-case-btn" data-case-id="${c.id}" data-plate="${plate}" style="padding:4px 10px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px;box-shadow:0 0 10px rgba(239,68,68,0.4);" title="Xác nhận tiếp nhận ca cấp cứu này để theo dõi xe trên bản đồ">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>Xác nhận ca</span>
                </button>
              ` : `
                ${plate ? `
                <button type="button" class="btn btn-xs btn-hosp-veh-detail btn-card-veh-detail" data-plate="${plate}" title="Xem chi tiết xe và kíp trực">
                  <span>Chi tiết</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
                ` : ''}
              `}
            </div>
          </div>
        `;
      }).join('');
    }

    // --- 2. CALL CENTER (TỔNG ĐÀI 115) VIEW (SITEMAP 8.1) ---
    // demo (tuỳ chọn): { call, plate, crewIds, onDispatch, onCancel } - dùng form này đè lên Bản đồ ca khi chạy demo
    renderCallCenterView(container, activeTab = 'history', demo = null) {
      if (!demo && activeTab === 'transfer') activeTab = 'history';
      const state = window.StateManager.getState();
      const calls = state.callHistory || [];
      const operatorNameMap = {
        'dpv01': 'Nguyễn Văn An',
        'dpv02': 'Trần Minh Đức',
        'dpv03': 'Lê Hoàng Nam'
      };
      calls.forEach(c => {
        if (operatorNameMap[c.operator]) c.operator = operatorNameMap[c.operator];
      });
      const hospitals = state.hospitals || [];
      const presets = state.locationPresets || [];
      const incidentTypes = state.incidentTypes || [];
      const activeCall = demo?.call || {
        callerName: 'Người dân báo tin',
        callerPhone: '0913.882.115',
        patientAgeGroup: 'ADULT',
        patientAgeGroupText: 'Người trưởng thành',
        patientGender: '',
        address: '',
        incidentCode: null,
        incidentName: '',
        severity: null,
        sourceName: '115 Thoại (Trực tiếp)',
        notes: ''
      };

      container.innerHTML = `
        <div class="view-container-full">
          <div id="call-tab-pane-container"></div>
        </div>
      `;

      const paneContainer = container.querySelector('#call-tab-pane-container');



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
        // Demo: đưa xe / kíp của kịch bản lên đầu danh sách 6 ô để luôn chọn được
        const pinFirst = (list, keep) => [...list.filter(keep), ...list.filter(x => !keep(x))].slice(0, 6);
        let availableVehicles = demo
          ? pinFirst((state.vehicles || []).filter(v => v.status === 'READY'), v => v.plate === demo.plate)
          : ((state.vehicles && state.vehicles.length >= 6) ? state.vehicles.slice(0, 6) : (state.vehicles || []));
        let currentSelectedPlates = demo ? new Set([demo.plate]) : new Set();
        let currentVehicleTypes = new Set();
        let currentVehicleType = null;

        // On-duty personnel for current shift (Bác sĩ, Điều dưỡng, Lái xe)
        let availablePersonnel = demo
          ? pinFirst((state.personnel || []).filter(p => p.status === 'ON_DUTY'), p => demo.crewIds.includes(p.id))
          : ((state.personnel && state.personnel.length >= 6)
            ? state.personnel.filter(p => p.status === 'ON_DUTY').slice(0, 6)
            : (state.personnel ? state.personnel.slice(0, 6) : []));
        // Default: preselect demo crew if in demo mode
        let currentSelectedPersonnel = demo && demo.crewIds ? new Set(demo.crewIds) : new Set();

        // Hospitals list from Danh mục & Cấu hình (state.hospitals)
        let availableHospitals = state.hospitals && state.hospitals.length > 0 ? state.hospitals : [
          { id: 'HOSP_BVDK', name: 'Bệnh viện Đa khoa thành phố Cần Thơ', hotline: '0967.891.115', address: 'Số 04 Châu Văn Liêm, P. Tân An, thành phố Cần Thơ', availableBeds: 12, statusText: 'Đang nhận', isCenter: true },
          { id: 'HOSP_BVTU', name: 'Bệnh viện Đa khoa Trung ương Cần Thơ', hotline: '0901.234.567', address: '315 Nguyễn Văn Linh, P. An Khánh, thành phố Cần Thơ', availableBeds: 8, statusText: 'Đang nhận' },
          { id: 'HOSP_BVND', name: 'Bệnh viện Nhi đồng Cần Thơ', hotline: '0918.456.789', address: '345 Nguyễn Văn Cừ nối dài, P. An Bình, thành phố Cần Thơ', availableBeds: 15, statusText: 'Đang nhận' },
          { id: 'HOSP_BVUB', name: 'Bệnh viện Ung bướu Cần Thơ', hotline: '0292.3817.901', address: 'Số 20 Châu Văn Liêm, P. An Lạc, thành phố Cần Thơ', availableBeds: 6, statusText: 'Đang nhận' }
        ];
        let currentHospitalId = demo ? (demo.hospitalId || 'HOSP_BVTU' || availableHospitals[0]?.id) : null;
        let isRecAppliedDismissed = false;

        let currentSeverity = (activeCall.severity && activeCall.severity.length > 0) ? activeCall.severity : null;
        let currentGender = activeCall.patientGender || '';
        let currentIncident = (activeCall.incidentCode && activeCall.incidentCode.length > 0) ? activeCall.incidentCode : null;
        let currentFocusedCard = 'card-patient';
        let currentStep = 1; // 1: Thu thập thông tin, 2: Điều phối nguồn lực

        // Multi-patient State Management: khoi tao sanh sach de tiep nhan giong noi tu dong fill
        let patients = [
          {
            id: 1,
            ageGroup: 'ADULT',
            gender: activeCall.patientGender || 'Nam',
            notes: activeCall.notes || ''
          }
        ];

        // Vehicle lookup helpers
        const getRecommendedVehicle = () => {
          const firstPlate = Array.from(currentSelectedPlates)[0];
          return availableVehicles.find(v => v.plate === firstPlate) || availableVehicles[0] || state.vehicles[0];
        };

        paneContainer.innerHTML = `
          <div class="call-intake-layout-2col">
            <!-- CỘT TRÁI: LIVE CALL & VOICE HUD SPEECH-TO-TEXT (CHỈ SCROLL PHẦN TRÍCH XUẤT KỊCH BẢN) -->
            <div class="voice-stt-panel" id="voice-stt-panel">
              <!-- Header: Live Call info + Waveform Equalizer + Status -->
              <div class="voice-stt-header">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <div style="font-size:15px;font-weight:700;color:var(--text-white);font-family:var(--font-mono);letter-spacing:0.5px;">
                    ${activeCall.callerPhone || '0913.882.115'}
                  </div>
                </div>

                <div style="display:flex;align-items:center;gap:8px;">
                  <button type="button" class="btn-header-replay" id="btn-header-replay" title="Nghe lại cuộc gọi từ đầu">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                      <path d="M3 3v5h5"></path>
                    </svg>
                    <span>Nghe lại</span>
                  </button>

                  <!-- Soundwave equalizer -->
                  <div class="voice-wave-container" id="voice-wave-eq" title="Âm thanh đàm thoại thời gian thực">
                    <div class="voice-wave-bar"></div>
                    <div class="voice-wave-bar"></div>
                    <div class="voice-wave-bar"></div>
                    <div class="voice-wave-bar"></div>
                    <div class="voice-wave-bar"></div>
                  </div>
                  <span class="voice-timer-display" id="voice-timer-display">00:00</span>
                </div>
              </div>

              <!-- Real-time Dialogue Feed (Speech-to-Text: Day du 5 luot kich ban - Chỉ phần này được scroll) -->
              <div class="voice-dialogue-feed" id="voice-dialogue-feed">
                <!-- Rendered dynamically by voice demo engine -->
              </div>

              <!-- TÓM TẮT TỪ KHÓA AI TRÍCH XUẤT (Click để nhảy & highlight câu thoại) -->
              <div class="voice-keywords-summary-section" id="voice-keywords-summary-section">
                <div class="voice-keywords-header">
                  <div style="display:flex;align-items:center;gap:6px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    <span class="voice-keywords-title">TÓM TẮT TỪ KHÓA AI</span>
                    <span style="font-size:10px;color:#64748B;">(Bấm để nhảy tới đoạn thoại)</span>
                  </div>
                  <span class="voice-keywords-count" id="voice-keywords-count">0 từ khóa</span>
                </div>
                <div class="voice-keywords-chips-bar" id="voice-keywords-chips-bar">
                  <span class="voice-kw-empty" id="voice-kw-empty">Đang lắng nghe và trích xuất từ khóa quan trọng...</span>
                </div>
              </div>

              <!-- Thanh thao tác ngang cột trái: Cúp máy -->
              <div class="voice-hangup-bar">
                <button type="button" class="btn-voice-hangup" id="btn-call-hangup" title="Kết thúc cuộc gọi">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                    <line x1="23" y1="1" x2="1" y2="23"></line>
                  </svg>
                  <span>Cúp máy</span>
                </button>
              </div>
            </div>

            <!-- CỘT PHẢI: FORM TIẾP NHẬN & ĐIỀU PHỐI (NHÌN THẤY TOÀN BỘ, KHÔNG CẦN SCROLL) -->
            <div class="call-intake-forms-col">
              <!-- STEP 1 VIEW PANE: THU THẬP THÔNG TIN CƠ BẢN (CARD 1..4) -->
              <div class="step-view-pane" id="pane-step-1">
                <!-- FORM CARD 1: Thông tin bệnh nhân (Mở rộng đa nạn nhân) -->
                <div class="rapid-field-card is-active-step" id="card-patient" data-step-id="1">
                  <div class="rapid-field-header" style="margin-bottom:4px;">
                    <div class="rapid-field-title">
                      <span class="rapid-step-num">1</span>
                      <span>Thông tin Nạn nhân</span>
                    </div>

                    <!-- Bộ chọn nhanh số lượng bệnh nhân đặt trên header line để tiết kiệm chiều cao -->
                    <div style="display:flex;align-items:center;gap:6px;">
                      <div style="display:flex;gap:4px;" id="patient-count-selector">
                        <button type="button" class="patient-count-btn" id="btn-add-patient-quick" style="padding:2px 7px;font-size:11px;">+ Thêm</button>
                      </div>
                    </div>
                  </div>

                  <!-- Danh sách bệnh nhân (Dynamic multi-patient list) -->
                  <div class="patient-list-container" id="patient-items-wrapper">
                    <!-- Được render bởi renderPatientsList() -->
                  </div>
                </div>

                <!-- FORM CARD 2: Vị trí hiện trường (Chỉ trường vị trí, không chú thích) -->
                <div class="rapid-field-card" id="card-location" data-step-id="2">
                  <div class="rapid-field-header" style="margin-bottom:4px;">
                    <div class="rapid-field-title">
                      <span class="rapid-step-num">2</span>
                      <span>Vị trí hiện trường đón cấp cứu</span>
                    </div>
                  </div>

                  <div class="form-field" style="margin-bottom:0;">
                    <input type="text" id="rapid-address" value="${activeCall.address || ''}" placeholder="Đang nhận dạng địa chỉ từ cuộc gọi..." style="height:30px;font-size:12px;" />
                  </div>
                </div>

                <!-- FORM CARD 3: Tình huống cấp cứu (Step 3 - Incident Selector 1 to 8) -->
                <div class="rapid-field-card" id="card-incident" data-step-id="3" tabindex="0">
                  <div class="rapid-field-header" style="margin-bottom:4px;">
                    <div class="rapid-field-title">
                      <span class="rapid-step-num">3</span>
                      <span>Loại Tình huống Cấp cứu</span>
                    </div>
                  </div>

                  <div class="rapid-chip-grid rapid-chip-grid-4" style="gap:5px;">
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_TNGT' ? 'active' : ''}" data-incident="INC_TNGT" data-key="1" style="padding:4px 8px;min-height:34px;">
                      <kbd class="quick-kbd">1</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="font-size:11.5px;">Tai nạn</span>
                        <span class="chip-desc" style="font-size:10px;">Va chạm đường bộ</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_STROKE' ? 'active' : ''}" data-incident="INC_STROKE" data-key="2" style="padding:4px 8px;min-height:34px;">
                      <kbd class="quick-kbd">2</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="font-size:11.5px;">Đột quỵ</span>
                        <span class="chip-desc" style="font-size:10px;">Liệt mặt, yếu chi</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_CARDIAC' ? 'active' : ''}" data-incident="INC_CARDIAC" data-key="3" style="padding:4px 8px;min-height:34px;">
                      <kbd class="quick-kbd">3</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="font-size:11.5px;">Ngừng tim / CPR</span>
                        <span class="chip-desc" style="font-size:10px;">Đau thắt, mất mạch</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_RESPIRATORY' ? 'active' : ''}" data-incident="INC_RESPIRATORY" data-key="4" style="padding:4px 8px;min-height:34px;">
                      <kbd class="quick-kbd">4</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="font-size:11.5px;">Suy hô hấp</span>
                        <span class="chip-desc" style="font-size:10px;">Khó thở, tím tái</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_TRAUMA' ? 'active' : ''}" data-incident="INC_TRAUMA" data-key="5" style="padding:4px 8px;min-height:34px;">
                      <kbd class="quick-kbd">5</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="font-size:11.5px;">Chấn thương</span>
                        <span class="chip-desc" style="font-size:10px;">Ngã cao, gãy xương</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_OBSTETRIC' ? 'active' : ''}" data-incident="INC_OBSTETRIC" data-key="6" style="padding:4px 8px;min-height:34px;">
                      <kbd class="quick-kbd">6</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="font-size:11.5px;">Sản khoa</span>
                        <span class="chip-desc" style="font-size:10px;">Chuyển dạ, băng huyết</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_PEDIATRIC' ? 'active' : ''}" data-incident="INC_PEDIATRIC" data-key="7" style="padding:4px 8px;min-height:34px;">
                      <kbd class="quick-kbd">7</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="font-size:11.5px;">Co giật sốt cao</span>
                        <span class="chip-desc" style="font-size:10px;">Cấp cứu nhi khoa</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn ${currentIncident === 'INC_OTHER' ? 'active' : ''}" data-incident="INC_OTHER" data-key="8" style="padding:4px 8px;min-height:34px;">
                      <kbd class="quick-kbd">8</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="font-size:11.5px;">Khác...</span>
                        <span class="chip-desc" style="font-size:10px;">Tình huống chung</span>
                      </div>
                    </button>
                  </div>
                </div>

                <!-- FORM CARD 4: Mức độ khẩn (Step 4 - Triage Priority 1, 2, 3) -->
                <div class="rapid-field-card" id="card-severity" data-step-id="4" tabindex="0">
                  <div class="rapid-field-header" style="margin-bottom:4px;">
                    <div class="rapid-field-title">
                      <span class="rapid-step-num">4</span>
                      <span>Phân loại Mức độ Khẩn</span>
                    </div>
                  </div>

                  <div class="rapid-chip-grid rapid-chip-grid-3" style="gap:6px;">
                    <button type="button" tabindex="-1" class="rapid-chip-btn sev-critical ${currentSeverity === 'CRITICAL' ? 'active' : ''}" data-sev="CRITICAL" data-key="1" style="padding:5px 8px;min-height:36px;">
                      <kbd class="quick-kbd kbd-red">1</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="color:#FCA5A5;font-size:11.5px;">TỐI KHẨN</span>
                        <span class="chip-desc" style="font-size:10px;">Nguy kịch tính mạng</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn sev-emergency ${currentSeverity === 'EMERGENCY' ? 'active' : ''}" data-sev="EMERGENCY" data-key="2" style="padding:5px 8px;min-height:36px;">
                      <kbd class="quick-kbd kbd-amber">2</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="color:#FCD34D;font-size:11.5px;">KHẨN CẤP</span>
                        <span class="chip-desc" style="font-size:10px;">Cần can thiệp sớm</span>
                      </div>
                    </button>
                    <button type="button" tabindex="-1" class="rapid-chip-btn sev-routine ${currentSeverity === 'ROUTINE' ? 'active' : ''}" data-sev="ROUTINE" data-key="3" style="padding:5px 8px;min-height:36px;">
                      <kbd class="quick-kbd kbd-emerald">3</kbd>
                      <div class="chip-content">
                        <span class="chip-title" style="color:#6EE7B7;font-size:11.5px;">TIÊU CHUẨN</span>
                        <span class="chip-desc" style="font-size:10px;">Ổn định</span>
                      </div>
                    </button>
                  </div>
                </div>

                <!-- THANH THAO TÁC CỘT PHẢI (BƯỚC 1): CĂN NGANG HÀNG NÚT CÚP MÁY CỘT TRÁI -->
                <div class="step1-action-bar">
                  <button type="button" class="btn-call-next-step" id="btn-next-to-step2" title="Chuyển sang Bước 2: Điều phối xe & kíp">
                    <span>Sang tab Điều phối xe & kíp ➔</span>
                    <kbd class="quick-kbd" style="background:rgba(255,255,255,0.2);color:#FFF;border-color:rgba(255,255,255,0.3);font-size:10.5px;">Ctrl + Enter</kbd>
                  </button>
                </div>
              </div>

            <!-- ======================================================== -->
            <!-- STEP 2 VIEW PANE: ĐIỀU PHỐI & PHÁT LỆNH (CARD 5..8)      -->
            <!-- ======================================================== -->
            <div class="step-view-pane" id="pane-step-2" style="display:none;">
              <!-- SUMMARY TỪ BƯỚC 1 & PHƯƠNG ÁN ĐỀ XUẤT TỐI ƯU (1-CLICK ÁP DỤNG) -->
              <div id="step2-summary-dispatch-box" class="dispatch-summary-rec-card">
              </div>

              <!-- FORM CARD 5: Chọn Xe Cứu Thương (Step 5 - Chọn nhiều) -->
              <div class="rapid-field-card is-active-step" id="card-vehicle-type" data-step-id="5" tabindex="0">
                <div class="rapid-field-header" style="margin-bottom:2px;">
                  <div class="rapid-field-title" style="font-size:12px;">
                    <span class="rapid-step-num" style="background:#2563EB;color:#FFF;width:18px;height:18px;font-size:10px;line-height:18px;">5</span>
                    <span style="color:#60A5FA;">CHỌN XE CỨU THƯƠNG (CHỌN NHIỀU)</span>
                  </div>
                </div>

                <div class="rapid-chip-grid" style="grid-template-columns: repeat(3, 1fr); gap: 5px;">
                  ${availableVehicles.map((v, idx) => {
          const isSelected = currentSelectedPlates.has(v.plate);
          const typeBadgeColor = v.type === 'Type A' ? '#93C5FD' : (v.type === 'Type B' ? '#5EEAD4' : '#C7D2FE');
          const typeClass = v.type === 'Type A' ? 'veh-type-a' : (v.type === 'Type B' ? 'veh-type-b' : 'veh-type-c');
          return `
                      <button type="button" tabindex="-1" class="rapid-chip-btn ${typeClass} ${isSelected ? 'active' : ''}" data-veh-plate="${v.plate}" data-veh-type="${v.type}" data-key="${idx + 1}" style="text-align:left;padding:3px 6px;height:auto;display:flex;align-items:flex-start;gap:6px;">
                        <kbd class="quick-kbd" style="margin-top:1px;font-size:9.5px;padding:1px 4px;">${idx + 1}</kbd>
                        <div class="chip-content" style="flex:1;">
                          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1px;gap:4px;">
                            <span class="chip-title" style="font-size:11.5px;font-family:var(--font-mono);font-weight:700;color:var(--text-white);">${v.plate}</span>
                            <span style="font-size:9.5px;font-weight:700;padding:1px 4px;border-radius:3px;background:rgba(255,255,255,0.08);color:${typeBadgeColor};">${v.type}</span>
                          </div>
                          <div class="chip-desc" style="font-size:9.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${v.station}
                          </div>
                        </div>
                      </button>
                    `;
        }).join('')}
                </div>
              </div>

              <!-- FORM CARD 6: Chọn Kíp Cấp Cứu (Step 6 - Chọn nhiều) -->
              <div class="rapid-field-card" id="card-crew-members" data-step-id="6" tabindex="0">
                <div class="rapid-field-header" style="margin-bottom:2px;">
                  <div class="rapid-field-title" style="font-size:12px;">
                    <span class="rapid-step-num" style="background:#0D9488;color:#FFF;width:18px;height:18px;font-size:10px;line-height:18px;">6</span>
                    <span style="color:#2DD4BF;">CHỌN KÍP CẤP CỨU TRỰC CA (CHỌN NHIỀU)</span>
                  </div>
                </div>

                <div class="rapid-chip-grid" style="grid-template-columns: repeat(3, 1fr); gap: 5px;">
                  ${availablePersonnel.map((p, idx) => {
          const isSelected = currentSelectedPersonnel.has(p.id);
          const pName = p.name || '';
          let displayName = pName;
          if (p.role === 'DRIVER' && !displayName.startsWith('LX.') && !displayName.startsWith('Lái xe')) {
            displayName = 'LX. ' + displayName;
          } else if (p.role === 'DOCTOR' && !displayName.startsWith('BS')) {
            displayName = 'BS. ' + displayName;
          } else if (p.role === 'NURSE' && !displayName.startsWith('ĐD')) {
            displayName = 'ĐD. ' + displayName;
          }

          return `
                      <button type="button" tabindex="-1" class="rapid-chip-btn ${isSelected ? 'active' : ''}" data-person-id="${p.id}" data-key="${idx + 1}" style="text-align:left;padding:3px 6px;height:auto;display:flex;align-items:flex-start;gap:6px;">
                        <kbd class="quick-kbd" style="margin-top:1px;font-size:9.5px;padding:1px 4px;">${idx + 1}</kbd>
                        <div class="chip-content" style="flex:1;">
                          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1px;gap:4px;">
                            <span class="chip-title" style="font-size:11.5px;font-weight:700;color:var(--text-white);">${displayName}</span>
                          </div>
                          <div class="chip-desc" style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${p.phone || ''}
                          </div>
                        </div>
                      </button>
                    `;
        }).join('')}
                </div>
              </div>

              <!-- FORM CARD 7: Chọn Bệnh Viện Tiếp Nhận (Step 7) -->
              <div class="rapid-field-card" id="card-hospital" data-step-id="7" tabindex="0">
                <div class="rapid-field-header" style="margin-bottom:2px;">
                  <div class="rapid-field-title" style="font-size:12px;">
                    <span class="rapid-step-num" style="background:#7C3AED;color:#FFF;width:18px;height:18px;font-size:10px;line-height:18px;">7</span>
                    <span style="color:#C4B5FD;">CHỌN BỆNH VIỆN TIẾP NHẬN</span>
                  </div>
                </div>

                <div class="rapid-chip-grid" style="grid-template-columns: repeat(${availableHospitals.length > 2 ? 2 : availableHospitals.length}, 1fr); gap: 5px;">
                  ${availableHospitals.map((h, idx) => {
          const isSelected = currentHospitalId === h.id;
          return `
                      <button type="button" tabindex="-1" class="rapid-chip-btn ${isSelected ? 'active' : ''}" data-hosp-id="${h.id}" data-key="${idx + 1}" style="text-align:left;padding:4px 8px;height:auto;display:flex;align-items:flex-start;gap:6px;">
                        <kbd class="quick-kbd" style="margin-top:1px;font-size:9.5px;padding:1px 4px;">${idx + 1}</kbd>
                        <div class="chip-content" style="flex:1;">
                          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1px;gap:4px;">
                            <span class="chip-title" style="font-size:11.5px;font-weight:700;color:var(--text-white);">${h.name}</span>
                          </div>
                          <div class="chip-desc" style="font-size:9.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${h.hotline ? 'Hotline: ' + h.hotline : (h.phone || '')} · ${h.address || ''}
                          </div>
                        </div>
                      </button>
                    `;
        }).join('')}
                </div>
              </div>

              <!-- FORM CARD 8: Ghi chú & Triệu chứng tóm tắt (Step 8) -->
              <div class="rapid-field-card" id="card-notes" data-step-id="8">
                <div class="rapid-field-header" style="margin-bottom:2px;">
                  <div class="rapid-field-title" style="font-size:12px;">
                    <span class="rapid-step-num" style="width:18px;height:18px;font-size:10px;line-height:18px;">8</span>
                    <span>GHI CHÚ ĐIỀU PHỐI</span>
                  </div>
                </div>

                <div class="form-field" style="margin-bottom:0;">
                  <textarea id="rapid-symptoms-notes" rows="3" placeholder="Đang nhận dạng triệu chứng từ cuộc gọi...">${activeCall.notes || ''}</textarea>
                </div>
              </div>

              <!-- COMMAND ACTION BAR (CUỐI TAB 2) -->
              <div style="display:flex;flex-direction:column;gap:10px;margin-top:auto;padding-top:6px;">
                <div style="display:flex;gap:10px;height:38px;align-items:center;">
                  <button type="button" class="btn btn-default" id="btn-back-to-step1" style="height:38px;padding:0 16px;font-weight:600;display:flex;align-items:center;gap:6px;">
                    <span>⬅ Thu thập thông tin</span>
                    <kbd class="quick-kbd">Esc</kbd>
                  </button>

                  <button type="button" class="btn-rapid-dispatch" id="btn-rapid-dispatch" style="flex:1;height:38px;display:flex;align-items:center;justify-content:center;gap:10px;">
                    <span style="font-size:14px;letter-spacing:0.5px;font-weight:700;">PHÁT LỆNH ĐIỀU XE & TẠO CA CẤP CỨU</span>
                    <kbd class="quick-kbd" style="background:rgba(0,0,0,0.3);color:#FFF;border-color:rgba(255,255,255,0.4);font-size:11.5px;font-weight:700;padding:2px 7px;">Ctrl + Enter</kbd>
                  </button>
                </div>
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
                  <strong style="font-size:16px;color:var(--text-white);">HƯỚNG DẪN THAO TÁC 2-STEP CHO ĐIỀU PHỐI VIÊN 115</strong>
                </div>
                <button type="button" class="btn btn-ghost btn-sm" id="btn-close-cheat-modal">${window.CCNV_UI.ICONS.x}</button>
              </div>

              <p style="font-size:12.5px;color:var(--text-slate);line-height:1.5;">
                Thiết kế đặc thù cho điều phối viên: <strong>1 tay giữ điện thoại thoại, 1 tay thao tác bàn phím</strong>. Quy trình 2 bước mượt mà:
              </p>

              <div class="cheat-grid">
                <div class="cheat-section">
                  <div class="cheat-section-title">1. Chuyển bước & Điều hướng</div>
                  <div class="cheat-row">
                    <strong style="color:#60A5FA;">Chuyển sang Bước 2 (Điều phối)</strong>
                    <kbd class="quick-kbd">Ctrl + Enter</kbd>
                  </div>
                  <div class="cheat-row">
                    <span>Quay lại Bước 1</span>
                    <kbd class="quick-kbd">Esc</kbd>
                  </div>
                  <div class="cheat-row">
                    <span>Chuyển trường kế tiếp</span>
                    <kbd class="quick-kbd">Tab ⇥</kbd>
                  </div>
                  <div class="cheat-row">
                    <span>Lấy Cell-ID vào hiện trường</span>
                    <kbd class="quick-kbd">Alt + C</kbd>
                  </div>
                </div>

                <div class="cheat-section">
                  <div class="cheat-section-title">2. Phím số chọn nhanh</div>
                  <div class="cheat-row">
                    <span>Chọn Loại ca cấp cứu (1..8)</span>
                    <kbd class="quick-kbd">1..8</kbd>
                  </div>
                  <div class="cheat-row">
                    <span>Chọn Mức độ khẩn (1..3)</span>
                    <kbd class="quick-kbd">1..3</kbd>
                  </div>
                  <div class="cheat-row">
                    <span>Chọn Xe 1..6 (hoặc A/B/C)</span>
                    <kbd class="quick-kbd">1..6</kbd>
                  </div>
                  <div class="cheat-row">
                    <span>Chọn Kíp trực 1..6</span>
                    <kbd class="quick-kbd">1..6</kbd>
                  </div>
                  <div class="cheat-row">
                    <span>Chọn BV tiếp nhận 1..4</span>
                    <kbd class="quick-kbd">1..4</kbd>
                  </div>
                </div>


                <div class="cheat-section">
                  <div class="cheat-section-title">4. Phát lệnh & Kết thúc</div>
                  <div class="cheat-row">
                    <strong style="color:var(--red-vivid);">PHÁT LỆNH ĐIỀU XE & TẠO CA</strong>
                    <span><kbd class="quick-kbd kbd-red">Ctrl + Enter</kbd> (khi ở Bước 2)</span>
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
          const firstPlate = selectedPlatesList[0];
          const selectedVeh = firstPlate ? availableVehicles.find(v => v.plate === firstPlate) : null;
          const targetHosp = currentHospitalId ? availableHospitals.find(h => h.id === currentHospitalId) : null;
          const isCritical = currentSeverity === 'CRITICAL';

          const badgesHtml = selectedPlatesList.length > 0
            ? selectedPlatesList.map(plate => {
              const vObj = availableVehicles.find(v => v.plate === plate);
              const typeText = vObj ? vObj.type : '';
              return `<span class="badge ${typeText === 'Type A' ? 'badge-emergency' : 'badge-normal'}">${plate} (${typeText})</span>`;
            }).join(' ')
            : `<span class="badge badge-normal" style="background:rgba(255,255,255,0.06);color:var(--text-muted);border:1px dashed var(--border-color);">Chưa chọn xe</span>`;

          const vehDetailHtml = selectedVeh
            ? `Ưu tiên: <strong>${selectedVeh.plate}</strong> (${selectedVeh.type}) · Trạm: ${selectedVeh.station || 'Trạm Cấp cứu'} · ETA: <strong style="color:#93C5FD;">~4 phút (1.4 km)</strong>`
            : `Chưa chỉ định xe xuất phát · <span style="color:#93C5FD;">Bấm [1..6] hoặc nhấn "Áp dụng phương án gợi ý"</span>`;

          const hospNameHtml = targetHosp
            ? `<div style="font-size:12.5px;font-weight:600;color:#93C5FD;">${targetHosp.name}</div>`
            : `<div style="font-size:12px;color:var(--text-muted);font-style:italic;">Chưa chọn bệnh viện</div>`;

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
                  ${selectedPlatesList.length > 0 ? `<span style="color:#10B981;font-size:11px;">● Sẵn sàng xuất bến</span>` : ''}
                </div>
                <div style="font-size:11.5px;color:var(--text-slate);margin-top:2px;">
                  ${vehDetailHtml}
                </div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px;color:var(--text-muted);">Bệnh viện tiếp nhận:</div>
              ${hospNameHtml}
            </div>
          `;
        };

        const setHospital = (hospId, playSound = true) => {
          currentHospitalId = hospId;
          paneContainer.querySelectorAll('.rapid-chip-btn[data-hosp-id]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-hosp-id') === hospId);
          });
          updateVehicleMatch();
          if (typeof renderStep2SummaryAndRecommendation === 'function') {
            renderStep2SummaryAndRecommendation();
          }
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        // --- MULTI-PATIENT LIST MANAGEMENT ---
        const syncPatientsFromDom = () => {
          const wrapper = paneContainer.querySelector('#patient-items-wrapper');
          if (!wrapper) return;
          patients.forEach((p, idx) => {
            const notesInp = wrapper.querySelector(`.inp-patient-notes[data-index="${idx}"]`);
            if (notesInp) p.notes = notesInp.value;
          });
        };

        const renderPatientsList = () => {
          const wrapper = paneContainer.querySelector('#patient-items-wrapper');
          if (!wrapper) return;

          wrapper.setAttribute('data-count', String(patients.length));

          wrapper.innerHTML = patients.map((p, idx) => `
            <div class="patient-item-card ${idx === 0 ? 'is-primary' : ''}" data-patient-index="${idx}">
              <div class="patient-item-header">
                <div style="font-size:12px;font-weight:700;color:${idx === 0 ? '#93C5FD' : '#E2E8F0'};display:flex;align-items:center;gap:6px;">
                  <span style="display:inline-block;width:19px;height:19px;border-radius:50%;background:${idx === 0 ? '#2563EB' : '#334155'};color:#FFF;font-size:10px;text-align:center;line-height:19px;font-weight:700;">${idx + 1}</span>
                  <span>Nạn nhân #${idx + 1}</span>
                </div>
                ${patients.length > 1 ? `
                  <button type="button" class="btn-remove-patient" data-remove-index="${idx}" title="Xóa bệnh nhân này">
                    ✕ Xóa
                  </button>
                ` : ''}
              </div>

              <!-- Dòng 1: Nhóm độ tuổi + Giới tính (Đã bỏ trường Họ tên theo yêu cầu) -->
              <div style="display:grid;grid-template-columns: 1.8fr 1fr; gap:8px; align-items:center;">
                <div class="form-field" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:10.5px;margin-bottom:2px;color:var(--text-muted);">Nhóm độ tuổi</label>
                  <div class="segmented-group" style="width:100%;display:flex;">
                    <button type="button" class="segmented-btn btn-age-group ${p.ageGroup === 'INFANT' ? 'active' : ''}" data-index="${idx}" data-group="INFANT" title="Sơ sinh" style="flex:1;padding:4px 2px;font-size:11px;">Sơ sinh</button>
                    <button type="button" class="segmented-btn btn-age-group ${p.ageGroup === 'CHILD' ? 'active' : ''}" data-index="${idx}" data-group="CHILD" title="Trẻ em" style="flex:1;padding:4px 2px;font-size:11px;">Trẻ em</button>
                    <button type="button" class="segmented-btn btn-age-group ${p.ageGroup === 'ADULT' || !p.ageGroup ? 'active' : ''}" data-index="${idx}" data-group="ADULT" title="Người trưởng thành" style="flex:1;padding:4px 2px;font-size:11px;">Người trưởng thành</button>
                    <button type="button" class="segmented-btn btn-age-group ${p.ageGroup === 'ELDERLY' ? 'active' : ''}" data-index="${idx}" data-group="ELDERLY" title="Người cao tuổi" style="flex:1;padding:4px 2px;font-size:11px;">Người cao tuổi</button>
                  </div>
                </div>

                <div class="form-field" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:10.5px;margin-bottom:2px;color:var(--text-muted);">Giới tính</label>
                  <div class="segmented-group" style="width:100%;justify-content:space-between;">
                    <button type="button" class="segmented-btn btn-gender ${p.gender === 'Nam' ? 'active' : ''}" data-index="${idx}" data-gender="Nam" style="flex:1;padding:4px 4px;font-size:11px;">Nam</button>
                    <button type="button" class="segmented-btn btn-gender ${p.gender === 'Nữ' ? 'active' : ''}" data-index="${idx}" data-gender="Nữ" style="flex:1;padding:4px 4px;font-size:11px;">Nữ</button>
                    <button type="button" class="segmented-btn btn-gender ${p.gender === 'Chưa rõ' ? 'active' : ''}" data-index="${idx}" data-gender="Chưa rõ" style="flex:1;padding:4px 4px;font-size:11px;">Chưa rõ</button>
                  </div>
                </div>
              </div>

              <!-- Dòng 2: Ghi chú thương tổn riêng -->
              <div class="form-field" style="margin-bottom:0;margin-top:6px;">
                <input type="text" class="inp-patient-notes" data-index="${idx}" value="${p.notes || ''}" placeholder="Ghi chú thương tổn / tình trạng riêng (VD: Bất tỉnh, chảy máu đầu...)" style="height:27px;font-size:11.5px;padding:3px 8px;" />
              </div>
            </div>
          `).join('');

          paneContainer.querySelectorAll('.patient-count-btn[data-count]').forEach(btn => {
            const count = parseInt(btn.getAttribute('data-count'), 10);
            btn.classList.toggle('active', count === patients.length);
          });

          // Bind event listeners for input fields inside cards
          wrapper.querySelectorAll('.btn-age-group').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const idx = parseInt(e.target.getAttribute('data-index'), 10);
              const group = e.target.getAttribute('data-group');
              if (patients[idx]) {
                patients[idx].ageGroup = group;
                if (group === 'INFANT') patients[idx].age = 0;
                else if (group === 'CHILD') patients[idx].age = 9;
                else if (group === 'ADULT') patients[idx].age = 35;
                else if (group === 'ELDERLY') patients[idx].age = 68;

                wrapper.querySelectorAll(`.btn-age-group[data-index="${idx}"]`).forEach(b => {
                  b.classList.toggle('active', b.getAttribute('data-group') === group);
                });
                updateRecommendations();
                window.CCNV_UI.SoundFx.playBeep();
              }
            });
          });

          wrapper.querySelectorAll('.btn-gender').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const idx = parseInt(e.target.getAttribute('data-index'), 10);
              const gender = e.target.getAttribute('data-gender');
              if (patients[idx]) {
                patients[idx].gender = gender;
                wrapper.querySelectorAll(`.btn-gender[data-index="${idx}"]`).forEach(b => {
                  b.classList.toggle('active', b.getAttribute('data-gender') === gender);
                });
                window.CCNV_UI.SoundFx.playBeep();
              }
            });
          });

          wrapper.querySelectorAll('.inp-patient-notes').forEach(inp => {
            inp.addEventListener('input', (e) => {
              const idx = parseInt(e.target.getAttribute('data-index'), 10);
              if (patients[idx]) patients[idx].notes = e.target.value;
            });
          });

          wrapper.querySelectorAll('.btn-remove-patient').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const removeIdx = parseInt(e.currentTarget.getAttribute('data-remove-index'), 10);
              syncPatientsFromDom();
              if (patients.length > 1) {
                patients.splice(removeIdx, 1);
                renderPatientsList();
                updateRecommendations();
                window.CCNV_UI.SoundFx.playBeep();
              }
            });
          });
        };

        const setPatientCount = (count) => {
          syncPatientsFromDom();
          if (count === 1) {
            patients = [patients[0] || { id: 1, ageGroup: 'ADULT', gender: 'Nam', notes: '' }];
          } else if (count === 2) {
            if (patients.length < 2) {
              patients.push({ id: 2, ageGroup: 'ADULT', gender: 'Nữ', notes: 'Chấn thương mô mềm, xây xát chi' });
            } else if (patients.length > 2) {
              patients = patients.slice(0, 2);
            }
          } else if (count === 3) {
            if (patients.length < 2) {
              patients.push({ id: 2, ageGroup: 'ADULT', gender: 'Nữ', notes: 'Chấn thương mô mềm' });
            }
            if (patients.length < 3) {
              patients.push({ id: 3, ageGroup: 'CHILD', gender: 'Chưa rõ', notes: 'Hoảng loạn, xây xát nhẹ' });
            } else if (patients.length > 3) {
              patients = patients.slice(0, 3);
            }
          }
          renderPatientsList();
          updateRecommendations();
          window.CCNV_UI.SoundFx.playBeep();
        };

        const addPatient = () => {
          syncPatientsFromDom();
          const nextNum = patients.length + 1;
          patients.push({
            id: nextNum,
            ageGroup: 'ADULT',
            gender: 'Chưa rõ',
            notes: ''
          });
          renderPatientsList();
          updateRecommendations();
          window.CCNV_UI.SoundFx.playBeep();
        };

        // Quick patient count click bindings
        paneContainer.querySelectorAll('.patient-count-btn[data-count]').forEach(btn => {
          btn.addEventListener('click', () => {
            const count = parseInt(btn.getAttribute('data-count'), 10);
            setPatientCount(count);
          });
        });
        paneContainer.querySelector('#btn-add-patient-quick')?.addEventListener('click', addPatient);

        // --- STEP SWITCHER CONTROLLER ---
        // --- STEP 2 DISPATCH RECOMMENDATION ENGINE ---
        const getBestRecommendation = () => {
          syncPatientsFromDom();
          const address = paneContainer.querySelector('#rapid-address')?.value || activeCall.address || 'Đường 30/4, Phường Hưng Lợi, thành phố Cần Thơ';
          const hasChild = patients.some(p => p.ageGroup === 'INFANT' || p.ageGroup === 'CHILD' || (typeof p.age === 'number' && p.age < 16));
          const isMultiPatient = patients.length >= 2;
          const incObj = state.incidentTypes?.find(i => i.code === currentIncident);

          // 1. Xe đề xuất (Type A cho Critical/Cardiac/Stroke; nếu >= 2 bệnh nhân thì 2 xe)
          const bestPlates = [];
          const typeAVeh = availableVehicles.find(v => v.type === 'Type A') || availableVehicles[0];
          const typeBVeh = availableVehicles.find(v => v.type === 'Type B' && v.plate !== typeAVeh?.plate) || availableVehicles[1] || availableVehicles[0];

          if (currentSeverity === 'CRITICAL' || currentIncident === 'INC_CARDIAC' || currentIncident === 'INC_STROKE') {
            if (typeAVeh) bestPlates.push(typeAVeh.plate);
          } else {
            const preferredType = incObj?.suggestedType || 'Type B';
            const matchVeh = availableVehicles.find(v => v.type === preferredType) || availableVehicles[0];
            if (matchVeh) bestPlates.push(matchVeh.plate);
          }
          if (isMultiPatient) {
            const secondVeh = availableVehicles.find(v => !bestPlates.includes(v.plate));
            if (secondVeh) bestPlates.push(secondVeh.plate);
          }
          if (bestPlates.length === 0 && availableVehicles.length > 0) {
            bestPlates.push(availableVehicles[0].plate);
          }

          // 2. Kíp nhân sự đề xuất (1 Bác sĩ, 1 Điều dưỡng, 1 Lái xe)
          const bestCrewIds = [];
          const doc = availablePersonnel.find(p => p.role === 'DOCTOR');
          const nurse = availablePersonnel.find(p => p.role === 'NURSE');
          const driver = availablePersonnel.find(p => p.role === 'DRIVER');
          if (doc) bestCrewIds.push(doc.id);
          if (nurse) bestCrewIds.push(nurse.id);
          if (driver) bestCrewIds.push(driver.id);
          if (bestCrewIds.length < 3) {
            availablePersonnel.forEach(p => {
              if (!bestCrewIds.includes(p.id) && bestCrewIds.length < 3) {
                bestCrewIds.push(p.id);
              }
            });
          }

          // 3. Bệnh viện tiếp nhận đề xuất
          let bestHospitalId = 'HOSP_BVDK';
          let hospitalReason = 'BV Đa khoa thành phố Cần Thơ (Cấp cứu đa khoa)';
          if (hasChild || currentIncident === 'INC_PEDIATRIC') {
            bestHospitalId = 'HOSP_BVND';
            hospitalReason = 'BV Nhi đồng Cần Thơ (Cơ sở chuyên khoa Nhi)';
          } else if (currentIncident === 'INC_STROKE' || currentIncident === 'INC_CARDIAC' || currentSeverity === 'CRITICAL') {
            bestHospitalId = 'HOSP_BVTU';
            hospitalReason = 'Bệnh viện Đa khoa Trung ương Cần Thơ (Can thiệp Tim mạch & Đột quỵ)';
          } else {
            const defaultHosp = availableHospitals.find(h => h.id === 'HOSP_BVDK') || availableHospitals[0];
            bestHospitalId = defaultHosp?.id || 'HOSP_BVDK';
            hospitalReason = `${defaultHosp?.name || 'BV Đa khoa thành phố Cần Thơ'} (Tiếp nhận tiêu chuẩn)`;
          }

          return {
            bestPlates,
            bestCrewIds,
            bestHospitalId,
            hospitalReason,
            address,
            hasChild,
            isMultiPatient
          };
        };

        const renderStep2SummaryAndRecommendation = () => {
          const box = paneContainer.querySelector('#step2-summary-dispatch-box');
          if (!box) return;

          syncPatientsFromDom();
          const rec = getBestRecommendation();
          const address = paneContainer.querySelector('#rapid-address')?.value || activeCall.address || 'Đường 30/4, Phường Hưng Lợi, thành phố Cần Thơ';
          const incObj = state.incidentTypes?.find(i => i.code === currentIncident);
          const incName = incObj ? incObj.name : 'Cấp cứu 115';

          const sevBadge = currentSeverity === 'CRITICAL'
            ? '<span class="status-pill status-pill-busy" style="font-size:10.5px;padding:2px 7px;font-weight:700;">TỐI KHẨN [ĐỎ]</span>'
            : (currentSeverity === 'EMERGENCY'
              ? '<span class="status-pill status-pill-transit" style="font-size:10.5px;padding:2px 7px;font-weight:700;">KHẨN CẤP [CAM]</span>'
              : '<span class="status-pill status-pill-available" style="font-size:10.5px;padding:2px 7px;font-weight:700;">TIÊU CHUẨN [VÀNG]</span>');

          // Summary Nạn nhân
          const formatAgeGroup = (group) => {
            if (group === 'INFANT') return 'Sơ sinh';
            if (group === 'CHILD') return 'Trẻ em';
            if (group === 'ELDERLY') return 'Người cao tuổi';
            return 'Người trưởng thành';
          };

          let patientsSummaryHtml = '';
          if (patients.length === 1) {
            const p = patients[0];
            const ageStr = formatAgeGroup(p.ageGroup);
            patientsSummaryHtml = `<span style="color:#FFF;font-weight:700;">Nạn nhân</span> (${ageStr}, ${p.gender || 'Nam'}${p.notes ? ' · ' + p.notes : ''})`;
          } else {
            patientsSummaryHtml = `<strong style="color:#FDE68A;">${patients.length} nạn nhân:</strong> ` +
              patients.map((p, idx) => {
                const ageStr = formatAgeGroup(p.ageGroup);
                return `<span style="color:#FFF;">Nạn nhân ${idx + 1} (${ageStr}, ${p.gender || '?'})</span>`;
              }).join(' · ');
          }

          // Recommended vehicles detail
          const recVehicles = availableVehicles.filter(v => rec.bestPlates.includes(v.plate));
          const vehStr = recVehicles.map(v => `<strong style="color:#FFF;font-family:var(--font-mono);">${v.plate}</strong> <span style="font-size:11px;color:#93C5FD;">(${v.type})</span>`).join(' + ');

          // Recommended personnel detail
          const recCrew = availablePersonnel.filter(p => rec.bestCrewIds.includes(p.id));
          const crewStr = recCrew.map(p => `<strong style="color:#FFF;">${p.name}</strong>`).join(' · ');

          // Recommended hospital detail
          const recHosp = availableHospitals.find(h => h.id === rec.bestHospitalId) || availableHospitals[0];
          const hospStr = `<strong style="color:#FFF;">${recHosp ? recHosp.name : 'Bệnh viện'}</strong>`;

          // Check if current selection already matches recommended
          const isVehiclesMatch = rec.bestPlates.length === currentSelectedPlates.size && rec.bestPlates.every(p => currentSelectedPlates.has(p));
          const isCrewMatch = rec.bestCrewIds.length === currentSelectedPersonnel.size && rec.bestCrewIds.every(id => currentSelectedPersonnel.has(id));
          const isHospMatch = currentHospitalId === rec.bestHospitalId;
          const isFullyApplied = isVehiclesMatch && isCrewMatch && isHospMatch;

          box.innerHTML = `
            <!-- PHẦN 1: TÓM TẮT THÔNG TIN TỪ BƯỚC 1 (1 DÒNG DUY NHẤT) -->
            <div class="dispatch-summary-row">
              <div class="summary-meta-item" style="flex:1.2;min-width:0;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;">
                <span style="display:inline-flex;align-items:center;color:#60A5FA;flex-shrink:0;">${window.CCNV_UI.ICONS.users}</span>
                <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px;font-weight:700;flex-shrink:0;">NẠN NHÂN:</span>
                <div style="font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${patientsSummaryHtml}</div>
              </div>

              <div class="summary-meta-item" style="flex:1.4;min-width:0;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;">
                <span style="display:inline-flex;align-items:center;color:#F59E0B;flex-shrink:0;">${window.CCNV_UI.ICONS.mapPin}</span>
                <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px;font-weight:700;flex-shrink:0;">HIỆN TRƯỜNG:</span>
                <div style="font-size:11.5px;color:#FFF;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${address}">${address}</div>
              </div>

              <div class="summary-meta-item" style="flex:1.4;min-width:0;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;">
                <span style="display:inline-flex;align-items:center;color:var(--red-vivid);flex-shrink:0;">${window.CCNV_UI.ICONS.alertTriangle}</span>
                <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px;font-weight:700;flex-shrink:0;">TÌNH HUỐNG & MỨC ĐỘ:</span>
                <div style="display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;">
                  <strong style="color:#FFF;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${incName}</strong>
                  ${sevBadge}
                </div>
              </div>

              ${isRecAppliedDismissed ? `
                <div style="margin-left:auto;display:flex;align-items:center;gap:6px;flex-shrink:0;">
                  <span style="font-size:10.5px;color:#34D399;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Đã áp dụng gợi ý
                  </span>
                  <button type="button" id="btn-reopen-rec" style="background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.3);border-radius:4px;color:#38BDF8;font-size:10.5px;font-weight:600;cursor:pointer;padding:2px 7px;white-space:nowrap;transition:all 0.15s ease;" title="Mở lại khung gợi ý chi tiết">
                    Xem lại gợi ý
                  </button>
                </div>
              ` : ''}
            </div>

            ${isRecAppliedDismissed ? '' : `
            <!-- PHẦN 2: PHƯƠNG ÁN ĐỀ XUẤT TỐI ƯU & NÚT 1-CLICK ÁP DỤNG -->
            <div class="dispatch-rec-proposal-box">
              <div class="dispatch-rec-details">
                <div class="dispatch-rec-header">
                  <span style="display:inline-flex;align-items:center;color:#F59E0B;">${window.CCNV_UI.ICONS.activity}</span>
                  <span>PHƯƠNG ÁN ĐIỀU PHỐI ĐỀ XUẤT TỐI ƯU</span>
                  <span style="font-size:11px;font-weight:400;color:var(--text-slate);text-transform:none;">(Phù hợp nhất cho ca bệnh & vị trí)</span>
                </div>
                <div class="dispatch-rec-items">
                  <div class="rec-item-badge">
                    <span style="display:inline-flex;align-items:center;color:#60A5FA;gap:4px;">${window.CCNV_UI.ICONS.ambulance} Xe:</span>
                    <span>${vehStr}</span>
                  </div>
                  <div class="rec-item-badge">
                    <span style="display:inline-flex;align-items:center;color:#2DD4BF;gap:4px;">${window.CCNV_UI.ICONS.user} Kíp trực:</span>
                    <span>${crewStr}</span>
                  </div>
                  <div class="rec-item-badge">
                    <span style="display:inline-flex;align-items:center;color:#C4B5FD;gap:4px;">${window.CCNV_UI.ICONS.hospital} Bệnh viện:</span>
                    <span>${hospStr}</span>
                  </div>
                </div>
              </div>

              <div>
                <button type="button" class="btn-apply-rec ${isFullyApplied ? 'applied' : ''}" id="btn-apply-recommended-dispatch" title="Nhấn để tự động tích chọn toàn bộ các trường xe, kíp và bệnh viện theo phương án tối ưu">
                  <span style="display:inline-flex;align-items:center;gap:5px;">${window.CCNV_UI.ICONS.activity} Áp dụng phương án gợi ý</span>
                </button>
              </div>
            </div>
            `}
          `;

          // Gắn sự kiện 1-Click áp dụng phương án
          box.querySelector('#btn-apply-recommended-dispatch')?.addEventListener('click', () => {
            applyRecommendedDispatch();
          });

          // Gắn sự kiện mở lại khung gợi ý nếu muốn xem lại
          box.querySelector('#btn-reopen-rec')?.addEventListener('click', (e) => {
            e.stopPropagation();
            isRecAppliedDismissed = false;
            renderStep2SummaryAndRecommendation();
          });
        };

        const applyRecommendedDispatch = () => {
          isRecAppliedDismissed = true;
          const rec = getBestRecommendation();
          currentSelectedPlates = new Set(rec.bestPlates);
          currentVehicleTypes = new Set();
          currentSelectedPlates.forEach(p => {
            const vObj = availableVehicles.find(v => v.plate === p);
            if (vObj) currentVehicleTypes.add(vObj.type);
          });
          const activeVeh = getRecommendedVehicle();
          currentVehicleType = activeVeh ? activeVeh.type : 'Type A';

          currentSelectedPersonnel = new Set(rec.bestCrewIds);
          currentHospitalId = rec.bestHospitalId;

          // Cập nhật giao diện tất cả các nút xe (Card 5)
          paneContainer.querySelectorAll('.rapid-chip-btn[data-veh-plate]').forEach(btn => {
            const p = btn.getAttribute('data-veh-plate');
            btn.classList.toggle('active', currentSelectedPlates.has(p));
          });

          // Cập nhật giao diện tất cả các nút nhân sự (Card 6)
          paneContainer.querySelectorAll('.rapid-chip-btn[data-person-id]').forEach(btn => {
            const pid = btn.getAttribute('data-person-id');
            btn.classList.toggle('active', currentSelectedPersonnel.has(pid));
          });

          // Cập nhật giao diện tất cả các nút bệnh viện (Card 7)
          paneContainer.querySelectorAll('.rapid-chip-btn[data-hosp-id]').forEach(btn => {
            const hid = btn.getAttribute('data-hosp-id');
            btn.classList.toggle('active', hid === currentHospitalId);
          });

          updateVehicleMatch();
          renderStep2SummaryAndRecommendation();
          window.CCNV_UI.SoundFx.playEmergencyTone();

          const targetHospName = availableHospitals.find(h => h.id === currentHospitalId)?.name || 'Bệnh viện';
          window.CCNV_UI.Toast.show(
            'ĐÃ ÁP DỤNG PHƯƠNG ÁN TỐI ƯU',
            `Xe: ${Array.from(currentSelectedPlates).join(' + ')} · Kíp: ${currentSelectedPersonnel.size} người · BV: ${targetHospName}`,
            false,
            3000
          );
        };

        const toggleVehiclePlate = (plate, playSound = true) => {
          if (currentSelectedPlates.has(plate)) {
            currentSelectedPlates.delete(plate);
          } else {
            currentSelectedPlates.add(plate);
          }
          currentVehicleTypes = new Set();
          currentSelectedPlates.forEach(p => {
            const vObj = availableVehicles.find(v => v.plate === p);
            if (vObj) currentVehicleTypes.add(vObj.type);
          });
          const firstPlate = Array.from(currentSelectedPlates)[0];
          const activeVeh = firstPlate ? availableVehicles.find(v => v.plate === firstPlate) : null;
          currentVehicleType = activeVeh ? activeVeh.type : null;

          paneContainer.querySelectorAll('.rapid-chip-btn[data-veh-plate]').forEach(btn => {
            const p = btn.getAttribute('data-veh-plate');
            btn.classList.toggle('active', currentSelectedPlates.has(p));
          });
          updateVehicleMatch();
          renderStep2SummaryAndRecommendation();
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const toggleVehicleType = (type, playSound = true) => {
          // Toggle all vehicles of this type
          const matchingVehs = availableVehicles.filter(v => v.type === type);
          if (matchingVehs.length === 0) return;
          const allSelected = matchingVehs.every(v => currentSelectedPlates.has(v.plate));
          if (allSelected) {
            matchingVehs.forEach(v => currentSelectedPlates.delete(v.plate));
          } else {
            matchingVehs.forEach(v => currentSelectedPlates.add(v.plate));
          }
          currentVehicleTypes = new Set();
          currentSelectedPlates.forEach(p => {
            const vObj = availableVehicles.find(v => v.plate === p);
            if (vObj) currentVehicleTypes.add(vObj.type);
          });
          const firstPlate = Array.from(currentSelectedPlates)[0];
          const activeVeh = firstPlate ? availableVehicles.find(v => v.plate === firstPlate) : null;
          currentVehicleType = activeVeh ? activeVeh.type : null;

          paneContainer.querySelectorAll('.rapid-chip-btn[data-veh-plate]').forEach(btn => {
            const p = btn.getAttribute('data-veh-plate');
            btn.classList.toggle('active', currentSelectedPlates.has(p));
          });
          updateVehicleMatch();
          renderStep2SummaryAndRecommendation();
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const togglePersonnel = (personId, playSound = true) => {
          if (currentSelectedPersonnel.has(personId)) {
            currentSelectedPersonnel.delete(personId);
          } else {
            currentSelectedPersonnel.add(personId);
          }
          paneContainer.querySelectorAll('.rapid-chip-btn[data-person-id]').forEach(btn => {
            const pid = btn.getAttribute('data-person-id');
            btn.classList.toggle('active', currentSelectedPersonnel.has(pid));
          });
          renderStep2SummaryAndRecommendation();
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const updateRecommendations = () => {
          renderStep2SummaryAndRecommendation();
        };

        const switchStep = (step) => {
          syncPatientsFromDom();
          currentStep = step;
          const step1Pane = paneContainer.querySelector('#pane-step-1');
          const step2Pane = paneContainer.querySelector('#pane-step-2');
          const nextBtn = paneContainer.querySelector('#btn-next-to-step2');
          if (step === 1) {
            if (step1Pane) step1Pane.style.display = 'flex';
            if (step2Pane) step2Pane.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'inline-flex';
            updateHud('1. Thu thập thông tin', 'Tab chuyển trường · Ctrl+Enter chuyển sang Điều phối');
            paneContainer.querySelector('.inp-patient-notes')?.focus();
          } else {
            if (step1Pane) step1Pane.style.display = 'none';
            if (step2Pane) step2Pane.style.display = 'flex';
            if (nextBtn) nextBtn.style.display = 'none';
            updateHud('2. Điều phối', 'Phím [1..6] chọn xe/kíp · Esc quay lại · Ctrl+Enter Phát lệnh');
            renderStep2SummaryAndRecommendation();
            updateVehicleMatch();
            const vehCard = paneContainer.querySelector('#card-vehicle-type');
            if (vehCard) {
              vehCard.focus();
              currentFocusedCard = 'card-vehicle-type';
            }
          }
          window.CCNV_UI.SoundFx.playBeep();
        };



        const setSeverity = (sev, playSound = true) => {
          currentSeverity = sev;
          paneContainer.querySelectorAll('.rapid-chip-btn[data-sev]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-sev') === sev);
          });
          updateVehicleMatch();
          updateRecommendations();
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
          updateRecommendations();
          if (playSound) window.CCNV_UI.SoundFx.playBeep();
        };

        const injectCellId = () => {
          const addrInput = paneContainer.querySelector('#rapid-address');
          if (addrInput) {
            addrInput.value = 'BTS VTT-NK04 · P. Hưng Lợi, thành phố Cần Thơ';
            addrInput.focus();
            addrInput.classList.add('pulse-red-border');
            setTimeout(() => addrInput.classList.remove('pulse-red-border'), 1000);
            window.CCNV_UI.SoundFx.playBeep();
            window.CCNV_UI.Toast.show('Đã nạp vị trí Cell-ID', 'Tọa độ trạm phát sóng đã được đưa vào địa chỉ hiện trường');
          }
        };

        // Dispatch Handler
        const doDispatch = () => {
          this.stopVoiceDemoAudio();
          syncPatientsFromDom();

          // Tự động áp dụng phương án tối ưu nếu điều phối viên chưa chọn thủ công
          if (currentSelectedPlates.size === 0 || !currentHospitalId) {
            applyRecommendedDispatch();
          }

          // Fallback dự phòng nếu danh sách vẫn trống
          if (currentSelectedPlates.size === 0 && availableVehicles.length > 0) {
            const fallbackPlate = demo?.plate || availableVehicles[0].plate;
            currentSelectedPlates.add(fallbackPlate);
          }
          if (!currentHospitalId && availableHospitals.length > 0) {
            currentHospitalId = availableHospitals[0].id;
          }

          const caller = activeCall.callerName;
          const phone = activeCall.callerPhone;
          const primaryPatient = patients[0] || { ageGroup: 'ADULT', gender: 'Nam', notes: '' };
          const address = paneContainer.querySelector('#rapid-address')?.value || 'Đường 30/4, Phường Hưng Lợi, thành phố Cần Thơ';
          const notes = paneContainer.querySelector('#rapid-symptoms-notes')?.value || activeCall.notes;
          const veh = getRecommendedVehicle();
          const targetHosp = availableHospitals.find(h => h.id === currentHospitalId) || availableHospitals[0] || state.hospitals?.[0] || { id: 'HOSP_BVDK', name: 'BV Đa khoa thành phố Cần Thơ' };
          const incObj = state.incidentTypes?.find(i => i.code === currentIncident);

          if (demo) {
            demo.onDispatch({
              gender: primaryPatient.gender || 'Nam',
              ageGroup: primaryPatient.ageGroup || 'ADULT',
              patients,
              address,
              notes,
              incidentCode: currentIncident,
              severity: currentSeverity,
              hospital: targetHosp
            });
            return;
          }

          // 1. Play Emergency Tone
          window.CCNV_UI.SoundFx.playEmergencyTone();

          // Get selected crew personnel
          const assignedCrewMembers = availablePersonnel
            .filter(p => currentSelectedPersonnel.has(p.id))
            .map(p => ({ id: p.id, name: p.name, role: p.role, roleName: p.roleName, phone: p.phone }));

          const ageGroupMap = {
            'INFANT': 'Sơ sinh',
            'CHILD': 'Trẻ em',
            'ADULT': 'Người trưởng thành',
            'ELDERLY': 'Người cao tuổi'
          };

          // 2. Create Case in StateManager
          const newCase = window.StateManager.createCase({
            callerName: caller,
            callerPhone: phone,
            patient: {
              ageGroup: primaryPatient.ageGroup || 'ADULT',
              ageGroupText: ageGroupMap[primaryPatient.ageGroup] || 'Người trưởng thành',
              gender: primaryPatient.gender || 'Nam',
              notes: primaryPatient.notes || '',
              totalCount: patients.length
            },
            patients: patients.map(p => ({
              ageGroup: p.ageGroup || 'ADULT',
              ageGroupText: ageGroupMap[p.ageGroup] || 'Người trưởng thành',
              gender: p.gender,
              notes: p.notes
            })),
            patientCount: patients.length,
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
          const patientNoticeStr = patients.length > 1 ? ` · ${patients.length} nạn nhân` : '';
          window.CCNV_UI.Toast.show(
            `ĐÃ PHÁT LỆNH ĐIỀU ĐỘNG: CA ${newCase.code}`,
            `Xuất xe ${selectedPlatesStr}${patientNoticeStr} · Kíp: ${crewCountStr} · Bệnh viện: ${targetHosp.name}`,
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
        renderPatientsList();
        updateFirstAid(currentIncident);
        updateVehicleMatch(currentVehicleType);
        updateRecommendations();

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

        paneContainer.querySelectorAll('.rapid-chip-btn[data-incident]').forEach(btn => {
          btn.addEventListener('click', () => setIncident(btn.getAttribute('data-incident')));
        });

        paneContainer.querySelectorAll('.rapid-chip-btn[data-hosp-id]').forEach(btn => {
          btn.addEventListener('click', () => setHospital(btn.getAttribute('data-hosp-id')));
        });

        paneContainer.querySelector('#btn-inject-cellid')?.addEventListener('click', injectCellId);
        paneContainer.querySelector('#btn-rapid-dispatch')?.addEventListener('click', doDispatch);
        paneContainer.querySelector('#btn-next-to-step2')?.addEventListener('click', () => switchStep(2));
        paneContainer.querySelector('#btn-back-to-step1')?.addEventListener('click', () => switchStep(1));

        paneContainer.querySelector('#btn-call-transfer-quick')?.addEventListener('click', () => {
          if (demo) return window.CCNV_UI.Toast.show('Chuyển máy', 'Không dùng trong kịch bản demo');
          this.renderCallCenterView(container, 'transfer');
        });

        paneContainer.querySelector('#btn-call-hangup')?.addEventListener('click', () => {
          this.stopVoiceDemoAudio();
          if (demo) return demo.onCancel();
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
          { id: 'card-patient', name: '1. Thông tin bệnh nhân', hint: 'Chọn số lượng BN · Nhập tên/tuổi/giới tính · Tab sang Hiện trường' },
          { id: 'card-location', name: '2. Hiện trường & Tọa độ', hint: 'Bấm Alt+C để nạp Cell-ID · Tab sang Tình huống' },
          { id: 'card-incident', name: '3. Tình huống Cấp cứu', hint: 'Bấm số [1..8] để chọn tình huống · Tab sang Mức độ khẩn' },
          { id: 'card-severity', name: '4. Mức độ Khẩn', hint: 'Bấm [1] Đỏ / [2] Cam / [3] Xanh · Ctrl+Enter sang Bước 2' },
          { id: 'card-vehicle-type', name: '5. CHỌN XE CỨU THƯƠNG', hint: 'Bấm [1..6] chọn xe trong danh sách · [A/B/C] theo loại · Tab sang Kíp' },
          { id: 'card-crew-members', name: '6. CHỌN KÍP CẤP CỨU TRỰC CA', hint: 'Bấm [1..6] chọn nhân sự trực ca (BS, ĐD, Lái xe) · Tab sang Chọn bệnh viện' },
          { id: 'card-hospital', name: '7. CHỌN BỆNH VIỆN TIẾP NHẬN', hint: `Bấm [1..${availableHospitals.length}] chọn BV tiếp nhận · Tab sang Ghi chú` },
          { id: 'card-notes', name: '8. Triệu chứng & Ghi chú', hint: 'Bấm Ctrl+Enter để Phát lệnh xuất xe tức thì!' }
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

        // =========================================================================
        // AI SPEECH-TO-TEXT & REAL-TIME AUTO-FILL DEMO ENGINE
        // (HIEN THI DAY DU 5 LUOT KICH BAN, TU DONG FILL RONG -> DAY DU, KHONG EMOJI)
        // =========================================================================
        const initVoiceDemoEngine = () => {
          const DIALOGUE_SCRIPT = [
            {
              id: 1,
              turnNum: '01',
              start: 0.0,
              end: 5.5,
              speakerRole: 'operator',
              speakerLabel: 'TỔNG ĐÀI 115',
              text: 'Alo, tổng đài cấp cứu 115 nghe. Anh cho biết chuyện gì xảy ra?',
              keywords: ['tổng đài cấp cứu 115']
            },
            {
              id: 2,
              turnNum: '02',
              start: 5.5,
              end: 17.0,
              speakerRole: 'caller',
              speakerLabel: 'NGƯỜI GỌI (0913.882.115)',
              text: 'Có người bị tai nạn xe máy, ngã ra đường, nằm im không dậy được!. Tôi ở Đường Nguyễn Văn Cừ, trước cổng trường Đại học Cần Thơ, phía bên phải hướng đi vào trung tâm.',
              keywords: ['tai nạn xe máy', 'ngã ra đường, nằm im', 'Đường Nguyễn Văn Cừ', 'Đại học Cần Thơ', 'hướng đi vào trung tâm']
            },
            {
              id: 3,
              turnNum: '03',
              start: 17.0,
              end: 21.0,
              speakerRole: 'operator',
              speakerLabel: 'TỔNG ĐÀI 115',
              text: 'Anh vui lòng mô tả giúp tôi tình trạng bệnh nhân',
              keywords: ['tình trạng bệnh nhân']
            },
            {
              id: 4,
              turnNum: '04',
              start: 21.0,
              end: 32.0,
              speakerRole: 'caller',
              speakerLabel: 'NGƯỜI GỌI (0913.882.115)',
              text: 'Hai người nam giới cao tuổi. 1 người hỏi thì còn trả lời nhỏ, đang thở. Chân trái chảy máu nhiều. Người còn lại thì bất tỉnh hoàn toàn',
              keywords: ['Hai người nam giới cao tuổi', 'còn trả lời nhỏ, đang thở', 'Chân trái chảy máu nhiều', 'bất tỉnh hoàn toàn']
            },
            {
              id: 5,
              turnNum: '05',
              start: 32.0,
              end: 41.71,
              speakerRole: 'operator',
              speakerLabel: 'TỔNG ĐÀI 115',
              text: 'Anh đừng di chuyển nạn nhân, dùng khăn sạch ấn chặt vết thương. Xe cấp cứu đang đến. Anh giữ máy và cho tôi số điện thoại để liên lạc.',
              keywords: ['đừng di chuyển nạn nhân', 'dùng khăn sạch ấn chặt vết thương', 'Xe cấp cứu đang đến']
            }
          ];

          let triggers = {
            incident: false,
            location: false,
            patients: false,
            severity: false,
            symptoms: false,
            ready: false
          };

          const addAiTag = (text) => {
            const tagsBar = paneContainer.querySelector('#ai-extracted-tags-bar');
            const placeholder = paneContainer.querySelector('#ai-tag-placeholder');
            if (placeholder) placeholder.style.display = 'none';
            if (tagsBar) {
              const chip = document.createElement('span');
              chip.className = 'ai-tag-chip';
              chip.textContent = text;
              tagsBar.appendChild(chip);
            }
          };

          const flashCard = (cardId) => {
            // No glowing bounding border
          };

          this.stopVoiceDemoAudio();
          const voiceAudio = new Audio('assets/voice_demo.m4a');
          this._currentVoiceAudio = voiceAudio;
          voiceAudio.preload = 'auto';

          const btnPlayPause = paneContainer.querySelector('#btn-voice-toggle-play');
          const playText = paneContainer.querySelector('#voice-play-text');
          const waveEq = paneContainer.querySelector('#voice-wave-eq');
          const timerDisplay = paneContainer.querySelector('#voice-timer-display');
          const dialogueFeed = paneContainer.querySelector('#voice-dialogue-feed');
          const btnInstantFill = paneContainer.querySelector('#btn-voice-fill-instant');
          const btnHangup = paneContainer.querySelector('#btn-call-hangup');

          const padTime = (n) => String(Math.floor(n)).padStart(2, '0');
          const formatTime = (sec) => `${padTime(sec / 60)}:${padTime(sec % 60)}`;

          let currentFocusedKeyword = null;
          let currentFocusedTurnId = null;
          let focusedKeywordTimeout = null;

          const KEYWORDS_LIST = [
            { id: 'kw-1', turnId: 1, text: 'tổng đài cấp cứu 115', display: 'Tổng đài 115', time: 1.0, color: '#38BDF8' },
            { id: 'kw-2', turnId: 2, text: 'tai nạn xe máy', display: 'Tai nạn xe máy', time: 6.5, color: '#F59E0B' },
            { id: 'kw-3', turnId: 2, text: 'ngã ra đường, nằm im', display: 'Ngã nằm im', time: 9.0, color: '#EF4444' },
            { id: 'kw-4', turnId: 2, text: 'Đường Nguyễn Văn Cừ', display: 'Đ. Nguyễn Văn Cừ', time: 12.0, color: '#10B981' },
            { id: 'kw-5', turnId: 2, text: 'Đại học Cần Thơ', display: 'ĐH Cần Thơ', time: 14.5, color: '#10B981' },
            { id: 'kw-6', turnId: 4, text: 'Hai người nam giới cao tuổi', display: '2 nam cao tuổi', time: 22.0, color: '#A855F7' },
            { id: 'kw-7', turnId: 4, text: 'Chân trái chảy máu nhiều', display: 'Chảy máu chân trái', time: 26.5, color: '#EF4444' },
            { id: 'kw-8', turnId: 4, text: 'bất tỉnh hoàn toàn', display: 'Bất tỉnh hoàn toàn', time: 29.5, color: '#DC2626' },
            { id: 'kw-9', turnId: 5, text: 'đừng di chuyển nạn nhân', display: 'Không di chuyển', time: 33.0, color: '#F59E0B' },
            { id: 'kw-10', turnId: 5, text: 'dùng khăn sạch ấn chặt vết thương', display: 'Ấn chặt vết thương', time: 35.5, color: '#06B6D4' },
            { id: 'kw-11', turnId: 5, text: 'Xe cấp cứu đang đến', display: 'Xe đang đến', time: 38.0, color: '#3B82F6' }
          ];

          const highlightKeywords = (text, keywords = []) => {
            let html = text;
            keywords.forEach(kw => {
              const regex = new RegExp(`(${kw})`, 'gi');
              const isFocused = currentFocusedKeyword && (
                currentFocusedKeyword.toLowerCase().includes(kw.toLowerCase()) ||
                kw.toLowerCase().includes(currentFocusedKeyword.toLowerCase())
              );
              const extraClass = isFocused ? ' is-focused-kw' : '';
              html = html.replace(regex, `<mark class="ai-kw${extraClass}" data-kw="$1">$1</mark>`);
            });
            return html;
          };

          // NÓI ĐẾN ĐÂU HIỆN TEXT ĐẾN ĐẤY (Không hiển thị toàn bộ transcript trước khi nói)
          let lastTurnCount = 0;
          const renderFullDialogueFeed = (currentTime) => {
            if (!dialogueFeed) return;

            let html = '';
            let currentTurnCount = 0;

            DIALOGUE_SCRIPT.forEach(seg => {
              // Nói đến đâu hiện đến đấy: Nếu âm thanh chưa chạy tới lượt thoại này thì KHÔNG hiển thị
              if (currentTime < seg.start) {
                return;
              }

              currentTurnCount++;
              const isFinished = currentTime >= seg.end;
              const isActive = currentTime >= seg.start && currentTime < seg.end;
              const isOp = seg.speakerRole === 'operator';

              const isBubbleFocused = currentFocusedTurnId === seg.id;
              let statusClass = isActive ? 'is-active' : 'is-completed';
              if (isBubbleFocused) statusClass += ' is-bubble-focused';

              let displayedText = '';
              if (isFinished) {
                displayedText = highlightKeywords(seg.text, seg.keywords || []);
              } else {
                const segDuration = Math.max(0.1, seg.end - seg.start);
                const progress = Math.min(1, Math.max(0, (currentTime - seg.start) / segDuration));
                const charCount = Math.min(seg.text.length, Math.max(1, Math.floor(progress * seg.text.length)));
                const rawSlice = seg.text.slice(0, charCount);
                displayedText = highlightKeywords(rawSlice, seg.keywords || []) + '<span class="typing-cursor"></span>';
              }

              html += `
                <div class="dialogue-bubble ${isOp ? 'speaker-operator' : 'speaker-caller'} ${statusClass}" id="dialogue-turn-${seg.id}">
                  <div class="dialogue-speaker-name">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="speaker-pill ${isOp ? 'op' : 'caller'}">${seg.speakerLabel}</span>
                    </div>
                  </div>
                  <div class="dialogue-text">${displayedText}</div>
                </div>
              `;
            });

            if (!html) {
              html = `<div style="text-align:center;padding:24px 12px;color:#64748B;font-size:12px;font-style:italic;">Đang kết nối cuộc gọi...</div>`;
            }

            dialogueFeed.innerHTML = html;

            // Tự động cuộn theo dõi khi nội dung mới xuất hiện hoặc đang đàm thoại (chỉ khi không đang bấm xem focus keyword)
            const isNearBottom = (dialogueFeed.scrollHeight - dialogueFeed.scrollTop - dialogueFeed.clientHeight) < 100;
            const hasNewTurn = currentTurnCount > lastTurnCount;
            if ((isNearBottom || hasNewTurn) && !currentFocusedKeyword) {
              dialogueFeed.scrollTop = dialogueFeed.scrollHeight;
            }
            lastTurnCount = currentTurnCount;
          };

          // HIỂN THỊ TÓM TẮT TỪ KHÓA & BẤM ĐỂ NHẢY LÊN HIGHLIGHT
          let lastKwCount = -1;
          const renderKeywordsSummary = (currentTime) => {
            const chipsBar = paneContainer.querySelector('#voice-keywords-chips-bar');
            const countEl = paneContainer.querySelector('#voice-keywords-count');
            if (!chipsBar) return;

            const activeKws = KEYWORDS_LIST.filter(kw => currentTime >= kw.time);

            if (countEl) {
              countEl.textContent = `${activeKws.length} từ khóa`;
            }

            if (activeKws.length === 0) {
              if (lastKwCount !== 0) {
                lastKwCount = 0;
                chipsBar.innerHTML = `<span class="voice-kw-empty">Đang lắng nghe và trích xuất từ khóa quan trọng...</span>`;
              }
              return;
            }

            if (activeKws.length !== lastKwCount) {
              lastKwCount = activeKws.length;
              let html = '';
              activeKws.forEach(kw => {
                const isActive = currentFocusedKeyword === kw.text;
                html += `
                  <button type="button" class="voice-kw-chip${isActive ? ' is-active' : ''}" data-kw-id="${kw.id}" title="Bấm để nhảy tới đoạn thoại: ${kw.text}">
                    <span class="voice-kw-dot" style="background:${kw.color};"></span>
                    <span class="voice-kw-text">${kw.display}</span>
                    <span class="voice-kw-time">${formatTime(kw.time)}</span>
                  </button>
                `;
              });
              chipsBar.innerHTML = html;

              chipsBar.querySelectorAll('.voice-kw-chip').forEach(chipEl => {
                chipEl.addEventListener('click', (e) => {
                  e.stopPropagation();
                  const kwId = chipEl.getAttribute('data-kw-id');
                  const kw = KEYWORDS_LIST.find(k => k.id === kwId);
                  if (kw) {
                    onKeywordClick(kw);
                  }
                });
              });
            }
          };

          const onKeywordClick = (kw) => {
            if (focusedKeywordTimeout) clearTimeout(focusedKeywordTimeout);

            currentFocusedKeyword = kw.text;
            currentFocusedTurnId = kw.turnId;

            // Nếu câu thoại này chưa xuất hiện (ví dụ bấm từ khóa tương lai), nhảy thời gian audio tới đoạn keyword đó
            if (voiceAudio.currentTime < kw.time) {
              try {
                voiceAudio.currentTime = Math.max(0, kw.time - 0.2);
              } catch (e) { }
            }

            // Cập nhật lại giao diện và chips
            renderFullDialogueFeed(Math.max(voiceAudio.currentTime, kw.time + 0.5));

            // Cập nhật class is-active trên chip
            const chipsBar = paneContainer.querySelector('#voice-keywords-chips-bar');
            if (chipsBar) {
              chipsBar.querySelectorAll('.voice-kw-chip').forEach(c => {
                c.classList.toggle('is-active', c.getAttribute('data-kw-id') === kw.id);
              });
            }

            // Nhảy lên và highlight phần đoạn keyword trong dialogue feed
            if (dialogueFeed) {
              const bubble = dialogueFeed.querySelector(`#dialogue-turn-${kw.turnId}`);
              if (bubble) {
                const mark = bubble.querySelector('.ai-kw.is-focused-kw') || bubble.querySelector('.ai-kw') || bubble;
                const scrollPos = mark.offsetTop - dialogueFeed.offsetTop - 24;
                dialogueFeed.scrollTo({
                  top: Math.max(0, scrollPos),
                  behavior: 'smooth'
                });
              }
            }

            // Tự động tắt trạng thái focus sau 3.5s
            focusedKeywordTimeout = setTimeout(() => {
              currentFocusedKeyword = null;
              currentFocusedTurnId = null;
              renderFullDialogueFeed(voiceAudio.currentTime);
              const chips = paneContainer.querySelector('#voice-keywords-chips-bar');
              if (chips) chips.querySelectorAll('.voice-kw-chip').forEach(c => c.classList.remove('is-active'));
            }, 3500);
          };

          const checkAutoFillTriggers = (currentTime) => {
            // 1. Tự chọn loại tình huống cấp cứu (t >= 7.5s)
            if (currentTime >= 7.5 && !triggers.incident) {
              triggers.incident = true;
              setIncident('INC_TNGT', false);
              flashCard('card-incident');
              addAiTag('[TÌNH HUỐNG: TAI NẠN XE MÁY]');
              window.CCNV_UI.SoundFx.playBeep();
            }

            // 2. Vị trí hiện trường tự fill (t >= 13.0s)
            if (currentTime >= 13.0 && !triggers.location) {
              triggers.location = true;
              const addrInput = paneContainer.querySelector('#rapid-address');
              if (addrInput) {
                addrInput.value = 'Đường Nguyễn Văn Cừ, trước cổng trường Đại học Cần Thơ, phía bên phải hướng đi vào trung tâm';
              }
              flashCard('card-location');
              addAiTag('[HIỆN TRƯỜNG: ĐH CẦN THƠ, Đ. NGUYỄN VĂN CỪ]');
              window.CCNV_UI.SoundFx.playBeep();
            }

            // 3. Fill số người + độ tuổi + giới tính (t >= 22.5s)
            if (currentTime >= 22.5 && !triggers.patients) {
              triggers.patients = true;
              patients = [
                {
                  id: 1,
                  ageGroup: 'ELDERLY',
                  gender: 'Nam',
                  notes: patients[0]?.notes || ''
                },
                {
                  id: 2,
                  ageGroup: 'ELDERLY',
                  gender: 'Nam',
                  notes: ''
                }
              ];
              renderPatientsList();
              flashCard('card-patient');
              addAiTag('[2 NẠN NHÂN: NAM, NGƯỜI CAO TUỔI]');
              window.CCNV_UI.SoundFx.playBeep();
            }

            // 4. Tự phân loại mức độ (t >= 26.5s)
            if (currentTime >= 26.5 && !triggers.severity) {
              triggers.severity = true;
              setSeverity('CRITICAL', false);
              flashCard('card-severity');
              addAiTag('[PHÂN LOẠI: TỐI KHẨN (ĐỎ)]');
              window.CCNV_UI.SoundFx.playEmergencyTone();
            }

            // 5. Mô tả bệnh nhân tự fill (t >= 29.5s)
            if (currentTime >= 29.5 && !triggers.symptoms) {
              triggers.symptoms = true;
              if (patients[0]) {
                patients[0].notes = 'Còn thở, trả lời nhỏ, chân trái chảy máu nhiều';
              }
              if (patients[1]) {
                patients[1].notes = 'Bất tỉnh hoàn toàn, ngã ra đường nằm im';
              }
              const wrapper = paneContainer.querySelector('#patient-items-wrapper');
              if (wrapper) {
                const inp0 = wrapper.querySelector('.inp-patient-notes[data-index="0"]');
                const inp1 = wrapper.querySelector('.inp-patient-notes[data-index="1"]');
                if (inp0) {
                  inp0.value = patients[0].notes;
                }
                if (inp1) {
                  inp1.value = patients[1].notes;
                }
              }
              const notesTextarea = paneContainer.querySelector('#rapid-symptoms-notes');
              if (notesTextarea) {
                notesTextarea.value = 'Tai nạn xe máy 2 nạn nhân nam cao tuổi. Nạn nhân 1: Còn thở, trả lời nhỏ, chân trái chảy máu nhiều. Nạn nhân 2: Bất tỉnh hoàn toàn, nghi chấn thương sọ não.';
              }
              flashCard('card-patient');
              flashCard('card-notes');
              addAiTag('[MÔ TẢ: 1 BẤT TỈNH, 1 CHẢY MÁU CHÂN]');
              window.CCNV_UI.SoundFx.playBeep();
            }

            // 6. Sẵn sàng điều xe (t >= 36.0s)
            if (currentTime >= 36.0 && !triggers.ready) {
              triggers.ready = true;
              addAiTag('[ĐÃ THU THẬP ĐỦ THÔNG TIN · SẴN SÀNG ĐIỀU XE]');
              const nextBtn = paneContainer.querySelector('#btn-next-to-step2');
              if (nextBtn) {
                nextBtn.style.boxShadow = '0 0 18px rgba(56,189,248,0.9)';
                nextBtn.style.borderColor = '#38BDF8';
              }
            }
          };

          const onVoiceTick = () => {
            const curTime = voiceAudio.currentTime;
            const totalDur = voiceAudio.duration || 41.71;

            if (timerDisplay) {
              timerDisplay.textContent = formatTime(curTime);
            }

            renderFullDialogueFeed(curTime);
            renderKeywordsSummary(curTime);
            checkAutoFillTriggers(curTime);

            if (!voiceAudio.paused && !voiceAudio.ended) {
              this._voiceRafId = requestAnimationFrame(onVoiceTick);
            }
          };

          voiceAudio.addEventListener('timeupdate', onVoiceTick);
          const voiceInterval = setInterval(() => {
            if (!voiceAudio.paused && !voiceAudio.ended) {
              onVoiceTick();
            }
          }, 60);

          this._voiceIntervalId = voiceInterval;

          voiceAudio.addEventListener('play', () => {
            waveEq?.classList.add('is-playing');
            if (playText) playText.textContent = 'Tạm dừng';
            this._voiceRafId = requestAnimationFrame(onVoiceTick);
          });

          voiceAudio.addEventListener('pause', () => {
            waveEq?.classList.remove('is-playing');
            if (playText) playText.textContent = 'Tiếp tục';
            if (this._voiceRafId) cancelAnimationFrame(this._voiceRafId);
          });

          voiceAudio.addEventListener('ended', () => {
            waveEq?.classList.remove('is-playing');
            if (playText) playText.textContent = 'Đàm thoại hoàn tất';
            if (this._voiceRafId) cancelAnimationFrame(this._voiceRafId);
            clearInterval(voiceInterval);
          });

          btnPlayPause?.addEventListener('click', () => {
            if (voiceAudio.paused) {
              voiceAudio.play();
            } else {
              voiceAudio.pause();
            }
          });

          const btnHeaderReplay = paneContainer.querySelector('#btn-header-replay');

          const replayAudioCall = () => {
            try {
              voiceAudio.pause();
              voiceAudio.currentTime = 0;
            } catch (e) { }

            triggers = {
              incident: false,
              location: false,
              patients: false,
              severity: false,
              symptoms: false,
              ready: false
            };

            lastTurnCount = 0;
            lastKwCount = -1;
            currentFocusedKeyword = null;
            currentFocusedTurnId = null;
            if (timerDisplay) timerDisplay.textContent = '00:00';
            renderFullDialogueFeed(0.0);
            renderKeywordsSummary(0.0);

            // Bật lại phát âm thanh từ đầu
            try {
              const playPromise = voiceAudio.play();
              if (playPromise !== undefined) {
                playPromise.catch(err => {
                  console.log('Voice replay error:', err);
                });
              }
            } catch (e) { }

            waveEq?.classList.add('is-playing');
            if (playText) playText.textContent = 'Tạm dừng';

            if (this._voiceRafId) cancelAnimationFrame(this._voiceRafId);
            this._voiceRafId = requestAnimationFrame(onVoiceTick);
          };

          btnHeaderReplay?.addEventListener('click', (e) => {
            e.stopPropagation();
            replayAudioCall();
          });

          btnHangup?.addEventListener('click', () => {
            this.stopVoiceDemoAudio();
            if (demo?.onCancel) demo.onCancel();
            else {
              this.currentMenu = 'cases-list';
              this.renderSidebar();
              this.renderCurrentView();
            }
          });

          btnInstantFill?.addEventListener('click', () => {
            try {
              voiceAudio.currentTime = 41.71;
              voiceAudio.pause();
            } catch (e) { }
            if (playText) playText.textContent = 'Đàm thoại hoàn tất';
            waveEq?.classList.remove('is-playing');
            checkAutoFillTriggers(40.0);
            renderFullDialogueFeed(41.71);
            renderKeywordsSummary(41.71);
            if (timerDisplay) timerDisplay.textContent = '00:41';
            window.CCNV_UI.Toast.show(
              'AI ĐÃ HOÀN TẤT ĐIỀN FORM TỰ ĐỘNG',
              'Đã tự động trích xuất: Tai nạn xe máy · ĐH Cần Thơ · 2 Nạn nhân (Người cao tuổi, Nam) · Tối khẩn.',
              false,
              4000
            );
          });

          // Khởi tạo hiển thị từ 0s (chỉ lượt thoại đầu tiên chuẩn bị nói, các câu sau chưa nói sẽ không hiện)
          renderFullDialogueFeed(0.0);
          renderKeywordsSummary(0.0);

          // Tiep nhan thi phat voice luon
          try {
            const playPromise = voiceAudio.play();
            if (playPromise !== undefined) {
              playPromise.catch(err => {
                console.log('Voice autoplay deferred:', err);
                waveEq?.classList.remove('is-playing');
                if (playText) playText.textContent = 'Bật âm thanh';
              });
            }
          } catch (e) { }
        };

        // Start Speech-to-Text & Auto-Fill Demo Engine
        initVoiceDemoEngine();


        // --- KEYBOARD CONTROLLER FOR 2-STEP & 1-HAND OPERATION ---
        this._callCenterKeyHandler = (e) => {
          // If cheat modal is open, Escape closes it
          if (cheatModalOverlay && cheatModalOverlay.classList.contains('active')) {
            if (e.key === 'Escape') {
              e.preventDefault();
              closeCheatModal();
              return;
            }
          }

          // 1. Phím tắt chuyển bước & Phát lệnh: Ctrl + Enter
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (currentStep === 1) {
              switchStep(2);
            } else {
              doDispatch();
            }
            return;
          }

          // 2. F1: Phát lệnh điều xe & tạo ca
          if (e.key === 'F1') {
            e.preventDefault();
            doDispatch();
            return;
          }

          // 3. Escape: Quay lại Tab 1 nếu đang ở Tab 2
          if (e.key === 'Escape' && currentStep === 2) {
            e.preventDefault();
            switchStep(1);
            return;
          }

          // 3. Alt + C: Inject Cell-ID
          if (e.altKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            injectCellId();
            return;
          }

          // 4. Global Alt+1, Alt+2, Alt+3 for Vehicle Type anywhere
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

          // 5. Toggle Help Modal: ? or i or I
          if ((e.key === '?' || e.key === 'i' || e.key === 'I') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            openCheatModal();
            return;
          }

          // 6. CONTEXTUAL NUMERIC KEYS (1, 2, 3...) WHEN NOT IN TEXT INPUT
          const isTextInput = (e.target.tagName === 'INPUT' && e.target.type === 'text') || (e.target.tagName === 'INPUT' && e.target.type === 'number') || e.target.tagName === 'TEXTAREA';

          if (!isTextInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // STEP 2: If on Vehicle Type card (Block 5)
            if (currentStep === 2 && currentFocusedCard === 'card-vehicle-type') {
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

            // STEP 2: If on Crew Members card (Block 6)
            if (currentStep === 2 && currentFocusedCard === 'card-crew-members') {
              const numKey = parseInt(e.key, 10);
              if (numKey >= 1 && numKey <= 6 && availablePersonnel[numKey - 1]) {
                e.preventDefault();
                togglePersonnel(availablePersonnel[numKey - 1].id);
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                paneContainer.querySelector('#card-hospital')?.focus();
                return;
              }
            }

            // STEP 2: If on Hospital card (Block 7)
            if (currentStep === 2 && currentFocusedCard === 'card-hospital') {
              const numKey = parseInt(e.key, 10);
              if (numKey >= 1 && numKey <= availableHospitals.length && availableHospitals[numKey - 1]) {
                e.preventDefault();
                setHospital(availableHospitals[numKey - 1].id);
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                paneContainer.querySelector('#card-notes')?.focus();
                paneContainer.querySelector('#rapid-symptoms-notes')?.focus();
                return;
              }
            }

            // STEP 1: If on Incident card (Block 3)
            if (currentStep === 1 && currentFocusedCard === 'card-incident') {
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

            // STEP 1: If on Severity card (Block 4)
            if (currentStep === 1 && currentFocusedCard === 'card-severity') {
              if (e.key === '1') { e.preventDefault(); setSeverity('CRITICAL'); return; }
              if (e.key === '2') { e.preventDefault(); setSeverity('EMERGENCY'); return; }
              if (e.key === '3') { e.preventDefault(); setSeverity('ROUTINE'); return; }
              if (e.key === 'Enter') {
                e.preventDefault();
                switchStep(2);
                return;
              }
            }
          }

          // 7. Tab navigation across form blocks
          if (e.key === 'Tab') {
            const onIncident = currentFocusedCard === 'card-incident' || e.target.id === 'card-incident' || e.target.closest('#card-incident');
            const onSeverity = currentFocusedCard === 'card-severity' || e.target.id === 'card-severity' || e.target.closest('#card-severity');
            const onVehicleType = currentFocusedCard === 'card-vehicle-type' || e.target.id === 'card-vehicle-type' || e.target.closest('#card-vehicle-type');
            const onCrewMembers = currentFocusedCard === 'card-crew-members' || e.target.id === 'card-crew-members' || e.target.closest('#card-crew-members');
            const onHospital = currentFocusedCard === 'card-hospital' || e.target.id === 'card-hospital' || e.target.closest('#card-hospital');
            const onNotes = currentFocusedCard === 'card-notes' || e.target.id === 'card-notes' || e.target.closest('#card-notes');

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
                switchStep(2);
              } else {
                paneContainer.querySelector('#card-incident')?.focus();
              }
              return;
            }

            if (onVehicleType) {
              e.preventDefault();
              if (!e.shiftKey) {
                paneContainer.querySelector('#card-crew-members')?.focus();
              } else {
                switchStep(1);
              }
              return;
            }

            if (onCrewMembers) {
              e.preventDefault();
              if (!e.shiftKey) {
                paneContainer.querySelector('#card-hospital')?.focus();
              } else {
                paneContainer.querySelector('#card-vehicle-type')?.focus();
              }
              return;
            }

            if (onHospital) {
              e.preventDefault();
              if (!e.shiftKey) {
                paneContainer.querySelector('#card-notes')?.focus();
                paneContainer.querySelector('#rapid-symptoms-notes')?.focus();
              } else {
                paneContainer.querySelector('#card-crew-members')?.focus();
              }
              return;
            }

            if (onNotes && e.shiftKey) {
              e.preventDefault();
              paneContainer.querySelector('#card-hospital')?.focus();
              return;
            }
          }

          if (e.key === 'Enter') {
            if (e.target.id === 'rapid-address') {
              e.preventDefault();
              paneContainer.querySelector('#card-incident')?.focus();
            }
          }
        };

        window.addEventListener('keydown', this._callCenterKeyHandler);

        // Autofocus the first patient notes field
        setTimeout(() => {
          const firstField = paneContainer.querySelector('.inp-patient-notes') || paneContainer.querySelector('#rapid-address');
          if (firstField) {
            firstField.focus();
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
            {
              key: 'time',
              title: 'Thời điểm',
              sortable: true,
              render: item => {
                let dStr = '02/10/2026';
                if (item.id) {
                  const m = item.id.match(/(\d{4})(\d{2})(\d{2})/);
                  if (m) dStr = `${m[3]}/${m[2]}/${m[1]}`;
                }
                const formatted = this.formatDateTime(item.time, dStr);
                return `<span style="font-family:var(--font-mono);font-size:12px;color:var(--text-white);white-space:nowrap;display:inline-block;">${formatted}</span>`;
              }
            },
            { key: 'phone', title: 'Số điện thoại', sortable: true, render: item => `<span style="font-family:var(--font-mono);">${item.phone}</span>` },
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
            {
              key: 'operator',
              title: 'Điều phối viên',
              sortable: true,
              render: item => {
                if (!item.operator) return '<span style="color:#64748B;">Chưa gán</span>';
                const operatorMap = {
                  'dpv01': 'Nguyễn Văn An',
                  'dpv02': 'Trần Minh Đức',
                  'dpv03': 'Lê Hoàng Nam'
                };
                const name = operatorMap[item.operator] || item.operator;
                return `<strong>${name}</strong>`;
              }
            }
          ]
        }).render();
      }

      // --- TAB 3: DANH BẠ LIÊN HỆ (BỆNH VIỆN / BÁC SĨ / TÀI XẾ) ---
      else if (activeTab === 'directory') {
        const renderDirectorySubTab = (subTab) => {
          paneContainer.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;background:rgba(15, 23, 42, 0.75);backdrop-filter:blur(10px);padding:8px 12px;border-radius:10px;border:1px solid rgba(56, 189, 248, 0.2);box-shadow:0 4px 16px rgba(0,0,0,0.3);">
              <div style="display:flex;align-items:center;gap:8px;">
                <button class="btn btn-sm ${subTab === 'hospitals' ? 'btn-primary' : 'btn-ghost'}" id="subtab-dir-hospitals" style="font-weight:600;display:flex;align-items:center;gap:6px;border-radius:6px;padding:6px 14px;transition:all 0.2s ease;${subTab === 'hospitals' ? 'color:#FFFFFF;background:#2563EB;border-color:#3B82F6;' : 'color:#CBD5E1;'}">
                  ${window.CCNV_UI.ICONS.hospital || ''} Danh bạ bệnh viện (${hospitals.length})
                </button>
                <button class="btn btn-sm ${subTab === 'doctors' ? 'btn-primary' : 'btn-ghost'}" id="subtab-dir-doctors" style="font-weight:600;display:flex;align-items:center;gap:6px;border-radius:6px;padding:6px 14px;transition:all 0.2s ease;${subTab === 'doctors' ? 'color:#FFFFFF;background:#2563EB;border-color:#3B82F6;' : 'color:#CBD5E1;'}">
                  ${window.CCNV_UI.ICONS.user || ''} Danh bạ bác sĩ (${(state.personnel || []).filter(p => p.role === 'DOCTOR' || p.role === 'NURSE').length})
                </button>
                <button class="btn btn-sm ${subTab === 'drivers' ? 'btn-primary' : 'btn-ghost'}" id="subtab-dir-drivers" style="font-weight:600;display:flex;align-items:center;gap:6px;border-radius:6px;padding:6px 14px;transition:all 0.2s ease;${subTab === 'drivers' ? 'color:#FFFFFF;background:#2563EB;border-color:#3B82F6;' : 'color:#CBD5E1;'}">
                  ${window.CCNV_UI.ICONS.truck || ''} Danh sách tài xế (${(state.personnel || []).filter(p => p.role === 'DRIVER').length})
                </button>
              </div>
              <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;box-shadow:0 0 8px #10B981;"></span>
                <span>Hệ thống trực thoại 24/7 sẵn sàng</span>
              </div>
            </div>
            <div class="content-card" style="padding:0;overflow:visible;border:1px solid rgba(56, 189, 248, 0.18);box-shadow:0 10px 30px rgba(0,0,0,0.5);">
              <div id="call-directory-table-mount"></div>
            </div>
          `;

          // Bind Subtab click handlers
          paneContainer.querySelector('#subtab-dir-hospitals')?.addEventListener('click', () => renderDirectorySubTab('hospitals'));
          paneContainer.querySelector('#subtab-dir-doctors')?.addEventListener('click', () => renderDirectorySubTab('doctors'));
          paneContainer.querySelector('#subtab-dir-drivers')?.addEventListener('click', () => renderDirectorySubTab('drivers'));

          if (subTab === 'hospitals') {
            new window.CCNV_UI.DataTable({
              containerId: 'call-directory-table-mount',
              data: hospitals,
              pageSize: 10,
              exportTitle: 'Danh bạ Bệnh viện thành phố Cần Thơ',
              enableExport: false,
              searchPlaceholder: 'Tìm tên bệnh viện, số điện thoại hotline, địa chỉ...',
              defaultSortKey: 'name',
              defaultSortOrder: 'asc',
              columns: [
                {
                  key: 'name',
                  title: 'Tên Bệnh viện / Cơ sở Y tế',
                  sortable: true,
                  render: h => `
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:34px;height:34px;border-radius:8px;background:rgba(56, 189, 248, 0.12);border:1px solid rgba(56, 189, 248, 0.3);display:flex;align-items:center;justify-content:center;color:#38BDF8;flex-shrink:0;">
                        ${window.CCNV_UI.ICONS.hospital || '🏥'}
                      </div>
                      <div>
                        <strong style="color:#FFFFFF;font-size:13px;display:block;">${h.name}</strong>
                        <span style="font-size:11px;color:#94A3B8;">Phân hạng: Bệnh viện Đa khoa Hạng I</span>
                      </div>
                    </div>
                  `
                },
                {
                  key: 'hotline',
                  title: 'Hotline Cấp cứu 24/7',
                  sortable: true,
                  render: h => `
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span style="color:#EF4444;">📞</span>
                      <strong style="font-family:var(--font-mono);color:#F87171;font-size:13px;letter-spacing:0.5px;">${h.hotline || '0292.3821.236'}</strong>
                    </div>
                  `
                },
                {
                  key: 'address',
                  title: 'Địa chỉ & Khu vực',
                  sortable: false,
                  render: h => `
                    <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#CBD5E1;">
                      <span style="color:#38BDF8;">📍</span>
                      <span>${h.address}</span>
                    </div>
                  `
                },
                {
                  key: 'actions',
                  title: 'Thao tác thoại',
                  sortable: false,
                  render: h => `
                    <button class="btn btn-emergency btn-sm btn-call-contact" data-name="${h.name}" data-phone="${h.hotline || '0292.3821.236'}" style="padding:5px 12px;border-radius:6px;font-weight:600;gap:6px;">
                      ${window.CCNV_UI.ICONS.phone} Gọi kết nối
                    </button>
                  `
                }
              ]
            }).render();
          } else if (subTab === 'doctors') {
            const doctors = (state.personnel || []).filter(p => p.role === 'DOCTOR' || p.role === 'NURSE');
            new window.CCNV_UI.DataTable({
              containerId: 'call-directory-table-mount',
              data: doctors,
              pageSize: 10,
              exportTitle: 'Danh bạ Bác sĩ & Y tế Cấp cứu',
              enableExport: false,
              searchPlaceholder: 'Tìm tên bác sĩ, chuyên khoa, số điện thoại...',
              defaultSortKey: 'name',
              defaultSortOrder: 'asc',
              columns: [
                {
                  key: 'name',
                  title: 'Họ và tên Bác sĩ / Y sĩ',
                  sortable: true,
                  render: p => `
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:34px;height:34px;border-radius:50%;background:rgba(16, 185, 129, 0.15);border:1px solid rgba(16, 185, 129, 0.4);display:flex;align-items:center;justify-content:center;color:#10B981;font-weight:700;flex-shrink:0;">
                        ${p.name.charAt(0)}
                      </div>
                      <div>
                        <strong style="color:#FFFFFF;font-size:13px;display:block;">${p.name}</strong>
                        <span style="font-size:11px;color:#94A3B8;">${p.cert || 'Chuyên khoa Cấp cứu Nâng cao'}</span>
                      </div>
                    </div>
                  `
                },
                {
                  key: 'roleName',
                  title: 'Chức danh',
                  sortable: true,
                  render: p => `<span class="badge ${p.role === 'DOCTOR' ? 'badge-primary' : 'badge-normal'}" style="padding:3px 10px;font-size:11.5px;">${p.roleName}</span>`
                },
                {
                  key: 'phone',
                  title: 'Số điện thoại',
                  sortable: true,
                  render: p => `<strong style="font-family:var(--font-mono);color:#60A5FA;font-size:13px;">${p.phone}</strong>`
                },
                {
                  key: 'status',
                  title: 'Trạng thái ca trực',
                  sortable: true,
                  render: p => p.status === 'ON_DUTY'
                    ? `<span class="status-pill status-pill-completed" style="background:rgba(16, 185, 129, 0.15);border:1px solid #10B981;color:#34D399;">● Đang trực kíp</span>`
                    : `<span class="status-pill status-pill-cancelled" style="background:rgba(148, 163, 184, 0.1);border:1px solid #64748B;color:#94A3B8;">○ Nghỉ ca</span>`
                },
                {
                  key: 'actions',
                  title: 'Thao tác thoại',
                  sortable: false,
                  render: p => `
                    <button class="btn btn-emergency btn-sm btn-call-contact" data-name="${p.name}" data-phone="${p.phone}" style="padding:5px 12px;border-radius:6px;font-weight:600;gap:6px;">
                      ${window.CCNV_UI.ICONS.phone} Gọi ngay
                    </button>
                  `
                }
              ]
            }).render();
          } else if (subTab === 'drivers') {
            const drivers = (state.personnel || []).filter(p => p.role === 'DRIVER');
            new window.CCNV_UI.DataTable({
              containerId: 'call-directory-table-mount',
              data: drivers,
              pageSize: 10,
              exportTitle: 'Danh sách Tài xế Cấp cứu',
              enableExport: false,
              searchPlaceholder: 'Tìm tên tài xế, bằng lái, số điện thoại...',
              defaultSortKey: 'name',
              defaultSortOrder: 'asc',
              columns: [
                {
                  key: 'name',
                  title: 'Họ và tên Lái xe',
                  sortable: true,
                  render: p => `
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:34px;height:34px;border-radius:50%;background:rgba(245, 158, 11, 0.15);border:1px solid rgba(245, 158, 11, 0.4);display:flex;align-items:center;justify-content:center;color:#F59E0B;font-weight:700;flex-shrink:0;">
                        🚑
                      </div>
                      <div>
                        <strong style="color:#FFFFFF;font-size:13px;display:block;">${p.name}</strong>
                        <span style="font-size:11px;color:#94A3B8;">${p.cert || 'Bằng Hạng D - Lái xe Cứu thương'}</span>
                      </div>
                    </div>
                  `
                },
                {
                  key: 'roleName',
                  title: 'Nhiệm vụ kíp',
                  sortable: true,
                  render: p => `<span class="badge badge-accent" style="padding:3px 10px;font-size:11.5px;">${p.roleName}</span>`
                },
                {
                  key: 'phone',
                  title: 'Số điện thoại',
                  sortable: true,
                  render: p => `<strong style="font-family:var(--font-mono);color:#60A5FA;font-size:13px;">${p.phone}</strong>`
                },
                {
                  key: 'status',
                  title: 'Trạng thái sẵn sàng',
                  sortable: true,
                  render: p => p.status === 'ON_DUTY'
                    ? `<span class="status-pill status-pill-completed" style="background:rgba(16, 185, 129, 0.15);border:1px solid #10B981;color:#34D399;">● Sẵn sàng lái xe</span>`
                    : `<span class="status-pill status-pill-cancelled" style="background:rgba(148, 163, 184, 0.1);border:1px solid #64748B;color:#94A3B8;">○ Nghỉ ca</span>`
                },
                {
                  key: 'actions',
                  title: 'Thao tác thoại',
                  sortable: false,
                  render: p => `
                    <button class="btn btn-emergency btn-sm btn-call-contact" data-name="${p.name}" data-phone="${p.phone}" style="padding:5px 12px;border-radius:6px;font-weight:600;gap:6px;">
                      ${window.CCNV_UI.ICONS.phone} Gọi ngay
                    </button>
                  `
                }
              ]
            }).render();
          }
        };

        renderDirectorySubTab('hospitals');

        paneContainer.addEventListener('click', (e) => {
          const btn = e.target.closest('.btn-call-contact');
          if (btn) {
            const cName = btn.getAttribute('data-name');
            const cPhone = btn.getAttribute('data-phone');
            window.CCNV_UI.Toast.show('Đang quay số...', `Kết nối thoại khẩn cấp đến: ${cName} (${cPhone})`);
            window.StateManager.addAuditLog(`Gọi điện thoại thoại khẩn cấp đến ${cName} (${cPhone})`);
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
                    <span>113 - Cảnh sát Phản ứng nhanh thành phố Cần Thơ</span>
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
                    <span>114 - Cảnh sát PCCC & Cứu nạn Cứu hộ thành phố Cần Thơ</span>
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
                    <option value="${c.id}">${c.code} - ${c.patient?.ageGroupText || 'Nạn nhân'} (${c.location?.address || 'Hiện trường'})</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-field" style="margin-bottom:12px;">
                <label class="form-label">Đơn vị nhận tin phối hợp</label>
                <select id="transfer-agency-select">
                  <option value="113">113 - Cảnh sát Phản ứng nhanh (An ninh hiện trường, giải tỏa giao thông)</option>
                  <option value="114">114 - Cứu nạn Cứu hộ (Cắt phá xe lật, kẹt người trong cabin)</option>
                  <option value="GTVT">Sở GTVT - Mở làn sóng xanh đèn tín hiệu</option>
                </select>
              </div>

              <div class="form-field" style="margin-bottom:14px;">
                <label class="form-label">Nội dung yêu cầu phối hợp cụ thể</label>
                <textarea id="transfer-notes-input" rows="3">Đề nghị CSGT 113 phân luồng giao thông tại chân Cầu Hưng Lợi hướng về BVĐK thành phố Cần Thơ để xe cấp cứu 65A-012.34 chở ca chấn thương nặng di chuyển thuận lợi.</textarea>
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
        patientAgeGroup: c.patient?.ageGroup || 'ADULT',
        patientAgeGroupText: c.patient?.ageGroupText || 'Người trưởng thành',
        patientGender: c.patient?.gender || '',
        incidentName: c.incident?.name || 'Cấp cứu',
        severity: c.incident?.severity || 'ROUTINE',
        locationAddress: c.location?.address || '-',
        vehiclePlate: c.dispatch?.vehiclePlate || '-',
        crewName: c.dispatch?.crewName || '-',
        hospitalName: c.dispatch?.hospitalName || '-',
        status: c.status,
        statusText: c.statusText || (c.status === 'DISPATCHED' ? 'Đã điều động' : c.status === 'TRANSPORTING' ? 'Đang đến viện' : c.status === 'COMPLETED' ? 'Hoàn tất' : 'Đã hủy'),
        eta: c.eta || (c.status === 'TRANSPORTING' ? '5 phút' : '-'),
        isHistory: false,
        raw: c
      }));

      const historyList = historyRaw.map(h => ({
        id: h.id,
        code: h.code,
        createdAt: h.createdAt,
        completedAt: h.completedAt,
        patientAgeGroup: h.patientAgeGroup || 'ADULT',
        patientAgeGroupText: h.patientAgeGroupText || 'Người trưởng thành',
        patientGender: h.patientGender || 'Nam',
        incidentName: h.incidentName || 'Cấp cứu',
        severity: h.severity || 'ROUTINE',
        locationAddress: h.locationAddress || 'thành phố Cần Thơ',
        vehiclePlate: h.vehiclePlate || '-',
        crewName: h.crewName || 'Kíp trực 115',
        hospitalName: h.hospitalName || '-',
        status: h.status,
        statusText: h.statusText || (h.status === 'COMPLETED' ? 'Hoàn tất' : 'Đã hủy'),
        eta: '-',
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
        searchPlaceholder: 'Tìm mã ca, nhóm độ tuổi, biển số xe, bệnh viện đích, tình huống...',
        defaultSortKey: 'createdAt',
        defaultSortOrder: 'desc',
        filterOptions: [
          { label: 'Tất cả ca', value: 'ALL', filterFn: () => true },
          { label: 'Xe đang đến viện (Tiếp nhận)', value: 'TRANSPORTING', filterFn: c => c.status === 'TRANSPORTING' },
          { label: 'Đang xử lý / Điều xe', value: 'ACTIVE', filterFn: c => c.status === 'DISPATCHED' || c.status === 'ON_SCENE' || c.status === 'NEW' },
          { label: 'Đã hoàn tất', value: 'COMPLETED', filterFn: c => c.status === 'COMPLETED' },
          { label: 'Tối khẩn', value: 'CRITICAL', filterFn: c => c.severity === 'CRITICAL' || c.severity === 'EMERGENCY' },
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
            title: 'Thời điểm',
            sortable: true,
            render: c => `<span style="font-family:var(--font-mono);font-size:12px;color:#CBD5E1;white-space:nowrap;display:inline-block;">${this.formatDateTime(c.createdAt)}</span>`
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
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
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
          { key: 'station', title: 'Trạm đóng quân', sortable: true, render: c => c.station || 'BVĐK thành phố Cần Thơ' },
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
                    <td style="padding:10px;text-align:left;font-weight:600;color:var(--text-white);">1. BVĐK thành phố Cần Thơ (TT115)</td>
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
                    <td style="padding:8px;background:rgba(30, 58, 95, 0.4);font-weight:600;color:#93C5FD;">Kíp 05 (Xe 65A-019.99)</td>
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
          patientAgeGroup: c.patient?.ageGroup || 'ADULT',
          patientAgeGroupText: c.patient?.ageGroupText || 'Người trưởng thành',
          patientGender: c.patient?.gender || 'Nam',
          incidentName: c.incident?.name || c.incidentName || 'Tai nạn giao thông',
          severity: c.incident?.severity || c.severity || 'EMERGENCY',
          severityText: c.incident?.severityText || (c.severity === 'CRITICAL' ? 'Tối khẩn' : 'Khẩn cấp'),
          vehiclePlate: c.dispatch?.vehiclePlate || c.vehiclePlate || '65A-012.34',
          hospitalName: c.dispatch?.hospitalName || c.hospitalName || 'BV Đa khoa thành phố Cần Thơ',
          address: c.location?.address || c.address || 'Đoạn ngã tư 30/4 - Nguyễn Văn Linh, P. Hưng Lợi, thành phố Cần Thơ',
          district: c.location?.district || 'P. Hưng Lợi',
          status: 'IN_PROGRESS',
          statusText: 'Đang xử lý',
          callToDispatch: '0.8 phút',
          callToScene: '5.4 phút',
          duration: 'Đang thực hiện'
        })),
        ...rawHistory.map(h => ({
          code: h.code || h.id,
          createdAt: h.createdAt || '2026-10-01T21:40:00',
          patientAgeGroup: h.patientAgeGroup || 'ELDERLY',
          patientAgeGroupText: h.patientAgeGroupText || 'Người cao tuổi',
          patientGender: h.patientGender || 'Nam',
          incidentName: h.incidentName,
          severity: h.severity || 'EMERGENCY',
          severityText: h.severity === 'CRITICAL' ? 'Tối khẩn' : (h.severity === 'EMERGENCY' ? 'Khẩn cấp' : 'Tiêu chuẩn'),
          vehiclePlate: h.vehiclePlate,
          hospitalName: h.hospitalName,
          address: h.address || 'Đường 30/4, P. Xuân Khánh, thành phố Cần Thơ',
          district: h.district || 'P. Xuân Khánh',
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
          patientAgeGroup: 'ELDERLY',
          patientAgeGroupText: 'Người cao tuổi',
          patientGender: 'Nữ',
          incidentName: 'Đột quỵ não',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-016.88',
          hospitalName: 'BV Đa khoa thành phố Cần Thơ',
          address: '128 Đường 3/2, P. Xuân Khánh, thành phố Cần Thơ',
          district: 'P. Xuân Khánh',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '0.7 phút',
          callToScene: '5.1 phút',
          duration: '38 phút'
        },
        {
          code: 'CC-261001-014',
          createdAt: '2026-10-01T14:05:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Tai nạn giao thông',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-012.34',
          hospitalName: 'BV Đa khoa TW Cần Thơ',
          address: 'Cầu Hưng Lợi, P. Hưng Phú, thành phố Cần Thơ',
          district: 'P. Hưng Phú',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '0.9 phút',
          callToScene: '6.8 phút',
          duration: '42 phút'
        },
        {
          code: 'CC-261001-013',
          createdAt: '2026-10-01T11:45:00',
          patientAgeGroup: 'ELDERLY',
          patientAgeGroupText: 'Người cao tuổi',
          patientGender: 'Nữ',
          incidentName: 'Ngừng tuần hoàn / Đau thắt ngực cấp',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-011.15',
          hospitalName: 'BV Tim mạch thành phố Cần Thơ',
          address: 'Chợ An Khánh, P. An Khánh, thành phố Cần Thơ',
          district: 'P. An Khánh',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '0.6 phút',
          callToScene: '4.8 phút',
          duration: '35 phút'
        },
        {
          code: 'CC-261001-012',
          createdAt: '2026-10-01T09:30:00',
          patientAgeGroup: 'CHILD',
          patientAgeGroupText: 'Trẻ em',
          patientGender: 'Nam',
          incidentName: 'Co giật sốt cao trẻ em',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-018.89',
          hospitalName: 'Bệnh viện Nhi đồng Cần Thơ',
          address: 'Đường CMT8, P. An Thới, thành phố Cần Thơ',
          district: 'P. An Thới',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '0.8 phút',
          callToScene: '5.9 phút',
          duration: '32 phút'
        },
        {
          code: 'CC-261001-011',
          createdAt: '2026-10-01T08:15:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Suy hô hấp cấp / Dị vật đường thở',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-011.15',
          hospitalName: 'BV Đa khoa thành phố Cần Thơ',
          address: 'KCN Trà Nóc 1, P. Trà Nóc, thành phố Cần Thơ',
          district: 'P. Trà Nóc',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '0.9 phút',
          callToScene: '7.2 phút',
          duration: '44 phút'
        },
        {
          code: 'CC-261001-010',
          createdAt: '2026-10-01T06:50:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Tai nạn giao thông',
          severity: 'ROUTINE',
          severityText: 'Tiêu chuẩn',
          vehiclePlate: '65A-019.99',
          hospitalName: 'TTYT Khu vực Ô Môn',
          address: 'Quốc lộ 91, P. Châu Văn Liêm, thành phố Cần Thơ',
          district: 'P. Châu Văn Liêm',
          status: 'COMPLETED',
          statusText: 'Hoàn tất bàn giao',
          callToDispatch: '1.2 phút',
          callToScene: '8.4 phút',
          duration: '40 phút'
        }
      ];

      container.innerHTML = `
        <div class="view-container-full">
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
          <!-- 1. Quick Stats & KPI Cards Grid (Quieter Tonal Cards) -->
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;margin-bottom:18px;">
            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Tổng ca tiếp nhận</span>
                <span style="font-size:11px;color:#94A3B8;font-weight:600;background:rgba(148,163,184,0.12);padding:2px 6px;border-radius:4px;">+12.4% ↑</span>
              </div>
              <span class="kpi-value" style="color:var(--text-white);">${totalCount.toLocaleString()}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Hôm nay: <strong style="color:var(--text-white);">${stats.todayCases || 14} ca</strong> · Tháng này: <strong style="color:var(--text-white);">${stats.monthCases || 348} ca</strong>
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(248,113,113,0.15);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Ca tối khẩn</span>
                <span style="font-size:11px;color:#F87171;font-weight:600;background:rgba(248,113,113,0.12);padding:2px 6px;border-radius:4px;">26.6%</span>
              </div>
              <span class="kpi-value" style="color:#F87171;">${criticalCount}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Đột quỵ, ngừng tuần hoàn, đa chấn thương nguy kịch
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Thời gian tiếp cận trung bình</span>
                <span style="font-size:11px;color:#34D399;font-weight:600;background:rgba(52,211,153,0.12);padding:2px 6px;border-radius:4px;">Đạt chuẩn</span>
              </div>
              <span class="kpi-value" style="color:#38BDF8;">${avgSLA}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Mục tiêu toàn TP: &lt; 10 phút (Nội ô &lt; 8 phút)
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Tỷ lệ bàn giao thành công</span>
                <span style="font-size:11px;color:#94A3B8;font-weight:600;background:rgba(148,163,184,0.12);padding:2px 6px;border-radius:4px;">Toàn mạng</span>
              </div>
              <span class="kpi-value" style="color:var(--text-white);">${successRate}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Số ca hủy / tự chuyển viện: <strong>1.4% (18 ca)</strong>
              </div>
            </div>
          </div>

          <!-- 2. Visual Charts Row (Tonal 24h Bar Chart & Monochromatic Breakdown) -->
          <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-bottom:18px;">
            <!-- Column Chart: Cases by Time Slot (Quieter Monochromatic Style) -->
            <div class="content-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                  <h3 style="color:var(--text-white);font-size:14px;margin:0 0 2px 0;">Phân bố Số ca Tiếp nhận theo Khung giờ trong Ngày</h3>
                  <span style="font-size:12px;color:var(--text-muted);">Cao điểm tập trung khung giờ tan tầm và ban đêm</span>
                </div>
                <span class="badge badge-normal" style="font-size:11px;">24 Giờ</span>
              </div>

              <!-- 24-Hour Distribution Bar Chart -->
              <div style="height:210px;background:var(--bg-elevated);border-radius:6px;padding:16px 10px 8px 10px;border:1px solid var(--border-main);display:flex;flex-direction:column;justify-content:space-between;">
                <div style="flex:1;display:flex;align-items:flex-end;gap:3px;padding:0 2px;">
                  ${[
            { hour: '0h', count: 18, isPeak: false },
            { hour: '1h', count: 14, isPeak: false },
            { hour: '2h', count: 12, isPeak: false },
            { hour: '3h', count: 15, isPeak: false },
            { hour: '4h', count: 25, isPeak: false },
            { hour: '5h', count: 32, isPeak: false },
            { hour: '6h', count: 42, isPeak: false },
            { hour: '7h', count: 56, isPeak: false },
            { hour: '8h', count: 68, isPeak: false },
            { hour: '9h', count: 74, isPeak: false },
            { hour: '10h', count: 65, isPeak: false },
            { hour: '11h', count: 61, isPeak: false },
            { hour: '12h', count: 52, isPeak: false },
            { hour: '13h', count: 48, isPeak: false },
            { hour: '14h', count: 55, isPeak: false },
            { hour: '15h', count: 60, isPeak: false },
            { hour: '16h', count: 78, isPeak: false },
            { hour: '17h', count: 96, isPeak: true },
            { hour: '18h', count: 104, isPeak: true, isMax: true },
            { hour: '19h', count: 88, isPeak: true },
            { hour: '20h', count: 72, isPeak: false },
            { hour: '21h', count: 58, isPeak: false },
            { hour: '22h', count: 52, isPeak: false },
            { hour: '23h', count: 39, isPeak: false }
          ].map(b => {
            const pct = Math.round((b.count / 104) * 100);
            const bg = b.isMax
              ? '#38BDF8'
              : (b.isPeak
                ? 'rgba(56, 189, 248, 0.75)'
                : (b.count >= 60
                  ? '#475569'
                  : '#334155'));
            const valColor = b.isMax ? '#38BDF8' : (b.isPeak ? '#93C5FD' : '#64748B');
            const nextH = (parseInt(b.hour, 10) + 1) % 24;
            const titleText = `Khung giờ ${b.hour} - ${nextH}h: ${b.count} ca cấp cứu${b.isMax ? ' (Đỉnh cao điểm trong ngày)' : ''}`;
            return `
                      <div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;height:100%;justify-content:flex-end;" title="${titleText}">
                        <span style="font-size:8.5px;color:${valColor};font-weight:${b.isPeak ? '700' : '500'};font-family:var(--font-mono);line-height:1;">${b.count}</span>
                        <div style="width:100%;max-width:18px;height:${pct}%;background:${bg};border-radius:2px 2px 0 0;transition:all 0.2s ease;"></div>
                        <span style="font-size:9px;color:${b.isPeak ? '#CBD5E1' : '#64748B'};font-family:var(--font-mono);line-height:1;margin-top:2px;">${b.hour}</span>
                      </div>
                    `;
          }).join('')}
                </div>
              </div>
            </div>

            <!-- Horizontal Progress Bars: Incident Categories Breakdown (Tonal Slate/Cyan) -->
            <div class="content-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 style="color:var(--text-white);font-size:14px;margin:0;">Cơ cấu theo Loại tình huống</h3>
                <span style="font-size:11px;color:var(--text-muted);">1,284 ca</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:12px;font-size:12.5px;">
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Tai nạn giao thông</span>
                    <strong style="color:#38BDF8;font-family:var(--font-mono);">42% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(539 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:42%;height:100%;background:#38BDF8;border-radius:3px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Đột quỵ & Tim mạch cấp</span>
                    <strong style="color:#93C5FD;font-family:var(--font-mono);">26% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(334 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:26%;height:100%;background:rgba(56, 189, 248, 0.75);border-radius:3px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Suy hô hấp / Dị vật đường thở</span>
                    <strong style="color:#CBD5E1;font-family:var(--font-mono);">18% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(231 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:18%;height:100%;background:rgba(56, 189, 248, 0.5);border-radius:3px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Tai nạn sinh hoạt, ngã cao & Khác</span>
                    <strong style="color:var(--text-muted);font-family:var(--font-mono);">14% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(180 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:14%;height:100%;background:rgba(148, 163, 184, 0.35);border-radius:3px;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Bottom Row: Distribution by District and Destination Hospital -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <!-- District Distribution (Monochrome Progression) -->
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Phân bố Ca tiếp nhận theo Địa bàn Phường / Xã</h3>
              <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-white);">Địa bàn P. Tân An, Xuân Khánh, Hưng Lợi</span>
                    <strong style="color:#38BDF8;font-family:var(--font-mono);">54% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(693 ca)</span></strong>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:54%;height:100%;background:#38BDF8;"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-white);">Địa bàn P. Hưng Phú, Lê Bình, Ba Láng</span>
                    <strong style="color:#93C5FD;font-family:var(--font-mono);">18% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(231 ca)</span></strong>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:18%;height:100%;background:rgba(56, 189, 248, 0.7);"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-white);">Địa bàn P. Trà Nóc, An Thới, Bình Thủy</span>
                    <strong style="color:#CBD5E1;font-family:var(--font-mono);">14% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(180 ca)</span></strong>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:14%;height:100%;background:rgba(56, 189, 248, 0.5);"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-white);">Địa bàn P. Châu Văn Liêm, Thới Hòa, Thốt Nốt</span>
                    <strong style="color:var(--text-muted);font-family:var(--font-mono);">14% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(180 ca)</span></strong>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:14%;height:100%;background:rgba(148, 163, 184, 0.35);"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top Receiving Hospitals (Quiet Clean Ranking) -->
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Top Bệnh viện Tiếp nhận Ca Cấp cứu</h3>
              <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-white);width:22px;height:22px;border-radius:4px;background:rgba(255,255,255,0.08);display:inline-flex;align-items:center;justify-content:center;font-size:11px;">01</span>
                    <span style="color:var(--text-white);font-weight:500;">BV Đa khoa thành phố Cần Thơ</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <strong style="color:var(--text-white);font-family:var(--font-mono);">${(582).toLocaleString()} ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(45.3%)</span>
                  </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-slate);width:22px;height:22px;border-radius:4px;background:rgba(255,255,255,0.05);display:inline-flex;align-items:center;justify-content:center;font-size:11px;">02</span>
                    <span style="color:var(--text-white);font-weight:500;">Bệnh viện Đa khoa Trung ương Cần Thơ</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <strong style="color:var(--text-white);font-family:var(--font-mono);">${(416).toLocaleString()} ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(32.4%)</span>
                  </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-slate);width:22px;height:22px;border-radius:4px;background:rgba(255,255,255,0.05);display:inline-flex;align-items:center;justify-content:center;font-size:11px;">03</span>
                    <span style="color:var(--text-white);font-weight:500;">BV Nhi đồng Cần Thơ</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <strong style="color:var(--text-white);font-family:var(--font-mono);">${(148).toLocaleString()} ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(11.5%)</span>
                  </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-slate);width:22px;height:22px;border-radius:4px;background:rgba(255,255,255,0.05);display:inline-flex;align-items:center;justify-content:center;font-size:11px;">04</span>
                    <span style="color:var(--text-white);font-weight:500;">BV Tim mạch & TTYT Khu vực</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <strong style="color:var(--text-white);font-family:var(--font-mono);">${(138).toLocaleString()} ca</strong>
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
          exportTitle: 'Báo cáo Chi tiết Số ca Tiếp nhận Cấp cứu Ngoại viện thành phố Cần Thơ',
          enableExport: true,
          showSortSelect: true,
          searchPlaceholder: 'Tìm mã ca, tình huống, nhóm độ tuổi, xe, bệnh viện...',
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
              render: item => `<span style="font-family:var(--font-mono);font-size:12px;color:var(--text-white);white-space:nowrap;display:inline-block;">${this.formatDateTime(item.createdAt)}</span>`
            },
            {
              key: 'patientAgeGroupText',
              title: 'Nạn nhân',
              sortable: true,
              render: item => `<strong>${item.patientAgeGroupText || 'Người trưởng thành'}</strong> <span style="font-size:11.5px;color:var(--text-muted);">(${item.patientGender || 'Nam'})</span>`
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
    // --- BÁO CÁO ĐO LƯỜNG THỜI GIAN ĐÁP ỨNG & CHUẨN SLA CẤP CỨU ---
    // ==========================================
    renderReportSlaView(container, activeTab = 'overview') {
      const state = window.StateManager.getState();
      const stats = state.stats || {};

      // Unified response timeline dataset with full response milestones and delay reasons
      const slaRecords = [
        {
          code: 'CC-261002-001',
          createdAt: '2026-10-02T09:42:15',
          patientAgeGroup: 'ELDERLY',
          patientAgeGroupText: 'Người cao tuổi',
          patientGender: 'Nam',
          incidentName: 'Đột quỵ não cấp (Liệt nửa người)',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-012.34',
          hospitalName: 'BV Đa khoa thành phố Cần Thơ',
          district: 'P. Tân An',
          address: 'Số 45 Đường Hòa Bình, P. Tân An',
          callToDispatch: '42s',
          dispatchToMobile: '1.2 phút',
          callToScene: '4.8 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian vàng',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261002-002',
          createdAt: '2026-10-02T08:50:30',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nữ',
          incidentName: 'Tai nạn giao thông đa chấn thương',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-001.15',
          hospitalName: 'BV Đa khoa TW Cần Thơ',
          district: 'P. Hưng Lợi',
          address: 'Ngã tư 30/4 - Nguyễn Văn Linh',
          callToDispatch: '38s',
          dispatchToMobile: '1.5 phút',
          callToScene: '5.4 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian vàng',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261002-003',
          createdAt: '2026-10-02T08:15:00',
          patientAgeGroup: 'ELDERLY',
          patientAgeGroupText: 'Người cao tuổi',
          patientGender: 'Nam',
          incidentName: 'Ngừng tuần hoàn ngoại viện',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-016.88',
          hospitalName: 'BV Đa khoa thành phố Cần Thơ',
          district: 'P. An Thới',
          address: 'Đường CMT8, P. An Thới',
          callToDispatch: '30s',
          dispatchToMobile: '1.1 phút',
          callToScene: '6.1 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian vàng',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261002-004',
          createdAt: '2026-10-02T07:40:12',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Suy hô hấp cấp / Dị vật đường thở',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-011.15',
          hospitalName: 'BV Đa khoa thành phố Cần Thơ',
          district: 'P. Trà Nóc',
          address: 'KCN Trà Nóc 1, P. Trà Nóc',
          callToDispatch: '45s',
          dispatchToMobile: '1.6 phút',
          callToScene: '7.2 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian nội ô',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261002-005',
          createdAt: '2026-10-02T07:10:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Tai nạn lao động sập giàn giáo',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-018.89',
          hospitalName: 'TTYT Khu vực Ô Môn',
          district: 'P. Châu Văn Liêm',
          address: 'Quốc lộ 91, P. Châu Văn Liêm',
          callToDispatch: '50s',
          dispatchToMobile: '1.4 phút',
          callToScene: '7.8 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'NEAR',
          slaEvaluation: 'Cận chuẩn',
          delayReason: 'Gần ngưỡng 8 phút do phải tránh công trường',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261002-006',
          createdAt: '2026-10-02T06:45:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'TNGT va chạm xe tải lớn dốc cầu',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-002.15',
          hospitalName: 'BV Đa khoa TW Cần Thơ',
          district: 'P. Hưng Phú',
          address: 'Dốc cầu Hưng Lợi, P. Hưng Phú',
          callToDispatch: '55s',
          dispatchToMobile: '2.1 phút',
          callToScene: '10.4 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'BREACH',
          slaEvaluation: 'Chậm trễ',
          delayReason: 'Ùn tắc dốc cầu Hưng Lợi giờ cao điểm (+3.2 phút)',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261001-011',
          createdAt: '2026-10-01T21:15:00',
          patientAgeGroup: 'ELDERLY',
          patientAgeGroupText: 'Người cao tuổi',
          patientGender: 'Nữ',
          incidentName: 'Cơn đau thắt ngực nhồi máu cơ tim',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-011.15',
          hospitalName: 'BV Tim mạch thành phố Cần Thơ',
          district: 'P. An Khánh',
          address: 'Chợ An Khánh, P. An Khánh',
          callToDispatch: '35s',
          dispatchToMobile: '1.2 phút',
          callToScene: '4.8 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian vàng',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261001-010',
          createdAt: '2026-10-01T19:30:00',
          patientAgeGroup: 'CHILD',
          patientAgeGroupText: 'Trẻ em',
          patientGender: 'Nam',
          incidentName: 'Co giật sốt cao trẻ em',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-018.89',
          hospitalName: 'Bệnh viện Nhi đồng Cần Thơ',
          district: 'P. An Thới',
          address: 'Đường CMT8, P. An Thới',
          callToDispatch: '40s',
          dispatchToMobile: '1.3 phút',
          callToScene: '5.9 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian tiếp cận',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261001-009',
          createdAt: '2026-10-01T17:45:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Điện giật bất tỉnh trong hẻm',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-012.34',
          hospitalName: 'BV Đa khoa thành phố Cần Thơ',
          district: 'P. Xuân Khánh',
          address: 'Hẻm 51 Đường 3/2, P. Xuân Khánh',
          callToDispatch: '58s',
          dispatchToMobile: '2.3 phút',
          callToScene: '9.2 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'BREACH',
          slaEvaluation: 'Chậm trễ',
          delayReason: 'Hẻm sâu xe cứu thương khó vào, phải đi bộ 150m (+2.5 phút)',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261001-008',
          createdAt: '2026-10-01T16:20:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nữ',
          incidentName: 'Sản phụ chuyển dạ sinh rớt',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-001.15',
          hospitalName: 'BV Phụ sản thành phố Cần Thơ',
          district: 'P. Ba Láng',
          address: 'Đường Trần Hưng Đạo, P. Ba Láng',
          callToDispatch: '42s',
          dispatchToMobile: '1.4 phút',
          callToScene: '7.1 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian tiếp cận',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261001-007',
          createdAt: '2026-10-01T14:10:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Ngộ độc thực phẩm nặng, tụt HA',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-016.88',
          hospitalName: 'BV Đa khoa TW Cần Thơ',
          district: 'P. Lê Bình',
          address: 'Chợ nổi Cái Răng, P. Lê Bình',
          callToDispatch: '44s',
          dispatchToMobile: '1.5 phút',
          callToScene: '6.8 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian tiếp cận',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261001-006',
          createdAt: '2026-10-01T11:05:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'TNGT va chạm liên hoàn Quốc lộ 91',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-019.99',
          hospitalName: 'BV Đa khoa thành phố Cần Thơ',
          district: 'P. Thốt Nốt',
          address: 'Km 38 Quốc lộ 91, P. Thốt Nốt',
          callToDispatch: '68s',
          dispatchToMobile: '2.0 phút',
          callToScene: '13.2 phút',
          slaTarget: '< 12.0 phút',
          slaStatus: 'BREACH',
          slaEvaluation: 'Chậm trễ',
          delayReason: 'Mưa to tầm tã, mặt đường ngập sâu (+3.5 phút)',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261001-005',
          createdAt: '2026-10-01T09:15:00',
          patientAgeGroup: 'ELDERLY',
          patientAgeGroupText: 'Người cao tuổi',
          patientGender: 'Nữ',
          incidentName: 'Hạ đường huyết hôn mê sâu',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-012.34',
          hospitalName: 'BV Đa khoa thành phố Cần Thơ',
          district: 'P. An Hòa',
          address: 'Đường Nguyễn Văn Cừ, P. An Hòa',
          callToDispatch: '32s',
          dispatchToMobile: '1.1 phút',
          callToScene: '4.9 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian vàng',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261001-004',
          createdAt: '2026-10-01T07:20:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Bỏng nước sôi diện tích 25%',
          severity: 'ROUTINE',
          severityText: 'Tiêu chuẩn',
          vehiclePlate: '65A-001.15',
          hospitalName: 'BV Đa khoa thành phố Cần Thơ',
          district: 'P. An Cư',
          address: 'Đường Ngô Quyền, P. An Cư',
          callToDispatch: '40s',
          dispatchToMobile: '1.4 phút',
          callToScene: '5.2 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian tiếp cận',
          status: 'COMPLETED'
        },
        {
          code: 'CC-261001-003',
          createdAt: '2026-10-01T05:30:00',
          patientAgeGroup: 'ELDERLY',
          patientAgeGroupText: 'Người cao tuổi',
          patientGender: 'Nữ',
          incidentName: 'Hen phế quản cấp, SpO2 giảm 84%',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-011.15',
          hospitalName: 'BV Đa khoa thành phố Cần Thơ',
          district: 'P. Tân An',
          address: 'Đường Hai Bà Trưng, P. Tân An',
          callToDispatch: '33s',
          dispatchToMobile: '1.0 phút',
          callToScene: '4.5 phút',
          slaTarget: '< 8.0 phút',
          slaStatus: 'MET',
          slaEvaluation: 'Đạt chuẩn',
          delayReason: 'Đạt chuẩn thời gian vàng',
          status: 'COMPLETED'
        }
      ];

      container.innerHTML = `
        <div class="view-container-full">
          <!-- Header Bar with Filter controls -->
          <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:14px;flex-wrap:wrap;gap:12px;">
            <!-- Action & Period controls -->
            <div style="display:flex;align-items:center;gap:10px;">
              <select class="form-select form-select-sm" id="select-sla-period" style="background:var(--bg-elevated);color:var(--text-white);border:1px solid var(--border-main);border-radius:4px;padding:5px 10px;font-size:12px;outline:none;">
                <option value="today">Hôm nay (02/10/2026)</option>
                <option value="week">Tuần này (Tuần 40)</option>
                <option value="month" selected>Tháng 10/2026 (Toàn mạng)</option>
                <option value="quarter">Quý 3/2026</option>
              </select>
              <button class="btn btn-default btn-sm" id="btn-export-sla-quick" title="Xuất báo cáo thời gian đáp ứng">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Xuất Báo Cáo</span>
              </button>
            </div>
          </div>

          <!-- Internal Tab Navigation (2 Tabs) -->
          <div style="display:flex;gap:8px;border-bottom:1px solid var(--border-main);padding-bottom:10px;margin-bottom:16px;">
            <button class="btn ${activeTab === 'overview' ? 'btn-emergency' : 'btn-default'} btn-sm report-tab-btn" data-tab="overview">
              ${window.CCNV_UI.ICONS.barChart}
              <span>Tổng quan chuỗi mốc thời gian</span>
            </button>
            <button class="btn ${activeTab === 'detail' ? 'btn-emergency' : 'btn-default'} btn-sm report-tab-btn" data-tab="detail">
              ${window.CCNV_UI.ICONS.layers}
              <span>Chi tiết ca & Đánh giá thời gian</span>
              <span class="badge ${activeTab === 'detail' ? 'badge-emergency' : 'badge-normal'}" style="margin-left:4px;padding:1px 6px;font-size:11px;">${slaRecords.length}</span>
            </button>
          </div>

          <!-- Tab Content Mount Container -->
          <div id="report-sla-pane"></div>
        </div>
      `;

      // Quick export handler
      container.querySelector('#btn-export-sla-quick')?.addEventListener('click', () => {
        if (window.CCNV_UI?.Toast) {
          window.CCNV_UI.Toast.show('XUẤT BÁO CÁO', 'Đã tạo và tải xuống bản báo cáo Đo lường Thời gian Đáp ứng Cấp cứu thành phố Cần Thơ');
        }
      });

      // Tab switcher event handlers
      container.querySelectorAll('.report-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-tab');
          this.renderReportSlaView(container, tab);
        });
      });

      const pane = container.querySelector('#report-sla-pane');
      if (!pane) return;

      // ==========================================
      // TAB 1: TỔNG QUAN CHUỖI MỐC THỜI GIAN (KPIs, Chuỗi Mốc, Nguyên nhân vi phạm, Phân bổ địa bàn)
      // ==========================================
      if (activeTab === 'overview') {
        const avgCallToScene = '7.4 phút';
        const avgCallToDispatch = '52 giây';
        const avgDispatchToMobile = '1.8 phút';
        const slaPassRate = '94.2%';

        pane.innerHTML = `
          <!-- 1. Quick Stats & Response KPI Cards Grid (Quieter Tonal Cards) -->
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;margin-bottom:18px;">
            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Thời gian tiếp cận trung bình</span>
                <span style="font-size:11px;color:#34D399;font-weight:600;background:rgba(52,211,153,0.12);padding:2px 6px;border-radius:4px;">Đạt chuẩn</span>
              </div>
              <span class="kpi-value" style="color:#38BDF8;">${avgCallToScene}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Mục tiêu nội ô: <strong style="color:var(--text-white);">&lt; 8.0 phút</strong> · Ngoại ô: <strong style="color:var(--text-white);">&lt; 12.0 phút</strong>
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Thời gian phát lệnh điều xe</span>
                <span style="font-size:11px;color:#94A3B8;font-weight:600;background:rgba(148,163,184,0.12);padding:2px 6px;border-radius:4px;">-8.5s so tháng trước</span>
              </div>
              <span class="kpi-value" style="color:var(--text-white);">${avgCallToDispatch}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Mục tiêu điều phối viên: <strong style="color:var(--text-white);">&lt; 60 giây</strong> từ khi nhấc chuông
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Thời gian xuất xe rời trạm</span>
                <span style="font-size:11px;color:#94A3B8;font-weight:600;background:rgba(148,163,184,0.12);padding:2px 6px;border-radius:4px;">Chuẩn kíp trực</span>
              </div>
              <span class="kpi-value" style="color:var(--text-white);">${avgDispatchToMobile}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Kíp trực kiểm tra xe & xuất phát: <strong style="color:var(--text-white);">&lt; 2.0 phút</strong>
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Tỷ lệ đạt chuẩn thời gian vàng</span>
                <span style="font-size:11px;color:#34D399;font-weight:600;background:rgba(52,211,153,0.12);padding:2px 6px;border-radius:4px;">1,210 / 1,284 ca</span>
              </div>
              <span class="kpi-value" style="color:#34D399;">${slaPassRate}</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Số ca vượt chuẩn: <strong style="color:#F87171;">74 ca (5.8%)</strong>
              </div>
            </div>
          </div>

          <!-- 2. Row 1: Timeline Progression Stages & Delay Causes Breakdown -->
          <div style="display:grid;grid-template-columns:1.65fr 1fr;gap:16px;margin-bottom:18px;">
            <!-- Progression Stages Card (Unified Serene Healthcare Timeline) -->
            <div class="content-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                  <h3 style="color:var(--text-white);font-size:14px;margin:0 0 2px 0;">Phân Rã Chuỗi Thời Gian Cấp Cứu Ngoại Viện</h3>
                  <span style="font-size:12px;color:var(--text-muted);">Đo lường chi tiết từng mốc từ tiếp nhận cuộc gọi đến bàn giao tại Khoa Cấp cứu</span>
                </div>
                <span class="badge badge-normal" style="font-size:11px;">6 Mốc Nghiệp Vụ</span>
              </div>

              <!-- Visual Stages Progression (Calm Tonal Blue System) -->
              <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
                <!-- Stage 1: T0 -> T1 -->
                <div style="background:var(--bg-elevated);border-radius:6px;padding:9px 12px;border:1px solid var(--border-main);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="width:20px;height:20px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-white);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--font-mono);">1</span>
                      <strong style="color:var(--text-white);font-weight:500;">Tiếp nhận & phân loại cuộc gọi</strong>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">52 giây</span>
                      <span style="font-size:11px;color:var(--text-muted);">(Chuẩn &lt; 60 giây)</span>
                      <span class="badge" style="background:rgba(52,211,153,0.1);color:#34D399;font-size:10.5px;padding:1px 6px;border-radius:4px;">98.2% Đạt</span>
                    </div>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:24%;height:100%;background:#38BDF8;border-radius:3px;"></div>
                  </div>
                </div>

                <!-- Stage 2: T1 -> T2 -->
                <div style="background:var(--bg-elevated);border-radius:6px;padding:9px 12px;border:1px solid var(--border-main);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="width:20px;height:20px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-white);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--font-mono);">2</span>
                      <strong style="color:var(--text-white);font-weight:500;">Kíp trực xuất xe rời trạm</strong>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">1.8 phút</span>
                      <span style="font-size:11px;color:var(--text-muted);">(Chuẩn &lt; 2.0 phút)</span>
                      <span class="badge" style="background:rgba(52,211,153,0.1);color:#34D399;font-size:10.5px;padding:1px 6px;border-radius:4px;">96.5% Đạt</span>
                    </div>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:42%;height:100%;background:#38BDF8;border-radius:3px;"></div>
                  </div>
                </div>

                <!-- Stage 3: T2 -> T3 -->
                <div style="background:var(--bg-elevated);border-radius:6px;padding:9px 12px;border:1px solid var(--border-main);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="width:20px;height:20px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-white);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--font-mono);">3</span>
                      <strong style="color:var(--text-white);font-weight:500;">Di chuyển đến hiện trường</strong>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">4.7 phút</span>
                      <span style="font-size:11px;color:var(--text-muted);">(Chuẩn &lt; 5.0 phút)</span>
                      <span class="badge" style="background:rgba(52,211,153,0.1);color:#34D399;font-size:10.5px;padding:1px 6px;border-radius:4px;">94.8% Đạt</span>
                    </div>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:68%;height:100%;background:#38BDF8;border-radius:3px;"></div>
                  </div>
                </div>

                <!-- Stage 4: T3 -> T4 -->
                <div style="background:var(--bg-elevated);border-radius:6px;padding:9px 12px;border:1px solid var(--border-main);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="width:20px;height:20px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-white);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--font-mono);">4</span>
                      <strong style="color:var(--text-white);font-weight:500;">Sơ cấp cứu tại hiện trường</strong>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">8.5 phút</span>
                      <span style="font-size:11px;color:var(--text-muted);">(Chuẩn &lt; 10.0 phút)</span>
                      <span class="badge" style="background:rgba(52,211,153,0.1);color:#34D399;font-size:10.5px;padding:1px 6px;border-radius:4px;">93.1% Đạt</span>
                    </div>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:78%;height:100%;background:#38BDF8;border-radius:3px;"></div>
                  </div>
                </div>

                <!-- Stage 5: T4 -> T5 -->
                <div style="background:var(--bg-elevated);border-radius:6px;padding:9px 12px;border:1px solid var(--border-main);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="width:20px;height:20px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-white);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--font-mono);">5</span>
                      <strong style="color:var(--text-white);font-weight:500;">Vận chuyển đến bệnh viện</strong>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">12.2 phút</span>
                      <span style="font-size:11px;color:var(--text-muted);">(Chuẩn &lt; 15.0 phút)</span>
                      <span class="badge" style="background:rgba(52,211,153,0.1);color:#34D399;font-size:10.5px;padding:1px 6px;border-radius:4px;">95.0% Đạt</span>
                    </div>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:85%;height:100%;background:#38BDF8;border-radius:3px;"></div>
                  </div>
                </div>

                <!-- Stage 6: T5 -> T6 -->
                <div style="background:var(--bg-elevated);border-radius:6px;padding:9px 12px;border:1px solid var(--border-main);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="width:20px;height:20px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-white);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--font-mono);">6</span>
                      <strong style="color:var(--text-white);font-weight:500;">Bàn giao tại khoa cấp cứu</strong>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">7.6 phút</span>
                      <span style="font-size:11px;color:var(--text-muted);">(Chuẩn &lt; 10.0 phút)</span>
                      <span class="badge" style="background:rgba(52,211,153,0.1);color:#34D399;font-size:10.5px;padding:1px 6px;border-radius:4px;">97.4% Đạt</span>
                    </div>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:72%;height:100%;background:#38BDF8;border-radius:3px;"></div>
                  </div>
                </div>
              </div>

              <!-- Summary Cycle Footer (Quiet Neutral) -->
              <div style="margin-top:12px;padding:10px 14px;background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12.5px;color:var(--text-white);font-weight:500;">Tổng thời gian toàn trình ca cấp cứu:</span>
                <span style="font-size:13px;font-family:var(--font-mono);font-weight:600;color:#38BDF8;">35.7 phút <span style="font-size:11px;color:var(--text-muted);font-weight:normal;">(Chuẩn toàn trình &lt; 45.0 phút)</span></span>
              </div>
            </div>

            <!-- Delay Causes Breakdown Card -->
            <div class="content-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 style="color:var(--text-white);font-size:14px;margin:0;">Phân Tích Nguyên Nhân Chậm Trễ</h3>
                <span style="font-size:11px;color:var(--text-muted);">74 ca vi phạm</span>
              </div>

              <div style="display:flex;flex-direction:column;gap:12px;font-size:12.5px;">
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Ùn tắc giao thông giờ cao điểm</span>
                    <strong style="color:#F87171;font-family:var(--font-mono);">46% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(34 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:46%;height:100%;background:#F87171;border-radius:3px;"></div>
                  </div>
                  <span style="font-size:11px;color:var(--text-muted);margin-top:2px;display:block;">Đoạn dốc cầu Hưng Lợi, đường 30/4, CMT8</span>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Hẻm sâu, số nhà nhánh khó định vị</span>
                    <strong style="color:#FBBF24;font-family:var(--font-mono);">28% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(21 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:28%;height:100%;background:#FBBF24;border-radius:3px;"></div>
                  </div>
                  <span style="font-size:11px;color:var(--text-muted);margin-top:2px;display:block;">Khu vực P. Xuân Khánh, An Khánh, Ba Láng</span>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Thời tiết mưa giông, triều cường ngập</span>
                    <strong style="color:#CBD5E1;font-family:var(--font-mono);">16% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(12 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:16%;height:100%;background:rgba(148, 163, 184, 0.6);border-radius:3px;"></div>
                  </div>
                  <span style="font-size:11px;color:var(--text-muted);margin-top:2px;display:block;">Tuyến QL91, đường Bùi Hữu Nghĩa ngập sâu</span>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Người gọi báo sai vị trí / nghẽn mạng</span>
                    <strong style="color:var(--text-muted);font-family:var(--font-mono);">10% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(7 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:10%;height:100%;background:rgba(148, 163, 184, 0.35);border-radius:3px;"></div>
                  </div>
                  <span style="font-size:11px;color:var(--text-muted);margin-top:2px;display:block;">Mất sóng tạm thời hoặc máy bận khi gọi lại</span>
                </div>
              </div>

              <!-- Recommendation Note (Restrained Card) -->
              <div style="margin-top:14px;padding:10px 12px;background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;font-size:11.5px;color:var(--text-muted);line-height:1.5;">
                <strong style="color:#FBBF24;">Khuyến nghị điều hành:</strong> Bố trí xe vệ tinh ứng trực sát chân cầu Hưng Lợi và tăng cường hướng dẫn người dân ghim vị trí GPS qua App Người dân CCNV.
              </div>
            </div>
          </div>

          <!-- 3. Row 2: Response by Ward & Response by Clinical Priority -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <!-- Ward Response Card (Monochrome Blue/Slate) -->
            <div class="content-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="color:var(--text-white);font-size:14px;margin:0;">Tỷ Lệ Đạt Chuẩn Thời Gian theo Địa Bàn Phường / Xã</h3>
                <span style="font-size:11px;color:#34D399;">Toàn mạng &gt; 90%</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-white);">Địa bàn P. Tân An, An Lạc, Xuân Khánh (Trung tâm)</span>
                    <strong style="color:#38BDF8;font-family:var(--font-mono);">96.5% <span style="font-size:11px;color:var(--text-muted);font-weight:normal;">(TB: 6.2 phút · Chuẩn: &lt; 8.0p)</span></strong>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:96.5%;height:100%;background:#38BDF8;"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-white);">Địa bàn P. Hưng Phú, Lê Bình, Ba Láng (Nam Sông)</span>
                    <strong style="color:#93C5FD;font-family:var(--font-mono);">93.8% <span style="font-size:11px;color:var(--text-muted);font-weight:normal;">(TB: 7.1 phút · Chuẩn: &lt; 8.0p)</span></strong>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:93.8%;height:100%;background:rgba(56, 189, 248, 0.85);"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-white);">Địa bàn P. Trà Nóc, An Thới, Bình Thủy</span>
                    <strong style="color:#CBD5E1;font-family:var(--font-mono);">92.4% <span style="font-size:11px;color:var(--text-muted);font-weight:normal;">(TB: 7.6 phút · Chuẩn: &lt; 8.0p)</span></strong>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:92.4%;height:100%;background:rgba(56, 189, 248, 0.7);"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-white);">Địa bàn P. Châu Văn Liêm, Thới Hòa</span>
                    <strong style="color:var(--text-muted);font-family:var(--font-mono);">88.6% <span style="font-size:11px;color:var(--text-muted);font-weight:normal;">(TB: 9.8 phút · Chuẩn: &lt; 12.0p)</span></strong>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:88.6%;height:100%;background:rgba(56, 189, 248, 0.5);"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-white);">Địa bàn P. Thốt Nốt, Trung Kiên & các xã ngoại thành</span>
                    <strong style="color:var(--text-muted);font-family:var(--font-mono);">85.2% <span style="font-size:11px;color:var(--text-muted);font-weight:normal;">(TB: 11.4 phút · Chuẩn: &lt; 12.0p)</span></strong>
                  </div>
                  <div style="height:5px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:85.2%;height:100%;background:rgba(148, 163, 184, 0.35);"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Severity Clinical Priority Card (Refined Medical Cards) -->
            <div class="content-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="color:var(--text-white);font-size:14px;margin:0;">Tốc Độ Đáp Ứng theo Mức Độ Ưu Tiên Lâm Sàng</h3>
                <span class="badge badge-normal" style="font-size:11px;">Phân loại ưu tiên cấp cứu</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
                <div style="padding:10px 12px;background:rgba(248,113,113,0.04);border:1px solid rgba(248,113,113,0.18);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="badge" style="background:rgba(248,113,113,0.15);color:#F87171;border:1px solid rgba(248,113,113,0.25);font-size:11px;font-weight:600;">Tối khẩn</span>
                      <strong style="color:var(--text-white);">Đột quỵ não, ngừng tim, đa chấn thương</strong>
                    </div>
                    <span style="font-size:11.5px;color:var(--text-muted);display:block;margin-top:2px;">Cam kết tiếp cận &lt; 6.0 phút</span>
                  </div>
                  <div style="text-align:right;">
                    <strong style="font-family:var(--font-mono);font-size:14px;color:#F87171;">5.8 phút</strong>
                    <div style="font-size:11px;color:#34D399;font-weight:500;">97.8% Đạt chuẩn</div>
                  </div>
                </div>

                <div style="padding:10px 12px;background:rgba(251,191,36,0.03);border:1px solid rgba(251,191,36,0.18);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="badge" style="background:rgba(251,191,36,0.12);color:#FBBF24;border:1px solid rgba(251,191,36,0.22);font-weight:600;font-size:11px;">Khẩn cấp</span>
                      <strong style="color:var(--text-white);">Suy hô hấp, gãy xương lớn, chấn thương sọ não</strong>
                    </div>
                    <span style="font-size:11.5px;color:var(--text-muted);display:block;margin-top:2px;">Cam kết tiếp cận &lt; 8.0 phút</span>
                  </div>
                  <div style="text-align:right;">
                    <strong style="font-family:var(--font-mono);font-size:14px;color:#FBBF24;">7.4 phút</strong>
                    <div style="font-size:11px;color:#34D399;font-weight:500;">94.1% Đạt chuẩn</div>
                  </div>
                </div>

                <div style="padding:10px 12px;background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="badge badge-normal" style="font-size:11px;">Tiêu chuẩn</span>
                      <strong style="color:var(--text-white);">Cấp cứu thông thường, chuyển viện theo dõi</strong>
                    </div>
                    <span style="font-size:11.5px;color:var(--text-muted);display:block;margin-top:2px;">Cam kết tiếp cận &lt; 12.0 phút</span>
                  </div>
                  <div style="text-align:right;">
                    <strong style="font-family:var(--font-mono);font-size:14px;color:var(--text-white);">9.8 phút</strong>
                    <div style="font-size:11px;color:#34D399;font-weight:500;">92.3% Đạt chuẩn</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // ==========================================
      // TAB 2: CHI TIẾT CA & ĐÁNH GIÁ THỜI GIAN (DataTable, Search, Sort, Filter, Export Excel)
      // ==========================================
      else if (activeTab === 'detail') {
        pane.innerHTML = `
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="report-sla-detail-table-mount"></div>
          </div>
        `;

        new window.CCNV_UI.DataTable({
          containerId: 'report-sla-detail-table-mount',
          data: slaRecords,
          pageSize: 10,
          exportTitle: 'Báo cáo Đo lường Thời gian Đáp ứng Chuẩn Cấp cứu Ngoại viện thành phố Cần Thơ',
          enableExport: true,
          showSortSelect: true,
          searchPlaceholder: 'Tìm mã ca, tình huống, nhóm độ tuổi, xe cấp cứu, địa bàn...',
          defaultSortKey: 'createdAt',
          defaultSortOrder: 'desc',
          filterOptions: [
            { label: 'Tất cả trạng thái', value: 'ALL', filterFn: () => true },
            { label: 'Đạt chuẩn', value: 'MET', filterFn: item => item.slaStatus === 'MET' },
            { label: 'Cận chuẩn', value: 'NEAR', filterFn: item => item.slaStatus === 'NEAR' },
            { label: 'Chậm trễ', value: 'BREACH', filterFn: item => item.slaStatus === 'BREACH' },
            { label: 'Tối khẩn', value: 'CRITICAL', filterFn: item => item.severity === 'CRITICAL' },
            { label: 'Khẩn cấp', value: 'EMERGENCY', filterFn: item => item.severity === 'EMERGENCY' }
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
              render: item => `<span style="font-family:var(--font-mono);font-size:12px;color:var(--text-white);white-space:nowrap;display:inline-block;">${this.formatDateTime(item.createdAt)}</span>`
            },
            {
              key: 'patientAgeGroupText',
              title: 'Nạn nhân',
              sortable: true,
              render: item => `<strong>${item.patientAgeGroupText || 'Người trưởng thành'}</strong> <span style="font-size:11.5px;color:var(--text-muted);">(${item.patientGender || 'Nam'})</span>`
            },
            {
              key: 'incidentName',
              title: 'Tình huống',
              sortable: true,
              render: item => `<span style="font-size:12px;">${item.incidentName}</span>`
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
              key: 'district',
              title: 'Địa bàn (Phường/Xã)',
              sortable: true,
              render: item => `<span style="font-size:12px;">${item.district}</span>`
            },
            {
              key: 'callToDispatch',
              title: 'Phát lệnh',
              sortable: false,
              render: item => `<span style="font-family:var(--font-mono);color:#60A5FA;font-weight:600;">${item.callToDispatch}</span>`
            },
            {
              key: 'callToScene',
              title: 'Tiếp cận',
              sortable: true,
              render: item => {
                const color = item.slaStatus === 'MET' ? '#10B981' : (item.slaStatus === 'NEAR' ? '#F59E0B' : '#EF4444');
                return `<strong style="font-family:var(--font-mono);color:${color};font-size:12.5px;">${item.callToScene}</strong>`;
              }
            },
            {
              key: 'slaStatus',
              title: 'Đánh giá thời gian',
              sortable: true,
              render: item => {
                if (item.slaStatus === 'MET') {
                  return `<span class="badge" style="background:rgba(16,185,129,0.18);color:#10B981;border:1px solid rgba(16,185,129,0.3);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;display:inline-flex;align-items:center;gap:4px;">${window.CCNV_UI?.ICONS?.check || ''}<span>Đạt chuẩn</span></span>`;
                }
                if (item.slaStatus === 'NEAR') {
                  return `<span class="badge" style="background:rgba(245,158,11,0.18);color:#F59E0B;border:1px solid rgba(245,158,11,0.3);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;display:inline-flex;align-items:center;gap:4px;">${window.CCNV_UI?.ICONS?.alertTriangle || ''}<span>Cận chuẩn</span></span>`;
                }
                return `<span class="badge" style="background:rgba(239,68,68,0.18);color:#EF4444;border:1px solid rgba(239,68,68,0.3);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;display:inline-flex;align-items:center;gap:4px;">${window.CCNV_UI?.ICONS?.x || ''}<span>Chậm trễ</span></span>`;
              }
            },
            {
              key: 'delayReason',
              title: 'Ghi chú / Nguyên nhân',
              sortable: false,
              render: item => {
                const isDelay = item.slaStatus === 'BREACH';
                return `<span style="font-size:11.5px;color:${isDelay ? '#FCA5A5' : 'var(--text-muted)'};">${item.delayReason}</span>`;
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
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
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
          { key: 'station', title: 'Trạm trực', sortable: true, render: v => v.station || 'BVĐK thành phố Cần Thơ' },
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
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
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
        searchPlaceholder: 'Tìm tên bệnh viện, địa chỉ...',
        defaultSortKey: 'name',
        defaultSortOrder: 'asc',
        columns: [
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
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
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
        searchPlaceholder: 'Tìm mã, tên tình huống, triệu chứng...',
        defaultSortKey: 'code',
        defaultSortOrder: 'asc',
        columns: [
          { key: 'code', title: 'Mã tình huống', sortable: true, render: i => `<strong style="font-family:var(--font-mono);color:#93C5FD;">${i.code}</strong>` },
          { key: 'name', title: 'Tên tình huống cấp cứu', sortable: true, render: i => `<strong style="color:var(--text-white);">${i.name}</strong>` },
          {
            key: 'severity',
            title: 'Mức độ ưu tiên',
            sortable: true,
            render: i => {
              if (i.severity === 'CRITICAL') return `<span class="badge badge-emergency" style="background:rgba(239, 68, 68, 0.2);color:#F87171;border:1px solid #DC2626;">Tối khẩn</span>`;
              if (i.severity === 'EMERGENCY') return `<span class="badge" style="background:rgba(245, 158, 11, 0.2);color:#FBBF24;border:1px solid #D97706;">Khẩn cấp</span>`;
              return `<span class="badge badge-normal" style="background:rgba(16, 185, 129, 0.2);color:#34D399;border:1px solid #059669;">Thường</span>`;
            }
          },
          {
            key: 'suggestedType',
            title: 'Xe đề xuất',
            sortable: true,
            render: i => `<span class="status-pill status-pill-completed" style="font-weight:600;">${i.suggestedType || 'Type B'}</span>`
          },
          {
            key: 'guide',
            title: 'Hướng dẫn sơ cứu ban đầu',
            sortable: false,
            render: i => `<span style="font-size:12px;color:var(--text-slate);line-height:1.4;display:block;">${i.guide || '-'}</span>`
          }
        ]
      }).render();

      container.querySelector('#btn-add-cat-incident')?.addEventListener('click', () => {
        window.CCNV_UI.Toast.show('Thêm tình huống', 'Mở cấu hình tình huống cấp cứu');
      });
    }

    renderCatStatusesView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">1. Danh mục Trạng thái Xe Cứu thương</h3>
              <ul style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-slate);list-style:none;padding:0;">
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>READY</strong> - Sẵn sàng xuất kích</span>
                  <span class="status-pill status-pill-completed">Sẵn sàng</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>DISPATCHED</strong> - Đã điều động tới hiện trường</span>
                  <span class="status-pill status-pill-processing">Đã điều động</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>ON_SCENE</strong> - Đang xử trí tại hiện trường</span>
                  <span class="status-pill status-pill-new">Tại hiện trường</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>TRANSPORTING</strong> - Đang vận chuyển về BV</span>
                  <span class="status-pill status-pill-new">Đang chở BN</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>MAINTENANCE</strong> - Đang bảo dưỡng / Nạp oxy</span>
                  <span class="status-pill status-pill-cancelled">Bảo trì</span>
                </li>
              </ul>
            </div>

            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">2. Danh mục Trạng thái Ca Cấp cứu</h3>
              <ul style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-slate);list-style:none;padding:0;">
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>NEW</strong> - Tiếp nhận cuộc gọi mới</span>
                  <span class="status-pill status-pill-new">Mới tạo</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>DISPATCHED</strong> - Đã phát lệnh điều xe</span>
                  <span class="status-pill status-pill-processing">Đã điều động</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>TRANSPORTING</strong> - Đang trên đường về BV</span>
                  <span class="status-pill status-pill-new">Đang chuyển</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>COMPLETED</strong> - Hoàn tất bàn giao cho BV</span>
                  <span class="status-pill status-pill-completed">Hoàn tất</span>
                </li>
                <li style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px;">
                  <span><strong>CANCELLED</strong> - Hủy ca (có lý do)</span>
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
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
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
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
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
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
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
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
                    <td style="text-align:center;color:#64748B;">Không</td>
                    <td style="text-align:center;color:#64748B;">Không</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
                  </tr>
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;font-weight:600;color:var(--text-white);">Tạo ca & Phát lệnh điều xe cấp cứu</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
                    <td style="text-align:center;color:#64748B;">Không</td>
                    <td style="text-align:center;color:#64748B;">Không</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
                  </tr>
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;font-weight:600;color:var(--text-white);">Ký xác nhận Bàn giao Bệnh nhân</td>
                    <td style="text-align:center;color:#64748B;">Xem</td>
                    <td style="text-align:center;color:#64748B;">Xem</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Ký giao</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
                  </tr>
                  <tr style="border-bottom:1px solid var(--border-main);">
                    <td style="padding:10px;font-weight:600;color:var(--text-white);">Cập nhật Trạng thái Tiếp nhận Bệnh viện</td>
                    <td style="text-align:center;color:#64748B;">Xem</td>
                    <td style="text-align:center;color:#64748B;">Xem</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
                    <td style="text-align:center;color:#64748B;">Không</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
                  </tr>
                  <tr>
                    <td style="padding:10px;font-weight:600;color:var(--text-white);">Cấu hình Danh mục, Xe & Người dùng</td>
                    <td style="text-align:center;color:#64748B;">Xem</td>
                    <td style="text-align:center;color:#64748B;">Xem</td>
                    <td style="text-align:center;color:#64748B;">Không</td>
                    <td style="text-align:center;color:#64748B;">Không</td>
                    <td style="text-align:center;color:#10B981;font-weight:600;">Toàn quyền</td>
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
          { key: 'time', title: 'Thời điểm', sortable: true, render: l => `<span style="font-family:var(--font-mono);font-size:12px;color:var(--text-white);white-space:nowrap;display:inline-block;">${this.formatDateTime(l.time)}</span>` },
          { key: 'user', title: 'Tài khoản', sortable: true, render: l => `<strong style="color:var(--text-white);">${l.user}</strong>` },
          { key: 'action', title: 'Nội dung thao tác', sortable: false, render: l => l.action }
        ]
      }).render();
    }

    renderAdminBackupView(container) {
      container.innerHTML = `
        <div class="view-container-full">
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
            <button class="btn btn-emergency" id="btn-create-backup-now">Tạo Bản Sao Lưu Ngay</button>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Cấu hình Sao lưu Tự động</h3>
              <div style="font-size:13px;display:flex;flex-direction:column;gap:8px;color:var(--text-slate);">
                <div>Lịch sao lưu: <strong style="color:var(--text-white);">Hàng ngày vào 02:00:00 (Ban đêm)</strong></div>
                <div>Lưu trữ đám mây: <strong style="color:#10B981;">Data Center Sở Y Tế thành phố Cần Thơ (Đã kết nối)</strong></div>
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

    // ============================================================
    // DEMO FLOW TIẾP NHẬN BỆNH NHÂN (DÀNH CHO TÀI KHOẢN BỆNH VIỆN)
    // B1: Nhận pop-up thông báo tiếp nhận BN -> 2 nút: Xác nhận / Chi tiết
    //     - Xác nhận: tạo ca trên DS, chuyển về màn Bản đồ
    //     - Chi tiết: chuyển vào màn Cấp cứu, mở chi tiết ca -> trong chi tiết ca nhấn Xác nhận mới tạo ca trên DS
    // B2: Sau khi Xác nhận -> Danh sách cấp cứu & bản đồ hiển thị ca vừa tiếp nhận
    // ============================================================
    startHospitalDemo() {
      const state = window.StateManager.getState();
      const currentUser = window.StateManager.getCurrentUser();
      const myHospId = currentUser?.hospitalId || 'HOSP_BVTU';
      const myHosp = (state.hospitals || []).find(h => h.id === myHospId) || state.hospitals.find(h => h.id === 'HOSP_BVTU') || state.hospitals[0];

      const seedCase = state.demoCase || window.SEED_DATA?.demoCase || (window.SEED_DATA?.cases && window.SEED_DATA.cases[0]);
      const demoCase = seedCase ? JSON.parse(JSON.stringify(seedCase)) : {
        id: 'CC-261002-001',
        code: 'CC-261002-001',
        createdAt: new Date().toISOString()
      };

      const now = new Date();
      const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');

      demoCase.id = 'CC-261002-001';
      demoCase.code = 'CC-261002-001';
      demoCase.createdAt = `2026-10-05T${timeStr}`;
      demoCase.dispatch = demoCase.dispatch || {};
      demoCase.dispatch.hospitalId = myHosp.id;
      demoCase.dispatch.hospitalName = myHosp.name;
      demoCase.dispatch.vehiclePlate = demoCase.dispatch.vehiclePlate || '65A-012.34';
      demoCase.dispatch.crewName = demoCase.dispatch.crewName || 'Kíp 3 - Cái Răng';
      demoCase.status = 'TRANSPORTING';
      demoCase.statusText = 'Đang đến viện';
      demoCase.stageLabel = 'Xe đang đến viện';
      demoCase.eta = '4 phút';
      demoCase.hospitalResponse = 'PENDING';
      demoCase.hospitalResponseText = 'Chờ BV tiếp nhận';

      this.showHospitalIncomingAlertModal(demoCase);
    }

    showHospitalIncomingAlertModal(demoCase) {
      let alertModal = document.getElementById('hospital-incoming-alert-modal');
      if (!alertModal) {
        alertModal = document.createElement('div');
        alertModal.id = 'hospital-incoming-alert-modal';
        alertModal.className = 'modal-overlay';
        document.body.appendChild(alertModal);
      }

      window.CCNV_UI.SoundFx.playEmergencyTone?.();

      const p = demoCase.patient || {};
      const inc = demoCase.incident || {};
      const d = demoCase.dispatch || {};
      const vit = demoCase.epcr?.vitals || {};

      alertModal.innerHTML = `
        <div class="modal-box" style="border: 2px solid var(--red-primary); box-shadow: 0 0 50px rgba(239, 68, 68, 0.45); max-width: 620px; background: #0c1524; color: #f8fafc; border-radius: 12px; overflow: hidden; animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
          <!-- Header -->
          <div class="modal-header" style="background: linear-gradient(90deg, #3f0e15 0%, #1e1020 100%); border-bottom: 1px solid rgba(239,68,68,0.4); padding: 14px 20px; display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <strong style="color:#ffffff;font-size:16px;text-transform:uppercase;letter-spacing:0.5px;">THÔNG BÁO TIẾP NHẬN NẠN NHÂN</strong>
                  <span class="badge badge-emergency" style="animation:pulse 1.8s infinite;padding:2px 8px;font-size:11px;">● KHẨN CẤP</span>
                </div>
                <div style="font-size:11.5px;color:var(--text-slate);margin-top:2px;">
                  Trung tâm Điều phối 115 phát tín hiệu tiếp nhận nạn nhân ngoại viện đến BV
                </div>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" id="btn-close-hospital-alert" style="width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);border-radius:6px;">
              ${window.CCNV_UI.ICONS.x}
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body" style="padding: 18px 20px; background: #0c1524; display:flex; flex-direction:column; gap: 14px;">
            <!-- Banner ETA & Vehicle -->
            <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 10px 14px; display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div>
                  <strong style="color:var(--text-white);font-size:13.5px;">Xe cứu thương: <span style="color:#f59e0b;font-family:var(--font-mono);">${d.vehiclePlate || '65A-012.34'}</span></strong>
                  <div style="font-size:11.5px;color:var(--text-slate);margin-top:1px;">Kíp trực: ${d.crewName || 'Kíp 3 - Cái Răng'} · Vận tốc: 52 km/h</div>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:11px;color:var(--text-slate);">Dự kiến đến viện:</div>
                <div style="font-size:16px;font-weight:800;color:var(--red-vivid);font-family:var(--font-mono);">${demoCase.eta || '4 phút'}</div>
              </div>
            </div>

            <!-- Patient & Clinical Card -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-main); border-radius: 8px; padding: 12px 14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid var(--border-main);padding-bottom:8px;">
                <div style="font-size:14px;font-weight:700;color:var(--text-white);">
                  Nạn nhân · <span style="font-weight:600;color:var(--text-white);">${p.ageGroupText || 'Người cao tuổi'}</span> <span style="font-weight:normal;color:var(--text-muted);font-size:12px;">(${p.gender || 'Nam'})</span>
                </div>
                <span class="badge badge-accent" style="font-family:var(--font-mono);font-size:11px;">Mã: ${demoCase.code || 'CC-261002-001'}</span>
              </div>

              <div style="font-size:12.5px;line-height:1.5;color:var(--text-light);margin-bottom:10px;">
                <span style="color:var(--text-slate);">Tình huống / Chẩn đoán:</span>
                <strong style="color:#ffffff;"> ${inc.name || 'Tai nạn giao thông'}</strong> - ${inc.description || 'Đa chấn thương phần mềm, xây xát cẳng tay, theo dõi chấn thương ngực kín.'}
              </div>

              <div style="font-size:12px;color:var(--text-slate);">
                <span>Hiện trường: <strong style="color:var(--text-white);">${demoCase.location?.address || 'Cầu Hưng Lợi, thành phố Cần Thơ'}</strong></span>
              </div>
            </div>
          </div>

          <!-- Footer Buttons -->
          <div class="modal-footer" style="padding: 12px 20px; background: #080f1a; border-top: 1px solid var(--border-main); display:flex; align-items:center; justify-content:flex-end; gap: 10px;">
            <button class="btn btn-default" id="btn-hospital-alert-detail" style="padding: 8px 18px; font-size: 13px; display:inline-flex; align-items:center; gap:6px;">
              ${window.CCNV_UI?.ICONS?.fileText || ''}
              <span>Chi tiết</span>
            </button>
            <button class="btn btn-emergency" id="btn-hospital-alert-confirm" style="padding: 8px 22px; font-size: 13px; font-weight:700; display:inline-flex; align-items:center; gap:6px; box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);">
              ${window.CCNV_UI?.ICONS?.check || ''}
              <span>Xác nhận</span>
            </button>
          </div>
        </div>
      `;

      alertModal.classList.add('active');

      const closeAlert = () => alertModal.classList.remove('active');
      alertModal.querySelector('#btn-close-hospital-alert')?.addEventListener('click', closeAlert);

      // B1 Flow 1: Nhấn Xác nhận -> Tạo ca trên danh sách, cập nhật view
      alertModal.querySelector('#btn-hospital-alert-confirm')?.addEventListener('click', () => {
        closeAlert();
        this.commitHospitalDemoCase(demoCase);
        window.CCNV_UI.Toast.show(
          'Đã xác nhận tiếp nhận',
          `Khoa Cấp cứu đã xác nhận tiếp nhận ca ${demoCase.code}. Xe ${demoCase.dispatch?.vehiclePlate || ''} đang chuyển viện đến.`
        );
        const mainVp = document.getElementById('main-content-viewport');
        if (mainVp) {
          if (this.currentMenu === 'hospital-cases') {
            this.renderHospitalCasesView(mainVp);
          } else {
            this.renderCurrentView();
          }
        }
      });

      // B1 Flow 2: Nhấn Chi tiết -> Chuyển vào màn Cấp cứu và mở chi tiết ca (tiếp tục nhấn xác nhận trong modal mới tạo ca)
      alertModal.querySelector('#btn-hospital-alert-detail')?.addEventListener('click', () => {
        closeAlert();
        this.navigateTo('hospital-cases');
        this.openCaseDetailModal(demoCase.id, demoCase);
      });
    }

    commitHospitalDemoCase(demoCase) {
      const state = window.StateManager.getState();
      const currentUser = window.StateManager.getCurrentUser();
      const myHospId = currentUser?.hospitalId || demoCase.dispatch?.hospitalId || 'HOSP_BVTU';
      const myHosp = (state.hospitals || []).find(h => h.id === myHospId) || state.hospitals?.[0] || { name: 'Khoa Cấp cứu' };

      // 1. Cập nhật trạng thái phản hồi của bệnh viện
      demoCase.hospitalResponse = 'ACCEPTED';
      demoCase.hospitalResponseText = 'Đã xác nhận';
      demoCase.status = 'TRANSPORTING';
      demoCase.statusText = 'Đang đến viện';
      demoCase.stageLabel = 'Xe đang đến viện';
      demoCase.eta = demoCase.eta || '4 phút';

      // Đảm bảo gán đúng bệnh viện tiếp nhận của tài khoản đang đăng nhập
      if (!demoCase.dispatch) demoCase.dispatch = {};
      demoCase.dispatch.hospitalId = myHosp.id;
      demoCase.dispatch.hospitalName = myHosp.name;

      // 2. Cập nhật thời gian tạo ca thành HÔM NAY (2026-10-05) để khớp bộ lọc mặc định của màn hình danh sách ca
      const now = new Date();
      const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
      demoCase.createdAt = `2026-10-05T${timeStr}`;

      // 3. Bổ sung sự kiện Xác nhận tiếp nhận vào timeline log của ca (Tab Nhật ký sự kiện)
      demoCase.logs = Array.isArray(demoCase.logs) ? demoCase.logs : [];
      const timeDisplay = `${timeStr} - 05/10/2026`;
      const receiverName = currentUser?.fullname || currentUser?.username || 'BS. Trực Cấp cứu';
      const hospName = myHosp.name || 'Bệnh viện';

      const confirmLogEntry = {
        time: timeDisplay,
        type: 'HOSPITAL',
        badge: 'BV TIẾP NHẬN',
        color: '#34d399',
        user: `${receiverName} (${hospName})`,
        action: `Khoa Cấp cứu ${hospName} xác nhận tiếp nhận nạn nhân (${demoCase.patient?.ageGroupText || 'Người trưởng thành'}). Sẵn sàng kíp trực & trang thiết bị đón tại sảnh cấp cứu.`
      };

      if (!demoCase.logs.some(l => l.badge === 'BV TIẾP NHẬN')) {
        demoCase.logs.push(confirmLogEntry);
      }

      // 4. Ghi nhận nhật ký sự kiện vào StateManager Case Logs & Audit Logs
      window.StateManager.addCaseLog(demoCase.id, `Khoa Cấp cứu ${hospName} xác nhận tiếp nhận nạn nhân (${demoCase.patient?.ageGroupText || 'Người trưởng thành'}).`);
      window.StateManager.addAuditLog(`Khoa Cấp cứu ${hospName} xác nhận tiếp nhận ca ${demoCase.code} (Xe ${demoCase.dispatch?.vehiclePlate || '65A-012.34'})`);

      // 5. Đưa ca vào danh sách ca hoạt động (đặt lên đầu danh sách)
      const existingIdx = (state.cases || []).findIndex(c => c.id === demoCase.id || c.code === demoCase.code);
      if (existingIdx >= 0) {
        state.cases[existingIdx] = demoCase;
      } else {
        state.cases.unshift(demoCase);
      }

      // 6. Cập nhật trạng thái xe di chuyển đến viện
      const plate = demoCase.dispatch?.vehiclePlate || '65A-012.34';
      const veh = (state.vehicles || []).find(v => v.plate === plate);
      if (veh) {
        veh.status = 'TRANSPORTING';
        veh.statusText = 'Đang đến viện';
        veh.speed = 52;
        veh.coords = [10.0235, 105.7730];
      }

      // Lưu cờ xác nhận vào session cho cổng bệnh viện tiếp nhận
      try { sessionStorage.setItem('ccnv_hospital_confirmed', 'true'); } catch (e) { }
      this.hospitalDemoRunning = true;
      this.realtimeSelectedPlate = plate;
      this.setDemoButton(true);
      window.CanThoMap?.resetMission?.(demoCase.id);
      window.StateManager.saveToSession?.();

      // 7. Bắn sự kiện CASE_CREATED để đồng bộ toàn bộ giao diện: Danh sách ca, Bản đồ, KPI, Badges
      window.StateManager.notify('CASE_CREATED', demoCase);
    }

    confirmHospitalCase(targetCase) {
      if (!targetCase) return;
      this.commitHospitalDemoCase(targetCase);
      const plate = targetCase.dispatch?.vehiclePlate || '65A-012.34';
      this.realtimeSelectedPlate = plate;
      window.CCNV_UI?.SoundFx?.playSuccess?.();
      window.CCNV_UI?.Toast?.show?.(
        'ĐÃ XÁC NHẬN TIẾP NHẬN CA CẤP CỨU',
        `Khoa Cấp cứu đã xác nhận tiếp nhận ca ${targetCase.code}. Bản đồ đang hiển thị xe ${plate} đang di chuyển đến viện.`
      );
      const mainVp = document.getElementById('main-content-viewport');
      if (mainVp) {
        if (this.currentMenu === 'hospital-cases') {
          this.renderHospitalCasesView(mainVp);
        } else {
          this.renderRealtimeMapView(mainVp);
        }
      }
    }

    endHospitalDemo() {
      try { sessionStorage.removeItem('ccnv_hospital_confirmed'); } catch (e) { }
      this.hospitalDemoRunning = false;
      this.hospitalAlertTriggered = false;
      const state = window.StateManager.getState();
      state.cases = (state.cases || []).filter(c => c.id !== 'CC-261002-001' && c.code !== 'CC-261002-001');
      const plate = '65A-012.34';
      const veh = (state.vehicles || []).find(v => v.plate === plate);
      if (veh) {
        veh.status = 'READY';
        veh.statusText = 'Sẵn sàng';
        veh.speed = 0;
        veh.coords = [10.0150, 105.7720];
      }
      this.hospitalDemoRunning = false;
      this.realtimeSelectedPlate = null;
      this.setDemoButton(false);
      window.StateManager.saveToSession?.();
      window.CCNV_UI.Toast.show('Đã kết thúc demo', 'Đã đặt lại dữ liệu tiếp nhận của Khoa Cấp cứu.');
      this.renderCurrentView();
    }

    // --- HOSPITAL VIEWS (BẢN ĐỒ XE ĐẾN, TIẾP NHẬN & BÀN GIAO GỘP, CHUYÊN KHOA) ---

    // 1. BẢN ĐỒ GIÁM SÁT TIẾP NHẬN (REUSE NGUYÊN BẢN CODEBASE BẢN ĐỒ ĐIỀU HÀNH TRUNG TÂM)
    renderHospitalMapView(container) {
      return this.renderRealtimeMapView(container);
    }

    // 2. CONSOLIDATED CASES VIEW: CẤP CỨU - KHOA CẤP CỨU
    renderHospitalCasesView(container, activeTab = 'active') {
      const state = window.StateManager.getState();
      const currentUser = window.StateManager.getCurrentUser();
      const myHospId = currentUser?.hospitalId || 'HOSP_BVTU';

      // Khởi tạo state bộ lọc nếu chưa có
      if (this.hospitalCasesDateFilter === undefined) {
        this.hospitalCasesDateFilter = '2026-10-05'; // Mặc định hôm nay: sẵn sàng demo
      }
      if (this.hospitalCasesSearchQuery === undefined) {
        this.hospitalCasesSearchQuery = '';
      }
      if (this.hospitalCasesSortMode === undefined) {
        this.hospitalCasesSortMode = 'NEWEST';
      }

      // 1. Chuẩn hóa dữ liệu ca của BV (Active + History)
      const activeRaw = (state.cases || []).filter(c =>
        (c.dispatch?.hospitalId === myHospId || !c.dispatch?.hospitalId) &&
        !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(c.status)
      );
      const historyRaw = (state.historyCases || []).filter(h => h.hospitalId === myHospId || !h.hospitalId);

      const activeList = activeRaw.map(c => ({
        id: c.id,
        code: c.code,
        createdAt: c.createdAt,
        patientAgeGroup: c.patient?.ageGroup || 'ADULT',
        patientAgeGroupText: c.patient?.ageGroupText || 'Người trưởng thành',
        patientGender: c.patient?.gender || '',
        incidentName: c.incident?.name || 'Cấp cứu',
        severity: c.incident?.severity || 'ROUTINE',
        locationAddress: c.location?.address || '-',
        vehiclePlate: c.dispatch?.vehiclePlate || '-',
        crewName: c.dispatch?.crewName || '-',
        hospitalName: c.dispatch?.hospitalName || currentUser?.organization || '-',
        hospitalResponse: c.hospitalResponse || 'PENDING',
        status: c.status,
        statusText: c.statusText || (c.status === 'TRANSPORTING' ? 'Đang đến viện' : c.status === 'COMPLETED' ? 'Hoàn tất' : 'Đang xử lý'),
        eta: c.eta || (c.status === 'TRANSPORTING' ? '4 phút' : '-'),
        isHistory: false,
        raw: c
      }));

      const historyList = historyRaw.map(h => ({
        id: h.id,
        code: h.code,
        createdAt: h.createdAt,
        completedAt: h.completedAt,
        patientAgeGroup: h.patientAgeGroup || 'ADULT',
        patientAgeGroupText: h.patientAgeGroupText || 'Người trưởng thành',
        patientGender: h.patientGender || 'Nam',
        incidentName: h.incidentName || 'Cấp cứu',
        severity: h.severity || 'ROUTINE',
        locationAddress: h.locationAddress || 'thành phố Cần Thơ',
        vehiclePlate: h.vehiclePlate || '-',
        crewName: h.crewName || 'Kíp trực 115',
        hospitalName: h.hospitalName || currentUser?.organization || '-',
        hospitalResponse: 'ACCEPTED',
        status: h.status || 'COMPLETED',
        statusText: h.statusText || 'Hoàn tất',
        eta: '-',
        isHistory: true,
        raw: h
      }));

      // Gộp tất cả ca (Đang xử lý + Lịch sử) thành một nguồn duy nhất
      const allCases = [...activeList, ...historyList];

      // Hàm chuẩn hóa ngày YYYY-MM-DD
      const getCaseDateStr = (dateVal) => {
        if (!dateVal) return '';
        if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
          return dateVal.substring(0, 10);
        }
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        }
        return '2026-10-05';
      };

      // 2. Lọc theo ngày được chọn (nếu có chọn ngày)
      let filteredCases = allCases;
      if (this.hospitalCasesDateFilter) {
        filteredCases = filteredCases.filter(c => {
          const cDate = getCaseDateStr(c.createdAt);
          return cDate === this.hospitalCasesDateFilter;
        });
      }

      // 3. Tìm kiếm theo từ khóa (Mã ca, Tên BN, Xe, Tình huống, Địa chỉ, Kíp trực)
      const q = (this.hospitalCasesSearchQuery || '').trim().toLowerCase();
      if (q) {
        filteredCases = filteredCases.filter(c => {
          return (
            (c.code && c.code.toLowerCase().includes(q)) ||
            (c.patientAgeGroupText && c.patientAgeGroupText.toLowerCase().includes(q)) ||
            (c.vehiclePlate && c.vehiclePlate.toLowerCase().includes(q)) ||
            (c.incidentName && c.incidentName.toLowerCase().includes(q)) ||
            (c.locationAddress && c.locationAddress.toLowerCase().includes(q)) ||
            (c.crewName && c.crewName.toLowerCase().includes(q))
          );
        });
      }

      // 4. Sắp xếp danh sách
      if (this.hospitalCasesSortMode === 'OLDEST') {
        filteredCases.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      } else if (this.hospitalCasesSortMode === 'SEVERITY') {
        const rank = { 'CRITICAL': 3, 'EMERGENCY': 2, 'ROUTINE': 1 };
        filteredCases.sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0));
      } else {
        // Mặc định: NEWEST
        filteredCases.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }

      const isToday = this.hospitalCasesDateFilter === '2026-10-05';
      const incomingCount = filteredCases.filter(c => c.status === 'TRANSPORTING').length;
      const pendingCount = filteredCases.filter(c => c.hospitalResponse !== 'ACCEPTED' && c.status !== 'COMPLETED').length;

      container.innerHTML = `
        <div class="view-container-full">
          <!-- Header Bar with Quick Summary Pills -->
          <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:14px;flex-wrap:wrap;gap:12px;">
            <!-- Mini Summary Counter Pills -->
            <div style="display:flex;gap:8px;font-size:12px;flex-wrap:wrap;">
              <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;padding:6px 12px;display:flex;align-items:center;gap:6px;">
                <span style="color:var(--text-muted);">Tổng số ca:</span>
                <strong style="color:${filteredCases.length > 0 ? 'var(--red-vivid)' : 'var(--text-white)'};font-family:var(--font-mono);">${filteredCases.length}</strong>
              </div>
              <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:6px 12px;display:flex;align-items:center;gap:6px;">
                <span style="color:#f87171;">Đang đến viện:</span>
                <strong style="color:var(--red-vivid);font-family:var(--font-mono);">${incomingCount}</strong>
              </div>
              <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:6px 12px;display:flex;align-items:center;gap:6px;">
                <span style="color:#fbbf24;">Chờ đón:</span>
                <strong style="color:#fbbf24;font-family:var(--font-mono);">${pendingCount}</strong>
              </div>
              <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:6px 12px;display:flex;align-items:center;gap:6px;">
                <span style="color:#34d399;">Trực cấp cứu:</span>
                <strong style="color:#10b981;font-weight:600;">Sẵn sàng 24/7</strong>
              </div>
            </div>
          </div>

          <!-- Thanh tìm kiếm, lọc ngày và sắp xếp thống nhất (Không chia tab) -->
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:12px 14px;background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:8px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:260px;max-width:480px;">
              <!-- Search Box -->
              <div style="position:relative;flex:1;">
                <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);display:flex;align-items:center;pointer-events:none;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </span>
                <input
                  type="text"
                  id="hosp-cases-search-input"
                  value="${this.hospitalCasesSearchQuery || ''}"
                  placeholder="Tìm mã ca, tình trạng, nhóm độ tuổi, biển số xe..."
                  style="width:100%;box-sizing:border-box;background:var(--bg-input, #0B132B);border:1px solid var(--border-main);color:var(--text-white);padding:7px 12px 7px 32px;border-radius:6px;font-size:12.5px;outline:none;"
                />
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <!-- Date Filter (Hôm nay / Chọn ngày để xem lịch sử) -->
              <div style="display:flex;align-items:center;gap:6px;background:var(--bg-card);border:1px solid var(--border-main);padding:4px 10px;border-radius:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <label for="hosp-cases-date-input" style="font-size:12px;color:var(--text-muted);cursor:pointer;white-space:nowrap;">Ngày:</label>
                <input
                  type="date"
                  id="hosp-cases-date-input"
                  value="${this.hospitalCasesDateFilter || '2026-10-05'}"
                  style="background:transparent;border:none;color:var(--text-white);font-size:12.5px;font-family:var(--font-mono);outline:none;cursor:pointer;"
                  title="Chỉnh lại ngày để xem lịch sử các ca tiếp nhận trước đó"
                />
                ${!isToday ? `
                  <button type="button" id="btn-hosp-cases-reset-today" class="btn btn-default btn-xs" style="padding:2px 8px;font-size:11px;margin-left:4px;" title="Quay về ngày Hôm nay (Sẵn sàng demo)">
                    Hôm nay
                  </button>
                ` : `
                  <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);color:#34d399;font-weight:500;">Hôm nay</span>
                `}
              </div>

              <!-- Sort Select -->
              <div style="display:flex;align-items:center;gap:6px;">
                <label for="hosp-cases-sort-select" style="font-size:12px;color:var(--text-muted);white-space:nowrap;">Sắp xếp:</label>
                <select
                  id="hosp-cases-sort-select"
                  style="background:var(--bg-card);border:1px solid var(--border-main);color:var(--text-white);padding:6px 10px;border-radius:6px;font-size:12px;outline:none;cursor:pointer;"
                >
                  <option value="NEWEST" ${this.hospitalCasesSortMode === 'NEWEST' ? 'selected' : ''}>Mới nhất</option>
                  <option value="OLDEST" ${this.hospitalCasesSortMode === 'OLDEST' ? 'selected' : ''}>Cũ nhất</option>
                  <option value="SEVERITY" ${this.hospitalCasesSortMode === 'SEVERITY' ? 'selected' : ''}>Mức độ khẩn cấp</option>
                </select>
              </div>

              <!-- Reset Filter Button -->
              <button
                type="button"
                id="btn-hosp-cases-reset-all"
                class="btn btn-default btn-sm"
                style="padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:4px;"
                title="Đặt lại bộ lọc về mặc định"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                  <path d="M21 3v5h-5"></path>
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                  <path d="M3 21v-5h5"></path>
                </svg>
                <span>Đặt lại</span>
              </button>
            </div>
          </div>

          <!-- Main Content Area: 1 danh sách duy nhất -->
          <div id="hospital-cases-pane"></div>
        </div>
      `;

      const pane = container.querySelector('#hospital-cases-pane');
      if (!pane) return;

      if (filteredCases.length === 0) {
        if (isToday) {
          pane.innerHTML = `
            <div class="content-card" style="padding:56px 24px;text-align:center;background:var(--bg-card);border:1px solid var(--border-main);border-radius:8px;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:rgba(59,130,246,0.1);color:#60A5FA;margin-bottom:16px;">
                ${window.CCNV_UI.ICONS.ambulance}
              </div>
              <h3 style="color:var(--text-white);font-size:17px;margin:0 0 8px 0;font-weight:600;">Hôm nay chưa có ca cấp cứu nào</h3>
              <p style="color:var(--text-muted);font-size:13px;max-width:520px;margin:0 auto 18px auto;line-height:1.6;">
                Khoa Cấp cứu đã sẵn sàng nhận bệnh. Khi Trung tâm 115 tiếp nhận cuộc gọi và điều phối xe chuyển viện đến đây, hồ sơ ca bệnh và ePCR sẽ tự động hiển thị tức thời để phục vụ kíp trực demo tiếp nhận.
              </p>
              <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px;">
                <button type="button" class="btn btn-default btn-sm" id="btn-quick-view-history" style="display:flex;align-items:center;gap:6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span>Xem lịch sử ngày 01/10/2026</span>
                </button>
              </div>
            </div>
          `;
        } else {
          pane.innerHTML = `
            <div class="content-card" style="padding:56px 24px;text-align:center;background:var(--bg-card);border:1px solid var(--border-main);border-radius:8px;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:rgba(100,116,139,0.1);color:#94a3b8;margin-bottom:16px;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <h3 style="color:var(--text-white);font-size:17px;margin:0 0 8px 0;font-weight:600;">Không có ca cấp cứu nào trong ngày này</h3>
              <p style="color:var(--text-muted);font-size:13px;max-width:500px;margin:0 auto 16px auto;line-height:1.6;">
                Không tìm thấy dữ liệu ca tiếp nhận phù hợp với ngày hoặc từ khóa tìm kiếm đã chọn.
              </p>
              <button type="button" class="btn btn-default btn-sm" id="btn-quick-reset-date">
                Quay về ngày Hôm nay
              </button>
            </div>
          `;
        }
      } else {
        pane.innerHTML = `
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="hospital-cases-table-mount"></div>
          </div>
        `;

        new window.CCNV_UI.DataTable({
          containerId: 'hospital-cases-table-mount',
          data: filteredCases,
          pageSize: 10,
          exportTitle: `Danh_sach_ca_cap_cuu_${this.hospitalCasesDateFilter || 'tat_ca'}`,
          emptyText: 'Không tìm thấy ca nào',
          searchPlaceholder: 'Tìm nhanh trong bảng...',
          defaultSortKey: 'createdAt',
          defaultSortOrder: 'desc',
          columns: this.getHospitalCasesColumns()
        }).render();
      }

      // Bind search, date filter, sort controls
      const searchInput = container.querySelector('#hosp-cases-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.hospitalCasesSearchQuery = e.target.value;
          this.renderHospitalCasesView(container);
          const nextInput = container.querySelector('#hosp-cases-search-input');
          if (nextInput) {
            nextInput.focus();
            nextInput.selectionStart = nextInput.selectionEnd = nextInput.value.length;
          }
        });
      }

      const dateInput = container.querySelector('#hosp-cases-date-input');
      if (dateInput) {
        dateInput.addEventListener('change', (e) => {
          this.hospitalCasesDateFilter = e.target.value;
          this.renderHospitalCasesView(container);
        });
      }

      const sortSelect = container.querySelector('#hosp-cases-sort-select');
      if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
          this.hospitalCasesSortMode = e.target.value;
          this.renderHospitalCasesView(container);
        });
      }

      const resetTodayBtn = container.querySelector('#btn-hosp-cases-reset-today, #btn-quick-reset-date');
      if (resetTodayBtn) {
        resetTodayBtn.addEventListener('click', () => {
          this.hospitalCasesDateFilter = '2026-10-05';
          this.renderHospitalCasesView(container);
        });
      }

      const resetAllBtn = container.querySelector('#btn-hosp-cases-reset-all');
      if (resetAllBtn) {
        resetAllBtn.addEventListener('click', () => {
          this.hospitalCasesDateFilter = '2026-10-05';
          this.hospitalCasesSearchQuery = '';
          this.hospitalCasesSortMode = 'NEWEST';
          this.renderHospitalCasesView(container);
        });
      }

      const quickHistoryBtn = container.querySelector('#btn-quick-view-history');
      if (quickHistoryBtn) {
        quickHistoryBtn.addEventListener('click', () => {
          this.hospitalCasesDateFilter = '2026-10-01';
          this.renderHospitalCasesView(container);
        });
      }

      // Bind row actions (Accept, Handover, Open Detail)
      container.addEventListener('click', (e) => {
        // Quick Accept
        const acceptBtn = e.target.closest('.btn-quick-accept-case');
        if (acceptBtn) {
          e.stopPropagation();
          const cid = acceptBtn.getAttribute('data-case-id');
          window.StateManager.updateCase(cid, {
            hospitalResponse: 'ACCEPTED',
            hospitalResponseText: 'Đã xác nhận'
          });
          window.StateManager.addCaseLog(cid, `${currentUser?.organization || 'Khoa Cấp cứu'} xác nhận sẵn sàng tiếp nhận người bệnh`);
          window.CCNV_UI.Toast.show('Đã xác nhận tiếp nhận', `Khoa Cấp cứu sẵn sàng đón nhận ca ${cid}`);
          this.renderHospitalCasesView(container);
          return;
        }

        // Quick Handover
        const handoverBtn = e.target.closest('.btn-quick-handover-case');
        if (handoverBtn) {
          e.stopPropagation();
          const cid = handoverBtn.getAttribute('data-case-id');
          const targetCase = state.cases.find(c => c.id === cid || c.code === cid);
          if (targetCase) {
            targetCase.status = 'COMPLETED';
            targetCase.statusText = 'Hoàn tất';
            targetCase.stageLabel = 'Đã bàn giao tại viện';
            targetCase.hospitalResponse = 'ACCEPTED';
            targetCase.hospitalResponseText = 'Đã bàn giao';
            targetCase.completedAt = new Date().toISOString();

            const plate = targetCase.dispatch?.vehiclePlate;
            if (plate) {
              window.StateManager.updateVehicle(plate, { status: 'READY', statusText: 'Sẵn sàng', speed: 0 });
            }
            window.StateManager.addCaseLog(cid, `${currentUser?.organization || 'Khoa Cấp cứu'} hoàn tất thủ tục bàn giao và tiếp nhận người bệnh. Ca hoàn tất.`);
            window.CCNV_UI.Toast.show('Đã Hoàn Tất Bàn Giao', `Bàn giao thành công ca ${targetCase.code}. Xe ${plate || ''} đã sẵn sàng.`);
            this.renderHospitalCasesView(container);
          }
          return;
        }

        // Open Case Detail / ePCR
        const detailBtn = e.target.closest('.btn-open-case-detail');
        if (detailBtn) {
          e.stopPropagation();
          const cid = detailBtn.getAttribute('data-case-id');
          this.openCaseDetailModal(cid);
        }
      });
    }

    getHospitalCasesColumns() {
      return [
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
              return `<span style="font-family:var(--font-mono);font-size:12px;color:#CBD5E1;">${day}/${month}/${year} - ${hours}:${minutes}</span>`;
            }
            return `<span style="font-family:var(--font-mono);font-size:12px;">${c.createdAt}</span>`;
          }
        },
        {
          key: 'patient',
          title: 'Nạn nhân',
          sortable: false,
          render: c => `<strong>${c.patientAgeGroupText || 'Người trưởng thành'}</strong> <span style="font-size:11.5px;color:var(--text-muted);">(${c.patientGender || 'Nam'})</span>`
        },
        {
          key: 'incidentName',
          title: 'Tình trạng',
          sortable: true,
          render: c => `<span class="badge ${c.severity === 'CRITICAL' || c.severity === 'EMERGENCY' ? 'badge-emergency' : 'badge-normal'}">${c.incidentName}</span>`
        },
        {
          key: 'vehiclePlate',
          title: 'Xe chở & Kíp trực',
          sortable: true,
          render: c => `
            <div>
              <strong style="font-family:var(--font-mono);color:var(--text-white);">${c.vehiclePlate}</strong>
              <div style="font-size:11px;color:var(--text-muted);">${c.crewName}</div>
            </div>
          `
        },
        {
          key: 'eta',
          title: 'ETA',
          sortable: false,
          render: c => {
            if (c.status === 'COMPLETED') return `<span style="color:var(--emerald-light);font-size:11.5px;">Đã bàn giao</span>`;
            if (c.eta && c.eta !== '-') return `<strong style="color:var(--red-vivid);font-size:13px;font-family:var(--font-mono);">${c.eta}</strong>`;
            return `<span style="color:var(--text-muted);">-</span>`;
          }
        },
        {
          key: 'hospitalResponse',
          title: 'Phản hồi BV',
          sortable: true,
          render: c => {
            if (c.status === 'COMPLETED' || c.hospitalResponse === 'ACCEPTED') {
              return `<span class="status-pill status-pill-completed">Đã xác nhận</span>`;
            }
            return `<span class="status-pill status-pill-processing">Chờ phản hồi</span>`;
          }
        },
        {
          key: 'actions',
          title: 'Thao tác',
          sortable: false,
          render: c => {
            const actions = [];
            if (c.status !== 'COMPLETED' && c.hospitalResponse !== 'ACCEPTED') {
              actions.push(`<button class="btn btn-emergency btn-sm btn-quick-accept-case" data-case-id="${c.id}" title="Xác nhận sẵn sàng đón người bệnh">Xác nhận Đón</button>`);
            }
            if (c.status !== 'COMPLETED') {
              actions.push(`<button class="btn btn-emergency btn-sm btn-quick-handover-case" data-case-id="${c.id}" title="Ký biên bản bàn giao và tiếp nhận người bệnh">Bàn giao</button>`);
            }
            actions.push(`<button class="btn btn-default btn-sm btn-open-case-detail" data-case-id="${c.id}">Hồ sơ ePCR</button>`);
            return `<div style="display:flex;align-items:center;gap:6px;">${actions.join('')}</div>`;
          }
        }
      ];
    }

    renderHospitalIncomingView(container) {
      this.renderHospitalCasesView(container);
    }

    renderHospitalHandoverView(container) {
      this.renderHospitalCasesView(container);
    }

    renderHospitalEPCRView(container) {
      this.renderHospitalCasesView(container);
    }

    renderReceivingIncomingView(container) {
      this.renderHospitalCasesView(container);
    }

    renderHospitalReceptionStatusView(container) {
      const state = window.StateManager.getState();
      const currentUser = window.StateManager.getCurrentUser();
      const myHospId = currentUser?.hospitalId || 'HOSP_BVTU';
      const hosp = state.hospitals.find(h => h.id === myHospId) || state.hospitals.find(h => h.id === 'HOSP_BVTU') || state.hospitals[0];
      const cap = hosp.capacity || {
        erBeds: 20,
        availableBeds: 4,
        icuBeds: 12,
        ventilators: 3,
        dsaStatus: 'READY',
        thrombolytic: 'YES',
        orAvail: 2,
        neuroSurgeons: 'ON_SITE',
        obStatus: 'READY',
        pedsStatus: 'READY'
      };

      container.innerHTML = `
        <div class="view-container-full" style="padding-bottom:30px;">
          <div style="margin-bottom:14px;display:flex;justify-content:flex-end;">
            <div style="text-align:right;">
              <span class="badge ${hosp.status === 'READY' ? 'badge-normal' : hosp.status === 'LIMITED' ? 'badge-warning' : 'badge-emergency'}" style="font-size:12px;padding:6px 12px;">
                ${hosp.status === 'READY' ? 'Đang tiếp nhận bình thường' : hosp.status === 'LIMITED' ? 'Hạn chế tiếp nhận' : 'Tạm ngưng tiếp nhận'}
              </span>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:16px;">
            <!-- PHẦN 1: TRẠNG THÁI TIẾP NHẬN NGOẠI VIỆN -->
            <div class="content-card" style="padding:18px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;border-bottom:1px solid var(--border-main);padding-bottom:10px;">
                <span style="color:#60A5FA;">${window.CCNV_UI.ICONS.hospital}</span>
                <h3 style="color:var(--text-white);font-size:14px;margin:0;font-weight:600;">1. Trạng thái Nhận Bệnh Ngoại viện (Toàn Viện)</h3>
              </div>

              <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px;">
                <div style="display:flex;flex-direction:column;gap:10px;">
                  <label style="display:flex;align-items:center;gap:12px;padding:12px;background:${hosp.status === 'READY' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-elevated)'};border:2px solid ${hosp.status === 'READY' ? '#10B981' : 'var(--border-main)'};border-radius:8px;cursor:pointer;">
                    <input type="radio" name="hosp-status-opt" value="READY" ${hosp.status === 'READY' ? 'checked' : ''} style="width:16px;height:16px;" />
                    <div>
                      <strong style="color:#10B981;font-size:13.5px;display:block;"> ĐANG TIẾP NHẬN BÌNH THƯỜNG</strong>
                      <span style="font-size:12px;color:var(--text-slate);">Khoa Cấp cứu và các buồng hồi sức sẵn sàng đón mọi ca cấp cứu ngoại viện</span>
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

                <div style="background:var(--bg-elevated);padding:14px;border-radius:8px;border:1px solid var(--border-main);display:flex;flex-direction:column;justify-content:space-between;">
                  <div>
                    <div class="form-field">
                      <label class="form-label" style="font-size:12px;font-weight:600;">Lý do thay đổi trạng thái / Ghi chú gửi ĐPV</label>
                      <textarea id="hosp-status-reason" rows="3" style="width:100%;font-size:12.5px;" placeholder="Ví dụ: Khoa đang tiếp nhận đồng thời 4 ca TNGT nặng, đề nghị điều phối ca tiếp theo sang BV lân cận..."></textarea>
                    </div>
                  </div>
                  <div style="font-size:11.5px;color:var(--text-muted);line-height:1.5;margin-top:10px;padding-top:8px;border-top:1px dashed var(--border-main);">
                    <strong style="color:var(--text-slate);">Quy chế điều phối 115:</strong> Khi chuyển sang <em>Tạm ngưng tiếp nhận</em>, hệ thống tự động cảnh báo màu đỏ trên bản đồ của Điều phối viên 115 để chuyển hướng ca bệnh phù hợp.
                  </div>
                </div>
              </div>
            </div>

            <!-- PHẦN 2: KHAI BÁO NĂNG LỰC CHUYÊN KHOA -->
            <div class="content-card" style="padding:18px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;border-bottom:1px solid var(--border-main);padding-bottom:10px;">
                <span style="color:#10B981;">${window.CCNV_UI.ICONS.layers}</span>
                <h3 style="color:var(--text-white);font-size:14px;margin:0;font-weight:600;">2. Khai báo Năng lực Tiếp nhận & Chuyên khoa</h3>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
                <!-- 1. Cấp cứu & ICU -->
                <div class="form-section" style="background:var(--bg-elevated);padding:14px;border-radius:8px;border:1px solid var(--border-main);">
                  <div class="form-section-title" style="color:#60A5FA;margin-bottom:10px;font-size:13px;font-weight:600;">A. Khoa Cấp cứu & Hồi sức Tích cực (ICU)</div>
                  <div class="form-grid-2">
                    <div class="form-field">
                      <label class="form-label">Số giường Cấp cứu đang mở</label>
                      <input type="number" id="spec-er-beds" value="${cap.erBeds || 20}" />
                    </div>
                    <div class="form-field">
                      <label class="form-label">Giường Cấp cứu còn trống</label>
                      <input type="number" id="spec-er-avail" value="${cap.availableBeds || 4}" />
                    </div>
                  </div>
                  <div class="form-grid-2" style="margin-top:10px;">
                    <div class="form-field">
                      <label class="form-label">Tổng giường Hồi sức ICU</label>
                      <input type="number" id="spec-icu-beds" value="${cap.icuBeds || 12}" />
                    </div>
                    <div class="form-field">
                      <label class="form-label">Máy thở sẵn sàng</label>
                      <input type="number" id="spec-ventilators" value="${cap.ventilators || 3}" />
                    </div>
                  </div>
                </div>

                <!-- 2. Tim mạch & Đột quỵ -->
                <div class="form-section" style="background:var(--bg-elevated);padding:14px;border-radius:8px;border:1px solid var(--border-main);">
                  <div class="form-section-title" style="color:#F59E0B;margin-bottom:10px;font-size:13px;font-weight:600;">B. Can thiệp Tim mạch & Đột quỵ não (DSA)</div>
                  <div class="form-field" style="margin-bottom:10px;">
                    <label class="form-label">Phòng can thiệp mạch máu (DSA)</label>
                    <select id="spec-dsa-status">
                      <option value="READY" ${cap.dsaStatus === 'READY' || !cap.dsaStatus ? 'selected' : ''}>Sẵn sàng 24/7 (Kíp trực đang sẵn sàng tiếp nhận)</option>
                      <option value="BUSY" ${cap.dsaStatus === 'BUSY' ? 'selected' : ''}>Đang thực hiện ca can thiệp (Chờ 45 phút)</option>
                      <option value="UNAVAILABLE" ${cap.dsaStatus === 'UNAVAILABLE' ? 'selected' : ''}>Tạm ngưng can thiệp</option>
                    </select>
                  </div>
                  <div class="form-field">
                    <label class="form-label">Thuốc tiêu sợi huyết (Alteplase) cấp cứu</label>
                    <select id="spec-thrombolytic">
                      <option value="YES" ${cap.thrombolytic === 'YES' || !cap.thrombolytic ? 'selected' : ''}>Có sẵn trong tủ thuốc cấp cứu</option>
                      <option value="NO" ${cap.thrombolytic === 'NO' ? 'selected' : ''}>Hết cơ số dự trữ</option>
                    </select>
                  </div>
                </div>

                <!-- 3. Ngoại Chấn thương & Phẫu thuật -->
                <div class="form-section" style="background:var(--bg-elevated);padding:14px;border-radius:8px;border:1px solid var(--border-main);">
                  <div class="form-section-title" style="color:#EC4899;margin-bottom:10px;font-size:13px;font-weight:600;">C. Ngoại Chấn thương & Phẫu thuật Cấp cứu</div>
                  <div class="form-grid-2">
                    <div class="form-field">
                      <label class="form-label">Phòng mổ cấp cứu sẵn sàng</label>
                      <input type="number" id="spec-or-avail" value="${cap.orAvail || 2}" />
                    </div>
                    <div class="form-field">
                      <label class="form-label">Kíp phẫu thuật Chấn thương / Ngoại</label>
                      <select id="spec-neuro-surgeons">
                        <option value="ON_SITE" ${cap.neuroSurgeons === 'ON_SITE' || !cap.neuroSurgeons ? 'selected' : ''}>Đang trực tại viện</option>
                        <option value="ON_CALL" ${cap.neuroSurgeons === 'ON_CALL' ? 'selected' : ''}>Trực On-call (15 phút)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- 4. Sản - Nhi Cấp cứu -->
                <div class="form-section" style="background:var(--bg-elevated);padding:14px;border-radius:8px;border:1px solid var(--border-main);">
                  <div class="form-section-title" style="color:#10B981;margin-bottom:10px;font-size:13px;font-weight:600;">D. Khả năng Tiếp nhận Sản - Nhi</div>
                  <div class="form-grid-2">
                    <div class="form-field">
                      <label class="form-label">Cấp cứu Sản - Đỡ đẻ khẩn cấp</label>
                      <select id="spec-ob-status">
                        <option value="READY" ${cap.obStatus === 'READY' || !cap.obStatus ? 'selected' : ''}>Sẵn sàng tiếp nhận</option>
                        <option value="TRANSFER" ${cap.obStatus === 'TRANSFER' ? 'selected' : ''}>Đề nghị chuyển viện Chuyên khoa Sản</option>
                      </select>
                    </div>
                    <div class="form-field">
                      <label class="form-label">Hồi sức Sơ sinh (NICU)</label>
                      <select id="spec-peds-status">
                        <option value="READY" ${cap.pedsStatus === 'READY' || !cap.pedsStatus ? 'selected' : ''}>Sẵn sàng lồng ấp sơ sinh</option>
                        <option value="TRANSFER" ${cap.pedsStatus === 'TRANSFER' ? 'selected' : ''}>Đề nghị chuyển BV Nhi đồng Cần Thơ</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- THANH THAO TÁC LƯU CHUNG -->
            <div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:12px 18px;background:var(--bg-elevated);border-radius:8px;border:1px solid var(--border-main);">
              <span style="font-size:12px;color:var(--text-muted);">Mọi thay đổi sẽ được công bố tức thời tới mạng lưới cấp cứu 115</span>
              <button class="btn btn-emergency btn-lg" id="btn-save-all-hosp-status" style="padding:10px 24px;font-size:14px;font-weight:600;">
                ${window.CCNV_UI.ICONS.check}
                <span>Lưu & Đồng bộ Trạng thái Toàn Mạng lưới</span>
              </button>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-save-all-hosp-status')?.addEventListener('click', () => {
        const selected = container.querySelector('input[name="hosp-status-opt"]:checked')?.value || 'READY';
        const reason = container.querySelector('#hosp-status-reason')?.value || '';
        const text = selected === 'READY' ? 'Đang nhận' : selected === 'LIMITED' ? 'Hạn chế' : 'Tạm ngưng';

        hosp.status = selected;
        hosp.statusText = text;
        hosp.capacity = {
          erBeds: parseInt(container.querySelector('#spec-er-beds')?.value, 10) || 20,
          availableBeds: parseInt(container.querySelector('#spec-er-avail')?.value, 10) || 4,
          icuBeds: parseInt(container.querySelector('#spec-icu-beds')?.value, 10) || 12,
          ventilators: parseInt(container.querySelector('#spec-ventilators')?.value, 10) || 3,
          dsaStatus: container.querySelector('#spec-dsa-status')?.value || 'READY',
          thrombolytic: container.querySelector('#spec-thrombolytic')?.value || 'YES',
          orAvail: parseInt(container.querySelector('#spec-or-avail')?.value, 10) || 2,
          neuroSurgeons: container.querySelector('#spec-neuro-surgeons')?.value || 'ON_SITE',
          obStatus: container.querySelector('#spec-ob-status')?.value || 'READY',
          pedsStatus: container.querySelector('#spec-peds-status')?.value || 'READY'
        };

        window.StateManager.saveToSession();
        window.StateManager.addAuditLog(`${hosp.name} cập nhật trạng thái: ${text} & cập nhật năng lực chuyên khoa (ICU: ${hosp.capacity.icuBeds}, Máy thở: ${hosp.capacity.ventilators}, DSA: ${hosp.capacity.dsaStatus})`);
        window.CCNV_UI.Toast.show('Đã đồng bộ mạng lưới', `Đã lưu trạng thái [${text}] và toàn bộ năng lực chuyên khoa của ${hosp.name} lên Trung tâm Điều hành 115 Cần Thơ`);
        this.renderHospitalReceptionStatusView(container);
      });
    }

    renderHospitalSpecialtyView(container) {
      this.renderHospitalReceptionStatusView(container);
    }

    // --- BÁO CÁO TIẾP NHẬN BỆNH VIỆN (CLONE BẢN APP TRUNG TÂM VỚI 2 TAB TỔNG QUAN & CHI TIẾT) ---
    renderHospitalReportsView(container, activeTab = 'overview') {
      const state = window.StateManager.getState();
      const currentUser = window.StateManager.getCurrentUser();
      const myHospId = currentUser?.hospitalId || 'HOSP_BVTU';
      const hosp = state.hospitals.find(h => h.id === myHospId) || state.hospitals.find(h => h.id === 'HOSP_BVTU') || state.hospitals[0];

      // Prepare comprehensive data records for Chi tiết tab
      const rawHistory = (state.historyCases || []).filter(h => h.hospitalId === myHospId || !h.hospitalId);
      const rawActive = (state.activeCases || []).filter(c => c.dispatch?.hospitalId === myHospId || !c.dispatch?.hospitalId);

      const detailRecords = [
        ...rawActive.map(c => ({
          code: c.code || c.id,
          createdAt: c.createdAt || '2026-10-02T08:10:15',
          patientAgeGroup: c.patient?.ageGroup || 'ADULT',
          patientAgeGroupText: c.patient?.ageGroupText || 'Người trưởng thành',
          patientGender: c.patient?.gender || 'Nam',
          incidentName: c.incident?.name || c.incidentName || 'Tai nạn giao thông',
          severity: c.incident?.severity || c.severity || 'EMERGENCY',
          severityText: c.incident?.severityText || (c.severity === 'CRITICAL' ? 'Tối khẩn' : 'Khẩn cấp'),
          vehiclePlate: c.dispatch?.vehiclePlate || c.vehiclePlate || '65A-012.34',
          doctor: 'BS. Lê Hoàng Long',
          handoverTime: 'Đang bàn giao',
          disposition: 'Phòng Cấp cứu Đang xử trí',
          status: 'IN_PROGRESS',
          statusText: 'Đang tiếp nhận'
        })),
        ...rawHistory.map(h => ({
          code: h.code || h.id,
          createdAt: h.createdAt || '2026-10-01T21:40:00',
          patientAgeGroup: h.patientAgeGroup || 'ELDERLY',
          patientAgeGroupText: h.patientAgeGroupText || 'Người cao tuổi',
          patientGender: 'Nam',
          incidentName: h.incidentName,
          severity: h.severity || 'EMERGENCY',
          severityText: h.severity === 'CRITICAL' ? 'Tối khẩn' : (h.severity === 'EMERGENCY' ? 'Khẩn cấp' : 'Tiêu chuẩn'),
          vehiclePlate: h.vehiclePlate || '65A-016.88',
          doctor: 'BS. Trần Văn Hậu',
          handoverTime: h.durations?.sceneTime || '4.2 phút',
          disposition: h.severity === 'CRITICAL' ? 'Nhập ICU Hồi sức' : 'Theo dõi Khoa Cấp cứu',
          status: 'COMPLETED',
          statusText: 'Đã hoàn tất bàn giao'
        })),
        // Additional realistic hospital reception sample data
        {
          code: 'CC-261001-015',
          createdAt: '2026-10-01T15:20:00',
          patientAgeGroup: 'ELDERLY',
          patientAgeGroupText: 'Người cao tuổi',
          patientGender: 'Nữ',
          incidentName: 'Đột quỵ não',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-016.88',
          doctor: 'BS. Nguyễn Thanh Tùng',
          handoverTime: '3.8 phút',
          disposition: 'Chuyển thẳng DSA Can thiệp Mạch máu',
          status: 'COMPLETED',
          statusText: 'Đã hoàn tất bàn giao'
        },
        {
          code: 'CC-261001-014',
          createdAt: '2026-10-01T14:05:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Đa chấn thương do TNGT',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-012.34',
          doctor: 'BS. Lê Hoàng Long',
          handoverTime: '4.5 phút',
          disposition: 'Chuyển thẳng Phòng Mổ Cấp Cứu',
          status: 'COMPLETED',
          statusText: 'Đã hoàn tất bàn giao'
        },
        {
          code: 'CC-261001-012',
          createdAt: '2026-10-01T10:15:00',
          patientAgeGroup: 'ELDERLY',
          patientAgeGroupText: 'Người cao tuổi',
          patientGender: 'Nam',
          incidentName: 'Nhồi máu cơ tim cấp',
          severity: 'CRITICAL',
          severityText: 'Tối khẩn',
          vehiclePlate: '65A-014.22',
          doctor: 'BS. Phan Thị Mai',
          handoverTime: '3.5 phút',
          disposition: 'Chuyển thẳng DSA Tim Mạch',
          status: 'COMPLETED',
          statusText: 'Đã hoàn tất bàn giao'
        },
        {
          code: 'CC-261001-011',
          createdAt: '2026-10-01T08:30:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Suy hô hấp cấp / Dị vật đường thở',
          severity: 'EMERGENCY',
          severityText: 'Khẩn cấp',
          vehiclePlate: '65A-011.15',
          doctor: 'BS. Trần Văn Hậu',
          handoverTime: '4.0 phút',
          disposition: 'Nhập ICU Hồi sức Tích cực',
          status: 'COMPLETED',
          statusText: 'Đã hoàn tất bàn giao'
        },
        {
          code: 'CC-261001-009',
          createdAt: '2026-10-01T05:40:00',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: 'Nam',
          incidentName: 'Chấn thương ngã cao',
          severity: 'ROUTINE',
          severityText: 'Tiêu chuẩn',
          vehiclePlate: '65A-019.99',
          doctor: 'BS. Lê Hoàng Long',
          handoverTime: '5.1 phút',
          disposition: 'Theo dõi & Xử trí tại Khoa CC',
          status: 'COMPLETED',
          statusText: 'Đã hoàn tất bàn giao'
        }
      ];

      container.innerHTML = `
        <div class="view-container-full">
          <!-- Internal Tab Navigation (Clone app trung tâm: Tổng quan / Chi tiết) -->
          <div style="display:flex;gap:8px;border-bottom:1px solid var(--border-main);padding-bottom:10px;margin-bottom:16px;">
            <button class="btn ${activeTab === 'overview' ? 'btn-emergency' : 'btn-default'} btn-sm hosp-report-tab-btn" data-tab="overview">
              ${window.CCNV_UI.ICONS.barChart}
              <span>Tổng quan</span>
            </button>
            <button class="btn ${activeTab === 'detail' ? 'btn-emergency' : 'btn-default'} btn-sm hosp-report-tab-btn" data-tab="detail">
              ${window.CCNV_UI.ICONS.layers}
              <span>Chi tiết ca tiếp nhận</span>
              <span class="badge ${activeTab === 'detail' ? 'badge-emergency' : 'badge-normal'}" style="margin-left:4px;padding:1px 6px;font-size:11px;">${detailRecords.length}</span>
            </button>
          </div>

          <!-- Tab Content Mount Container -->
          <div id="hosp-report-pane"></div>
        </div>
      `;

      // Tab switcher event handlers
      container.querySelectorAll('.hosp-report-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-tab');
          this.renderHospitalReportsView(container, tab);
        });
      });

      const pane = container.querySelector('#hosp-report-pane');
      if (!pane) return;

      // ==========================================
      // TAB 1: TỔNG QUAN (KPIs, Thống kê, Biểu đồ 24h & Phân loại)
      // ==========================================
      if (activeTab === 'overview') {
        pane.innerHTML = `
          <!-- 1. Quick Stats & KPI Cards Grid -->
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;margin-bottom:18px;">
            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Tổng ca tiếp nhận</span>
                <span style="font-size:11px;color:#94A3B8;font-weight:600;background:rgba(148,163,184,0.12);padding:2px 6px;border-radius:4px;">+15.2% ↑</span>
              </div>
              <span class="kpi-value" style="color:var(--text-white);">582</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Hôm nay: <strong style="color:var(--text-white);">18 ca</strong> · Tháng này: <strong style="color:var(--text-white);">142 ca</strong>
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(248,113,113,0.15);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Ca tối khẩn (Đỏ / Cam)</span>
                <span style="font-size:11px;color:#F87171;font-weight:600;background:rgba(248,113,113,0.12);padding:2px 6px;border-radius:4px;">28.9%</span>
              </div>
              <span class="kpi-value" style="color:#F87171;">168</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Đột quỵ não, ngừng tim ngoại viện, đa chấn thương
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Thời gian bàn giao TB (Handover)</span>
                <span style="font-size:11px;color:#34D399;font-weight:600;background:rgba(52,211,153,0.12);padding:2px 6px;border-radius:4px;">Đạt chuẩn BYT</span>
              </div>
              <span class="kpi-value" style="color:#38BDF8;">4.2 phút</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Mục tiêu bàn giao tại Khoa Cấp cứu: &lt; 5 phút
              </div>
            </div>

            <div class="kpi-card" style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span class="kpi-label">Tiếp nhận chuyển ICU / Mổ</span>
                <span style="font-size:11px;color:#94A3B8;font-weight:600;background:rgba(148,163,184,0.12);padding:2px 6px;border-radius:4px;">50.0%</span>
              </div>
              <span class="kpi-value" style="color:var(--text-white);">291 ca</span>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
                Chuyển thẳng DSA, phòng mổ và buồng hồi sức tích cực
              </div>
            </div>
          </div>

          <!-- 2. Visual Charts Row (24-Hour Column Chart & Incident Breakdown - Quieter Style) -->
          <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-bottom:18px;">
            <!-- Column Chart: Cases by Time Slot -->
            <div class="content-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                  <h3 style="color:var(--text-white);font-size:14px;margin:0 0 2px 0;">Phân bố Số ca Tiếp nhận Cấp cứu theo Khung giờ</h3>
                  <span style="font-size:12px;color:var(--text-muted);">Cao điểm nhập viện Khoa Cấp cứu tập trung 17h-20h và đêm khuya</span>
                </div>
                <span class="badge badge-normal" style="font-size:11px;">24 Giờ</span>
              </div>

              <!-- 24-Hour Distribution Bar Chart -->
              <div style="height:210px;background:var(--bg-elevated);border-radius:6px;padding:16px 10px 8px 10px;border:1px solid var(--border-main);display:flex;flex-direction:column;justify-content:space-between;">
                <div style="flex:1;display:flex;align-items:flex-end;gap:3px;padding:0 2px;">
                  ${[
            { hour: '0h', count: 9, isPeak: false },
            { hour: '1h', count: 7, isPeak: false },
            { hour: '2h', count: 6, isPeak: false },
            { hour: '3h', count: 8, isPeak: false },
            { hour: '4h', count: 12, isPeak: false },
            { hour: '5h', count: 16, isPeak: false },
            { hour: '6h', count: 21, isPeak: false },
            { hour: '7h', count: 28, isPeak: false },
            { hour: '8h', count: 34, isPeak: false },
            { hour: '9h', count: 37, isPeak: false },
            { hour: '10h', count: 32, isPeak: false },
            { hour: '11h', count: 30, isPeak: false },
            { hour: '12h', count: 26, isPeak: false },
            { hour: '13h', count: 24, isPeak: false },
            { hour: '14h', count: 27, isPeak: false },
            { hour: '15h', count: 30, isPeak: false },
            { hour: '16h', count: 39, isPeak: false },
            { hour: '17h', count: 48, isPeak: true },
            { hour: '18h', count: 52, isPeak: true, isMax: true },
            { hour: '19h', count: 44, isPeak: true },
            { hour: '20h', count: 36, isPeak: false },
            { hour: '21h', count: 29, isPeak: false },
            { hour: '22h', count: 26, isPeak: false },
            { hour: '23h', count: 19, isPeak: false }
          ].map(b => {
            const pct = Math.round((b.count / 52) * 100);
            const bg = b.isMax
              ? '#38BDF8'
              : (b.isPeak
                ? 'rgba(56, 189, 248, 0.75)'
                : (b.count >= 30
                  ? '#475569'
                  : '#334155'));
            const valColor = b.isMax ? '#38BDF8' : (b.isPeak ? '#93C5FD' : '#64748B');
            const nextH = (parseInt(b.hour, 10) + 1) % 24;
            const titleText = `Khung giờ ${b.hour} - ${nextH}h: ${b.count} ca tiếp nhận${b.isMax ? ' (Đỉnh cao điểm)' : ''}`;
            return `
                      <div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;height:100%;justify-content:flex-end;" title="${titleText}">
                        <span style="font-size:8.5px;color:${valColor};font-weight:${b.isPeak ? '700' : '500'};font-family:var(--font-mono);line-height:1;">${b.count}</span>
                        <div style="width:100%;max-width:18px;height:${pct}%;background:${bg};border-radius:2px 2px 0 0;transition:all 0.2s ease;"></div>
                        <span style="font-size:9px;color:${b.isPeak ? '#CBD5E1' : '#64748B'};font-family:var(--font-mono);line-height:1;margin-top:2px;">${b.hour}</span>
                      </div>
                    `;
          }).join('')}
                </div>
              </div>
            </div>

            <!-- Horizontal Progress Bars: Incident Categories Breakdown (Tonal Palette) -->
            <div class="content-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 style="color:var(--text-white);font-size:14px;margin:0;">Cơ cấu Bệnh lý Tiếp nhận</h3>
                <span style="font-size:11px;color:var(--text-muted);">582 ca</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:12px;font-size:12.5px;">
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Tai nạn giao thông & Đa chấn thương</span>
                    <strong style="color:#38BDF8;font-family:var(--font-mono);">42% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(244 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:42%;height:100%;background:#38BDF8;border-radius:3px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Đột quỵ não & Tim mạch cấp (DSA)</span>
                    <strong style="color:#93C5FD;font-family:var(--font-mono);">26% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(151 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:26%;height:100%;background:rgba(56, 189, 248, 0.75);border-radius:3px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Suy hô hấp cấp / Dị vật đường thở</span>
                    <strong style="color:#CBD5E1;font-family:var(--font-mono);">18% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(105 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:18%;height:100%;background:rgba(56, 189, 248, 0.5);border-radius:3px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="color:var(--text-white);">Tai nạn sinh hoạt, ngã cao & Khác</span>
                    <strong style="color:var(--text-muted);font-family:var(--font-mono);">14% <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">(82 ca)</span></strong>
                  </div>
                  <div style="height:6px;background:var(--bg-main);border-radius:3px;overflow:hidden;">
                    <div style="width:14%;height:100%;background:rgba(148, 163, 184, 0.35);border-radius:3px;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Bottom Row: Disposition after Handover & Top Ambulances Delivering -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <!-- Disposition after ER Handover (Refined Clean Metrics) -->
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Phân loại Hướng xử trí sau Bàn giao Cấp cứu</h3>
              <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:12px;text-align:center;">
                <div style="background:var(--bg-elevated);padding:14px;border-radius:6px;border:1px solid var(--border-main);">
                  <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:var(--text-white);margin-bottom:4px;">28%</div>
                  <div style="font-size:12px;color:#38BDF8;font-weight:500;">Nhập viện Hồi sức Tích cực (ICU)</div>
                </div>
                <div style="background:var(--bg-elevated);padding:14px;border-radius:6px;border:1px solid var(--border-main);">
                  <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:var(--text-white);margin-bottom:4px;">22%</div>
                  <div style="font-size:12px;color:#F87171;font-weight:500;">Chuyển thẳng Phòng Mổ Cấp Cứu</div>
                </div>
                <div style="background:var(--bg-elevated);padding:14px;border-radius:6px;border:1px solid var(--border-main);">
                  <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:var(--text-white);margin-bottom:4px;">36%</div>
                  <div style="font-size:12px;color:#34D399;font-weight:500;">Theo dõi & Xử trí tại Khoa CC</div>
                </div>
                <div style="background:var(--bg-elevated);padding:14px;border-radius:6px;border:1px solid var(--border-main);">
                  <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:var(--text-white);margin-bottom:4px;">14%</div>
                  <div style="font-size:12px;color:#FBBF24;font-weight:500;">Chuyển Viện Tuyến Trên</div>
                </div>
              </div>
            </div>

            <!-- Top Delivering Ambulances / Stations (Quiet Clean Ranking) -->
            <div class="content-card">
              <h3 style="color:var(--text-white);font-size:14px;margin-bottom:12px;">Top Đội xe Cứu thương Chuyển viện đến</h3>
              <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-white);width:22px;height:22px;border-radius:4px;background:rgba(255,255,255,0.08);display:inline-flex;align-items:center;justify-content:center;font-size:11px;">01</span>
                    <span style="color:var(--text-white);font-weight:500;">Đội xe Cấp cứu 115 Trung tâm</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <strong style="color:var(--text-white);font-family:var(--font-mono);">${(312).toLocaleString()} ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(53.6%)</span>
                  </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-slate);width:22px;height:22px;border-radius:4px;background:rgba(255,255,255,0.05);display:inline-flex;align-items:center;justify-content:center;font-size:11px;">02</span>
                    <span style="color:var(--text-white);font-weight:500;">Đội xe Cấp cứu Trạm Ninh Kiều</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <strong style="color:var(--text-white);font-family:var(--font-mono);">${(146).toLocaleString()} ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(25.1%)</span>
                  </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-slate);width:22px;height:22px;border-radius:4px;background:rgba(255,255,255,0.05);display:inline-flex;align-items:center;justify-content:center;font-size:11px;">03</span>
                    <span style="color:var(--text-white);font-weight:500;">Xe Cấp cứu BV Đa khoa Cái Răng</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <strong style="color:var(--text-white);font-family:var(--font-mono);">${(68).toLocaleString()} ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(11.7%)</span>
                  </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--border-main);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-slate);width:22px;height:22px;border-radius:4px;background:rgba(255,255,255,0.05);display:inline-flex;align-items:center;justify-content:center;font-size:11px;">04</span>
                    <span style="color:var(--text-white);font-weight:500;">Xe Cấp cứu Tư nhân / Chuyển viện Huyện</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <strong style="color:var(--text-white);font-family:var(--font-mono);">${(56).toLocaleString()} ca</strong>
                    <span style="font-size:11px;color:var(--text-muted);">(9.6%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // ==========================================
      // TAB 2: CHI TIẾT (Bản ghi, Search, Sort, Filter, Phân trang, Xuất Excel)
      // ==========================================
      else if (activeTab === 'detail') {
        pane.innerHTML = `
          <div class="content-card" style="padding:0;overflow:visible;">
            <div id="hosp-report-detail-table-mount"></div>
          </div>
        `;

        new window.CCNV_UI.DataTable({
          containerId: 'hosp-report-detail-table-mount',
          data: detailRecords,
          pageSize: 10,
          exportTitle: `Báo cáo Chi tiết Tiếp nhận Cấp cứu Ngoại viện - ${hosp.name}`,
          enableExport: true,
          showSortSelect: true,
          searchPlaceholder: 'Tìm mã ca, nhóm độ tuổi, chẩn đoán, xe chuyển, bác sĩ...',
          defaultSortKey: 'createdAt',
          defaultSortOrder: 'desc',
          filterOptions: [
            { label: 'Tất cả mức độ', value: 'ALL', filterFn: () => true },
            { label: 'Tối khẩn', value: 'CRITICAL', filterFn: item => item.severity === 'CRITICAL' },
            { label: 'Khẩn cấp', value: 'EMERGENCY', filterFn: item => item.severity === 'EMERGENCY' },
            { label: 'Tiêu chuẩn', value: 'ROUTINE', filterFn: item => item.severity === 'ROUTINE' },
            { label: 'Hoàn tất bàn giao', value: 'COMPLETED', filterFn: item => item.status === 'COMPLETED' },
            { label: 'Đang tiếp nhận', value: 'IN_PROGRESS', filterFn: item => item.status === 'IN_PROGRESS' }
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
              title: 'Thời điểm đến',
              sortable: true,
              render: item => `<span style="font-family:var(--font-mono);font-size:12px;color:var(--text-white);white-space:nowrap;display:inline-block;">${this.formatDateTime(item.createdAt)}</span>`
            },
            {
              key: 'patientAgeGroupText',
              title: 'Nạn nhân',
              sortable: true,
              render: item => `<strong>${item.patientAgeGroupText || 'Người trưởng thành'}</strong> <span style="font-size:11.5px;color:var(--text-muted);">(${item.patientGender || 'Nam'})</span>`
            },
            {
              key: 'incidentName',
              title: 'Chẩn đoán sơ bộ',
              sortable: true,
              render: item => `<span>${item.incidentName}</span>`
            },
            {
              key: 'severity',
              title: 'Mức độ',
              sortable: true,
              render: item => {
                if (item.severity === 'CRITICAL') return `<span class="badge badge-emergency" style="font-size:11px;">Tối khẩn</span>`;
                if (item.severity === 'EMERGENCY') return `<span class="badge badge-warning" style="font-size:11px;">Khẩn cấp</span>`;
                return `<span class="badge badge-normal" style="font-size:11px;">Tiêu chuẩn</span>`;
              }
            },
            {
              key: 'vehiclePlate',
              title: 'Xe chuyển đến',
              sortable: true,
              render: item => `<span style="font-family:var(--font-mono);font-weight:600;color:var(--text-white);">${item.vehiclePlate}</span>`
            },
            {
              key: 'doctor',
              title: 'Bác sĩ tiếp nhận',
              sortable: false,
              render: item => `<span style="color:#93C5FD;font-weight:500;">${item.doctor}</span>`
            },
            {
              key: 'handoverTime',
              title: 'TG Bàn giao',
              sortable: true,
              render: item => `<span style="font-family:var(--font-mono);color:#10B981;font-weight:600;">${item.handoverTime}</span>`
            },
            {
              key: 'disposition',
              title: 'Hướng xử trí',
              sortable: true,
              render: item => `<span style="font-size:12px;color:var(--text-slate);">${item.disposition}</span>`
            },
            {
              key: 'status',
              title: 'Trạng thái',
              sortable: true,
              render: item => {
                if (item.status === 'COMPLETED') return `<span class="status-pill status-pill-completed">Đã tiếp nhận</span>`;
                return `<span class="status-pill status-pill-emergency">Đang tiếp nhận</span>`;
              }
            }
          ]
        }).render();
      }
    }

    renderHospitalReportDetailView(container) {
      this.renderHospitalReportsView(container, 'detail');
    }

    renderHospitalReportStatsView(container) {
      this.renderHospitalReportsView(container, 'overview');
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
            <span style="display:inline-flex;align-items:center;gap:6px;">${window.CCNV_UI?.ICONS?.alertTriangle || ''}<span>CHẾ ĐỘ TẬP TRUNG XỬ LÝ KHẨN CẤP</span></span>
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
              <div class="form-grid-2" style="margin-top:10px;">
                <div class="form-field">
                  <label class="form-label">Nhóm độ tuổi</label>
                  <select id="form-patient-age-group">
                    <option value="INFANT">Sơ sinh</option>
                    <option value="CHILD">Trẻ em</option>
                    <option value="ADULT" selected>Người trưởng thành</option>
                    <option value="ELDERLY">Người cao tuổi</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">Giới tính</label>
                  <select id="form-patient-gender">
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Chưa rõ">Chưa rõ</option>
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
                <label class="form-label" style="display:block;margin-bottom:4px;">Gợi ý điểm đến thành phố Cần Thơ:</label>
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
                      ${inc.name} - [Gợi ý: ${inc.suggestedType}]
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
                    <kbd class="quick-kbd kbd-red" style="margin-right:4px;">1</kbd> TỐI KHẨN
                  </button>
                  <button type="button" class="severity-btn sev-emergency" data-sev="EMERGENCY">
                    <kbd class="quick-kbd kbd-amber" style="margin-right:4px;">2</kbd> KHẨN CẤP
                  </button>
                  <button type="button" class="severity-btn sev-routine" data-sev="ROUTINE">
                    <kbd class="quick-kbd kbd-emerald" style="margin-right:4px;">3</kbd> THƯỜNG
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
                <strong>GỢI Ý TỰ ĐỘNG:</strong> Xe 65A-016.88 cách 1.4km · ETA ~4 phút · BVĐK thành phố Cần Thơ sẵn sàng phòng mổ sọ não
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
        const patientAgeGroup = drawerOverlay.querySelector('#form-patient-age-group')?.value || 'ADULT';
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

        const ageGroupMap = {
          'INFANT': 'Sơ sinh',
          'CHILD': 'Trẻ em',
          'ADULT': 'Người trưởng thành',
          'ELDERLY': 'Người cao tuổi'
        };

        const newCase = window.StateManager.createCase({
          callerName: caller,
          callerPhone: phone,
          patient: {
            ageGroup: patientAgeGroup,
            ageGroupText: ageGroupMap[patientAgeGroup] || 'Người trưởng thành',
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
            hospitalName: targetHosp ? targetHosp.name : 'Bệnh viện ĐK thành phố Cần Thơ'
          }
        });

        closeDrawer();
        window.CCNV_UI.Toast.show(
          `Đã tạo ca ${newCase.code}`,
          `Phát lệnh tới xe ${vehiclePlate} và gửi cảnh báo trước tới ${targetHosp?.name || 'Bệnh viện tiếp nhận'}`,
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
        <div>
          <div style="font-size:15px;font-weight:700;color:#FFF;">
            ${scenario.callerPhone} - ${scenario.callerName}
          </div>
          <div style="font-size:12px;color:#CBD5E1;">${scenario.address}</div>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-emergency btn-sm" id="btn-answer-call">Xác nhận cuộc gọi</button>
          <button class="btn btn-default btn-sm" id="btn-dismiss-call">Bỏ qua</button>
        </div>
      `;

      alertBox.querySelector('#btn-answer-call')?.addEventListener('click', () => {
        alertBox.remove();
        window.StateManager.addAuditLog(`Xác nhận tiếp nhận cuộc gọi từ ${scenario.callerPhone}`);
        this.openCreateCaseDrawer(scenario);
      });

      alertBox.querySelector('#btn-dismiss-call')?.addEventListener('click', () => {
        alertBox.remove();
      });
    }

    // --- 9. CASE DETAIL MODAL WITH 7 TABS (TT-08) ---
    openCaseDetailModal(caseId, fallbackCase = null) {
      const state = window.StateManager.getState();
      let c = state.cases.find(item => item.id === caseId || item.code === caseId);
      if (!c && fallbackCase) {
        c = fallbackCase;
      }
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
            patient: { ageGroup: h.patientAgeGroup || 'ADULT', ageGroupText: h.patientAgeGroupText || 'Người trưởng thành', gender: h.patientGender || 'Nam', history: 'Không có tiền sử dị ứng' },
            location: { address: h.locationAddress || 'Khu vực thành phố Cần Thơ' },
            incident: { name: h.incidentName, severity: h.severity || 'ROUTINE', description: 'Đã hoàn tất vận chuyển và bàn giao người bệnh' },
            dispatch: { vehiclePlate: h.vehiclePlate || '-', crewName: h.crewName || 'Kíp trực 115', hospitalName: h.hospitalName || '-' },
            epcr: h.epcr || { chiefComplaint: h.incidentName, diagnosis: h.incidentName, treatment: 'Sơ cứu tại hiện trường và hỗ trợ hô hấp, huyết động trên đường vận chuyển.' },
            milestones: [
              { name: 'Tiếp nhận cuộc gọi', time: this.formatDateTime(h.createdAt), done: true },
              { name: 'Xuất phát', time: '-', done: true },
              { name: 'Đến hiện trường', time: '-', done: true },
              { name: 'Bàn giao tại viện', time: this.formatDateTime(h.completedAt), done: true }
            ],
            logs: [
              { time: this.formatDateTime(h.createdAt), user: 'dpv01', action: `Tiếp nhận yêu cầu và phát lệnh điều xe ${h.vehiclePlate || ''}` },
              { time: this.formatDateTime(h.completedAt), user: 'Khoa Cấp cứu', action: `Bàn giao bệnh nhân tại ${h.hospitalName || 'Bệnh viện'}. Hoàn tất ca.` }
            ]
          };
        }
      }
      c = c || fallbackCase || state.cases[0];
      if (!c) return;

      this.selectedCaseId = c.id;
      let modalOverlay = document.getElementById('case-detail-modal-overlay');
      const contentContainer = document.querySelector('.content-body') || document.body;
      if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'case-detail-modal-overlay';
        modalOverlay.className = 'modal-overlay case-detail-in-body';
        contentContainer.appendChild(modalOverlay);
      } else if (modalOverlay.parentElement !== contentContainer) {
        contentContainer.appendChild(modalOverlay);
      }
      modalOverlay.style.display = '';

      // Cập nhật Breadcrumb trên thanh top header: thêm '/ Chi tiết ca cấp cứu'
      const headerLeft = document.querySelector('.header-left');
      const originalHeaderLeftHtml = headerLeft ? headerLeft.innerHTML : null;
      if (headerLeft) {
        const currentBreadcrumb = headerLeft.querySelector('div');
        if (currentBreadcrumb && !headerLeft.textContent.includes('Chi tiết ca cấp cứu')) {
          currentBreadcrumb.style.cursor = 'pointer';
          currentBreadcrumb.title = 'Nhấn để quay lại màn hình trước';
          currentBreadcrumb.onclick = (e) => {
            if (e.target.closest('#breadcrumb-case-detail-item')) return;
            this.closeCaseDetailModal();
          };

          const detailSpan = document.createElement('span');
          detailSpan.id = 'breadcrumb-case-detail-item';
          detailSpan.style.display = 'inline-flex';
          detailSpan.style.alignItems = 'center';
          detailSpan.style.gap = '8px';
          detailSpan.innerHTML = `
            <span style="color:var(--text-muted);font-size:11px;">/</span>
            <span style="color:var(--accent-cyan);font-weight:600;">Chi tiết ca cấp cứu</span>`;
          currentBreadcrumb.appendChild(detailSpan);
          detailSpan.querySelector('#btn-breadcrumb-close-case')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            this.closeCaseDetailModal();
          });
        }
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
        : (c.status === 'CANCELLED' ? `Đã hủy ca ` : '<span class="badge badge-warning" style="animation:pulse 2s infinite;padding:2px 8px;font-size:11px;">Đang xử lý cấp cứu</span>');

      const receiverName = c.hospitalReceiver || `BS. Trực Cấp cứu (${c.dispatch?.hospitalName || 'BV Đa khoa thành phố Cần Thơ'})`;

      let processingResult = '';
      if (c.status === 'COMPLETED') {
        processingResult = `<span style="color:var(--emerald-light);font-weight:600;display:inline-flex;align-items:center;gap:4px;">${window.CCNV_UI?.ICONS?.check || ''}<span>Tiếp nhận an toàn tại Khoa Cấp cứu</span></span>`;
      } else if (c.status === 'CANCELLED') {
        processingResult = `<span style="color:var(--red-light);font-weight:600;">Đã hủy</span>`;
      } else if (c.status === 'TRANSPORTING') {
        processingResult = `<span style="color:var(--amber-light);font-weight:600;">Đang vận chuyển khẩn cấp đến BV (ETA: ${c.eta || '6 phút'})</span>`;
      } else {
        processingResult = `<span style="color:var(--blue-light);font-weight:600;">Đang tiếp cận & sơ cứu ban đầu</span>`;
      }

      // Crews info
      const crewObj = (state.crews || []).find(cr => cr.id === c.dispatch?.crewId || cr.name === c.dispatch?.crewName) || {
        name: c.dispatch?.crewName || 'Kíp 1 - Ninh Kiều',
        doctor: 'BS. CKI. Nguyễn Văn Thành',
        nurse: 'ĐD. Trần Thị Mai',
        driver: 'Lê Văn Hùng'
      };

      modalOverlay.innerHTML = `
        <div class="modal-box" style="position:absolute;inset:0;width:100%;height:100%;max-width:100%;max-height:100%;border-radius:0;border:none;display:flex;flex-direction:column;background:var(--bg-panel);overflow:hidden;z-index:60;">
          <!-- 1. PHẦN TỔNG QUAN: KHUNG THÔNG TIN TỔNG QUAN ĐIỀU HÀNH (GỌN GÀNG, LABEL & VALUE CÙNG 1 DÒNG) -->
          <div style="flex-shrink:0;background:var(--bg-panel);border-bottom:1px solid var(--border-main);padding:10px 24px;">
            <div style="background:var(--bg-elevated);border-radius:8px;border:1px solid var(--border-main);padding:10px 18px;">
              <!-- Header của Khung: Tiêu đề + Mã ca + Trạng thái ca -->
              <div style="display:flex;align-items:center;border-bottom:1px solid var(--border-main);padding-bottom:8px;margin-bottom:8px;">
                <div style="font-size:12.5px;font-weight:700;color:var(--text-white);text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;gap:8px;">
                  <span style="color:var(--accent-cyan);display:inline-flex;">${window.CCNV_UI?.ICONS?.activity || ''}</span>
                  <span>THÔNG TIN TỔNG QUAN ĐIỀU HÀNH CA CẤP CỨU</span>
                  <span style="margin-left:6px;font-family:var(--font-mono);color:var(--accent-cyan);font-size:13px;">${c.code}</span>
                  <span style="margin-left:6px;">${window.CCNV_UI.Badges.forCaseStatus(c.status)}</span>
                </div>
              </div>

              <!-- Lưới 4 cột - Mỗi thông tin hiển thị gọn trên cùng 1 dòng (Label: Value) -->
              <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px 20px;font-size:12px;">
                <!-- Cột 1 -->
                <div style="display:flex;flex-direction:column;gap:5px;">
                  <div style="display:flex;align-items:center;gap:6px;min-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    <span style="color:var(--text-slate);font-size:11.5px;flex-shrink:0;">1. ID BN:</span>
                    <span class="badge badge-accent" style="font-family:var(--font-mono);font-weight:700;font-size:11.5px;padding:1px 6px;">${c.patient?.id || 'BN-' + c.code}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;min-height:22px;white-space:nowrap;">
                    <span style="color:var(--text-slate);font-size:11.5px;flex-shrink:0;">2. Cuộc gọi:</span>
                    <strong style="color:var(--text-white);font-family:var(--font-mono);font-size:12px;">${callTime}</strong>
                  </div>
                </div>

                <!-- Cột 2 -->
                <div style="display:flex;flex-direction:column;gap:5px;">
                  <div style="display:flex;align-items:center;gap:6px;min-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    <span style="color:var(--text-slate);font-size:11.5px;flex-shrink:0;">3. Tiếp nhận:</span>
                    <strong style="color:var(--text-white);font-size:12px;">${c.dispatch?.dispatcherName || 'Nguyễn Văn An'}</strong>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;min-height:22px;white-space:nowrap;">
                    <span style="color:var(--text-slate);font-size:11.5px;flex-shrink:0;">4. Gọi xe:</span>
                    <strong style="color:var(--text-white);font-family:var(--font-mono);font-size:12px;">${dispatchTime}</strong>
                  </div>
                </div>

                <!-- Cột 3 -->
                <div style="display:flex;flex-direction:column;gap:5px;">
                  <div style="display:flex;align-items:center;gap:6px;min-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    <span style="color:var(--text-slate);font-size:11.5px;flex-shrink:0;">5. Điều xe:</span>
                    <span class="badge badge-accent" style="font-family:var(--font-mono);font-weight:700;font-size:11.5px;padding:1px 6px;">${c.dispatch?.vehiclePlate || '65A-012.34'}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;min-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    <span style="color:var(--text-slate);font-size:11.5px;flex-shrink:0;">6. BV đích:</span>
                    <strong style="color:var(--text-white);font-size:12px;" title="${c.dispatch?.hospitalName || 'Bệnh viện Đa khoa thành phố Cần Thơ'}">${c.dispatch?.hospitalName || 'Bệnh viện Đa khoa thành phố Cần Thơ'}</strong>
                  </div>
                </div>

                <!-- Cột 4 -->
                <div style="display:flex;flex-direction:column;gap:5px;">
                  <div style="display:flex;align-items:center;gap:6px;min-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    <span style="color:var(--text-slate);font-size:11.5px;flex-shrink:0;">7. Người nhận:</span>
                    <strong style="color:var(--text-white);font-size:12px;" title="${receiverName}">${receiverName}</strong>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;min-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    <span style="color:var(--text-slate);font-size:11.5px;flex-shrink:0;">8. Kết quả:</span>
                    <div style="font-size:12px;">${processingResult}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. THANH ĐIỀU HƯỚNG TABS CHI TIẾT (FULL WIDTH) & ACTION CONTROLS -->
          <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-elevated);border-bottom:1px solid var(--border-main);padding:0 24px;flex-shrink:0;">
            <div style="display:flex;align-items:center;">
              <button class="panel-tab-btn active" data-tab="tab-overview" style="padding:10px 22px;font-size:13px;font-weight:600;">Tổng quan</button>
              <button class="panel-tab-btn" data-tab="tab-dispatch" style="padding:10px 22px;font-size:13px;font-weight:600;">Phân công / Điều phối</button>
              <button class="panel-tab-btn" data-tab="tab-documents" style="padding:10px 22px;font-size:13px;font-weight:600;">Hồ sơ</button>
              <button class="panel-tab-btn" data-tab="tab-logs" style="padding:10px 22px;font-size:13px;font-weight:600;">Lịch sử</button>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0;">
              <button class="btn btn-ghost btn-sm" id="btn-close-case-modal" title="Đóng toàn màn hình (Esc)" style="width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:6px;background:rgba(255,255,255,0.06);color:var(--text-white);">
                ${window.CCNV_UI.ICONS.x}
              </button>
            </div>
          </div>

          <!-- 4. MODAL BODY (CHIẾM TRỌN KHÔNG GIAN CÒN LẠI CỦA MÀN HÌNH) -->
          <div class="modal-body" id="case-modal-body-content" style="flex:1;overflow-y:auto;padding:20px 24px;background:rgba(5,13,24,0.3);"></div>

        </div>
      `;

      modalOverlay.classList.add('active');

      const renderTab = (tabName) => {
        const body = modalOverlay.querySelector('#case-modal-body-content');
        if (!body) return;

        if (this.modalMapInstance) {
          this.modalMapInstance.destroy();
          this.modalMapInstance = null;
        }

        // --- TAB 1: TỔNG QUAN (Layout 50/50: Nửa Trái là Lâm sàng BN - Nửa Phải là Bản đồ GIS Thật) ---
        if (tabName === 'tab-overview') {
          const isPendingAccept = this.isHospitalMode() && (!state.cases.some(item => item.id === c.id || item.code === c.code) || c.hospitalResponse !== 'ACCEPTED');
          body.innerHTML = `
            ${isPendingAccept ? `
              <div style="background: linear-gradient(90deg, rgba(239,68,68,0.18), rgba(245,158,11,0.12)); border: 1px solid rgba(239,68,68,0.45); border-radius: 8px; padding: 12px 18px; display:flex; align-items:center; justify-content:space-between; margin-bottom: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.25);">
                <div style="display:flex;align-items:center;gap:12px;">
                  <span style="display:inline-flex;color:var(--red-vivid);transform:scale(1.3);">${window.CCNV_UI?.ICONS?.ambulance || ''}</span>
                  <div>
                    <strong style="color:var(--red-vivid);font-size:14px;letter-spacing:0.3px;display:block;">XE CẤP CỨU ĐANG ĐẾN - CHỜ KHOA CẤP CỨU XÁC NHẬN TIẾP NHẬN</strong>
                    <div style="color:var(--text-light);font-size:12px;margin-top:2px;">
                      Bệnh nhân đang được vận chuyển khẩn cấp từ hiện trường (Dự kiến đến sau 4 phút). Nhấn <strong>"Tiếp nhận ca cấp cứu"</strong> để đưa ca vào danh sách cấp cứu chính thức.
                    </div>
                  </div>
                </div>
                <button class="btn btn-emergency btn-sm" id="btn-tab-overview-confirm-hospital-case" style="font-weight:700;padding:8px 20px;white-space:nowrap;box-shadow:0 0 15px rgba(239,68,68,0.4);display:flex;align-items:center;gap:6px;">
                  ${window.CCNV_UI?.ICONS?.check || ''}
                  <span>Tiếp nhận ca cấp cứu</span>
                </button>
              </div>
            ` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch;height:100%;">
              
              <!-- NỬA TRÁI (50% LAYOUT): THÔNG TIN NGƯỜI BỆNH, LÂM SÀNG & SINH HIỆU -->
              <div style="display:flex;flex-direction:column;gap:14px;min-width:0;">
                
                <!-- 1. THÔNG TIN CHUNG NGƯỜI BỆNH -->
                <div class="form-section">
                  <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span>THÔNG TIN CHUNG NGƯỜI BỆNH</span>
                      <span class="badge badge-accent">ID: ${c.patient?.id || 'BN-' + c.code}</span>
                    </div>
                  </div>

                  <!-- Central Quick Edit Form for Dispatcher / Doctor -->
                  <div id="box-edit-patient-central" style="display:none;background:rgba(8,24,39,0.95);border:1px solid var(--accent-cyan);border-radius:8px;padding:12px;margin-bottom:12px;">
                    <div style="font-size:11px;color:var(--accent-cyan);font-weight:700;margin-bottom:8px;text-transform:uppercase;display:flex;align-items:center;gap:6px;">
                      <span style="display:inline-flex;">${window.CCNV_UI?.ICONS?.activity || ''}</span>
                      <span>ĐIỀU PHỐI VIÊN 115 CẬP NHẬT & ĐỒNG BỘ THÔNG TIN BỆNH NHÂN:</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                      <div>
                        <label style="font-size:10.5px;color:var(--text-slate);display:block;margin-bottom:2px;">Nhóm độ tuổi</label>
                        <select id="central-input-patient-age-group" class="form-select" style="padding:4px 8px;font-size:12px;width:100%;background:#061421;border:1px solid var(--border-accent);color:#FFFFFF;border-radius:4px;">
                          <option value="INFANT" ${c.patient?.ageGroup === 'INFANT' ? 'selected' : ''}>Sơ sinh</option>
                          <option value="CHILD" ${c.patient?.ageGroup === 'CHILD' ? 'selected' : ''}>Trẻ em</option>
                          <option value="ADULT" ${(!c.patient?.ageGroup || c.patient?.ageGroup === 'ADULT') ? 'selected' : ''}>Người trưởng thành</option>
                          <option value="ELDERLY" ${c.patient?.ageGroup === 'ELDERLY' ? 'selected' : ''}>Người cao tuổi</option>
                        </select>
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
                    </div>
                    <div>
                      <label style="font-size:10.5px;color:var(--text-slate);display:block;margin-bottom:2px;">Chẩn đoán sơ bộ / Triệu chứng</label>
                      <input type="text" id="central-input-patient-symptom" value="${c.patient?.symptom || c.incident?.description || ''}" class="form-input" style="padding:4px 8px;font-size:12px;width:100%;background:#061421;border:1px solid var(--border-accent);color:#FFFFFF;border-radius:4px;" />
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
                      <button class="btn btn-default btn-xs" id="btn-cancel-edit-patient-central" style="padding:4px 10px;">Hủy</button>
                      <button class="btn btn-emergency btn-xs" id="btn-save-patient-central" style="padding:4px 14px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
                        <span>LƯU & PHÁT ĐỒNG BỘ VỀ KÍP XE</span>
                        ${window.CCNV_UI?.ICONS?.send || ''}
                      </button>
                    </div>
                  </div>
                  
                  <div style="display:flex;gap:14px;margin-bottom:10px;align-items:center;background:rgba(255,255,255,0.02);padding:8px 12px;border-radius:8px;border:1px solid var(--border-main);">
                    <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg, #1e293b, #0f172a);border:2px solid var(--border-accent);display:flex;align-items:center;justify-content:center;color:#94a3b8;flex-shrink:0;">
                      <span style="display:inline-flex;transform:scale(1.2);">${window.CCNV_UI?.ICONS?.user || ''}</span>
                    </div>
                    <div style="flex:1;min-width:0;">
                      <div style="font-size:15px;font-weight:700;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Nạn nhân (${c.patient?.ageGroupText || 'Người trưởng thành'})</div>
                      <div style="font-size:12px;color:var(--text-slate);margin-top:2px;">
                        Nhóm độ tuổi: <strong style="color:var(--text-light);">${c.patient?.ageGroupText || 'Người trưởng thành'}</strong> · 
                        Giới tính: <strong style="color:var(--text-light);">${c.patient?.gender || '-'}</strong>
                      </div>
                    </div>
                  </div>

                  <div style="display:flex;flex-direction:column;gap:8px;padding:6px 0;">
                    <div style="display:flex;align-items:center;font-size:12px;">
                      <span style="width:140px;flex-shrink:0;color:var(--text-slate);">Địa chỉ hiện trường:</span>
                      <strong style="color:var(--text-white);">${c.location?.address || 'Chưa có thông tin'}</strong>
                    </div>
                    <div style="display:flex;align-items:center;font-size:12px;">
                      <span style="width:140px;flex-shrink:0;color:var(--text-slate);">Số điện thoại BN:</span>
                      <span style="font-family:var(--font-mono);font-size:12.5px;color:var(--accent-cyan);font-weight:600;">${c.patient?.phone || c.callerPhone || '-'}</span>
                    </div>
                    <div style="display:flex;align-items:center;font-size:12px;">
                      <span style="width:140px;flex-shrink:0;color:var(--text-slate);">CCCD / BHYT:</span>
                      <div><span style="font-family:var(--font-mono);">${c.patient?.nationalId || '092095001234'}</span> · <span style="font-family:var(--font-mono);color:var(--emerald-light);">${c.patient?.insuranceCode || 'GD4929210088992'}</span></div>
                    </div>
                  </div>
                </div>

                <!-- 2. NGUYÊN NHÂN & LÂM SÀNG -->
                <div class="form-section">
                  <div class="form-section-title">
                    <span>NGUYÊN NHÂN & LÂM SÀNG</span>
                  </div>

                  <div style="display:flex;flex-direction:column;gap:8px;padding:4px 0;">
                    <div style="display:flex;align-items:baseline;font-size:12px;gap:6px;">
                      <span style="color:var(--text-slate);white-space:nowrap;">Loại hình / Hoàn cảnh:</span>
                      <strong style="color:var(--text-white);">${c.incident?.name || 'Tai nạn giao thông'}</strong>
                    </div>

                    <div style="display:flex;align-items:baseline;font-size:12px;gap:6px;">
                      <span style="color:var(--text-slate);white-space:nowrap;flex-shrink:0;">Triệu chứng tiếp nhận:</span>
                      <strong style="color:var(--text-white);font-weight:600;line-height:1.45;">
                        ${(c.patient?.symptom && c.patient.symptom !== c.incident?.name) ? c.patient.symptom : (c.incident?.description || 'Nạn nhân va chạm giao thông tốc độ cao, đa chấn thương phần mềm và xây xát cẳng tay, tỉnh táo, đau tức ngực nhẹ.')}
                      </strong>
                    </div>

                    <div style="display:flex;align-items:baseline;font-size:12px;gap:6px;">
                      <span style="color:var(--text-slate);white-space:nowrap;">Tình trạng tri giác:</span>
                      <strong style="color:var(--text-white);">Tỉnh táo, tiếp xúc tốt</strong>
                    </div>
                  </div>
                </div>

                <!-- 3. DẤU HIỆU SINH TỒN NGOẠI VIỆN -->
                <div class="form-section">
                  <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                    <span>DẤU HIỆU SINH TỒN NGOẠI VIỆN</span>
                    <span class="badge badge-emerald">THEO DÕI TRỰC TIẾP</span>
                  </div>

                  <!-- 6 Ô SINH TỒN NGOẠI VIỆN -->
                  <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:10px;">
                    <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;padding:6px 8px;text-align:center;">
                      <div style="font-size:10px;color:var(--text-slate);">Mạch</div>
                      <div style="font-size:15px;font-weight:700;color:var(--text-white);font-family:var(--font-mono);margin-top:1px;">${c.epcr?.vitals?.pulse || 88} <span style="font-size:9.5px;color:var(--text-muted);font-weight:normal;">bpm</span></div>
                    </div>
                    <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:6px;padding:6px 8px;text-align:center;">
                      <div style="font-size:10px;color:var(--text-slate);">Huyết áp</div>
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
                </div>

              </div>

              <!-- NỬA PHẢI (50% LAYOUT): BẢN ĐỒ GIS GIÁM SÁT THỜI GIAN THỰC LỚN (REUSE CANTHOMAP) -->
              <div class="form-section" style="display:flex;flex-direction:column;padding:0;overflow:hidden;background:#06101c;border:1px solid var(--border-accent);min-height:550px;min-width:0;">
                <!-- Header mini map -->
                <div style="height:36px;background:rgba(7,19,32,0.92);backdrop-filter:blur(8px);z-index:10;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:11.5px;color:var(--text-slate);flex-shrink:0;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 10px #10b981;"></span>
                    <strong style="color:var(--text-white);letter-spacing:0.8px;">GIÁM SÁT GIS TRỰC TUYẾN 115</strong>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                  </div>
                </div>

                <!-- GIS Map Viewport (Mounted with CanThoMap Leaflet Engine) -->
                <div id="modal-overview-map-viewport" class="map-svg-wrapper" style="flex:1;position:relative;width:100%;min-height:480px;height:100%;"></div>

                <!-- Footer mini map -->
                <div style="height:34px;background:rgba(7,19,32,0.92);backdrop-filter:blur(8px);z-index:10;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-top:1px solid rgba(255,255,255,0.08);font-size:11.5px;flex-shrink:0;">
                  <span style="color:var(--text-slate);display:flex;align-items:center;gap:6px;">
                    <strong style="color:var(--text-white);">${c.location?.address ? c.location.address : 'Khu vực thành phố Cần Thơ'}</strong>
                  </span>
                  <span style="color:var(--accent-amber);font-weight:700;font-size:12px;">ETA đến BV: ~${c.eta || '6 phút'}</span>
                </div>
              </div>

            </div>
          `;

          // Mount CanThoMap GIS thật vào Modal
          setTimeout(() => {
            const mapMount = body.querySelector('#modal-overview-map-viewport');
            if (!mapMount) return;
            if (this.modalMapInstance) {
              this.modalMapInstance.destroy();
              this.modalMapInstance = null;
            }
            this.modalMapInstance = new window.CanThoMap('modal-overview-map-viewport', {
              isHospital: this.isHospitalMode(),
              hospitalId: myHospId,
              hospitalName: myHospName
            });
            this.modalMapInstance.render();

            const plate = c.dispatch?.vehiclePlate;
            const caseCoords = c.location?.coords;
            const hosp = (state.hospitals || []).find(h => h.id === c.dispatch?.hospitalId || h.name === c.dispatch?.hospitalName);
            const hospCoords = hosp?.coords;

            const focusOnCase = () => {
              if (!this.modalMapInstance?.map) return;
              this.modalMapInstance.map.invalidateSize();
              const points = [];
              if (caseCoords) points.push(caseCoords);
              if (hospCoords) points.push(hospCoords);
              const stateVeh = (state.vehicles || []).find(v => v.plate === plate);
              if (stateVeh?.coords) points.push(stateVeh.coords);

              if (points.length >= 2) {
                try {
                  this.modalMapInstance.map.fitBounds(points, { padding: [50, 50], maxZoom: 15 });
                } catch (err) {
                  if (plate) this.modalMapInstance.focusVehicle(plate, { animate: false });
                }
              } else if (plate) {
                this.modalMapInstance.focusVehicle(plate, { animate: false });
              }
            };

            setTimeout(focusOnCase, 200);

            // Nút định vị tâm ca
            body.querySelector('#btn-modal-map-recenter')?.addEventListener('click', focusOnCase);
          }, 60);

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
            const ageGroup = body.querySelector('#central-input-patient-age-group')?.value || 'ADULT';
            const ageGroupMap = {
              INFANT: 'Sơ sinh',
              CHILD: 'Trẻ em',
              ADULT: 'Người trưởng thành',
              ELDERLY: 'Người cao tuổi'
            };
            const ageGroupText = ageGroupMap[ageGroup] || 'Người trưởng thành';
            const gender = body.querySelector('#central-input-patient-gender')?.value || 'Nam';
            const phone = body.querySelector('#central-input-patient-phone')?.value.trim() || '';
            const bloodType = body.querySelector('#central-input-patient-blood')?.value || 'O+';
            const history = body.querySelector('#central-input-patient-history')?.value.trim() || '';
            const allergies = body.querySelector('#central-input-patient-allergies')?.value.trim() || '';
            const symptom = body.querySelector('#central-input-patient-symptom')?.value.trim() || '';

            const patch = { ageGroup, ageGroupText, gender, phone, bloodType, history, allergies, symptom };
            window.StateManager.updateCasePatient(c.id, patch);
            if (window.CCNV_UI?.Toast) {
              window.CCNV_UI.Toast.show(
                'ĐÃ ĐỒNG BỘ VỀ XE CẤP CỨU',
                `Đã cập nhật thông tin nạn nhân (${ageGroupText}, ${gender}) và phát tín hiệu đồng bộ realtime tới app tài xế & kíp cấp cứu.`,
                true
              );
            }
            renderTab('tab-overview');
          });
        }

        // --- TAB 2: PHÂN CÔNG / ĐIỀU PHỐI (Layout Dọc Chiếm Trọn Chiều Rộng) ---
        else if (tabName === 'tab-dispatch') {
          body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:14px;width:100%;margin:0;">
              <!-- 1. XE NHẬN CA & VẬN HÀNH -->
              <div class="form-section" style="display:flex;flex-direction:column;">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-main);padding-bottom:8px;margin-bottom:12px;">
                  <span>1. XE NHẬN CA & VẬN HÀNH</span>
                  <span class="badge badge-accent" style="font-family:var(--font-mono);font-size:12px;">${c.dispatch?.vehiclePlate || '65A-012.34'}</span>
                </div>

                <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
                  <div style="display:flex;align-items:center;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);">Biển số xe:</span>
                    <strong style="color:var(--text-white);font-family:var(--font-mono);font-size:13.5px;">${c.dispatch?.vehiclePlate || '65A-012.34'}</strong>
                  </div>
                  <div style="display:flex;align-items:center;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);">Phân loại xe:</span>
                    <span class="badge badge-emergency">Type A (Hồi sức Chuyên sâu)</span>
                  </div>
                  <div style="display:flex;align-items:flex-start;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);padding-top:2px;">Trạm đóng quân:</span>
                    <div style="color:var(--text-white);line-height:1.4;">${c.dispatch?.stationName || 'Trạm Cấp cứu Ninh Kiều - 115 Cần Thơ'}</div>
                  </div>
                  <div style="display:flex;align-items:flex-start;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);padding-top:2px;">Vận tốc:</span>
                    <div style="line-height:1.4;"><strong style="color:#f59e0b;">${c.speed || 52} km/h</strong></div>
                  </div>
                </div>
              </div>

              <!-- 2. BỆNH VIỆN TIẾP NHẬN & NGƯỜI NHẬN -->
              <div class="form-section" style="display:flex;flex-direction:column;">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-main);padding-bottom:8px;margin-bottom:12px;">
                  <span>2. PHÂN CÔNG BỆNH VIỆN</span>
                  <span class="badge badge-emerald" style="font-size:11px;">ĐÃ SẴN SÀNG</span>
                </div>

                <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
                  <div style="display:flex;align-items:flex-start;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);padding-top:2px;">Bệnh viện:</span>
                    <strong style="color:var(--text-white);font-size:13px;line-height:1.4;">${c.dispatch?.hospitalName || 'Bệnh viện Đa khoa thành phố Cần Thơ'}</strong>
                  </div>
                  <div style="display:flex;align-items:flex-start;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);padding-top:2px;">Địa chỉ:</span>
                    <div style="color:var(--text-light);line-height:1.4;">Số 04 Châu Văn Liêm, P. Tân An, thành phố Cần Thơ</div>
                  </div>
                  <div style="display:flex;align-items:center;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);">Người nhận:</span>
                    <strong style="color:var(--accent-cyan);">${receiverName}</strong>
                  </div>
                  <div style="display:flex;align-items:flex-start;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);padding-top:2px;">Khoa nhận:</span>
                    <div style="line-height:1.4;">Khoa Hồi sức Cấp cứu</div>
                  </div>
                  <div style="display:flex;align-items:center;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);">Thời gian xử lý:</span>
                    <strong style="color:var(--emerald-light);font-family:var(--font-mono);">01p 15s</strong>
                    <span style="color:var(--text-slate);font-size:11.5px;margin-left:4px;">(Từ tiếp nhận → Phân công)</span>
                  </div>
                  <div style="display:flex;align-items:center;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);">Khả năng nhận:</span>
                    <div><strong style="color:var(--emerald-light);">Sẵn sàng tiếp nhận</strong> (24/7)</div>
                  </div>
                  <div style="display:flex;align-items:center;">
                    <span style="width:140px;flex-shrink:0;color:var(--text-slate);">Hotline trực:</span>
                    <span style="font-family:var(--font-mono);color:var(--text-white);font-weight:600;">0292.3821.236</span>
                  </div>
                </div>
              </div>

              <!-- 3. DANH SÁCH KÍP CẤP CỨU NGOẠI VIỆN -->
              <div class="form-section" style="display:flex;flex-direction:column;">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-main);padding-bottom:8px;margin-bottom:12px;">
                  <span>3. KÍP CẤP CỨU NGOẠI VIỆN</span>
                </div>

                <div style="display:flex;flex-direction:column;gap:10px;">
                  <!-- Thành viên 1: Bác sĩ -->
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;background:rgba(255,255,255,0.02);border:1px solid var(--border-main);border-radius:6px;padding:9px 14px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                      <span class="badge badge-emergency" style="font-size:10.5px;min-width:125px;text-align:center;">Bác sĩ Kíp trưởng</span>
                      <strong style="color:var(--text-white);font-size:13px;">${crewObj.doctor || 'BS. CKI. Nguyễn Văn Thành'}</strong>
                    </div>
                    <a href="tel:0913111222" style="font-family:var(--font-mono);color:var(--accent-cyan);font-weight:600;font-size:12.5px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
                      ${window.CCNV_UI?.ICONS?.phone || ''} 0913.111.222
                    </a>
                  </div>

                  <!-- Thành viên 2: Điều dưỡng -->
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;background:rgba(255,255,255,0.02);border:1px solid var(--border-main);border-radius:6px;padding:9px 14px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                      <span class="badge badge-accent" style="font-size:10.5px;min-width:125px;text-align:center;">Điều dưỡng CC</span>
                      <strong style="color:var(--text-white);font-size:13px;">${crewObj.nurse || 'ĐD. Trần Thị Mai'}</strong>
                    </div>
                    <a href="tel:0913333444" style="font-family:var(--font-mono);color:var(--accent-cyan);font-weight:600;font-size:12.5px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
                      ${window.CCNV_UI?.ICONS?.phone || ''} 0913.333.444
                    </a>
                  </div>

                  <!-- Thành viên 3: Lái xe -->
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;background:rgba(255,255,255,0.02);border:1px solid var(--border-main);border-radius:6px;padding:9px 14px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                      <span class="badge badge-default" style="font-size:10.5px;min-width:125px;text-align:center;">Lái xe Cứu thương</span>
                      <strong style="color:var(--text-white);font-size:13px;">${crewObj.driver || 'Lê Văn Hùng'}</strong>
                    </div>
                    <a href="tel:0913555666" style="font-family:var(--font-mono);color:var(--accent-cyan);font-weight:600;font-size:12.5px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
                      ${window.CCNV_UI?.ICONS?.phone || ''} 0913.555.666
                    </a>
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

        // --- TAB 3: HỒ SƠ (Phân 2 phần: Hồ sơ cấp cứu & Tài liệu & Dữ liệu bổ sung) ---
        else if (tabName === 'tab-documents') {
          body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:18px;width:100%;margin:0;">
              
              <!-- PHẦN 1: HỒ SƠ CẤP CỨU (THÔNG TIN BỆNH ÁN, HỒ SƠ BÀN GIAO, THEO DÕI CHỈ SỐ, GHI ÂM CUỘC GỌI) -->
              <div class="form-section">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-main);padding-bottom:10px;margin-bottom:14px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:var(--accent-cyan);display:inline-flex;">${window.CCNV_UI?.ICONS?.fileText || ''}</span>
                    <span style="font-weight:700;letter-spacing:0.3px;">1. HỒ SƠ CẤP CỨU</span>
                  </div>
                  <span style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">Mã hồ sơ: HS-${c.code}</span>
                </div>

                <div class="data-table-container">
                  <table class="command-table" style="font-size:12.5px;">
                    <thead>
                      <tr>
                        <th style="width:280px;">Hạng mục hồ sơ</th>
                        <th>Tên tệp tin</th>
                        <th style="width:130px;">Kích thước</th>
                        <th style="width:180px;">Thời gian ghi nhận</th>
                        <th style="width:190px;">Người lập / Nguồn</th>
                        <th style="width:130px;text-align:center;">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <!-- 1. Thông tin bệnh án -->
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:10px;">
                            <span class="badge badge-emergency" style="font-size:11px;min-width:135px;text-align:center;padding:4px 8px;">Thông tin bệnh án</span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong style="color:var(--text-white);font-family:var(--font-mono);">BenhAn_ePCR_${c.code}.pdf</strong>
                            <div style="font-size:11px;color:var(--text-muted);">Bệnh án cấp cứu ngoại viện điện tử (ePCR) đầy đủ dấu sinh hiệu & chẩn đoán</div>
                          </div>
                        </td>
                        <td>168 KB</td>
                        <td style="font-family:var(--font-mono);font-size:12px;">08:30:15 - 02/10/2026</td>
                        <td>${crewObj.doctor || 'BS. CKI. Nguyễn Văn Thành'}</td>
                        <td style="text-align:center;">
                          <div style="display:inline-flex;gap:8px;align-items:center;justify-content:center;">
                            <button class="btn btn-ghost btn-sm" id="btn-view-doc-epcr" title="Xem" style="color:var(--accent-cyan);padding:5px 8px;display:inline-flex;align-items:center;justify-content:center;">
                              ${window.CCNV_UI?.ICONS?.eye || ''}
                            </button>
                            <button class="btn btn-ghost btn-sm" id="btn-download-doc-epcr" title="Tải về" style="padding:5px 8px;display:inline-flex;align-items:center;justify-content:center;">
                              ${window.CCNV_UI?.ICONS?.download || ''}
                            </button>
                          </div>
                        </td>
                      </tr>

                      <!-- 2. Hồ sơ bàn giao -->
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:10px;">
                            <span class="badge badge-emerald" style="font-size:11px;min-width:135px;text-align:center;padding:4px 8px;">Hồ sơ bàn giao</span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong style="color:var(--text-white);font-family:var(--font-mono);">BienBan_BanGiao_${c.code}.pdf</strong>
                            <div style="font-size:11px;color:var(--text-muted);">Biên bản tiếp nhận & ký bàn giao người bệnh tại Khoa Cấp cứu tiếp nhận</div>
                          </div>
                        </td>
                        <td>95 KB</td>
                        <td style="font-family:var(--font-mono);font-size:12px;">08:42:00 - 02/10/2026</td>
                        <td>${receiverName}</td>
                        <td style="text-align:center;">
                          <div style="display:inline-flex;gap:8px;align-items:center;justify-content:center;">
                            <button class="btn btn-ghost btn-sm" id="btn-view-doc-handover" title="Xem" style="color:var(--accent-cyan);padding:5px 8px;display:inline-flex;align-items:center;justify-content:center;">
                              ${window.CCNV_UI?.ICONS?.eye || ''}
                            </button>
                            <button class="btn btn-ghost btn-sm" id="btn-download-doc-handover" title="Tải về" style="padding:5px 8px;display:inline-flex;align-items:center;justify-content:center;">
                              ${window.CCNV_UI?.ICONS?.download || ''}
                            </button>
                          </div>
                        </td>
                      </tr>

                      <!-- 3. Theo dõi chỉ số -->
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:10px;">
                            <span class="badge badge-accent" style="font-size:11px;min-width:135px;text-align:center;padding:4px 8px;">Theo dõi chỉ số</span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong style="color:var(--text-white);font-family:var(--font-mono);">TheoDoi_SinhHieu_ECG12Leads.xml</strong>
                            <div style="font-size:11px;color:var(--text-muted);">Dữ liệu liên tục: Mạch (88 l/p), Huyết áp (130/80), SpO2 (97%), Nhịp tim đồ ECG</div>
                          </div>
                        </td>
                        <td>54 KB</td>
                        <td style="font-family:var(--font-mono);font-size:12px;">08:24:00 - 02/10/2026</td>
                        <td>Monitor Xe ${c.dispatch?.vehiclePlate || '65A-012.34'}</td>
                        <td style="text-align:center;">
                          <div style="display:inline-flex;gap:8px;align-items:center;justify-content:center;">
                            <button class="btn btn-ghost btn-sm" id="btn-view-doc-vitals" title="Xem biểu đồ" style="color:var(--accent-cyan);padding:5px 8px;display:inline-flex;align-items:center;justify-content:center;">
                              ${window.CCNV_UI?.ICONS?.eye || ''}
                            </button>
                            <button class="btn btn-ghost btn-sm" id="btn-download-doc-vitals" title="Tải về" style="padding:5px 8px;display:inline-flex;align-items:center;justify-content:center;">
                              ${window.CCNV_UI?.ICONS?.download || ''}
                            </button>
                          </div>
                        </td>
                      </tr>

                      <!-- 4. Ghi âm cuộc gọi -->
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:10px;">
                            <span class="badge badge-amber" style="font-size:11px;min-width:135px;text-align:center;padding:4px 8px;">Ghi âm cuộc gọi</span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong style="color:var(--text-white);font-family:var(--font-mono);">GhiAm_CuocGoi115_${c.callId || 'CALL-001'}.wav</strong>
                            <div style="font-size:11px;color:var(--text-muted);">Âm thanh đàm thoại khẩn cấp ĐPV 115 tiếp nhận tin báo · Thời lượng 02:04</div>
                          </div>
                        </td>
                        <td>2.3 MB</td>
                        <td style="font-family:var(--font-mono);font-size:12px;">08:12:00 - 02/10/2026</td>
                        <td>Tổng đài Cấp cứu 115</td>
                        <td style="text-align:center;">
                          <div style="display:inline-flex;gap:8px;align-items:center;justify-content:center;">
                            <button class="btn btn-ghost btn-sm" id="btn-play-doc-audio" title="Nghe lại" style="color:#f59e0b;padding:5px 8px;display:inline-flex;align-items:center;justify-content:center;">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </button>
                            <button class="btn btn-ghost btn-sm" id="btn-download-doc-audio" title="Tải về" style="padding:5px 8px;display:inline-flex;align-items:center;justify-content:center;">
                              ${window.CCNV_UI?.ICONS?.download || ''}
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- PHẦN 2: TÀI LIỆU & DỮ LIỆU BỔ SUNG (HÌNH ẢNH, VIDEO CAMERA, CAN THIỆP Y TẾ) -->
              <div class="form-section">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-main);padding-bottom:10px;margin-bottom:14px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:#38bdf8;display:inline-flex;">${window.CCNV_UI?.ICONS?.camera || ''}</span>
                    <span style="font-weight:700;letter-spacing:0.3px;">2. TÀI LIỆU & DỮ LIỆU BỔ SUNG</span>
                  </div>
                  <div style="display:flex;gap:8px;">
                    <button class="btn btn-default btn-sm" id="btn-upload-more-photo" style="display:inline-flex;align-items:center;gap:6px;">
                      ${window.CCNV_UI?.ICONS?.camera || ''}
                      <span>Thêm ảnh / Video</span>
                    </button>
                    <button class="btn btn-default btn-sm" id="btn-upload-attachment" style="display:inline-flex;align-items:center;gap:6px;">
                      <span>+ Đính kèm tệp tin</span>
                    </button>
                  </div>
                </div>

                <!-- LƯỚI CARD TRUYỀN THÔNG ĐA PHƯƠNG TIỆN (ẢNH, VIDEO, CAN THIỆP Y TẾ) -->
                <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px;">
                  
                  <!-- Card 1: Hình ảnh Hiện trường -->
                  <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
                    <div style="height:140px;background:#0c1929;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;" class="img-preview-card" data-title="Ảnh Hiện trường tai nạn va chạm">
                      <svg width="100%" height="100%" viewBox="0 0 160 120">
                        <rect width="160" height="120" fill="#0f2338"/>
                        <path d="M 0 100 L 160 80" stroke="#334155" stroke-width="12" />
                        <circle cx="80" cy="55" r="22" fill="#ef4444" opacity="0.2" />
                        <g transform="translate(68, 43)" stroke="#f87171" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </g>
                        <text x="80" y="105" fill="#94a3b8" font-size="9" text-anchor="middle">HIỆN TRƯỜNG TAI NẠN</text>
                      </svg>
                      <span class="badge badge-emergency" style="position:absolute;top:8px;left:8px;font-size:10px;">Hình ảnh</span>
                      <span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.6);color:#FFF;font-size:10px;padding:2px 6px;border-radius:4px;font-family:var(--font-mono);">1.8 MB</span>
                    </div>
                    <div style="padding:10px 12px;font-size:12px;">
                      <div style="font-weight:600;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">IMG_HienTruong_TaiNan.jpg</div>
                      <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">Chụp lúc 08:18 · Vị trí Cầu Hưng Lợi</div>
                    </div>
                  </div>

                  <!-- Card 2: Video Camera hành trình xe -->
                  <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
                    <div style="height:140px;background:#0c1929;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;" class="img-preview-card" data-title="Video Camera hành trình xe cấp cứu di chuyển đến viện">
                      <svg width="100%" height="100%" viewBox="0 0 160 120">
                        <rect width="160" height="120" fill="#081b2e"/>
                        <circle cx="80" cy="55" r="22" fill="#38bdf8" opacity="0.25" />
                        <polygon points="74,45 92,55 74,65" fill="#38bdf8" />
                        <text x="80" y="105" fill="#38bdf8" font-size="9" font-weight="600" text-anchor="middle">VIDEO HÀNH TRÌNH XE</text>
                      </svg>
                      <span class="badge badge-accent" style="position:absolute;top:8px;left:8px;font-size:10px;background:rgba(14,165,233,0.2);color:#38bdf8;border-color:#38bdf8;">Video MP4</span>
                      <span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.6);color:#FFF;font-size:10px;padding:2px 6px;border-radius:4px;font-family:var(--font-mono);">01:30 · 18 MB</span>
                    </div>
                    <div style="padding:10px 12px;font-size:12px;">
                      <div style="font-weight:600;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">VID_CameraHanhTrinh_65A01234.mp4</div>
                      <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">Camera hành trình trước xe · Vận tốc 52 km/h</div>
                    </div>
                  </div>

                  <!-- Card 3: Can thiệp y tế (Nẹp cố định & Băng ép) -->
                  <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
                    <div style="height:140px;background:#0c1929;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;" class="img-preview-card" data-title="Ảnh Can thiệp sơ cứu băng ép & nẹp cố định cẳng tay">
                      <svg width="100%" height="100%" viewBox="0 0 160 120">
                        <rect width="160" height="120" fill="#132338"/>
                        <circle cx="80" cy="55" r="22" fill="#f472b6" opacity="0.2" />
                        <g transform="translate(68, 43)" stroke="#f472b6" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3" y="7" width="18" height="10" rx="3" transform="rotate(45 12 12)"/>
                          <path d="m14 8 2 2"/>
                          <path d="m8 14 2 2"/>
                        </g>
                        <text x="80" y="105" fill="#f472b6" font-size="9" text-anchor="middle">CAN THIỆP SƠ CỨU</text>
                      </svg>
                      <span class="badge" style="position:absolute;top:8px;left:8px;font-size:10px;background:rgba(244,114,182,0.18);color:#f472b6;border:1px solid rgba(244,114,182,0.4);">Can thiệp y tế</span>
                      <span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.6);color:#FFF;font-size:10px;padding:2px 6px;border-radius:4px;font-family:var(--font-mono);">2.1 MB</span>
                    </div>
                    <div style="padding:10px 12px;font-size:12px;">
                      <div style="font-weight:600;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">IMG_CanThiep_BangNepTay.jpg</div>
                      <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">Băng ép cầm máu & đặt nẹp cẳng tay phải</div>
                    </div>
                  </div>

                  <!-- Card 4: Can thiệp y tế (Hồi sức hô hấp & Thở oxy) -->
                  <div style="background:var(--bg-elevated);border:1px solid var(--border-main);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
                    <div style="height:140px;background:#0c1929;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;" class="img-preview-card" data-title="Ảnh Can thiệp thở oxy hỗ trợ trên khoang cứu thương">
                      <svg width="100%" height="100%" viewBox="0 0 160 120">
                        <rect width="160" height="120" fill="#142236"/>
                        <circle cx="80" cy="55" r="22" fill="#2dd4bf" opacity="0.2" />
                        <g transform="translate(68, 43)" stroke="#2dd4bf" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="9"/>
                          <path d="M12 7v5l3 3"/>
                        </g>
                        <text x="80" y="105" fill="#2dd4bf" font-size="9" text-anchor="middle">THỞ OXY HỖ TRỢ</text>
                      </svg>
                      <span class="badge" style="position:absolute;top:8px;left:8px;font-size:10px;background:rgba(45,212,191,0.18);color:#2dd4bf;border:1px solid rgba(45,212,191,0.4);">Hồi sức</span>
                      <span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.6);color:#FFF;font-size:10px;padding:2px 6px;border-radius:4px;font-family:var(--font-mono);">1.6 MB</span>
                    </div>
                    <div style="padding:10px 12px;font-size:12px;">
                      <div style="font-weight:600;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">IMG_HoiSuc_ThoOxy_KhoangXe.jpg</div>
                      <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">Thở oxy cannula 3L/phút · SpO2 đạt 97%</div>
                    </div>
                  </div>

                </div>

                <!-- Khu vực kéo thả tải lên tài liệu mới -->
                <div style="margin-top:16px;border:2px dashed var(--border-accent);border-radius:8px;padding:18px;text-align:center;background:rgba(255,255,255,0.02);">
                  <div style="color:var(--text-white);font-weight:600;font-size:13px;">Kéo & Thả tài liệu y tế, hình ảnh thương tổn hoặc video camera vào đây</div>
                  <div style="color:var(--text-muted);font-size:11.5px;margin-top:4px;">Hỗ trợ định dạng tiếng Việt: PDF, DOCX, JPG, PNG, MP4, WAV · Tối đa 50MB</div>
                </div>
              </div>

            </div>
          `;

          // Sự kiện xem preview ảnh / video
          body.querySelectorAll('.img-preview-card').forEach(card => {
            card.addEventListener('click', () => {
              const title = card.getAttribute('data-title');
              window.CCNV_UI.Toast.show('Xem tệp đa phương tiện', `Đang mở trình xem phóng to: ${title}`);
            });
          });

          // Sự kiện xem ePCR
          body.querySelector('#btn-view-doc-epcr')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Mở hồ sơ bệnh án', `Đang tải phiếu ePCR bệnh án điện tử ca ${c.code}`);
          });

          // Sự kiện xem biên bản bàn giao
          body.querySelector('#btn-view-doc-handover')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Mở hồ sơ bàn giao', `Đang xem biên bản bàn giao người bệnh tại bệnh viện`);
          });

          // Sự kiện xem chỉ số theo dõi
          body.querySelector('#btn-view-doc-vitals')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Theo dõi chỉ số', `Đang mở biểu đồ sinh hiệu và nhịp tim ECG liên tục`);
          });

          // Sự kiện phát ghi âm cuộc gọi
          body.querySelector('#btn-play-doc-audio')?.addEventListener('click', () => {
            window.CCNV_UI.SoundFx.playBeep();
            window.CCNV_UI.Toast.show('Đang phát ghi âm cuộc gọi', 'Đang phát lại đoạn ghi âm đàm thoại giữa tổng đài 115 và người báo tin.');
          });

          // Sự kiện tải về các tệp
          body.querySelectorAll('[id^="btn-download-doc-"]').forEach(btn => {
            btn.addEventListener('click', () => {
              window.CCNV_UI.Toast.show('Tải tệp tin', 'Đang tải tệp tin về thiết bị...');
            });
          });

          body.querySelector('#btn-upload-more-photo')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Tải ảnh / Video', 'Mở hộp thoại chọn tệp hình ảnh hoặc video camera từ thiết bị');
          });

          body.querySelector('#btn-upload-attachment')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Đính kèm tài liệu', 'Mở hộp thoại chọn tệp tài liệu bổ sung từ thiết bị');
          });
        }

        // --- TAB ePCR & BÀN GIAO BỆNH VIỆN ---
        else if (tabName === 'tab-epcr-handover') {
          const isCompleted = c.status === 'COMPLETED';
          body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:18px;">
              <!-- 1. BIÊN BẢN TIẾP NHẬN & BÀN GIAO TẠI KHOA CẤP CỨU -->
              <div class="form-section">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span>1. BIÊN BẢN TIẾP NHẬN & BÀN GIAO BỆNH NHÂN TẠI VIỆN</span>
                    <span class="badge ${isCompleted ? 'badge-emerald' : 'badge-amber'}" style="display:inline-flex;align-items:center;gap:4px;">
                      ${isCompleted ? (window.CCNV_UI?.ICONS?.check || '') : ''}
                      <span>${isCompleted ? 'Đã bàn giao hoàn tất' : 'Chờ hoàn tất bàn giao'}</span>
                    </span>
                  </div>
                  <button class="btn btn-default btn-sm" id="btn-modal-checkin-veh" style="display:inline-flex;align-items:center;gap:6px;">
                    ${window.CCNV_UI?.ICONS?.ambulance || ''}
                    <span>Check-in Xe Cập Bến</span>
                  </button>
                </div>

                <div class="form-grid-2">
                  <div class="form-field">
                    <label class="form-label">Chẩn đoán tiếp nhận tại Khoa Cấp cứu</label>
                    <textarea id="modal-handover-diagnosis" rows="2" placeholder="Nhập chẩn đoán tiếp nhận...">${c.handoverDiagnosis || c.incident?.name || 'Đa chấn thương do tai nạn giao thông, rách phần mềm cẳng tay, theo dõi chấn động não.'}</textarea>
                  </div>
                  <div class="form-field">
                    <label class="form-label">Tình trạng người bệnh khi bàn giao</label>
                    <textarea id="modal-handover-condition" rows="2" placeholder="Nhập tình trạng lâm sàng lúc bàn giao...">${c.handoverCondition || 'Bệnh nhân tỉnh táo, tiếp xúc tốt, huyết động ổn định. Mạch 88, HA 130/80.'}</textarea>
                  </div>
                </div>

                <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--border-main);display:flex;align-items:center;justify-content:space-between;">
                  <div style="font-size:12px;color:var(--text-muted);">
                    Bác sĩ tiếp nhận: <strong style="color:var(--text-white);">${currentUser?.fullName || 'BS. Trực Cấp cứu'}</strong> · ${currentUser?.organization || 'Bệnh viện tiếp nhận'}
                  </div>
                  <div style="display:flex;gap:10px;">
                    ${!isCompleted ? `
                      <button class="btn btn-emergency btn-md" id="btn-modal-confirm-handover">
                        ${window.CCNV_UI.ICONS.check}
                        <span>Ký Xác nhận Bàn giao (Ca Hoàn tất)</span>
                      </button>
                    ` : `
                      <span class="status-pill status-pill-completed" style="font-size:12.5px;padding:6px 14px;display:inline-flex;align-items:center;gap:6px;">
                        ${window.CCNV_UI?.ICONS?.check || ''}
                        <span>Ca đã hoàn tất bàn giao & lưu hồ sơ bệnh viện</span>
                      </span>
                    `}
                  </div>
                </div>
              </div>

              <!-- 2. HỒ SƠ BỆNH ÁN ĐIỆN TỬ TIỀN VIỆN (ePCR) -->
              <div class="form-section">
                <div class="form-section-title">
                  <span>2. HỒ SƠ BỆNH ÁN ĐIỆN TỬ TIỀN VIỆN (ePCR)</span>
                </div>
                <div id="modal-epcr-form-mount"></div>
              </div>
            </div>
          `;

          // Mount ePCR Form
          if (window.EPCRForm) {
            window.EPCRForm.render('modal-epcr-form-mount', c.epcr || {}, false, (updated) => {
              c.epcr = updated;
              window.StateManager.saveToSession?.();
              window.StateManager.addCaseLog(c.id, 'Bác sĩ cập nhật hồ sơ ePCR');
            });
          }

          body.querySelector('#btn-modal-checkin-veh')?.addEventListener('click', () => {
            window.CCNV_UI.Toast.show('Check-in Xe Thành Công', `Đã ghi nhận giờ xe cứu thương ${c.dispatch?.vehiclePlate || ''} cập bến sảnh cấp cứu.`);
            window.StateManager.addAuditLog(`Check-in xe cứu thương ${c.dispatch?.vehiclePlate || ''} tại sảnh cấp cứu`);
          });

          body.querySelector('#btn-modal-confirm-handover')?.addEventListener('click', () => {
            const diag = body.querySelector('#modal-handover-diagnosis')?.value;
            const cond = body.querySelector('#modal-handover-condition')?.value;
            window.StateManager.updateCase(c.id, {
              status: 'COMPLETED',
              statusText: 'Hoàn tất',
              stageLabel: 'Đã bàn giao tại viện',
              hospitalResponse: 'ACCEPTED',
              hospitalResponseText: 'Đã bàn giao',
              handoverDiagnosis: diag,
              handoverCondition: cond,
              completedAt: new Date().toISOString()
            });

            // Giải phóng xe
            if (c.dispatch?.vehiclePlate) {
              window.StateManager.updateVehicle(c.dispatch.vehiclePlate, {
                status: 'READY',
                statusText: 'Sẵn sàng',
                speed: 0
              });
            }

            window.StateManager.addCaseLog(c.id, `Khoa Cấp cứu ký xác nhận bàn giao người bệnh. Ca hoàn tất.`);
            window.CCNV_UI.Toast.show('Bàn Giao Hoàn Tất', `Đã hoàn tất bàn giao ca ${c.code}. Xe ${c.dispatch?.vehiclePlate || ''} đã sẵn sàng tiếp nhận nhiệm vụ mới.`);
            this.openCaseDetailModal(c.id);
            const mainVp = document.getElementById('main-content-viewport');
            if (mainVp) this.renderCurrentView({ keepModal: true });
          });
        }

        // --- TAB 4: LỊCH SỬ LOG (Nhật ký sự kiện toàn diện full-width) ---
        else if (tabName === 'tab-logs') {
          const logsList = (c.logs && c.logs.length >= 3) ? c.logs : [
            { time: '08:10:15 - 02/10/2026', type: 'CALL', badge: 'NHẬN CUỘC GỌI', color: '#38bdf8', user: 'dpv01 (Nguyễn Văn An)', action: 'Tiếp nhận cuộc gọi khẩn cấp 115 từ số 0918.234.111. Báo tin va chạm giao thông tại Cầu Hưng Lợi.' },
            { time: '08:11:30 - 02/10/2026', type: 'DISPATCH', badge: 'ĐIỀU XE', color: '#fbbf24', user: 'dpv01 (Nguyễn Văn An)', action: `Tạo ca cấp cứu ${c.code}, phát lệnh điều động xe cứu thương ${c.dispatch?.vehiclePlate || '65A-012.34'} và gửi cảnh báo trước đến ${c.dispatch?.hospitalName || 'BV Đa khoa thành phố Cần Thơ'}.` },
            { time: '08:12:45 - 02/10/2026', type: 'STATUS', badge: 'XUẤT PHÁT ĐẾN HIỆN TRƯỜNG', color: '#38bdf8', user: crewObj.driver || 'Lê Văn Hùng', action: 'Kíp cấp cứu xác nhận lên xe xuất phát từ trạm, bật còi ưu tiên di chuyển về phía hiện trường.' },
            { time: '08:20:00 - 02/10/2026', type: 'MEDICAL', badge: 'CAN THIỆP Y TẾ', color: '#f472b6', user: crewObj.doctor || 'BS. Nguyễn Văn Thành', action: 'Đo sinh hiệu (HA 130/80, SpO2 97%), băng ép vô trùng cẳng tay phải, đặt nẹp cố định mềm chi trên.' },
            { time: '08:24:10 - 02/10/2026', type: 'STATUS', badge: 'TIẾP CẬN BỆNH VIỆN', color: '#a855f7', user: crewObj.driver || 'Lê Văn Hùng', action: `Bắt đầu vận chuyển khẩn cấp, tiếp cận sảnh cấp cứu ${c.dispatch?.hospitalName || 'BV Đa khoa thành phố Cần Thơ'}.` },
            { time: '08:42:00 - 02/10/2026', type: 'HANDOVER', badge: 'BÀN GIAO TẠI VIỆN', color: '#c084fc', user: receiverName, action: 'Xe đến sảnh cấp cứu viện, kíp trực tiến hành bàn giao hồ sơ bệnh án ePCR và người bệnh cho Bác sĩ trực khoa Cấp cứu.' }
          ];

          body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:16px;">
              <!-- TIMELINE NHẬT KÝ SỰ KIỆN DỌC TỪ TRÊN XUỐNG DƯỚI -->
              <div class="form-section">
                <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;border-bottom:1px solid var(--border-main);padding-bottom:10px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:var(--accent-cyan);display:flex;align-items:center;">${window.CCNV_UI?.ICONS?.timer || ''}</span>
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
            let iconSvg = window.CCNV_UI?.ICONS?.phoneCall || '';
            let badgeBg = 'rgba(56,189,248,0.15)';
            let badgeBorder = 'rgba(56,189,248,0.35)';
            let badgeText = 'NHẬN CUỘC GỌI';

            if (l.type === 'CALL' || l.action.toLowerCase().includes('cuộc gọi')) {
              nodeColor = '#38bdf8';
              iconSvg = window.CCNV_UI?.ICONS?.phoneCall || '';
              badgeBg = 'rgba(56,189,248,0.15)';
              badgeBorder = 'rgba(56,189,248,0.35)';
              badgeText = 'NHẬN CUỘC GỌI';
            } else if (l.type === 'DISPATCH' || l.action.toLowerCase().includes('điều xe') || l.action.toLowerCase().includes('lệnh')) {
              nodeColor = '#fbbf24';
              iconSvg = window.CCNV_UI?.ICONS?.siren || window.CCNV_UI?.ICONS?.alertTriangle || '';
              badgeBg = 'rgba(245,158,11,0.15)';
              badgeBorder = 'rgba(245,158,11,0.35)';
              badgeText = 'ĐIỀU ĐỘNG XE';
            } else if (l.type === 'HOSPITAL' || l.action.toLowerCase().includes('sẵn sàng') || l.action.toLowerCase().includes('khoa cấp cứu')) {
              nodeColor = '#10b981';
              iconSvg = window.CCNV_UI?.ICONS?.hospital || '';
              badgeBg = 'rgba(16,185,129,0.15)';
              badgeBorder = 'rgba(16,185,129,0.35)';
              badgeText = 'BỆNH VIỆN TIẾP NHẬN';
            } else if (l.type === 'MEDICAL' || l.action.toLowerCase().includes('sinh hiệu') || l.action.toLowerCase().includes('băng')) {
              nodeColor = '#f472b6';
              iconSvg = window.CCNV_UI?.ICONS?.stethoscope || window.CCNV_UI?.ICONS?.bandage || '';
              badgeBg = 'rgba(244,114,182,0.15)';
              badgeBorder = 'rgba(244,114,182,0.35)';
              badgeText = 'CAN THIỆP Y TẾ';
            } else if (l.type === 'HANDOVER' || l.action.toLowerCase().includes('bàn giao')) {
              nodeColor = '#c084fc';
              iconSvg = window.CCNV_UI?.ICONS?.handshake || window.CCNV_UI?.ICONS?.check || '';
              badgeBg = 'rgba(192,132,252,0.15)';
              badgeBorder = 'rgba(192,132,252,0.35)';
              badgeText = 'BÀN GIAO TẠI VIỆN';
            } else {
              const act = (l.action || '').toLowerCase();
              if (act.includes('bệnh viện') || act.includes('sảnh cấp cứu') || act.includes('đến viện') || act.includes('ttyt')) {
                nodeColor = '#a855f7';
                iconSvg = window.CCNV_UI?.ICONS?.hospital || window.CCNV_UI?.ICONS?.ambulance || '';
                badgeBg = 'rgba(168,85,247,0.15)';
                badgeBorder = 'rgba(168,85,247,0.35)';
                badgeText = 'TIẾP CẬN BỆNH VIỆN';
              } else if (act.includes('đưa người bệnh') || act.includes('lên xe') || act.includes('an toàn') || act.includes('vận chuyển') || act.includes('đón')) {
                nodeColor = '#10b981';
                iconSvg = window.CCNV_UI?.ICONS?.check || window.CCNV_UI?.ICONS?.ambulance || '';
                badgeBg = 'rgba(16,185,129,0.15)';
                badgeBorder = 'rgba(16,185,129,0.35)';
                badgeText = 'ĐÓN BỆNH NHÂN THÀNH CÔNG';
              } else if (act.includes('tiếp cận') || act.includes('hiện trường') || act.includes('thăm khám')) {
                nodeColor = '#06b6d4';
                iconSvg = window.CCNV_UI?.ICONS?.mapPin || window.CCNV_UI?.ICONS?.ambulance || '';
                badgeBg = 'rgba(6,182,212,0.15)';
                badgeBorder = 'rgba(6,182,212,0.35)';
                badgeText = 'TIẾP CẬN HIỆN TRƯỜNG';
              } else {
                nodeColor = '#38bdf8';
                iconSvg = window.CCNV_UI?.ICONS?.ambulance || window.CCNV_UI?.ICONS?.navigation || '';
                badgeBg = 'rgba(56,189,248,0.15)';
                badgeBorder = 'rgba(56,189,248,0.35)';
                badgeText = 'XUẤT PHÁT ĐẾN HIỆN TRƯỜNG';
              }
            }

            const timeStr = l.time.includes('-') ? l.time : formatDT(l.time);

            return `
                        <div style="position:relative;display:flex;align-items:flex-start;gap:22px;">
                          <!-- Node tròn trên trục dọc -->
                          <div style="width:38px;height:38px;border-radius:50%;background:#091726;border:2px solid ${nodeColor};box-shadow:0 0 12px ${nodeColor}55;display:flex;align-items:center;justify-content:center;color:${nodeColor};z-index:2;flex-shrink:0;">
                            ${iconSvg}
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
                              <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-slate);background:rgba(255,255,255,0.03);padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:5px;">
                                ${window.CCNV_UI?.ICONS?.clock || ''} <span>${timeStr}</span>
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

      const closeModal = () => {
        this.closeCaseDetailModal();
      };
      modalOverlay.querySelector('#btn-close-case-modal')?.addEventListener('click', closeModal);
      modalOverlay.querySelector('#btn-close-case-modal-footer')?.addEventListener('click', closeModal);

      if (this._caseModalKeyHandler) {
        window.removeEventListener('keydown', this._caseModalKeyHandler);
      }
      this._caseModalKeyHandler = (e) => {
        if (e.key === 'Escape') {
          this.closeCaseDetailModal();
        }
      };
      window.addEventListener('keydown', this._caseModalKeyHandler);

      // Nút Xác nhận tiếp nhận từ Modal (Header & Tab Overview Banner)
      const handleConfirmHospitalAccept = () => {
        this.commitHospitalDemoCase(c);
        window.CCNV_UI.Toast.show(
          'Đã tiếp nhận ca cấp cứu',
          `Khoa Cấp cứu đã tiếp nhận ca cấp cứu người bệnh ${c.patient?.name || ''} (Mã: ${c.code}). Ca đã được ghi nhận vào danh sách cấp cứu!`
        );
        closeModal();
        const mainViewport = document.getElementById('main-content-viewport');
        if (mainViewport) {
          if (this.currentMenu === 'hospital-cases') {
            this.renderHospitalCasesView(mainViewport);
          } else {
            this.renderCurrentView();
          }
        }
      };
      modalOverlay.querySelector('#btn-modal-confirm-hospital-case')?.addEventListener('click', handleConfirmHospitalAccept);
      modalOverlay.addEventListener('click', (e) => {
        if (e.target.closest('#btn-tab-overview-confirm-hospital-case')) {
          handleConfirmHospitalAccept();
        }
      });

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
              <div>Vị trí: Cầu Hưng Lợi, P. Hưng Phú, thành phố Cần Thơ</div>
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
        window.CCNV_UI.Toast.show('Điều xe thay thế', 'Đã phát lệnh điều xe 65A-016.88 tới hiện trường Cầu Hưng Lợi', true);
        window.StateManager.addAuditLog('Điều động xe cứu thương thay thế 65A-016.88 ứng cứu sự cố SOS');
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
              <div>Nạn nhân: <strong style="color:var(--text-white);">${caseObj.patient?.ageGroupText || 'Người trưởng thành'}</strong> (${caseObj.patient?.gender || 'Nam'})</div>
              <div>Tình trạng: <span class="badge badge-emergency">${caseObj.incident.name}</span></div>
              <div>Thời gian dự kiến cập bến: <strong style="color:var(--red-vivid);font-size:15px;">~6 phút</strong></div>
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
      const handleDemoTrigger = () => {
        if (this.isHospitalMode()) {
          if (this.hospitalDemoRunning) {
            this.endHospitalDemo();
          } else {
            this.startHospitalDemo();
          }
          return;
        }
        if (this.demoRunning) this.endDemo();
        else if (this.demo) this.cancelDemo();
        else this.startDemo();
      };

      // Nút Bắt đầu / Kết thúc demo trên header
      document.getElementById('btn-demo-start')?.addEventListener('click', handleDemoTrigger);

      // Icon quả chuông thông báo trên header: kích hoạt demo cho cả 2 app Trung tâm và Bệnh viện tiếp nhận
      document.getElementById('btn-header-bell')?.addEventListener('click', handleDemoTrigger);

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

    // --- 13. DEMO MODE: luồng điều phối viên ngay trên Bản đồ ca (GIS) ---
    // - Trước khi nhấn "Bắt đầu": Tất cả xe đều sẵn sàng, không có ca/điểm tai nạn nào.
    // - B1: Cuộc gọi đến 115 thoại → B2: Form tiếp nhận thông tin người bệnh.
    // - B3: Nhấn "Phát lệnh điều động" → Xe 65A-012.34 nhận lệnh, xuất phát từ Trạm Cái Răng, có lộ trình và điểm tai nạn xuất hiện. Nút header chuyển thành "Kết thúc".
    // - Nhấn "Kết thúc" → Tất cả xe và kíp trực trở về trạng thái "Sẵn sàng", xóa điểm tai nạn & lộ trình, nút header trở lại "Bắt đầu".
    startDemo() {
      const state = window.StateManager.getState();
      const plate = '65A-012.34';
      const veh = (state.vehicles || []).find(v => v.plate === plate);
      const seedCase = state.demoCase || window.SEED_DATA?.demoCase || (window.SEED_DATA?.cases && window.SEED_DATA.cases[0]);
      const caseObj = seedCase ? JSON.parse(JSON.stringify(seedCase)) : null;

      if (!veh || !caseObj) {
        window.CCNV_UI.Toast.show('Không thể chạy demo', `Thiếu dữ liệu xe ${plate} hoặc ca cấp cứu mẫu.`, true);
        return;
      }

      // Đặt lại xe 65A-012.34 tại Trạm Cái Răng để xuất phát theo đúng kịch bản
      veh.coords = [10.0105, 105.7700];
      veh.station = 'Trạm Cấp cứu Cái Răng';
      veh.status = 'READY';
      veh.statusText = 'Sẵn sàng';
      veh.speed = 0;
      veh.currentCaseId = null;

      this.demo = { plate, caseObj };
      this.realtimeSelectedPlate = null;
      this.currentMenu = 'realtime-map';
      this.renderSidebar();
      if (this.mapInstance) this.mapInstance.clearFocus();
      this.renderCurrentView();
      this.updateKpiBar();

      // Đổ chuông cuộc gọi sau 600ms
      this.demo.timer = setTimeout(() => this.showDemoIncomingCall(), 600);
    }

    mountDemoOverlay(html) {
      let overlay = document.getElementById('demo-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'demo-overlay';
        overlay.className = 'demo-overlay';
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('is-open'));
      }
      overlay.innerHTML = html;
      return overlay;
    }

    // B1: Cuộc gọi đến
    showDemoIncomingCall() {
      if (!this.demo) return;
      const c = this.demo.caseObj;
      const I = window.CCNV_UI.ICONS;
      const overlay = this.mountDemoOverlay(`
        <div class="demo-call-card" role="dialog" aria-modal="true" aria-labelledby="demo-call-number" style="zoom: 150%; transform-origin: center center;">
          <div class="demo-call-avatar" aria-hidden="true">
            <span class="demo-call-ring"></span><span class="demo-call-ring"></span>
            ${I.phoneCall}
          </div>
          <div class="demo-call-number" id="demo-call-number">${c.callerPhone}</div>
          <div class="demo-call-timer">Đang đổ chuông <strong id="demo-call-timer">00:00</strong></div>
          <dl class="demo-call-meta">
            <div><dt>Định vị Cell-ID</dt><dd>BTS ĐH Cần Thơ, Đường Nguyễn Văn Cừ</dd></div>
          </dl>
          <div class="demo-call-actions">
            <button type="button" class="demo-call-btn is-decline" id="btn-demo-decline">
              <span class="demo-call-btn-icon">${I.phone}</span><span>Từ chối</span>
            </button>
            <button type="button" class="demo-call-btn is-answer" id="btn-demo-answer">
              <span class="demo-call-btn-icon">${I.phone}</span><span>Xác nhận cuộc gọi</span>
            </button>
          </div>
        </div>
      `);
      overlay.querySelector('#btn-demo-answer').addEventListener('click', () => this.openDemoIntakeForm());
      overlay.querySelector('#btn-demo-decline').addEventListener('click', () => this.cancelDemo());
      setTimeout(() => overlay.querySelector('#btn-demo-answer')?.focus(), 50);

      // Chuông reo kép mỗi 2 giây + đồng hồ đổ chuông
      const timerEl = overlay.querySelector('#demo-call-timer');
      const beep = () => window.CCNV_UI.SoundFx.playBeep();
      const pad = n => String(n).padStart(2, '0');
      let s = 0;
      const tick = () => {
        if (s % 2 === 0) { beep(); setTimeout(beep, 180); }
        if (timerEl) timerEl.textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
        s++;
      };
      tick();
      this.demo.ring = setInterval(tick, 1000);
    }

    // B2: Form tiếp nhận thông tin bệnh nhân (Tổng đài · Cuộc gọi hiện tại)
    openDemoIntakeForm() {
      if (!this.demo) return;
      clearInterval(this.demo.ring);
      const { caseObj: c, plate } = this.demo;
      const state = window.StateManager.getState();
      const crew = (state.crews || []).find(cr => cr.id === (c.dispatch?.crewId || 'CREW-03'));
      const crewIds = crew
        ? (state.personnel || []).filter(p => [crew.doctor, crew.nurse, crew.driver].includes(p.name)).map(p => p.id)
        : [];
      const I = window.CCNV_UI.ICONS;

      window.CCNV_UI.SoundFx.playBeep();
      const overlay = this.mountDemoOverlay(`
        <section class="demo-intake-panel" role="dialog" aria-modal="true" aria-labelledby="demo-intake-title">
          <header class="demo-intake-header">
            <h2 class="demo-intake-title" id="demo-intake-title">
              ${I.phoneCall}
              <span>Tiếp nhận cuộc gọi 115</span>
            </h2>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-demo-intake-close" title="Hủy và đóng">${I.x}</button>
          </header>
          <div class="demo-intake-body" id="demo-intake-body"></div>
        </section>
      `);
      overlay.querySelector('#btn-demo-intake-close').addEventListener('click', () => this.cancelDemo());

      this.renderCallCenterView(overlay.querySelector('#demo-intake-body'), 'active', {
        plate,
        crewIds,
        call: {
          callerName: c.callerName || 'Người dân báo tin',
          callerPhone: c.callerPhone || '0913.882.115',
          patientAgeGroup: 'ADULT',
          patientAgeGroupText: 'Người trưởng thành',
          patientGender: '',
          address: '',
          incidentCode: '',
          severity: '',
          notes: ''
        },
        onDispatch: (form) => this.finishDemoDispatch(form),
        onCancel: () => this.cancelDemo()
      });
    }

    // B3: Phát lệnh → kích hoạt ca trên bản đồ, xe 65A-012.34 nhận lệnh và có lộ trình
    finishDemoDispatch(form) {
      this.stopVoiceDemoAudio();
      if (!this.demo) return;
      const state = window.StateManager.getState();
      const { caseObj, plate } = this.demo;
      const incObj = (state.incidentTypes || []).find(i => i.code === form.incidentCode);
      const sevText = { CRITICAL: 'Tối khẩn', EMERGENCY: 'Khẩn cấp', ROUTINE: 'Thường' };
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');

      const c = {
        ...caseObj,
        createdAt: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${now.toTimeString().slice(0, 8)}`,
        patient: {
          ...caseObj.patient,
          ageGroup: form.ageGroup || form.patients?.[0]?.ageGroup || 'ELDERLY',
          ageGroupText: (form.ageGroup === 'INFANT' ? 'Sơ sinh' : form.ageGroup === 'CHILD' ? 'Trẻ em' : form.ageGroup === 'ADULT' ? 'Người trưởng thành' : 'Người cao tuổi'),
          gender: form.gender || 'Nam'
        },
        location: { ...caseObj.location, address: form.address },
        incident: {
          ...caseObj.incident,
          code: form.incidentCode,
          name: incObj?.name || caseObj.incident?.name,
          severity: form.severity,
          severityText: sevText[form.severity] || caseObj.incident?.severityText,
          description: form.notes
        },
        dispatch: {
          ...caseObj.dispatch,
          vehiclePlate: plate,
          vehicleId: 'VEH-07',
          crewId: 'CREW-03',
          crewName: 'Kíp 3 - Cái Răng',
          hospitalId: form.hospital?.id || caseObj.dispatch?.hospitalId || 'HOSP_BVTU',
          hospitalName: form.hospital?.name || caseObj.dispatch?.hospitalName || 'Bệnh viện Đa khoa Trung ương Cần Thơ'
        }
      };

      const veh = (state.vehicles || []).find(v => v.plate === plate);
      if (veh) {
        Object.assign(veh, {
          status: 'EMERGENCY',
          statusText: 'Đang đến hiện trường',
          speed: 52,
          currentCaseId: c.id
        });
      }

      const crew = (state.crews || []).find(cr => cr.id === 'CREW-03');
      if (crew) {
        crew.status = 'ON_MISSION';
        crew.statusText = 'Đang làm nhiệm vụ';
      }

      state.cases = [c];

      window.CanThoMap?.resetMission?.(c.id);
      this.realtimeSelectedPlate = plate;
      this.currentMenu = 'realtime-map';
      this.demoRunning = true;
      this.closeDemoOverlay();
      this.setDemoButton(true); // Nút chuyển sang "Kết thúc"
      this.renderSidebar();
      this.renderCurrentView();

      window.StateManager.saveToSession?.();
      window.StateManager.notify('CASE_UPDATED', c); // lưu session + vẽ lại bản đồ, KPI

      window.CCNV_UI.Toast.show(
        `ĐÃ PHÁT LỆNH ĐIỀU ĐỘNG · CA ${c.code}`,
        `Xe ${plate} (Kíp 3 - Cái Răng) xuất phát tới ${c.location.address} → ${c.dispatch?.hospitalName || 'Bệnh viện Đa khoa Trung ương Cần Thơ'}`,
        true,
        6000
      );
    }

    // Đưa toàn bộ hệ thống về trạng thái sẵn sàng trực chiến ban đầu (0 ca, 8 xe Sẵn sàng)
    resetAllToReady({ notify = false } = {}) {
      const state = window.StateManager?.getState();
      if (!state) return;
      const plate = '65A-012.34';

      // 1. Dọn dẹp danh sách ca
      state.cases = [];
      state.demoRunning = false;
      state.demoCase = null;
      if (window.SEED_DATA) {
        window.SEED_DATA.demoRunning = false;
        window.SEED_DATA.demoCase = null;
      }

      // 2. Tất cả các xe về trạng thái sẵn sàng
      const initialCaiRangCoords = [10.0105, 105.7700];
      (state.vehicles || []).forEach(v => {
        v.status = 'READY';
        v.statusText = 'Sẵn sàng';
        v.speed = 0;
        v.currentCaseId = null;
        v.isDispatchedSimulated = false;
        if (v.plate === plate) {
          v.coords = initialCaiRangCoords; // Vị trí Trạm Cấp cứu Cái Răng
          v.station = 'Trạm Cấp cứu Cái Răng (Kíp 3)';
        }
      });

      // 3. Tất cả kíp trực về trạng thái sẵn sàng
      (state.crews || []).forEach(cr => {
        cr.status = 'READY';
        cr.statusText = 'Sẵn sàng';
      });

      // 4. Xóa cờ demo & đặt lại nút "Bắt đầu"
      try { sessionStorage.removeItem('ccnv_hospital_confirmed'); } catch (e) { }
      this.demoRunning = false;
      this.hospitalDemoRunning = false;
      this.hospitalAlertTriggered = false;
      this.demo = null;
      this.setDemoButton(false);
      this.closeDemoOverlay();

      // 5. Bản đồ: xóa mission, dọn dẹp hiện trường tai nạn, bỏ focus xe
      this.realtimeSelectedPlate = null;
      window.CanThoMap?.resetMission?.();
      if (this.mapInstance) {
        this.mapInstance.clearAllMissions?.();
        this.mapInstance.clearFocus();
      }

      // 6. Lưu session và thông báo cập nhật toàn hệ thống
      window.StateManager.saveToSession?.();
      if (notify) {
        window.StateManager.notify('CASE_UPDATED', null);
      }
    }

    // Tự động kết thúc demo khi xe cấp cứu đã đến bệnh viện (toàn bộ hệ thống trở về trạng thái khi chưa demo)
    completeDemoAtHospital(mission) {
      const state = window.StateManager?.getState();
      if (!state) return;
      const plate = mission?.plate || '65A-012.34';
      const hosp = mission?.hosp || (state.hospitals || []).find(h => h.id === 'HOSP_BVTU');
      const hospName = hosp?.name || 'Bệnh viện Đa khoa Trung ương Cần Thơ';
      const initialCaiRangCoords = [10.0105, 105.7700];

      // 1. Dọn dẹp danh sách ca (kết thúc ca, không còn ca tai nạn nào)
      state.cases = [];
      state.demoRunning = false;
      state.demoCase = null;
      if (window.SEED_DATA) {
        window.SEED_DATA.demoRunning = false;
        window.SEED_DATA.demoCase = null;
      }

      // 2. Xe 65A-012.34 và tất cả các xe chuyển về trạng thái Sẵn sàng (xanh) như trước demo
      (state.vehicles || []).forEach(v => {
        v.status = 'READY';
        v.statusText = 'Sẵn sàng';
        v.speed = 0;
        v.currentCaseId = null;
        v.isDispatchedSimulated = false;
        if (v.plate === '65A-012.34') {
          v.coords = initialCaiRangCoords;
          v.station = 'Trạm Cấp cứu Cái Răng (Kíp 3)';
        }
      });

      // 3. Toàn bộ kíp trực về sẵn sàng
      (state.crews || []).forEach(cr => {
        cr.status = 'READY';
        cr.statusText = 'Sẵn sàng';
      });

      // 4. Kết thúc chế độ demo, trả nút header về "Bắt đầu"
      this.demoRunning = false;
      this.demo = null;
      this.setDemoButton(false);
      this.closeDemoOverlay();

      // 5. Bản đồ: xóa mission, dọn sạch hiện trường tai nạn, xóa lộ trình, bỏ chọn xe
      this.realtimeSelectedPlate = null; // Trả về trạng thái chưa demo (không chọn xe nào)
      window.CanThoMap?.resetMission?.();
      if (this.mapInstance) {
        this.mapInstance.clearAllMissions?.();
        this.mapInstance.clearFocus();
      }

      // 6. Lưu session & thông báo cập nhật toàn hệ thống
      window.StateManager.saveToSession?.();
      window.StateManager.notify('CASE_UPDATED', null);

      if (this.currentMenu === 'realtime-map') {
        this.renderCurrentView();
      }
      this.renderSidebar();
      this.updateKpiBar();

      window.CCNV_UI.Toast.show(
        'ĐÃ HOÀN TẤT CA CẤP CỨU',
        `Xe ${plate} đã đến ${hospName} và bàn giao người bệnh an toàn. Toàn bộ hệ thống trở về trạng thái sẵn sàng trực chiến.`,
        true,
        5000
      );
    }

    // Nhấn Kết thúc → tất cả các xe và kíp trực trở về trạng thái Sẵn sàng, xóa hiện trường tai nạn
    endDemo() {
      const state = window.StateManager?.getState();
      const plate = '65A-012.34';
      const initialCaiRangCoords = [10.0105, 105.7700];

      if (state) {
        state.cases = [];
        state.demoRunning = false;
        state.demoCase = null;
      }
      if (window.SEED_DATA) {
        window.SEED_DATA.demoRunning = false;
        window.SEED_DATA.demoCase = null;
      }

      (state?.vehicles || []).forEach(v => {
        v.status = 'READY';
        v.statusText = 'Sẵn sàng';
        v.speed = 0;
        v.currentCaseId = null;
        v.isDispatchedSimulated = false;
        if (v.plate === plate) {
          v.coords = initialCaiRangCoords;
          v.station = 'Trạm Cấp cứu Cái Răng (Kíp 3)';
        }
      });

      (state?.crews || []).forEach(cr => {
        cr.status = 'READY';
        cr.statusText = 'Sẵn sàng';
      });

      this.demoRunning = false;
      this.demo = null;
      this.setDemoButton(false);
      this.closeDemoOverlay();

      this.realtimeSelectedPlate = null;
      window.CanThoMap?.resetMission?.();
      if (this.mapInstance) {
        this.mapInstance.clearAllMissions?.();
        this.mapInstance.clearFocus();
      }

      window.StateManager.saveToSession?.();
      window.StateManager.notify('CASE_UPDATED', null);

      if (this.currentMenu === 'realtime-map') {
        this.renderCurrentView();
      }
      this.renderSidebar();
      this.updateKpiBar();

      window.CCNV_UI.Toast.show(
        'ĐÃ KẾT THÚC DEMO',
        'Tất cả phương tiện và kíp trực đã trở về trạng thái sẵn sàng trực chiến.'
      );
    }

    stopVoiceDemoAudio() {
      if (this._currentVoiceAudio) {
        try {
          this._currentVoiceAudio.pause();
          this._currentVoiceAudio.currentTime = 0;
        } catch (e) { }
        this._currentVoiceAudio = null;
      }
      if (this._voiceRafId) {
        cancelAnimationFrame(this._voiceRafId);
        this._voiceRafId = null;
      }
      if (this._voiceIntervalId) {
        clearInterval(this._voiceIntervalId);
        this._voiceIntervalId = null;
      }
    }

    cancelDemo() {
      this.stopVoiceDemoAudio();
      this.closeDemoOverlay();
      this.demo = null;
      this.demoRunning = false;
      this.setDemoButton(false);
      window.CCNV_UI.Toast.show('Đã dừng demo', 'Bản đồ tiếp tục ở trạng thái sẵn sàng trực chiến.');
    }

    closeDemoOverlay() {
      this.stopVoiceDemoAudio();
      clearTimeout(this.demo?.timer);
      clearInterval(this.demo?.ring);
      if (this._callCenterKeyHandler) {
        window.removeEventListener('keydown', this._callCenterKeyHandler);
        this._callCenterKeyHandler = null;
      }
      const overlay = document.getElementById('demo-overlay');
      if (overlay) {
        overlay.removeAttribute('id');
        overlay.classList.remove('is-open');
        setTimeout(() => overlay.remove(), 240);
      }
    }

    setDemoButton(running) {
      const btn = document.getElementById('btn-demo-start');
      if (btn) {
        btn.classList.toggle('is-running', running);
        btn.title = running ? 'Kết thúc ca demo và đưa tất cả xe về trạng thái sẵn sàng' : 'Chạy kịch bản demo: cuộc gọi đến → nhập thông tin → điều xe trên bản đồ';
        const label = btn.querySelector('.btn-demo-label');
        if (label) label.textContent = running ? 'Kết thúc' : 'Bắt đầu';
      }

      // Cập nhật tooltip và hiệu ứng cho icon quả chuông thông báo (nơi kích hoạt demo)
      const bellBtn = document.getElementById('btn-header-bell');
      if (bellBtn) {
        bellBtn.classList.toggle('is-demo-running', Boolean(running));
        const isHospital = this.isHospitalMode();
        if (isHospital) {
          bellBtn.title = running
            ? 'Đang chạy demo tiếp nhận - Nhấn quả chuông để kết thúc demo'
            : 'Nhấn vào quả chuông để bắt đầu demo tiếp nhận bệnh nhân';
        } else {
          bellBtn.title = running
            ? 'Đang chạy demo điều phối - Nhấn quả chuông để kết thúc ca demo'
            : 'Nhấn vào quả chuông để bắt đầu demo kịch bản cấp cứu 115';
        }
      }
    }
  }

  window.CentralApp = new CentralApp();
})(window);
