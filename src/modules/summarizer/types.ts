/**
 * 总结翻译模块类型定义
 */

// ============================================================================
// 章节相关类型
// ============================================================================

/**
 * 章节类型
 * - normal: 普通章节 (Abstract, Introduction, Related Work, Conclusion, Discussion)
 * - method: 方法章节 (Method, Approach, Model, Framework)
 * - experiment: 实验章节 (Experiments, Evaluation, Results)
 * - appendix: 附录章节 (Appendix, Supplementary)
 */
export type SectionType = "normal" | "method" | "experiment" | "appendix";

/**
 * 解析出的论文章节
 */
export interface Section {
  /** 章节标题 */
  title: string;
  /** 标题级别 (1, 2, 3...) */
  level: number;
  /** 章节原始内容 */
  content: string;
  /** 子章节 */
  subsections?: Section[];
  /** 章节中的图片 */
  images?: ImageInfo[];
}

/**
 * 图片信息
 */
export interface ImageInfo {
  /** 图片路径（相对路径） */
  path: string;
  /** 图片说明/标题 */
  caption?: string;
  /** 图片在内容中的位置 */
  position: number;
  /** 周围的上下文文本 */
  context?: string;
}

// ============================================================================
// AI Provider 相关类型
// ============================================================================

/**
 * AI Provider 配置
 */
export interface ProviderConfig {
  /** API 端点 URL */
  apiUrl: string;
  /** API 密钥 */
  apiKey: string;
  /** 模型名称 */
  model: string;
}

/**
 * 预设 Provider 名称
 */
export type ProviderPreset =
  | "openai"
  | "deepseek"
  | "zhipu"
  | "qwen"
  | "custom";

/**
 * Provider 预设配置
 */
export interface ProviderPresetConfig {
  /** API URL */
  apiUrl: string;
  /** 默认模型 */
  defaultModel: string;
  /** 显示名称 */
  displayName: string;
}

// ============================================================================
// OpenAI 兼容 API 类型
// ============================================================================

/**
 * Chat Completion 请求消息
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  /** 工具调用（assistant 消息） */
  tool_calls?: ToolCall[];
  /** 工具调用 ID（tool 消息） */
  tool_call_id?: string;
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * Chat Completion 请求
 */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
}

/**
 * Chat Completion 响应
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: "stop" | "tool_calls" | "length" | "content_filter";
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// Agent 相关类型
// ============================================================================

/**
 * Agent 工具执行器
 */
export type ToolExecutor = (
  args: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Agent 工具集
 */
export interface AgentTools {
  [toolName: string]: {
    definition: ToolDefinition;
    execute: ToolExecutor;
  };
}

/**
 * Agent 执行状态
 */
export interface AgentState {
  /** 已处理的章节 */
  processedSections: string[];
  /** 收集的总结内容 */
  summaries: Map<string, SectionSummary>;
  /** 当前步骤数 */
  stepCount: number;
  /** 是否已完成 */
  isComplete: boolean;
}

/**
 * 单个章节的总结
 */
export interface SectionSummary {
  /** 章节标题 */
  title: string;
  /** 章节类型 */
  type: SectionType;
  /** 总结内容（Markdown 格式） */
  content: string;
}

// ============================================================================
// 总结结果类型
// ============================================================================

/**
 * 总结选项
 */
export interface SummarizationOptions {
  /** 进度回调 */
  onProgress?: SummarizationProgressCallback;
  /** 输出语言 */
  language?: string;
}

/**
 * 总结进度
 */
export interface SummarizationProgress {
  /** 当前阶段 */
  stage: "parsing" | "analyzing" | "summarizing" | "saving";
  /** 总体进度 (0-100) */
  progress: number;
  /** 当前处理的章节 */
  currentSection?: string;
  /** 已完成的章节列表 */
  completedSections?: string[];
  /** 总章节数 */
  totalSections?: number;
}

/**
 * 总结进度回调
 */
export type SummarizationProgressCallback = (
  progress: SummarizationProgress,
) => void;

/**
 * 总结结果
 */
export interface SummaryResult {
  /** 是否成功 */
  success: boolean;
  /** 总结文件路径 */
  summaryPath?: string;
  /** 错误信息 */
  error?: string;
}

// ============================================================================
// API 测试类型
// ============================================================================

/**
 * API 测试结果
 */
export interface ApiTestResult {
  /** 是否成功 */
  success: boolean;
  /** 延迟（毫秒） */
  latency?: number;
  /** 模型名称 */
  model?: string;
  /** 错误信息 */
  error?: string;
}
