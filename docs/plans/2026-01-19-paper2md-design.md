# Paper2MD 插件设计文档

> 创建日期：2026-01-19

## 1. 项目概述

### 1.1 插件信息

| 项目 | 值 |
|------|-----|
| 插件名称 | Paper2MD |
| 核心功能 | PDF论文转Markdown |
| 目标Zotero版本 | Zotero 7 |
| 开发语言 | TypeScript |

### 1.2 功能规划

- **Phase 1**：PDF转Markdown（当前阶段）
- **Phase 2**：基于Markdown的分章节智能总结

---

## 2. Phase 1：PDF转Markdown

### 2.1 触发方式

| 方式 | 优先级 | 说明 |
|------|--------|------|
| 右键菜单 | 主要 | 在Zotero条目上右键，选择"转换为Markdown" |
| 快捷键 | 可选 | 后续添加 |
| 工具栏按钮 | 可选 | 后续添加 |

### 2.2 转换范围

- **当前支持**：单篇文献转换
- **未来扩展**：批量转换

### 2.3 PDF解析方案

使用 **MinerU API** 服务进行PDF解析。

设计要求：
- 模块化架构，解析器可替换/扩展
- 定义统一的解析器接口
- MinerU作为默认适配器实现

### 2.4 输出规范

#### 2.4.1 文件位置

输出到Zotero条目的storage目录：

```
Zotero/storage/{条目Key}/
├── 原始论文.pdf              # 原始PDF
├── 原始论文.md               # 转换后的Markdown（不注册为附件）
└── 原始论文_images/          # 图像资源文件夹
    ├── image_0.png
    ├── image_1.png
    └── ...
```

#### 2.4.2 Markdown格式

包含YAML front matter元数据头：

```markdown
---
title: "论文标题"
authors: ["作者1", "作者2"]
year: 2024
doi: "10.xxx/xxx"
tags: ["tag1", "tag2"]
zotero_key: "XXXXXXXX"
source: "mineru"
converted_at: "2026-01-19T12:00:00Z"
---

（MinerU解析的论文正文内容）

![Figure 1](原始论文_images/image_0.png)
...
```

#### 2.4.3 附件注册

- Phase 1 生成的原始Markdown **不注册**为Zotero附件
- Phase 2 生成的总结笔记 **将注册**为Zotero附件

### 2.5 用户反馈

| 阶段 | 反馈方式 |
|------|----------|
| 转换进行中 | 显示进度条窗口 |
| 转换完成 | Zotero通知栏显示结果摘要 |
| 转换失败 | 通知栏显示错误信息 |

### 2.6 设置项

| 设置项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| MinerU API Key | string | 是 | API认证密钥 |
| MinerU API URL | string | 否 | API地址，有默认值 |

---

## 3. 技术架构

### 3.1 模块结构

```
src/
├── index.ts                     # 插件入口
├── addon.ts                     # 插件基类
├── hooks.ts                     # 生命周期钩子
│
├── modules/
│   ├── pdfParser/               # PDF解析模块
│   │   ├── index.ts             # 解析器接口定义
│   │   ├── types.ts             # 类型定义
│   │   └── adapters/
│   │       └── mineruAdapter.ts # MinerU API适配器
│   │
│   ├── markdownHandler/         # Markdown处理模块
│   │   ├── metadataInjector.ts  # YAML元数据注入
│   │   └── fileManager.ts       # 文件存储管理
│   │
│   ├── converter.ts             # 转换流程控制器
│   ├── menu.ts                  # 右键菜单注册
│   └── preferenceScript.ts      # 设置界面脚本
│
└── utils/
    ├── locale.ts                # 国际化工具
    ├── prefs.ts                 # 偏好设置工具
    └── ...
```

### 3.2 核心接口定义

#### PDF解析器接口

```typescript
interface IPdfParser {
  name: string;
  parse(pdfPath: string): Promise<ParseResult>;
}

interface ParseResult {
  markdown: string;
  images: ImageFile[];
}

interface ImageFile {
  name: string;
  data: ArrayBuffer;
}
```

### 3.3 转换流程

```
用户触发转换
    ↓
获取选中条目的PDF附件路径
    ↓
调用PDF解析器（MinerU API）
    ↓
接收解析结果（Markdown + 图像压缩包）
    ↓
解压并存储图像到 {filename}_images/
    ↓
注入YAML元数据到Markdown
    ↓
保存Markdown文件
    ↓
显示完成通知
```

---

## 4. Phase 2 规划（未来）

### 4.1 功能概述

基于Phase 1生成的Markdown，进行分章节智能总结，生成"粗读笔记"。

### 4.2 输出

- 生成的总结笔记Markdown将**注册为Zotero附件**
- 用户可在Zotero中直接查看

### 4.3 技术要点

- 章节识别与提取
- AI总结服务集成
- 笔记模板定制

---

## 5. 开发计划

### Phase 1 任务清单

1. [ ] 配置插件基本信息（package.json）
2. [ ] 实现PDF解析器接口与MinerU适配器
3. [ ] 实现Markdown处理模块
4. [ ] 实现转换流程控制器
5. [ ] 添加右键菜单
6. [ ] 实现设置界面（API Key配置）
7. [ ] 添加进度条和通知反馈
8. [ ] 国际化支持（中英文）
9. [ ] 测试与调试

---

## 6. 参考资料

- [Zotero Plugin Development Documentation](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [Zotero Plugin Toolkit](https://github.com/windingwind/zotero-plugin-toolkit)
- [MinerU API Documentation](待补充)
