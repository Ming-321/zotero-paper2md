/**
 * 文件管理器
 *
 * 负责管理Markdown文件和图像的存储
 */

import { ImageFile } from "../pdfParser/types";

/** 图像文件夹名称 */
const IMAGES_FOLDER_NAME = "images";

/**
 * 翻译插件生成的PDF文件名前缀（用于开头匹配）
 * 用于排除非原始PDF - Magic翻译插件的格式
 */
const TRANSLATED_PDF_PREFIXES = [
  "全文对照翻译",
  "全文无对照翻译",
  "全文翻译",
];

/**
 * 翻译插件生成的PDF常见后缀/关键词（用于包含匹配）
 * 用于排除非原始PDF
 */
const TRANSLATED_PDF_PATTERNS = [
  "_translated",
  "_翻译",
  "_双页",
  "_双栏",
  "-translated",
  "-翻译",
  "双页版",
  "translated",
  "_cn",
  "_zh",
  "_chinese",
  "对照翻译",
  "仅翻译",
];

/**
 * 获取条目的存储目录
 * @param item Zotero条目
 * @returns 存储目录路径
 */
export async function getItemStorageDir(item: Zotero.Item): Promise<string> {
  // 获取条目的附件
  const attachments = await item.getAttachments();

  for (const attachmentID of attachments) {
    const attachment = await Zotero.Items.getAsync(attachmentID);
    if (attachment && attachment.isPDFAttachment?.()) {
      const path = await attachment.getFilePathAsync();
      if (path) {
        // 返回PDF所在目录
        const parent = PathUtils.parent(path);
        if (parent) {
          return parent;
        }
      }
    }
  }

  // 如果没有找到PDF附件，使用Zotero storage目录
  const storageDir = Zotero.getStorageDirectory().path;
  const itemDir = PathUtils.join(storageDir, item.key);

  // 确保目录存在
  if (!(await IOUtils.exists(itemDir))) {
    await IOUtils.makeDirectory(itemDir, { createAncestors: true });
  }

  return itemDir;
}

/**
 * 获取条目的原始PDF附件（排除翻译版本）
 * @param item Zotero条目
 * @returns PDF附件对象，如果没有则返回null
 */
export async function getPdfAttachment(
  item: Zotero.Item,
): Promise<Zotero.Item | null> {
  const attachmentIDs = await item.getAttachments();
  const pdfAttachments: Zotero.Item[] = [];

  // 收集所有PDF附件
  for (const attachmentID of attachmentIDs) {
    const attachment = await Zotero.Items.getAsync(attachmentID);
    if (attachment && attachment.isPDFAttachment?.()) {
      pdfAttachments.push(attachment);
    }
  }

  if (pdfAttachments.length === 0) {
    return null;
  }

  // 如果只有一个PDF，直接返回
  if (pdfAttachments.length === 1) {
    return pdfAttachments[0];
  }

  // 多个PDF时，尝试识别原始PDF
  // 策略: 排除包含翻译标识的PDF
  ztoolkit.log(`Paper2MD: 检测到${pdfAttachments.length}个PDF附件，开始识别原始PDF...`);

  const originalPdfs = pdfAttachments.filter((attachment) => {
    const title = attachment.getField("title") as string || "";
    const filename = attachment.attachmentFilename || "";

    ztoolkit.log(`Paper2MD: 检查PDF - 标题: "${title}", 文件名: "${filename}"`);

    // 合并标题和文件名进行检查
    const combined = `${title} ${filename}`;

    // 检查是否包含翻译前缀（宽松匹配）
    const containsPrefix = TRANSLATED_PDF_PREFIXES.some(
      (prefix) => combined.includes(prefix),
    );
    if (containsPrefix) {
      ztoolkit.log(`Paper2MD: ✗ 排除翻译PDF (前缀匹配): ${filename || title}`);
      return false;
    }

    // 检查是否包含翻译标识
    const lowerCombined = combined.toLowerCase();
    const containsPattern = TRANSLATED_PDF_PATTERNS.some(
      (pattern) => lowerCombined.includes(pattern.toLowerCase()),
    );
    if (containsPattern) {
      ztoolkit.log(`Paper2MD: ✗ 排除翻译PDF (包含匹配): ${filename || title}`);
      return false;
    }

    ztoolkit.log(`Paper2MD: ✓ 保留原始PDF: ${filename || title}`);
    return true;
  });

  // 如果过滤后有结果，选择最早添加的
  if (originalPdfs.length > 0) {
    // 按添加时间排序，选择最早的
    originalPdfs.sort((a, b) => {
      const dateA = a.dateAdded || "";
      const dateB = b.dateAdded || "";
      return dateA.localeCompare(dateB);
    });
    return originalPdfs[0];
  }

  // 如果都被排除了（不应该发生），返回最早添加的PDF
  pdfAttachments.sort((a, b) => {
    const dateA = a.dateAdded || "";
    const dateB = b.dateAdded || "";
    return dateA.localeCompare(dateB);
  });
  return pdfAttachments[0];
}

/**
 * 获取条目的所有PDF附件
 * @param item Zotero条目
 * @returns PDF附件列表
 */
