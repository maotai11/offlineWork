// ===== 全域變數 =====
let currentView = 'calendar';
let currentDate = new Date();
let selectedDate = null;
let editingWorklogId = null;
let editingChecklistId = null;
let currentFilter = 'all';

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    setupNavigation();
    renderCalendar();
    loadWorklogs();
    loadChecklists();
    loadTodos();
    setDefaultDate();
});

// ===== 導航切換 =====
function setupNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });
}

function switchView(view) {
    // 更新按鈕狀態
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // 切換視圖
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${view}-view`).classList.add('active');
    
    currentView = view;
}

// ===== 月曆功能 =====
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 更新月份標題
    document.getElementById('current-month').textContent = 
        `${year}年 ${month + 1}月`;
    
    // 計算月曆數據
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    
    // 生成月曆格子
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    // 星期標題
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    weekDays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // 空白格子
    for (let i = 0; i < startDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }
    
    // 日期格子
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;
        
        const cellDate = new Date(year, month, day);
        
        // 今天標記
        if (cellDate.toDateString() === today.toDateString()) {
            dayCell.classList.add('today');
        }
        
        // 選中標記
        if (selectedDate && cellDate.toDateString() === selectedDate.toDateString()) {
            dayCell.classList.add('selected');
        }
        
        dayCell.onclick = () => selectDate(cellDate);
        grid.appendChild(dayCell);
    }
}

function selectDate(date) {
    selectedDate = date;
    renderCalendar();
    showDayDetails(date);
}

async function showDayDetails(date) {
    const details = document.getElementById('day-details');
    const dateStr = date.toLocaleDateString('zh-TW', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    document.getElementById('selected-date').textContent = dateStr;
    
    // 載入當日事項
    const events = await getCalendarEvents(date);
    const list = document.getElementById('day-events-list');
    list.innerHTML = '';
    
    if (events.length === 0) {
        list.innerHTML = '<li class="empty-message">無事項</li>';
    } else {
        events.forEach(event => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${event.text}</span>
                <button onclick="deleteCalendarEvent(${event.id})">刪除</button>
            `;
            list.appendChild(li);
        });
    }
    
    details.classList.remove('hidden');
}

async function addCalendarEvent() {
    const input = document.getElementById('new-event-input');
    const text = input.value.trim();
    
    if (!text || !selectedDate) return;
    
    await saveCalendarEvent({
        date: selectedDate.toISOString().split('T')[0],
        text: text,
        timestamp: Date.now()
    });
    
    input.value = '';
    showDayDetails(selectedDate);
}

async function deleteCalendarEvent(id) {
    await deleteFromDB('calendar', id);
    showDayDetails(selectedDate);
}

function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

function goToday() {
    currentDate = new Date();
    selectedDate = new Date();
    renderCalendar();
    showDayDetails(selectedDate);
}

// ===== 工作紀錄功能 =====
function showAddWorklog() {
    document.getElementById('worklog-form').classList.remove('hidden');
    setDefaultDate();
}

function cancelWorklog() {
    document.getElementById('worklog-form').classList.add('hidden');
    clearWorklogForm();
}

function clearWorklogForm() {
    document.getElementById('worklog-date').value = '';
    document.getElementById('worklog-title').value = '';
    document.getElementById('worklog-content').value = '';
    document.getElementById('worklog-tags').value = '';
    editingWorklogId = null;
}

async function saveWorklog() {
    const date = document.getElementById('worklog-date').value;
    const title = document.getElementById('worklog-title').value.trim();
    const content = document.getElementById('worklog-content').value.trim();
    const tags = document.getElementById('worklog-tags').value.trim();
    
    if (!date || !title) {
        alert('請填寫日期和標題');
        return;
    }
    
    const worklog = {
        date,
        title,
        content,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        timestamp: Date.now()
    };
    
    if (editingWorklogId) {
        worklog.id = editingWorklogId;
    }
    
    await saveWorklogToDB(worklog);
    cancelWorklog();
    loadWorklogs();
}

