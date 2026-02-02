# Phase 2 设计文档：总结翻译功能

> 创建日期：2026-02-02

## 1. 功能概述

### 1.1 核心定位

基于 Phase 1 生成的 Markdown，为学术论文生成 **分章节中文总结**，帮助用户快速粗读论文。

### 1.2 主要特性

- **分章节总结**：按论文原有章节结构，每章翻译并总结
- **智能章节识别**：AI 自动判断章节类型，采用不同总结策略
- **保留重要元素**：LaTeX 公式、英文术语、关键配图
- **多 AI 提供商支持**：OpenAI、DeepSeek、智谱、通义千问等
- **一键完成**：默认与 Phase 1 转换无缝衔接

---

## 2. 章节处理策略

| 章节类型 | 适用章节 | 总结策略 |
|---------|---------|---------|
| 普通章节 | Abstract, Introduction, Related Work, Conclusion, Discussion | 2-4 句话中文总结，保留英文术语如 `扩散模型 (Diffusion Model)`，保持 LaTeX 公式 |
| 方法章节 | Method, Approach, Model, Framework | 保持原有子标题结构，每个子章节单独总结，保留重要公式和架构图 |
| 实验章节 | Experiments, Evaluation, Results | 表格形式：\| 实验内容 \| 结论 \| |
| 附录章节 | Appendix, Supplementary | 表格形式：\| 附录 \| 内容简述 \| |

### 2.1 普通章节示例

```markdown
### Abstract

本文提出了一种基于扩散模型 (Diffusion Model) 的组合优化求解方法。通过引入一致性训练 (Consistency Training)，实现了从训练到测试的快速迁移。核心目标函数为 $\mathcal{L} = \mathbb{E}[\|f(x) - y\|^2]$。
```

### 2.2 方法章节示例

```markdown
### Method

#### 问题定义 (Problem Formulation)

将组合优化问题建模为图结构 $G=(V,E)$，目标是找到最优的节点排列 $\pi^* = \arg\min_\pi c(\pi)$。

#### 扩散过程 (Diffusion Process)

采用去噪扩散概率模型 (DDPM)，前向过程定义为：
$$q(x_t|x_{t-1}) = \mathcal{N}(x_t; \sqrt{1-\beta_t}x_{t-1}, \beta_t I)$$

![模型架构](images/003.png)
*图：模型整体架构*
```

### 2.3 实验章节示例

```markdown
### Experiments

| 实验内容 | 结论 |
|---------|-----|
| 在 TSP 和 CVRP 数据集上与基线方法对比 | 在求解质量上优于 LKH、OR-Tools 等传统方法 |
| 消融实验：分析各组件贡献 | 一致性蒸馏对推理速度提升贡献最大 |
| 效率分析：推理时间对比 | 相比原始扩散模型快 10-50 倍 |
```

### 2.4 附录章节示例

```markdown
### Appendix

| 附录 | 内容简述 |
|-----|---------|
| A. 理论证明 | 一致性蒸馏收敛性证明 |
| B. 实现细节 | 网络架构、超参数设置 |
| C. 更多实验 | 不同问题规模的详细结果 |
```

---

## 3. 技术架构

### 3.1 Agent 架构

使用 **Vercel AI SDK** 实现智能 Agent，让 AI 自主决定如何处理论文：

