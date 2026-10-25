async function loadPageData() {
  const key = 'fixflow.unified.devices';
  const stored = localStorage.getItem(key) ??
    localStorage.getItem('fixflow.devices') ??
    localStorage.getItem('fixflow.page26.devices');
  if (stored !== null) {
    try {
      let value = JSON.parse(stored);
      if (!Array.isArray(value)) throw new Error('Dữ liệu thiết bị đã lưu không hợp lệ.');
      const version = localStorage.getItem(`${key}.dataVersion`) ??
        localStorage.getItem('fixflow.devices.dataVersion') ??
        localStorage.getItem('fixflow.page26.dataVersion');
      if (version === null && value.length === 11 &&
          value.every((device, index) => device.id === `TB-${String(index + 1).padStart(3, '0')}`)) {
        const defaults = await fetchDefaultDevices();
        value = [...value, ...defaults.slice(11)];
      }
      if (value.length >= 89 &&
          value.slice(0, 89).every((device, index) =>
            device.id === `TB-${String(index + 1).padStart(3, '0')}`)) {
        value = value.filter(device => {
          const id = Number(device.id.slice(3));
          return id <= 25 || id > 89;
        });
      }
      savePageData(value);
      return value;
    } catch (error) {
      console.error('Không thể đọc dữ liệu thiết bị đã lưu.', error);
      throw error;
    }
  }
  const value = await fetchDefaultDevices();
  savePageData(value);
  return value;
}

async function fetchDefaultDevices() {
  const response = await fetch('assets/data/devices.json');
  if (!response.ok) throw new Error(`Không tải được dữ liệu thiết bị (HTTP ${response.status}).`);
  const value = await response.json();
  if (!Array.isArray(value)) throw new Error('Tệp dữ liệu thiết bị không đúng định dạng.');
  return value;
}

function savePageData(value) {
  localStorage.setItem('fixflow.unified.devices', JSON.stringify(value));
  localStorage.setItem('fixflow.unified.devices.dataVersion', '2');
}

let devices = [];

const deviceLocations = ['P.101 - Tòa A', 'P.201 - Tòa B', 'Hội trường', 'Phòng Giám đốc', 'Sân sau'];

let activeTabFilter = '';
let editingDeviceId = null;

function nextDeviceId() {
  const lastId = devices.reduce((max, device) => {
    const number = Number(device.id.slice(3));
    return Number.isNaN(number) ? max : Math.max(max, number);
  }, 0);
  return `TB-${String(lastId + 1).padStart(3, '0')}`;
}

function renderStatusCounts() {
  const statusCounts = devices.reduce((counts, device) => {
    counts[device.status] = (counts[device.status] || 0) + 1;
    return counts;
  }, {});

  document.querySelectorAll('.dem-trang-thai').forEach(count => {
    count.textContent = count.dataset.status === 'all'
      ? devices.length
      : statusCounts[count.dataset.status] || 0;
  });
  document.getElementById('totalDeviceCount').textContent = devices.length;
  const countByStatus = status => statusCounts[status] || 0;
  const overviewTotal = document.getElementById('overviewDeviceTotal');
  if (overviewTotal) {
    const activeCount = countByStatus('Hoạt động');
    const maintenanceCount = countByStatus('Bảo trì');
    const offlineCount = countByStatus('Ngừng hoạt động');
    const totalCount = devices.length;
    const activePercent = totalCount ? activeCount / totalCount * 100 : 0;
    const maintenancePercent = totalCount ? maintenanceCount / totalCount * 100 : 0;
    overviewTotal.textContent = totalCount;
    document.getElementById('overviewDonutTotal').textContent = totalCount;
    document.getElementById('overviewActiveDevices').textContent = activeCount;
    document.getElementById('overviewMaintenanceDevices').textContent = maintenanceCount;
    document.getElementById('overviewOfflineDevices').textContent = offlineCount;
    document.getElementById('overviewDeviceDonut').style.background =
      `conic-gradient(#18a65e 0 ${activePercent}%, #f2a331 ${activePercent}% ${activePercent + maintenancePercent}%, #dce4ef ${activePercent + maintenancePercent}% 100%)`;
  }
}

function getFilteredDevices() {
  let data = devices;
  const search = document.getElementById('deviceSearch').value.toLowerCase().trim();
  const type = document.getElementById('filterType').value;
  const status = document.getElementById('filterStatus').value;
  const location = document.getElementById('filterLocation').value;

  if (activeTabFilter) data = data.filter(device => device.status === activeTabFilter);
  if (search) {
    data = data.filter(device =>
      device.name.toLowerCase().includes(search) || device.id.toLowerCase().includes(search)
    );
  }
  if (type) data = data.filter(device => device.type === type);
  if (status) data = data.filter(device => device.status === status);
  if (location) data = data.filter(device => device.loc === location);

  return data;
}

