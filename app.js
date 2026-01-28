// 主应用逻辑
'use strict';

// ==================== 全局狀態 ====================
const AppState = {
  currentView: 'calendar',
  currentMonth: new Date(),
  currentFilter: 'all',
  editingItem: null,
  searchQuery: '',
  flatpickrInstances: []
};

// ==================== 工具函数 ====================
const Utils = {
  // 格式化日期
  formatDate(date, format = 'YYYY-MM-DD') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day);
  },

  // 获取月份名称
  getMonthName(date) {
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', 
                    '七月', '八月', '九月', '十月', '十一月', '十二月'];
    return `${date.getFullYear()}年 ${months[date.getMonth()]}`;
  },

  // 获取月份第一天和最后一天
  getMonthBounds(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { firstDay, lastDay };
  },

  // 顯示 Toast 通知
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },

  // 安全設定文本內容（防止 XSS）
  setTextContent(element, text) {
    element.textContent = text;
  },

  // 压缩圖片为 Base64
  async compressImage(file) {
    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(compressedFile);
      });
    } catch (error) {
      console.error('圖片压缩失败:', error);
      throw error;
    }
  }
};

// ==================== 模态框管理 ====================
const Modal = {
  open(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  close(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  init() {
    // 关闭按钮事件
    document.querySelectorAll('[data-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const modalId = btn.getAttribute('data-modal');
        this.close(modalId);
      });
    });

    // 点击背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.close(modal.id);
        }
      });
    });
  }
};

// ==================== 檢視切换 ====================
const ViewManager = {
  switchView(viewName) {
    // 更新狀態
    AppState.currentView = viewName;

    // 更新標籤页
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === viewName);
    });

    // 更新檢視
    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('active', view.id === `${viewName}View`);
    });

    // 刷新对应檢視
    switch (viewName) {
      case 'calendar':
        Calendar.render();
        break;
      case 'work':
        WorkRecordsUI.render();
        break;
      case 'todos':
        TodosUI.render();
        break;
      case 'checks':
        CheckItemsUI.render();
        break;
    }
  },

  init() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.switchView(tab);
      });
    });
  }
};

