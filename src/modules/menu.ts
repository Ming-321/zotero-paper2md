/**
 * 右键菜单模块
 *
 * 注册PDF转Markdown的右键菜单项
 */

import { getString } from "../utils/locale";
import { convertItemToMarkdown, canConvertItem, ConversionResult } from "./converter";
import { ParseProgress } from "./pdfParser/types";
import { showProgress, updateProgress, closeProgress, showNotification, ProgressWindowInstance } from "./notification";

/**
 * 注册右键菜单项
 */
export function registerMenu() {
  const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;

  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: "zotero-itemmenu-paper2md-convert",
    label: getString("menu-convert-to-markdown"),
    commandListener: () => handleConvertCommand(),
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
