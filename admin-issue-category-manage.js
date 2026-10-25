async function loadPageData() {
  const key = 'fixflow.unified.categories';
  const stored = localStorage.getItem(key) ??
    localStorage.getItem('fixflow.categories') ??
    localStorage.getItem('fixflow.page27.categories');
  if (stored !== null) {
    try {
      let value = JSON.parse(stored);
      if (!Array.isArray(value)) throw new Error('Dữ liệu danh mục đã lưu không hợp lệ.');
      const version = localStorage.getItem(`${key}.dataVersion`) ??
        localStorage.getItem('fixflow.categories.dataVersion') ??
        localStorage.getItem('fixflow.page27.dataVersion');
      if (version === null && value.length === 6 &&
          value.every((category, index) => category.id === index + 1)) {
        const defaults = await fetchDefaultCategories();
        value = [...value, ...defaults.slice(6)];
      }
      savePageData(value);
      return value;
    } catch (error) {
      console.error('Không thể đọc dữ liệu danh mục đã lưu.', error);
      throw error;
    }
  }
  const value = await fetchDefaultCategories();
  savePageData(value);
  return value;
}

async function fetchDefaultCategories() {
  const response = await fetch('assets/data/issue-categories.json');
  if (!response.ok) throw new Error(`Không tải được dữ liệu danh mục (HTTP ${response.status}).`);
  const value = await response.json();
  if (!Array.isArray(value)) throw new Error('Tệp dữ liệu danh mục không đúng định dạng.');
  return value;
}

function savePageData(value) {
  localStorage.setItem('fixflow.unified.categories', JSON.stringify(value));
  localStorage.setItem('fixflow.unified.categories.dataVersion', '1');
}

function initCategories(categories) {
  initializeCategories(document.querySelector('.man-hinh-trang27'), categories);
}