// ==================== 月曆檢視 ====================
const Calendar = {
  async render() {
    const { firstDay, lastDay } = Utils.getMonthBounds(AppState.currentMonth);
    
    // 更新月份標題
    document.getElementById('currentMonth').textContent = Utils.getMonthName(AppState.currentMonth);

    // 获取本月所有数据
    const startDate = Utils.formatDate(firstDay);
    const endDate = Utils.formatDate(lastDay);
    
    const [workResult, todosResult, checksResult] = await Promise.all([
      WorkRecords.getByDateRange(startDate, endDate),
      Todos.getAll(false),
      CheckItems.getDue(30)
    ]);

    // 构建日期数据映射
    const dateMap = {};
    
    // 工作紀錄
    if (workResult.success) {
      workResult.records.forEach(record => {
        if (!dateMap[record.date]) dateMap[record.date] = { works: [], todos: [], checks: [] };
        dateMap[record.date].works.push(record);
      });
    }

    // 代辦事項
    if (todosResult.success) {
      todosResult.todos.forEach(todo => {
        if (todo.dueDate && !todo.completed) {
          if (!dateMap[todo.dueDate]) dateMap[todo.dueDate] = { works: [], todos: [], checks: [] };
          dateMap[todo.dueDate].todos.push(todo);
        }
      });
    }

    // 核對事項
    if (checksResult.success) {
      checksResult.items.forEach(item => {
        if (!dateMap[item.nextDue]) dateMap[item.nextDue] = { works: [], todos: [], checks: [] };
        dateMap[item.nextDue].checks.push(item);
      });
    }

    // 渲染月曆
    this.renderCalendarGrid(firstDay, lastDay, dateMap);
  },

  renderCalendarGrid(firstDay, lastDay, dateMap) {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';

    // 添加星期標題
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    weekdays.forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-day-header';
      Utils.setTextContent(dayHeader, day);
      calendar.appendChild(dayHeader);
    });

    // 计算第一天是星期几
    const firstDayOfWeek = firstDay.getDay();
    
    // 填充空白
    for (let i = 0; i < firstDayOfWeek; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.className = 'calendar-day empty';
      calendar.appendChild(emptyDay);
    }

    // 填充日期
    const today = Utils.formatDate(new Date());
    const daysInMonth = lastDay.getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
      const dateStr = Utils.formatDate(date);
      const dayData = dateMap[dateStr] || { works: [], todos: [], checks: [] };
      
      const dayElement = document.createElement('div');
      dayElement.className = 'calendar-day';
      
      if (dateStr === today) {
        dayElement.classList.add('today');
      }

      // 日期数字
      const dayNumber = document.createElement('div');
      dayNumber.className = 'day-number';
      Utils.setTextContent(dayNumber, day);
      dayElement.appendChild(dayNumber);

      // 事項指示器
      const indicators = document.createElement('div');
      indicators.className = 'day-indicators';
      
      if (dayData.works.length > 0) {
        const indicator = document.createElement('span');
        indicator.className = 'indicator work';
        indicator.title = `${dayData.works.length} 条工作紀錄`;
        indicators.appendChild(indicator);
      }
      
      if (dayData.todos.length > 0) {
        const indicator = document.createElement('span');
        indicator.className = 'indicator todo';
        indicator.title = `${dayData.todos.length} 个代辦事項`;
        indicators.appendChild(indicator);
      }
      
      if (dayData.checks.length > 0) {
        const indicator = document.createElement('span');
        indicator.className = 'indicator check';
        indicator.title = `${dayData.checks.length} 个核對事項`;
        indicators.appendChild(indicator);
      }

      dayElement.appendChild(indicators);

      // 点击事件
      dayElement.addEventListener('click', () => {
        this.showDayDetails(dateStr, dayData);
      });

      calendar.appendChild(dayElement);
    }
  },

  showDayDetails(date, data) {
    const details = document.getElementById('dayDetails');
    details.innerHTML = '';
    details.classList.remove('hidden');

    // 標題
    const header = document.createElement('div');
    header.className = 'day-details-header';
    const title = document.createElement('h3');
    Utils.setTextContent(title, date);
    header.appendChild(title);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-close';
    Utils.setTextContent(closeBtn, '×');
    closeBtn.addEventListener('click', () => {
      details.classList.add('hidden');
    });
    header.appendChild(closeBtn);
    details.appendChild(header);

    // 內容
    const content = document.createElement('div');
    content.className = 'day-details-content';

    if (data.works.length === 0 && data.todos.length === 0 && data.checks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-message';
      Utils.setTextContent(empty, '当日无事項');
      content.appendChild(empty);
    } else {
      if (data.works.length > 0) {
        const section = document.createElement('div');
        section.className = 'detail-section';
        const sectionTitle = document.createElement('h4');
        Utils.setTextContent(sectionTitle, '工作紀錄');
        section.appendChild(sectionTitle);
        data.works.forEach(work => {
          const item = document.createElement('div');
          item.className = 'detail-item';
          Utils.setTextContent(item, work.content.substring(0, 100) + (work.content.length > 100 ? '...' : ''));
          section.appendChild(item);
        });
        content.appendChild(section);
      }

      if (data.todos.length > 0) {
        const section = document.createElement('div');
        section.className = 'detail-section';
        const sectionTitle = document.createElement('h4');
        Utils.setTextContent(sectionTitle, '代辦事項');
        section.appendChild(sectionTitle);
        data.todos.forEach(todo => {
          const item = document.createElement('div');
          item.className = 'detail-item';
          Utils.setTextContent(item, `[${todo.priority.toUpperCase()}] ${todo.title}`);
          section.appendChild(item);
        });
        content.appendChild(section);
      }

      if (data.checks.length > 0) {
        const section = document.createElement('div');
        section.className = 'detail-section';
        const sectionTitle = document.createElement('h4');
        Utils.setTextContent(sectionTitle, '核對事項');
        section.appendChild(sectionTitle);
        data.checks.forEach(check => {
          const item = document.createElement('div');
          item.className = 'detail-item';
          Utils.setTextContent(item, `${check.title} (${check.user})`);
          section.appendChild(item);
        });
        content.appendChild(section);
      }
    }

    details.appendChild(content);
  },

  init() {
    document.getElementById('prevMonth').addEventListener('click', () => {
      AppState.currentMonth.setMonth(AppState.currentMonth.getMonth() - 1);
      this.render();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
      AppState.currentMonth.setMonth(AppState.currentMonth.getMonth() + 1);
      this.render();
    });

    this.render();
  }
};

