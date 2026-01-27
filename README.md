# Offline Work Manager Pro

完全离线的工作管理应用，无需网络连接，数据存储在本地浏览器。

## 功能特性

### 核心模块
1. **工作纪录** - 记录日常工作内容
   - 支持文字描述
   - 图片上传（自动压缩为Base64）
   - 自定义标签
   - 日期选择（月历组件）

2. **代办事项** - 任务管理
   - 优先级设置（高/中/低）
   - 预计完成日期
   - 固定模板快速创建
   - 拖放排序

3. **每期核对事项** - 周期性任务
   - 用户/部门区分
   - 灵活周期设定（每N日/周/月）
   - 自动提醒到期事项

### 高级功能
- **月历视图** - 首页整合月历显示所有事项，可点击交互
- **关键字搜索** - 快速查找任何记录
- **PDF导出** - 支持单一区域或全部导出，包含月历视图
- **拖放排序** - 直观调整任务顺序
- **完全离线** - 无需网络，所有资源本地化

## 技术架构

### 核心技术栈
- **纯前端** - HTML5 + Vanilla JavaScript
- **Service Worker** - 实现离线访问
- **IndexedDB** - 本地数据存储（通过 Dexie.js）
- **Pico CSS** - 轻量级样式框架

### 使用的库（全部本地化）
- `dexie.js` - IndexedDB 封装
- `flatpickr` - 日期选择器
- `sortable.js` - 拖放功能
- `html2canvas` + `jspdf` - PDF 生成
- `browser-image-compression` - 图片压缩

## 安全特性

✅ 无外部 CDN 依赖  
✅ 所有 CSS/JS 本地化  
✅ 防 XSS 攻击（使用 textContent/innerText）  
✅ 数据完全本地存储  
✅ 无网络请求  

## 安装与使用

### 方式一：直接打开
1. 下载整个项目文件夹
2. 用浏览器打开 `index.html`
3. 首次访问会自动安装 Service Worker
4. 刷新页面后即可完全离线使用

### 方式二：本地服务器（推荐）
```bash
# 使用 Python 3
python -m http.server 8000

# 或使用 Node.js
npx serve
```
然后访问 `http://localhost:8000`

## 项目结构

```
offline-work-manager-pro/
├── index.html              # 主页面
├── styles.css              # 样式文件
├── app.js                  # 主应用逻辑
├── db.js                   # 数据库配置与 CRUD
├── service-worker.js       # Service Worker
├── README.md               # 本文档
├── libs/                   # 第三方库（本地）
│   ├── dexie.min.js
│   ├── flatpickr.min.js
│   ├── flatpickr.min.css
│   ├── sortable.min.js
│   ├── html2canvas.min.js
│   ├── jspdf.umd.min.js
│   └── browser-image-compression.js
└── icons/                  # 本地图标
    └── sprite.svg
```

## 数据库结构

### workRecords（工作纪录）
- id
- date
- content
- images (Base64数组)
- tags
- createdAt

### todos（代办事项）
- id
- title
- priority (high/medium/low)
- dueDate
- completed
- order
- createdAt

### checkItems（核对事项）
- id
- title
- user
- periodType (daily/weekly/monthly)
- periodValue (数字)
- lastChecked
- nextDue
- createdAt

### templates（固定模板）
- id
- type (todo/check)
- content
- createdAt

## 使用说明

### 工作纪录
1. 点击「新增工作纪录」
2. 选择日期（点击日期框弹出月历）
3. 输入工作内容
4. 可选：上传图片（自动压缩）
5. 添加标签（用逗号分隔）
6. 保存

### 代办事项
1. 点击「新增代办」
2. 输入任务标题
3. 设置优先级和截止日期
4. 保存后可拖放调整顺序
5. 完成后勾选标记完成

### 每期核对事项
1. 点击「新增核对事项」
2. 输入事项名称和负责人
3. 设置周期（例如：每3天、每2周、每1月）
4. 系统自动计算下次到期日
5. 到期时会在月历上高亮显示

### 月历视图
- 首页显示当月月历
- 不同颜色标记不同类型事项
- 点击日期查看该日所有事项
- 左右箭头切换月份

### PDF 导出
- 点击「导出 PDF」按钮
- 选择导出范围：
  - 全部导出
  - 仅工作纪录
  - 仅代办事项
  - 仅核对事项
  - 当前月历视图
- 生成 PDF 文件下载

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+

需要支持：
- Service Worker
- IndexedDB
- ES6+

## 常见问题

**Q: 数据存储在哪里？**  
A: 数据存储在浏览器的 IndexedDB 中，完全本地，不会上传到任何服务器。

**Q: 换电脑后数据会丢失吗？**  
A: 是的，数据只存在当前浏览器。建议定期导出 PDF 备份，或使用浏览器的导出/导入功能（开发中）。

**Q: 清除浏览器缓存会丢失数据吗？**  
A: 清除「网站数据」或「IndexedDB」会丢失数据，但清除「缓存文件」不会影响数据。

**Q: 可以在手机上用吗？**  
A: 可以，但体验为桌面优化。移动端可能需要横屏使用。

**Q: 如何卸载？**  
A: 浏览器设置 → 网站设置 → 找到本应用 → 清除数据并注销 Service Worker。

## 开发指南

### 添加新功能
1. 在 `db.js` 中定义新数据表
2. 在 `app.js` 中添加 UI 和逻辑
3. 更新 `service-worker.js` 的缓存版本

### 调试
```javascript
// 查看数据库内容
await db.workRecords.toArray()
await db.todos.toArray()

// 清空数据库
await db.delete()
await db.open()
```

### 更新 Service Worker
修改 `service-worker.js` 中的 `CACHE_VERSION`，用户刷新页面后自动更新。

## 许可证

MIT License - 自由使用、修改、分发

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**最后更新**: 2026-01-27  
**版本**: 1.0.0