function renderDevices() {
  const data = getFilteredDevices();
  renderTable(data);
  renderCards(data);
  const emptyMessage = document.getElementById('deviceEmpty');
  if (emptyMessage) emptyMessage.hidden = data.length > 0;
  const resultCount = document.getElementById('deviceResultCount');
  if (resultCount) {
    resultCount.textContent = `Đang hiển thị ${data.length} / ${devices.length} thiết bị`;
  }
}

function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  tbody.replaceChildren();
  data.forEach(device => {
    const badgeClass = device.status === 'Bảo trì' ? 'cam' :
      device.status === 'Ngừng hoạt động' ? 'do' : 'xanh';
    const row = document.createElement('tr');
    [`${device.id} · ${device.name}`, device.type, device.loc].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `nhan-trang-thai ${badgeClass}`;
    badge.textContent = device.status;
    statusCell.appendChild(badge);
    row.appendChild(statusCell);
    [device.date, device.warranty, device.views].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    const actions = document.createElement('td');
    [['Sửa', 'edit'], ['Xóa', 'delete']].forEach(([label, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = action === 'delete' ? 'thiet-bi-hang-thao-tac thiet-bi-xoa-thao-tac' : 'thiet-bi-hang-thao-tac';
      button.textContent = label;
      button.setAttribute('aria-label', `${action === 'edit' ? 'Chỉnh sửa' : 'Xóa'} thiết bị ${device.id}`);
      button.dataset.deviceAction = action;
      button.dataset.deviceId = device.id;
      actions.appendChild(button);
    });
    row.appendChild(actions);
    tbody.appendChild(row);
  });
}

function renderCards(data) {
  const grid = document.getElementById('cardView');
  grid.replaceChildren();

  data.forEach(d => {
    const badgeClass = d.status === 'Bảo trì' ? 'cam' :
      d.status === 'Ngừng hoạt động' ? 'do' : 'xanh';

    const card = document.createElement('div');
    card.className = 'the-thiet-bi';
    const cardTop = document.createElement('div');
    cardTop.className = 'dau-the-thiet-bi';
    const name = document.createElement('h4');
    name.textContent = d.name;
    const statusBadge = document.createElement('span');
    statusBadge.className = `nhan-trang-thai ${badgeClass}`;
    statusBadge.textContent = d.status;
    cardTop.append(name, statusBadge);

    const meta = document.createElement('p');
    meta.className = 'thong-tin-thiet-bi';
    meta.textContent = `${d.id} · ${d.loc.replace(' - ', ' · ')}`;
    const cardInfo = document.createElement('div');
    cardInfo.className = 'thiet-bi-the-thong-tin';
    [
      ['Loại:', d.type],
      ['Bảo hành:', d.warranty],
      ['Lượt xem:', d.views]
    ].forEach(([label, value]) => {
      const item = document.createElement('p');
      const itemLabel = document.createElement('span');
      itemLabel.textContent = label;
      const itemValue = document.createElement('strong');
      itemValue.textContent = value;
      item.append(itemLabel, itemValue);
      cardInfo.appendChild(item);
    });
    const cardActions = document.createElement('div');
    cardActions.className = 'thiet-bi-the-thao-tac';
    [['Sửa', 'edit'], ['Xóa', 'delete']].forEach(([label, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.className = action === 'delete' ? 'thiet-bi-hang-thao-tac thiet-bi-xoa-thao-tac' : 'thiet-bi-hang-thao-tac';
      button.dataset.deviceAction = action;
      button.dataset.deviceId = d.id;
      cardActions.appendChild(button);
    });
    card.append(cardTop, meta, cardInfo, cardActions);
    grid.appendChild(card);
  });
}

function initViewToggle() {
  const listButton = document.getElementById('btnList');
  const cardButton = document.getElementById('btnCard');
  const tableView = document.getElementById('tableView');
  const cardView = document.getElementById('cardView');

  function setView(view) {
    const showList = view === 'list';
    listButton.classList.toggle('dang-chon', showList);
    cardButton.classList.toggle('dang-chon', !showList);
    listButton.setAttribute('aria-pressed', String(showList));
    cardButton.setAttribute('aria-pressed', String(!showList));
    tableView.hidden = !showList;
    cardView.hidden = showList;
  }

  listButton.addEventListener('click', () => setView('list'));
  cardButton.addEventListener('click', () => setView('card'));
  setView('list');
}

function initFilters() {
  document.getElementById('deviceSearch').addEventListener('input', renderDevices);
  document.getElementById('filterType').addEventListener('change', renderDevices);
  document.getElementById('filterStatus').addEventListener('change', renderDevices);
  document.getElementById('filterLocation').addEventListener('change', renderDevices);
  document.getElementById('applyDeviceFilters').addEventListener('click', renderDevices);
}

function initTabs() {
  document.querySelectorAll('.muc-the').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.muc-the').forEach(t => t.classList.remove('dang-chon'));
      tab.classList.add('dang-chon');
      activeTabFilter = tab.dataset.filter;
      renderDevices();
    });
  });
}

