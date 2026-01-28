
/*
XSS 防護檢查清單：
✅ sanitizeHTML() - 轉義所有 HTML 特殊字元
✅ sanitizeURL() - 過濾危險 URL 協議

需要套用的地方：
1. ✅ 工作紀錄：項目名稱、描述、時間
2. ✅ 日程：標題、地點、描述
3. ✅ 筆記：標題、內容
4. ✅ 匯入 JSON 資料時
5. ✅ 顯示時使用 textContent 或已 sanitize 的資料

使用方式：
- 輸入時：sanitizeHTML(input.value)
- 顯示時：element.textContent = data（不用 innerHTML）
- URL：sanitizeURL(urlInput.value)
*/

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
  async exportPDF() {
    try {
      Utils.showToast('正在生成 PDF，請稍候...');

      // 取得所有資料
      const workResult = await db.getWorkRecordsByMonth(
        AppState.currentYear, 
        AppState.currentMonth
      );
      const todoResult = await db.getTodosByMonth(
        AppState.currentYear, 
        AppState.currentMonth
      );
      const checkResult = await db.getCheckItemsByMonth(
        AppState.currentYear, 
        AppState.currentMonth
      );

      // 建立臨時容器用於渲染
      const container = document.createElement('div');
      container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 210mm;
        background: white;
        padding: 20mm;
        font-family: Arial, "Microsoft YaHei", sans-serif;
      `;

      // 標題
      const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', 
                          '7月', '8月', '9月', '10月', '11月', '12月'];
      container.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; color: #333;">工作管理報告</h1>
          <h2 style="margin: 10px 0; color: #666;">
            ${AppState.currentYear}年 ${monthNames[AppState.currentMonth]}
          </h2>
        </div>
      `;

      // 工作紀錄
      if (workResult.success && workResult.records.length > 0) {
        let workHtml = '<div style="page-break-inside: avoid; margin-bottom: 30px;"><h3 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">📋 工作紀錄</h3>';
        workResult.records.forEach(work => {
          workHtml += `
            <div style="page-break-inside: avoid; padding: 15px; margin: 10px 0; border-left: 3px solid #3b82f6; background: #eff6ff;">
              <div style="font-weight: bold; margin-bottom: 5px;">${work.date}</div>
              <div style="margin-bottom: 5px;">${work.content}</div>
              ${work.tags ? `<div style="font-size: 0.9em; color: #666;">標籤: ${work.tags}</div>` : ''}
            </div>
          `;
        });
        workHtml += '</div>';
        container.innerHTML += workHtml;
      }

      // 代辦事項
      if (todoResult.success && todoResult.todos.length > 0) {
        const priorityNames = { high: '高', medium: '中', low: '低' };
        const priorityColors = { high: '#ef4444', medium: '#f97316', low: '#10b981' };

        let todoHtml = '<div style="page-break-inside: avoid; margin-bottom: 30px;"><h3 style="color: #f97316; border-bottom: 2px solid #f97316; padding-bottom: 10px;">✓ 代辦事項</h3>';
        todoResult.todos.forEach(todo => {
          todoHtml += `
            <div style="page-break-inside: avoid; padding: 15px; margin: 10px 0; border-left: 3px solid ${priorityColors[todo.priority]}; background: #fff7ed;">
              <div style="font-weight: bold; margin-bottom: 5px;">${todo.title}</div>
              <div style="font-size: 0.9em; color: #666;">
                優先級: <span style="color: ${priorityColors[todo.priority]};">${priorityNames[todo.priority]}</span>
                ${todo.dueDate ? ` | 到期: ${todo.dueDate}` : ''}
                ${todo.completed ? ' | <span style="color: #10b981;">✓ 已完成</span>' : ''}
              </div>
            </div>
          `;
        });
        todoHtml += '</div>';
        container.innerHTML += todoHtml;
      }

      // 核對清單
      if (checkResult.success && checkResult.items.length > 0) {
        let checkHtml = '<div style="page-break-inside: avoid; margin-bottom: 30px;"><h3 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">☑ 核對事項</h3>';
        checkResult.items.forEach(item => {
          checkHtml += `
            <div style="page-break-inside: avoid; padding: 15px; margin: 10px 0; border-left: 3px solid #10b981; background: #f0fdf4;">
              <div style="font-weight: bold; margin-bottom: 5px;">${item.name}</div>
              <div style="font-size: 0.9em; color: #666;">
                負責人: ${item.user}
                ${item.nextDue ? ` | 下次檢查: ${item.nextDue}` : ''}
              </div>
            </div>
          `;
        });
        checkHtml += '</div>';
        container.innerHTML += checkHtml;
      }

      document.body.appendChild(container);

      // 使用 html2canvas 轉換為圖片
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // 移除臨時容器
      document.body.removeChild(container);

      // 計算 PDF 尺寸 (A4)
      const imgWidth = 210; // A4 寬度 mm
      const pageHeight = 297; // A4 高度 mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // 建立 PDF
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');

      let heightLeft = imgHeight;
      let position = 0;

      // 轉換 canvas 為圖片
      const imgData = canvas.toDataURL('image/jpeg', 1.0);

      // 第一頁
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // 如果內容超過一頁，自動分頁但不切斷內容
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // 儲存 PDF
      const filename = `工作報告_${AppState.currentYear}_${AppState.currentMonth + 1}.pdf`;
      pdf.save(filename);

      Utils.showToast('PDF 匯出成功！');
    } catch (error) {
      console.error('PDF 匯出失敗:', error);
      Utils.showToast('PDF 匯出失敗，請重試');
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

// ==================== XSS 防護 ====================
/**
 * 清理 HTML，防止 XSS 攻擊
 * @param {string} str - 待清理的字串
 * @returns {string} - 清理後的字串
 */
function sanitizeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str; // textContent 自動轉義 HTML
    return div.innerHTML;
}

/**
 * 清理 URL，防止 javascript: 協議
 * @param {string} url - 待清理的 URL
 * @returns {string} - 清理後的 URL
 */
function sanitizeURL(url) {
    if (!url) return '';
    const lower = url.toLowerCase().trim();
    // 阻擋危險協議
    if (lower.startsWith('javascript:') || 
        lower.startsWith('data:') || 
        lower.startsWith('vbscript:')) {
        return '';
    }
    return url;
}


// ==================== 統一輸入處理 ====================
/**
 * 安全地從表單取得輸入值
 * @param {string} selector - 元素選擇器
 * @returns {string} - 清理後的值
 */
function getSafeInput(selector) {
    const element = document.querySelector(selector);
    return element ? sanitizeHTML(element.value.trim()) : '';
}

/**
 * 安全地從表單取得 URL
 * @param {string} selector - 元素選擇器
 * @returns {string} - 清理後的 URL
 */
function getSafeURL(selector) {
    const element = document.querySelector(selector);
    return element ? sanitizeURL(element.value.trim()) : '';
}

/**
 * 安全地設定文字內容
 * @param {HTMLElement} element - 目標元素
 * @param {string} text - 文字內容
 */
function setSafeText(element, text) {
    if (element) {
        element.textContent = text || '';
    }
}

/**
 * 安全地清理整個物件的字串欄位
 * @param {Object} obj - 待清理的物件
 * @returns {Object} - 清理後的物件
 */
function sanitizeObject(obj) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            // URL 欄位特殊處理
            if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
                cleaned[key] = sanitizeURL(value);
            } else {
                cleaned[key] = sanitizeHTML(value);
            }
        } else if (typeof value === 'object' && value !== null) {
            cleaned[key] = sanitizeObject(value); // 遞迴清理
        } else {
            cleaned[key] = value; // 數字、布林值等直接保留
        }
    }
    return cleaned;
}

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

