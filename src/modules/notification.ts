/**
 * 通知和进度显示模块
 *
 * 提供进度条和通知栏消息功能
 */

/**
 * 进度窗口实例类型
 */
export type ProgressWindowInstance = ReturnType<typeof ztoolkit.ProgressWindow.prototype.show>;

/**
 * 显示进度窗口
 * @param title 标题
 * @returns 进度窗口实例
 */
export function showProgress(title: string): ProgressWindowInstance {
  const progressWindow = new ztoolkit.ProgressWindow(title, {
    closeOnClick: false,
    closeTime: -1,
  })
    .createLine({
      text: title,
      type: "default",
      progress: 0,
    })
    .show();

  return progressWindow;
}

/**
 * 更新进度
 * @param progressWindow 进度窗口实例
 * @param text 进度文本
 * @param progress 进度值（0-100）
 */
export function updateProgress(
  progressWindow: ProgressWindowInstance,
  text: string,
  progress: number,
) {
  progressWindow.changeLine({
    text,
    progress,
  });
}

/**
 * 关闭进度窗口
 * @param progressWindow 进度窗口实例
 * @param delay 延迟关闭时间（毫秒），默认1000
 */
export function closeProgress(
  progressWindow: ProgressWindowInstance,
  delay = 1000,
) {
  progressWindow.startCloseTimer(delay);
}

/**
 * 通知类型
 */
export type NotificationType = "success" | "error" | "warning" | "info";

/**
 * 显示通知消息
 * @param message 消息内容
 * @param type 消息类型
 * @param duration 显示时长（毫秒），默认5000
 */
export function showNotification(
  message: string,
  type: NotificationType = "info",
  duration = 5000,
) {
  // 映射通知类型到ztoolkit支持的类型
  const typeMap: Record<NotificationType, "success" | "fail" | "default"> = {
    success: "success",
    error: "fail",
    warning: "fail",
    info: "default",
  };

  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: duration,
  })
    .createLine({
      text: message,
      type: typeMap[type],
      progress: 100,
    })
    .show();
}
