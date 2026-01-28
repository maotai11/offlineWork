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
      maxSizeMB: 2,              // 提高到 2MB
      maxWidthOrHeight: 2048,    // 提高到 2048px
      useWebWorker: true,        // 使用 Web Worker 提升效能
      quality: 0.9,              // 高品質 90%
      initialQuality: 0.9        // 初始品質 90%
    }
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
    const year = AppState.currentYear;
    const month = AppState.currentMonth;

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', 
                        '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('currentMonth').textContent = 
      `${year}年 ${monthNames[month]}`;

    // 取得所有資料
    const workResult = await db.getWorkRecordsByMonth(year, month);
    const todoResult = await db.getTodosByMonth(year, month);
    const checkResult = await db.getCheckItemsByMonth(year, month);

    const dateMap = {};

    // 工作紀錄
    if (workResult.success) {
      workResult.records.forEach(record => {
        const date = record.date;
        if (!dateMap[date]) {
          dateMap[date] = { works: [], todos: [], checks: [] };
        }
        dateMap[date].works.push(record);
      });
    }

    // 代辦事項（使用截止日）
    if (todoResult.success) {
      todoResult.todos.forEach(todo => {
        if (todo.dueDate) {
          const date = todo.dueDate;
          if (!dateMap[date]) {
            dateMap[date] = { works: [], todos: [], checks: [] };
          }
          dateMap[date].todos.push(todo);
        }
      });
    }

    // 核對清單（使用下次到期日）
    if (checkResult.success) {
      checkResult.items.forEach(item => {
        if (item.nextDue) {
          const date = item.nextDue;
          if (!dateMap[date]) {
            dateMap[date] = { works: [], todos: [], checks: [] };
          }
          dateMap[date].checks.push(item);
        }
      });
    }

    const firstDay = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    // 渲染月曆
    this.renderCalendarGrid(firstDay, lastDay, dateMap);
  },

  renderCalendarGrid(firstDay, lastDay, dateMap) {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';

    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    dayNames.forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-day-header';
      dayHeader.textContent = day;
      calendar.appendChild(dayHeader);
    });

    // 空白日期
    for (let i = 0; i < firstDay; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.className = 'calendar-day empty';
      calendar.appendChild(emptyDay);
    }

    // 填充日期
    const year = AppState.currentYear;
    const month = AppState.currentMonth;

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const data = dateMap[dateStr] || { works: [], todos: [], checks: [] };

      const dayElement = document.createElement('div');
      dayElement.className = 'calendar-day';
      dayElement.dataset.date = dateStr;

      // 日期數字
      const dateNum = document.createElement('div');
      dateNum.className = 'date-number';
      dateNum.textContent = day;
      dayElement.appendChild(dateNum);

      // 事件標記容器
      const indicators = document.createElement('div');
      indicators.className = 'event-indicators';
      indicators.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;';

      // 工作紀錄標記（藍色）
      if (data.works.length > 0) {
        const indicator = document.createElement('span');
        indicator.className = 'indicator work';
        indicator.style.cssText = 'background: #3b82f6; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px;';
        indicator.title = `${data.works.length} 個工作紀錄`;
        indicator.textContent = `📋${data.works.length}`;
        indicators.appendChild(indicator);
      }

      // 代辦事項標記（橙色）
      if (data.todos.length > 0) {
        const indicator = document.createElement('span');
        indicator.className = 'indicator todo';
        indicator.style.cssText = 'background: #f97316; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px;';
        indicator.title = `${data.todos.length} 個代辦事項`;
        indicator.textContent = `✓${data.todos.length}`;
        indicators.appendChild(indicator);
      }

      // 核對清單標記（綠色）
      if (data.checks.length > 0) {
        const indicator = document.createElement('span');
        indicator.className = 'indicator check';
        indicator.style.cssText = 'background: #10b981; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px;';
        indicator.title = `${data.checks.length} 個核對事項`;
        indicator.textContent = `☑${data.checks.length}`;
        indicators.appendChild(indicator);
      }

      dayElement.appendChild(indicators);

      // 點擊事件
      dayElement.addEventListener('click', () => {
        this.showDateDetails(dateStr, data);
      });

      // 今天標記
      const today = new Date();
      if (year === today.getFullYear() && 
          month === today.getMonth() && 
          day === today.getDate()) {
        dayElement.classList.add('today');
        dayElement.style.background = '#fef3c7';
      }

      calendar.appendChild(dayElement);
    }
  },

  showDateDetails(date, data) {
    if (!data || (data.works.length === 0 && data.todos.length === 0 && data.checks.length === 0)) {
      Utils.showToast('此日期沒有任何事項');
      return;
    }

    // 建立詳情彈窗
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;';

    let content = `
      <div class="modal-content" style="max-width: 600px; background: white; border-radius: 8px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
        <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">${date} 的事項</h3>
          <button class="close-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px; overflow-y: auto;">
    `;

    // 工作紀錄
    if (data.works.length > 0) {
      content += '<h4 style="color: #3b82f6; margin-top: 0;">📋 工作紀錄</h4>';
      data.works.forEach(work => {
        content += `
          <div style="padding: 12px; margin: 8px 0; border-left: 3px solid #3b82f6; background: #eff6ff; border-radius: 4px;">
            <strong>${work.content}</strong>
            ${work.tags ? `<div style="font-size: 0.9em; color: #666; margin-top: 4px;">${work.tags}</div>` : ''}
          </div>
        `;
      });
    }

    // 代辦事項
    if (data.todos.length > 0) {
      content += '<h4 style="color: #f97316; margin-top: 16px;">✓ 代辦事項</h4>';
      data.todos.forEach(todo => {
        const priorityColors = { high: '#ef4444', medium: '#f97316', low: '#10b981' };
        const priorityNames = { high: '高', medium: '中', low: '低' };
        content += `
          <div style="padding: 12px; margin: 8px 0; border-left: 3px solid ${priorityColors[todo.priority]}; background: #fff7ed; border-radius: 4px;">
            <strong>${todo.title}</strong>
            <span style="font-size: 0.85em; color: ${priorityColors[todo.priority]}; margin-left: 8px;">
              [${priorityNames[todo.priority]}]
            </span>
            ${todo.completed ? '<span style="color: #10b981; margin-left: 8px;">✓ 已完成</span>' : ''}
          </div>
        `;
      });
    }

    // 核對清單
    if (data.checks.length > 0) {
      content += '<h4 style="color: #10b981; margin-top: 16px;">☑ 核對事項</h4>';
      data.checks.forEach(check => {
        content += `
          <div style="padding: 12px; margin: 8px 0; border-left: 3px solid #10b981; background: #f0fdf4; border-radius: 4px;">
            <strong>${check.name}</strong>
            <div style="font-size: 0.9em; color: #666; margin-top: 4px;">${check.user}</div>
          </div>
        `;
      });
    }

    content += `
        </div>
      </div>
    `;

    modal.innerHTML = content;
    document.body.appendChild(modal);

    // 關閉按鈕事件
    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => modal.remove());

    // 點擊外部關閉
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  },

  prevMonth() {
    if (AppState.currentMonth === 0) {
      AppState.currentMonth = 11;
      AppState.currentYear--;
    } else {
      AppState.currentMonth--;
    }
    this.render();
  },

  nextMonth() {
    if (AppState.currentMonth === 11) {
      AppState.currentMonth = 0;
      AppState.currentYear++;
    } else {
      AppState.currentMonth++;
    }
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
      

// ==================== 圖片檢視器 ====================
function showImageViewer(imageSrc) {
  const viewer = document.createElement('div');
  viewer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
  `;

  const img = document.createElement('img');
  img.src = imageSrc;
  img.style.cssText = `
    max-width: 95%;
    max-height: 95%;
    object-fit: contain;
    border-radius: 8px;
  `;

  viewer.appendChild(img);
  document.body.appendChild(viewer);

  // 點擊關閉
  viewer.addEventListener('click', () => {
    viewer.remove();
  });

  // ESC 鍵關閉
  const closeOnEsc = (e) => {
    if (e.key === 'Escape') {
      viewer.remove();
      document.removeEventListener('keydown', closeOnEsc);
    }
  };
  document.addEventListener('keydown', closeOnEsc);
}

// 為所有圖片新增點擊放大功能
document.addEventListener('click', (e) => {
  if (e.target.tagName === 'IMG' && e.target.closest('.work-item, .todo-item, .check-item')) {
    e.stopPropagation();
    showImageViewer(e.target.src);
  }
});


// ==================== 重複任務處理 ====================
// 啟用/停用重複選項
document.addEventListener('DOMContentLoaded', () => {
  const recurringCheckbox = document.getElementById('todoRecurringEnabled');
  const recurringValue = document.getElementById('todoRecurringValue');
  const recurringUnit = document.getElementById('todoRecurringUnit');

  if (recurringCheckbox) {
    recurringCheckbox.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      recurringValue.disabled = !enabled;
      recurringUnit.disabled = !enabled;
    });
  }
});

// 完成任務時檢查是否需要建立重複任務
async function handleRecurringTodo(todo) {
  if (!todo.recurring || !todo.recurring.enabled) {
    return;
  }

  const { value, unit } = todo.recurring;
  const currentDue = new Date(todo.dueDate);

  // 計算下一個到期日
  let nextDue = new Date(currentDue);
  switch (unit) {
    case 'day':
      nextDue.setDate(nextDue.getDate() + value);
      break;
    case 'week':
      nextDue.setDate(nextDue.getDate() + (value * 7));
      break;
    case 'month':
      nextDue.setMonth(nextDue.getMonth() + value);
      break;
  }

  // 建立新的重複任務
  const newTodo = {
    ...todo,
    id: Date.now(),
    completed: false,
    dueDate: nextDue.toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };

  // 儲存到資料庫
  const result = await db.addTodo(newTodo);

  if (result.success) {
    Utils.showToast(`已建立下一個週期任務：${nextDue.toLocaleDateString()}`);
    // 刷新顯示
    TodoView.render();
  }

  return result;
}

// 修改完成任務的函數以支援重複
const originalToggleTodo = TodoView.toggleComplete;
TodoView.toggleComplete = async function(id) {
  // 先取得任務資料
  const todo = await db.getTodoById(id);

  if (todo && !todo.completed) {
    // 如果是從未完成變為完成，且有重複設定
    if (todo.recurring && todo.recurring.enabled) {
      await handleRecurringTodo(todo);
    }
  }

  // 執行原本的完成邏輯
  return originalToggleTodo.call(this, id);
};
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
