/**
 * AI Provider 接口定义
 */

import {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ToolDefinition,
  ProviderConfig,
  ApiTestResult,
} from "../types";

/**
 * AI Provider 接口
 */
export interface IAIProvider {
  /** Provider 名称 */
  readonly name: string;

  /**
   * 发送 Chat Completion 请求
   *
   * @param messages 消息列表
   * @param tools 工具定义（可选）
   * @param options 额外选项
   * @returns Chat Completion 响应
   */
  chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ChatOptions,
  ): Promise<ChatCompletionResponse>;

  /**
   * 测试 API 连接
   *
   * @returns 测试结果
   */
  testConnection(): Promise<ApiTestResult>;
}

/**
 * Chat 请求选项
 */
export interface ChatOptions {
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 工具选择策略 */
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

/**
 * 创建 Provider 的选项
 */
export interface CreateProviderOptions extends ProviderConfig {
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
}