// ==================== 工作紀錄UI ====================
const WorkRecordsUI = {
  async render() {
    const result = await WorkRecords.getAll();
    const list = document.getElementById('workList');
    list.innerHTML = '';

    if (!result.success || result.records.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      Utils.setTextContent(empty, '暂无工作紀錄');
      list.appendChild(empty);
      return;
    }

    result.records.forEach(record => {
      const item = this.createWorkItem(record);
      list.appendChild(item);
    });
  },

  createWorkItem(record) {
    const item = document.createElement('div');
    item.className = 'work-item';

    // 日期
    const date = document.createElement('div');
    date.className = 'item-date';
    Utils.setTextContent(date, record.date);
    item.appendChild(date);

    // 內容
    const content = document.createElement('div');
    content.className = 'item-content';
    Utils.setTextContent(content, record.content);
    item.appendChild(content);

    // 標籤
    if (record.tags && record.tags.length > 0) {
      const tags = document.createElement('div');
      tags.className = 'item-tags';
      record.tags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        Utils.setTextContent(tagEl, tag);
        tags.appendChild(tagEl);
      });
      item.appendChild(tags);
    }

    // 圖片
    if (record.images && record.images.length > 0) {
      const images = document.createElement('div');
      images.className = 'item-images';
      record.images.forEach(img => {
        const imgEl = document.createElement('img');
        imgEl.src = img;
        imgEl.alt = '工作圖片';
        images.appendChild(imgEl);
      });
      item.appendChild(images);
    }

    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.innerHTML = '✎';
    editBtn.addEventListener('click', () => this.edit(record));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-danger';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', () => this.delete(record.id));
    actions.appendChild(deleteBtn);

    item.appendChild(actions);

    return item;
  },

  async edit(record) {
    AppState.editingItem = record;
    document.getElementById('workModalTitle').textContent = '編輯工作紀錄';
    document.getElementById('workId').value = record.id;
    document.getElementById('workDate').value = record.date;
    document.getElementById('workContent').value = record.content;
    document.getElementById('workTags').value = record.tags ? record.tags.join(', ') : '';
    
    // 顯示现有圖片
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    if (record.images && record.images.length > 0) {
      record.images.forEach((img, index) => {
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'preview-image';
        const imgEl = document.createElement('img');
        imgEl.src = img;
        imgWrapper.appendChild(imgEl);
        preview.appendChild(imgWrapper);
      });
    }

    Modal.open('workModal');
  },

  async delete(id) {
    if (!confirm('确定要刪除这条工作紀錄吗？')) return;
    
    const result = await WorkRecords.delete(id);
    if (result.success) {
      Utils.showToast('刪除成功', 'success');
      this.render();
    } else {
      Utils.showToast('刪除失败', 'error');
    }
  },

  init() {
    document.getElementById('addWorkBtn').addEventListener('click', () => {
      AppState.editingItem = null;
      document.getElementById('workModalTitle').textContent = '新增工作紀錄';
      document.getElementById('workForm').reset();
      document.getElementById('workId').value = '';
      document.getElementById('imagePreview').innerHTML = '';
      document.getElementById('workDate').value = Utils.formatDate(new Date());
      Modal.open('workModal');
    });

    document.getElementById('workForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.save();
    });

    // 圖片预览
    document.getElementById('workImages').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      const preview = document.getElementById('imagePreview');
      preview.innerHTML = '';

      for (const file of files) {
        try {
          const base64 = await Utils.compressImage(file);
          const imgWrapper = document.createElement('div');
          imgWrapper.className = 'preview-image';
          const img = document.createElement('img');
          img.src = base64;
          imgWrapper.appendChild(img);
          preview.appendChild(imgWrapper);
        } catch (error) {
          Utils.showToast('圖片处理失败', 'error');
        }
      }
    });
  },

  async save() {
    const id = document.getElementById('workId').value;
    const date = document.getElementById('workDate').value;
    const content = document.getElementById('workContent').value;
    const tagsInput = document.getElementById('workTags').value;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    // 获取圖片
    const images = [];
    document.querySelectorAll('#imagePreview img').forEach(img => {
      images.push(img.src);
    });

    const data = { date, content, tags, images };

    let result;
    if (id) {
      result = await WorkRecords.update(parseInt(id), data);
    } else {
      result = await WorkRecords.create(data);
    }

    if (result.success) {
      Utils.showToast(id ? '更新成功' : '创建成功', 'success');
      Modal.close('workModal');
      this.render();
      Calendar.render();
    } else {
      Utils.showToast('儲存失败', 'error');
    }
  }
};

