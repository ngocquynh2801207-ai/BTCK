async function loadPageData() {
  const key = 'fixflow.unified.sla';
  const stored = localStorage.getItem(key) ??
    localStorage.getItem('fixflow.sla') ??
    localStorage.getItem('fixflow.page29.sla');
  if (stored !== null) {
    try {
      const value = JSON.parse(stored);
      if (!Array.isArray(value.values) || typeof value.notifications !== 'boolean') {
        throw new Error('Cấu hình SLA đã lưu không hợp lệ.');
      }
      return value;
    } catch (error) {
      console.error('Không thể đọc cấu hình SLA đã lưu.', error);
      throw error;
    }
  }
  const response = await fetch('assets/data/sla-settings.json');
  if (!response.ok) throw new Error(`Không tải được cấu hình SLA (HTTP ${response.status}).`);
  const value = await response.json();
  if (!Array.isArray(value.values) || typeof value.notifications !== 'boolean') {
    throw new Error('Tệp cấu hình SLA không đúng định dạng.');
  }
  savePageData(value);
  return value;
}

function savePageData(value) {
  localStorage.setItem('fixflow.unified.sla', JSON.stringify(value));
}

function initSla(savedSla) {
  const fields = [...document.querySelectorAll('[data-sla-field]')];
  const notifications = document.getElementById('slaNotifications');
  fields.forEach((field, index) => {
    field.value = savedSla.values[index] ?? field.value;
  });
  notifications.checked = savedSla.notifications;
  document.getElementById('saveSla').addEventListener('click', () => {
    const feedback = document.getElementById('slaFeedback');
    const invalid = fields.find(input => !input.value || Number(input.value) < 1 || !Number.isInteger(Number(input.value)));
    if (invalid) {
      invalid.focus();
      invalid.setCustomValidity('Nhập số nguyên lớn hơn 0.');
      invalid.reportValidity();
      invalid.addEventListener('input', () => invalid.setCustomValidity(''), { once: true });
      feedback.textContent = 'Vui lòng nhập thời gian hợp lệ cho tất cả các mức độ ưu tiên.';
      feedback.style.color = '#c43e4c';
      return;
    }
    savePageData({
      values: fields.map(field => Number(field.value)),
      notifications: notifications.checked
    });
    feedback.textContent = `Đã lưu cấu hình SLA lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.`;
    feedback.style.color = '';
  });
}

function initGlobalSearch(localSelector, fallbackSelector) {
  const input = document.querySelector('.o-tim-kiem-chinh input');
  input.addEventListener('input', () => {
    const query = input.value.trim();
    const localSearch = localSelector ? document.querySelector(localSelector) : null;
    if (localSearch) {
      if (localSearch.value !== query) {
        localSearch.value = query;
        localSearch.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    document.querySelectorAll(fallbackSelector).forEach(item => {
      item.hidden = Boolean(query) && !item.textContent.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'));
    });
  });
}

async function startPage() {
  const status = document.getElementById('dataLoadStatus');
  status.hidden = false;
  status.textContent = 'Đang tải cấu hình SLA...';
  try {
    const savedSla = await loadPageData();
    initSla(savedSla);
    initGlobalSearch(null, '.sla-bang tbody tr, .thong-tin-sla');
    status.hidden = true;
  } catch (error) {
    console.error('Không thể khởi tạo trang cấu hình SLA.', error);
    status.textContent = 'Không thể tải cấu hình SLA. Hãy mở trang qua máy chủ cục bộ và kiểm tra tệp assets/data/sla-settings.json.';
  } finally {
    document.documentElement.dataset.dataReady = 'true';
  }
}

startPage();