// ==================== 備份還原功能 ====================

// 匯出備份
function exportBackup() {
    const backup = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
            workLogs: 
// 匯入資料時記得使用 sanitizeObject()
// 範例：
// const importedData = JSON.parse(fileContent);
// const safeData = {
//     workLogs: importedData.workLogs?.map(log => sanitizeObject(log)) || [],
//     schedules: importedData.schedules?.map(item => sanitizeObject(item)) || [],
//     notes: importedData.notes?.map(note => sanitizeObject(note)) || []
// };

JSON.parse(localStorage.getItem('workLogs') || '[]'),
            todos: JSON.parse(localStorage.getItem('todos') || '[]'),
            checklists: JSON.parse(localStorage.getItem('checklists') || '[]')
        }
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `offlineWork_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`✅ 備份完成！\n檔案：${filename}\n\n包含：\n- 工作紀錄 ${backup.data.workLogs.length} 筆\n- 代辦事項 ${backup.data.todos.length} 筆\n- 核對清單 ${backup.data.checklists.length} 筆`);
}

// 觸發匯入
function importBackup() {
    document.getElementById('importFile').click();
}

// 處理匯入檔案
function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (confirm('⚠️ 還原資料會覆蓋現有資料！\n\n建議先備份現有資料。\n\n確定要繼續嗎？')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const backup = JSON.parse(e.target.result);

                // 驗證格式
                if (!backup.version || !backup.data) {
                    throw new Error('備份檔案格式錯誤');
                }

                // 還原資料
                localStorage.setItem('workLogs', JSON.stringify(backup.data.workLogs || []));
                localStorage.setItem('todos', JSON.stringify(backup.data.todos || []));
                localStorage.setItem('checklists', JSON.stringify(backup.data.checklists || []));

                alert(`✅ 還原成功！\n\n已還原：\n- 工作紀錄 ${backup.data.workLogs.length} 筆\n- 代辦事項 ${backup.data.todos.length} 筆\n- 核對清單 ${backup.data.checklists.length} 筆\n\n頁面即將重新載入...`);

                // 重新載入頁面
                setTimeout(() => location.reload(), 1000);

            } catch (error) {
                alert('❌ 還原失敗：' + error.message);
            }
        };
        reader.readAsText(file);
    }

    // 清空 input，允許重複選擇同一個檔案
    event.target.value = '';
}


// ==================== 深色模式 ====================

// 初始化深色模式
function initDarkMode() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeIcon').textContent = '☀️';
    }
}

// 切換深色模式
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    document.getElementById('darkModeIcon').textContent = isDark ? '☀️' : '🌙';
}

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', initDarkMode);


// 修復 PDF 中文顯示
// 方法：使用 html2canvas 將內容轉為圖片，避免字體問題
async function exportCalendarPDF() {
    const calendar = document.querySelector('.calendar') || document.querySelector('#calendar');
    if (!calendar) {
        alert('找不到月曆元素');
        return;
    }

    try {
        // 使用 html2canvas 截圖
        const canvas = await html2canvas(calendar, {
            scale: 2, // 提高解析度
            useCORS: true,
            logging: false,
            backgroundColor: document.body.classList.contains('dark-mode') ? '#1a1a1a' : '#ffffff'
        });

        // 創建 PDF
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 210; // A4 寬度
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // 如果圖片高度超過一頁，需要分頁
        if (imgHeight <= 297) {
            // 單頁
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        } else {
            // 多頁處理
            let heightLeft = imgHeight;
            let position = 0;
            const pageHeight = 297;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
        }

        // 下載 PDF
        const fileName = `月曆_${new Date().toISOString().slice(0, 10)}.pdf`;
        pdf.save(fileName);

        alert('✅ PDF 匯出成功！');

    } catch (error) {
        console.error('PDF 匯出錯誤:', error);
        alert('❌ PDF 匯出失敗：' + error.message);
    }
}

// 如果原有的 exportPDF 函數存在，替換它
if (typeof exportPDF !== 'undefined') {
    window.exportPDF = exportCalendarPDF;
}


// ==================== 標籤系統 ====================
/**
 * 從所有項目中提取所有唯一標籤
 */
function getAllTags() {
    const tags = new Set();

    // 工作紀錄標籤
    const workLogs = JSON.parse(localStorage.getItem('workRecords') || '[]');
    workLogs.forEach(log => {
        if (log.tags && Array.isArray(log.tags)) {
            log.tags.forEach(tag => tags.add(tag));
        }
    });

    // 日程標籤
    const schedules = JSON.parse(localStorage.getItem('schedules') || '[]');
    schedules.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => tags.add(tag));
        }
    });

    // 筆記標籤
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.forEach(note => {
        if (note.tags && Array.isArray(note.tags)) {
            note.tags.forEach(tag => tags.add(tag));
        }
    });

    return Array.from(tags).sort();
}

/**
 * 渲染標籤輸入介面
 * @param {string} containerId - 容器 ID
 * @param {Array} currentTags - 目前已選標籤
 * @param {Function} onUpdate - 標籤更新回調
 */
function renderTagInput(containerId, currentTags = [], onUpdate) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="tag-input-container">
            <div class="tag-input-wrapper">
                <input type="text" class="tag-input" placeholder="輸入標籤（按 Enter 新增）" />
                <button type="button" class="tag-add-btn">新增</button>
            </div>
            <div class="tags-display"></div>
        </div>
    `;

    const input = container.querySelector('.tag-input');
    const addBtn = container.querySelector('.tag-add-btn');
    const display = container.querySelector('.tags-display');

    // 渲染已有標籤
    function render() {
        display.innerHTML = currentTags.map((tag, index) => `
            <span class="tag">
                ${sanitizeHTML(tag)}
                <span class="tag-remove" data-index="${index}">×</span>
            </span>
        `).join('');

        // 綁定移除事件
        display.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                currentTags.splice(idx, 1);
                render();
                if (onUpdate) onUpdate(currentTags);
            });
        });
    }

    // 新增標籤
    function addTag() {
        const tag = input.value.trim();
        if (tag && !currentTags.includes(tag)) {
            currentTags.push(tag);
            input.value = '';
            render();
            if (onUpdate) onUpdate(currentTags);
        }
    }

    addBtn.addEventListener('click', addTag);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    });

    render();
}

