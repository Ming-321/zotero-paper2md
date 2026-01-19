# Paper2MD

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square)](../LICENSE)

[English](../README.md) | [简体中文](README-zhCN.md)

一个 Zotero 7 插件，使用 MinerU API 服务将 PDF 论文转换为 Markdown 格式。

## 功能特性

- **PDF 转 Markdown**：将学术 PDF 论文转换为格式良好的 Markdown 文件
- **MinerU API 集成**：利用强大的 MinerU 文档解析服务进行精准转换
- **智能 PDF 选择**：当存在多个版本时（如翻译版本），自动识别原始 PDF
- **图像提取**：从 PDF 中提取图像并保存到有组织的 `images/` 文件夹
- **元数据注入**：自动添加包含论文元数据的 YAML 头部（标题、作者、年份、DOI、标签）
- **转换标签**：为已转换的条目添加"已转换Markdown"标签，便于跟踪
- **进度反馈**：转换过程中实时显示进度
- **多语言支持**：界面支持中文和英文

## 安装

1. 从 [Releases](https://github.com/Ming-321/zotero-paper2md/releases) 下载最新的 `.xpi` 文件
2. 在 Zotero 中，进入 `工具` → `附加组件`
3. 点击齿轮图标，选择 `从文件安装附加组件...`
4. 选择下载的 `.xpi` 文件

## 配置

1. 在 Zotero 中，进入 `编辑` → `设置` → `Paper2MD`
2. 输入您的 MinerU API 密钥（在 [https://mineru.net](https://mineru.net) 获取）
3. （可选）如果您有自定义端点，可修改 API 地址

## 使用方法

1. 在 Zotero 中选择一个带有 PDF 附件的文献条目
2. 右键点击，选择 **"转换为 Markdown"**
3. 等待转换完成
4. Markdown 文件和图像将保存在与原始 PDF 相同的文件夹中

### 输出结构

```
Zotero/storage/XXXXXXXX/
├── paper.pdf           # 原始 PDF
├── paper.md            # 转换后的 Markdown
└── images/             # 提取的图像
    ├── 001.png
    ├── 002.jpg
    └── ...
```

### Markdown 格式

生成的 Markdown 包含 YAML 头部：

```markdown
---
title: "论文标题"
authors:
  - "作者一"
  - "作者二"
year: 2024
doi: "10.xxx/xxx"
tags:
  - "标签1"
  - "标签2"
zotero_key: "XXXXXXXX"
source: "MinerU"
converted_at: "2024-01-01T12:00:00Z"
---

（论文内容...）
```

## 系统要求

- Zotero 7
- MinerU API 密钥（在 [mineru.net](https://mineru.net) 有免费额度）

## 开发计划

### 第二阶段（计划中）
- 基于章节的智能摘要
- AI 驱动的阅读笔记生成
- 将摘要笔记注册为 Zotero 附件

## 更新日志

### v0.1.0 (2026-01-19)
- 首次发布
- 使用 MinerU API 进行 PDF 转 Markdown 转换
- 智能 PDF 选择（排除翻译版本）
- 图像提取并按顺序命名（001.jpg, 002.png...）
- 带元数据的 YAML 头部
- 为已转换条目添加"已转换Markdown"标签
- 转换过程中的进度反馈
- 中英文界面

## 开发

```bash
# 安装依赖
npm install

# 开发模式（支持热重载）
npm start

# 生产构建
npm run build
```

## 许可证

本项目采用 AGPL-3.0 许可证 - 详见 [LICENSE](../LICENSE) 文件。

## 致谢

- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)
- [MinerU](https://mineru.net) 提供文档解析 API
- [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit)
