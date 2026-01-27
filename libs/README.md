# 第三方库目录

本目录包含应用所需的第三方 JavaScript 库。

## 自动下载

运行根目录的 `download_libs.py` 脚本自动下载所有库：

```bash
python3 download_libs.py
```

## 手动下载

或者手动下载以下文件到此目录：

1. **dexie.min.js** (79.6 KB)
   - URL: https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js

2. **flatpickr.min.js** (49.5 KB)
   - URL: https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js

3. **flatpickr.min.css** (15.8 KB)
   - URL: https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css

4. **sortable.min.js** (43.1 KB)
   - URL: https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js

5. **html2canvas.min.js** (194.0 KB)
   - URL: https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js

6. **jspdf.umd.min.js** (355.9 KB)
   - URL: https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js

7. **browser-image-compression.js** (55.7 KB)
   - URL: https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js

## 说明

这些库已在 `download_libs.py` 中配置好下载地址，运行该脚本会自动将所有库下载到此目录。

所有库均使用 CDN 的稳定版本，确保应用可以完全离线运行。