/**
 * 渲染標籤篩選器
 * @param {string} containerId - 容器 ID
 * @param {Function} onFilter - 篩選回調函數
 */
function renderTagFilter(containerId, onFilter) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const allTags = getAllTags();
    let activeTags = [];

    function render() {
        if (allTags.length === 0) {
            container.innerHTML = '<p style="color: #999; font-size: 0.9rem;">尚無標籤</p>';
            return;
        }

        container.innerHTML = `
            <div class="tag-filter-container">
                <div class="tag-filter-title">📌 標籤篩選（點擊篩選）</div>
                <div class="tag-filter-list">
                    ${allTags.map(tag => `
                        <span class="tag-filter ${activeTags.includes(tag) ? 'active' : ''}" data-tag="${sanitizeHTML(tag)}">
                            ${sanitizeHTML(tag)}
                        </span>
                    `).join('')}
                    ${activeTags.length > 0 ? '<span class="tag-filter" data-tag="__clear__">✕ 清除篩選</span>' : ''}
                </div>
            </div>
        `;

        // 綁定點擊事件
        container.querySelectorAll('.tag-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tag;

                if (tag === '__clear__') {
                    activeTags = [];
                } else {
                    if (activeTags.includes(tag)) {
                        activeTags = activeTags.filter(t => t !== tag);
                    } else {
                        activeTags.push(tag);
                    }
                }

                render();
                if (onFilter) onFilter(activeTags);
            });
        });
    }

    render();
}

