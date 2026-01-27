// 数据库配置与 CRUD 操作
// 使用 Dexie.js 封装 IndexedDB

const db = new Dexie('OfflineWorkManager');

// 定义数据库结构
db.version(1).stores({
  workRecords: '++id, date, content, createdAt',
  todos: '++id, title, priority, dueDate, completed, order, createdAt',
  checkItems: '++id, title, user, periodType, periodValue, lastChecked, nextDue, createdAt',
  templates: '++id, type, content, createdAt'
});

// ==================== 工作纪录 CRUD ====================

const WorkRecords = {
  // 创建工作纪录
  async create(data) {
    try {
      const record = {
        date: data.date || new Date().toISOString().split('T')[0],
        content: data.content || '',
        images: data.images || [], // Base64 数组
        tags: data.tags || [],
        createdAt: new Date().toISOString()
      };
      const id = await db.workRecords.add(record);
      return { success: true, id, record: { ...record, id } };
    } catch (error) {
      console.error('创建工作纪录失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 获取所有工作纪录（按日期降序）
  async getAll() {
    try {
      const records = await db.workRecords
        .orderBy('date')
        .reverse()
        .toArray();
      return { success: true, records };
    } catch (error) {
      console.error('获取工作纪录失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 根据 ID 获取单条纪录
  async getById(id) {
    try {
      const record = await db.workRecords.get(id);
      return { success: true, record };
    } catch (error) {
      console.error('获取工作纪录失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 根据日期范围获取
  async getByDateRange(startDate, endDate) {
    try {
      const records = await db.workRecords
        .where('date')
        .between(startDate, endDate, true, true)
        .reverse()
        .toArray();
      return { success: true, records };
    } catch (error) {
      console.error('获取日期范围纪录失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 搜索工作纪录（内容或标签）
  async search(keyword) {
    try {
      const allRecords = await db.workRecords.toArray();
      const results = allRecords.filter(record => {
        const contentMatch = record.content.toLowerCase().includes(keyword.toLowerCase());
        const tagMatch = record.tags.some(tag => tag.toLowerCase().includes(keyword.toLowerCase()));
        return contentMatch || tagMatch;
      });
      return { success: true, records: results };
    } catch (error) {
      console.error('搜索工作纪录失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 更新工作纪录
  async update(id, data) {
    try {
      await db.workRecords.update(id, data);
      const record = await db.workRecords.get(id);
      return { success: true, record };
    } catch (error) {
      console.error('更新工作纪录失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 删除工作纪录
  async delete(id) {
    try {
      await db.workRecords.delete(id);
      return { success: true };
    } catch (error) {
      console.error('删除工作纪录失败:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==================== 代办事项 CRUD ====================

const Todos = {
  // 创建代办事项
  async create(data) {
    try {
      const maxOrder = await db.todos.orderBy('order').last();
      const todo = {
        title: data.title || '',
        priority: data.priority || 'medium',
        dueDate: data.dueDate || null,
        completed: false,
        order: maxOrder ? maxOrder.order + 1 : 0,
        createdAt: new Date().toISOString()
      };
      const id = await db.todos.add(todo);
      return { success: true, id, todo: { ...todo, id } };
    } catch (error) {
      console.error('创建代办事项失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 获取所有代办事项（按 order 排序）
  async getAll(includeCompleted = true) {
    try {
      let query = db.todos.orderBy('order');
      if (!includeCompleted) {
        const todos = await query.toArray();
        const filtered = todos.filter(t => !t.completed);
        return { success: true, todos: filtered };
      }
      const todos = await query.toArray();
      return { success: true, todos };
    } catch (error) {
      console.error('获取代办事项失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 根据优先级获取
  async getByPriority(priority) {
    try {
      const todos = await db.todos
        .where('priority')
        .equals(priority)
        .and(t => !t.completed)
        .sortBy('order');
      return { success: true, todos };
    } catch (error) {
      console.error('获取优先级代办失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 更新代办事项
  async update(id, data) {
    try {
      await db.todos.update(id, data);
      const todo = await db.todos.get(id);
      return { success: true, todo };
    } catch (error) {
      console.error('更新代办事项失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 切换完成状态
  async toggleComplete(id) {
    try {
      const todo = await db.todos.get(id);
      await db.todos.update(id, { completed: !todo.completed });
      return { success: true, completed: !todo.completed };
    } catch (error) {
      console.error('切换完成状态失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 更新排序
  async updateOrder(id, newOrder) {
    try {
      await db.todos.update(id, { order: newOrder });
      return { success: true };
    } catch (error) {
      console.error('更新排序失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 批量更新排序
  async batchUpdateOrder(orderMap) {
    try {
      await db.transaction('rw', db.todos, async () => {
        for (const [id, order] of Object.entries(orderMap)) {
          await db.todos.update(parseInt(id), { order });
        }
      });
      return { success: true };
    } catch (error) {
      console.error('批量更新排序失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 删除代办事项
  async delete(id) {
    try {
      await db.todos.delete(id);
      return { success: true };
    } catch (error) {
      console.error('删除代办事项失败:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==================== 核对事项 CRUD ====================

const CheckItems = {
  // 创建核对事项
  async create(data) {
    try {
      const now = new Date();
      const nextDue = this.calculateNextDue(now, data.periodType, data.periodValue);
      
      const item = {
        title: data.title || '',
        user: data.user || '',
        periodType: data.periodType || 'daily',
        periodValue: data.periodValue || 1,
        lastChecked: null,
        nextDue: nextDue.toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };
      const id = await db.checkItems.add(item);
      return { success: true, id, item: { ...item, id } };
    } catch (error) {
      console.error('创建核对事项失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 计算下次到期日
  calculateNextDue(fromDate, periodType, periodValue) {
    const date = new Date(fromDate);
    switch (periodType) {
      case 'daily':
        date.setDate(date.getDate() + periodValue);
        break;
      case 'weekly':
        date.setDate(date.getDate() + (periodValue * 7));
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + periodValue);
        break;
    }
    return date;
  },

  // 获取所有核对事项
  async getAll() {
    try {
      const items = await db.checkItems
        .orderBy('nextDue')
        .toArray();
      return { success: true, items };
    } catch (error) {
      console.error('获取核对事项失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 获取到期或即将到期的事项
  async getDue(daysAhead = 0) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);
      
      const items = await db.checkItems
        .where('nextDue')
        .belowOrEqual(futureDate.toISOString().split('T')[0])
        .toArray();
      return { success: true, items };
    } catch (error) {
      console.error('获取到期事项失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 标记为已检查
  async markChecked(id) {
    try {
      const item = await db.checkItems.get(id);
      const now = new Date();
      const nextDue = this.calculateNextDue(now, item.periodType, item.periodValue);
      
      await db.checkItems.update(id, {
        lastChecked: now.toISOString().split('T')[0],
        nextDue: nextDue.toISOString().split('T')[0]
      });
      return { success: true, nextDue: nextDue.toISOString().split('T')[0] };
    } catch (error) {
      console.error('标记检查失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 更新核对事项
  async update(id, data) {
    try {
      // 如果修改了周期，重新计算 nextDue
      if (data.periodType || data.periodValue) {
        const item = await db.checkItems.get(id);
        const baseDate = item.lastChecked ? new Date(item.lastChecked) : new Date();
        const nextDue = this.calculateNextDue(
          baseDate,
          data.periodType || item.periodType,
          data.periodValue || item.periodValue
        );
        data.nextDue = nextDue.toISOString().split('T')[0];
      }
      
      await db.checkItems.update(id, data);
      const item = await db.checkItems.get(id);
      return { success: true, item };
    } catch (error) {
      console.error('更新核对事项失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 删除核对事项
  async delete(id) {
    try {
      await db.checkItems.delete(id);
      return { success: true };
    } catch (error) {
      console.error('删除核对事项失败:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==================== 模板 CRUD ====================

const Templates = {
  // 创建模板
  async create(data) {
    try {
      const template = {
        type: data.type || 'todo',
        content: data.content || {},
        createdAt: new Date().toISOString()
      };
      const id = await db.templates.add(template);
      return { success: true, id, template: { ...template, id } };
    } catch (error) {
      console.error('创建模板失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 获取所有模板
  async getAll(type = null) {
    try {
      let templates;
      if (type) {
        templates = await db.templates.where('type').equals(type).toArray();
      } else {
        templates = await db.templates.toArray();
      }
      return { success: true, templates };
    } catch (error) {
      console.error('获取模板失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 删除模板
  async delete(id) {
    try {
      await db.checkItems.delete(id);
      return { success: true };
    } catch (error) {
      console.error('删除模板失败:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==================== 通用功能 ====================

const DbUtils = {
  // 获取数据库统计
  async getStats() {
    try {
      const [workCount, todoCount, checkCount, templateCount] = await Promise.all([
        db.workRecords.count(),
        db.todos.count(),
        db.checkItems.count(),
        db.templates.count()
      ]);
      return {
        success: true,
        stats: {
          workRecords: workCount,
          todos: todoCount,
          checkItems: checkCount,
          templates: templateCount
        }
      };
    } catch (error) {
      console.error('获取统计失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 清空所有数据
  async clearAll() {
    try {
      await db.transaction('rw', db.workRecords, db.todos, db.checkItems, db.templates, async () => {
        await db.workRecords.clear();
        await db.todos.clear();
        await db.checkItems.clear();
        await db.templates.clear();
      });
      return { success: true };
    } catch (error) {
      console.error('清空数据失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 导出所有数据（用于备份）
  async exportAll() {
    try {
      const [workRecords, todos, checkItems, templates] = await Promise.all([
        db.workRecords.toArray(),
        db.todos.toArray(),
        db.checkItems.toArray(),
        db.templates.toArray()
      ]);
      return {
        success: true,
        data: {
          workRecords,
          todos,
          checkItems,
          templates,
          exportedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('导出数据失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 导入数据（从备份恢复）
  async importAll(data) {
    try {
      await db.transaction('rw', db.workRecords, db.todos, db.checkItems, db.templates, async () => {
        if (data.workRecords) await db.workRecords.bulkAdd(data.workRecords);
        if (data.todos) await db.todos.bulkAdd(data.todos);
        if (data.checkItems) await db.checkItems.bulkAdd(data.checkItems);
        if (data.templates) await db.templates.bulkAdd(data.templates);
      });
      return { success: true };
    } catch (error) {
      console.error('导入数据失败:', error);
      return { success: false, error: error.message };
    }
  }
};

// 导出所有模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { db, WorkRecords, Todos, CheckItems, Templates, DbUtils };
}