// ==================== 代辦事項UI ====================
const TodosUI = {
  sortable: null,

  async render(filter = AppState.currentFilter) {
    AppState.currentFilter = filter;
    const result = await Todos.getAll(filter !== 'active');
    const list = document.getElementById('todoList');
    list.innerHTML = '';

    if (!result.success) {
      Utils.showToast('加载失败', 'error');
      return;
    }

    let todos = result.todos;

    // 过滤
    switch (filter) {
      case 'active':
        todos = todos.filter(t => !t.completed);
        break;
      case 'completed':
        todos = todos.filter(t => t.completed);
        break;
      case 'high':
        todos = todos.filter(t => t.priority === 'high' && !t.completed);
        break;
    }

    if (todos.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      Utils.setTextContent(empty, '暂无代辦事項');
      list.appendChild(empty);
      return;
    }

    todos.forEach(todo => {
      const item = this.createTodoItem(todo);
      list.appendChild(item);
    });

    // 初始化拖放排序
    if (filter === 'all' || filter === 'active') {
      this.initSortable();
    }
  },

  createTodoItem(todo) {
    const item = document.createElement('div');
    item.className = `todo-item priority-${todo.priority}`;
    item.dataset.id = todo.id;
    if (todo.completed) item.classList.add('completed');

    // 复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => this.toggleComplete(todo.id));
    item.appendChild(checkbox);

    // 內容
    const content = document.createElement('div');
    content.className = 'todo-content';
    
    const title = document.createElement('div');
    title.className = 'todo-title';
    Utils.setTextContent(title, todo.title);
    content.appendChild(title);

    if (todo.dueDate) {
      const due = document.createElement('div');
      due.className = 'todo-due';
      Utils.setTextContent(due, `截止: ${todo.dueDate}`);
      content.appendChild(due);
    }

    item.appendChild(content);

    // 優先級標籤
    const priority = document.createElement('span');
    priority.className = `priority-badge priority-${todo.priority}`;
    const priorityText = { low: '低', medium: '中', high: '高' };
    Utils.setTextContent(priority, priorityText[todo.priority]);
    item.appendChild(priority);

    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.innerHTML = '✎';
    editBtn.addEventListener('click', () => this.edit(todo));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-danger';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', () => this.delete(todo.id));
    actions.appendChild(deleteBtn);

    item.appendChild(actions);

    return item;
  },

  async toggleComplete(id) {
    const result = await Todos.toggleComplete(id);
    if (result.success) {
      this.render();
      Calendar.render();
    }
  },

  async edit(todo) {
    AppState.editingItem = todo;
    document.getElementById('todoModalTitle').textContent = '編輯代辦事項';
    document.getElementById('todoId').value = todo.id;
    document.getElementById('todoTitle').value = todo.title;
    document.getElementById('todoPriority').value = todo.priority;
    document.getElementById('todoDueDate').value = todo.dueDate || '';
    Modal.open('todoModal');
  },

  async delete(id) {
    if (!confirm('确定要刪除这个代辦事項吗？')) return;
    
    const result = await Todos.delete(id);
    if (result.success) {
      Utils.showToast('刪除成功', 'success');
      this.render();
      Calendar.render();
    } else {
      Utils.showToast('刪除失败', 'error');
    }
  },

  initSortable() {
    const list = document.getElementById('todoList');
    if (this.sortable) {
      this.sortable.destroy();
    }
    this.sortable = new Sortable(list, {
      animation: 150,
      handle: '.todo-item',
      onEnd: async (evt) => {
        const items = Array.from(list.children);
        const orderMap = {};
        items.forEach((item, index) => {
          const id = item.dataset.id;
          if (id) orderMap[id] = index;
        });
        await Todos.batchUpdateOrder(orderMap);
      }
    });
  },

  init() {
    document.getElementById('addTodoBtn').addEventListener('click', () => {
      AppState.editingItem = null;
      document.getElementById('todoModalTitle').textContent = '新增代辦事項';
      document.getElementById('todoForm').reset();
      document.getElementById('todoId').value = '';
      Modal.open('todoModal');
    });

    document.getElementById('todoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.save();
    });

    // 过滤器
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        this.render(filter);
      });
    });
  },

  async save() {
    const id = document.getElementById('todoId').value;
    const title = document.getElementById('todoTitle').value;
    const priority = document.getElementById('todoPriority').value;
    const dueDate = document.getElementById('todoDueDate').value || null;

    const data = { title, priority, dueDate };

    let result;
    if (id) {
      result = await Todos.update(parseInt(id), data);
    } else {
      result = await Todos.create(data);
    }

    if (result.success) {
      Utils.showToast(id ? '更新成功' : '创建成功', 'success');
      Modal.close('todoModal');
      this.render();
      Calendar.render();
    } else {
      Utils.showToast('儲存失败', 'error');
    }
  }
};