export async function getAllPdfAttachments(
  item: Zotero.Item,
): Promise<Zotero.Item[]> {
  const attachmentIDs = await item.getAttachments();
  const pdfAttachments: Zotero.Item[] = [];

  for (const attachmentID of attachmentIDs) {
    const attachment = await Zotero.Items.getAsync(attachmentID);
    if (attachment && attachment.isPDFAttachment?.()) {
      pdfAttachments.push(attachment);
    }
  }

  return pdfAttachments;
}

/**
 * 获取PDF文件路径
 * @param item Zotero条目
 * @returns PDF文件路径，如果没有则返回null
 */
export async function getPdfPath(item: Zotero.Item): Promise<string | null> {
  const pdfAttachment = await getPdfAttachment(item);
  if (!pdfAttachment) {
    return null;
  }

  const path = await pdfAttachment.getFilePathAsync();
  return path || null;
}

/**
 * 生成Markdown文件路径
 * @param storageDir 存储目录
 * @param baseName 基础文件名（不含扩展名）
 * @returns Markdown文件路径
 */
export function getMarkdownPath(storageDir: string, baseName: string): string {
  return PathUtils.join(storageDir, `${baseName}.md`);
}

/**
 * 生成图像文件夹路径
 * @param storageDir 存储目录
 * @returns 图像文件夹路径
 */
export function getImagesDir(storageDir: string): string {
  return PathUtils.join(storageDir, IMAGES_FOLDER_NAME);
}

/**
 * 保存Markdown文件
 * @param filePath 文件路径
 * @param content Markdown内容
 */
export async function saveMarkdown(
  filePath: string,
  content: string,
): Promise<void> {
  await Zotero.File.putContentsAsync(filePath, content);
}

/**
 * 保存图像文件（使用重命名映射）
 * @param imagesDir 图像目录
 * @param images 图像文件列表
 * @param renameMap 重命名映射（原始名 -> 新名）
 */
export async function saveImages(
  imagesDir: string,
  images: ImageFile[],
  renameMap?: Map<string, string>,
): Promise<void> {
  if (images.length === 0) {
    return;
  }

  // 确保图像目录存在
  if (!(await IOUtils.exists(imagesDir))) {
    await IOUtils.makeDirectory(imagesDir, { createAncestors: true });
  }

  // 保存每个图像
  for (const image of images) {
    // 使用重命名后的文件名（如果有映射）
    const newName = renameMap?.get(image.name) || image.name;
    const imagePath = PathUtils.join(imagesDir, newName);
    await IOUtils.write(imagePath, new Uint8Array(image.data));
  }
}

/**
 * 图像重命名映射结果
 */
export interface ImageRenameResult {
  /** 更新后的Markdown内容 */
  markdown: string;
  /** 原始文件名到新文件名的映射 */
  renameMap: Map<string, string>;
}

/**
 * 更新Markdown中的图像路径，并按出现顺序重命名图像
 * @param markdown Markdown内容
 * @param images 原始图像文件列表
 * @returns 更新后的Markdown和重命名映射
 */
export function updateImagePaths(
  markdown: string,
  images: Array<{ name: string; data: ArrayBuffer }>,
): ImageRenameResult {
  // 收集Markdown中图像的出现顺序
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const imageOrder: string[] = [];
  let match;

  while ((match = imageRegex.exec(markdown)) !== null) {
    const originalPath = match[2];
    const fileName = originalPath.replace(/^.*[\\/]/, "");
    if (!imageOrder.includes(fileName)) {
      imageOrder.push(fileName);
    }
  }

  // 创建重命名映射
  const renameMap = new Map<string, string>();
  let imageIndex = 1;

  for (const originalName of imageOrder) {
    // 获取文件扩展名
    const ext = originalName.substring(originalName.lastIndexOf(".")).toLowerCase();
    const newName = `${String(imageIndex).padStart(3, "0")}${ext}`;
    renameMap.set(originalName, newName);
    imageIndex++;
  }

  // 处理可能不在Markdown中但在images数组中的图像
  for (const image of images) {
    if (!renameMap.has(image.name)) {
      const ext = image.name.substring(image.name.lastIndexOf(".")).toLowerCase();
      const newName = `${String(imageIndex).padStart(3, "0")}${ext}`;
      renameMap.set(image.name, newName);
      imageIndex++;
    }
  }

  // 替换Markdown中的图像路径
  const updatedMarkdown = markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (fullMatch, alt, originalPath) => {
      const fileName = originalPath.replace(/^.*[\\/]/, "");
      const newName = renameMap.get(fileName) || fileName;
      return `![${alt}](${IMAGES_FOLDER_NAME}/${newName})`;
    },
  );

  return {
    markdown: updatedMarkdown,
    renameMap,
  };
}

/**
 * 从文件路径提取基础名称
 * @param filePath 文件路径
 * @returns 基础名称（不含路径和扩展名）
 */
export function getBaseName(filePath: string): string {
  // 获取文件名
  const fileName = filePath.replace(/^.*[\\/]/, "");
  // 移除扩展名
  return fileName.replace(/\.[^.]+$/, "");
}
