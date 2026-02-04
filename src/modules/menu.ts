/**
 * 右键菜单模块
 *
 * 注册PDF转Markdown和总结翻译的右键菜单项
 */

import { getString } from "../utils/locale";
import { convertItemToMarkdown, canConvertItem, ConversionResult } from "./converter";
import { ParseProgress } from "./pdfParser/types";
import {
  showProgress,
  updateProgress,
  closeProgress,
  showNotification,
  ProgressWindowInstance,
} from "./notification";
import {
  summarizeItem,
  canSummarizeItem,
  isAIConfigured,
  SummarizationProgress,
} from "./summarizer";
import { getPref } from "../utils/prefs";

/**
 * 注册右键菜单项
 */
export function registerMenu() {
  const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;

  // 菜单项 1: 仅转换为 Markdown
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: "zotero-itemmenu-paper2md-convert",
    label: getString("menu-convert-to-markdown"),
    commandListener: () => handleConvertCommand(),
    icon: menuIcon,
  });

  // 菜单项 2: 转换并生成总结
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: "zotero-itemmenu-paper2md-convert-and-summarize",
    label: getString("menu-convert-and-summarize"),
    commandListener: () => handleConvertAndSummarizeCommand(),
    icon: menuIcon,
  });

  // 菜单项 3: 仅生成总结（需要已有 Markdown）
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: "zotero-itemmenu-paper2md-summarize",
    label: getString("menu-summarize"),
    commandListener: () => handleSummarizeCommand(),
    icon: menuIcon,
  });
}

/**
 * 处理转换命令
 */
async function handleConvertCommand() {
  // 获取选中的条目
  const items = Zotero.getActiveZoteroPane()?.getSelectedItems() || [];

  if (items.length === 0) {
    showNotification(
      getString("notification-no-selection"),
      "error"
    );
    return;
  }

  if (items.length > 1) {
    showNotification(
      getString("notification-single-only"),
      "warning"
    );
    return;
  }

  const item = items[0];

  // 检查是否可以转换
  if (!(await canConvertItem(item))) {
    showNotification(
      getString("notification-no-pdf"),
      "error"
    );
    return;
  }

  // 显示进度窗口
  const progressWindow = showProgress(getString("progress-title"));

  try {
    // 执行转换
    const result: ConversionResult = await convertItemToMarkdown(item, {
      onProgress: (progress: ParseProgress) => {
        updateProgressFromParseProgress(progressWindow, progress);
      },
    });

    // 关闭进度窗口
    closeProgress(progressWindow);

    // 显示结果通知
    if (result.success) {
      // 记录日志
      ztoolkit.log(`Paper2MD: 转换成功，Markdown保存到: ${result.markdownPath}`);
      if (result.imagesDir) {
        ztoolkit.log(`Paper2MD: 图像保存到: ${result.imagesDir}`);
      }

      // 显示成功通知（合并路径信息）
      const successMessage = result.markdownPath
        ? `${getString("notification-success")}\n${result.markdownPath}`
        : getString("notification-success");

      showNotification(successMessage, "success", 6000);
    } else {
      ztoolkit.log(`Paper2MD: 转换失败: ${result.error}`);
      showNotification(
        `${getString("notification-failed")}: ${result.error}`,
        "error"
      );
    }
  } catch (error) {
    closeProgress(progressWindow);
    const errorMessage = error instanceof Error ? error.message : String(error);
    showNotification(
      `${getString("notification-error")}: ${errorMessage}`,
      "error"
    );
  }
}

/**
 * 根据解析进度更新进度窗口
 */
function updateProgressFromParseProgress(
  progressWindow: ProgressWindowInstance,
  progress: ParseProgress,
) {
  let text: string;
  let progressValue: number;

  switch (progress.state) {
    case "pending":
      text = getString("progress-pending");
      progressValue = 10;
      break;
    case "running":
      if (progress.extractedPages && progress.totalPages) {
        const percent = Math.round(
          (progress.extractedPages / progress.totalPages) * 70 + 20,
        );
        text = getString("progress-running", {
          args: {
            current: progress.extractedPages,
            total: progress.totalPages,
          },
        });
        progressValue = percent;
      } else {
        text = getString("progress-processing");
        progressValue = 50;
      }
      break;
    case "converting":
      text = getString("progress-converting");
      progressValue = 90;
      break;
    case "done":
      text = getString("progress-done");
      progressValue = 100;
      break;
    case "failed":
      text = progress.errorMessage || getString("progress-failed");
      progressValue = 0;
      break;
    default:
      text = getString("progress-processing");
      progressValue = 30;
  }

  updateProgress(progressWindow, text, progressValue);
}

/**
 * 处理"转换并生成总结"命令
 */