/**
 * 根據標籤篩選項目
 * @param {Array} items - 項目陣列
 * @param {Array} filterTags - 篩選標籤
 * @returns {Array} - 篩選後的項目
 */
function filterByTags(items, filterTags) {
    if (filterTags.length === 0) return items;

    return items.filter(item => {
        if (!item.tags || !Array.isArray(item.tags)) return false;
        // 至少符合一個標籤即可
        return filterTags.some(tag => item.tags.includes(tag));
    });
}



// ==================== 搜尋功能 ====================
/**
 * 開啟搜尋介面
 */
function openSearch() {
    const container = document.getElementById('searchContainer');
    const input = document.getElementById('searchInput');
    if (container) {
        container.classList.add('active');
        if (input) {
            input.focus();
            input.value = '';
        }
        // 清空結果
        const results = document.getElementById('searchResults');
        if (results) {
            results.innerHTML = '<div class="search-no-results">輸入關鍵字開始搜尋</div>';
        }
    }
}

/**
 * 關閉搜尋介面
 */
function closeSearch() {
    const container = document.getElementById('searchContainer');
    if (container) {
        container.classList.remove('active');
    }
}

/**
 * 全文搜尋所有項目
 * @param {string} keyword - 搜尋關鍵字
 * @returns {Array} - 搜尋結果
 */
function searchAll(keyword) {
    if (!keyword || keyword.trim() === '') return [];

    const results = [];
    const lowerKeyword = keyword.toLowerCase();

    // 搜尋工作紀錄
    const workLogs = JSON.parse(localStorage.getItem('workRecords') || '[]');
    workLogs.forEach((log, index) => {
        const searchText = `${log.project || ''} ${log.description || ''} ${log.tags?.join(' ') || ''}`.toLowerCase();
        if (searchText.includes(lowerKeyword)) {
            results.push({
                type: 'work',
                typeLabel: '工作紀錄',
                id: index,
                title: log.project || '無標題',
                description: log.description || '',
                date: log.startTime || log.date || '',
                data: log
            });
        }
    });

    // 搜尋日程
    const schedules = JSON.parse(localStorage.getItem('schedules') || '[]');
    schedules.forEach((item, index) => {
        const searchText = `${item.title || ''} ${item.location || ''} ${item.description || ''} ${item.tags?.join(' ') || ''}`.toLowerCase();
        if (searchText.includes(lowerKeyword)) {
            results.push({
                type: 'schedule',
                typeLabel: '日程',
                id: index,
                title: item.title || '無標題',
                description: item.description || '',
                date: item.date || '',
                data: item
            });
        }
    });

    // 搜尋筆記
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.forEach((note, index) => {
        const searchText = `${note.title || ''} ${note.content || ''} ${note.tags?.join(' ') || ''}`.toLowerCase();
        if (searchText.includes(lowerKeyword)) {
            results.push({
                type: 'note',
                typeLabel: '筆記',
                id: index,
                title: note.title || '無標題',
                description: note.content || '',
                date: note.createdAt || '',
                data: note
            });
        }
    });

    return results;
}

