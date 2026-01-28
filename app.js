// ==================== Phase 4: 完整 JavaScript ====================
// 功能: 搜尋/篩選、批量操作、釘選、分類、多用戶、XSS防護、UX強化

(function() {
    'use strict';

    // ==================== XSS 防護工具 ====================
    const Security = {
        // HTML escape 防止 XSS
        escapeHTML(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        // 清理 URL（防止 javascript: 協議）
        sanitizeURL(url) {
            if (!url) return '';
            const lower = url.toLowerCase().trim();
            if (lower.startsWith('javascript:') || 
                lower.startsWith('data:') || 
                lower.startsWith('vbscript:')) {
                return '';
            }
            return url;
        },

        // 驗證日期格式
        validateDate(dateStr) {
            if (!dateStr) return null;
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : dateStr;
        },

        // 驗證數字範圍
        validateNumber(num, min = 0, max = 100) {
            const n = parseInt(num, 10);
            if (isNaN(n)) return min;
            return Math.max(min, Math.min(max, n));
        },

        // 清理標籤輸入
        sanitizeTags(tagsStr) {
            if (!tagsStr) return [];
            return tagsStr
                .split(',')
                .map(tag => this.escapeHTML(tag.trim()))
                .filter(tag => tag.length > 0 && tag.length < 50)
                .slice(0, 10); // 最多 10 個標籤
        }
    };

    // ==================== 應用程式主體 ====================
    const App = {
        // 當前用戶
        currentUser: 'default',
        
        // 所有用戶資料
        allUserData: {},
        
        // 當前任務列表
        todos: [],
        
        // 選中的任務
        selectedTodos: new Set(),
        
        // 初始化
        init() {
            this.loadAllUsers();
            this.loadUserData();
            this.updateUserSelect();
            this.loadDarkMode();
            this.setupKeyboardShortcuts();
            this.render();
            this.updateDashboard();
        },

        // ==================== 用戶管理 ====================
        loadAllUsers() {
            try {
                const data = localStorage.getItem('offlineWork_users');
                this.allUserData = data ? JSON.parse(data) : { default: [] };
            } catch (e) {
                this.allUserData = { default: [] };
            }
        },

        saveAllUsers() {
            try {
                localStorage.setItem('offlineWork_users', JSON.stringify(this.allUserData));
            } catch (e) {
                this.showNotification('儲存失敗', 'error');
            }
        },

        loadUserData() {
            this.todos = this.allUserData[this.currentUser] || [];
        },

        saveUserData() {
            this.allUserData[this.currentUser] = this.todos;
            this.saveAllUsers();
        },

        switchUser(username) {
            this.saveUserData();
            this.currentUser = username;
            this.loadUserData();
            this.selectedTodos.clear();
            this.render();
            this.updateDashboard();
            this.updateFilterOptions();
            this.showNotification(`切換到用戶: ${username}`, 'success');
        },

        addNewUser() {
            const username = prompt('輸入新用戶名稱:');
            if (!username) return;
            
            const sanitized = Security.escapeHTML(username.trim());
            if (sanitized.length === 0 || sanitized.length > 30) {
                this.showNotification('用戶名稱長度需在 1-30 字元', 'error');
                return;
            }

            if (this.allUserData[sanitized]) {
                this.showNotification('用戶已存在', 'error');
                return;
            }

            this.allUserData[sanitized] = [];
            this.saveAllUsers();
            this.updateUserSelect();
            this.switchUser(sanitized);
        },

        updateUserSelect() {
            const select = document.getElementById('userSelect');
            if (!select) return;

            select.innerHTML = '';
            Object.keys(this.allUserData).sort().forEach(user => {
                const option = document.createElement('option');
                option.value = user;
                option.textContent = user;
                if (user === this.currentUser) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        },

        // ==================== 新增任務 ====================
        addTodo() {
            const title = document.getElementById('todoTitle').value.trim();
            if (!title) {
                this.showNotification('請輸入任務標題', 'error');
                return;
            }

            const todo = {
                id: Date.now() + Math.random(),
                title: Security.escapeHTML(title),
                description: Security.escapeHTML(document.getElementById('todoDescription').value.trim()),
                category: Security.escapeHTML(document.getElementById('todoCategory').value.trim()) || '未分類',
                status: document.getElementById('todoStatus').value,
                priority: document.getElementById('todoPriority').value,
                dueDate: Security.validateDate(document.getElementById('todoDueDate').value),
                progress: Security.validateNumber(document.getElementById('todoProgress').value, 0, 100),
                tags: Security.sanitizeTags(document.getElementById('todoTags').value),
                pinned: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.todos.unshift(todo);
            this.saveUserData();
            this.clearForm();
            this.render();
            this.updateDashboard();
            this.updateFilterOptions();
            this.showNotification('任務已新增', 'success');
        },

        clearForm() {
            document.getElementById('todoTitle').value = '';
            document.getElementById('todoDescription').value = '';
            document.getElementById('todoCategory').value = '';
            document.getElementById('todoStatus').value = 'todo';
            document.getElementById('todoPriority').value = 'medium';
            document.getElementById('todoDueDate').value = '';
            document.getElementById('todoProgress').value = '';
            document.getElementById('todoTags').value = '';
        },

        // ==================== 釘選功能 ====================
        togglePin(id) {
            const todo = this.todos.find(t => t.id === id);
            if (todo) {
                todo.pinned = !todo.pinned;
                todo.updatedAt = new Date().toISOString();
                this.saveUserData();
                this.render();
            }
        },

        // ==================== 刪除任務 ====================
        deleteTodo(id) {
            this.confirmAction('確定要刪除這個任務？', () => {
                this.todos = this.todos.filter(t => t.id !== id);
                this.selectedTodos.delete(id);
                this.saveUserData();
                this.render();
                this.updateDashboard();
                this.showNotification('任務已刪除', 'success');
            });
        },

        // ==================== 更新任務 ====================
        updateTodoStatus(id, status) {
            const todo = this.todos.find(t => t.id === id);
            if (todo) {
                todo.status = status;
                if (status === 'completed') {
                    todo.progress = 100;
                }
                todo.updatedAt = new Date().toISOString();
                this.saveUserData();
                this.render();
                this.updateDashboard();
            }
        },

        // ==================== 批量操作 ====================
        toggleSelectAll() {
            const filtered = this.getFilteredTodos();
            if (this.selectedTodos.size === filtered.length) {
                this.selectedTodos.clear();
            } else {
                filtered.forEach(todo => this.selectedTodos.add(todo.id));
            }
            this.render();
        },

        bulkComplete() {
            if (this.selectedTodos.size === 0) {
                this.showNotification('請先選擇任務', 'error');
                return;
            }

            this.todos.forEach(todo => {
                if (this.selectedTodos.has(todo.id)) {
                    todo.status = 'completed';
                    todo.progress = 100;
                    todo.updatedAt = new Date().toISOString();
                }
            });

            this.selectedTodos.clear();
            this.saveUserData();
            this.render();
            this.updateDashboard();
            this.showNotification('批量完成成功', 'success');
        },

        bulkDelete() {
            if (this.selectedTodos.size === 0) {
                this.showNotification('請先選擇任務', 'error');
                return;
            }

            this.confirmAction(`確定要刪除 ${this.selectedTodos.size} 個任務？`, () => {
                this.todos = this.todos.filter(t => !this.selectedTodos.has(t.id));
                this.selectedTodos.clear();
                this.saveUserData();
                this.render();
                this.updateDashboard();
                this.showNotification('批量刪除成功', 'success');
            });
        },

        // ==================== 搜尋/篩選 ====================
        filterTodos() {
            this.render();
        },

        getFilteredTodos() {
            let filtered = [...this.todos];

            // 搜尋關鍵字
            const searchTerm = document.getElementById('searchInput')?.value.toLowerCase().trim();
            if (searchTerm) {
                filtered = filtered.filter(todo => 
                    todo.title.toLowerCase().includes(searchTerm) ||
                    todo.description.toLowerCase().includes(searchTerm) ||
                    todo.category.toLowerCase().includes(searchTerm) ||
                    todo.tags.some(tag => tag.toLowerCase().includes(searchTerm))
                );
            }

            // 狀態篩選
            const statusFilter = document.getElementById('filterStatus')?.value;
            if (statusFilter && statusFilter !== 'all') {
                filtered = filtered.filter(todo => todo.status === statusFilter);
            }

            // 優先度篩選
            const priorityFilter = document.getElementById('filterPriority')?.value;
            if (priorityFilter && priorityFilter !== 'all') {
                filtered = filtered.filter(todo => todo.priority === priorityFilter);
            }

            // 分類篩選
            const categoryFilter = document.getElementById('filterCategory')?.value;
            if (categoryFilter && categoryFilter !== 'all') {
                filtered = filtered.filter(todo => todo.category === categoryFilter);
            }

            // 排序: 釘選優先，然後依建立時間
            filtered.sort((a, b) => {
                if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            return filtered;
        },

        clearFilters() {
            document.getElementById('searchInput').value = '';
            document.getElementById('filterStatus').value = 'all';
            document.getElementById('filterPriority').value = 'all';
            document.getElementById('filterCategory').value = 'all';
            this.render();
        },

        updateFilterOptions() {
            const categorySelect = document.getElementById('filterCategory');
            if (!categorySelect) return;

            const categories = new Set();
            this.todos.forEach(todo => categories.add(todo.category));

            const currentValue = categorySelect.value;
            categorySelect.innerHTML = '<option value="all">所有分類</option>';
            
            Array.from(categories).sort().forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                categorySelect.appendChild(option);
            });

            if (categories.has(currentValue)) {
                categorySelect.value = currentValue;
            }
        },

        // ==================== 渲染介面 ====================
        render() {
            const list = document.getElementById('todoList');
            if (!list) return;

            const filtered = this.getFilteredTodos();

            if (filtered.length === 0) {
                list.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-secondary);">目前沒有任務</div>';
                this.updateSelectedCount();
                return;
            }

            list.innerHTML = filtered.map(todo => this.renderTodoItem(todo)).join('');
            this.updateSelectedCount();
        },

        renderTodoItem(todo) {
            const isSelected = this.selectedTodos.has(todo.id);
            const pinnedClass = todo.pinned ? 'pinned' : '';
            const completedClass = todo.status === 'completed' ? 'completed' : '';
            
            const priorityClass = `priority-${todo.priority}`;
            const statusClass = `status-${todo.status}`;

            const statusText = {
                'todo': '待辦',
                'in-progress': '進行中',
                'completed': '已完成'
            }[todo.status] || todo.status;

            const priorityText = {
                'high': '高',
                'medium': '中',
                'low': '低'
            }[todo.priority] || todo.priority;

            const dueDateHTML = todo.dueDate ? 
                `<div class="meta-item">📅 ${todo.dueDate}</div>` : '';

            const tagsHTML = todo.tags.length > 0 ?
                todo.tags.map(tag => `<span class="category-tag">${tag}</span>`).join('') : '';

            return `
                <div class="todo-item ${pinnedClass} ${completedClass}">
                    <div class="todo-header">
                        <input 
                            type="checkbox" 
                            class="todo-checkbox" 
                            ${isSelected ? 'checked' : ''}
                            onchange="app.toggleSelect(${todo.id})"
                        />
                        <div class="todo-title">${todo.title}</div>
                        <button 
                            class="pin-btn ${todo.pinned ? 'active' : ''}" 
                            onclick="app.togglePin(${todo.id})"
                            title="${todo.pinned ? '取消釘選' : '釘選'}"
                        >
                            ${todo.pinned ? '📌' : '📍'}
                        </button>
                    </div>
                    
                    <div class="todo-meta">
                        <div class="meta-item">
                            <span class="category-tag">${todo.category}</span>
                        </div>
                        <div class="meta-item ${statusClass}">狀態: ${statusText}</div>
                        <div class="meta-item ${priorityClass}">優先度: ${priorityText}</div>
                        <div class="meta-item">進度: ${todo.progress}%</div>
                        ${dueDateHTML}
                    </div>

                    ${todo.description ? `<div style="margin: 10px 0; color: var(--text-secondary);">${todo.description}</div>` : ''}
                    
                    ${tagsHTML ? `<div style="margin: 10px 0;">${tagsHTML}</div>` : ''}

                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <button onclick="app.updateTodoStatus(${todo.id}, 'todo')" style="padding: 6px 12px; border: none; border-radius: 4px; background: var(--text-secondary); color: white; cursor: pointer;">待辦</button>
                        <button onclick="app.updateTodoStatus(${todo.id}, 'in-progress')" style="padding: 6px 12px; border: none; border-radius: 4px; background: var(--accent); color: white; cursor: pointer;">進行中</button>
                        <button onclick="app.updateTodoStatus(${todo.id}, 'completed')" style="padding: 6px 12px; border: none; border-radius: 4px; background: var(--success); color: white; cursor: pointer;">完成</button>
                        <button onclick="app.deleteTodo(${todo.id})" style="padding: 6px 12px; border: none; border-radius: 4px; background: var(--danger); color: white; cursor: pointer; margin-left: auto;">刪除</button>
                    </div>
                </div>
            `;
        },

        toggleSelect(id) {
            if (this.selectedTodos.has(id)) {
                this.selectedTodos.delete(id);
            } else {
                this.selectedTodos.add(id);
            }
            this.updateSelectedCount();
        },

        updateSelectedCount() {
            const countElem = document.getElementById('selectedCount');
            const selectAllText = document.getElementById('selectAllText');
            
            if (countElem) {
                if (this.selectedTodos.size > 0) {
                    countElem.textContent = `已選擇 ${this.selectedTodos.size} 個`;
                } else {
                    countElem.textContent = '';
                }
            }

            if (selectAllText) {
                const filtered = this.getFilteredTodos();
                selectAllText.textContent = this.selectedTodos.size === filtered.length ? '取消全選' : '全選';
            }
        },

        // ==================== 統計儀表板 ====================
        updateDashboard() {
            const total = this.todos.length;
            const completed = this.todos.filter(t => t.status === 'completed').length;
            const inProgress = this.todos.filter(t => t.status === 'in-progress').length;
            const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

            document.getElementById('totalCount').textContent = total;
            document.getElementById('completedCount').textContent = completed;
            document.getElementById('inProgressCount').textContent = inProgress;
            document.getElementById('completionRate').textContent = rate + '%';
        },

        // ==================== 匯出功能 ====================
        exportData(format) {
            if (this.todos.length === 0) {
                this.showNotification('沒有資料可匯出', 'error');
                return;
            }

            let content, filename, type;

            switch (format) {
                case 'json':
                    content = JSON.stringify(this.todos, null, 2);
                    filename = `todos_${this.currentUser}_${this.getTimestamp()}.json`;
                    type = 'application/json';
                    break;

                case 'csv':
                    content = this.toCSV(this.todos);
                    filename = `todos_${this.currentUser}_${this.getTimestamp()}.csv`;
                    type = 'text/csv';
                    break;

                case 'excel':
                    this.exportExcel(this.todos, `todos_${this.currentUser}_${this.getTimestamp()}.xlsx`);
                    return;

                case 'markdown':
                    content = this.toMarkdown(this.todos);
                    filename = `todos_${this.currentUser}_${this.getTimestamp()}.md`;
                    type = 'text/markdown';
                    break;
            }

            this.downloadFile(content, filename, type);
            this.showNotification('匯出成功', 'success');
        },

        exportAllUsers() {
            const allData = {};
            Object.keys(this.allUserData).forEach(user => {
                allData[user] = {
                    todos: this.allUserData[user],
                    stats: {
                        total: this.allUserData[user].length,
                        completed: this.allUserData[user].filter(t => t.status === 'completed').length
                    }
                };
            });

            const content = JSON.stringify(allData, null, 2);
            const filename = `all_users_${this.getTimestamp()}.json`;
            this.downloadFile(content, filename, 'application/json');
            this.showNotification('總覽匯出成功', 'success');
        },

        toCSV(todos) {
            const headers = ['標題', '描述', '分類', '狀態', '優先度', '進度', '截止日期', '標籤', '建立時間'];
            const rows = todos.map(todo => [
                todo.title,
                todo.description,
                todo.category,
                todo.status,
                todo.priority,
                todo.progress,
                todo.dueDate || '',
                todo.tags.join(';'),
                todo.createdAt
            ]);

            return [headers, ...rows].map(row => 
                row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
            ).join('\n');
        },

        toMarkdown(todos) {
            let md = `# 任務清單 - ${this.currentUser}\n\n`;
            md += `匯出時間: ${new Date().toLocaleString('zh-TW')}\n\n`;
            
            const groups = {};
            todos.forEach(todo => {
                if (!groups[todo.category]) groups[todo.category] = [];
                groups[todo.category].push(todo);
            });

            Object.keys(groups).sort().forEach(category => {
                md += `## ${category}\n\n`;
                groups[category].forEach(todo => {
                    const checkbox = todo.status === 'completed' ? '[x]' : '[ ]';
                    md += `- ${checkbox} **${todo.title}**\n`;
                    if (todo.description) md += `  - ${todo.description}\n`;
                    md += `  - 優先度: ${todo.priority} | 進度: ${todo.progress}%\n`;
                    if (todo.dueDate) md += `  - 截止: ${todo.dueDate}\n`;
                    md += `\n`;
                });
                md += `\n`;
            });

            return md;
        },

        exportExcel(todos, filename) {
            // 使用 SheetJS (已在 HTML 中引入)
            if (typeof XLSX === 'undefined') {
                this.showNotification('Excel 功能未載入', 'error');
                return;
            }

            const data = todos.map(todo => ({
                '標題': todo.title,
                '描述': todo.description,
                '分類': todo.category,
                '狀態': todo.status,
                '優先度': todo.priority,
                '進度': todo.progress,
                '截止日期': todo.dueDate || '',
                '標籤': todo.tags.join(', '),
                '建立時間': new Date(todo.createdAt).toLocaleString('zh-TW')
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
            XLSX.writeFile(wb, filename);
        },

        // ==================== 匯入功能 ====================
        importData(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (!Array.isArray(imported)) {
                        this.showNotification('格式錯誤', 'error');
                        return;
                    }

                    // 清理並驗證每個任務
                    const cleaned = imported.map(todo => ({
                        id: Date.now() + Math.random(),
                        title: Security.escapeHTML(todo.title || '未命名'),
                        description: Security.escapeHTML(todo.description || ''),
                        category: Security.escapeHTML(todo.category || '未分類'),
                        status: ['todo', 'in-progress', 'completed'].includes(todo.status) ? todo.status : 'todo',
                        priority: ['high', 'medium', 'low'].includes(todo.priority) ? todo.priority : 'medium',
                        dueDate: Security.validateDate(todo.dueDate),
                        progress: Security.validateNumber(todo.progress, 0, 100),
                        tags: Security.sanitizeTags(todo.tags ? todo.tags.join(',') : ''),
                        pinned: false,
                        createdAt: todo.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }));

                    this.todos = [...cleaned, ...this.todos];
                    this.saveUserData();
                    this.render();
                    this.updateDashboard();
                    this.updateFilterOptions();
                    this.showNotification(`成功匯入 ${cleaned.length} 個任務`, 'success');
                } catch (err) {
                    this.showNotification('匯入失敗', 'error');
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        },

        // ==================== 深色模式 ====================
        toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            document.getElementById('themeIcon').textContent = isDark ? '☀️' : '🌙';
            localStorage.setItem('darkMode', isDark);
        },

        loadDarkMode() {
            const isDark = localStorage.getItem('darkMode') === 'true';
            if (isDark) {
                document.body.classList.add('dark-mode');
                document.getElementById('themeIcon').textContent = '☀️';
            }
        },

        // ==================== 鍵盤快捷鍵 ====================
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+F: 聚焦搜尋
                if (e.ctrlKey && e.key === 'f') {
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                }

                // Ctrl+N: 聚焦新增
                if (e.ctrlKey && e.key === 'n') {
                    e.preventDefault();
                    document.getElementById('todoTitle').focus();
                }

                // ESC: 清除選擇
                if (e.key === 'Escape') {
                    this.selectedTodos.clear();
                    this.render();
                }
            });
        },

        // ==================== 工具函數 ====================
        getTimestamp() {
            return new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        },

        downloadFile(content, filename, type) {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        },

        showNotification(message, type = 'info') {
            // 簡單通知（不用 console.log）
            const colors = {
                success: '#27ae60',
                error: '#e74c3c',
                info: '#4a90e2'
            };

            const notif = document.createElement('div');
            notif.textContent = message;
            notif.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                background: ${colors[type]};
                color: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;

            document.body.appendChild(notif);
            setTimeout(() => {
                notif.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => notif.remove(), 300);
            }, 3000);
        },

        confirmAction(message, callback) {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.onclick = () => {
                overlay.remove();
                dialog.remove();
            };

            const dialog = document.createElement('div');
            dialog.className = 'confirm-dialog';
            dialog.innerHTML = `
                <div style="font-size: 18px; margin-bottom: 10px;">${message}</div>
                <div class="confirm-buttons">
                    <button class="btn-confirm-yes">確定</button>
                    <button class="btn-confirm-no">取消</button>
                </div>
            `;

            dialog.querySelector('.btn-confirm-yes').onclick = () => {
                callback();
                overlay.remove();
                dialog.remove();
            };

            dialog.querySelector('.btn-confirm-no').onclick = () => {
                overlay.remove();
                dialog.remove();
            };

            document.body.appendChild(overlay);
            document.body.appendChild(dialog);
        }
    };

    // ==================== 全域暴露 ====================
    window.app = App;

    // ==================== 啟動應用 ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => App.init());
    } else {
        App.init();
    }

})();
