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
        
        // ✨ 檢查是否有事項標記
        checkDateHasItems(cellDate).then(hasItems => {
            if (hasItems) {
                dayCell.classList.add('has-event');
            }
        });
        
        dayCell.onclick = () => selectDate(cellDate);
        grid.appendChild(dayCell);
    }
}

// ✨ 新增：檢查日期是否有事項
async function checkDateHasItems(date) {
    const dateStr = date.toISOString().split('T')[0];
    
    // 檢查工作紀錄
    const worklogs = await getAllWorklogs();
    const hasWorklog = worklogs.some(w => w.date === dateStr);
    
    // 檢查待辦任務
    const todos = await getAllTodos();
    const hasTodo = todos.some(t => t.dueDate === dateStr);
    
    // 檢查核對清單
    const checklists = await getAllChecklists();
    const hasChecklist = checklists.some(c => c.date === dateStr);
    
    return hasWorklog || hasTodo || hasChecklist;
}

function selectDate(date) {
    selectedDate = date;
    renderCalendar();
    loadDateItems(date);
}

async function loadDateItems(date) {
    const dateStr = date.toISOString().split('T')[0];
    const container = document.getElementById('date-items');
    
    container.innerHTML = `<h3>${dateStr} 的事項</h3>`;
    
    // 工作紀錄
    const worklogs = await getAllWorklogs();
    const dayWorklogs = worklogs.filter(w => w.date === dateStr);
    
    if (dayWorklogs.length > 0) {
        container.innerHTML += '<h4>📝 工作紀錄</h4>';
        dayWorklogs.forEach(w => {
            container.innerHTML += `<div class="date-item">${w.title}</div>`;
        });
    }
    
    // 待辦任務
    const todos = await getAllTodos();
    const dayTodos = todos.filter(t => t.dueDate === dateStr);
    
    if (dayTodos.length > 0) {
        container.innerHTML += '<h4>📋 待辦任務</h4>';
        dayTodos.forEach(t => {
            container.innerHTML += `<div class="date-item">${t.text}</div>`;
        });
    }
    
    // 核對清單
    const checklists = await getAllChecklists();
    const dayChecklists = checklists.filter(c => c.date === dateStr);
    
    if (dayChecklists.length > 0) {
        container.innerHTML += '<h4>✅ 核對清單</h4>';
        dayChecklists.forEach(c => {
            container.innerHTML += `<div class="date-item">${c.title}</div>`;
        });
    }
    
    if (dayWorklogs.length === 0 && dayTodos.length === 0 && dayChecklists.length === 0) {
        container.innerHTML += '<p class="empty-message">這天沒有事項</p>';
    }
}

function prevMonth() {
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
    loadDateItems(selectedDate);
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
    renderCalendar(); // ✨ 重新渲染月曆以更新標記
}

async function loadWorklogs() {
    const worklogs = await getAllWorklogs();
    const container = document.getElementById('worklogs-list');
    
    if (worklogs.length === 0) {
        container.innerHTML = '<p class="empty-message">尚無工作紀錄</p>';
        return;
    }
    
    // 按日期排序
    worklogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    container.innerHTML = '';
    worklogs.forEach(worklog => {
        const card = document.createElement('div');
        card.className = 'worklog-card';
        
        const tagsHtml = worklog.tags && worklog.tags.length > 0
            ? worklog.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
            : '';
        
        card.innerHTML = `
            <div class="worklog-header">
                <h3>${worklog.title}</h3>
                <div class="worklog-actions">
                    <button onclick="editWorklog(${worklog.id})" class="btn-icon">✏️</button>
                    <button onclick="deleteWorklog(${worklog.id})" class="btn-icon">🗑️</button>
                </div>
            </div>
            <div class="worklog-meta">
                <span>📅 ${worklog.date}</span>
                ${tagsHtml}
            </div>
            <div class="worklog-content">${worklog.content || ''}</div>
        `;
        
        container.appendChild(card);
    });
}

async function editWorklog(id) {
    const worklog = await getWorklogById(id);
    if (!worklog) return;
    
    editingWorklogId = id;
    document.getElementById('worklog-date').value = worklog.date;
    document.getElementById('worklog-title').value = worklog.title;
    document.getElementById('worklog-content').value = worklog.content || '';
    document.getElementById('worklog-tags').value = worklog.tags ? worklog.tags.join(', ') : '';
    
    showAddWorklog();
}

async function deleteWorklog(id) {
    if (!confirm('確定要刪除這筆工作紀錄嗎？')) return;
    
    await deleteFromDB('worklogs', id);
    loadWorklogs();
    renderCalendar(); // ✨ 重新渲染月曆
}

function searchWorklogs() {
    const keyword = document.getElementById('worklog-search').value.toLowerCase();
    const cards = document.querySelectorAll('.worklog-card');
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(keyword) ? 'block' : 'none';
    });
}

