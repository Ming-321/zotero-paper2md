/**
 * AI Provider 模块
 *
 * 提供 AI 服务的统一接口和预设配置
 */

import { ProviderConfig, ProviderPreset, ProviderPresetConfig } from "../types";
import { IAIProvider, CreateProviderOptions } from "./types";
import { OpenAICompatibleProvider } from "./openaiCompatible";

// 导出类型
export type { IAIProvider, ChatOptions, CreateProviderOptions } from "./types";
export { OpenAICompatibleProvider } from "./openaiCompatible";

/**
 * Provider 预设配置
 */
export const PROVIDER_PRESETS: Record<ProviderPreset, ProviderPresetConfig> = {
  openai: {
    apiUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    displayName: "OpenAI",
  },
  deepseek: {
    apiUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    displayName: "DeepSeek",
  },
  zhipu: {
    apiUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
    displayName: "智谱 AI",
  },
  qwen: {
    apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    displayName: "通义千问",
  },
  custom: {
    apiUrl: "",
    defaultModel: "",
    displayName: "自定义",
  },
};

/**
 * 获取预设配置
 *
 * @param preset 预设名称
 * @returns 预设配置
 */
export function getPresetConfig(preset: ProviderPreset): ProviderPresetConfig {
  return PROVIDER_PRESETS[preset];
}

/**
 * 获取所有预设名称
 *
 * @returns 预设名称列表
 */
export function getPresetNames(): ProviderPreset[] {
  return Object.keys(PROVIDER_PRESETS) as ProviderPreset[];
}

/**
 * 创建 AI Provider
 *
 * @param config Provider 配置
 * @returns AI Provider 实例
 */
export function createProvider(config: ProviderConfig): IAIProvider {
  return new OpenAICompatibleProvider(config);
}

/**
 * 从偏好设置创建 Provider
 *
 * @param getPrefFn 获取偏好设置的函数
 * @returns AI Provider 实例，如果配置不完整则返回 null
 */
export function createProviderFromPrefs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPrefFn: (key: string) => any,
): IAIProvider | null {
  const preset = (getPrefFn("aiProvider") as ProviderPreset) || "deepseek";
  const presetConfig = getPresetConfig(preset);

  const apiUrl =
    (getPrefFn("aiApiUrl") as string) || presetConfig.apiUrl;
  const apiKey = (getPrefFn("aiApiKey") as string) || "";
  const model =
    (getPrefFn("aiModel") as string) || presetConfig.defaultModel;

  // 验证必要配置
  if (!apiUrl || !apiKey || !model) {
    return null;
  }

  return createProvider({ apiUrl, apiKey, model });
}

/**
 * 验证 Provider 配置是否完整
 *
 * @param config Provider 配置
 * @returns 是否有效
 */
export function validateProviderConfig(config: Partial<ProviderConfig>): boolean {
  return Boolean(
    config.apiUrl &&
    config.apiUrl.trim().length > 0 &&
    config.apiKey &&
    config.apiKey.trim().length > 0 &&
    config.model &&
    config.model.trim().length > 0,
  );
}
