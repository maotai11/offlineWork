#!/usr/bin/env python3
"""下载所有第三方库到本地"""

import os
import requests
from pathlib import Path

# 创建 libs 目录
libs_dir = Path('libs')
libs_dir.mkdir(exist_ok=True)

# 要下载的库列表
libraries = {
    'dexie.min.js': 'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js',
    'flatpickr.min.js': 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js',
    'flatpickr.min.css': 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css',
    'sortable.min.js': 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js',
    'html2canvas.min.js': 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'jspdf.umd.min.js': 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    'browser-image-compression.js': 'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js'
}

print('开始下载第三方库...\n')

for filename, url in libraries.items():
    filepath = libs_dir / filename
    print(f'下载 {filename}...')
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        size_kb = len(response.content) / 1024
        print(f'  ✓ 完成 ({size_kb:.1f} KB)\n')
    except Exception as e:
        print(f'  ✗ 失败: {e}\n')

print('所有库下载完成！')
