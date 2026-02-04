import { config } from "../../package.json";
import { createProvider, getPresetConfig, PROVIDER_PRESETS } from "./summarizer/providers";
import type { ProviderPreset } from "./summarizer/types";
import { getPref } from "../utils/prefs";

export async function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  // See addon/content/preferences.xhtml onpaneload
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
  bindPrefEvents();
  initAIProviderUI();
}

function bindPrefEvents() {
  const doc = addon.data.prefs!.window.document;

  // MinerU API Key 输入框事件
  doc
    ?.querySelector(`#zotero-prefpane-${config.addonRef}-mineru-api-key`)
    ?.addEventListener("change", () => {
      ztoolkit.log("MinerU API Key changed");
    });

  // MinerU API URL 输入框事件
  doc
    ?.querySelector(`#zotero-prefpane-${config.addonRef}-mineru-api-url`)
    ?.addEventListener("change", () => {
      ztoolkit.log("MinerU API URL changed");
    });

  // AI Provider 选择事件
  doc
    ?.querySelector(`#zotero-prefpane-${config.addonRef}-ai-provider`)
    ?.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLSelectElement;
      onAIProviderChange(target.value as ProviderPreset);
    });

  // AI 测试连接按钮
  doc
    ?.querySelector(`#zotero-prefpane-${config.addonRef}-ai-test`)
    ?.addEventListener("click", () => {
      testAIConnection();
    });
}

/**
 * 初始化 AI Provider UI
 */
function initAIProviderUI() {
  const doc = addon.data.prefs!.window.document;
  const preset = (getPref("aiProvider") as ProviderPreset) || "deepseek";

  // 设置选中的 provider
  const providerSelect = doc?.querySelector(
    `#zotero-prefpane-${config.addonRef}-ai-provider`,
  ) as HTMLSelectElement | null;

  if (providerSelect) {
    providerSelect.value = preset;
  }

  // 更新 placeholder
  updateAIPlaceholders(preset);
}

/**
 * AI Provider 改变时更新 UI
 */
function onAIProviderChange(preset: ProviderPreset) {
  ztoolkit.log(`AI Provider changed to: ${preset}`);
  updateAIPlaceholders(preset);
  clearTestResult();
}

/**
 * 更新 AI 配置项的 placeholder
 */
function updateAIPlaceholders(preset: ProviderPreset) {
  const doc = addon.data.prefs!.window.document;
  const presetConfig = getPresetConfig(preset);

  // 更新 API URL placeholder
  const apiUrlInput = doc?.querySelector(
    `#zotero-prefpane-${config.addonRef}-ai-api-url`,
  ) as HTMLInputElement | null;

  if (apiUrlInput) {
    if (preset === "custom") {
      apiUrlInput.placeholder = "请输入 API URL";
    } else {
      apiUrlInput.placeholder = presetConfig.apiUrl || "使用预设";
    }
  }

  // 更新 Model placeholder
  const modelInput = doc?.querySelector(
    `#zotero-prefpane-${config.addonRef}-ai-model`,
  ) as HTMLInputElement | null;

  if (modelInput) {
    if (preset === "custom") {
      modelInput.placeholder = "请输入模型名称";
    } else {
      modelInput.placeholder = presetConfig.defaultModel || "使用预设";
    }
  }
}

/**
 * 测试 AI 连接
 */
async function testAIConnection() {
  const doc = addon.data.prefs!.window.document;
  const resultSpan = doc?.querySelector(
    `#zotero-prefpane-${config.addonRef}-ai-test-result`,
  ) as HTMLSpanElement | null;

  const testButton = doc?.querySelector(
    `#zotero-prefpane-${config.addonRef}-ai-test`,
  ) as HTMLButtonElement | null;

  if (!resultSpan || !testButton) return;

  // 获取配置
  const preset = (getPref("aiProvider") as ProviderPreset) || "deepseek";
  const presetConfig = getPresetConfig(preset);

  const apiUrl =
    (getPref("aiApiUrl") as string) || presetConfig.apiUrl;
  const apiKey = getPref("aiApiKey") as string;
  const model =
    (getPref("aiModel") as string) || presetConfig.defaultModel;

  // 验证配置
  if (!apiKey) {
    resultSpan.textContent = "❌ 请先输入 API Key";
    resultSpan.style.color = "#d32f2f";
    return;
  }

  if (!apiUrl) {
    resultSpan.textContent = "❌ 请先输入 API URL";
    resultSpan.style.color = "#d32f2f";
    return;
  }

  if (!model) {
    resultSpan.textContent = "❌ 请先输入模型名称";
    resultSpan.style.color = "#d32f2f";
    return;
  }

  // 显示测试中状态
  testButton.disabled = true;
  resultSpan.textContent = "⏳ 测试中...";
  resultSpan.style.color = "#1976d2";

  try {
    const provider = createProvider({ apiUrl, apiKey, model });
    const result = await provider.testConnection();

    if (result.success) {
      resultSpan.textContent = `✅ 连接成功！延迟: ${result.latency}ms`;
      resultSpan.style.color = "#388e3c";
    } else {
      resultSpan.textContent = `❌ 连接失败: ${result.error}`;
      resultSpan.style.color = "#d32f2f";
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    resultSpan.textContent = `❌ 错误: ${errorMessage}`;
    resultSpan.style.color = "#d32f2f";
  } finally {
    testButton.disabled = false;
  }
}

/**
 * 清除测试结果
 */
function clearTestResult() {
  const doc = addon.data.prefs!.window.document;
  const resultSpan = doc?.querySelector(
    `#zotero-prefpane-${config.addonRef}-ai-test-result`,
  ) as HTMLSpanElement | null;

  if (resultSpan) {
    resultSpan.textContent = "";
  }
}