// ==================== 核對事項UI ====================
const CheckItemsUI = {
  async render() {
    const result = await CheckItems.getAll();
    const list = document.getElementById('checkList');
    list.innerHTML = '';

    if (!result.success || result.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      Utils.setTextContent(empty, '暂无核對事項');
      list.appendChild(empty);
      return;
    }

    result.items.forEach(item => {
      const el = this.createCheckItem(item);
      list.appendChild(el);
    });
  },

  createCheckItem(item) {
    const el = document.createElement('div');
    el.className = 'check-item';

    const today = Utils.formatDate(new Date());
    if (item.nextDue <= today) {
      el.classList.add('overdue');
    }

    // 內容
    const content = document.createElement('div');
    content.className = 'check-content';
    
    const title = document.createElement('div');
    title.className = 'check-title';
    Utils.setTextContent(title, item.title);
    content.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'check-meta';
    const periodText = { daily: '日', weekly: '周', monthly: '月' };
    Utils.setTextContent(meta, `${item.user} · 每${item.periodValue}${periodText[item.periodType]} · 下次: ${item.nextDue}`);
    content.appendChild(meta);

    el.appendChild(content);

    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    
    const checkBtn = document.createElement('button');
    checkBtn.className = 'btn-primary btn-sm';
    Utils.setTextContent(checkBtn, '已核對');
    checkBtn.addEventListener('click', () => this.markChecked(item.id));
    actions.appendChild(checkBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.innerHTML = '✎';
    editBtn.addEventListener('click', () => this.edit(item));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-danger';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', () => this.delete(item.id));
    actions.appendChild(deleteBtn);

    el.appendChild(actions);

    return el;
  },

  async markChecked(id) {
    const result = await CheckItems.markChecked(id);
    if (result.success) {
      Utils.showToast('已标记为核對完成', 'success');
      this.render();
      Calendar.render();
    } else {
      Utils.showToast('操作失败', 'error');
    }
  },

  async edit(item) {
    AppState.editingItem = item;
    document.getElementById('checkModalTitle').textContent = '編輯核對事項';
    document.getElementById('checkId').value = item.id;
    document.getElementById('checkTitle').value = item.title;
    document.getElementById('checkUser').value = item.user;
    document.getElementById('checkPeriodValue').value = item.periodValue;
    document.getElementById('checkPeriodType').value = item.periodType;
    Modal.open('checkModal');
  },

  async delete(id) {
    if (!confirm('确定要刪除这个核對事項吗？')) return;
    
    const result = await CheckItems.delete(id);
    if (result.success) {
      Utils.showToast('刪除成功', 'success');
      this.render();
      Calendar.render();
    } else {
      Utils.showToast('刪除失败', 'error');
    }
  },

  init() {
    document.getElementById('addCheckBtn').addEventListener('click', () => {
      AppState.editingItem = null;
      document.getElementById('checkModalTitle').textContent = '新增核對事項';
      document.getElementById('checkForm').reset();
      document.getElementById('checkId').value = '';
      Modal.open('checkModal');
    });

    document.getElementById('checkForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.save();
    });
  },

  async save() {
    const id = document.getElementById('checkId').value;
    const title = document.getElementById('checkTitle').value;
    const user = document.getElementById('checkUser').value;
    const periodValue = parseInt(document.getElementById('checkPeriodValue').value);
    const periodType = document.getElementById('checkPeriodType').value;

    const data = { title, user, periodValue, periodType };

    let result;
    if (id) {
      result = await CheckItems.update(parseInt(id), data);
    } else {
      result = await CheckItems.create(data);
    }

    if (result.success) {
      Utils.showToast(id ? '更新成功' : '创建成功', 'success');
      Modal.close('checkModal');
      this.render();
      Calendar.render();
    } else {
      Utils.showToast('儲存失败', 'error');
    }
  }
};