/**
 * 高亮顯示關鍵字
 * @param {string} text - 原始文字
 * @param {string} keyword - 關鍵字
 * @returns {string} - 高亮後的 HTML
 */
function highlightKeyword(text, keyword) {
    if (!text || !keyword) return sanitizeHTML(text);

    const regex = new RegExp(`(${keyword})`, 'gi');
    return sanitizeHTML(text).replace(regex, '<span class="search-highlight">$1</span>');
}

/**
 * 渲染搜尋結果
 * @param {Array} results - 搜尋結果
 * @param {string} keyword - 搜尋關鍵字
 */
function renderSearchResults(results, keyword) {
    const container = document.getElementById('searchResults');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = '<div class="search-no-results">沒有找到符合的結果</div>';
        return;
    }

    container.innerHTML = results.map(item => {
        const titleHighlighted = highlightKeyword(item.title, keyword);
        const descHighlighted = highlightKeyword(
            item.description.length > 100 ? item.description.substring(0, 100) + '...' : item.description,
            keyword
        );

        return `
            <div class="search-result-item" onclick="jumpToItem('${item.type}', ${item.id})">
                <span class="search-result-type">${item.typeLabel}</span>
                <div class="search-result-title">${titleHighlighted}</div>
                ${descHighlighted ? `<div class="search-result-desc">${descHighlighted}</div>` : ''}
                ${item.date ? `<div class="search-result-desc">📅 ${sanitizeHTML(item.date)}</div>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * 跳轉到指定項目
 * @param {string} type - 項目類型
 * @param {number} id - 項目 ID
 */
function jumpToItem(type, id) {
    closeSearch();

    // 切換到對應的 tab
    if (type === 'work') {
        // 切換到工作紀錄 tab
        const workTab = document.querySelector('[data-tab="work"]') || document.querySelector('button[onclick*="showTab"]');
        if (workTab) workTab.click();
    } else if (type === 'schedule') {
        // 切換到日程 tab
        const scheduleTab = document.querySelectorAll('[data-tab]')[1] || document.querySelectorAll('button[onclick*="showTab"]')[1];
        if (scheduleTab) scheduleTab.click();
    } else if (type === 'note') {
        // 切換到筆記 tab
        const noteTab = document.querySelectorAll('[data-tab]')[2] || document.querySelectorAll('button[onclick*="showTab"]')[2];
        if (noteTab) noteTab.click();
    }

    // 可以加上滾動到指定項目的邏輯
    setTimeout(() => {
        const items = document.querySelectorAll('.work-item, .schedule-item, .note-item');
        if (items[id]) {
            items[id].scrollIntoView({ behavior: 'smooth', block: 'center' });
            items[id].style.background = '#fff3cd';
            setTimeout(() => {
                items[id].style.background = '';
            }, 2000);
        }
    }, 300);
}

// 初始化搜尋功能
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // 即時搜尋
        searchInput.addEventListener('input', function() {
            const keyword = this.value.trim();
            if (keyword === '') {
                const results = document.getElementById('searchResults');
                if (results) {
                    results.innerHTML = '<div class="search-no-results">輸入關鍵字開始搜尋</div>';
                }
                return;
            }

            const results = searchAll(keyword);
            renderSearchResults(results, keyword);
        });

        // ESC 關閉搜尋
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeSearch();
            }
        });
    }

    // 點擊背景關閉
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer) {
        searchContainer.addEventListener('click', function(e) {
            if (e.target === searchContainer) {
                closeSearch();
            }
        });
    }
});



// ==================== 快捷鍵系統 ====================
/**
 * 全域快捷鍵監聽
 */
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd 鍵檢測（Mac 用 Cmd，Windows/Linux 用 Ctrl）
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

    // Ctrl+F / Cmd+F - 開啟搜尋
    if (ctrlKey && e.key === 'f') {
        e.preventDefault();
        if (typeof openSearch === 'function') {
            openSearch();
        }
        return false;
    }

    // Ctrl+N / Cmd+N - 快速新增（開啟 FAB 選單）
    if (ctrlKey && e.key === 'n') {
        e.preventDefault();
        const fab = document.querySelector('.fab');
        if (fab) {
            fab.click();
        }
        return false;
    }

    // Ctrl+S / Cmd+S - 儲存/匯出資料
    if (ctrlKey && e.key === 's') {
        e.preventDefault();
        if (typeof exportData === 'function') {
            exportData();
            // 顯示提示
            showNotification('✅ 資料已匯出', 'success');
        }
        return false;
    }

    // Ctrl+K / Cmd+K - 切換深色模式
    if (ctrlKey && e.key === 'k') {
        e.preventDefault();
        if (typeof toggleDarkMode === 'function') {
            toggleDarkMode();
        }
        return false;
    }

    // ESC - 關閉所有彈窗
    if (e.key === 'Escape') {
        // 關閉搜尋
        if (typeof closeSearch === 'function') {
            closeSearch();
        }
        // 關閉 FAB 選單
        const fabMenu = document.querySelector('.fab-menu.active');
        if (fabMenu) {
            fabMenu.classList.remove('active');
        }
        // 關閉所有 modal
        const modals = document.querySelectorAll('.modal.active, .modal[style*="display: block"]');
        modals.forEach(modal => {
            modal.classList.remove('active');
            modal.style.display = 'none';
        });
    }
});