```
┌─────────────────────────────────────────────────────────────┐
│                    Summarization Agent                       │
├─────────────────────────────────────────────────────────────┤
│  System Prompt: 论文总结专家，按章节类型采用不同策略          │
├─────────────────────────────────────────────────────────────┤
│  工具 (Tools):                                               │
│  ├─ getSections()      - 获取论文章节列表                    │
│  ├─ readSection()      - 读取单个章节详细内容                │
│  ├─ checkImage()       - 判断图片是否需要保留                │
│  ├─ writeSummary()     - 输出单章节总结                      │
│  └─ finalize()         - 完成并保存最终 Markdown             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 AI 提供商适配

统一使用 OpenAI 兼容 API 格式：

```
┌───────────────────┐
│   LLM Provider    │  ← 用户在设置中配置
│   Adapter Layer   │
├───────────────────┤
│ • OpenAI          │  https://api.openai.com/v1
│ • DeepSeek        │  https://api.deepseek.com
│ • 智谱 (GLM)      │  https://open.bigmodel.cn/api/paas/v4
│ • 通义千问        │  https://dashscope.aliyuncs.com/compatible-mode/v1
│ • 自定义 API      │  用户配置 Base URL + API Key
└───────────────────┘
```

### 3.3 Agent 工作流程

1. Agent 调用 `getSections()` 获取章节列表
2. 对每个章节，Agent 自主决定：
   - 调用 `readSection()` 读取内容
   - 分析章节类型（普通/方法/实验/附录）
   - 如有图片，调用 `checkImage()` 判断是否保留
   - 调用 `writeSummary()` 输出对应格式的总结
3. 所有章节处理完后，调用 `finalize()` 保存文件

---

## 4. 模块结构

### 4.1 新增模块

```
src/modules/
├── pdfParser/                    # [Phase 1 已有]
├── markdownHandler/              # [Phase 1 已有]
├── converter.ts                  # [Phase 1 已有]
│
├── summarizer/                   # [Phase 2 新增] 总结翻译模块
│   ├── index.ts                  # 模块入口，导出主函数
│   ├── types.ts                  # 类型定义
│   ├── markdownParser.ts         # Markdown 章节解析器
│   ├── agent.ts                  # Agent 定义和工具实现
│   ├── prompts.ts                # System prompt 模板
│   └── providers/                # AI 提供商适配器
│       ├── index.ts              # 统一导出
│       ├── types.ts              # Provider 接口定义
│       └── openaiCompatible.ts   # OpenAI 兼容 API 适配器
│
└── menu.ts                       # [修改] 添加新菜单项
```

### 4.2 核心类型定义

```typescript
// src/modules/summarizer/types.ts

/** 章节类型 */
type SectionType = 'normal' | 'method' | 'experiment' | 'appendix';

/** 解析出的章节 */
interface Section {
  title: string;
  level: number;      // 标题级别 (1, 2, 3...)
  content: string;    // 原始内容
  subsections?: Section[];
}

/** 总结结果 */
interface SummaryResult {
  success: boolean;
  summaryPath?: string;
  error?: string;
}

/** AI Provider 配置 */
interface ProviderConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}
```

### 4.3 工具定义

```typescript
// src/modules/summarizer/agent.ts

import { ToolLoopAgent, tool, stepCountIs } from 'ai';
import { z } from 'zod';

