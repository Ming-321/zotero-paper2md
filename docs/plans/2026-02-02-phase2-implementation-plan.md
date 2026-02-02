# Phase 2 实现计划

> 创建日期：2026-02-02

## 实现任务列表

### 阶段 1：基础设施

#### 1.1 设置依赖和配置
- 安装 `ai` (Vercel AI SDK) 和 `zod`
- 更新 `package.json`
- 配置 TypeScript 类型

#### 1.2 类型定义 (`src/modules/summarizer/types.ts`)
```typescript
// 需要定义的类型：
- SectionType
- Section
- SummaryResult
- ProviderConfig
- SummarizationOptions
- AgentTool 接口
```

---

### 阶段 2：核心模块

#### 2.1 Markdown 章节解析器 (`src/modules/summarizer/markdownParser.ts`)
```typescript
// 功能：
- parseSections(markdown: string): Section[]
- extractImages(markdown: string): ImageInfo[]
- getSectionContent(sections: Section[], title: string): string
```

#### 2.2 AI Provider 适配层 (`src/modules/summarizer/providers/`)

**文件结构：**
```
providers/
├── index.ts              # 统一导出
├── types.ts              # Provider 接口
└── openaiCompatible.ts   # OpenAI 兼容实现
```

**关键函数：**
```typescript
- createProvider(config: ProviderConfig): LanguageModel
- getPresetConfig(providerName: string): Partial<ProviderConfig>
```

#### 2.3 System Prompt (`src/modules/summarizer/prompts.ts`)
```typescript
- SUMMARIZATION_SYSTEM_PROMPT: string
- 根据设计文档中的 prompt 模板实现
```

#### 2.4 Agent 工具定义 (`src/modules/summarizer/agent.ts`)
```typescript
// 工具实现：
- getSections: 获取章节列表
- readSection: 读取章节内容
- checkImage: 判断图片保留
- writeSummary: 输出章节总结
- finalize: 保存最终文件

// Agent 创建：
- createSummarizationAgent(config, markdownContent)
```

#### 2.5 总结流程控制器 (`src/modules/summarizer/index.ts`)
```typescript
// 主函数：
- summarizeMarkdown(item: Zotero.Item, options?: SummarizationOptions): Promise<SummaryResult>
- canSummarizeItem(item: Zotero.Item): Promise<boolean>
```

---

### 阶段 3：用户界面

#### 3.1 设置界面更新
**修改文件：**
- `addon/content/preferences.xhtml`
- `src/modules/preferenceScript.ts`

**新增设置项：**
- AI Provider 下拉选择
- API URL 输入框
- API Key 输入框（带显示/隐藏切换）
- Model 输入框
- 自动生成总结 开关
- 测试连接 按钮

#### 3.2 API 测试功能
```typescript
// 在 preferenceScript.ts 中添加：
- testApiConnection(config: ProviderConfig): Promise<TestResult>
- 显示测试结果（成功/失败、延迟）
```

#### 3.3 菜单更新 (`src/modules/menu.ts`)
**新增菜单项：**
- "转换为 Markdown 并生成总结"
- "生成总结翻译"

#### 3.4 进度反馈 UI
**修改文件：**
- `src/modules/notification.ts`

**功能：**
- 显示当前处理的章节
- 显示进度百分比
- 支持部分完成的状态

---

### 阶段 4：Zotero 集成

#### 4.1 附件注册
```typescript
// 在 markdownHandler 中添加：
- registerSummaryAsAttachment(item: Zotero.Item, summaryPath: string): Promise<void>
```

---

### 阶段 5：国际化与测试

#### 5.1 国际化支持
**修改文件：**
- `addon/locale/en-US/*.ftl`
- `addon/locale/zh-CN/*.ftl`

**新增字符串：**
- 菜单项文本
- 设置界面标签
- 进度/通知消息
- 错误提示

#### 5.2 测试
- 单元测试：章节解析器
- 集成测试：完整流程
- 手动测试：不同论文类型

---

## 文件变更清单

### 新建文件
```
src/modules/summarizer/
├── index.ts
├── types.ts
├── markdownParser.ts
├── agent.ts
├── prompts.ts
└── providers/
    ├── index.ts
    ├── types.ts
    └── openaiCompatible.ts
```

### 修改文件
```
package.json                           # 添加依赖
addon/content/preferences.xhtml        # 添加设置项
addon/prefs.js                         # 添加默认值
src/modules/preferenceScript.ts        # 添加测试功能
src/modules/menu.ts                    # 添加菜单项
src/modules/notification.ts            # 添加进度反馈
src/modules/converter.ts               # 集成总结流程
src/modules/markdownHandler/index.ts   # 添加附件注册
addon/locale/en-US/*.ftl               # 英文文本
addon/locale/zh-CN/*.ftl               # 中文文本
typings/prefs.d.ts                     # 添加新偏好类型
```

---

## 实现顺序建议

```
1. 类型定义
   ↓
2. Markdown 章节解析器
   ↓
3. AI Provider 适配层
   ↓
4. System Prompt
   ↓
5. Agent 工具定义
   ↓
6. 总结流程控制器
   ↓
7. 设置界面 + API 测试
   ↓
8. 菜单更新
   ↓
9. 进度反馈 + Zotero 附件注册
   ↓
10. 国际化
   ↓
11. 测试与调试
```

---

## 注意事项

1. **Zotero 环境限制**：
   - Zotero 插件运行在受限的 Firefox 环境中
   - 需要确认 Vercel AI SDK 在该环境中的兼容性
   - 如不兼容，可能需要使用原生 fetch 实现

2. **Token 管理**：
   - 长论文可能超出模型 token 限制
   - 需要实现自动分段策略

3. **错误恢复**：
   - 实现断点续传，保存已处理的章节
   - 避免因单个章节失败导致整体失败

4. **安全性**：
   - API Key 安全存储（使用 Zotero 偏好设置）
   - 不在日志中输出敏感信息