/**
 * 顯示通知訊息
 * @param {string} message - 訊息內容
 * @param {string} type - 類型 (success, error, info)
 */
function showNotification(message, type = 'info') {
    // 移除舊通知
    const oldNotification = document.querySelector('.notification-toast');
    if (oldNotification) {
        oldNotification.remove();
    }

    // 建立新通知
    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10001;
        animation: slideInRight 0.3s ease-out;
        font-weight: 500;
    `;

    document.body.appendChild(notification);

    // 3 秒後自動消失
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 加入動畫樣式
if (!document.getElementById('shortcut-animations')) {
    const style = document.createElement('style');
    style.id = 'shortcut-animations';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * 顯示快捷鍵說明
 */
function showShortcutHelp() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlSymbol = isMac ? '⌘' : 'Ctrl';

    const helpMessage = `
快捷鍵說明：
${ctrlSymbol}+F - 開啟搜尋
${ctrlSymbol}+N - 快速新增
${ctrlSymbol}+S - 匯出資料
${ctrlSymbol}+K - 切換深色模式
ESC - 關閉彈窗
    `.trim();

    alert(helpMessage);
}

// 在頁面載入時顯示快捷鍵提示（可選）
document.addEventListener('DOMContentLoaded', function() {
    // 檢查是否第一次使用
    if (!localStorage.getItem('shortcutHelpShown')) {
        setTimeout(() => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlSymbol = isMac ? '⌘' : 'Ctrl';
            showNotification(`💡 提示：按 ${ctrlSymbol}+F 開啟搜尋`, 'info');
            localStorage.setItem('shortcutHelpShown', 'true');
        }, 2000);
    }
});

console.log('⌨️ 快捷鍵已啟用！');
console.log('Ctrl+F - 搜尋 | Ctrl+N - 新增 | Ctrl+S - 儲存 | Ctrl+K - 深色模式');


// ==================== 匯出功能 ====================
/**
 * 匯出資料為指定格式
 * @param {string} format - 'json', 'csv', 或 'markdown'
 */
function exportData(format) {
    const data = {
        projects: state.projects,
        tasks: state.tasks,
        goals: state.goals,
        tags: state.tags,
        exportDate: new Date().toISOString()
    };

    let content, filename, mimeType;

    switch (format) {
        case 'json':
            content = JSON.stringify(data, null, 2);
            filename = `offline-work-backup-${getDateString()}.json`;
            mimeType = 'application/json';
            break;

        case 'csv':
            content = generateCSV(data);
            filename = `offline-work-export-${getDateString()}.csv`;
            mimeType = 'text/csv';
            break;

        case 'markdown':
            content = generateMarkdown(data);
            filename = `offline-work-export-${getDateString()}.md`;
            mimeType = 'text/markdown';
            break;

        default:
            console.error('Unknown export format:', format);
            return;
    }

    // 下載檔案
    downloadFile(content, filename, mimeType);

    // 顯示成功訊息
    showNotification(`✅ 已匯出為 ${format.toUpperCase()} 格式`, 'success');
}

/**
 * 生成 CSV 格式
 */
function generateCSV(data) {
    let csv = '';

    // Projects
    csv += '=== PROJECTS ===\n';
    csv += 'Name,Description,Status,Priority,Tags,Created,Updated\n';
    data.projects.forEach(p => {
        csv += `"${escapeCsv(p.name)}","${escapeCsv(p.description)}","${p.status}","${p.priority}","${p.tags.join('; ')}","${p.createdAt}","${p.updatedAt}"\n`;
    });

    // Tasks
    csv += '\n=== TASKS ===\n';
    csv += 'Title,Description,Status,Priority,Due Date,Tags,Created,Updated\n';
    data.tasks.forEach(t => {
        csv += `"${escapeCsv(t.title)}","${escapeCsv(t.description)}","${t.status}","${t.priority}","${t.dueDate || ''}","${t.tags.join('; ')}","${t.createdAt}","${t.updatedAt}"\n`;
    });

    // Goals
    csv += '\n=== GOALS ===\n';
    csv += 'Title,Description,Category,Status,Target Date,Progress,Tags,Created,Updated\n';
    data.goals.forEach(g => {
        csv += `"${escapeCsv(g.title)}","${escapeCsv(g.description)}","${g.category}","${g.status}","${g.targetDate || ''}","${g.progress}%","${g.tags.join('; ')}","${g.createdAt}","${g.updatedAt}"\n`;
    });

    return csv;
}

/**
 * 生成 Markdown 格式
 */
function generateMarkdown(data) {
    let md = '# Offline Work Export\n\n';
    md += `**Export Date:** ${new Date(data.exportDate).toLocaleString()}\n\n`;
    md += `**Statistics:**\n`;
    md += `- Projects: ${data.projects.length}\n`;
    md += `- Tasks: ${data.tasks.length}\n`;
    md += `- Goals: ${data.goals.length}\n`;
    md += `- Tags: ${data.tags.length}\n\n`;

    // Projects
    md += '## 📁 Projects\n\n';
    if (data.projects.length === 0) {
        md += '*No projects*\n\n';
    } else {
        data.projects.forEach(p => {
            md += `### ${p.name}\n\n`;
            md += `**Description:** ${p.description}\n\n`;
            md += `**Status:** ${getStatusEmoji(p.status)} ${p.status}\n\n`;
            md += `**Priority:** ${getPriorityEmoji(p.priority)} ${p.priority}\n\n`;
            if (p.tags.length > 0) {
                md += `**Tags:** ${p.tags.map(t => `\`${t}\``).join(', ')}\n\n`;
            }
            md += `**Created:** ${new Date(p.createdAt).toLocaleString()}\n\n`;
            md += '---\n\n';
        });
    }

    // Tasks
    md += '## ✅ Tasks\n\n';
    if (data.tasks.length === 0) {
        md += '*No tasks*\n\n';
    } else {
        data.tasks.forEach(t => {
            md += `### ${t.title}\n\n`;
            md += `**Description:** ${t.description}\n\n`;
            md += `**Status:** ${getStatusEmoji(t.status)} ${t.status}\n\n`;
            md += `**Priority:** ${getPriorityEmoji(t.priority)} ${t.priority}\n\n`;
            if (t.dueDate) {
                md += `**Due Date:** ${new Date(t.dueDate).toLocaleDateString()}\n\n`;
            }
            if (t.tags.length > 0) {
                md += `**Tags:** ${t.tags.map(t => `\`${t}\``).join(', ')}\n\n`;
            }
            md += `**Created:** ${new Date(t.createdAt).toLocaleString()}\n\n`;
            md += '---\n\n';
        });
    }

    // Goals
    md += '## 🎯 Goals\n\n';
    if (data.goals.length === 0) {
        md += '*No goals*\n\n';
    } else {
        data.goals.forEach(g => {
            md += `### ${g.title}\n\n`;
            md += `**Description:** ${g.description}\n\n`;
            md += `**Category:** ${g.category}\n\n`;
            md += `**Status:** ${getStatusEmoji(g.status)} ${g.status}\n\n`;
            md += `**Progress:** ${g.progress}%\n\n`;
            if (g.targetDate) {
                md += `**Target Date:** ${new Date(g.targetDate).toLocaleDateString()}\n\n`;
            }
            if (g.tags.length > 0) {
                md += `**Tags:** ${g.tags.map(t => `\`${t}\``).join(', ')}\n\n`;
            }
            md += `**Created:** ${new Date(g.createdAt).toLocaleString()}\n\n`;
            md += '---\n\n';
        });
    }

    // Tags
    md += '## 🏷️ Tags\n\n';
    if (data.tags.length === 0) {
        md += '*No tags*\n\n';
    } else {
        md += data.tags.map(t => `- \`${t}\``).join('\n');
        md += '\n';
    }

    return md;
}

