/**
 * PDF解析器类型定义
 */

/**
 * 解析后的图像文件
 */
export interface ImageFile {
  /** 文件名 */
  name: string;
  /** 文件数据 */
  data: ArrayBuffer;
}

/**
 * PDF解析结果
 */
export interface ParseResult {
  /** 解析后的Markdown内容 */
  markdown: string;
  /** 提取的图像文件列表 */
  images: ImageFile[];
}

/**
 * 解析进度信息
 */
export interface ParseProgress {
  /** 当前状态 */
  state: "pending" | "running" | "done" | "failed" | "converting";
  /** 已解析页数 */
  extractedPages?: number;
  /** 总页数 */
  totalPages?: number;
  /** 错误信息 */
  errorMessage?: string;
}

/**
 * 解析器配置
 */
export interface ParserConfig {
  /** API密钥 */
  apiKey: string;
  /** API地址（可选，有默认值） */
  apiUrl?: string;
  /** 其他配置项 */
  [key: string]: unknown;
}

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: ParseProgress) => void;

/**
 * PDF解析器接口
 * 所有解析器适配器都必须实现此接口
 */
export interface IPdfParser {
  /** 解析器名称 */
  readonly name: string;

  /**
   * 解析PDF文件
   * @param pdfPath PDF文件路径
   * @param onProgress 进度回调（可选）
   * @returns 解析结果
   */
  parse(pdfPath: string, onProgress?: ProgressCallback): Promise<ParseResult>;

  /**
   * 验证配置是否有效
   * @returns 配置是否有效
   */
  validateConfig(): boolean;
}
