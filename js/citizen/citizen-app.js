/**
 * CCNV CITIZEN APP - CORE APPLICATION CONTROLLER
 * Full Sitemap Implementation:
 * - Onboarding (Phone Auth + Data Sharing Consent)
 * - Home (1-Touch Anti-Accidental Touch SOS + GPS Status + Quick Incident Triggers)
 * - Emergency Request (Case Management, Realtime Ambulance Tracking & ETA, First Aid Guidance,
 *                      2-Way Messaging & Calling, Live Location Sharing, Self-Transport Confirmation,
 *                      Vitals & Interventions Recording, Safe Cancellation Bottom Sheet)
 * - Healthcare Facilities (Hospital Search, Specialty Filter, Realtime Capacity, Hotline, Map)
 * - Personal Profile (Emergency Medical Info, Emergency Contacts, Privacy Rights & Data Consent, Request History)
 */

(function (window) {
  'use strict';

  // --- LOCAL PERSISTENT STORAGE KEYS ---
  const STORAGE_KEY_AUTH = 'ccnv_citizen_auth_state';
  const STORAGE_KEY_PROFILE = 'ccnv_citizen_medical_profile';
  const STORAGE_KEY_CONTACTS = 'ccnv_citizen_emergency_contacts';
  const STORAGE_KEY_PRIVACY = 'ccnv_citizen_privacy_settings';
  const STORAGE_KEY_ACTIVE_CASE = 'ccnv_citizen_active_case';
  const STORAGE_KEY_NAV_STATE = 'ccnv_citizen_nav_state';

  // --- CITIZEN APP CONTROLLER ---
  class CitizenApp {
    constructor() {
      this.currentTab = 'tab-home';
      this.activeSubProfileTab = 'sub-emergency-contacts';
      this.hospFilterCategory = 'ALL';
      this.hospSearchQuery = '';
      this.mapTracking = null;
      this.mapHospitals = null;
      this.hospitalMarkersLayer = null;
      this.hospMarkersById = {};
      this.hospRouteLayer = null;
      this.mapHomeFacilities = null;
      this.vehicleMarker = null;
      this.citizenMarker = null;
      this.routePolyline = null;
      this.vehicleSimInterval = null;
      this.cprInterval = null;
      this.metronomeBeep = false;

      // Default Account State
      this.auth = {
        isLoggedIn: true,
        phone: '0907.654.321',
        fullName: 'Nguyễn Văn An',
        isVerified: true,
        consentAccepted: true
      };

      // Medical Profile State
      this.medicalProfile = {
        fullName: 'Nguyễn Văn An',
        phone: '0907.654.321',
        dob: '1985-06-12',
        gender: 'Nam',
        idCard: '092095001234',
        address: 'Số 3/2, P. Xuân Khánh, Q. Ninh Kiều, TP. Cần Thơ',
        bloodType: 'O+',
        allergies: 'Dị ứng thuốc nhóm Penicillin, dị ứng hải sản',
        chronicDiseases: 'Tăng huyết áp độ 2 (đang điều trị), Tiền sử hen phế quản nhẹ',
        medications: 'Amlodipine 5mg (1 viên/ngày uống sáng)',
        bhytCode: 'GD4920950012345',
        specialNotes: 'Có mang theo ống hít cắt cơn Salbutamol trong túi cá nhân'
      };

      // Emergency Contacts
      this.contacts = [
        { id: 'cnt-1', name: 'Nguyễn Thị Mai', relation: 'Vợ', phone: '0918.765.432', isPrimary: true, autoSms: true },
        { id: 'cnt-2', name: 'Nguyễn Hoàng Long', relation: 'Con trai', phone: '0939.112.233', isPrimary: false, autoSms: true }
      ];

      // Privacy Data Consents (Nghị định 13/2023/NĐ-CP)
      this.privacy = {
        shareLiveGps: true,
        shareMedicalProfile: true,
        notifyEmergencyContacts: true,
        shareHospitalAdvance: true,
        recordCallAudio: true,
        lastAuditLog: 'BS. CKI. Nguyễn Văn Thành (Kíp xe 65A-011.15) truy cập lúc 08:15:32'
      };

      // Active Emergency Case State
      this.activeCase = {
        isActive: true, // Default active for immediate interactive review
        id: 'CC-261002-002',
        code: 'CC-261002-002',
        createdAt: '08:12:15',
        status: 'MOVING',
        stageLabel: 'Xe đang đến',
        etaMinutes: 4,
        distanceKm: 1.6,
        speedKmH: 48,
        patientLocation: {
          name: 'Đại học Cần Thơ - Cổng A đường 3/2, P. Xuân Khánh, Q. Ninh Kiều',
          coords: [10.0298, 105.7702]
        },
        vehicle: {
          plate: '65A-011.15',
          type: 'Type B - Cứu thương tiêu chuẩn',
          coords: [10.0210, 105.7790],
          station: 'Trạm Cấp cứu Trung tâm (BVĐK Cần Thơ)'
        },
        crew: {
          doctor: 'BS. CKI. Nguyễn Văn Thành',
          nurse: 'ĐDV. Lê Hồng Hoa',
          driver: 'TX. Trần Hữu Nghĩa',
          phone: '0903.115.115'
        },
        hospital: {
          id: 'HOSP_BVDK',
          name: 'BV Đa khoa TP Cần Thơ',
          address: 'Số 04 Châu Văn Liêm, P. An Lạc, Q. Ninh Kiều'
        },
        incident: {
          code: 'INC_RESPIRATORY',
          name: 'Suy hô hấp cấp / Khó thở dữ dội',
          severity: 'CRITICAL',
          description: 'Nạn nhân khó thở co kéo cơ hô hấp phụ, tím môi nhẹ, vã mồ hôi'
        },
        vitals: {
          consciousness: 'Tỉnh, tiếp xúc chậm',
          pulse: '110',
          bp: '145/90',
          rr: '26',
          spO2: '92',
          interventions: 'Đã nới lỏng quần áo, cho bệnh nhân ngồi tư thế Fowler dựa lưng thẳng',
          notes: 'Đang chuẩn bị người đón xe tại Cổng A đường 3/2'
        },
        messages: [
          { sender: 'dispatcher', time: '08:12', text: 'Trung tâm 115 Cần Thơ đã tiếp nhận tọa độ GPS khẩn cấp của bạn tại Đại học Cần Thơ.' },
          { sender: 'dispatcher', time: '08:13', text: 'Lệnh điều động phát tới xe 65A-011.15. Kíp trực BS. Thành đã xuất phát, dự kiến đến sau 4 phút.' },
          { sender: 'citizen', time: '08:14', text: 'Bệnh nhân đang ngồi ở sảnh nhà điều hành, người nhà đã ra cổng đón xe.' }
        ],
        isSelfTransport: false,
        selfTransportHospital: null
      };

      // History of Cases
      this.historyCases = [
        {
          id: 'CC-261001-018',
          date: '01/10/2026 21:40',
          incident: 'Đột quỵ não / Nghi ngờ tai biến',
          vehicle: '65A-015.67',
          hospital: 'BV Đa khoa TP Cần Thơ',
          status: 'Hoàn tất',
          statusClass: 'ready',
          address: 'Đường 30/4, P. Hưng Lợi, Q. Ninh Kiều',
          summary: 'Tiếp cận sau 6 phút, chẩn đoán đột quỵ thiếu máu cục bộ cấp giờ thứ 2, chuyển thẳng phòng Can thiệp mạch BVĐK.'
        },
        {
          id: 'CC-261001-017',
          date: '01/10/2026 19:15',
          incident: 'Tai nạn giao thông ngã xe',
          vehicle: '65A-011.15',
          hospital: 'BV Đa khoa TW Cần Thơ',
          status: 'Hoàn tất',
          statusClass: 'ready',
          address: 'Cầu Quang Trung, P. Hưng Phú, Q. Cái Răng',
          summary: 'Nẹp cố định cẳng tay trái gãy kín, băng ép cầm máu, chuyển khoa Cấp cứu an toàn.'
        },
        {
          id: 'CC-261001-016',
          date: '01/10/2026 17:30',
          incident: 'Chấn thương phần mềm nhẹ',
          vehicle: 'Tự di chuyển',
          hospital: 'TTYT Quận Ninh Kiều',
          status: 'Tự di chuyển / Đã hủy xe',
          statusClass: 'maintenance',
          address: 'Đường Nguyễn Văn Cừ, P. An Khánh',
          summary: 'Người dân chọn tự đưa người bệnh bằng taxi sau khi được ĐPV 115 tư vấn hướng dẫn sơ cứu.'
        }
      ];

      // Hospitals cache
      this.hospitals = [];
    }

    async init() {
      this.loadFromStorage();
      await this.loadHospitalsData();
      this.bindEvents();
      this.applyNavState();
      this.renderAllViews();
      this.checkOnboardingGate();

      // Listen for global CCNV state updates
      window.addEventListener('ccnvStateUpdate', (e) => {
        if (e.detail && e.detail.payload && e.detail.payload.case) {
          this.syncRemoteCase(e.detail.payload.case);
        }
      });
    }

    // --- STORAGE MANAGEMENT ---
    loadFromStorage() {
      try {
        const savedAuth = localStorage.getItem(STORAGE_KEY_AUTH);
        if (savedAuth) this.auth = Object.assign(this.auth, JSON.parse(savedAuth));

        const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
        if (savedProfile) this.medicalProfile = Object.assign(this.medicalProfile, JSON.parse(savedProfile));

        const savedContacts = localStorage.getItem(STORAGE_KEY_CONTACTS);
        if (savedContacts) this.contacts = JSON.parse(savedContacts);

        const savedPrivacy = localStorage.getItem(STORAGE_KEY_PRIVACY);
        if (savedPrivacy) this.privacy = Object.assign(this.privacy, JSON.parse(savedPrivacy));

        const savedCase = localStorage.getItem(STORAGE_KEY_ACTIVE_CASE);
        if (savedCase) this.activeCase = Object.assign(this.activeCase, JSON.parse(savedCase));

        localStorage.removeItem(STORAGE_KEY_NAV_STATE);
      } catch (err) {
        console.warn('CitizenApp: Error reading localStorage:', err);
      }
    }

    saveToStorage() {
      try {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(this.auth));
        localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(this.medicalProfile));
        localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(this.contacts));
        localStorage.setItem(STORAGE_KEY_PRIVACY, JSON.stringify(this.privacy));
        localStorage.setItem(STORAGE_KEY_ACTIVE_CASE, JSON.stringify(this.activeCase));
      } catch (err) {
        console.warn('CitizenApp: Error writing localStorage:', err);
      }
    }

    // --- LOAD HOSPITALS FROM CCNV DATA REPO ---
    async loadHospitalsData() {
      if (window.appState && window.appState.hospitals) {
        this.hospitals = window.appState.hospitals;
      } else {
        try {
          const resp = await fetch('data.json');
          const data = await resp.json();
          this.hospitals = data.hospitals || [];
        } catch (e) {
          if (window.SEED_DATA && window.SEED_DATA.hospitals) {
            this.hospitals = window.SEED_DATA.hospitals;
          }
        }
      }
    }

    // --- NAVIGATION CONTROLLER ---
    switchTab(tabId) {
      if (tabId === 'tab-emergency-request') tabId = 'tab-home';
      this.currentTab = tabId;

      document.querySelectorAll('.citizen-tab-panel').forEach(panel => {
        panel.classList.remove('active');
      });
      const targetPanel = document.getElementById(tabId);
      if (targetPanel) targetPanel.classList.add('active');

      document.querySelectorAll('.citizen-nav-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-target') === tabId);
      });

      // Special Tab-Switching Actions
      if (tabId === 'tab-home') {
        if (this.activeCase.isActive && this.activeCase.status !== 'CANCELLED') {
          setTimeout(() => this.initOrRefreshTrackingMap(), 150);
        } else {
          setTimeout(() => this.initOrRefreshHomeFacilitiesMap(), 150);
        }
      } else if (tabId === 'tab-hospitals') {
        this.renderHospitalsList(this.hospSearchQuery || '', this.hospFilterCategory || 'ALL');
        setTimeout(() => this.initOrRefreshHospitalMap(), 150);
      }
    }

    // --- BOTTOM NAVIGATION CONTROLLER (Cố định ở đáy màn hình) ---
    applyNavState() {
      // Thanh điều hướng cố định dưới cùng, không cần logic đóng mở
    }

    invalidateAllActiveMaps() {
      setTimeout(() => {
        if (this.mapHomeFacilities) this.mapHomeFacilities.invalidateSize();
        if (this.mapTracking) this.mapTracking.invalidateSize();
        if (this.mapHospitals) this.mapHospitals.invalidateSize();
      }, 100);
      setTimeout(() => {
        if (this.mapHomeFacilities) this.mapHomeFacilities.invalidateSize();
        if (this.mapTracking) this.mapTracking.invalidateSize();
        if (this.mapHospitals) this.mapHospitals.invalidateSize();
      }, 250);
    }

    switchProfileSubTab(subTabId) {
      this.activeSubProfileTab = subTabId;
      document.querySelectorAll('.profile-nav-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-subtab') === subTabId);
      });
      document.querySelectorAll('.profile-sub-view').forEach(view => {
        view.classList.toggle('active', view.id === subTabId);
      });
    }

    // --- AUTHENTICATION & ONBOARDING GATE ---
    checkOnboardingGate() {
      const authOverlay = document.getElementById('auth-portal-overlay');
      const onboardOverlay = document.getElementById('onboarding-modal-flow');

      if (!this.auth.isLoggedIn) {
        if (authOverlay) authOverlay.style.display = 'flex';
        if (onboardOverlay) onboardOverlay.style.display = 'none';
      } else {
        if (authOverlay) authOverlay.style.display = 'none';
        if (!this.auth.isVerified || !this.auth.consentAccepted) {
          if (onboardOverlay) onboardOverlay.style.display = 'flex';
        } else {
          if (onboardOverlay) onboardOverlay.style.display = 'none';
        }
      }
    }

    restartOnboardingDemo() {
      this.auth.isVerified = false;
      this.auth.consentAccepted = false;
      const overlay = document.getElementById('onboarding-modal-flow');
      if (overlay) overlay.style.display = 'flex';
      this.setOtpStep(1);
      window.CCNV_UI.Toast.show('ĐÃ MỞ LUỒNG XÁC THỰC', 'Bạn có thể thử nghiệm lại quy trình Xác thực SĐT & Đồng ý chia sẻ dữ liệu.');
    }

    setOtpStep(stepNumber) {
      document.getElementById('onboard-step-1').style.display = stepNumber === 1 ? 'block' : 'none';
      document.getElementById('onboard-step-2').style.display = stepNumber === 2 ? 'block' : 'none';
      document.getElementById('onboard-step-3').style.display = stepNumber === 3 ? 'block' : 'none';

      // Update stepper dots
      for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`step-dot-${i}`);
        if (!dot) continue;
        dot.classList.remove('active', 'done');
        if (i === stepNumber) dot.classList.add('active');
        else if (i < stepNumber) dot.classList.add('done');
      }
    }

    // --- EVENT BINDINGS ---
    bindEvents() {
      // Bottom Navigation Tabs
      document.querySelectorAll('.citizen-nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          const target = tab.getAttribute('data-target');
          this.switchTab(target);
        });
      });



      // User pill click -> Profile tab
      const userPill = document.getElementById('citizen-header-user-btn');
      if (userPill) {
        userPill.addEventListener('click', () => this.switchTab('tab-profile'));
      }

      // Profile sub-tabs
      document.querySelectorAll('.profile-nav-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const subtab = btn.getAttribute('data-subtab');
          this.switchProfileSubTab(subtab);
        });
      });

      // SOS Touch & Hold Handlers (ND-04)
      this.bindSosTrigger();

      // Countdown Handlers
      const btnCancelCountdown = document.getElementById('btn-cancel-sos-countdown');
      if (btnCancelCountdown) {
        btnCancelCountdown.addEventListener('click', () => this.cancelCountdown());
      }

      // Quick incident triggers
      document.querySelectorAll('.quick-incident-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const incidentCode = btn.getAttribute('data-incident');
          const incidentName = btn.querySelector('span strong').textContent;
          this.triggerEmergencySos(incidentCode, incidentName);
        });
      });

      // Floating Active Banner click -> jump to tracking on Home tab
      const activeBanner = document.getElementById('citizen-active-banner');
      if (activeBanner) {
        activeBanner.addEventListener('click', () => this.switchTab('tab-home'));
      }

      // Cancel bottom sheet handlers
      const btnOpenCancel = document.getElementById('btn-citizen-request-cancel');
      const cancelBackdrop = document.getElementById('cancel-bottom-sheet');
      const btnKeepWaiting = document.getElementById('btn-sheet-keep-waiting');
      const btnConfirmCancel = document.getElementById('btn-sheet-confirm-cancel');

      if (btnOpenCancel) {
        btnOpenCancel.addEventListener('click', () => cancelBackdrop.classList.add('active'));
      }
      if (btnKeepWaiting) {
        btnKeepWaiting.addEventListener('click', () => cancelBackdrop.classList.remove('active'));
      }
      if (btnConfirmCancel) {
        btnConfirmCancel.addEventListener('click', () => this.confirmCancelCase());
      }

      // Cancellation reasons select
      if (cancelBackdrop) {
        cancelBackdrop.querySelectorAll('.bottom-sheet-reason-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            cancelBackdrop.querySelectorAll('.bottom-sheet-reason-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
          });
        });
      }

      // 2-Way Chat input
      const btnSendChat = document.getElementById('btn-send-citizen-chat');
      const inputChat = document.getElementById('input-citizen-chat');
      if (btnSendChat && inputChat) {
        const sendAction = () => {
          const text = inputChat.value.trim();
          if (text) {
            this.sendChatMessage(text);
            inputChat.value = '';
          }
        };
        btnSendChat.addEventListener('click', sendAction);
        inputChat.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') sendAction();
        });
      }

      // Chat quick chips
      document.querySelectorAll('.chat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          this.sendChatMessage(chip.textContent);
        });
      });

      // Call Center Direct Button
      const btnCallCenter = document.getElementById('btn-call-center-direct');
      if (btnCallCenter) {
        btnCallCenter.addEventListener('click', () => this.openCallDialog());
      }

      // Live Location Sharing Button
      const btnShareLoc = document.getElementById('btn-share-live-location');
      if (btnShareLoc) {
        btnShareLoc.addEventListener('click', () => this.toggleLiveLocationSharing());
      }

      // Self-Transport Button & Modal
      const btnOpenSelfTransport = document.getElementById('btn-open-self-transport');
      const modalSelfTransport = document.getElementById('modal-self-transport');
      const btnCloseSelfModal = document.getElementById('btn-close-self-transport');
      const btnConfirmSelf = document.getElementById('btn-confirm-self-transport');

      if (btnOpenSelfTransport) {
        btnOpenSelfTransport.addEventListener('click', () => {
          modalSelfTransport.classList.add('active');
          this.renderSelfTransportHospitals();
        });
      }
      if (btnCloseSelfModal) {
        btnCloseSelfModal.addEventListener('click', () => modalSelfTransport.classList.remove('active'));
      }
      if (btnConfirmSelf) {
        btnConfirmSelf.addEventListener('click', () => this.confirmSelfTransportSelection());
      }

      // Vitals Form Update
      const formVitals = document.getElementById('form-citizen-vitals');
      if (formVitals) {
        formVitals.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitVitalsUpdate();
        });
      }

      // First Aid Modal Trigger Cards
      document.querySelectorAll('.first-aid-card').forEach(card => {
        card.addEventListener('click', () => {
          const type = card.getAttribute('data-aid-type');
          this.openFirstAidGuide(type);
        });
      });

      // Hospital search, clear button & specialty filters
      const searchHosp = document.getElementById('input-hospital-search');
      const btnClearSearch = document.getElementById('btn-clear-hosp-search');

      if (searchHosp) {
        searchHosp.addEventListener('input', (e) => {
          const val = e.target.value;
          if (btnClearSearch) btnClearSearch.style.display = val.length > 0 ? 'block' : 'none';
          this.hospSearchQuery = val;
          this.renderHospitalsList(val, this.hospFilterCategory);
        });
      }

      if (btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
          if (searchHosp) {
            searchHosp.value = '';
            searchHosp.focus();
          }
          btnClearSearch.style.display = 'none';
          this.hospSearchQuery = '';
          this.renderHospitalsList('', this.hospFilterCategory);
        });
      }

      document.querySelectorAll('.hospital-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.hospital-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.getAttribute('data-filter');
          this.hospFilterCategory = filter;
          this.renderHospitalsList(searchHosp ? searchHosp.value : '', filter);
        });
      });

      // Medical Profile Form Save
      const formProfile = document.getElementById('form-medical-profile');
      if (formProfile) {
        formProfile.addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveMedicalProfileForm();
        });
      }

      // Emergency Contacts Add/Delete
      const btnAddContact = document.getElementById('btn-add-contact');
      if (btnAddContact) {
        btnAddContact.addEventListener('click', () => this.openAddContactModal());
      }

      // Privacy Settings Save
      const formPrivacy = document.getElementById('form-privacy-settings');
      if (formPrivacy) {
        formPrivacy.addEventListener('change', () => this.savePrivacySettingsFromUI());
      }

      const btnRevokeAll = document.getElementById('btn-revoke-all-privacy');
      if (btnRevokeAll) {
        btnRevokeAll.addEventListener('click', () => this.revokeAllPrivacyConsents());
      }

      // Auth Portal (Login & Register)
      this.bindAuthPortalEvents();

      // Onboarding Step Flow Buttons
      this.bindOnboardingFlowEvents();
    }

    // --- AUTHENTICATION PORTAL (LOGIN & REGISTER) ---
    bindAuthPortalEvents() {
      const tabBtnLogin = document.getElementById('auth-tab-btn-login');
      const tabBtnRegister = document.getElementById('auth-tab-btn-register');
      const panelLogin = document.getElementById('auth-panel-login');
      const panelRegister = document.getElementById('auth-panel-register');
      const authOverlay = document.getElementById('auth-portal-overlay');

      const switchToLogin = () => {
        if (tabBtnLogin && tabBtnRegister && panelLogin && panelRegister) {
          tabBtnLogin.classList.add('active');
          tabBtnRegister.classList.remove('active');
          panelLogin.style.display = 'block';
          panelRegister.style.display = 'none';
        }
      };

      const switchToRegister = () => {
        if (tabBtnLogin && tabBtnRegister && panelLogin && panelRegister) {
          tabBtnRegister.classList.add('active');
          tabBtnLogin.classList.remove('active');
          panelRegister.style.display = 'block';
          panelLogin.style.display = 'none';
        }
      };

      if (tabBtnLogin) tabBtnLogin.addEventListener('click', switchToLogin);
      if (tabBtnRegister) tabBtnRegister.addEventListener('click', switchToRegister);

      const linkGoReg = document.getElementById('link-go-to-register');
      const linkGoLog = document.getElementById('link-go-to-login');
      if (linkGoReg) linkGoReg.addEventListener('click', switchToRegister);
      if (linkGoLog) linkGoLog.addEventListener('click', switchToLogin);

      // Forgot password link -> open OTP flow
      const linkForgot = document.getElementById('link-forgot-pass');
      if (linkForgot) {
        linkForgot.addEventListener('click', () => {
          if (authOverlay) authOverlay.style.display = 'none';
          this.restartOnboardingDemo();
        });
      }

      // Login Form Submission
      const formLogin = document.getElementById('form-citizen-login');
      if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
          e.preventDefault();
          const phoneInput = document.getElementById('input-login-phone');
          const passInput = document.getElementById('input-login-pass');
          const phone = phoneInput ? phoneInput.value.trim() : '';

          if (phone.length >= 9) {
            this.auth.isLoggedIn = true;
            this.auth.phone = phone;
            this.auth.isVerified = true;
            this.auth.consentAccepted = true;
            this.saveToStorage();

            if (authOverlay) authOverlay.style.display = 'none';
            window.CCNV_UI.SoundFx.playBeep();
            window.CCNV_UI.Toast.show(
              'ĐĂNG NHẬP THÀNH CÔNG',
              `Chào mừng ${this.auth.fullName} (${phone}) đến với Kênh Cấp cứu 115 Cần Thơ.`
            );
            this.renderAllViews();
          } else {
            alert('Vui lòng nhập số điện thoại hợp lệ (ít nhất 9-10 chữ số)!');
          }
        });
      }



      // Register Form Submission ("Logic chỉ cần đăng nhập thôi, đăng ký chỉ cần hiện nút là được")
      const formRegister = document.getElementById('form-citizen-register');
      if (formRegister) {
        formRegister.addEventListener('submit', (e) => {
          e.preventDefault();
          const regName = document.getElementById('input-reg-name') ? document.getElementById('input-reg-name').value : 'Người Dân';
          const regPhone = document.getElementById('input-reg-phone') ? document.getElementById('input-reg-phone').value : '0907.654.321';

          window.CCNV_UI.SoundFx.playBeep();
          window.CCNV_UI.Toast.show(
            'ĐÃ TIẾP NHẬN ĐĂNG KÝ',
            `Thông tin tài khoản ${regName} (${regPhone}) đã được ghi nhận. Vui lòng đăng nhập để sử dụng ngay!`
          );

          // Auto switch to login tab with the prefilled phone
          switchToLogin();
          const phoneInput = document.getElementById('input-login-phone');
          if (phoneInput && regPhone) phoneInput.value = regPhone;
        });
      }

      // Logout Button in Profile View
      const btnLogout = document.getElementById('btn-logout-citizen');
      if (btnLogout) {
        btnLogout.addEventListener('click', () => {
          if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?')) {
            this.auth.isLoggedIn = false;
            this.saveToStorage();
            if (authOverlay) authOverlay.style.display = 'flex';
            window.CCNV_UI.Toast.show('ĐÃ ĐĂNG XUẤT', 'Bạn đã đăng xuất khỏi phiên làm việc an toàn.');
          }
        });
      }
    }

    // --- ONBOARDING FLOW BINDINGS (ND-01, ND-02, ND-03) ---
    bindOnboardingFlowEvents() {
      // Step 1: Submit Phone
      const btnSendOtp = document.getElementById('btn-onboard-send-otp');
      const inputPhone = document.getElementById('input-onboard-phone');
      if (btnSendOtp && inputPhone) {
        btnSendOtp.addEventListener('click', () => {
          const phone = inputPhone.value.trim();
          if (phone.length < 9) {
            alert('Vui lòng nhập số điện thoại hợp lệ (10 số)!');
            return;
          }
          this.auth.phone = phone;
          document.getElementById('otp-target-phone').textContent = phone;
          this.setOtpStep(2);
          this.startOtpTimer();
        });
      }

      // Step 2: Auto jump OTP Inputs
      const otpInputs = document.querySelectorAll('.otp-box');
      otpInputs.forEach((box, idx) => {
        box.addEventListener('input', (e) => {
          if (box.value.length === 1 && idx < otpInputs.length - 1) {
            otpInputs[idx + 1].focus();
          }
        });
        box.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && box.value === '' && idx > 0) {
            otpInputs[idx - 1].focus();
          }
        });
      });

      // Step 2: Verify OTP
      const btnVerifyOtp = document.getElementById('btn-verify-otp');
      if (btnVerifyOtp) {
        btnVerifyOtp.addEventListener('click', () => {
          let otpCode = '';
          otpInputs.forEach(b => otpCode += b.value);
          if (otpCode.length < 6) {
            // Fill mock for demo convenience if empty
            otpInputs.forEach((b, i) => b.value = ['1', '1', '5', '1', '1', '5'][i]);
          }
          this.auth.isVerified = true;
          this.setOtpStep(3);
        });
      }

      // Step 3: Consent agreement
      const btnAcceptConsent = document.getElementById('btn-accept-data-consent');
      if (btnAcceptConsent) {
        btnAcceptConsent.addEventListener('click', () => {
          this.auth.consentAccepted = true;
          this.auth.isLoggedIn = true;
          this.saveToStorage();
          document.getElementById('onboarding-modal-flow').style.display = 'none';
          window.CCNV_UI.Toast.show(
            'XÁC THỰC THÀNH CÔNG',
            `Chào mừng ${this.auth.fullName} (${this.auth.phone}) đến với Kênh Cấp cứu 115 Cần Thơ.`
          );
          this.renderAllViews();
        });
      }

      // Button to re-test onboarding from Profile view
      const btnRestartOnboarding = document.getElementById('btn-retest-onboarding');
      if (btnRestartOnboarding) {
        btnRestartOnboarding.addEventListener('click', () => this.restartOnboardingDemo());
      }
    }

    startOtpTimer() {
      let timeLeft = 60;
      const timerEl = document.getElementById('otp-countdown-text');
      if (this.otpInterval) clearInterval(this.otpInterval);

      if (timerEl) {
        timerEl.textContent = `Gửi lại mã sau ${timeLeft}s`;
        this.otpInterval = setInterval(() => {
          timeLeft--;
          if (timeLeft <= 0) {
            clearInterval(this.otpInterval);
            timerEl.textContent = 'Gửi lại mã OTP';
            timerEl.style.cursor = 'pointer';
            timerEl.style.color = '#38BDF8';
            timerEl.onclick = () => this.startOtpTimer();
          } else {
            timerEl.textContent = `Gửi lại mã sau ${timeLeft}s`;
          }
        }, 1000);
      }
    }

    // --- SOS CALL TRIGGER FROM HEADER & OVERLAY (ND-04) ---
    bindSosTrigger() {
      // Header SOS Call Button (Icon cuộc gọi trên header)
      const headerSosBtn = document.getElementById('header-btn-sos');
      if (headerSosBtn) {
        headerSosBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.start5SecondCountdown();
        });
      }

      // Nút GỌI NGAY trong overlay đếm ngược 5 giây (Bỏ qua thời gian chờ)
      const btnCallNow = document.getElementById('btn-call-sos-now');
      if (btnCallNow) {
        btnCallNow.addEventListener('click', (e) => {
          e.preventDefault();
          this.triggerEmergencySos('INC_CALL_NOW', 'Cấp cứu SOS khẩn cấp (Người dân bấm Gọi ngay)');
        });
      }

      // Link xem toàn bộ danh sách bệnh viện trên màn hình chính
      const linkViewAllHosp = document.getElementById('home-link-view-all-hospitals');
      if (linkViewAllHosp) {
        linkViewAllHosp.addEventListener('click', () => {
          this.switchTab('tab-hospitals');
        });
      }
    }

    start5SecondCountdown() {
      const overlay = document.getElementById('countdown-overlay');
      const timerEl = document.getElementById('countdown-timer-num');
      if (!overlay || !timerEl) return;

      let sec = 5;
      timerEl.textContent = sec;
      overlay.style.display = 'flex';

      if (this.countdownInterval) clearInterval(this.countdownInterval);
      this.countdownInterval = setInterval(() => {
        sec--;
        timerEl.textContent = sec;
        window.CCNV_UI.SoundFx.playBeep();
        if (sec <= 0) {
          clearInterval(this.countdownInterval);
          overlay.style.display = 'none';
          this.triggerEmergencySos('INC_HEADER_SOS', 'Cấp cứu SOS khẩn cấp (Hết 5s chờ)');
        }
      }, 1000);
    }

    cancelCountdown() {
      if (this.countdownInterval) clearInterval(this.countdownInterval);
      const overlay = document.getElementById('countdown-overlay');
      if (overlay) overlay.style.display = 'none';
      window.CCNV_UI.Toast.show('ĐÃ HỦY ĐẾM NGƯỢC', 'Yêu cầu gọi cấp cứu chưa được gửi đi.');
    }

    // --- EMERGENCY SOS ACTIVATION (ND-05) ---
    triggerEmergencySos(incidentCode, incidentName) {
      if (this.countdownInterval) clearInterval(this.countdownInterval);
      const overlay = document.getElementById('countdown-overlay');
      if (overlay) overlay.style.display = 'none';

      // Setup active emergency case
      this.activeCase.isActive = true;
      this.activeCase.status = 'MOVING';
      this.activeCase.stageLabel = 'Xe đang đến';
      this.activeCase.incident.code = incidentCode || 'INC_RESPIRATORY';
      this.activeCase.incident.name = incidentName || 'Cấp cứu khẩn cấp 115';
      this.activeCase.etaMinutes = 4;
      this.activeCase.distanceKm = 1.6;
      this.activeCase.vehicle.coords = [10.0210, 105.7790];

      // Add audit log
      this.activeCase.messages.push({
        sender: 'dispatcher',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        text: `ĐPV 115 tiếp nhận tín hiệu khẩn: "${incidentName}". Xe 65A-011.15 đang vượt đèn ưu tiên di chuyển về vị trí của bạn!`
      });

      this.saveToStorage();
      this.renderAllViews();

      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);

      window.CCNV_UI.Toast.show(
        'ĐÃ KÍCH HOẠT CẤP CỨU 115',
        'Tọa độ GPS đã gửi về Trung tâm Điều hành Cần Thơ. Xe 65A-011.15 đang khẩn trương xuất phát.',
        true
      );

      // Jump directly to Home Screen (shows active case details)
      this.switchTab('tab-home');
      this.startAmbulanceSimulation();
    }

    // --- REALTIME AMBULANCE SIMULATION (MAP & MOVEMENT) ---
    startAmbulanceSimulation() {
      if (this.vehicleSimInterval) clearInterval(this.vehicleSimInterval);

      // Coordinates route from Hung Loi bridge to Can Tho University gate A
      const routePoints = [
        [10.0210, 105.7790], // Hung Loi
        [10.0235, 105.7760], // 30/4 St
        [10.0260, 105.7735], // Mau Than junction
        [10.0280, 105.7715], // 3/2 St
        [10.0298, 105.7702]  // Can Tho Univ
      ];

      let step = 0;
      this.vehicleSimInterval = setInterval(() => {
        if (!this.activeCase.isActive || this.activeCase.status === 'CANCELLED') {
          clearInterval(this.vehicleSimInterval);
          return;
        }

        if (step < routePoints.length - 1) {
          step++;
          this.activeCase.vehicle.coords = routePoints[step];
          const remainingSteps = routePoints.length - 1 - step;
          this.activeCase.etaMinutes = Math.max(1, remainingSteps + 1);
          this.activeCase.distanceKm = (remainingSteps * 0.4).toFixed(1);

          this.updateTrackingStatsUI();
          this.updateVehicleMarkerPos(this.activeCase.vehicle.coords);

          if (step === routePoints.length - 1) {
            this.activeCase.status = 'AT_SCENE';
            this.activeCase.stageLabel = 'Đã đến hiện trường';
            this.updateTrackingStatsUI();
            window.CCNV_UI.Toast.show(
              'XE CẤP CỨU ĐÃ ĐẾN NƠI',
              'Xe 65A-011.15 đã tiếp cận cổng Đại học Cần Thơ. Bác sĩ đang vào sơ cứu.',
              true
            );
          }
        }
      }, 7000);
    }

    updateTrackingStatsUI() {
      const etaEl = document.getElementById('track-eta-value');
      const distEl = document.getElementById('track-dist-value');
      const mapEtaBadge = document.getElementById('map-eta-badge');
      const statusTitle = document.getElementById('track-case-status-title');

      if (etaEl) etaEl.textContent = `~${this.activeCase.etaMinutes} PHÚT`;
      if (distEl) distEl.textContent = `${this.activeCase.distanceKm} km (Tốc độ: 48 km/h)`;
      if (mapEtaBadge) mapEtaBadge.textContent = `ETA: ~${this.activeCase.etaMinutes}P`;
      if (statusTitle) statusTitle.textContent = this.activeCase.stageLabel.toUpperCase();

      this.updateStepperUI();
    }

    updateStepperUI() {
      const steps = ['DISPATCHED', 'MOVING', 'AT_SCENE', 'TRANSPORTING', 'COMPLETED'];
      const currentIdx = steps.indexOf(this.activeCase.status);

      for (let i = 0; i < steps.length; i++) {
        const node = document.getElementById(`step-node-${i + 1}`);
        if (!node) continue;
        node.classList.remove('active', 'done');
        if (i < currentIdx) node.classList.add('done');
        else if (i === currentIdx) node.classList.add('active');
      }
    }

    // --- LEAFLET REALTIME MAP CONTROLLER ---
    initOrRefreshTrackingMap() {
      const container = document.getElementById('citizen-tracking-map');
      if (!container) return;

      if (!window.L) {
        console.warn('Leaflet GIS library not loaded');
        return;
      }

      if (!this.mapTracking) {
        const centerCoords = this.activeCase.patientLocation.coords;
        this.mapTracking = L.map('citizen-tracking-map', {
          zoomControl: false,
          attributionControl: false
        }).setView(centerCoords, 14);

        // Dark tile map (ArcGIS Canvas Dark)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri, DeLorme, NAVTEQ',
          maxNativeZoom: 16,
          maxZoom: 18
        }).addTo(this.mapTracking);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          attribution: '',
          maxNativeZoom: 16,
          maxZoom: 18
        }).addTo(this.mapTracking);

        // Citizen Marker (Red Pulse)
        const citizenIcon = L.divIcon({
          className: 'citizen-gis-marker',
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#EF4444;border:2.5px solid #FFFFFF;box-shadow:0 0 14px #EF4444;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        this.citizenMarker = L.marker(this.activeCase.patientLocation.coords, { icon: citizenIcon })
          .addTo(this.mapTracking)
          .bindPopup('<b>VỊ TRÍ CỦA BẠN</b><br>Cổng A Đại học Cần Thơ');

        // Ambulance Marker (Lucide Style Vehicle)
        const ambulanceIcon = L.divIcon({
          className: 'ambulance-gis-marker',
          html: `<div style="background:#0A1B2A;border:2px solid #E52521;border-radius:8px;padding:4px 6px;color:#FFFFFF;display:flex;align-items:center;gap:4px;box-shadow:0 0 12px rgba(229,37,33,0.7);font-size:10.5px;font-weight:700;">
                  <span style="color:#FF3B35;">🚑</span>
                  <span>65A-011.15</span>
                 </div>`,
          iconSize: [85, 26],
          iconAnchor: [42, 13]
        });

        this.vehicleMarker = L.marker(this.activeCase.vehicle.coords, { icon: ambulanceIcon })
          .addTo(this.mapTracking)
          .bindPopup('<b>XE CẤP CỨU ĐANG ĐẾN</b><br>Kíp 1 - BVĐK TP Cần Thơ');

        // Route Polyline
        this.routePolyline = L.polyline([
          this.activeCase.vehicle.coords,
          [10.0260, 105.7735],
          this.activeCase.patientLocation.coords
        ], {
          color: '#E52521',
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 8'
        }).addTo(this.mapTracking);
      } else {
        this.mapTracking.invalidateSize();
      }
    }

    updateVehicleMarkerPos(newCoords) {
      if (this.vehicleMarker) {
        this.vehicleMarker.setLatLng(newCoords);
      }
      if (this.routePolyline && this.citizenMarker) {
        this.routePolyline.setLatLngs([
          newCoords,
          this.citizenMarker.getLatLng()
        ]);
      }
    }

    // --- 2-WAY MESSAGING WITH 115 DISPATCHER ---
    sendChatMessage(text) {
      const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      this.activeCase.messages.push({
        sender: 'citizen',
        time: now,
        text: text
      });

      this.renderChatMessages();
      window.CCNV_UI.SoundFx.playBeep();

      // Automated intelligent Dispatcher response after 1.8s
      setTimeout(() => {
        let reply = 'ĐPV 115 đã nhận được tin nhắn của bạn và đã chuyển tiếp cho BS. Thành trên xe 65A-011.15.';
        if (text.includes('đón xe') || text.includes('cổng')) {
          reply = 'Rất tốt! Xe đang bật còi ưu tiên trên đường 3/2, tài xế đã nhìn thấy cổng ĐH Cần Thơ.';
        } else if (text.includes('thở') || text.includes('mệt') || text.includes('xỉu')) {
          reply = 'Bác sĩ dặn: Nới rộng khuy áo ngực, không tập trung đông người quanh nạn nhân, quạt nhẹ lấy khí tươi.';
        } else if (text.includes('chảy máu')) {
          reply = 'Hãy lấy gạc sạch hoặc khăn sạch ấn chặt vào vết thương để cầm máu ngay, tuyệt đối không đắp thuốc lá hay bột.';
        }

        this.activeCase.messages.push({
          sender: 'dispatcher',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          text: reply
        });
        this.renderChatMessages();
        window.CCNV_UI.SoundFx.playEmergencyTone();
      }, 1800);
    }

    renderChatMessages() {
      const area = document.getElementById('chat-messages-scroll');
      if (!area) return;

      area.innerHTML = this.activeCase.messages.map(m => `
        <div class="chat-bubble ${m.sender}">
          <div style="font-size:10px;color:${m.sender === 'citizen' ? '#FED7AA' : '#94A3B8'};margin-bottom:3px;display:flex;justify-content:space-between;gap:8px;">
            <strong>${m.sender === 'citizen' ? 'Bạn' : 'ĐPV Trung tâm 115'}</strong>
            <span>${m.time}</span>
          </div>
          <div>${m.text}</div>
        </div>
      `).join('');

      area.scrollTop = area.scrollHeight;
    }

    // --- CALL 115 DIALOG ---
    openCallDialog() {
      const modal = document.getElementById('modal-call-center');
      if (modal) modal.classList.add('active');
      window.CCNV_UI.SoundFx.playBeep();

      const btnClose = document.getElementById('btn-close-call-modal');
      if (btnClose) {
        btnClose.onclick = () => modal.classList.remove('active');
      }
    }

    // --- LIVE LOCATION SHARING (ND-05) ---
    toggleLiveLocationSharing() {
      const indicator = document.getElementById('live-share-status-tag');
      const shareUrl = `https://ccnv.cantho.gov.vn/track?case=${this.activeCase.code}&lat=${this.activeCase.patientLocation.coords[0]}&lng=${this.activeCase.patientLocation.coords[1]}`;

      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          window.CCNV_UI.Toast.show(
            'ĐÃ SAO CHÉP LIÊN KẾT VỊ TRÍ',
            'Đã sao chép link GPS trực tiếp vào bộ nhớ tạm. Bạn có thể gửi cho người thân qua Zalo hoặc SMS.'
          );
        }).catch(() => {});
      } else {
        window.CCNV_UI.Toast.show('ĐÃ BẬT PHÁT SÓNG GPS', 'Tọa độ WGS84: 10.0298N, 105.7702E đang chia sẻ liên tục.');
      }

      if (indicator) {
        indicator.textContent = 'ĐANG PHÁT SÓNG LIVE';
        indicator.style.color = '#34D399';
      }
    }

    // --- SELF-TRANSPORT CONFIRMATION WORKFLOW (ND-05) ---
    renderSelfTransportHospitals() {
      const container = document.getElementById('self-transport-hospital-list');
      if (!container) return;

      const suggestedHospitals = this.hospitals.slice(0, 3);
      container.innerHTML = suggestedHospitals.map((h, idx) => `
        <div class="hospital-card ${idx === 0 ? 'selected-hospital' : ''}" data-hosp-id="${h.id}" style="cursor:pointer;border:1px solid ${idx === 0 ? '#38BDF8' : '#1E3A56'};margin-bottom:8px;padding:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="color:#FFFFFF;font-size:13.5px;">${h.name}</strong>
            <span class="hospital-badge-status available" style="font-size:10px;">${h.statusText || 'Đang nhận'}</span>
          </div>
          <div style="font-size:11.5px;color:#94A3B8;margin-top:4px;">${h.address}</div>
          <div style="font-size:11px;color:#38BDF8;margin-top:4px;font-weight:600;">
            Khoảng cách: ~${(1.2 + idx * 0.9).toFixed(1)} km · Cấp cứu 24/7 (${h.availableBeds || 10} giường trống)
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.hospital-card').forEach(c => {
        c.addEventListener('click', () => {
          container.querySelectorAll('.hospital-card').forEach(x => {
            x.style.borderColor = '#1E3A56';
            x.classList.remove('selected-hospital');
          });
          c.style.borderColor = '#38BDF8';
          c.classList.add('selected-hospital');
        });
      });
    }

    confirmSelfTransportSelection() {
      const selected = document.querySelector('#self-transport-hospital-list .selected-hospital');
      const hospId = selected ? selected.getAttribute('data-hosp-id') : 'HOSP_BVDK';
      const targetHosp = this.hospitals.find(h => h.id === hospId) || this.hospitals[0];

      this.activeCase.isSelfTransport = true;
      this.activeCase.selfTransportHospital = targetHosp;
      this.activeCase.status = 'TRANSPORTING';
      this.activeCase.stageLabel = `Tự di chuyển đến ${targetHosp.name}`;

      document.getElementById('modal-self-transport').classList.remove('active');
      this.saveToStorage();
      this.renderAllViews();

      window.CCNV_UI.Toast.show(
        'ĐÃ XÁC NHẬN TỰ DI CHUYỂN',
        `Thông tin đã truyền trước tới Khoa Cấp cứu - ${targetHosp.name}. Bệnh viện đang sẵn sàng tiếp đón!`,
        true
      );
    }

    // --- VITALS & INTERVENTIONS SUBMISSION (ND-05) ---
    submitVitalsUpdate() {
      const consciousness = document.getElementById('vital-input-consciousness').value;
      const pulse = document.getElementById('vital-input-pulse').value;
      const bp = document.getElementById('vital-input-bp').value;
      const rr = document.getElementById('vital-input-rr').value;
      const spO2 = document.getElementById('vital-input-spo2').value;
      const notes = document.getElementById('vital-input-notes').value;

      this.activeCase.vitals = { consciousness, pulse, bp, rr, spO2, notes };
      this.saveToStorage();

      window.CCNV_UI.Toast.show(
        'ĐÃ CẬP NHẬT SINH HIỆU',
        'Dữ liệu đã truyền thành công tới kíp bác sĩ trên xe 65A-011.15 để chuẩn bị trang thiết bị.'
      );
    }

    // --- CANCELLATION OF EMERGENCY CASE ---
    confirmCancelCase() {
      const cancelSheet = document.getElementById('cancel-bottom-sheet');
      const selectedBtn = cancelSheet.querySelector('.bottom-sheet-reason-btn.selected');
      const reason = selectedBtn ? selectedBtn.textContent.trim() : 'Người dân tự hủy';

      this.activeCase.isActive = false;
      this.activeCase.status = 'CANCELLED';
      this.activeCase.stageLabel = 'Đã hủy yêu cầu';

      if (this.vehicleSimInterval) clearInterval(this.vehicleSimInterval);
      cancelSheet.classList.remove('active');

      this.saveToStorage();
      this.renderAllViews();
      this.switchTab('tab-home');

      window.CCNV_UI.Toast.show(
        'ĐÃ HỦY YÊU CẦU CẤP CỨU',
        `Lý do: ${reason}. Hệ thống đã thu hồi lệnh điều xe và thông báo tới trung tâm.`
      );
    }

    // --- FIRST AID MEDICAL GUIDANCE MODAL ---
    openFirstAidGuide(type) {
      const modal = document.getElementById('modal-first-aid-guide');
      const body = document.getElementById('first-aid-modal-content');
      if (!modal || !body) return;

      let title = 'HƯỚNG DẪN SƠ CỨU 115';
      let html = '';

      if (type === 'cpr') {
        title = 'ÉP TIM NGOÀI LỒNG NGỰC (CPR)';
        html = `
          <div class="cpr-visual-pulse">
            <svg class="cpr-heart-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <div>
              <strong style="color:#FFFFFF;font-size:12.5px;">NHỊP ĐẾM CHUẨN: 100 - 120 NHỊP / PHÚT</strong>
              <div style="font-size:11px;color:#CBD5E1;">Ép theo nhịp tim nhấp nháy bên cạnh</div>
            </div>
          </div>
          <ol style="font-size:12.5px;color:#CBD5E1;line-height:1.6;margin-top:12px;padding-left:18px;">
            <li><strong>Vị trí đặt tay:</strong> Đặt gót bàn tay vào chính giữa 1/2 dưới xương ức nạn nhân. Bàn tay kia đan lên trên.</li>
            <li><strong>Tư thế người ép:</strong> Quỳ vuông góc bên cạnh ngực nạn nhân, hai cánh tay thẳng tuyệt đối.</li>
            <li><strong>Kỹ thuật ép:</strong> Ép sâu ít nhất 5 cm - không quá 6 cm. Để ngực nở hoàn toàn sau mỗi lần ép.</li>
            <li><strong>Tần số:</strong> 30 lần ép tim kết hợp 2 lần thổi ngạt (hoặc ép tim liên tục không ngừng nếu không quen thổi ngạt).</li>
          </ol>
        `;
      } else if (type === 'stroke') {
        title = 'XỬ TRÍ ĐỘT QUỴ NÃO CẤP (FAST)';
        html = `
          <div style="background:#0E2435;border:1px solid #1E3A5F;border-radius:8px;padding:12px;margin-bottom:12px;">
            <strong style="color:#38BDF8;font-size:13px;">QUY TẮC NHẬN BIẾT NHANH FAST:</strong>
            <ul style="font-size:12px;color:#CBD5E1;line-height:1.6;margin:6px 0 0 0;padding-left:16px;">
              <li><strong>F (Face - Mặt):</strong> Mặt bị méo một bên, cười lệch miệng.</li>
              <li><strong>A (Arm - Tay):</strong> Yêu cầu giơ 2 tay lên, một bên tay yếu rũ xuống.</li>
              <li><strong>S (Speech - Lời nói):</strong> Nói ngọng, không nói được hoặc nói vô nghĩa.</li>
              <li><strong>T (Time - Thời gian vàng):</strong> Cần đưa đến BV có Can thiệp mạch trước 4.5 giờ!</li>
            </ul>
          </div>
          <div style="font-size:12px;color:#EF4444;font-weight:700;">⚠️ TUYỆT ĐỐI KHÔNG:</div>
          <div style="font-size:12px;color:#CBD5E1;margin-top:4px;">
            Không chích máu đầu ngón tay/dái tai; Không cạo gió; Không cho uống thuốc hạ huyết áp hay ngậm An Cung Trúc Hoàn.
          </div>
        `;
      } else if (type === 'bleeding') {
        title = 'CẦM MÁU VẾT THƯƠNG NGOÀI KHẨN CẤP';
        html = `
          <ol style="font-size:12.5px;color:#CBD5E1;line-height:1.6;padding-left:18px;">
            <li><strong>Băng ép trực tiếp:</strong> Dùng gạc hoặc vải sạch ấn mạnh trực tiếp lên miệng vết thương đang chảy máu.</li>
            <li><strong>Băng chèn vô trùng:</strong> Dùng cuộn băng quấn chặt giữ gạc ép, không được tháo gạc ra nếu máu thấm qua mà chèn thêm gạc mới.</li>
            <li><strong>Nâng cao chi:</strong> Nếu là vết thương tay/chân, nâng cao chi bị tổn thương hơn mức tim nạn nhân.</li>
            <li><strong>Garo khẩn cấp:</strong> CHỈ garo khi đứt lìa chi hoặc chảy máu phun thành tia dữ dội không cầm được bằng băng ép. Ghi lại giờ garo chính xác.</li>
          </ol>
        `;
      }

      document.getElementById('first-aid-modal-title').textContent = title;
      body.innerHTML = html;
      modal.classList.add('active');

      const btnClose = document.getElementById('btn-close-first-aid');
      if (btnClose) btnClose.onclick = () => modal.classList.remove('active');
    }

    // --- HEALTHCARE FACILITIES DIRECTORY & GIS SEARCH MAP (ND-06) ---
    getFilteredHospitals(searchQuery = '', filterCategory = 'ALL') {
      let list = this.hospitals;

      // Filter by category
      if (filterCategory && filterCategory !== 'ALL') {
        list = list.filter(h => {
          if (filterCategory === 'PEDIATRIC') return h.id === 'HOSP_BVND' || (h.specialties && h.specialties.some(s => s.toLowerCase().includes('nhi')));
          if (filterCategory === 'STROKE') return (h.specialties && h.specialties.some(s => s.toLowerCase().includes('đột quỵ') || s.toLowerCase().includes('mạch')));
          if (filterCategory === 'EMERGENCY') return (h.specialties && h.specialties.some(s => s.toLowerCase().includes('cấp cứu')));
          return true;
        });
      }

      // Filter by search query
      if (searchQuery && searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(h => 
          (h.name && h.name.toLowerCase().includes(q)) || 
          (h.code && h.code.toLowerCase().includes(q)) ||
          (h.address && h.address.toLowerCase().includes(q)) || 
          (h.specialties && h.specialties.some(s => s.toLowerCase().includes(q)))
        );
      }

      return list;
    }

    renderHospitalsList(searchQuery = '', filterCategory = 'ALL') {
      this.hospSearchQuery = searchQuery;
      this.hospFilterCategory = filterCategory;

      const listContainer = document.getElementById('hospitals-card-list');
      const countBadge = document.getElementById('hosp-count-badge');
      const searchInfo = document.getElementById('map-hosp-search-info');

      const list = this.getFilteredHospitals(searchQuery, filterCategory);

      // Update counters
      if (countBadge) {
        countBadge.textContent = list.length > 0 ? `${list.length} Cơ sở sẵn sàng` : '0 Cơ sở';
        countBadge.className = list.length > 0 ? 'badge badge-ready' : 'badge badge-restricted';
      }

      if (searchInfo) {
        if (searchQuery && searchQuery.trim() !== '') {
          searchInfo.textContent = `Tìm thấy ${list.length}/${this.hospitals.length} cơ sở`;
        } else if (filterCategory !== 'ALL') {
          searchInfo.textContent = `Lọc: ${list.length}/${this.hospitals.length} cơ sở`;
        } else {
          searchInfo.textContent = `Hiển thị ${list.length}/${this.hospitals.length} cơ sở`;
        }
      }

      // Sync Realtime Map Markers
      if (this.mapHospitals) {
        this.updateHospitalMapMarkers(list);
      } else {
        setTimeout(() => this.initOrRefreshHospitalMap(), 100);
      }

      if (!listContainer) return;

      if (list.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align:center;padding:32px 16px;background:#0A1B2A;border:1px solid #1E3A56;border-radius:10px;color:#94A3B8;">
            <div style="font-size:24px;margin-bottom:8px;">🔍</div>
            <strong style="color:#FFFFFF;font-size:14px;display:block;">Không tìm thấy cơ sở y tế</strong>
            <p style="font-size:12px;margin-top:4px;">Không có bệnh viện nào phù hợp với từ khóa "${searchQuery}". Vui lòng thử từ khóa khác hoặc bấm nút "Tất cả".</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = list.map((h, i) => `
        <div class="hospital-card" data-hosp-id="${h.id}">
          <div class="hospital-card-header">
            <div>
              <strong style="color:#FFFFFF;font-size:14px;display:block;">${h.name}</strong>
              <div style="font-size:11.5px;color:#94A3B8;margin-top:2px;">${h.address}</div>
            </div>
            <span class="hospital-badge-status ${h.status === 'AVAILABLE' ? 'available' : 'restricted'}">
              ${h.statusText || 'Đang nhận'}
            </span>
          </div>

          <div style="font-size:11.5px;color:#CBD5E1;margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
            ${(h.specialties || []).slice(0, 3).map(s => `
              <span style="background:#081827;border:1px solid #1E3A56;border-radius:4px;padding:2px 6px;color:#38BDF8;font-size:10.5px;">${s}</span>
            `).join('')}
          </div>

          <div style="display:flex;align-items:center;justify-content:flex-end;margin-top:10px;font-size:11.5px;">
            <span style="color:#94A3B8;font-family:var(--font-mono);">
              Khoảng cách: ${(1.2 + i * 0.7).toFixed(1)} km
            </span>
          </div>

          <div class="hospital-action-row">
            <button class="btn btn-default btn-xs btn-focus-hosp-map" data-hosp-id="${h.id}" style="flex:1;padding:8px;color:#38BDF8;border:1px solid #29465A;display:flex;align-items:center;justify-content:center;gap:4px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/></svg>
              <span>Đường đi</span>
            </button>
            <a href="tel:${h.hotline || '115'}" class="btn btn-default btn-xs" style="flex:1;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:4px;padding:8px;color:#FFFFFF;border:1px solid #29465A;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>Hotline 115</span>
            </a>
          </div>
        </div>
      `).join('');

      listContainer.querySelectorAll('.btn-focus-hosp-map').forEach(b => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const hospId = b.getAttribute('data-hosp-id');
          this.focusHospitalOnMap(hospId);
        });
      });
    }

    initOrRefreshHospitalMap() {
      const container = document.getElementById('hospitals-leaflet-map');
      if (!container || !window.L) return;

      const userCoords = [10.0298, 105.7702]; // Đại học Cần Thơ, Cổng A 3/2

      if (!this.mapHospitals) {
        this.mapHospitals = L.map('hospitals-leaflet-map', {
          zoomControl: false,
          attributionControl: false
        }).setView(userCoords, 13);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri, DeLorme, NAVTEQ',
          maxNativeZoom: 16,
          maxZoom: 18
        }).addTo(this.mapHospitals);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          attribution: '',
          maxNativeZoom: 16,
          maxZoom: 18
        }).addTo(this.mapHospitals);

        this.hospitalMarkersLayer = L.layerGroup().addTo(this.mapHospitals);
      } else {
        this.mapHospitals.invalidateSize();
      }

      const currentList = this.getFilteredHospitals(this.hospSearchQuery, this.hospFilterCategory);
      this.updateHospitalMapMarkers(currentList);
    }

    updateHospitalMapMarkers(filteredHospitals) {
      if (!this.mapHospitals || !this.hospitalMarkersLayer) return;

      this.hospitalMarkersLayer.clearLayers();
      this.hospMarkersById = {};

      const userCoords = [10.0298, 105.7702]; // Đại học Cần Thơ

      // Citizen Marker (Red Pulse)
      const citizenIcon = L.divIcon({
        className: 'citizen-gis-marker',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#EF4444;border:2.5px solid #FFFFFF;box-shadow:0 0 14px #EF4444;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      L.marker(userCoords, { icon: citizenIcon })
        .addTo(this.hospitalMarkersLayer)
        .bindPopup('<b>VỊ TRÍ CỦA BẠN</b><br>Đại học Cần Thơ (Cổng A 3/2)');

      const validPoints = [userCoords];

      filteredHospitals.forEach(h => {
        if (!h.coords) return;
        validPoints.push(h.coords);

        const shortName = h.code || h.name.replace('Bệnh viện ', 'BV ').replace('BV Đa khoa ', 'BVĐK ').split(' ')[0];
        const hospIcon = L.divIcon({
          className: 'hosp-map-pin',
          html: `<div style="background:#0A1B2A;border:2px solid #38BDF8;border-radius:6px;padding:3px 8px;color:#FFFFFF;font-size:10.5px;font-weight:700;box-shadow:0 0 10px rgba(56,189,248,0.5);display:flex;align-items:center;gap:4px;white-space:nowrap;cursor:pointer;"><span style="color:#38BDF8;">🏥</span> <span>${shortName}</span></div>`,
          iconSize: [84, 26],
          iconAnchor: [42, 13]
        });

        const marker = L.marker(h.coords, { icon: hospIcon })
          .addTo(this.hospitalMarkersLayer)
          .bindPopup(`
            <div style="font-size:12px;color:#FFFFFF;min-width:210px;">
              <strong style="color:#38BDF8;font-size:13px;display:block;margin-bottom:2px;">${h.name}</strong>
              <div style="font-size:11px;color:#CBD5E1;margin-bottom:8px;">${h.address}</div>
              <div style="display:flex;gap:6px;">
                <a href="tel:${h.hotline || '115'}" style="flex:1;background:#E52521;color:#FFFFFF;text-decoration:none;padding:6px;border-radius:5px;font-weight:700;font-size:11px;text-align:center;display:flex;align-items:center;justify-content:center;gap:4px;">
                  Gọi 115
                </a>
                <button type="button" class="btn-popup-draw-route" data-hosp-id="${h.id}" style="flex:1;background:#1E3A5F;color:#38BDF8;border:1px solid #38BDF8;border-radius:5px;font-weight:600;font-size:11px;padding:6px;cursor:pointer;">
                  Đường đi
                </button>
              </div>
            </div>
          `);

        marker.on('popupopen', () => {
          const btn = document.querySelector('.btn-popup-draw-route[data-hosp-id="' + h.id + '"]');
          if (btn) {
            btn.onclick = () => this.focusHospitalOnMap(h.id);
          }
        });

        this.hospMarkersById[h.id] = marker;
      });

      // Fit map bounds to show all search results
      if (filteredHospitals.length === 1 && filteredHospitals[0].coords) {
        this.mapHospitals.setView(filteredHospitals[0].coords, 15);
        setTimeout(() => {
          if (this.hospMarkersById[filteredHospitals[0].id]) {
            this.hospMarkersById[filteredHospitals[0].id].openPopup();
          }
        }, 150);
      } else if (validPoints.length > 1) {
        this.mapHospitals.fitBounds(validPoints, { padding: [30, 30], maxZoom: 15 });
      } else {
        this.mapHospitals.setView(userCoords, 13);
      }
    }

    focusHospitalOnMap(hospId) {
      const h = this.hospitals.find(item => item.id === hospId);
      if (!h || !h.coords || !this.mapHospitals) return;

      const userCoords = [10.0298, 105.7702]; // Đại học Cần Thơ

      // Draw or update route polyline from citizen location to hospital
      if (this.hospRouteLayer) {
        this.mapHospitals.removeLayer(this.hospRouteLayer);
        this.hospRouteLayer = null;
      }

      // Generate intermediate waypoints for a realistic city road path
      const midLat = (userCoords[0] + h.coords[0]) / 2 + (Math.random() * 0.002 - 0.001);
      const midLng = (userCoords[1] + h.coords[1]) / 2 + (Math.random() * 0.002 - 0.001);
      const routePoints = [userCoords, [midLat, midLng], h.coords];

      this.hospRouteLayer = L.layerGroup([
        L.polyline(routePoints, {
          color: '#38BDF8',
          weight: 6,
          opacity: 0.85,
          dashArray: '8, 8',
          lineJoin: 'round'
        }),
        L.polyline(routePoints, {
          color: '#0284C7',
          weight: 10,
          opacity: 0.35,
          lineCap: 'round'
        })
      ]).addTo(this.mapHospitals);

      // Fit bounds to show entire route from user to hospital
      this.mapHospitals.fitBounds([userCoords, h.coords], { padding: [40, 40], maxZoom: 16 });

      setTimeout(() => {
        if (this.hospMarkersById[hospId]) {
          this.hospMarkersById[hospId].openPopup();
        }
      }, 350);

      const mapEl = document.getElementById('hospitals-leaflet-map');
      if (mapEl) {
        mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // --- HOME SCREEN LEAFLET MAP OF NEAREST HEALTHCARE FACILITIES ---
    initOrRefreshHomeFacilitiesMap() {
      const container = document.getElementById('home-facilities-map');
      if (!container || !window.L) return;

      const userCoords = [10.0298, 105.7702]; // Đại học Cần Thơ, Cổng A 3/2

      if (!this.mapHomeFacilities) {
        this.mapHomeFacilities = L.map('home-facilities-map', {
          zoomControl: false,
          attributionControl: false
        }).setView(userCoords, 14);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri, DeLorme, NAVTEQ',
          maxNativeZoom: 16,
          maxZoom: 18
        }).addTo(this.mapHomeFacilities);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          attribution: '',
          maxNativeZoom: 16,
          maxZoom: 18
        }).addTo(this.mapHomeFacilities);

        // Citizen Marker (Red Pulse)
        const citizenIcon = L.divIcon({
          className: 'citizen-gis-marker',
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#EF4444;border:2.5px solid #FFFFFF;box-shadow:0 0 14px #EF4444;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        L.marker(userCoords, { icon: citizenIcon })
          .addTo(this.mapHomeFacilities)
          .bindPopup('<b>VỊ TRÍ CỦA BẠN</b><br>Đại học Cần Thơ (Cổng A 3/2)');

        // Hospital markers
        const facilities = (this.hospitals && this.hospitals.length > 0) ? this.hospitals : [
          { name: 'BV Đa khoa TP Cần Thơ', code: 'BVĐK', address: 'Số 04 Châu Văn Liêm, Q. Ninh Kiều', coords: [10.0332, 105.7865], availableBeds: 14, hotline: '0292.382.1234' },
          { name: 'BV Đa khoa TW Cần Thơ', code: 'TWCT', address: 'Số 315 Nguyễn Văn Linh, Q. Ninh Kiều', coords: [10.0092, 105.7533], availableBeds: 20, hotline: '0292.389.9440' },
          { name: 'BV Tim Mạch Cần Thơ', code: 'TIM', address: 'Số 204 Trần Hưng Đạo, Q. Ninh Kiều', coords: [10.0381, 105.7794], availableBeds: 8, hotline: '0292.383.1115' },
          { name: 'BV Quân Y 121', code: 'QY121', address: 'Số 01 đường 30/4, Q. Ninh Kiều', coords: [10.0360, 105.7720], availableBeds: 12, hotline: '0292.382.0121' },
          { name: 'BV Nhi Đồng Cần Thơ', code: 'NHI', address: 'Nguyễn Văn Cừ nối dài, Q. Ninh Kiều', coords: [10.0315, 105.7480], availableBeds: 16, hotline: '0292.374.8355' }
        ];

        facilities.forEach(h => {
          if (!h.coords) return;
          const shortName = (h.code || h.name.replace('BV ', '').split(' ')[0] || 'BV');
          const hospIcon = L.divIcon({
            className: 'home-hosp-pin',
            html: `<div style="background:#0E2435;border:2px solid #38BDF8;border-radius:6px;padding:2px 6px;color:#FFFFFF;font-size:10px;font-weight:700;display:flex;align-items:center;gap:3px;box-shadow:0 0 8px rgba(56,189,248,0.5);"><span style="color:#38BDF8;">🏥</span> <span>${shortName}</span></div>`,
            iconSize: [64, 22],
            iconAnchor: [32, 11]
          });

          L.marker(h.coords, { icon: hospIcon })
            .addTo(this.mapHomeFacilities)
            .bindPopup(`
              <div style="font-size:12px;color:#FFFFFF;min-width:180px;">
                <strong style="color:#38BDF8;">${h.name}</strong><br>
                <span style="color:#94A3B8;font-size:11px;">${h.address}</span><br>
                <div style="margin:4px 0;color:#34D399;font-weight:600;font-size:11px;">
                  Sẵn sàng ${h.availableBeds || 12} giường cấp cứu
                </div>
                <div style="display:flex;gap:6px;margin-top:6px;">
                  <a href="tel:${h.hotline || '115'}" class="btn btn-emergency btn-xs" style="text-decoration:none;padding:3px 8px;font-size:10.5px;color:#fff;">Gọi ngay</a>
                  <a href="https://www.google.com/maps/dir/?api=1&destination=${h.coords[0]},${h.coords[1]}" target="_blank" class="btn btn-default btn-xs" style="text-decoration:none;padding:3px 8px;font-size:10.5px;color:#cbd5e1;">Chỉ đường</a>
                </div>
              </div>
            `);
        });
      } else {
        this.mapHomeFacilities.invalidateSize();
      }
    }

    renderHomeNearestHospitals() {
      const container = document.getElementById('home-nearest-hospitals-list');
      if (!container) return;

      const facilities = [
        { name: 'BV Đa khoa TP Cần Thơ', distance: '1.2 km', beds: 14, hotline: '0292.382.1234', coords: [10.0332, 105.7865] },
        { name: 'BV Tim Mạch Cần Thơ', distance: '1.5 km', beds: 8, hotline: '0292.383.1115', coords: [10.0381, 105.7794] },
        { name: 'BV Quân Y 121', distance: '1.8 km', beds: 12, hotline: '0292.382.0121', coords: [10.0360, 105.7720] },
        { name: 'BV Đa khoa TW Cần Thơ', distance: '2.6 km', beds: 20, hotline: '0292.389.9440', coords: [10.0092, 105.7533] }
      ];

      container.innerHTML = facilities.map(f => `
        <div class="home-nearest-card">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;">
              <strong style="color:#FFFFFF;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</strong>
              <span class="badge badge-ready" style="font-size:9.5px;padding:2px 5px;white-space:nowrap;">~${f.distance}</span>
            </div>
            <div style="font-size:11px;color:#34D399;margin-top:2px;">
              ${f.beds} giường cấp cứu sẵn sàng tiếp nhận
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <a href="tel:${f.hotline}" class="btn btn-default btn-xs" style="padding:6px 10px;text-decoration:none;color:#FFFFFF;border:1px solid #29465A;display:flex;align-items:center;gap:4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>Gọi</span>
            </a>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${f.coords[0]},${f.coords[1]}" target="_blank" class="btn btn-primary btn-xs" style="padding:6px 8px;text-decoration:none;background:#1E3A5F;border-color:#38BDF8;color:#FFFFFF;">
              Đường đi
            </a>
          </div>
        </div>
      `).join('');
    }

    // --- PERSONAL PROFILE & SUB-TABS (ND-07, ND-08, ND-09, ND-10) ---
    saveMedicalProfileForm() {
      this.medicalProfile.bloodType = document.getElementById('profile-input-blood').value;
      this.medicalProfile.allergies = document.getElementById('profile-input-allergies').value;
      this.medicalProfile.chronicDiseases = document.getElementById('profile-input-diseases').value;
      this.medicalProfile.medications = document.getElementById('profile-input-medications').value;
      this.medicalProfile.bhytCode = document.getElementById('profile-input-bhyt').value;
      this.medicalProfile.specialNotes = document.getElementById('profile-input-notes').value;

      this.saveToStorage();
      window.CCNV_UI.Toast.show(
        'ĐÃ LƯU THÔNG TIN Y TẾ KHẨN CẤP',
        'Dữ liệu hồ sơ y tế khẩn cấp đã được cập nhật an toàn và sẵn sàng chia sẻ khi bấm SOS.'
      );
    }

    renderEmergencyContactsList() {
      const container = document.getElementById('emergency-contacts-list');
      if (!container) return;

      container.innerHTML = this.contacts.map((c, idx) => `
        <div class="contact-item-card">
          <div>
            <div style="display:flex;align-items:center;gap:6px;">
              <strong style="color:#FFFFFF;font-size:13.5px;">${c.name}</strong>
              <span class="badge ${c.isPrimary ? 'badge-emergency' : 'badge-default'}" style="font-size:9.5px;padding:2px 6px;">
                ${c.relation} ${c.isPrimary ? '· Chính' : ''}
              </span>
            </div>
            <div style="font-size:12px;color:#94A3B8;margin-top:3px;font-family:var(--font-mono);">${c.phone}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <a href="tel:${c.phone}" class="btn btn-default btn-xs" style="padding:6px 10px;text-decoration:none;color:#FFFFFF;border:1px solid #29465A;">
              Gọi
            </a>
            <button class="btn btn-default btn-xs btn-delete-contact" data-idx="${idx}" style="padding:6px 10px;color:#EF4444;border:1px solid #29465A;">
              ✕
            </button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-delete-contact').forEach(b => {
        b.addEventListener('click', () => {
          const idx = parseInt(b.getAttribute('data-idx'), 10);
          this.contacts.splice(idx, 1);
          this.saveToStorage();
          this.renderEmergencyContactsList();
        });
      });
    }

    openAddContactModal() {
      const modal = document.getElementById('modal-add-contact');
      if (!modal) return;
      modal.classList.add('active');

      const btnClose = document.getElementById('btn-close-contact-modal');
      const form = document.getElementById('form-add-contact-inner');

      if (btnClose) btnClose.onclick = () => modal.classList.remove('active');

      if (form) {
        form.onsubmit = (e) => {
          e.preventDefault();
          const name = document.getElementById('new-contact-name').value.trim();
          const relation = document.getElementById('new-contact-relation').value.trim();
          const phone = document.getElementById('new-contact-phone').value.trim();

          if (name && phone) {
            this.contacts.push({
              id: 'cnt-' + Date.now(),
              name,
              relation,
              phone,
              isPrimary: this.contacts.length === 0,
              autoSms: true
            });
            this.saveToStorage();
            this.renderEmergencyContactsList();
            modal.classList.remove('active');
            window.CCNV_UI.Toast.show('ĐÃ THÊM NGƯỜI LIÊN HỆ', `${name} (${relation}) đã được lưu.`);
          }
        };
      }
    }

    savePrivacySettingsFromUI() {
      this.privacy.shareLiveGps = document.getElementById('toggle-privacy-gps').checked;
      this.privacy.shareMedicalProfile = document.getElementById('toggle-privacy-medical').checked;
      this.privacy.notifyEmergencyContacts = document.getElementById('toggle-privacy-contacts').checked;
      this.privacy.shareHospitalAdvance = document.getElementById('toggle-privacy-hospital').checked;
      this.privacy.recordCallAudio = document.getElementById('toggle-privacy-audio').checked;

      this.saveToStorage();
      window.CCNV_UI.Toast.show('ĐÃ CẬP NHẬT QUYỀN RIÊNG TƯ', 'Cài đặt tuân thủ Nghị định 13/2023/NĐ-CP đã được lưu.');
    }

    revokeAllPrivacyConsents() {
      if (confirm('Bạn có chắc chắn muốn thu hồi toàn bộ quyền chia sẻ dữ liệu y tế và định vị GPS?')) {
        this.privacy.shareLiveGps = false;
        this.privacy.shareMedicalProfile = false;
        this.privacy.notifyEmergencyContacts = false;
        this.privacy.shareHospitalAdvance = false;
        this.privacy.recordCallAudio = false;

        document.getElementById('toggle-privacy-gps').checked = false;
        document.getElementById('toggle-privacy-medical').checked = false;
        document.getElementById('toggle-privacy-contacts').checked = false;
        document.getElementById('toggle-privacy-hospital').checked = false;
        document.getElementById('toggle-privacy-audio').checked = false;

        this.saveToStorage();
        window.CCNV_UI.Toast.show(
          'ĐÃ THU HỒI TOÀN BỘ QUYỀN CHIA SẺ',
          'Dữ liệu y tế và GPS của bạn sẽ không tự động gửi đi cho đến khi bạn cấp quyền trở lại.'
        );
      }
    }

    renderHistoryCasesList() {
      const container = document.getElementById('history-cases-list');
      if (!container) return;

      container.innerHTML = this.historyCases.map(c => `
        <div class="history-item-card" data-case-id="${c.id}">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-family:var(--font-mono);font-size:12px;color:#38BDF8;font-weight:700;">#${c.id}</span>
            <span class="badge badge-${c.statusClass}" style="font-size:10px;">${c.status}</span>
          </div>
          <div style="font-size:13.5px;font-weight:700;color:#FFFFFF;margin-top:4px;">${c.incident}</div>
          <div style="font-size:11.5px;color:#94A3B8;margin-top:4px;">${c.date} · ${c.address}</div>
          <div style="font-size:11.5px;color:#CBD5E1;margin-top:6px;line-height:1.4;border-top:1px dashed #183449;padding-top:6px;">
            ${c.summary}
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.history-item-card').forEach(card => {
        card.addEventListener('click', () => {
          const caseId = card.getAttribute('data-case-id');
          this.openHistoryCaseDetailModal(caseId);
        });
      });
    }

    openHistoryCaseDetailModal(caseId) {
      const caseItem = this.historyCases.find(c => c.id === caseId);
      if (!caseItem) return;

      const modal = document.getElementById('modal-history-detail');
      const body = document.getElementById('history-detail-modal-body');
      if (!modal || !body) return;

      body.innerHTML = `
        <div style="padding-bottom:12px;border-bottom:1px solid #1E3A56;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-family:var(--font-mono);font-size:13px;color:#38BDF8;font-weight:700;">HỒ SƠ CA #${caseItem.id}</span>
            <span class="badge badge-${caseItem.statusClass}">${caseItem.status}</span>
          </div>
          <h3 style="color:#FFFFFF;font-size:16px;margin:6px 0 2px 0;">${caseItem.incident}</h3>
          <span style="font-size:11.5px;color:#94A3B8;">Thời gian gọi: ${caseItem.date}</span>
        </div>

        <div style="font-size:12.5px;color:#CBD5E1;display:flex;flex-direction:column;gap:8px;">
          <div><strong style="color:#94A3B8;">Hiện trường:</strong> ${caseItem.address}</div>
          <div><strong style="color:#94A3B8;">Phương tiện:</strong> Xe cấp cứu ${caseItem.vehicle}</div>
          <div><strong style="color:#94A3B8;">BV tiếp nhận:</strong> ${caseItem.hospital}</div>
          <div style="background:#081827;border:1px solid #183449;border-radius:6px;padding:10px;margin-top:4px;">
            <strong style="color:#38BDF8;display:block;margin-bottom:4px;">Biên bản xử trí y tế:</strong>
            ${caseItem.summary}
          </div>
        </div>
      `;

      modal.classList.add('active');
      const btnClose = document.getElementById('btn-close-history-modal');
      if (btnClose) btnClose.onclick = () => modal.classList.remove('active');
    }

    // --- RENDER ALL VIEWS SYNC ---
    renderAllViews() {
      // Header user phone & name
      const userPhoneEl = document.getElementById('header-user-phone');
      if (userPhoneEl) userPhoneEl.textContent = this.auth.phone;

      // Active Emergency Case vs Idle Facilities View on Home Screen
      const activeCaseView = document.getElementById('home-active-case-view');
      const idleView = document.getElementById('home-idle-view');
      const banner = document.getElementById('citizen-active-banner');
      const navBadge = document.getElementById('nav-emergency-badge');

      if (this.activeCase.isActive && this.activeCase.status !== 'CANCELLED') {
        if (activeCaseView) activeCaseView.style.display = 'block';
        if (idleView) idleView.style.display = 'none';
        if (banner) banner.style.display = 'flex';
        if (navBadge) navBadge.classList.add('active');
        if (this.currentTab === 'tab-home') {
          setTimeout(() => this.initOrRefreshTrackingMap(), 120);
        }
      } else {
        if (activeCaseView) activeCaseView.style.display = 'none';
        if (idleView) idleView.style.display = 'block';
        if (banner) banner.style.display = 'none';
        if (navBadge) navBadge.classList.remove('active');
        if (this.currentTab === 'tab-home') {
          setTimeout(() => this.initOrRefreshHomeFacilitiesMap(), 120);
        }
        this.renderHomeNearestHospitals();
      }

      this.updateTrackingStatsUI();
      this.renderChatMessages();
      this.renderHospitalsList();
      this.renderEmergencyContactsList();
      this.renderHistoryCasesList();

      // Populate Medical Info fields
      const pBlood = document.getElementById('profile-input-blood');
      const pAllergies = document.getElementById('profile-input-allergies');
      const pDiseases = document.getElementById('profile-input-diseases');
      const pMeds = document.getElementById('profile-input-medications');
      const pBhyt = document.getElementById('profile-input-bhyt');
      const pNotes = document.getElementById('profile-input-notes');

      if (pBlood) pBlood.value = this.medicalProfile.bloodType || 'O+';
      if (pAllergies) pAllergies.value = this.medicalProfile.allergies || '';
      if (pDiseases) pDiseases.value = this.medicalProfile.chronicDiseases || '';
      if (pMeds) pMeds.value = this.medicalProfile.medications || '';
      if (pBhyt) pBhyt.value = this.medicalProfile.bhytCode || '';
      if (pNotes) pNotes.value = this.medicalProfile.specialNotes || '';

      // Populate Privacy Toggles
      const tGps = document.getElementById('toggle-privacy-gps');
      const tMed = document.getElementById('toggle-privacy-medical');
      const tCnt = document.getElementById('toggle-privacy-contacts');
      const tHsp = document.getElementById('toggle-privacy-hospital');
      const tAud = document.getElementById('toggle-privacy-audio');

      if (tGps) tGps.checked = this.privacy.shareLiveGps;
      if (tMed) tMed.checked = this.privacy.shareMedicalProfile;
      if (tCnt) tCnt.checked = this.privacy.notifyEmergencyContacts;
      if (tHsp) tHsp.checked = this.privacy.shareHospitalAdvance;
      if (tAud) tAud.checked = this.privacy.recordCallAudio;
    }

    syncRemoteCase(caseObj) {
      if (caseObj && caseObj.id === this.activeCase.id) {
        this.activeCase.status = caseObj.status || this.activeCase.status;
        this.activeCase.stageLabel = caseObj.stageLabel || this.activeCase.stageLabel;
        this.updateTrackingStatsUI();
      }
    }
  }

  // Instantiate and expose globally
  window.addEventListener('DOMContentLoaded', async () => {
    // If state manager is available, initialize
    if (window.StateManager && window.StateManager.init) {
      try {
        await window.StateManager.init();
      } catch (e) {}
    }

    const app = new CitizenApp();
    window.citizenApp = app;
    await app.init();
  });

})(window);
