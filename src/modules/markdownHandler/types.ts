/**
 * Markdown处理模块类型定义
 */

/**
 * Zotero条目元数据
 */
export interface ItemMetadata {
  /** 标题 */
  title: string;
  /** 作者列表 */
  authors: string[];
  /** 年份 */
  year?: number;
  /** DOI */
  doi?: string;
  /** 标签列表 */
  tags: string[];
  /** Zotero条目Key */
  zoteroKey: string;
  /** 来源（解析器名称） */
  source: string;
  /** 转换时间 */
  convertedAt: string;
}

/**
 * Markdown输出选项
 */
export interface MarkdownOutputOptions {
  /** 是否添加YAML front matter */
  addFrontMatter?: boolean;
  /** 图像文件夹名称后缀 */
  imagesFolderSuffix?: string;
}