function initializeCategories(screen, categories) {
  if (!screen) return;
  const workspace = screen.querySelector('.khu-vuc-danh-muc');
  const tree = screen.querySelector('#categoryTree');
  const search = screen.querySelector('#categorySearch');
  const emptyMessage = screen.querySelector('#categoryEmpty');
  const total = screen.querySelector('#categoryTotal');
  const summary = screen.querySelector('#categoryPageSummary');
  const editorPanel = screen.querySelector('.danh-muc-chinh-sua-bang-dieu-khien');
  const createPanel = screen.querySelector('.danh-muc-tao-bang-dieu-khien');
  const editForm = screen.querySelector('#categoryEditForm');
  const createForm = screen.querySelector('#categoryCreateForm');
  const editParent = screen.querySelector('#editCategoryParent');
  const createParent = createForm.elements.parentId;
  const editFeedback = screen.querySelector('#editCategoryFeedback');
  const createFeedback = screen.querySelector('#createCategoryFeedback');
  const selectedCategoryCount = screen.querySelector('#categoryTicketCount');
  const classifierForm = screen.querySelector('#ticketClassifierForm');
  const classifierMode = screen.querySelector('#categoryAiMode');
  const classifierResult = screen.querySelector('#categoryClassificationResult');
  let selectedId = categories.find(category => category.status === 'active')?.id ?? categories[0]?.id ?? null;

  const getCategory = id => categories.find(category => String(category.id) === String(id));
  const getChildren = id => categories.filter(category => String(category.parentId) === String(id));
  const getDescendantIds = id => {
    const descendants = new Set([String(id)]);
    let changed = true;
    while (changed) {
      changed = false;
      categories.forEach(category => {
        if (descendants.has(String(category.parentId)) && !descendants.has(String(category.id))) {
          descendants.add(String(category.id));
          changed = true;
        }
      });
    }
    return descendants;
  };
  const syncWorkspace = () => {
    workspace.classList.toggle('dang-chinh-sua', !editorPanel.hidden);
    workspace.classList.toggle('dang-tao', !createPanel.hidden);
  };
  const refreshParentOptions = (select, excludedIds) => {
    const previousValue = select.value;
    select.replaceChildren();
    const noParent = document.createElement('option');
    noParent.value = '';
    noParent.textContent = 'Không có';
    select.appendChild(noParent);
    categories.filter(category => !excludedIds?.has(String(category.id))).forEach(category => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === previousValue)) select.value = previousValue;
  };
  const renderTree = () => {
    const query = search.value.trim().toLocaleLowerCase('vi');
    tree.replaceChildren();
    const roots = categories.filter(category => !getCategory(category.parentId));
    let visibleCount = 0;
    roots.forEach(category => {
      const children = getChildren(category.id);
      const matchesRoot = !query || category.name.toLocaleLowerCase('vi').includes(query);
      const matchingChildren = children.filter(child =>
        !query || child.name.toLocaleLowerCase('vi').includes(query) || matchesRoot
      );
      if (!matchesRoot && matchingChildren.length === 0) return;
      visibleCount += 1 + matchingChildren.length;
      const group = document.createElement('div');
      group.className = 'nhom-danh-muc';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `muc-cay-danh-muc${String(selectedId) === String(category.id) ? ' dang-chon' : ''}`;
      button.dataset.categoryId = category.id;
      const icon = document.createElement('span');
      icon.className = 'bieu-tuong-danh-muc';
      icon.textContent = category.icon || '◇';
      const name = document.createElement('span');
      name.className = 'ten-danh-muc';
      name.textContent = category.name;
      const count = document.createElement('span');
      count.className = 'so-luong-danh-muc';
      count.textContent = category.tickets || 0;
      const arrow = document.createElement('span');
      arrow.className = 'mui-ten-danh-muc';
      arrow.textContent = '⌄';
      button.append(icon, name, count, arrow);
      group.appendChild(button);
      matchingChildren.forEach(child => {
        const childButton = document.createElement('button');
        childButton.type = 'button';
        childButton.className = `muc-con-danh-muc${String(selectedId) === String(child.id) ? ' dang-chon' : ''}`;
        childButton.dataset.categoryId = child.id;
        const childName = document.createElement('span');
        childName.textContent = child.name;
        const childCount = document.createElement('span');
        childCount.textContent = child.tickets || 0;
        childButton.append(childName, childCount);
        group.appendChild(childButton);
      });
      tree.appendChild(group);
    });
    if (query && visibleCount === 0) {
      categories.filter(category => getCategory(category.parentId) && category.name.toLocaleLowerCase('vi').includes(query))
        .forEach(child => {
          visibleCount += 1;
          const childButton = document.createElement('button');
          childButton.type = 'button';
          childButton.className = `muc-con-danh-muc${String(selectedId) === String(child.id) ? ' dang-chon' : ''}`;
          childButton.dataset.categoryId = child.id;
          const childName = document.createElement('span');
          childName.textContent = child.name;
          const childCount = document.createElement('span');
          childCount.textContent = child.tickets || 0;
          childButton.append(childName, childCount);
          tree.appendChild(childButton);
        });
    }
    emptyMessage.hidden = visibleCount > 0;
  };
  const renderEditor = () => {
    const category = getCategory(selectedId);
    if (!category) {
      editorPanel.hidden = true;
      syncWorkspace();
      return;
    }
    editForm.elements.name.value = category.name;
    editForm.elements.description.value = category.description || '';
    editForm.elements.icon.value = category.icon || '◇';
    editForm.elements.color.value = category.color || '#2563eb';
    editForm.elements.autoClassify.checked = category.autoClassify !== false;
    selectedCategoryCount.textContent = category.tickets || 0;
    refreshParentOptions(editParent, getDescendantIds(category.id));
    editParent.value = category.parentId ?? '';
    editFeedback.textContent = '';
    renderTree();
    syncWorkspace();
  };
  const refresh = () => {
    total.textContent = categories.length;
    summary.textContent = `${categories.length} danh mục để phân loại và xử lý ticket nhất quán.`;
    refreshParentOptions(createParent);
    renderEditor();
    classifierMode.textContent = `${categories.filter(category => category.status === 'active' && category.autoClassify !== false).length} danh mục đang bật phân loại tự động.`;
  };
  const persist = () => {
    savePageData(categories);
    refresh();
  };

  screen.querySelector('#addCategory').addEventListener('click', () => {
    editorPanel.hidden = true;
    createPanel.hidden = false;
    createForm.reset();
    createFeedback.textContent = '';
    syncWorkspace();
    createForm.elements.name.focus();
  });
  screen.querySelector('#closeCategoryCreate').addEventListener('click', () => {
    createPanel.hidden = true;
    syncWorkspace();
  });
  search.addEventListener('input', renderTree);
  tree.addEventListener('click', event => {
    const button = event.target.closest('[data-category-id]');
    if (!button) return;
    createPanel.hidden = true;
    editorPanel.hidden = false;
    selectedId = button.dataset.categoryId;
    renderEditor();
  });

  
  editForm.addEventListener('submit', event => {
    event.preventDefault();
    const category = getCategory(selectedId);
    if (!category) return;
    const name = editForm.elements.name.value.trim();
    if (categories.some(item => item.id !== category.id && item.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))) {
      editFeedback.textContent = 'Tên danh mục này đã tồn tại.';
      editFeedback.style.color = '#c43e4c';
      return;
    }
    category.name = name;
    category.description = editForm.elements.description.value.trim();
    category.icon = editForm.elements.icon.value;
    category.color = editForm.elements.color.value;
    category.autoClassify = editForm.elements.autoClassify.checked;
    category.parentId = editParent.value ? Number(editParent.value) : null;
    persist();
    editFeedback.textContent = 'Đã lưu thay đổi.';
    editorPanel.hidden = true;
    syncWorkspace();
  });
  screen.querySelector('#deleteCategory').addEventListener('click', () => {
    const category = getCategory(selectedId);
    if (!category || !window.confirm(`Xóa danh mục "${category.name}" và các danh mục con?`)) return;
    const removeIds = getDescendantIds(category.id);
    for (let index = categories.length - 1; index >= 0; index -= 1) {
      if (removeIds.has(String(categories[index].id))) categories.splice(index, 1);
    }
    selectedId = categories.find(item => item.status === 'active')?.id ?? categories[0]?.id ?? null;
    persist();
  });
  createForm.addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(createForm);
    const name = String(values.get('name')).trim();
    if (categories.some(category => category.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))) {
      createFeedback.textContent = 'Tên danh mục này đã tồn tại.';
      createFeedback.style.color = '#c43e4c';
      return;
    }
    const category = {
      id: Math.max(0, ...categories.map(item => Number(item.id) || 0)) + 1,
      name,
      code: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 12),
      description: String(values.get('description')).trim(),
      tickets: 0,
      status: 'active',
      icon: String(values.get('icon')),
      color: String(values.get('color')),
      autoClassify: true,
      parentId: values.get('parentId') ? Number(values.get('parentId')) : null
    };
    categories.push(category);
    selectedId = category.id;
    persist();
    createForm.reset();
    createPanel.hidden = true;
    syncWorkspace();
  });


  classifierForm.addEventListener('submit', event => {
    event.preventDefault();
    const description = screen.querySelector('#ticketClassifierText').value.trim().toLocaleLowerCase('vi');
    const candidates = categories.filter(category => category.status === 'active' && category.autoClassify !== false);
    const best = candidates.map(category => {
      const terms = `${category.name} ${category.description || ''}`.toLocaleLowerCase('vi')
        .split(/[^\p{L}\p{N}]+/u).filter(term => term.length > 2);
      return { category, score: terms.reduce((score, term) => score + (description.includes(term) ? term.length : 0), 0) };
    }).sort((a, b) => b.score - a.score)[0];
    classifierResult.hidden = false;
    classifierResult.textContent = best?.score
      ? `Danh mục gợi ý: ${best.category.name}`
      : 'Chưa tìm thấy danh mục phù hợp. Hãy bổ sung mô tả hoặc tạo danh mục mới.';
  });
  refresh();
  syncWorkspace();
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
  status.textContent = 'Đang tải dữ liệu danh mục...';
  try {
    const categories = await loadPageData();
    localStorage.setItem('fixflow.unified.categories.dataVersion', '1');
    initCategories(categories);
    initGlobalSearch('#categorySearch', '');
    status.hidden = true;
  } catch (error) {
    console.error('Không thể khởi tạo trang quản lý danh mục.', error);
    status.textContent = 'Không thể tải dữ liệu danh mục. Hãy mở trang qua máy chủ cục bộ và kiểm tra tệp assets/data/issue-categories.json.';
  } finally {
    document.documentElement.dataset.dataReady = 'true';
  }
}

startPage();