/**
 * 工具函數：取得狀態 Emoji
 */
function getStatusEmoji(status) {
    const map = {
        'todo': '⏳',
        'in-progress': '🔄',
        'completed': '✅',
        'on-hold': '⏸️',
        'cancelled': '❌'
    };
    return map[status] || '📋';
}

/**
 * 工具函數：取得優先度 Emoji
 */
function getPriorityEmoji(priority) {
    const map = {
        'high': '🔴',
        'medium': '🟡',
        'low': '🟢'
    };
    return map[priority] || '⚪';
}

/**
 * 工具函數：CSV 跳脫
 */
function escapeCsv(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '""');
}

/**
 * 工具函數：取得日期字串
 */
function getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

/**
 * 工具函數：下載檔案
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 工具函數：顯示通知
 */
function showNotification(message, type = 'info') {
    // 簡單的通知實作
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#4caf50' : '#2196f3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// 加入動畫樣式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);


// ==================== 匯入功能 ====================
/**
 * 匯入 JSON 備份檔案
 * @param {Event} event - 檔案選擇事件
 */
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 驗證檔案類型
    if (!file.name.endsWith('.json')) {
        showNotification('❌ 請選擇 JSON 格式的備份檔', 'error');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // 驗證資料格式
            if (!validateImportData(data)) {
                showNotification('❌ 檔案格式不正確', 'error');
                return;
            }

            // 顯示確認對話框
            const confirmMsg = `確定要匯入資料嗎？\n\n` +
                `這將會：\n` +
                `- 新增 ${data.projects?.length || 0} 個專案\n` +
                `- 新增 ${data.tasks?.length || 0} 個任務\n` +
                `- 新增 ${data.goals?.length || 0} 個目標\n` +
                `- 合併 ${data.tags?.length || 0} 個標籤\n\n` +
                `現有資料不會被刪除。`;

            if (!confirm(confirmMsg)) {
                showNotification('⚠️ 已取消匯入', 'warning');
                return;
            }

            // 執行匯入
            performImport(data);

            // 顯示成功訊息
            showNotification('✅ 匯入成功！', 'success');

            // 重新渲染所有畫面
            renderProjects();
            renderTasks();
            renderGoals();

        } catch (error) {
            console.error('Import error:', error);
            showNotification('❌ 匯入失敗：檔案格式錯誤', 'error');
        }
    };

    reader.onerror = function() {
        showNotification('❌ 無法讀取檔案', 'error');
    };

    reader.readAsText(file);

    // 重置檔案輸入，允許重複選擇同一檔案
    event.target.value = '';
}

