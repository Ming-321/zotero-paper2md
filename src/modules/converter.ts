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
    ztoolkit.log("Paper2MD: 开始转换...");

    // Step 1: 验证条目类型
    if (!item.isRegularItem()) {
      throw new Error("请选择一个文献条目（而非附件或笔记）");
    }
    ztoolkit.log(`Paper2MD: 条目标题: ${item.getField("title")}`);

    // Step 2: 获取PDF路径
    const pdfPath = await getPdfPath(item);
    if (!pdfPath) {
      throw new Error("该条目没有PDF附件");
    }
    ztoolkit.log(`Paper2MD: PDF路径: ${pdfPath}`);

    // 验证PDF文件存在
    if (!(await IOUtils.exists(pdfPath))) {
      throw new Error("PDF文件不存在，可能已被移动或删除");
    }

    // Step 3: 获取存储目录（直接从PDF路径获取，确保与选定的PDF在同一目录）
    const storageDir = PathUtils.parent(pdfPath);
    if (!storageDir) {
      throw new Error("无法获取PDF所在目录");
    }
    const baseName = getBaseName(pdfPath);
    ztoolkit.log(`Paper2MD: 存储目录: ${storageDir}, 基础名: ${baseName}`);

    // Step 4: 创建解析器并解析PDF
    const parser = new MineruAdapter();

    if (!parser.validateConfig()) {
      throw new Error("请先在设置中配置MinerU API Key");
    }

    ztoolkit.log("Paper2MD: 开始调用MinerU API解析PDF...");

    // 包装进度回调，添加阶段信息和日志
    const wrappedProgress: ProgressCallback | undefined = onProgress
      ? (progress: ParseProgress) => {
          ztoolkit.log(`Paper2MD: 解析进度 - ${progress.state}, ${progress.extractedPages || 0}/${progress.totalPages || "?"} 页`);
          onProgress(progress);
        }
      : undefined;

    const parseResult = await parser.parse(pdfPath, wrappedProgress);
    ztoolkit.log(`Paper2MD: 解析完成，Markdown长度: ${parseResult.markdown.length}, 图像数量: ${parseResult.images.length}`);

    // Step 5: 更新图像路径并获取重命名映射
    const { markdown: updatedMarkdown, renameMap } = updateImagePaths(
      parseResult.markdown,
      parseResult.images,
    );
    ztoolkit.log(`Paper2MD: 图像重命名映射: ${renameMap.size}个文件`);

    // Step 6: 提取元数据并注入到Markdown
    const metadata = extractMetadata(item, parser.name);
    const markdown = injectMetadata(updatedMarkdown, metadata);

    // Step 7: 保存文件
    const markdownPath = getMarkdownPath(storageDir, baseName);
    const imagesDir = getImagesDir(storageDir);

    ztoolkit.log(`Paper2MD: 保存Markdown到: ${markdownPath}`);
    // 保存Markdown
    await saveMarkdown(markdownPath, markdown);

    // 保存图像（使用重命名映射）
    if (parseResult.images.length > 0) {
      ztoolkit.log(`Paper2MD: 保存${parseResult.images.length}个图像到: ${imagesDir}`);
      await saveImages(imagesDir, parseResult.images, renameMap);
    }

    // Step 8: 添加"已转换Markdown"标签
    await addConvertedTag(item);

    ztoolkit.log("Paper2MD: 转换完成!");

    return {
      success: true,
      markdownPath,
      imagesDir: parseResult.images.length > 0 ? imagesDir : undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    ztoolkit.log(`Paper2MD: 转换失败 - ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      ztoolkit.log(`Paper2MD: 错误堆栈 - ${error.stack}`);
    }

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

/** 已转换Markdown标签名称 */
const CONVERTED_TAG = "已转换Markdown";

/**
 * 为条目添加"已转换Markdown"标签
 * @param item Zotero条目
 */
async function addConvertedTag(item: Zotero.Item): Promise<void> {
  try {
    // 检查是否已有该标签
    const existingTags = item.getTags();
    const hasTag = existingTags.some((t) => t.tag === CONVERTED_TAG);

    if (!hasTag) {
      item.addTag(CONVERTED_TAG);
      await item.saveTx();
      ztoolkit.log(`Paper2MD: 已添加标签 "${CONVERTED_TAG}"`);
    } else {
      ztoolkit.log(`Paper2MD: 条目已有标签 "${CONVERTED_TAG}"`);
    }
  } catch (error) {
    ztoolkit.log(`Paper2MD: 添加标签失败 - ${error}`);
    // 标签添加失败不影响主流程
  }
}
