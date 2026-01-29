# OfflineWork - 離線工作日誌系統

單頁式離線工作管理工具，支援日誌記錄、待辦清單、核對項目與 PDF 匯出。

## 功能特色

- **月曆視圖**：直觀的日期選擇，可查看每日工作記錄
- **工作日誌**：記錄每日工作內容，支援標籤分類
- **待辦清單**：管理任務項目，設定到期日自動同步月曆標記
- **核對清單**：支援每 N 天/週/月自動生成重複任務
- **PDF 匯出**：一鍵匯出月曆 + 三區塊完整報告
- **完全離線**：使用 IndexedDB 本地儲存，無需網路

---

## 快速開始

### 1. 克隆專案

```bash
git clone https://github.com/maotai11/offlineWork.git
cd offlineWork
```

### 2. 部署方式

#### 方式 A：本地開啟（推薦新手）
直接用瀏覽器打開 `index.html`

**Chrome/Edge 用戶注意**：
- 需啟動本地伺服器才能正常使用 IndexedDB
- 推薦使用 VS Code 的 Live Server 插件
- 或執行：`python -m http.server 8000`

#### 方式 B：GitHub Pages（公開部署）
1. 到倉庫 Settings > Pages
2. Source 選擇 `main` branch，目錄選 `/`（root）
3. 等待 1-2 分鐘，訪問 `https://你的用戶名.github.io/offlineWork`

#### 方式 C：Cloudflare Pages（免費 + 快速）
1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Workers & Pages > Create Application > Pages > Connect to Git
3. 選擇 `offlineWork` 倉庫
4. 建置設定留空（靜態網站）
5. 部署後自動生成網址

---

## 檔案結構

```
offlineWork/
├── index.html          # 主頁面
├── app.js              # 核心邏輯（月曆/日誌/待辦/核對）
├── db.js               # IndexedDB 資料庫操作
├── style.css           # 樣式
└── lib/
    └── jspdf.umd.min.js  # PDF 匯出庫（本地化）
```

---

## 使用說明

### 工作日誌
1. 點選月曆日期或手動選日期
2. 填寫標題、內容、標籤（用逗號分隔）
3. 儲存後會在月曆上顯示 📝 標記

### 待辦清單
1. 新增項目時可設定**到期日**
2. 選擇日期後，月曆會自動標記 ⚠️ 
3. 完成後打勾，可刪除項目

### 核對清單
1. 設定**頻率**（例：每 3 天、每 2 週、每 1 月）
2. 系統會根據開始日期自動生成多個區塊
3. 每個時間點獨立打勾，適合追蹤週期性任務

### PDF 匯出
點擊右上角「匯出 PDF」按鈕，會生成包含：
- 當月月曆視圖（含標記）
- 所有工作日誌
- 待辦清單狀態
- 核對清單進度

---

## 技術棧

- **純前端**：HTML + CSS + Vanilla JavaScript
- **資料庫**：IndexedDB（瀏覽器內建）
- **PDF 生成**：jsPDF 2.5.1（本地化）
- **無依賴框架**：零 npm 套件，開箱即用

---

## 常見問題

**Q: 為什麼 Chrome 直接開啟檔案無法使用？**  
A: IndexedDB 需要 HTTP/HTTPS 協議，建議用 Live Server 或 GitHub Pages。

**Q: 資料會丟失嗎？**  
A: 儲存在瀏覽器的 IndexedDB，清除瀏覽器資料會遺失。建議定期匯出 PDF 備份。

**Q: 如何清空所有資料？**  
A: 打開瀏覽器開發者工具 (F12) > Application > IndexedDB > 刪除 `WorklogDB`

**Q: 可以同步到雲端嗎？**  
A: 目前純離線設計，可自行改造接入 Firebase/Supabase。

---

## 更新日誌

### v1.1 (2026-01-29)
- ✅ 待辦清單到期日自動標記月曆
- ✅ 核對清單支援「每 N 天/週/月」頻率
- ✅ PDF 匯出整合月曆+三區塊
- ✅ jsPDF 本地化（移除 CDN 依賴）

### v1.0 (初始版本)
- 月曆視圖
- 工作日誌
- 待辦清單
- 核對清單

---

## 授權

MIT License - 自由使用、修改、分發

## 聯絡

問題回報：[GitHub Issues](https://github.com/maotai11/offlineWork/issues)