async function filterWorklogsByDate(range) {
    const worklogs = await getAllWorklogs();
    const container = document.getElementById('worklogs-list');
    
    const now = new Date();
    let filtered = worklogs;
    
    if (range === 'today') {
        const today = now.toISOString().split('T')[0];
        filtered = worklogs.filter(w => w.date === today);
    } else if (range === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = worklogs.filter(w => new Date(w.date) >= weekAgo);
    } else if (range === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = worklogs.filter(w => new Date(w.date) >= monthAgo);
    }
    
    // 顯示結果
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-message">該時段無工作紀錄</p>';
        return;
    }
    
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    container.innerHTML = '';
    filtered.forEach(worklog => {
        const card = document.createElement('div');
        card.className = 'worklog-card';
        
        const tagsHtml = worklog.tags && worklog.tags.length > 0
            ? worklog.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
            : '';
        
        card.innerHTML = `
            <div class="worklog-header">
                <h3>${worklog.title}</h3>
                <div class="worklog-actions">
                    <button onclick="editWorklog(${worklog.id})" class="btn-icon">✏️</button>
                    <button onclick="deleteWorklog(${worklog.id})" class="btn-icon">🗑️</button>
                </div>
            </div>
            <div class="worklog-meta">
                <span>📅 ${worklog.date}</span>
                ${tagsHtml}
            </div>
            <div class="worklog-content">${worklog.content || ''}</div>
        `;
        
        container.appendChild(card);
    });
}

// ===== 核對清單功能 ===== (✨ 改進版：N天/週/月)
function showAddChecklist() {
    document.getElementById('checklist-form').classList.remove('hidden');
}

function cancelChecklist() {
    document.getElementById('checklist-form').classList.add('hidden');
    clearChecklistForm();
}

function clearChecklistForm() {
    document.getElementById('checklist-title').value = '';
    document.getElementById('checklist-items').value = '';
    document.getElementById('checklist-date').value = '';
    document.getElementById('checklist-repeat').value = 'none';
    document.getElementById('checklist-repeat-count').value = '1';
    editingChecklistId = null;
}

function addChecklistItem() {
    const input = document.getElementById('checklist-item-input');
    const text = input.value.trim();
    if (!text) return;
    
    const textarea = document.getElementById('checklist-items');
    textarea.value += (textarea.value ? '\n' : '') + text;
    input.value = '';
}

async function saveChecklist() {
    const title = document.getElementById('checklist-title').value.trim();
    const itemsText = document.getElementById('checklist-items').value.trim();
    const date = document.getElementById('checklist-date').value;
    const repeat = document.getElementById('checklist-repeat').value;
    const repeatCount = parseInt(document.getElementById('checklist-repeat-count').value) || 1;
    
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
        date: date || null,
        repeat,
        repeatCount,
        timestamp: Date.now()
    };
    
    if (editingChecklistId) {
        checklist.id = editingChecklistId;
    }
    
    await saveChecklistToDB(checklist);
    cancelChecklist();
    loadChecklists();
    renderCalendar(); // ✨ 重新渲染月曆
}

async function loadChecklists() {
    const checklists = await getAllChecklists();
    const container = document.getElementById('checklists-container');
    
    if (checklists.length === 0) {
        container.innerHTML = '<p class="empty-message">尚無核對清單</p>';
        return;
    }
    
    container.innerHTML = '';
    
    for (const checklist of checklists) {
        // ✨ 根據重複次數生成多個區塊
        const blockCount = checklist.repeatCount || 1;
        
        for (let i = 0; i < blockCount; i++) {
            const card = document.createElement('div');
            card.className = 'checklist-card';
            
            const progress = checklist.items.filter(item => item.checked).length;
            const total = checklist.items.length;
            const progressPercent = total > 0 ? (progress / total * 100).toFixed(0) : 0;
            
            // 計算日期標籤
            let dateLabel = '';
            if (checklist.date) {
                dateLabel = `📅 ${checklist.date}`;
            }
            if (checklist.repeat !== 'none' && blockCount > 1) {
                dateLabel += ` [${i + 1}/${blockCount}]`;
            }
            
            card.innerHTML = `
                <div class="checklist-header">
                    <h3>${checklist.title}</h3>
                    <div class="checklist-actions">
                        <button onclick="editChecklist(${checklist.id})" class="btn-icon">✏️</button>
                        <button onclick="resetChecklist(${checklist.id})" class="btn-icon" title="重置">🔄</button>
                        <button onclick="deleteChecklist(${checklist.id})" class="btn-icon">🗑️</button>
                    </div>
                </div>
                ${dateLabel ? `<div class="checklist-meta">${dateLabel}</div>` : ''}
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                </div>
                <div class="progress-text">${progress} / ${total} 項目已完成</div>
                <div class="checklist-items">
                    ${checklist.items.map((item, idx) => `
                        <label class="checklist-item">
                            <input type="checkbox" ${item.checked ? 'checked' : ''} 
                                onchange="toggleChecklistItem(${checklist.id}, ${idx})">
                            <span class="${item.checked ? 'checked' : ''}">${item.text}</span>
                        </label>
                    `).join('')}
                </div>
            `;
            
            container.appendChild(card);
        }
    }
}