async function handleConvertAndSummarizeCommand() {
  // 获取选中的条目
  const items = Zotero.getActiveZoteroPane()?.getSelectedItems() || [];

  if (items.length === 0) {
    showNotification(getString("notification-no-selection"), "error");
    return;
  }

  if (items.length > 1) {
    showNotification(getString("notification-single-only"), "warning");
    return;
  }

  const item = items[0];

  // 检查是否可以转换
  if (!(await canConvertItem(item))) {
    showNotification(getString("notification-no-pdf"), "error");
    return;
  }

  // 检查 AI 配置
  if (!isAIConfigured()) {
    showNotification(getString("notification-ai-not-configured"), "error");
    return;
  }

  // 显示进度窗口
  const progressWindow = showProgress(getString("progress-title"));

  try {
    // 步骤 1: 转换为 Markdown
    updateProgress(progressWindow, getString("progress-converting-pdf"), 10);

    const convertResult: ConversionResult = await convertItemToMarkdown(item, {
      onProgress: (progress: ParseProgress) => {
        // 转换阶段占 0-50%
        const baseProgress = getProgressFromParseProgress(progress) * 0.5;
        updateProgressFromParseProgress(progressWindow, progress);
      },
    });

    if (!convertResult.success) {
      closeProgress(progressWindow);
      showNotification(
        `${getString("notification-failed")}: ${convertResult.error}`,
        "error",
      );
      return;
    }

    // 步骤 2: 生成总结
    updateProgress(progressWindow, getString("progress-summarizing"), 50);

    const summaryResult = await summarizeItem(item, {
      onProgress: (progress: SummarizationProgress) => {
        // 总结阶段占 50-100%
        const mappedProgress = 50 + progress.progress * 0.5;
        updateProgressFromSummarizationProgress(progressWindow, progress, mappedProgress);
      },
    });

    closeProgress(progressWindow);

    if (summaryResult.success) {
      showNotification(
        `${getString("notification-convert-and-summarize-success")}\n${summaryResult.summaryPath}`,
        "success",
        6000,
      );
    } else {
      showNotification(
        `${getString("notification-summarize-failed")}: ${summaryResult.error}`,
        "error",
      );
    }
  } catch (error) {
    closeProgress(progressWindow);
    const errorMessage = error instanceof Error ? error.message : String(error);
    showNotification(`${getString("notification-error")}: ${errorMessage}`, "error");
  }
}

/**
 * 处理"生成总结翻译"命令
 */
async function handleSummarizeCommand() {
  // 获取选中的条目
  const items = Zotero.getActiveZoteroPane()?.getSelectedItems() || [];

  if (items.length === 0) {
    showNotification(getString("notification-no-selection"), "error");
    return;
  }

  if (items.length > 1) {
    showNotification(getString("notification-single-only"), "warning");
    return;
  }

  const item = items[0];

  // 检查是否有 Markdown 文件
  if (!(await canSummarizeItem(item))) {
    showNotification(getString("notification-no-markdown"), "error");
    return;
  }

  // 检查 AI 配置
  if (!isAIConfigured()) {
    showNotification(getString("notification-ai-not-configured"), "error");
    return;
  }

  // 显示进度窗口
  const progressWindow = showProgress(getString("progress-summarize-title"));

  try {
    const result = await summarizeItem(item, {
      onProgress: (progress: SummarizationProgress) => {
        updateProgressFromSummarizationProgress(progressWindow, progress, progress.progress);
      },
    });

    closeProgress(progressWindow);

    if (result.success) {
      showNotification(
        `${getString("notification-summarize-success")}\n${result.summaryPath}`,
        "success",
        6000,
      );
    } else {
      showNotification(
        `${getString("notification-summarize-failed")}: ${result.error}`,
        "error",
      );
    }
  } catch (error) {
    closeProgress(progressWindow);
    const errorMessage = error instanceof Error ? error.message : String(error);
    showNotification(`${getString("notification-error")}: ${errorMessage}`, "error");
  }
}

/**
 * 从解析进度获取百分比
 */
function getProgressFromParseProgress(progress: ParseProgress): number {
  switch (progress.state) {
    case "pending":
      return 10;
    case "running":
      if (progress.extractedPages && progress.totalPages) {
        return (progress.extractedPages / progress.totalPages) * 70 + 20;
      }
      return 50;
    case "converting":
      return 90;
    case "done":
      return 100;
    default:
      return 30;
  }
}

/**
 * 根据总结进度更新进度窗口
 */
function updateProgressFromSummarizationProgress(
  progressWindow: ProgressWindowInstance,
  progress: SummarizationProgress,
  progressValue: number,
) {
  let text: string;

  switch (progress.stage) {
    case "parsing":
      text = getString("progress-parsing-md");
      break;
    case "analyzing":
      text = getString("progress-analyzing");
      break;
    case "summarizing":
      if (progress.currentSection) {
        text = getString("progress-summarizing-section", {
          args: { section: progress.currentSection },
        });
      } else {
        text = getString("progress-summarizing");
      }
      break;
    case "saving":
      text = getString("progress-saving-summary");
      break;
    default:
      text = getString("progress-processing");
  }

  updateProgress(progressWindow, text, Math.round(progressValue));
}
