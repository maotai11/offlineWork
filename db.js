// ===== IndexedDB 初始化 =====
const DB_NAME = 'OfflineWorkDB';
const DB_VERSION = 1;
let db = null;

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // 月曆事項
            if (!db.objectStoreNames.contains('calendar')) {
                const calendarStore = db.createObjectStore('calendar', { keyPath: 'id', autoIncrement: true });
                calendarStore.createIndex('date', 'date', { unique: false });
            }
            
            // 工作紀錄
            if (!db.objectStoreNames.contains('worklogs')) {
                const worklogStore = db.createObjectStore('worklogs', { keyPath: 'id', autoIncrement: true });
                worklogStore.createIndex('date', 'date', { unique: false });
                worklogStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            // 核對清單
            if (!db.objectStoreNames.contains('checklists')) {
                const checklistStore = db.createObjectStore('checklists', { keyPath: 'id', autoIncrement: true });
                checklistStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            // 待辦任務
            if (!db.objectStoreNames.contains('todos')) {
                const todoStore = db.createObjectStore('todos', { keyPath: 'id', autoIncrement: true });
                todoStore.createIndex('completed', 'completed', { unique: false });
                todoStore.createIndex('priority', 'priority', { unique: false });
                todoStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// ===== 通用資料庫操作 =====
async function addToDB(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function updateDB(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getFromDB(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllFromDB(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteFromDB(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ===== 月曆事項操作 =====
async function saveCalendarEvent(event) {
    if (event.id) {
        return await updateDB('calendar', event);
    } else {
        return await addToDB('calendar', event);
    }
}

async function getCalendarEvents(date) {
    const dateStr = date.toISOString().split('T')[0];
    const allEvents = await getAllFromDB('calendar');
    return allEvents.filter(event => event.date === dateStr);
}

// ===== 工作紀錄操作 =====
async function saveWorklogToDB(worklog) {
    if (worklog.id) {
        return await updateDB('worklogs', worklog);
    } else {
        return await addToDB('worklogs', worklog);
    }
}

async function getAllWorklogs() {
    return await getAllFromDB('worklogs');
}

async function getWorklogById(id) {
    return await getFromDB('worklogs', id);
}

async function searchWorklogs(query) {
    const allWorklogs = await getAllWorklogs();
    const lowerQuery = query.toLowerCase();
    
    return allWorklogs.filter(log => {
        const titleMatch = log.title.toLowerCase().includes(lowerQuery);
        const contentMatch = log.content && log.content.toLowerCase().includes(lowerQuery);
        const tagsMatch = log.tags && log.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
        
        return titleMatch || contentMatch || tagsMatch;
    });
}

async function getWorklogsByDateRange(startDate, endDate) {
    const allWorklogs = await getAllWorklogs();
    return allWorklogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= startDate && logDate <= endDate;
    });
}

// ===== 核對清單操作 =====
async function saveChecklistToDB(checklist) {
    if (checklist.id) {
        return await updateDB('checklists', checklist);
    } else {
        return await addToDB('checklists', checklist);
    }
}

async function getAllChecklists() {
    return await getAllFromDB('checklists');
}

async function getChecklistById(id) {
    return await getFromDB('checklists', id);
}

// ===== 待辦任務操作 =====
async function saveTodo(todo) {
    if (todo.id) {
        return await updateDB('todos', todo);
    } else {
        return await addToDB('todos', todo);
    }
}

async function getAllTodos() {
    return await getAllFromDB('todos');
}

async function getTodoById(id) {
    return await getFromDB('todos', id);
}

async function getActiveTodos() {
    const allTodos = await getAllTodos();
    return allTodos.filter(todo => !todo.completed);
}

async function getCompletedTodos() {
    const allTodos = await getAllTodos();
    return allTodos.filter(todo => todo.completed);
}

// ===== 資料匯出/匯入 =====
async function exportAllData() {
    const data = {
        calendar: await getAllFromDB('calendar'),
        worklogs: await getAllFromDB('worklogs'),
        checklists: await getAllFromDB('checklists'),
        todos: await getAllFromDB('todos'),
        exportDate: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
}

async function importData(jsonData) {
    const data = JSON.parse(jsonData);
    
    // 清空現有資料
    const stores = ['calendar', 'worklogs', 'checklists', 'todos'];
    for (const store of stores) {
        const all = await getAllFromDB(store);
        for (const item of all) {
            await deleteFromDB(store, item.id);
        }
    }
    
    // 匯入新資料
    if (data.calendar) {
        for (const item of data.calendar) {
            delete item.id; // 讓系統自動生成新 ID
            await addToDB('calendar', item);
        }
    }
    
    if (data.worklogs) {
        for (const item of data.worklogs) {
            delete item.id;
            await addToDB('worklogs', item);
        }
    }
    
    if (data.checklists) {
        for (const item of data.checklists) {
            delete item.id;
            await addToDB('checklists', item);
        }
    }
    
    if (data.todos) {
        for (const item of data.todos) {
            delete item.id;
            await addToDB('todos', item);
        }
    }
    
    return true;
}

// ===== 資料統計 =====
async function getStatistics() {
    const worklogs = await getAllWorklogs();
    const todos = await getAllTodos();
    const checklists = await getAllChecklists();
    const calendar = await getAllFromDB('calendar');
    
    return {
        totalWorklogs: worklogs.length,
        totalTodos: todos.length,
        activeTodos: todos.filter(t => !t.completed).length,
        completedTodos: todos.filter(t => t.completed).length,
        totalChecklists: checklists.length,
        totalCalendarEvents: calendar.length
    };
}