/**
 * 驗證匯入資料格式
 */
function validateImportData(data) {
    // 必須是物件
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    // 至少要有一個資料陣列
    const hasProjects = Array.isArray(data.projects);
    const hasTasks = Array.isArray(data.tasks);
    const hasGoals = Array.isArray(data.goals);
    const hasTags = Array.isArray(data.tags);

    return hasProjects || hasTasks || hasGoals || hasTags;
}

/**
 * 執行匯入操作
 */
function performImport(data) {
    // 匯入 Projects
    if (Array.isArray(data.projects)) {
        data.projects.forEach(project => {
            // 生成新的 ID 避免衝突
            const newProject = {
                ...project,
                id: generateId(),
                createdAt: project.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            state.projects.push(newProject);
        });
    }

    // 匯入 Tasks
    if (Array.isArray(data.tasks)) {
        data.tasks.forEach(task => {
            const newTask = {
                ...task,
                id: generateId(),
                createdAt: task.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            state.tasks.push(newTask);
        });
    }

    // 匯入 Goals
    if (Array.isArray(data.goals)) {
        data.goals.forEach(goal => {
            const newGoal = {
                ...goal,
                id: generateId(),
                createdAt: goal.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            state.goals.push(newGoal);
        });
    }

    // 匯入 Tags（合併，不重複）
    if (Array.isArray(data.tags)) {
        data.tags.forEach(tag => {
            if (!state.tags.includes(tag)) {
                state.tags.push(tag);
            }
        });
    }

    // 儲存到 localStorage
    saveToLocalStorage();
}

/**
 * 更新 showNotification 支援更多類型
 */
const originalShowNotification = showNotification;
showNotification = function(message, type = 'info') {
    const colors = {
        'success': '#4caf50',
        'error': '#f44336',
        'warning': '#ff9800',
        'info': '#2196f3'
    };

    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${colors[type] || colors.info};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        word-wrap: break-word;
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
};


// ==================== 深色模式 ====================
/**
 * 初始化主題
 */
function initTheme() {
    // 從 localStorage 讀取主題偏好
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // 優先使用已儲存的偏好，否則使用系統偏好
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');

    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon('dark');
    } else {
        updateThemeIcon('light');
    }
}

/**
 * 切換主題
 */
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    const theme = isDark ? 'dark' : 'light';

    // 儲存偏好到 localStorage
    localStorage.setItem('theme', theme);

    // 更新圖示
    updateThemeIcon(theme);

    // 顯示通知
    showNotification(`已切換到${isDark ? '深色' : '淺色'}模式`, 'info');
}

/**
 * 更新主題圖示
 */
function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        btn.title = theme === 'dark' ? '切換到淺色模式' : '切換到深色模式';
    }
}

// 頁面載入時初始化主題
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
});

