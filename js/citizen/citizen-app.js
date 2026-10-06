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
      this.mapTracking = null;
      this.mapHomeFacilities = null;
      this.homeFacilitiesMarkers = {};
      this.homeCitizenMarker = null;
      this.hospSearchQuery = '';
      this.hospSortMode = 'dist_asc';
      this.vehicleMarker = null;
      this.citizenMarker = null;
      this.hospitalMarker = null;
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
        address: 'Số 3/2, P. Xuân Khánh, TP. Cần Thơ',
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

      this.isDispatchPending = false;
      this.dispatchPendingInterval = null;
      this.simRafId = null;
      this.simMission = null;
      this.focusLines = null;
      this.routeVehToSceneBg = null;
      this.routeSceneToHospBg = null;

      // Active Emergency Case State
      this.activeCase = {
        isActive: false, // Mặc định ở màn hình idle (home-idle-view)
        id: 'CC-261002-002',
        code: 'CC-261002-002',
        createdAt: '08:12:15',
        status: 'MOVING',
        stageLabel: 'Xe đang đến',
        etaMinutes: 4,
        distanceKm: 1.6,
        speedKmH: 48,
        patientLocation: {
          name: 'Đại học Cần Thơ - Cổng A đường 3/2, P. Xuân Khánh, TP. Cần Thơ',
          coords: [10.0298, 105.7702]
        },
        vehicle: {
          plate: '65A-012.34',
          type: 'Type B - Cứu thương tiêu chuẩn',
          coords: [10.0150, 105.7760],
          station: 'Trạm Cấp cứu Cái Răng'
        },
        crew: {
          doctor: 'BS. CKI. Nguyễn Văn Thành',
          nurse: 'ĐDV. Lê Hồng Hoa',
          driver: 'TX. Trần Hữu Nghĩa',
          phone: '0903.115.115'
        },
        hospital: {
          id: 'HOSP_BVTU',
          name: 'BV Đa khoa Trung ương Cần Thơ',
          address: '315 Nguyễn Văn Linh, P. An Khánh, Q. Ninh Kiều, TP. Cần Thơ',
          coords: [10.0265, 105.7588]
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
          vehicle: '65A-016.88',
          hospital: 'BV Đa khoa TP Cần Thơ',
          status: 'Hoàn tất',
          statusClass: 'ready',
          address: 'Đường 30/4, P. Hưng Lợi, TP. Cần Thơ',
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
          address: 'Cầu Quang Trung, P. Hưng Phú, TP. Cần Thơ',
          summary: 'Nẹp cố định cẳng tay trái gãy kín, băng ép cầm máu, chuyển khoa Cấp cứu an toàn.'
        },
        {
          id: 'CC-261001-016',
          date: '01/10/2026 17:30',
          incident: 'Chấn thương phần mềm nhẹ',
          vehicle: 'Tự di chuyển',
          hospital: 'TTYT Khu vực Ninh Kiều',
          status: 'Tự di chuyển / Đã hủy xe',
          statusClass: 'maintenance',
          address: 'Đường Nguyễn Văn Cừ, P. An Khánh, TP. Cần Thơ',
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
        // Đảm bảo bắt đầu ở màn mặc định nếu chưa bấm gọi 115 trong phiên hiện tại hoặc ca đã hoàn tất
        if (sessionStorage.getItem('ccnv_citizen_demo_dispatched') !== '1' || this.activeCase.status === 'COMPLETED') {
          this.activeCase.isActive = false;
        }

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
      if (tabId === 'tab-emergency-request' || tabId === 'tab-hospitals') tabId = 'tab-home';
      this.currentTab = tabId;

      document.querySelectorAll('.citizen-tab-panel').forEach(panel => {
        panel.classList.remove('active');
      });
      const targetPanel = document.getElementById(tabId);
      if (targetPanel) targetPanel.classList.add('active');

      document.querySelectorAll('.citizen-nav-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-target') === tabId);
      });

      const activeCaseView = document.getElementById('home-active-case-view');
      const idleView = document.getElementById('home-idle-view');

      // Special Tab-Switching Actions
      const mainContainer = document.getElementById('citizen-main-container');
      if (tabId === 'tab-home') {
        if (this.activeCase.isActive && this.activeCase.status !== 'CANCELLED' && this.activeCase.status !== 'COMPLETED') {
          if (mainContainer) {
            mainContainer.classList.remove('home-idle-mode');
            mainContainer.classList.add('home-active-mode');
          }
          if (activeCaseView) activeCaseView.style.display = 'block';
          if (idleView) idleView.style.display = 'none';
          setTimeout(() => this.initOrRefreshTrackingMap(), 150);
        } else {
          if (mainContainer) {
            mainContainer.classList.remove('home-active-mode');
            mainContainer.classList.add('home-idle-mode');
          }
          if (activeCaseView) activeCaseView.style.display = 'none';
          if (idleView) idleView.style.display = 'block';
          this.renderHomeNearestHospitals();
          setTimeout(() => this.initOrRefreshHomeFacilitiesMap(), 150);
        }
      } else {
        if (mainContainer) {
          mainContainer.classList.remove('home-idle-mode');
          mainContainer.classList.remove('home-active-mode');
        }
      }
    }

    // --- BOTTOM NAVIGATION CONTROLLER (Cố định ở đáy màn hình) ---
    applyNavState() {
      // Thanh điều hướng cố định dưới cùng
    }

    invalidateAllActiveMaps() {
      setTimeout(() => {
        if (this.mapTracking) this.mapTracking.invalidateSize();
        if (this.mapHomeFacilities) this.mapHomeFacilities.invalidateSize();
      }, 100);
      setTimeout(() => {
        if (this.mapTracking) this.mapTracking.invalidateSize();
        if (this.mapHomeFacilities) this.mapHomeFacilities.invalidateSize();
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

      // Home Facilities Map Re-center button
      const btnRecenterHomeMap = document.getElementById('btn-recenter-home-map');
      if (btnRecenterHomeMap) {
        btnRecenterHomeMap.addEventListener('click', () => {
          if (this.mapHomeFacilities) {
            this.mapHomeFacilities.setView([10.0298, 105.7702], 14, { animate: true });
            if (this.homeCitizenMarker) this.homeCitizenMarker.openPopup();
          }
        });
      }

      // Collapsible Panels Toggle Handlers (Cơ sở y tế & Hướng dẫn sơ cứu)
      const btnToggleHosp = document.getElementById('btn-toggle-hospitals');
      const headerToggleHosp = document.getElementById('header-toggle-hospitals');
      const sectionHosp = document.getElementById('section-nearest-hospitals');
      const arrowHosp = document.getElementById('arrow-toggle-hospitals');

      const toggleHospPanel = () => {
        if (!sectionHosp) return;
        const isHidden = sectionHosp.style.display === 'none' || !sectionHosp.style.display;
        sectionHosp.style.display = isHidden ? 'block' : 'none';
        if (btnToggleHosp) btnToggleHosp.classList.toggle('active', isHidden);
        if (arrowHosp) arrowHosp.textContent = isHidden ? '▲' : '▼';
        if (this.mapHomeFacilities) {
          setTimeout(() => this.mapHomeFacilities.invalidateSize(), 60);
        }
        if (isHidden) {
          sectionHosp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      };

      if (btnToggleHosp) btnToggleHosp.addEventListener('click', toggleHospPanel);
      if (headerToggleHosp) headerToggleHosp.addEventListener('click', toggleHospPanel);

      const btnToggleAid = document.getElementById('btn-toggle-firstaid');
      const headerToggleAid = document.getElementById('header-toggle-firstaid');
      const sectionAid = document.getElementById('section-first-aid');
      const arrowAid = document.getElementById('arrow-toggle-firstaid');

      const toggleAidPanel = () => {
        if (!sectionAid) return;
        const isHidden = sectionAid.style.display === 'none' || !sectionAid.style.display;
        sectionAid.style.display = isHidden ? 'block' : 'none';
        if (btnToggleAid) btnToggleAid.classList.toggle('active', isHidden);
        if (arrowAid) arrowAid.textContent = isHidden ? '▲' : '▼';
        if (this.mapHomeFacilities) {
          setTimeout(() => this.mapHomeFacilities.invalidateSize(), 60);
        }
        if (isHidden) {
          sectionAid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      };

      // Collapsible First Aid in Active Emergency Tracking View
      const btnToggleTrackingAid = document.getElementById('btn-toggle-tracking-firstaid');
      const trackingAidBody = document.getElementById('tracking-firstaid-body');
      const lblTrackingAid = document.getElementById('lbl-tracking-firstaid-status');
      if (btnToggleTrackingAid && trackingAidBody) {
        btnToggleTrackingAid.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isCurrentlyHidden = window.getComputedStyle(trackingAidBody).display === 'none';
          if (isCurrentlyHidden) {
            trackingAidBody.style.display = 'block';
            if (lblTrackingAid) lblTrackingAid.textContent = 'Thu gọn ▲';
            btnToggleTrackingAid.style.borderRadius = '8px 8px 0 0';
            setTimeout(() => {
              trackingAidBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 60);
          } else {
            trackingAidBody.style.display = 'none';
            if (lblTrackingAid) lblTrackingAid.textContent = 'Xem hướng dẫn ▼';
            btnToggleTrackingAid.style.borderRadius = '8px';
          }
          if (this.mapTracking) {
            setTimeout(() => this.mapTracking.invalidateSize(), 100);
          }
        };
      }

      if (btnToggleAid) btnToggleAid.addEventListener('click', toggleAidPanel);
      if (headerToggleAid) headerToggleAid.addEventListener('click', toggleAidPanel);

      // Search & Sort for Healthcare Facilities Map & List
      const inputHospSearch = document.getElementById('input-hosp-search');
      if (inputHospSearch) {
        inputHospSearch.addEventListener('input', (e) => {
          this.hospSearchQuery = e.target.value.trim().toLowerCase();
          if (this.hospSearchQuery && sectionHosp && sectionHosp.style.display === 'none') {
            toggleHospPanel();
          }
          this.renderHomeNearestHospitals();
          this.filterHomeFacilitiesMap();
        });
      }

      const selectHospSort = document.getElementById('select-hosp-sort');
      if (selectHospSort) {
        selectHospSort.addEventListener('change', (e) => {
          this.hospSortMode = e.target.value;
          this.renderHomeNearestHospitals();
        });
      }

      // Countdown Handlers
      const btnCancelCountdown = document.getElementById('btn-cancel-sos-countdown');
      if (btnCancelCountdown) {
        btnCancelCountdown.addEventListener('click', () => this.cancelCountdown());
      }



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

      // First Aid Tracking Collapse / Expand Toggle handled in lines 461-475

      // Tracking Map Controls: Zoom In, Zoom Out, Recenter, Fullscreen
      const btnTrackZoomIn = document.getElementById('btn-tracking-zoom-in');
      const btnTrackZoomOut = document.getElementById('btn-tracking-zoom-out');
      const btnTrackRecenter = document.getElementById('btn-tracking-recenter');
      const btnTrackFullscreen = document.getElementById('btn-tracking-fullscreen');
      const trackingMapContainer = document.getElementById('citizen-tracking-map');

      if (btnTrackZoomIn) {
        btnTrackZoomIn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.mapTracking) this.mapTracking.zoomIn();
        });
      }

      if (btnTrackZoomOut) {
        btnTrackZoomOut.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.mapTracking) this.mapTracking.zoomOut();
        });
      }

      if (btnTrackRecenter) {
        btnTrackRecenter.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.mapTracking) {
            const sceneCoords = this.activeCase.patientLocation.coords || [10.0298, 105.7702];
            const originCoords = [10.0105, 105.7700];
            const hospCoords = [10.0265, 105.7588];
            const vehCoords = (this.simMission?.pos?.latlng)
              ? [this.simMission.pos.latlng.lat, this.simMission.pos.latlng.lng]
              : originCoords;
            try {
              this.mapTracking.fitBounds([vehCoords, sceneCoords, hospCoords], {
                padding: [30, 30],
                maxZoom: 16
              });
            } catch (err) {
              this.mapTracking.setView(vehCoords, 14);
            }
          }
        });
      }

      if (btnTrackFullscreen && trackingMapContainer) {
        btnTrackFullscreen.addEventListener('click', (e) => {
          e.stopPropagation();
          const isFs = trackingMapContainer.classList.toggle('map-fullscreen');
          const icon = document.getElementById('icon-fullscreen-track');
          if (icon) {
            if (isFs) {
              icon.innerHTML = `
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              `;
              btnTrackFullscreen.title = 'Thu nhỏ bản đồ';
            } else {
              icon.innerHTML = `
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
              `;
              btnTrackFullscreen.title = 'Toàn màn hình bản đồ';
            }
          }
          if (this.mapTracking) {
            setTimeout(() => this.mapTracking.invalidateSize(), 100);
          }
        });
      }

      // First Aid Modal Trigger Cards
      document.querySelectorAll('.first-aid-card').forEach(card => {
        card.addEventListener('click', () => {
          const type = card.getAttribute('data-aid-type');
          this.openFirstAidGuide(type);
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

    // --- SOS CALL TRIGGER FROM HEADER, HERO CENTER & OVERLAY (ND-04) ---
    bindSosTrigger() {
      // 1. Header SOS Call Button (Icon cuộc gọi trên header)
      const headerSosBtn = document.getElementById('header-btn-sos');
      if (headerSosBtn) {
        headerSosBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.start5SecondCountdown();
        });
      }

      // 2. Nút Gọi Cấp cứu 115 Khẩn cấp trên màn hình Trang chủ (Dải đỏ nổi bật)
      const btnHomeSosCall = document.getElementById('btn-home-emergency-sos-call');
      if (btnHomeSosCall) {
        btnHomeSosCall.addEventListener('click', (e) => {
          e.preventDefault();
          this.start5SecondCountdown();
        });
      }

      // 3. Fallback nút SOS cũ (nếu có trong DOM)
      const mainSosBtn = document.getElementById('main-sos-btn');
      const mainSosRing = document.getElementById('main-sos-ring');
      let holdTimer = null;
      let isHoldTriggered = false;

      if (mainSosBtn && mainSosRing) {
        // Click / Touch trigger
        mainSosBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (isHoldTriggered) {
            isHoldTriggered = false;
            return;
          }
          this.start5SecondCountdown();
        });

        // Touch & Hold (1.5s) gesture handlers
        const startHold = () => {
          isHoldTriggered = false;
          mainSosRing.classList.add('holding');
          holdTimer = setTimeout(() => {
            isHoldTriggered = true;
            mainSosRing.classList.remove('holding');
            if (navigator.vibrate) navigator.vibrate(200);
            window.CCNV_UI.SoundFx.playEmergencyTone?.();
            this.triggerEmergencySos('INC_HOLD_SOS', 'Cấp cứu SOS khẩn cấp (Nhấn giữ nút SOS 1.5s)');
          }, 1500);
        };

        const cancelHold = () => {
          if (holdTimer) clearTimeout(holdTimer);
          mainSosRing.classList.remove('holding');
        };

        mainSosBtn.addEventListener('mousedown', startHold);
        mainSosBtn.addEventListener('mouseup', cancelHold);
        mainSosBtn.addEventListener('mouseleave', cancelHold);

        mainSosBtn.addEventListener('touchstart', (e) => {
          startHold();
        }, { passive: true });
        mainSosBtn.addEventListener('touchend', cancelHold);
        mainSosBtn.addEventListener('touchcancel', cancelHold);
      }

      // 3. Quick Call 115 Strip in Hotlines Bar
      const quickCall115 = document.getElementById('home-quick-call-115');
      if (quickCall115) {
        quickCall115.addEventListener('click', () => {
          this.start5SecondCountdown();
        });
      }

      // 4. Nút GỌI NGAY trong overlay đếm ngược 5 giây (Bỏ qua thời gian chờ)
      const btnCallNow = document.getElementById('btn-call-sos-now');
      if (btnCallNow) {
        btnCallNow.addEventListener('click', (e) => {
          e.preventDefault();
          this.triggerEmergencySos('INC_CALL_NOW', 'Cấp cứu SOS khẩn cấp (Người dân bấm Gọi ngay)');
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

    // --- EMERGENCY SOS ACTIVATION WITH 10-SECOND REALISTIC IN-CALL PHONE BAR (ND-05) ---
    triggerEmergencySos(incidentCode, incidentName) {
      if (this.countdownInterval) clearInterval(this.countdownInterval);
      const overlay = document.getElementById('countdown-overlay');
      if (overlay) overlay.style.display = 'none';

      if (this.isDispatchPending) return;

      // 1. Chuyển về màn mặc định (home-idle-view)
      this.activeCase.isActive = false;
      this.isDispatchPending = true;
      this.switchTab('tab-home');
      this.renderAllViews();

      // 2. Hiển thị UI cuộc gọi thoại 115 thông thường tại đỉnh màn hình
      const banner = document.getElementById('citizen-dispatch-pending-banner');
      const callTimerEl = document.getElementById('call-timer-duration');
      const countEl = document.getElementById('pending-dispatch-countdown-val');
      if (banner) banner.style.display = 'block';

      // Format thời gian cuộc gọi dạng mm:ss như điện thoại thông thường
      const formatCallTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      };

      let callElapsedSec = 0;
      const totalDurationSec = 10; // Tăng thời gian hiển thị lên 10s theo yêu cầu
      if (callTimerEl) callTimerEl.textContent = '00:00';
      if (countEl) countEl.textContent = `${totalDurationSec}s`;

      window.CCNV_UI.Toast.show(
        'ĐANG KẾT NỐI TỔNG ĐÀI 115',
        'Cuộc gọi thoại cấp cứu đang diễn ra (10s). Tọa độ GPS hiện trường đã truyền đến kíp trực điều phối...',
        true
      );

      // Xử lý các nút điều khiển cuộc gọi thoại (Loa ngoài, Mic, Gác máy)
      const btnSpeaker = document.getElementById('btn-incall-speaker');
      const lblSpeaker = document.getElementById('lbl-incall-speaker');
      const btnMute = document.getElementById('btn-incall-mute');
      const lblMute = document.getElementById('lbl-incall-mute');
      const btnEndCall = document.getElementById('btn-incall-end');

      let isSpeakerOn = true;
      let isMicMuted = false;

      if (btnSpeaker && !btnSpeaker._hasInCallHandler) {
        btnSpeaker._hasInCallHandler = true;
        btnSpeaker.addEventListener('click', (e) => {
          e.stopPropagation();
          isSpeakerOn = !isSpeakerOn;
          btnSpeaker.classList.toggle('active', isSpeakerOn);
          if (lblSpeaker) lblSpeaker.textContent = isSpeakerOn ? 'Loa ngoài: BẬT' : 'Loa ngoài: TẮT';
        });
      }

      if (btnMute && !btnMute._hasInCallHandler) {
        btnMute._hasInCallHandler = true;
        btnMute.addEventListener('click', (e) => {
          e.stopPropagation();
          isMicMuted = !isMicMuted;
          btnMute.classList.toggle('active', isMicMuted);
          if (lblMute) lblMute.textContent = isMicMuted ? 'Micro: TẮT' : 'Micro: BẬT';
        });
      }

      if (btnEndCall && !btnEndCall._hasInCallHandler) {
        btnEndCall._hasInCallHandler = true;
        btnEndCall.addEventListener('click', (e) => {
          e.stopPropagation();
          this.completeEmergencyDispatch(incidentCode, incidentName, true);
        });
      }

      if (this.dispatchPendingInterval) clearInterval(this.dispatchPendingInterval);

      // Đếm giây cuộc gọi thoại (từ 00:01 đến 00:10)
      this.dispatchPendingInterval = setInterval(() => {
        callElapsedSec++;
        if (callTimerEl) callTimerEl.textContent = formatCallTime(callElapsedSec);
        if (countEl) countEl.textContent = `${Math.max(0, totalDurationSec - callElapsedSec)}s`;
        window.CCNV_UI.SoundFx.playBeep?.();

        // Sau đúng 10 giây: Đàm thoại hoàn tất, ĐPV phân công xe và BV tiếp nhận đồng ý
        if (callElapsedSec >= totalDurationSec) {
          this.completeEmergencyDispatch(incidentCode, incidentName, false);
        }
      }, 1000);
    }

    // Hoàn tất cuộc gọi thoại và chuyển mượt sang màn theo dõi xe đang đến
    completeEmergencyDispatch(incidentCode, incidentName, isEarlyEnd = false) {
      if (this.dispatchPendingInterval) {
        clearInterval(this.dispatchPendingInterval);
        this.dispatchPendingInterval = null;
      }
      this.isDispatchPending = false;

      const banner = document.getElementById('citizen-dispatch-pending-banner');
      if (banner) banner.style.display = 'none';

      // Thiết lập ca cấp cứu chính thức
      this.activeCase.isActive = true;
      this.activeCase.status = 'MOVING';
      this.activeCase.stageLabel = 'Xe đang đến';
      this.activeCase.incident.code = incidentCode || 'INC_RESPIRATORY';
      this.activeCase.incident.name = incidentName || 'Cấp cứu khẩn cấp 115';
      this.activeCase.etaMinutes = 4;
      this.activeCase.distanceKm = 1.6;
      this.activeCase.speedKmH = 48;
      this.activeCase.vehicle.plate = '65A-012.34';
      this.activeCase.vehicle.coords = [10.0150, 105.7760];
      this.activeCase.hospital = {
        id: 'HOSP_BVTU',
        name: 'BV Đa khoa Trung ương Cần Thơ',
        address: '315 Nguyễn Văn Linh, P. An Khánh, Q. Ninh Kiều, TP. Cần Thơ',
        coords: [10.0265, 105.7588]
      };

      this.activeCase.messages.push({
        sender: 'dispatcher',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        text: `ĐPV 115 tiếp nhận: "${incidentName || 'Cấp cứu 115'}". Đã điều động xe 65A-012.34 (Kíp 3 - Cái Răng) và BV Đa khoa Trung ương Cần Thơ đã đồng ý tiếp nhận ca!`
      });

      sessionStorage.setItem('ccnv_citizen_demo_dispatched', '1');
      this.saveToStorage();
      this.renderAllViews();

      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
      window.CCNV_UI.SoundFx.playEmergencyTone?.();

      window.CCNV_UI.Toast.show(
        isEarlyEnd ? 'KẾT THÚC ĐÀM THOẠI 115' : 'ĐIỀU ĐỘNG THÀNH CÔNG',
        'ĐPV 115 đã phân công xe 65A-012.34 (ETA ~4P). BV Đa khoa Trung ương Cần Thơ đã sẵn sàng tiếp nhận!',
        true
      );

      this.switchTab('tab-home');
      this.startAmbulanceSimulation();
    }

    // =========================================================================
    // CCNV REALTIME GIS AMBULANCE SIMULATION ENGINE (ĐỒNG BỘ 100% VỚI BẢN ĐỒ TRUNG TÂM)
    // Các thông số: SIM_SPEED_MPS = 55, OSRM routing, co đường theo vị trí xe,
    // dừng đón BN 3s tại hiện trường rồi chuyển tiếp về BVĐK Trung ương Cần Thơ.
    // =========================================================================

    // --- Helpers: Routing & Path Mathematics ---
    async fetchRoadRoute(a, b, fallbackPoints) {
      if (!this._citizenRouteCache) this._citizenRouteCache = new Map();
      const key = `${a.join(',')};${b.join(',')}`;
      if (this._citizenRouteCache.has(key)) return this._citizenRouteCache.get(key);
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const url = `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        const json = await res.json();
        if (json.routes && json.routes[0] && json.routes[0].geometry && json.routes[0].geometry.coordinates) {
          const pts = json.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          const route = [a, ...pts, b];
          this._citizenRouteCache.set(key, route);
          return route;
        }
      } catch (e) {
        console.warn('OSRM routing unavailable, using realistic road network fallback:', e);
      }
      return fallbackPoints || [a, b];
    }

    buildPath(points) {
      const ll = points.map(p => window.L.latLng(p));
      const cum = [0];
      for (let i = 1; i < ll.length; i++) cum.push(cum[i - 1] + ll[i - 1].distanceTo(ll[i]));
      return { ll, cum, total: cum[cum.length - 1] };
    }

    pointAt(path, d) {
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

    // --- REALTIME AMBULANCE SIMULATION (MAP & MOVEMENT - Y NGUYÊN BÊN TRUNG TÂM) ---
    startAmbulanceSimulation() {
      this.stopAmbulanceSimulation();

      const origin = [10.0105, 105.7700]; // Kíp 3 - Trạm Cái Răng (xe 65A-012.34 chuẩn CCNV)
      const scene = this.activeCase.patientLocation.coords || [10.0298, 105.7702];
      const hosp = [10.0265, 105.7588]; // BV Đa khoa Trung ương Cần Thơ

      this.simMission = {
        origin,
        scene,
        hospCoords: hosp,
        phase: 'TO_SCENE',
        dist: 0,
        pauseUntil: 0,
        lastTs: 0,
        lastSpeedUpdate: 0,
        leg1: null,
        leg2: null,
        pos: null
      };

      // Tọa độ bám đường phố thực tế Cần Thơ (Cầu Hưng Lợi -> 30/4 -> Trần Văn Hoài -> 3/2 -> Nguyễn Văn Linh)
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
        [10.0298, 105.7702]  // Đến Cổng A ĐH Cần Thơ (Hiện trường)
      ];

      const FALLBACK_LEG2 = [
        [10.0298, 105.7702], // Cổng A ĐH Cần Thơ
        [10.0290, 105.7682], // Đường 3/2
        [10.0282, 105.7655], // Nút giao 3/2 - Nguyễn Văn Linh
        [10.0275, 105.7625], // Trục đường Nguyễn Văn Linh
        [10.0268, 105.7602], // Đoạn Nguyễn Văn Linh tiếp cận BV
        [10.0265, 105.7588]  // BV Đa khoa Trung ương Cần Thơ
      ];

      Promise.all([
        this.fetchRoadRoute(origin, scene, FALLBACK_LEG1),
        this.fetchRoadRoute(scene, hosp, FALLBACK_LEG2)
      ]).then(([pts1, pts2]) => {
        if (!this.simMission) return;
        this.simMission.leg1 = this.buildPath(pts1);
        this.simMission.leg2 = this.buildPath(pts2);

        if (this.mapTracking) {
          this.setupTrackingMapRoutes();
        }

        // Khởi động vòng lặp requestAnimationFrame mượt mà 60fps
        this.simRafId = requestAnimationFrame((ts) => this.tickSimulation(ts));
      });
    }

    stopAmbulanceSimulation() {
      if (this.simRafId) {
        cancelAnimationFrame(this.simRafId);
        this.simRafId = null;
      }
      if (this.vehicleSimInterval) {
        clearInterval(this.vehicleSimInterval);
        this.vehicleSimInterval = null;
      }
    }

    setupTrackingMapRoutes() {
      if (!this.mapTracking || !this.simMission?.leg1 || !this.simMission?.leg2) return;
      const m = this.simMission;
      const L = window.L;

      // Xóa các routes cũ nếu có
      if (this.routeVehToSceneBg) this.mapTracking.removeLayer(this.routeVehToSceneBg);
      if (this.routeSceneToHospBg) this.mapTracking.removeLayer(this.routeSceneToHospBg);
      if (this.focusLines) {
        if (this.focusLines.glow1) this.mapTracking.removeLayer(this.focusLines.glow1);
        if (this.focusLines.line1) this.mapTracking.removeLayer(this.focusLines.line1);
        if (this.focusLines.glow2) this.mapTracking.removeLayer(this.focusLines.glow2);
        if (this.focusLines.line2) this.mapTracking.removeLayer(this.focusLines.line2);
      }

      // 1. Toàn tuyến (mờ ở dưới) — thể hiện chặng đã đi qua (y nguyên bên Trung tâm)
      this.routeVehToSceneBg = L.polyline(m.leg1.ll, {
        color: '#f59e0b',
        weight: 3.5,
        opacity: 0.22,
        dashArray: '6, 8'
      }).addTo(this.mapTracking);

      this.routeSceneToHospBg = L.polyline(m.leg2.ll, {
        color: '#38bdf8',
        weight: 3.5,
        opacity: 0.22,
        dashArray: '5, 7'
      }).addTo(this.mapTracking);

      // 2. Chặng còn lại trước mặt xe (sáng rực rỡ, co dần lại theo xe)
      this.focusLines = {
        glow1: L.polyline([], { color: '#f59e0b', weight: 8, opacity: 0.28, lineCap: 'round' }).addTo(this.mapTracking),
        line1: L.polyline([], { color: '#fbbf24', weight: 3.5, opacity: 0.95, dashArray: '7, 6', lineCap: 'round' }).addTo(this.mapTracking),
        glow2: L.polyline([], { color: '#0284c7', weight: 8, opacity: 0.28, lineCap: 'round' }).addTo(this.mapTracking),
        line2: L.polyline([], { color: '#38bdf8', weight: 3.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(this.mapTracking)
      };

      this.updateRemainingLines(m.pos || { latlng: m.leg1.ll[0], idx: 0 });
    }

    updateRemainingLines(pos) {
      if (!this.focusLines || !this.simMission?.leg1 || !this.simMission?.leg2) return;
      const m = this.simMission;
      const phase = m.phase;
      const remaining = (leg) => [pos.latlng, ...leg.ll.slice(pos.idx + 1)];

      let rem1 = [], rem2 = [];
      if (phase === 'TO_SCENE') {
        rem1 = remaining(m.leg1);
        rem2 = m.leg2.ll;
      } else if (phase === 'PICKUP') {
        rem1 = [];
        rem2 = m.leg2.ll;
      } else if (phase === 'TO_HOSP') {
        rem1 = [];
        rem2 = remaining(m.leg2);
      } else {
        rem1 = [];
        rem2 = [];
      }

      this.focusLines.glow1.setLatLngs(rem1);
      this.focusLines.line1.setLatLngs(rem1);
      this.focusLines.glow2.setLatLngs(rem2);
      this.focusLines.line2.setLatLngs(rem2);
    }

    tickSimulation(now) {
      if (!this.mapTracking || !this.simMission || !this.activeCase.isActive || this.activeCase.status === 'CANCELLED') {
        this.stopAmbulanceSimulation();
        return;
      }

      const m = this.simMission;
      if (!m.leg1 || !m.leg2) {
        this.simRafId = requestAnimationFrame((ts) => this.tickSimulation(ts));
        return;
      }

      const dt = m.lastTs ? Math.min((now - m.lastTs) / 1000, 0.1) : 0;
      m.lastTs = now;

      // Xử lý tạm dừng (dừng đón BN 3 giây tại hiện trường y hệt bên Trung tâm)
      if (m.pauseUntil) {
        if (now < m.pauseUntil) {
          this.simRafId = requestAnimationFrame((ts) => this.tickSimulation(ts));
          return;
        }
        m.pauseUntil = 0;
        if (m.phase === 'PICKUP') {
          m.phase = 'TO_HOSP';
          m.dist = 0;
          this.activeCase.status = 'TRANSPORTING';
          this.activeCase.stageLabel = 'Đang chuyển viện';
          this.updateTrackingStatsUI(null, null, 'Đang chuyển viện');
          window.CCNV_UI.Toast.show(
            'BỆNH NHÂN ĐÃ LÊN XE',
            'Xe 65A-012.34 đang di chuyển khẩn cấp về BV Đa khoa Trung ương Cần Thơ.',
            true
          );
        }
      }

      if (m.phase === 'COMPLETED') {
        this.stopAmbulanceSimulation();
        return;
      }

      const SIM_SPEED_MPS = 55; // Chuẩn 55 m/s y nguyên bên Trung tâm
      const currentLeg = m.phase === 'TO_SCENE' ? m.leg1 : m.leg2;
      m.dist += SIM_SPEED_MPS * dt;

      if (m.dist >= currentLeg.total) {
        m.dist = currentLeg.total;
        if (m.phase === 'TO_SCENE') {
          m.phase = 'PICKUP';
          m.pauseUntil = now + 3000; // Dừng đón bệnh nhân 3s y hệt bên Trung tâm
          this.activeCase.status = 'AT_SCENE';
          this.activeCase.stageLabel = 'Đã đến hiện trường';
          this.updateTrackingStatsUI(0, 'Đã đến hiện trường', 'Đã đến hiện trường');
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          window.CCNV_UI.SoundFx.playEmergencyTone?.();
          window.CCNV_UI.Toast.show(
            'XE CẤP CỨU ĐÃ ĐẾN NƠI',
            'Xe 65A-012.34 đã tiếp cận hiện trường Cổng A ĐH Cần Thơ. Kíp cấp cứu đang đưa nạn nhân lên xe.',
            true
          );
        } else if (m.phase === 'TO_HOSP') {
          m.phase = 'COMPLETED';
          this.activeCase.status = 'COMPLETED';
          this.activeCase.stageLabel = 'Đã đến BVĐK Trung ương';
          this.activeCase.distanceKm = '0.0';
          this.activeCase.etaMinutes = 0;
          this.updateTrackingStatsUI(0, 'Đã đến BV', 'Đã đến bệnh viện');
          window.CCNV_UI.Toast.show(
            'ĐÃ ĐẾN BỆNH VIỆN TIẾP NHẬN',
            'Bệnh nhân đã được bàn giao an toàn cho Khoa Cấp cứu BV Đa khoa Trung ương Cần Thơ.',
            true
          );
          this.stopAmbulanceSimulation();

          // Tự động quay về màn mặc định sau 2.5 giây
          setTimeout(() => {
            this.activeCase.isActive = false;
            this.activeCase.status = 'COMPLETED';
            try {
              sessionStorage.removeItem('ccnv_citizen_demo_dispatched');
            } catch (e) { }
            this.simMission = null;
            if (this.mapTracking) {
              this.mapTracking.remove();
              this.mapTracking = null;
            }
            this.saveToStorage();
            this.switchTab('tab-home');
            this.renderAllViews();
            window.CCNV_UI.Toast.show(
              'HOÀN TẤT CA CẤP CỨU',
              'Ca cấp cứu đã hoàn tất thành công. Hệ thống đã đưa bạn quay lại màn hình mặc định.'
            );
          }, 2500);

          return;
        }
      }

      // Lấy vị trí nội suy mượt mà
      m.pos = this.pointAt(currentLeg, m.dist);
      if (this.vehicleMarker && m.pos) {
        this.vehicleMarker.setLatLng(m.pos.latlng);
        this.activeCase.vehicle.coords = [m.pos.latlng.lat, m.pos.latlng.lng];
      }

      // Cập nhật đường polyline co lại
      this.updateRemainingLines(m.pos);

      // Cập nhật tốc độ xe dao động 46-53 km/h sau mỗi 2s
      if (now - m.lastSpeedUpdate > 2000) {
        m.lastSpeedUpdate = now;
        const speedPill = this.vehicleMarker?.getElement()?.querySelector('.map-veh-status-pill');
        if (speedPill) {
          if (m.phase === 'PICKUP') {
            speedPill.textContent = 'Đón BN (3s)';
          } else if (m.phase === 'ARRIVED' || m.phase === 'COMPLETED') {
            speedPill.textContent = 'Đã đến BV';
          } else {
            this.activeCase.speedKmH = Math.floor(46 + Math.random() * 8);
            speedPill.textContent = `${this.activeCase.speedKmH} km/h`;
          }
        }
      }

      // Cập nhật ETA và khoảng cách trên UI Citizen
      if (m.phase === 'TO_SCENE') {
        const remDistMeters = Math.max(0, m.leg1.total - m.dist);
        const remSec = Math.round(remDistMeters / SIM_SPEED_MPS);
        this.activeCase.distanceKm = (remDistMeters / 1000).toFixed(1);
        this.activeCase.etaMinutes = Math.max(1, Math.ceil(remSec / 60));
        this.updateTrackingStatsUI(remSec);
      } else if (m.phase === 'PICKUP') {
        this.activeCase.distanceKm = '0.0';
        this.activeCase.etaMinutes = 0;
        this.updateTrackingStatsUI(0, 'Đã đến điểm đón', 'Đã đến hiện trường');
      } else if (m.phase === 'TO_HOSP') {
        const remDistMeters = Math.max(0, m.leg2.total - m.dist);
        const remSec = Math.round(remDistMeters / SIM_SPEED_MPS);
        this.activeCase.distanceKm = (remDistMeters / 1000).toFixed(1);
        this.activeCase.etaMinutes = Math.max(1, Math.ceil(remSec / 60));
        this.updateTrackingStatsUI(remSec, null, 'Đang chuyển viện');
      }

      this.simRafId = requestAnimationFrame((ts) => this.tickSimulation(ts));
    }

    updateTrackingStatsUI(remSec = null, customEtaText = null, customStageText = null) {
      const etaEl = document.getElementById('track-eta-value');
      const distEl = document.getElementById('track-dist-value');
      const mapEtaBadge = document.getElementById('map-eta-badge');
      const statusTitle = document.getElementById('track-case-status-title');

      let etaDisplay = `~${this.activeCase.etaMinutes} PHÚT`;
      if (this.activeCase.status === 'COMPLETED') {
        etaDisplay = 'ĐÃ ĐẾN BV';
      } else if (customEtaText) {
        etaDisplay = customEtaText;
      } else if (remSec !== null) {
        if (remSec <= 5) etaDisplay = 'Đang tiếp cận';
        else if (remSec < 60) etaDisplay = `${remSec} GIÂY`;
        else etaDisplay = `~${Math.ceil(remSec / 60)} PHÚT`;
      }

      const stageMap = {
        'DISPATCHED': 'ĐIỀU XE',
        'MOVING': 'XE ĐANG ĐẾN',
        'AT_SCENE': 'TIẾP NHẬN BỆNH NHÂN',
        'TRANSPORTING': 'ĐANG CHUYỂN VIỆN',
        'COMPLETED': 'ĐÃ ĐẾN BỆNH VIỆN'
      };

      const displayStage = (customStageText || stageMap[this.activeCase.status] || this.activeCase.stageLabel || 'XE ĐANG ĐẾN').toUpperCase();

      if (etaEl) etaEl.textContent = etaDisplay;
      if (distEl) distEl.textContent = `${this.activeCase.distanceKm} km (Tốc độ: ${this.activeCase.speedKmH || 48} km/h)`;
      if (mapEtaBadge) mapEtaBadge.textContent = `ETA: ${etaDisplay}`;
      if (statusTitle) statusTitle.textContent = displayStage;

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

    // --- LEAFLET REALTIME MAP CONTROLLER (Clone giao diện GIS app Trung tâm) ---
    initOrRefreshTrackingMap() {
      const container = document.getElementById('citizen-tracking-map');
      if (!container) return;

      if (!window.L) {
        console.warn('Leaflet GIS library not loaded');
        return;
      }

      const sceneCoords = this.activeCase.patientLocation.coords || [10.0298, 105.7702];
      const originCoords = [10.0105, 105.7700]; // Kíp 3 - Trạm Cái Răng
      const vehCoords = (this.simMission?.pos?.latlng)
        ? [this.simMission.pos.latlng.lat, this.simMission.pos.latlng.lng]
        : originCoords;
      const hospCoords = [10.0265, 105.7588]; // BV Đa khoa Trung ương Cần Thơ

      if (!this.mapTracking) {
        this.mapTracking = L.map('citizen-tracking-map', {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          tapHold: false
        }).setView(sceneCoords, 14);

        // ArcGIS Canvas Dark Base & Reference (Chuẩn GIS giao diện Trung tâm CCNV)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri, DeLorme, NAVTEQ',
          maxNativeZoom: 16,
          maxZoom: 18,
          pane: 'tilePane'
        }).addTo(this.mapTracking);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          attribution: '',
          maxNativeZoom: 16,
          maxZoom: 18,
          pane: 'tilePane'
        }).addTo(this.mapTracking);

        // 1. Marker Vị trí tai nạn (Beacon đỏ nhấp nháy clone Central App)
        const incidentIcon = L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-incident-capsule">
              <span class="legend-dot-pulse"></span>
              <span style="font-weight:700;font-size:11px;color:#fca5a5;letter-spacing:0.3px;">VỊ TRÍ TAI NẠN</span>
            </div>
          `,
          iconSize: [180, 32],
          iconAnchor: [90, 32]
        });

        this.citizenMarker = L.marker(sceneCoords, { icon: incidentIcon, zIndexOffset: 500 })
          .addTo(this.mapTracking)
          .bindPopup('<b>VỊ TRÍ TAI NẠN</b><br>Cổng A Đại học Cần Thơ');

        // 2. Marker Xe cấp cứu đang đến (Capsule xe màu hổ phách/amber clone Central App)
        const ambulanceIcon = L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-veh-capsule is-mission">
              <div class="map-veh-icon-bubble">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v9h2"></path>
                  <circle cx="7" cy="17" r="2"></circle>
                  <path d="M9 17h6"></path>
                  <circle cx="17" cy="17" r="2"></circle>
                </svg>
              </div>
              <span class="map-veh-plate">65A-012.34</span>
              <span class="map-veh-status-pill mission">48 km/h</span>
            </div>
          `,
          iconSize: [160, 36],
          iconAnchor: [80, 36]
        });

        this.vehicleMarker = L.marker(vehCoords, { icon: ambulanceIcon, zIndexOffset: 1000 })
          .addTo(this.mapTracking)
          .bindPopup('<b>XE CẤP CỨU ĐANG ĐẾN</b><br>Biển số: 65A-012.34 (BV Đa khoa Trung ương)');

        // 3. Marker Bệnh viện đích (Shield xanh y tế clone Central App)
        const hospitalIcon = L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-hosp-hub-badge">
              <div class="map-hosp-cross-icon">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" style="display:block;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </div>
              <span class="map-hosp-title-text">BVĐK TRUNG ƯƠNG</span>
              <span class="map-hosp-bed-chip">Đích đến</span>
            </div>
          `,
          iconSize: [210, 36],
          iconAnchor: [105, 36]
        });

        this.hospitalMarker = L.marker(hospCoords, { icon: hospitalIcon, zIndexOffset: 300 })
          .addTo(this.mapTracking)
          .bindPopup('<b>BỆNH VIỆN TIẾP NHẬN</b><br>BV Đa khoa Trung ương Cần Thơ');

        // Tự động bao quát cả 3 điểm: Xe, Hiện trường, Bệnh viện đích
        try {
          this.mapTracking.fitBounds([originCoords, sceneCoords, hospCoords], {
            padding: [28, 28],
            maxZoom: 15
          });
        } catch (e) {
          console.warn('fitBounds error:', e);
        }

        // Khởi tạo hoặc vẽ route nếu đã có
        if (this.simMission?.leg1 && this.simMission?.leg2) {
          this.setupTrackingMapRoutes();
        } else {
          this.startAmbulanceSimulation();
        }
      } else {
        this.mapTracking.invalidateSize();
        if (this.vehicleMarker) this.vehicleMarker.setLatLng(vehCoords);
        if (this.citizenMarker) this.citizenMarker.setLatLng(sceneCoords);
        if (this.hospitalMarker) this.hospitalMarker.setLatLng(hospCoords);
        if (this.simMission?.leg1 && this.simMission?.leg2) {
          this.setupTrackingMapRoutes();
        }
        try {
          this.mapTracking.fitBounds([originCoords, sceneCoords, hospCoords], {
            padding: [28, 28],
            maxZoom: 15
          });
        } catch (e) { }
      }
    }

    // --- HOME HEALTHCARE FACILITIES GIS MAP (HIỂN THỊ MẶC ĐỊNH TRÊN TRANG CHỦ) ---
    initOrRefreshHomeFacilitiesMap() {
      const mapContainer = document.getElementById('home-facilities-map');
      if (!mapContainer) return;

      const citizenCoords = [10.0298, 105.7702]; // Cổng A ĐH Cần Thơ

      if (!this.mapHomeFacilities) {
        this.mapHomeFacilities = L.map('home-facilities-map', {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          tapHold: false
        }).setView(citizenCoords, 13);

        // ArcGIS Canvas Dark Base & Reference (Đồng bộ chuẩn GIS giao diện Trung tâm)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri, DeLorme, NAVTEQ',
          maxNativeZoom: 16,
          maxZoom: 18,
          pane: 'tilePane'
        }).addTo(this.mapHomeFacilities);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          attribution: '',
          maxNativeZoom: 16,
          maxZoom: 18,
          pane: 'tilePane'
        }).addTo(this.mapHomeFacilities);

        // 1. Marker Vị trí của bạn (Đỏ pulse chuẩn CCNV)
        const citizenIcon = L.divIcon({
          className: 'map-leaflet-marker',
          html: `
            <div class="map-incident-capsule" style="background:rgba(239,68,68,0.22);border-color:#EF4444;">
              <span class="legend-dot-pulse"></span>
              <span style="font-weight:700;font-size:11px;color:#FCA5A5;letter-spacing:0.3px;">VỊ TRÍ CỦA BẠN</span>
            </div>
          `,
          iconSize: [160, 32],
          iconAnchor: [80, 32]
        });

        this.homeCitizenMarker = L.marker(citizenCoords, { icon: citizenIcon, zIndexOffset: 900 })
          .addTo(this.mapHomeFacilities)
          .bindPopup(`
            <div style="font-size:12px;color:#FFFFFF;padding:2px;">
              <strong style="color:#EF4444;font-size:13px;display:block;margin-bottom:3px;">VỊ TRÍ HIỆN TẠI (GPS)</strong>
              <div>Đại học Cần Thơ - Cổng A đường 3/2, P. Xuân Khánh</div>
              <div style="font-size:11px;color:#34D399;margin-top:4px;">● Tọa độ: 10.0298°B, 105.7702°Đ</div>
            </div>
          `);

        // 2. Hospital Markers
        this.homeFacilitiesMarkers = {};
        const allPoints = [citizenCoords];

        const hospList = (this.hospitals && this.hospitals.length > 0) ? this.hospitals : (window.SEED_DATA?.hospitals || []);
        hospList.forEach(h => {
          if (!h.coords) return;
          allPoints.push(h.coords);

          const shortName = h.code ? h.code : (h.name.replace('Bệnh viện', 'BV').replace('Đa khoa', 'ĐK'));

          const hospIcon = L.divIcon({
            className: 'map-leaflet-marker',
            html: `
              <div class="map-hosp-hub-badge">
                <div class="map-hosp-cross-icon">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" style="display:block;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </div>
                <span class="map-hosp-title-text">${shortName}</span>
              </div>
            `,
            iconSize: [140, 36],
            iconAnchor: [70, 36]
          });

          const marker = L.marker(h.coords, { icon: hospIcon, zIndexOffset: 400 })
            .addTo(this.mapHomeFacilities)
            .bindPopup(`
              <div style="font-size:12px;color:#FFFFFF;padding:2px;">
                <strong style="color:#38BDF8;font-size:13px;display:block;margin-bottom:3px;">${h.name}</strong>
                <div style="color:#CBD5E1;font-size:11.5px;margin-bottom:4px;">${h.address}</div>
                <div style="color:#34D399;font-weight:600;font-size:11px;margin-bottom:6px;">
                  Sẵn sàng tiếp nhận cấp cứu
                </div>
                <div style="display:flex;gap:6px;">
                  <a href="tel:${h.hotline || h.phone || '115'}" style="background:#E52521;color:#FFFFFF;padding:4px 8px;border-radius:4px;text-decoration:none;font-size:10.5px;font-weight:700;">
                    Gọi hotline
                  </a>
                  <a href="https://www.google.com/maps/dir/?api=1&destination=${h.coords[0]},${h.coords[1]}" target="_blank" style="background:#0A1B2A;border:1px solid #38BDF8;color:#38BDF8;padding:4px 8px;border-radius:4px;text-decoration:none;font-size:10.5px;">
                    Chỉ đường
                  </a>
                </div>
              </div>
            `);

          this.homeFacilitiesMarkers[h.id] = marker;
        });

        // Fit bounds bao quát vị trí người dân và các cơ sở y tế
        try {
          if (allPoints.length > 1) {
            this.mapHomeFacilities.fitBounds(allPoints, {
              padding: [24, 24],
              maxZoom: 14
            });
          }
        } catch (e) {
          console.warn('fitBounds facilities map error:', e);
        }
        setTimeout(() => {
          if (this.mapHomeFacilities) this.mapHomeFacilities.invalidateSize();
        }, 150);
      } else {
        this.mapHomeFacilities.invalidateSize();
        setTimeout(() => {
          if (this.mapHomeFacilities) this.mapHomeFacilities.invalidateSize();
        }, 150);
      }
    }

    // --- DANH SÁCH CƠ SỞ Y TẾ GẦN NHẤT TRÊN TRANG CHỦ (TÍCH HỢP SEARCH & SORT) ---
    renderHomeNearestHospitals() {
      const container = document.getElementById('home-nearest-hospitals-list');
      const countEl = document.getElementById('home-facilities-count');
      if (!container) return;

      const hospList = (this.hospitals && this.hospitals.length > 0) ? this.hospitals : (window.SEED_DATA?.hospitals || []);
      if (!hospList || hospList.length === 0) return;

      const citizenCoords = [10.0298, 105.7702];

      const calculateDistKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      // 1. Tính khoảng cách cho từng cơ sở y tế
      let processedList = hospList.map(h => {
        const dist = (h.coords && h.coords.length === 2)
          ? calculateDistKm(citizenCoords[0], citizenCoords[1], h.coords[0], h.coords[1])
          : 999;
        return { ...h, distKm: dist };
      });

      // 2. Tìm kiếm (theo Tên, Mã, Địa chỉ, Chuyên khoa)
      if (this.hospSearchQuery) {
        const q = this.hospSearchQuery;
        processedList = processedList.filter(h => {
          const nameMatch = (h.name || '').toLowerCase().includes(q);
          const codeMatch = (h.code || '').toLowerCase().includes(q);
          const addrMatch = (h.address || '').toLowerCase().includes(q);
          const specMatch = (h.specialties || []).some(s => s.toLowerCase().includes(q));
          return nameMatch || codeMatch || addrMatch || specMatch;
        });
      }

      // 3. Sắp xếp (Sort)
      const gradeWeight = (grade) => {
        if (!grade) return 0;
        if (grade.includes('Đặc biệt')) return 4;
        if (grade.includes('I') || grade.includes('1')) return 3;
        if (grade.includes('II') || grade.includes('2')) return 2;
        return 1;
      };

      if (this.hospSortMode === 'beds_desc') {
        processedList.sort((a, b) => {
          const bedsA = (a.availableBeds !== undefined) ? a.availableBeds : 0;
          const bedsB = (b.availableBeds !== undefined) ? b.availableBeds : 0;
          return bedsB - bedsA;
        });
      } else if (this.hospSortMode === 'grade_desc') {
        processedList.sort((a, b) => (gradeWeight(b.grade) - gradeWeight(a.grade)) || (a.distKm - b.distKm));
      } else if (this.hospSortMode === 'name_asc') {
        processedList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
      } else {
        // Mặc định: Gần nhất (dist_asc)
        processedList.sort((a, b) => a.distKm - b.distKm);
      }

      if (countEl) {
        countEl.textContent = `${processedList.length} cơ sở tiếp nhận`;
      }
      const pillCount = document.getElementById('pill-hosp-count');
      if (pillCount) {
        pillCount.textContent = processedList.length;
      }

      if (processedList.length === 0) {
        container.innerHTML = `
          <div style="background:#081827;border:1px dashed #1E3A56;border-radius:10px;padding:22px;text-align:center;color:#94A3B8;font-size:12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" style="margin-bottom:6px;display:inline-block;">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <div>Không tìm thấy cơ sở y tế phù hợp với từ khóa "<strong>${this.hospSearchQuery}</strong>"</div>
            <div style="font-size:11px;color:#64748B;margin-top:4px;">Vui lòng thử tìm kiếm với tên viện hoặc địa chỉ khác</div>
          </div>
        `;
        return;
      }

      container.innerHTML = processedList.map(h => {
        const distFormatted = h.distKm < 1 ? `${Math.round(h.distKm * 1000)}m` : `${h.distKm.toFixed(1)} km`;
        const hotlineNum = h.hotline || h.phone || '115';

        return `
          <div class="home-nearest-card" data-hosp-id="${h.id}">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                <span class="badge badge-success" style="font-size:9.5px;padding:2px 6px;font-weight:700;">TIẾP NHẬN</span>
                <span style="font-size:11px;color:#38BDF8;font-weight:700;">~${distFormatted}</span>
              </div>
              <div style="font-size:13.5px;font-weight:700;color:#FFFFFF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${h.name}
              </div>
              <div style="font-size:11px;color:#94A3B8;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${h.address}
              </div>
              <div style="font-size:11.5px;color:#94A3B8;margin-top:4px;display:flex;align-items:center;gap:5px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.3">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span>Hotline: <strong style="font-family:var(--font-mono);color:#38BDF8;font-weight:700;">${hotlineNum}</strong></span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0;">
              <a href="tel:${hotlineNum}" class="btn btn-emergency btn-xs"
                style="padding:6px 10px;font-size:11px;font-weight:700;text-decoration:none;display:flex;align-items:center;gap:5px;border-radius:6px;"
                title="Gọi đường dây nóng cấp cứu ${hotlineNum}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span>Gọi</span>
              </a>
              <button type="button" class="btn btn-default btn-xs btn-hosp-locate" data-hosp-id="${h.id}"
                style="padding:5px 9px;font-size:11px;border:1px solid #1E3A56;color:#38BDF8;background:#0A1B2A;display:flex;align-items:center;gap:5px;border-radius:6px;"
                title="Xem trên bản đồ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>Vị trí</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Gắn sự kiện click nút "Vị trí" hoặc click vào thẻ viện để zoom tới marker trên bản đồ
      container.querySelectorAll('.btn-hosp-locate').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const hospId = btn.getAttribute('data-hosp-id');
          this.focusHospitalOnHomeMap(hospId);
        });
      });

      container.querySelectorAll('.home-nearest-card').forEach(card => {
        card.addEventListener('click', () => {
          const hospId = card.getAttribute('data-hosp-id');
          this.focusHospitalOnHomeMap(hospId);
        });
      });
    }

    filterHomeFacilitiesMap() {
      if (!this.mapHomeFacilities || !this.homeFacilitiesMarkers) return;

      const q = (this.hospSearchQuery || '').toLowerCase().trim();
      const hospList = (this.hospitals && this.hospitals.length > 0) ? this.hospitals : (window.SEED_DATA?.hospitals || []);
      const matchedCoords = [[10.0298, 105.7702]];

      hospList.forEach(h => {
        const marker = this.homeFacilitiesMarkers[h.id];
        if (!marker) return;

        if (!q) {
          marker.setOpacity(1.0);
          if (marker._icon) marker._icon.style.filter = 'none';
          if (h.coords) matchedCoords.push(h.coords);
        } else {
          const nameMatch = (h.name || '').toLowerCase().includes(q);
          const codeMatch = (h.code || '').toLowerCase().includes(q);
          const addrMatch = (h.address || '').toLowerCase().includes(q);
          const specMatch = (h.specialties || []).some(s => s.toLowerCase().includes(q));

          if (nameMatch || codeMatch || addrMatch || specMatch) {
            marker.setOpacity(1.0);
            if (marker._icon) marker._icon.style.filter = 'drop-shadow(0 0 6px rgba(56,189,248,0.8))';
            if (h.coords) matchedCoords.push(h.coords);
          } else {
            marker.setOpacity(0.2);
            if (marker._icon) marker._icon.style.filter = 'grayscale(100%)';
          }
        }
      });

      if (q && matchedCoords.length > 1) {
        try {
          this.mapHomeFacilities.fitBounds(matchedCoords, { padding: [24, 24], maxZoom: 15 });
        } catch (e) { }
      }
    }

    focusHospitalOnHomeMap(hospId) {
      if (!this.mapHomeFacilities || !this.homeFacilitiesMarkers) return;
      const marker = this.homeFacilitiesMarkers[hospId];
      if (marker) {
        const latlng = marker.getLatLng();
        this.mapHomeFacilities.setView(latlng, 15, { animate: true });
        marker.openPopup();

        const mapEl = document.getElementById('home-facilities-map');
        if (mapEl) {
          mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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
        }).catch(() => { });
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
            Khoảng cách: ~${(1.2 + idx * 0.9).toFixed(1)} km · Trực Cấp cứu 24/7
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
      const selectedBtn = cancelSheet ? cancelSheet.querySelector('.bottom-sheet-reason-btn.selected') : null;
      const reason = selectedBtn ? selectedBtn.textContent.trim() : 'Người dân tự hủy';

      this.activeCase.isActive = false;
      this.activeCase.status = 'CANCELLED';
      this.activeCase.stageLabel = 'Đã hủy yêu cầu';

      this.isDispatchPending = false;
      if (this.dispatchPendingInterval) {
        clearInterval(this.dispatchPendingInterval);
        this.dispatchPendingInterval = null;
      }
      const banner = document.getElementById('citizen-dispatch-pending-banner');
      if (banner) banner.style.display = 'none';
      try {
        sessionStorage.removeItem('ccnv_citizen_demo_dispatched');
      } catch (e) { }

      this.stopAmbulanceSimulation();
      this.simMission = null;
      if (this.mapTracking) {
        this.mapTracking.remove();
        this.mapTracking = null;
      }
      if (cancelSheet) cancelSheet.classList.remove('active');

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
          <div class="cpr-visual-pulse" style="display:flex;align-items:center;gap:10px;background:rgba(225,29,72,0.15);border:1px solid #E11D48;border-radius:8px;padding:10px;margin-bottom:12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#E11D48">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <div>
              <strong style="color:#FFFFFF;font-size:13px;display:block;">Nhịp độ chuẩn: 100 - 120 nhịp/phút</strong>
              <span style="font-size:11px;color:#FDA4AF;">Ép sâu 5-6 cm giữa lồng ngực, để ngực nở hoàn toàn sau mỗi lần ép.</span>
            </div>
          </div>
          <div style="font-size:12px;color:#EF4444;font-weight:700;">LƯU Ý ĐẶC BIỆT NGUY HIỂM:</div>
          <div style="font-size:12px;color:#CBD5E1;margin-top:4px;">
            Không chích máu đầu ngón tay/dái tai; Không cạo gió; Không cho uống thuốc hạ huyết áp hay ngậm An Cung Trúc Hoàn.
          </div>
        `;
      } else if (type === 'stroke') {
        title = 'XỬ TRÍ NGHI NGỜ ĐỘT QUỴ (FAST)';
        html = `
          <div style="background:#081827;border:1px solid #1E3A56;border-radius:8px;padding:12px;margin-bottom:10px;">
            <strong style="color:#38BDF8;font-size:13px;display:block;margin-bottom:4px;">QUY TẮC FAST:</strong>
            <ul style="font-size:12px;color:#CBD5E1;line-height:1.6;padding-left:16px;margin:0;">
              <li><strong>F (Face - Mặt):</strong> Mặt bị méo, nụ cười lệch 1 bên.</li>
              <li><strong>A (Arms - Tay):</strong> Yếu hoặc liệt 1 tay hoặc chân.</li>
              <li><strong>S (Speech - Lời nói):</strong> Nói đớ, nói ngọng, không nói được.</li>
              <li><strong>T (Time - Thời gian):</strong> Thời gian vàng là 3 - 4.5 giờ!</li>
            </ul>
          </div>
          <div style="font-size:12px;color:#34D399;font-weight:700;">HƯỚNG DẪN XỬ TRÍ:</div>
          <div style="font-size:12px;color:#CBD5E1;margin-top:4px;">
            Đặt nạn nhân nằm nghiêng an toàn, đầu cao 30 độ. Nới lỏng cổ áo. Tuyệt đối KHÔNG cho ăn uống bất cứ thứ gì.
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
            <button class="btn btn-default btn-xs btn-delete-contact" data-idx="${idx}" style="padding:6px 8px;color:#EF4444;border:1px solid #29465A;display:flex;align-items:center;" title="Xóa">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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

      // Active Emergency Case vs Idle View on Home Screen
      const activeCaseView = document.getElementById('home-active-case-view');
      const idleView = document.getElementById('home-idle-view');
      const banner = document.getElementById('citizen-active-banner');
      const navBadge = document.getElementById('nav-emergency-badge');

      const mainContainer = document.getElementById('citizen-main-container');
      const isOngoingEmergency = this.activeCase.isActive && this.activeCase.status !== 'CANCELLED' && this.activeCase.status !== 'COMPLETED';

      if (isOngoingEmergency) {
        if (mainContainer) {
          mainContainer.classList.remove('home-idle-mode');
          if (this.currentTab === 'tab-home') {
            mainContainer.classList.add('home-active-mode');
          } else {
            mainContainer.classList.remove('home-active-mode');
          }
        }
        if (activeCaseView) activeCaseView.style.display = 'block';
        if (idleView) idleView.style.display = 'none';
        if (banner) banner.style.display = 'flex';
        if (navBadge) navBadge.classList.add('active');
        if (this.currentTab === 'tab-home') {
          setTimeout(() => this.initOrRefreshTrackingMap(), 120);
        }
      } else {
        if (mainContainer) {
          mainContainer.classList.remove('home-active-mode');
          if (this.currentTab === 'tab-home') mainContainer.classList.add('home-idle-mode');
        }
        if (activeCaseView) activeCaseView.style.display = 'none';
        if (idleView) idleView.style.display = 'block';
        if (banner) banner.style.display = 'none';
        if (navBadge) navBadge.classList.remove('active');
        if (this.currentTab === 'tab-home') {
          this.renderHomeNearestHospitals();
          setTimeout(() => this.initOrRefreshHomeFacilitiesMap(), 120);
        }
      }

      this.updateTrackingStatsUI();
      this.renderChatMessages();
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
      } catch (e) { }
    }

    const app = new CitizenApp();
    window.citizenApp = app;
    await app.init();
  });

})(window);