async function editChecklist(id) {
    const checklist = await getChecklistById(id);
    if (!checklist) return;
    
    editingChecklistId = id;
    document.getElementById('checklist-title').value = checklist.title;
    document.getElementById('checklist-items').value = checklist.items.map(i => i.text).join('\n');
    document.getElementById('checklist-date').value = checklist.date || '';
    document.getElementById('checklist-repeat').value = checklist.repeat || 'none';
    document.getElementById('checklist-repeat-count').value = checklist.repeatCount || 1;
    
    showAddChecklist();
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
    renderCalendar(); // ✨ 重新渲染月曆
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
    renderCalendar(); // ✨ 重新渲染月曆
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
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-message">沒有待辦事項</p>';
    } else {
        container.innerHTML = '';
        filtered.forEach(todo => {
            const item = document.createElement('div');
            item.className = `todo-item priority-${todo.priority} ${todo.completed ? 'completed' : ''}`;
            
            const dueDateStr = todo.dueDate 
                ? `<span class="due-date">📅 ${todo.dueDate}</span>`
                : '';
            
            item.innerHTML = `
                <label>
                    <input type="checkbox" ${todo.completed ? 'checked' : ''} 
                        onchange="toggleTodo(${todo.id})">
                    <span>${todo.text}</span>
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
    renderCalendar(); // ✨ 重新渲染月曆
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

// ===== PDF 匯出功能 ===== (✨ 支援月曆+三區塊)
async function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let yPos = 20;
    
    // 標題
    doc.setFontSize(18);
    doc.text('工作報表', 105, yPos, { align: 'center' });
    yPos += 15;
    
    // 匯出日期
    doc.setFontSize(10);
    doc.text(`匯出日期: ${new Date().toLocaleDateString('zh-TW')}`, 20, yPos);
    yPos += 10;
    
    // 選項：月曆 or 三區塊 or 全部
    const includeCalendar = confirm('是否包含月曆視圖？');
    const includeBlocks = confirm('是否包含工作紀錄、核對清單、待辦任務？');
    
    // ✨ 月曆匯出
    if (includeCalendar) {
        doc.setFontSize(14);
        doc.text('📅 月曆', 20, yPos);
        yPos += 10;
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        doc.setFontSize(10);
        doc.text(`${year}年 ${month}月`, 20, yPos);
        yPos += 8;
        
        // 簡化月曆表格
        const daysInMonth = new Date(year, month, 0).getDate();
        const worklogs = await getAllWorklogs();
        const todos = await getAllTodos();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayWorklogs = worklogs.filter(w => w.date === dateStr);
            const dayTodos = todos.filter(t => t.dueDate === dateStr);
            
            if (dayWorklogs.length > 0 || dayTodos.length > 0) {
                doc.text(`${day}日: ${dayWorklogs.length}紀錄, ${dayTodos.length}任務`, 25, yPos);
                yPos += 6;
                
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
            }
        }
        
        yPos += 10;
    }
    
    // ✨ 三區塊匯出
    if (includeBlocks) {
        // 工作紀錄
        doc.setFontSize(14);
        doc.text('📝 工作紀錄', 20, yPos);
        yPos += 10;
        
        const worklogs = await getAllWorklogs();
        worklogs.slice(0, 10).forEach(w => {
            doc.setFontSize(10);
            doc.text(`${w.date} - ${w.title}`, 25, yPos);
            yPos += 6;
            
            if (w.content) {
                doc.setFontSize(9);
                const lines = doc.splitTextToSize(w.content, 170);
                lines.slice(0, 3).forEach(line => {
                    doc.text(line, 30, yPos);
                    yPos += 5;
                });
            }
            
            yPos += 5;
            
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
        });
        
        // 待辦任務
        yPos += 10;
        doc.setFontSize(14);
        doc.text('📋 待辦任務', 20, yPos);
        yPos += 10;
        
        const todos = await getAllTodos();
        const activeTodos = todos.filter(t => !t.completed);
        
        activeTodos.slice(0, 20).forEach(todo => {
            const status = todo.completed ? '✓' : '○';
            const priority = getPriorityText(todo.priority);
            const dueDate = todo.dueDate ? ` (${todo.dueDate})` : '';
            
            doc.setFontSize(10);
            doc.text(`${status} [${priority}] ${todo.text}${dueDate}`, 25, yPos);
            yPos += 7;
            
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
        });
        
        // 核對清單
        yPos += 10;
        doc.setFontSize(14);
        doc.text('✅ 核對清單', 20, yPos);
        yPos += 10;
        
        const checklists = await getAllChecklists();
        checklists.slice(0, 5).forEach(list => {
            doc.setFontSize(11);
            doc.text(list.title, 25, yPos);
            yPos += 7;
            
            list.items.forEach(item => {
                const status = item.checked ? '✓' : '○';
                doc.setFontSize(9);
                doc.text(`  ${status} ${item.text}`, 30, yPos);
                yPos += 6;
                
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
            });
            
            yPos += 5;
        });
    }
    
    // 儲存 PDF
    const filename = `工作報表_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}
