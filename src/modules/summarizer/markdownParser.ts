/**
 * Markdown 章节解析器
 *
 * 解析 Markdown 文件，提取章节结构和图片信息
 */

import { Section, ImageInfo } from "./types";

/**
 * 解析 Markdown 内容为章节结构
 *
 * @param markdown Markdown 内容
 * @returns 章节数组
 */
export function parseSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let contentBuffer: string[] = [];

  // 跳过 YAML front matter
  let startIndex = 0;
  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === "---") {
        startIndex = i + 1;
        break;
      }
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // 保存之前的章节
      if (currentSection) {
        currentSection.content = contentBuffer.join("\n").trim();
        currentSection.images = extractImagesFromContent(currentSection.content);
        sections.push(currentSection);
      }

      // 开始新章节
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      currentSection = {
        title,
        level,
        content: "",
      };
      contentBuffer = [];
    } else if (currentSection) {
      contentBuffer.push(line);
    }
  }

  // 保存最后一个章节
  if (currentSection) {
    currentSection.content = contentBuffer.join("\n").trim();
    currentSection.images = extractImagesFromContent(currentSection.content);
    sections.push(currentSection);
  }

  // 构建层级结构
  return buildHierarchy(sections);
}

/**
 * 构建章节层级结构
 *
 * @param flatSections 扁平的章节数组
 * @returns 带有子章节的章节数组
 */
function buildHierarchy(flatSections: Section[]): Section[] {
  const result: Section[] = [];
  const stack: Section[] = [];

  for (const section of flatSections) {
    // 找到父级章节
    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // 顶级章节
      result.push(section);
    } else {
      // 子章节
      const parent = stack[stack.length - 1];
      if (!parent.subsections) {
        parent.subsections = [];
      }
      parent.subsections.push(section);
    }

    stack.push(section);
  }

  return result;
}

/**
 * 从内容中提取图片信息
 *
 * @param content Markdown 内容
 * @returns 图片信息数组
 */
export function extractImagesFromContent(content: string): ImageInfo[] {
  const images: ImageInfo[] = [];
  // 匹配 Markdown 图片语法: ![alt](path) 或 ![alt](path "title")
  const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

  let match;
  while ((match = imageRegex.exec(content)) !== null) {
    const [fullMatch, alt, path, title] = match;
    const position = match.index;

    // 获取图片周围的上下文（前后各 100 个字符）
    const contextStart = Math.max(0, position - 100);
    const contextEnd = Math.min(content.length, position + fullMatch.length + 100);
    const context = content.slice(contextStart, contextEnd);

    images.push({
      path,
      caption: title || alt || undefined,
      position,
      context,
    });
  }

  return images;
}

/**
 * 获取指定标题的章节内容
 *
 * @param sections 章节数组
 * @param title 章节标题
 * @returns 章节内容，如果未找到则返回 null
 */
export function getSectionContent(
  sections: Section[],
  title: string,
): string | null {
  // 递归搜索章节
  function findSection(sectionList: Section[]): Section | null {
    for (const section of sectionList) {
      if (section.title.toLowerCase() === title.toLowerCase()) {
        return section;
      }
      if (section.subsections) {
        const found = findSection(section.subsections);
        if (found) return found;
      }
    }
    return null;
  }

  const section = findSection(sections);
  if (!section) return null;

  // 收集章节及其子章节的所有内容
  return collectSectionContent(section);
}

/**
 * 收集章节及其子章节的完整内容
 *
 * @param section 章节
 * @returns 完整内容
 */
function collectSectionContent(section: Section): string {
  let content = section.content;

  if (section.subsections) {
    for (const sub of section.subsections) {
      content += `\n\n${"#".repeat(sub.level)} ${sub.title}\n\n`;
      content += collectSectionContent(sub);
    }
  }

  return content;
}

/**
 * 获取所有章节的标题列表（扁平化）
 *
 * @param sections 章节数组
 * @returns 标题列表
 */
export function getSectionTitles(sections: Section[]): string[] {
  const titles: string[] = [];

  function collectTitles(sectionList: Section[]) {
    for (const section of sectionList) {
      titles.push(section.title);
      if (section.subsections) {
        collectTitles(section.subsections);
      }
    }
  }

  collectTitles(sections);
  return titles;
}

/**
 * 获取顶级章节列表（不包含子章节）
 *
 * @param sections 章节数组
 * @returns 顶级章节标题列表
 */
export function getTopLevelSections(sections: Section[]): Section[] {
  return sections.filter((s) => s.level <= 2);
}

/**
 * 从 Markdown 中提取 YAML front matter
 *
 * @param markdown Markdown 内容
 * @returns YAML 内容字符串，如果没有则返回 null
 */
export function extractFrontMatter(markdown: string): string | null {
  const lines = markdown.split("\n");

  if (lines[0]?.trim() !== "---") {
    return null;
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");

  if (endIndex === -1) {
    return null;
  }

  return lines.slice(1, endIndex).join("\n");
}

/**
 * 移除 Markdown 中的 YAML front matter
 *
 * @param markdown Markdown 内容
 * @returns 移除 front matter 后的内容
 */
export function removeFrontMatter(markdown: string): string {
  const lines = markdown.split("\n");

  if (lines[0]?.trim() !== "---") {
    return markdown;
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");

  if (endIndex === -1) {
    return markdown;
  }

  return lines.slice(endIndex + 1).join("\n").trim();
}

/**
 * 格式化章节列表为可读字符串（用于 Agent 工具返回）
 *
 * @param sections 章节数组
 * @returns 格式化的字符串
 */
export function formatSectionsForAgent(sections: Section[]): string {
  const lines: string[] = [];

  function formatSection(section: Section, indent: string = "") {
    const imageCount = section.images?.length || 0;
    const imageInfo = imageCount > 0 ? ` (${imageCount} images)` : "";
    lines.push(`${indent}- ${section.title}${imageInfo}`);

    if (section.subsections) {
      for (const sub of section.subsections) {
        formatSection(sub, indent + "  ");
      }
    }
  }

  for (const section of sections) {
    formatSection(section);
  }

  return lines.join("\n");
}
