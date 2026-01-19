/**
 * PDF转Markdown转换器
 *
 * 协调PDF解析和Markdown处理的核心控制器
 */

import { MineruAdapter } from "./pdfParser";
import { ParseProgress, ProgressCallback } from "./pdfParser/types";
import {
  extractMetadata,
  injectMetadata,
  getItemStorageDir,
  getPdfPath,
  getMarkdownPath,
  getImagesDir,
  saveMarkdown,
  saveImages,
  updateImagePaths,
  getBaseName,
} from "./markdownHandler";

/**
 * 转换结果
 */
export interface ConversionResult {
  /** 是否成功 */
  success: boolean;
  /** Markdown文件路径 */
  markdownPath?: string;
  /** 图像文件夹路径 */
  imagesDir?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 转换选项
 */
export interface ConversionOptions {
  /** 进度回调 */
  onProgress?: ProgressCallback;
}

/**
 * 将Zotero条目的PDF转换为Markdown
 *
 * @param item Zotero条目
 * @param options 转换选项
 * @returns 转换结果
 */
export async function convertItemToMarkdown(
  item: Zotero.Item,
  options: ConversionOptions = {},
): Promise<ConversionResult> {
  const { onProgress } = options;

  try {
    // Step 1: 验证条目类型
    if (!item.isRegularItem()) {
      throw new Error("请选择一个文献条目（而非附件或笔记）");
    }

    // Step 2: 获取PDF路径
    const pdfPath = await getPdfPath(item);
    if (!pdfPath) {
      throw new Error("该条目没有PDF附件");
    }

    // 验证PDF文件存在
    if (!(await IOUtils.exists(pdfPath))) {
      throw new Error("PDF文件不存在，可能已被移动或删除");
    }

    // Step 3: 获取存储目录
    const storageDir = await getItemStorageDir(item);
    const baseName = getBaseName(pdfPath);

    // Step 4: 创建解析器并解析PDF
    const parser = new MineruAdapter();

    if (!parser.validateConfig()) {
      throw new Error("请先在设置中配置MinerU API Key");
    }

    // 包装进度回调，添加阶段信息
    const wrappedProgress: ProgressCallback | undefined = onProgress
      ? (progress: ParseProgress) => {
          onProgress(progress);
        }
      : undefined;

    const parseResult = await parser.parse(pdfPath, wrappedProgress);

    // Step 5: 提取元数据并注入到Markdown
    const metadata = extractMetadata(item, parser.name);

    // 更新图像路径
    let markdown = updateImagePaths(parseResult.markdown, baseName);

    // 注入元数据
    markdown = injectMetadata(markdown, metadata);

    // Step 6: 保存文件
    const markdownPath = getMarkdownPath(storageDir, baseName);
    const imagesDir = getImagesDir(storageDir, baseName);

    // 保存Markdown
    await saveMarkdown(markdownPath, markdown);

    // 保存图像
    await saveImages(imagesDir, parseResult.images);

    return {
      success: true,
      markdownPath,
      imagesDir: parseResult.images.length > 0 ? imagesDir : undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 检查条目是否可以转换
 *
 * @param item Zotero条目
 * @returns 是否可以转换
 */
export async function canConvertItem(item: Zotero.Item): Promise<boolean> {
  // 必须是常规条目
  if (!item.isRegularItem()) {
    return false;
  }

  // 必须有PDF附件
  const pdfPath = await getPdfPath(item);
  return pdfPath !== null;
}
