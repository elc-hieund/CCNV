/**
 * CCNV ePCR FORM (ELECTRONIC PATIENT CARE RECORD)
 * Standardized 8-section digital medical record for pre-hospital care.
 * Reusable across Central Command, Driver Tablet, and Receiving Hospital.
 */

(function (window) {
  'use strict';

  const EPCRForm = {
    render(containerId, initialData = {}, isReadOnly = false, onSaveCallback = null) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const data = {
        patientStatus: initialData.patientStatus || 'Tỉnh táo, tiếp xúc tốt',
        vitals: {
          pulse: initialData.vitals?.pulse || 88,
          bp: initialData.vitals?.bp || '120/80 mmHg',
          spO2: initialData.vitals?.spO2 || 98,
          temp: initialData.vitals?.temp || 36.8,
          rr: initialData.vitals?.rr || 18,
          glasgow: initialData.vitals?.glasgow || 15
        },
        interventions: initialData.interventions || ['Thở oxy qua cannula 3L/phút', 'Băng ép vô khuẩn vết thương cẳng tay', 'Nẹp cố định mềm'],
        medications: initialData.medications || ['Natriclorid 0.9% 500ml truyền tĩnh mạch', 'Paracetamol 1g truyền'],
        progression: initialData.progression || 'Bệnh nhân giảm đau, dấu sinh hiệu ổn định suốt quá trình vận chuyển.',
        allergies: initialData.allergies || 'Chưa ghi nhận tiền sử dị ứng thuốc',
        history: initialData.history || 'Tăng huyết áp 3 năm, đang điều trị Amlodipine'
      };

      container.innerHTML = `
        <div class="epcr-form-wrapper" style="display:flex;flex-direction:column;gap:16px;">
          <!-- 1. PATIENT TRIAGE & GENERAL STATUS -->
          <div class="form-section">
            <div class="form-section-title">1. Đánh giá ban đầu & Tình trạng chung</div>
            <div class="form-field">
              <label class="form-label">Tình trạng tri giác / Toàn trạng ban đầu</label>
              <textarea id="epcr-patient-status" rows="2" ${isReadOnly ? 'disabled' : ''}>${data.patientStatus}</textarea>
            </div>
          </div>

          <!-- 2. VITAL SIGNS (SINH HIỆU) -->
          <div class="form-section">
            <div class="form-section-title">2. Dấu hiệu sinh tồn tại hiện trường</div>
            <div class="form-grid-3">
              <div class="form-field">
                <label class="form-label">Mạch (lần/phút)</label>
                <input type="number" id="epcr-pulse" value="${data.vitals.pulse || ''}" ${isReadOnly ? 'disabled' : ''}/>
              </div>
              <div class="form-field">
                <label class="form-label">Huyết áp (mmHg)</label>
                <input type="text" id="epcr-bp" value="${data.vitals.bp || ''}" placeholder="120/80" ${isReadOnly ? 'disabled' : ''}/>
              </div>
              <div class="form-field">
                <label class="form-label">SpO2 (%)</label>
                <input type="number" id="epcr-spo2" value="${data.vitals.spO2 || ''}" ${isReadOnly ? 'disabled' : ''}/>
              </div>
              <div class="form-field">
                <label class="form-label">Thân nhiệt (°C)</label>
                <input type="number" step="0.1" id="epcr-temp" value="${data.vitals.temp || ''}" ${isReadOnly ? 'disabled' : ''}/>
              </div>
              <div class="form-field">
                <label class="form-label">Nhịp thở (lần/phút)</label>
                <input type="number" id="epcr-rr" value="${data.vitals.rr || ''}" ${isReadOnly ? 'disabled' : ''}/>
              </div>
              <div class="form-field">
                <label class="form-label">Glasgow (Điểm)</label>
                <input type="number" min="3" max="15" id="epcr-glasgow" value="${data.vitals.glasgow || 15}" ${isReadOnly ? 'disabled' : ''}/>
              </div>
            </div>
          </div>

          <!-- 3. MEDICAL HISTORY & ALLERGIES -->
          <div class="form-section">
            <div class="form-section-title">3. Tiền sử & Dị ứng (SAMPLE)</div>
            <div class="form-grid-2">
              <div class="form-field">
                <label class="form-label">Dị ứng</label>
                <input type="text" id="epcr-allergies" value="${data.allergies}" ${isReadOnly ? 'disabled' : ''}/>
              </div>
              <div class="form-field">
                <label class="form-label">Tiền sử bệnh lý</label>
                <input type="text" id="epcr-history" value="${data.history}" ${isReadOnly ? 'disabled' : ''}/>
              </div>
            </div>
          </div>

          <!-- 4. INTERVENTIONS & MEDICATIONS -->
          <div class="form-section">
            <div class="form-section-title">4. Xử trí, Can thiệp & Thuốc đã dùng</div>
            <div class="form-grid-2">
              <div class="form-field">
                <label class="form-label">Các can thiệp cấp cứu đã thực hiện</label>
                <textarea id="epcr-interventions" rows="3" ${isReadOnly ? 'disabled' : ''}>${data.interventions.join('\n')}</textarea>
              </div>
              <div class="form-field">
                <label class="form-label">Thuốc & Dịch truyền</label>
                <textarea id="epcr-medications" rows="3" ${isReadOnly ? 'disabled' : ''}>${data.medications.join('\n')}</textarea>
              </div>
            </div>
          </div>

          <!-- 5. PROGRESSION ON ROUTE -->
          <div class="form-section">
            <div class="form-section-title">5. Diễn biến trong quá trình vận chuyển</div>
            <div class="form-field">
              <label class="form-label">Ghi nhận của kíp cấp cứu</label>
              <textarea id="epcr-progression" rows="2" ${isReadOnly ? 'disabled' : ''}>${data.progression}</textarea>
            </div>
          </div>

          ${!isReadOnly ? `
            <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px;">
              <button class="btn btn-default" id="btn-epcr-reset">Khôi phục</button>
              <button class="btn btn-emergency" id="btn-epcr-save">Lưu phiếu ePCR & Đồng bộ</button>
            </div>
          ` : ''}
        </div>
      `;

      if (!isReadOnly) {
        const btnSave = container.querySelector('#btn-epcr-save');
        if (btnSave) {
          btnSave.addEventListener('click', () => {
            const updated = {
              patientStatus: container.querySelector('#epcr-patient-status').value,
              vitals: {
                pulse: Number(container.querySelector('#epcr-pulse').value),
                bp: container.querySelector('#epcr-bp').value,
                spO2: Number(container.querySelector('#epcr-spo2').value),
                temp: Number(container.querySelector('#epcr-temp').value),
                rr: Number(container.querySelector('#epcr-rr').value),
                glasgow: Number(container.querySelector('#epcr-glasgow').value)
              },
              allergies: container.querySelector('#epcr-allergies').value,
              history: container.querySelector('#epcr-history').value,
              interventions: container.querySelector('#epcr-interventions').value.split('\n').filter(Boolean),
              medications: container.querySelector('#epcr-medications').value.split('\n').filter(Boolean),
              progression: container.querySelector('#epcr-progression').value
            };

            if (onSaveCallback) onSaveCallback(updated);
            if (window.CCNV_UI?.Toast) {
              window.CCNV_UI.Toast.show('Đã cập nhật Phiếu ePCR', 'Dữ liệu lâm sàng được đồng bộ tới kíp và bệnh viện tiếp nhận.');
            }
          });
        }
      }
    }
  };

  window.EPCRForm = EPCRForm;
})(window);
