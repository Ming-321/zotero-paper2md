/**
 * OpenAI 兼容 API Provider
 *
 * 支持所有 OpenAI API 格式兼容的服务（OpenAI、DeepSeek、智谱、通义等）
 */

import {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ToolDefinition,
  ApiTestResult,
} from "../types";
import { IAIProvider, ChatOptions, CreateProviderOptions } from "./types";

/** 默认请求超时时间（毫秒） */
const DEFAULT_TIMEOUT = 120000; // 2 分钟

/** 默认重试次数 */
const DEFAULT_RETRIES = 3;

/** 重试延迟（毫秒） */
const RETRY_DELAY = 1000;

/**
 * OpenAI 兼容 API Provider 实现
 */
export class OpenAICompatibleProvider implements IAIProvider {
  readonly name = "OpenAI Compatible";

  private apiUrl: string;
  private apiKey: string;
  private model: string;
  private timeout: number;
  private retries: number;

  constructor(options: CreateProviderOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, ""); // 移除末尾斜杠
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.retries = options.retries ?? DEFAULT_RETRIES;
  }

  /**
   * 发送 Chat Completion 请求
   */
  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ChatOptions,
  ): Promise<ChatCompletionResponse> {
    const request: ChatCompletionRequest = {
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (tools && tools.length > 0) {
      request.tools = tools;
      request.tool_choice = options?.toolChoice ?? "auto";
    }

    return this.sendRequest(request);
  }

  /**
   * 测试 API 连接
   */
  async testConnection(): Promise<ApiTestResult> {
    const startTime = Date.now();

    try {
      const response = await this.chat(
        [{ role: "user", content: "Hi" }],
        undefined,
        { maxTokens: 5 },
      );

      const latency = Date.now() - startTime;

      return {
        success: true,
        latency,
        model: response.model,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 发送 HTTP 请求
   */
  private async sendRequest(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const url = `${this.apiUrl}/chat/completions`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `API 请求失败: ${response.status} ${response.statusText}\n${errorText}`,
          );
        }

        return (await response.json()) as unknown as ChatCompletionResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 如果是最后一次尝试，不再等待
        if (attempt < this.retries - 1) {
          // 指数退避
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error("请求失败");
  }

  /**
   * 带超时的 fetch 请求
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    // 使用 Promise.race 实现超时，因为 Zotero 环境可能不支持 AbortController
    const fetchPromise = fetch(url, options);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`请求超时（${this.timeout}ms）`));
      }, this.timeout);
    });

    return Promise.race([fetchPromise, timeoutPromise]);
  }

  /**
   * 延时函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
