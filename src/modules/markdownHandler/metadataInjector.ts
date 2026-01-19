/**
 * Markdown元数据注入器
 *
 * 负责从Zotero条目提取元数据并注入到Markdown文件头部
 */

import { ItemMetadata } from "./types";

/**
 * 从Zotero条目提取元数据
 * @param item Zotero条目
 * @param source 解析器来源名称
 * @returns 元数据对象
 */
export function extractMetadata(item: Zotero.Item, source: string): ItemMetadata {
  // 获取标题
  const title = item.getField("title") as string || "Untitled";

  // 获取作者
  const creators = item.getCreators();
  const authors = creators
    .filter((c) => {
      const creatorType = Zotero.CreatorTypes.getName(c.creatorTypeID);
      return creatorType === "author";
    })
    .map((c) => {
      if (c.firstName && c.lastName) {
        return `${c.firstName} ${c.lastName}`;
      }
      return c.lastName || c.firstName || "";
    })
    .filter(Boolean);

  // 获取年份
  const dateStr = item.getField("date") as string;
  let year: number | undefined;
  if (dateStr) {
    const match = dateStr.match(/\d{4}/);
    if (match) {
      year = parseInt(match[0], 10);
    }
  }

  // 获取DOI
  const doi = item.getField("DOI") as string || undefined;

  // 获取标签
  const tags = item.getTags().map((t) => t.tag);

  // 获取Zotero Key
  const zoteroKey = item.key;

  // 转换时间
  const convertedAt = new Date().toISOString();

  return {
    title,
    authors,
    year,
    doi,
    tags,
    zoteroKey,
    source,
    convertedAt,
  };
}

/**
 * 生成YAML front matter
 * @param metadata 元数据
 * @returns YAML格式的front matter字符串
 */
export function generateFrontMatter(metadata: ItemMetadata): string {
  const lines: string[] = ["---"];

  // 标题（处理特殊字符）
  lines.push(`title: "${escapeYamlString(metadata.title)}"`);

  // 作者列表
  if (metadata.authors.length > 0) {
    lines.push("authors:");
    metadata.authors.forEach((author) => {
      lines.push(`  - "${escapeYamlString(author)}"`);
    });
  }

  // 年份
  if (metadata.year) {
    lines.push(`year: ${metadata.year}`);
  }

  // DOI
  if (metadata.doi) {
    lines.push(`doi: "${escapeYamlString(metadata.doi)}"`);
  }

  // 标签
  if (metadata.tags.length > 0) {
    lines.push("tags:");
    metadata.tags.forEach((tag) => {
      lines.push(`  - "${escapeYamlString(tag)}"`);
    });
  }

  // Zotero Key
  lines.push(`zotero_key: "${metadata.zoteroKey}"`);

  // 来源
  lines.push(`source: "${metadata.source}"`);

  // 转换时间
  lines.push(`converted_at: "${metadata.convertedAt}"`);

  lines.push("---");
  lines.push(""); // 空行

  return lines.join("\n");
}

/**
 * 将元数据注入到Markdown内容
 * @param markdown 原始Markdown内容
 * @param metadata 元数据
 * @returns 带有front matter的Markdown内容
 */
export function injectMetadata(markdown: string, metadata: ItemMetadata): string {
  const frontMatter = generateFrontMatter(metadata);
  return frontMatter + markdown;
}

/**
 * 转义YAML字符串中的特殊字符
 */
function escapeYamlString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}