function initModal() {
  const overlay  = document.getElementById('modalOverlay');
  const btnAdd   = document.getElementById('btnAdd');
  const btnClose = document.getElementById('modalClose');
  const btnCancel = overlay.querySelector('.nut-huy');
  const form = document.getElementById('deviceForm');
  const idInput = document.getElementById('deviceId');
  const purchaseDateInput = document.getElementById('devicePurchaseDate');
  const modalTitle = overlay.querySelector('.dau-hop-thoai h2');
  const saveButton = form.querySelector('.nut-luu');

  function closeModal() {
    overlay.classList.remove('hien-thi');
    overlay.setAttribute('aria-hidden', 'true');
    editingDeviceId = null;
  }

  function openEditModal(device) {
    editingDeviceId = device.id;
    idInput.value = device.id;
    document.getElementById('deviceName').value = device.name;
    document.getElementById('deviceType').value = device.type;
    document.getElementById('deviceLocation').value = device.loc;
    document.getElementById('deviceStatus').value = device.status;
    const [month, year] = device.date.split('/');
    purchaseDateInput.value = `${year}-${month.padStart(2, '0')}`;
    document.getElementById('deviceWarranty').value = device.warranty;
    modalTitle.textContent = 'Chỉnh sửa thiết bị';
    saveButton.textContent = 'Cập nhật';
    overlay.classList.add('hien-thi');
    overlay.setAttribute('aria-hidden', 'false');
    document.getElementById('deviceName').focus();
  }

  function handleDeviceAction(event) {
    const button = event.target.closest('[data-device-action]');
    if (!button) return;
    const device = devices.find(item => item.id === button.dataset.deviceId);
    if (!device) return;

    if (button.dataset.deviceAction === 'edit') {
      openEditModal(device);
    } else if (button.dataset.deviceAction === 'delete' &&
      window.confirm(`Bạn có chắc muốn xóa thiết bị "${device.name}" (${device.id})?`)) {
      devices.splice(devices.indexOf(device), 1);
      savePageData(devices);
      renderStatusCounts();
      renderDevices();
    }
  }

  btnAdd.addEventListener('click', () => {
    form.reset();
    editingDeviceId = null;
    idInput.value = nextDeviceId();
    purchaseDateInput.value = new Date().toISOString().slice(0, 7);
    modalTitle.textContent = 'Thêm thiết bị mới';
    saveButton.textContent = 'Lưu';
    overlay.classList.add('hien-thi');
    overlay.setAttribute('aria-hidden', 'false');
    document.getElementById('deviceName').focus();
  });
  document.getElementById('tableBody').addEventListener('click', handleDeviceAction);
  document.getElementById('cardView').addEventListener('click', handleDeviceAction);
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay.classList.contains('hien-thi')) closeModal();
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const [year, month] = purchaseDateInput.value.split('-');
    const status = document.getElementById('deviceStatus').value;
    const deviceData = {
      name: document.getElementById('deviceName').value.trim(),
      type: document.getElementById('deviceType').value,
      loc: document.getElementById('deviceLocation').value,
      status,
      date: `${month}/${year}`,
      warranty: document.getElementById('deviceWarranty').value
    };

    if (editingDeviceId) {
      const device = devices.find(item => item.id === editingDeviceId);
      if (!device) return;
      Object.assign(device, deviceData);
    } else {
      devices.push({
        id: idInput.value,
        ...deviceData,
        views: 0
      });
    }
    savePageData(devices);
    renderStatusCounts();
    renderDevices();
    form.reset();
    closeModal();
  });
}

function initDevices() {
  renderStatusCounts();
  renderDevices();
  initViewToggle();
  initFilters();
  initTabs();
  initModal();
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
  status.textContent = 'Đang tải dữ liệu thiết bị...';
  try {
    devices = await loadPageData();
    localStorage.setItem('fixflow.unified.devices.dataVersion', '2');
    initDevices();
    initGlobalSearch('#deviceSearch', '');
    status.hidden = true;
  } catch (error) {
    console.error('Không thể khởi tạo trang quản lý thiết bị.', error);
    status.textContent = 'Không thể tải dữ liệu thiết bị. Hãy mở trang qua máy chủ cục bộ và kiểm tra tệp assets/data/devices.json.';
  } finally {
    document.documentElement.dataset.dataReady = 'true';
  }
}

startPage();