async function loadWorklogs() {
    const worklogs = await getAllWorklogs();
    const container = document.getElementById('worklogs-list');
    
    if (worklogs.length === 0) {
        container.innerHTML = '<p class="empty-message">尚無工作紀錄</p>';
        return;
    }
    
    // 按日期排序（新到舊）
    worklogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    container.innerHTML = '';
    worklogs.forEach(log => {
        const card = document.createElement('div');
        card.className = 'worklog-card';
        card.innerHTML = `
            <div class="worklog-header">
                <h3>${log.title}</h3>
                <span class="worklog-date">${log.date}</span>
            </div>
            <div class="worklog-content">${log.content || ''}</div>
            ${log.tags && log.tags.length > 0 ? `
                <div class="worklog-tags">
                    ${log.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
            <div class="worklog-actions">
                <button onclick="editWorklog(${log.id})" class="btn-secondary">編輯</button>
                <button onclick="deleteWorklog(${log.id})" class="btn-danger">刪除</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function editWorklog(id) {
    const worklog = await getWorklogById(id);
    if (!worklog) return;
    
    document.getElementById('worklog-date').value = worklog.date;
    document.getElementById('worklog-title').value = worklog.title;
    document.getElementById('worklog-content').value = worklog.content || '';
    document.getElementById('worklog-tags').value = worklog.tags ? worklog.tags.join(', ') : '';
    
    editingWorklogId = id;
    showAddWorklog();
}

async function deleteWorklog(id) {
    if (!confirm('確定要刪除這筆紀錄嗎？')) return;
    await deleteFromDB('worklogs', id);
    loadWorklogs();
}

function filterWorklogs() {
    const search = document.getElementById('worklog-search').value.toLowerCase();
    const filter = document.getElementById('worklog-filter').value;
    
    // TODO: 實作篩選邏輯
    loadWorklogs();
}

// ===== 核對清單功能 =====
function showAddChecklist() {
    document.getElementById('checklist-form').classList.remove('hidden');
}

function cancelChecklist() {
    document.getElementById('checklist-form').classList.add('hidden');
    clearChecklistForm();
}

function clearChecklistForm() {
    document.getElementById('checklist-title').value = '';
    document.getElementById('checklist-items-input').value = '';
    document.getElementById('checklist-repeat').value = 'none';
    editingChecklistId = null;
}

async function saveChecklist() {
    const title = document.getElementById('checklist-title').value.trim();
    const itemsText = document.getElementById('checklist-items-input').value.trim();
    const repeat = document.getElementById('checklist-repeat').value;
    
    if (!title || !itemsText) {
        alert('請填寫標題和項目');
        return;
    }
    
    const items = itemsText.split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(text => ({ text, checked: false }));
    
    const checklist = {
        title,
        items,
        repeat,
        timestamp: Date.now()
    };
    
    if (editingChecklistId) {
        checklist.id = editingChecklistId;
    }
    
    await saveChecklistToDB(checklist);
    cancelChecklist();
    loadChecklists();
}

async function loadChecklists() {
    const checklists = await getAllChecklists();
    const container = document.getElementById('checklists-container');
    
    if (checklists.length === 0) {
        container.innerHTML = '<p class="empty-message">尚無核對清單</p>';
        return;
    }
    
    container.innerHTML = '';
    checklists.forEach(list => {
        const card = document.createElement('div');
        card.className = 'checklist-card';
        
        const progress = list.items.filter(i => i.checked).length;
        const total = list.items.length;
        const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
        
        card.innerHTML = `
            <div class="checklist-header">
                <h3>${list.title}</h3>
                <span class="checklist-progress">${progress}/${total} (${percentage}%)</span>
            </div>
            <div class="checklist-items">
                ${list.items.map((item, idx) => `
                    <label class="checklist-item">
                        <input type="checkbox" ${item.checked ? 'checked' : ''} 
                               onchange="toggleChecklistItem(${list.id}, ${idx})">
                        <span class="${item.checked ? 'checked' : ''}">${item.text}</span>
                    </label>
                `).join('')}
            </div>
            <div class="checklist-actions">
                ${list.repeat !== 'none' ? `<span class="repeat-badge">🔄 ${getRepeatText(list.repeat)}</span>` : ''}
                <button onclick="resetChecklist(${list.id})" class="btn-secondary">重置</button>
                <button onclick="deleteChecklist(${list.id})" class="btn-danger">刪除</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function getRepeatText(repeat) {
    const map = { daily: '每日', weekly: '每週', monthly: '每月', none: '不重複' };
    return map[repeat] || repeat;
}

async function toggleChecklistItem(listId, itemIdx) {
    const checklist = await getChecklistById(listId);
    if (!checklist) return;
    
    checklist.items[itemIdx].checked = !checklist.items[itemIdx].checked;
    await saveChecklistToDB(checklist);
    loadChecklists();
}

async function resetChecklist(id) {
    const checklist = await getChecklistById(id);
    if (!checklist) return;
    
    checklist.items.forEach(item => item.checked = false);
    await saveChecklistToDB(checklist);
    loadChecklists();
}

async function deleteChecklist(id) {
    if (!confirm('確定要刪除這個清單嗎？')) return;
    await deleteFromDB('checklists', id);
    loadChecklists();
}

// ===== 待辦任務功能 =====
async function addTodo() {
    const input = document.getElementById('new-todo-input');
    const text = input.value.trim();
    const priority = document.getElementById('todo-priority').value;
    const dueDate = document.getElementById('todo-due-date').value;
    
    if (!text) return;
    
    await saveTodo({
        text,
        priority,
        dueDate,
        completed: false,
        timestamp: Date.now()
    });
    
    input.value = '';
    document.getElementById('todo-due-date').value = '';
    loadTodos();
}

async function loadTodos() {
    const todos = await getAllTodos();
    const container = document.getElementById('todos-list');
    
    // 篩選
    let filtered = todos;
    if (currentFilter === 'active') {
        filtered = todos.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
        filtered = todos.filter(t => t.completed);
    } else if (currentFilter === 'high') {
        filtered = todos.filter(t => t.priority === 'high');
    }
    
    // 排序：未完成在前，高優先在前
    filtered.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-message">無待辦任務</p>';
    } else {
        container.innerHTML = '';
        filtered.forEach(todo => {
            const item = document.createElement('div');
            item.className = `todo-item priority-${todo.priority} ${todo.completed ? 'completed' : ''}`;
            
            const dueDateStr = todo.dueDate ? 
                `<span class="due-date">📅 ${todo.dueDate}</span>` : '';
            
            item.innerHTML = `
                <label>
                    <input type="checkbox" ${todo.completed ? 'checked' : ''} 
                           onchange="toggleTodo(${todo.id})">
                    <span class="todo-text">${todo.text}</span>
                </label>
                <div class="todo-meta">
                    <span class="priority-badge">${getPriorityText(todo.priority)}</span>
                    ${dueDateStr}
                    <button onclick="deleteTodo(${todo.id})" class="btn-icon">🗑️</button>
                </div>
            `;
            container.appendChild(item);
        });
    }
    
    // 更新統計
    const activeCount = todos.filter(t => !t.completed).length;
    const completedCount = todos.filter(t => t.completed).length;
    document.getElementById('active-count').textContent = activeCount;
    document.getElementById('completed-count').textContent = completedCount;
}

function getPriorityText(priority) {
    const map = { high: '高', medium: '中', low: '低' };
    return map[priority] || priority;
}

async function toggleTodo(id) {
    const todo = await getTodoById(id);
    if (!todo) return;
    
    todo.completed = !todo.completed;
    await saveTodo(todo);
    loadTodos();
}

async function deleteTodo(id) {
    await deleteFromDB('todos', id);
    loadTodos();
}

function filterTodos(filter) {
    currentFilter = filter;
    
    // 更新按鈕狀態
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    loadTodos();
}

// ===== 工具函數 =====
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('worklog-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = today;
    }
}

// ===== PDF 匯出 =====
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('工作管理系統報表', 20, 20);
    
    let y = 40;
    
    // 匯出工作紀錄
    const worklogs = await getAllWorklogs();
    if (worklogs.length > 0) {
        doc.setFontSize(14);
        doc.text('工作紀錄', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        worklogs.slice(0, 10).forEach(log => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.text(`${log.date} - ${log.title}`, 25, y);
            y += 7;
        });
        y += 10;
    }
    
    // 匯出待辦任務
    const todos = await getAllTodos();
    if (todos.length > 0 && y < 250) {
        doc.setFontSize(14);
        doc.text('待辦任務', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        const activeTodos = todos.filter(t => !t.completed);
        activeTodos.slice(0, 15).forEach(todo => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.text(`[${todo.priority}] ${todo.text}`, 25, y);
            y += 7;
        });
    }
    
    const filename = `工作報表_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    alert('PDF 已匯出！');
}

// ===== Service Worker 註冊 =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('Service Worker 已註冊'))
        .catch(err => console.error('Service Worker 註冊失敗:', err));
}
