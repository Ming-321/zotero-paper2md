/**
 * 文件管理器
 *
 * 负责管理Markdown文件和图像的存储
 */

import { ImageFile } from "../pdfParser/types";

/** 图像文件夹后缀 */
const IMAGES_FOLDER_SUFFIX = "_images";

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
 * 获取条目的PDF附件
 * @param item Zotero条目
 * @returns PDF附件对象，如果没有则返回null
 */
export async function getPdfAttachment(
  item: Zotero.Item,
): Promise<Zotero.Item | null> {
  const attachments = await item.getAttachments();

  for (const attachmentID of attachments) {
    const attachment = await Zotero.Items.getAsync(attachmentID);
    if (attachment && attachment.isPDFAttachment?.()) {
      return attachment;
    }
  }

  return null;
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
 * @param baseName 基础文件名（不含扩展名）
 * @returns 图像文件夹路径
 */
export function getImagesDir(storageDir: string, baseName: string): string {
  return PathUtils.join(storageDir, `${baseName}${IMAGES_FOLDER_SUFFIX}`);
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
 * 保存图像文件
 * @param imagesDir 图像目录
 * @param images 图像文件列表
 */
export async function saveImages(
  imagesDir: string,
  images: ImageFile[],
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
    const imagePath = PathUtils.join(imagesDir, image.name);
    await IOUtils.write(imagePath, new Uint8Array(image.data));
  }
}

/**
 * 更新Markdown中的图像路径
 * @param markdown Markdown内容
 * @param baseName 基础文件名
 * @returns 更新后的Markdown内容
 */
export function updateImagePaths(markdown: string, baseName: string): string {
  const imagesFolderName = `${baseName}${IMAGES_FOLDER_SUFFIX}`;

  // 匹配Markdown图像语法: ![alt](path)
  // 替换为相对路径
  return markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, originalPath) => {
      // 获取文件名
      const fileName = originalPath.replace(/^.*[\\/]/, "");

      // 如果已经是相对路径且包含正确的文件夹名，保持不变
      if (originalPath.startsWith(imagesFolderName)) {
        return match;
      }

      // 构建新的相对路径
      const newPath = `${imagesFolderName}/${fileName}`;
      return `![${alt}](${newPath})`;
    },
  );
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