// ==================== 搜尋功能 ====================
const Search = {
  async search(query) {
    if (!query.trim()) return;

    const result = await WorkRecords.search(query);
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';

    if (!result.success || result.records.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      Utils.setTextContent(empty, '无搜尋结果');
      resultsDiv.appendChild(empty);
      return;
    }

    result.records.forEach(record => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      
      const date = document.createElement('div');
      date.className = 'result-date';
      Utils.setTextContent(date, record.date);
      item.appendChild(date);

      const content = document.createElement('div');
      content.className = 'result-content';
      Utils.setTextContent(content, record.content.substring(0, 150) + (record.content.length > 150 ? '...' : ''));
      item.appendChild(content);

      item.addEventListener('click', () => {
        Modal.close('searchModal');
        ViewManager.switchView('work');
      });

      resultsDiv.appendChild(item);
    });
  },

  init() {
    document.getElementById('searchBtn').addEventListener('click', () => {
      Modal.open('searchModal');
      document.getElementById('searchInput').focus();
    });

    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.search(e.target.value);
      }, 300);
    });
  }
};

// ==================== PDF匯出功能 ====================
const PDFExport = {
  async export(type) {
    Utils.showToast('正在生成PDF...', 'info');

    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      let element;
      let title = '';

      switch (type) {
        case 'all':
          title = '全部数据匯出';
          // 匯出所有內容需要分别截图拼接
          await this.exportAll(pdf);
          break;
        case 'calendar':
          title = '月曆檢視';
          element = document.getElementById('calendarView');
          break;
        case 'work':
          title = '工作紀錄';
          element = document.getElementById('workList');
          break;
        case 'todos':
          title = '代辦事項';
          element = document.getElementById('todoList');
          break;
        case 'checks':
          title = '核對事項';
          element = document.getElementById('checkList');
          break;
      }

      if (element) {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false
        });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 190;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.text(title, 105, 10, { align: 'center' });
        pdf.addImage(imgData, 'PNG', 10, 20, imgWidth, imgHeight);
      }

      const filename = `${title}_${Utils.formatDate(new Date())}.pdf`;
      pdf.save(filename);
      
      Utils.showToast('PDF匯出成功', 'success');
      Modal.close('exportModal');
    } catch (error) {
      console.error('PDF匯出失败:', error);
      Utils.showToast('PDF匯出失败', 'error');
    }
  },

  async exportAll(pdf) {
    // 匯出所有檢視（简化版本，实际需要更复杂的处理）
    const views = ['calendar', 'work', 'todos', 'checks'];
    const titles = ['月曆檢視', '工作紀錄', '代辦事項', '核對事項'];
    
    for (let i = 0; i < views.length; i++) {
      if (i > 0) pdf.addPage();
      
      const element = document.getElementById(`${views[i]}${views[i] === 'calendar' ? 'View' : 'List'}`);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.text(titles[i], 105, 10, { align: 'center' });
      pdf.addImage(imgData, 'PNG', 10, 20, imgWidth, Math.min(imgHeight, 270));
    }
  },

  init() {
    document.getElementById('exportBtn').addEventListener('click', () => {
      Modal.open('exportModal');
    });

    document.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-export');
        this.export(type);
      });
    });
  }
};

// ==================== Flatpickr 初始化 ====================
function initDatePickers() {
  const dateInputs = document.querySelectorAll('.datepicker');
  dateInputs.forEach(input => {
    const instance = flatpickr(input, {
      dateFormat: 'Y-m-d',
      locale: 'zh'
    });
    AppState.flatpickrInstances.push(instance);
  });
}

// ==================== Service Worker 注册 ====================
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js');
      console.log('Service Worker 注册成功:', registration.scope);

      // 监听更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (confirm('发现新版本，是否立即更新？')) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          }
        });
      });
    } catch (error) {
      console.error('Service Worker 注册失败:', error);
    }
  }
}

// ==================== 应用初始化 ====================
async function initApp() {
  console.log('应用初始化中...');

  // 注册 Service Worker
  await registerServiceWorker();

  // 初始化日期選擇器
  initDatePickers();

  // 初始化各模块
  Modal.init();
  ViewManager.init();
  Calendar.init();
  WorkRecordsUI.init();
  TodosUI.init();
  CheckItemsUI.init();
  Search.init();
  PDFExport.init();

  // 預設顯示月曆檢視
  ViewManager.switchView('calendar');

  console.log('应用初始化完成');
}

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