const summarizationAgent = new ToolLoopAgent({
  model: provider,
  tools: {
    getSections: tool({
      description: '获取论文的所有章节标题和内容',
      inputSchema: z.object({}),
      execute: async () => { /* 解析 Markdown 返回章节列表 */ },
    }),
    
    readSection: tool({
      description: '读取指定章节的完整内容',
      inputSchema: z.object({
        sectionTitle: z.string().describe('章节标题'),
      }),
      execute: async ({ sectionTitle }) => { /* 返回章节内容 */ },
    }),
    
    checkImage: tool({
      description: '判断图片是否需要保留在总结中',
      inputSchema: z.object({
        imagePath: z.string().describe('图片路径'),
        context: z.string().describe('图片周围的文字上下文'),
        caption: z.string().optional().describe('图片标题/说明'),
      }),
      execute: async ({ imagePath, context, caption }) => {
        // 返回图片信息供 AI 判断
      },
    }),
    
    writeSummary: tool({
      description: '输出一个章节的总结',
      inputSchema: z.object({
        sectionTitle: z.string(),
        sectionType: z.enum(['normal', 'method', 'experiment', 'appendix']),
        summary: z.string().describe('Markdown 格式的总结内容'),
        images: z.array(z.object({
          path: z.string(),
          caption: z.string(),
        })).optional().describe('需要保留的图片'),
      }),
      execute: async (args) => { /* 收集总结内容 */ },
    }),
    
    finalize: tool({
      description: '所有章节总结完成后调用，保存最终文件',
      inputSchema: z.object({}),
      execute: async () => { /* 组装并保存 Markdown 文件 */ },
    }),
  },
  stopWhen: stepCountIs(50),
});
```

---

## 5. 设置项

### 5.1 新增设置项

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| AI Provider | string | "deepseek" | 提供商类型 |
| API URL | string | 根据 provider | API 端点地址 |
| API Key | string | 空 | API 密钥 |
| Model | string | 根据 provider | 模型名称 |
| 自动生成总结 | boolean | true | 转换后是否自动生成总结 |
| 总结语言 | string | "zh-CN" | 总结输出语言 |

### 5.2 预设 Provider 配置

```typescript
const PROVIDER_PRESETS = {
  openai: {
    apiUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
  },
  deepseek: {
    apiUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
  },
  zhipu: {
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
  },
  qwen: {
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
  },
  custom: {
    apiUrl: '',
    defaultModel: '',
  },
};
```

### 5.3 API 测试功能

设置页面提供"测试连接"按钮，验证 API 配置是否正确：

```typescript
async function testApiConnection(config: ProviderConfig): Promise<TestResult> {
  try {
    const startTime = Date.now();
    const response = await fetch(`${config.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      return { success: true, latency };
    } else {
      return { success: false, error: await response.text() };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

---

## 6. 触发方式与菜单

### 6.1 右键菜单

| 菜单项 | 功能 | 阶段 |
|--------|------|------|
| 转换为 Markdown | 仅转换 PDF | Phase 1 |
| 转换为 Markdown 并生成总结 | 转换 + 总结（默认） | Phase 2 |
| 生成总结翻译 | 对已有 Markdown 生成总结 | Phase 2 |

### 6.2 默认行为

- 设置"自动生成总结"为 true 时，"转换为 Markdown"会自动执行总结
- 可在设置中关闭，改为手动触发

---

## 7. 输出格式

### 7.1 文件结构

```
Zotero/storage/XXXXXXXX/
├── paper.pdf                 # 原始 PDF
├── paper.md                  # [Phase 1] 转换后的 Markdown
├── images/                   # [Phase 1] 提取的图像
│   ├── 001.png
│   └── ...
└── paper_summary.md          # [Phase 2] 总结翻译 ⭐
```

### 7.2 总结文件格式

```markdown
---
title: "论文标题"
authors: ["作者1", "作者2"]
year: 2024
doi: "10.xxx/xxx"
zotero_key: "XXXXXXXX"
summary_generated_at: "2026-02-02T12:00:00Z"
ai_provider: "deepseek"
ai_model: "deepseek-chat"
---

# 论文总结

## Abstract

本文提出了一种基于扩散模型 (Diffusion Model) 的组合优化求解方法...

## Introduction

研究背景：近年来深度学习在组合优化问题上取得了显著进展...

## Method

### 问题定义 (Problem Formulation)

将组合优化问题建模为图结构 $G=(V,E)$...

![模型架构](images/003.png)
*图：模型整体架构*

## Experiments

| 实验内容 | 结论 |
|---------|-----|
| 在 TSP 数据集上与基线对比 | 优于 LKH、OR-Tools |
| 消融实验 | 一致性蒸馏贡献最大 |

## Conclusion

本文提出的方法在保持求解质量的同时，显著提升了推理效率...
```

### 7.3 图片保留策略

| 保留 | 不保留 |
|------|--------|
| 模型架构图 | 实验结果对比图表 |
| 方法流程图 | 消融实验图 |
| 框架示意图 | 训练曲线图 |
| 核心算法示意图 | 统计分布图 |

### 7.4 Zotero 附件注册

总结文件完成后，通过 Zotero API 注册为条目的附件，用户可直接在 Zotero 中查看。

---

## 8. 错误处理与进度反馈

### 8.1 错误处理

| 错误场景 | 处理方式 |
|---------|---------|
| AI API 配置缺失 | 提示用户先完成设置 |
| API 请求失败 | 重试 3 次，仍失败则显示错误信息 |
| Markdown 文件不存在 | 提示先执行 Phase 1 转换 |
| Agent 超时（>5分钟） | 终止并保存已完成的部分 |
| Token 超限 | 自动分段处理长章节 |

### 8.2 进度反馈

```
┌─────────────────────────────────────────┐
│ 正在生成总结翻译...                      │
│                                         │
│ [████████████░░░░░░░░] 60%              │
│                                         │
│ ✓ Abstract                              │
│ ✓ Introduction                          │
│ ● Method (处理中...)                     │
│ ○ Experiments                           │
│ ○ Conclusion                            │
└─────────────────────────────────────────┘
```

### 8.3 完成通知

- **成功**：通知栏显示"总结翻译已生成"，点击可打开文件
- **部分成功**：显示已完成的章节数量
- **失败**：显示具体错误信息

---

## 9. System Prompt

```typescript
export const SUMMARIZATION_SYSTEM_PROMPT = `
你是一个学术论文总结助手。你的任务是阅读论文的 Markdown 内容，生成结构化的中文总结。

## 工作流程

1. 调用 getSections() 获取论文章节结构
2. 对每个章节：
   - 调用 readSection() 读取内容
   - 分析章节类型（普通/方法/实验/附录）
   - 如有图片，调用 checkImage() 判断是否保留
   - 调用 writeSummary() 输出总结
3. 完成后调用 finalize() 保存文件

## 总结规范

### 普通章节（Abstract, Introduction, Related Work, Conclusion, Discussion）
- 2-4 句话概括核心内容
- 翻译为中文
- 保留关键术语的英文：\`中文术语 (English Term)\`
- 保持所有 LaTeX 公式不变（如 \`$\\alpha$\`、\`$$E=mc^2$$\`）

### 方法章节（Method, Approach, Model, Framework）
- 保持原文的二级/三级标题结构
- 每个子章节单独总结
- 保留重要公式和符号定义
- 保留重要的架构图、流程图

### 实验章节（Experiments, Evaluation, Results）
- 使用表格形式：| 实验内容 | 结论 |
- 不保留实验结果图表

### 附录章节（Appendix, Supplementary）
- 使用表格形式：| 附录 | 内容简述 |

## 图片保留原则
- 保留：模型架构图、方法流程图、框架示意图、核心算法示意图
- 不保留：实验结果对比图、训练曲线、统计图表、消融实验图
`;
```

---

## 10. 开发计划

### Phase 2 任务清单

1. [ ] 实现 Markdown 章节解析器 (`markdownParser.ts`)
2. [ ] 实现 AI Provider 适配层 (`providers/`)
3. [ ] 实现 Agent 和工具 (`agent.ts`)
4. [ ] 编写 System Prompt (`prompts.ts`)
5. [ ] 实现总结流程控制器 (`index.ts`)
6. [ ] 修改设置界面，添加 AI 配置项
7. [ ] 添加 API 测试功能
8. [ ] 修改菜单，添加新菜单项
9. [ ] 实现进度反馈 UI
10. [ ] 实现 Zotero 附件注册
11. [ ] 国际化支持（中英文）
12. [ ] 测试与调试

---

## 11. 依赖项

### 新增依赖

```json
{
  "dependencies": {
    "ai": "^4.0.0",           // Vercel AI SDK
    "zod": "^3.22.0"          // Schema 验证
  }
}
```

---

## 12. 参考资料

- [Vercel AI SDK Documentation](https://ai-sdk.dev/)
- [Vercel AI SDK Tool Calling](https://ai-sdk.dev/docs/agents/overview)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [DeepSeek API Documentation](https://api-docs.deepseek.com/)
