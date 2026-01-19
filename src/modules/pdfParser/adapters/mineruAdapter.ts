/**
 * MinerU API 适配器
 *
 * 实现IPdfParser接口，通过MinerU云服务解析PDF
 *
 * API流程：
 * 1. 获取文件上传链接
 * 2. 上传PDF文件
 * 3. 轮询解析状态
 * 4. 下载并解压结果
 */

import {
  IPdfParser,
  ParseResult,
  ParseProgress,
  ProgressCallback,
  ImageFile,
} from "../types";
import { getPref } from "../../../utils/prefs";

/** MinerU API默认地址 */
const DEFAULT_API_URL = "https://mineru.net/api/v4";

/** 轮询间隔（毫秒） */
const POLL_INTERVAL = 3000;

/** 最大轮询次数 */
const MAX_POLL_COUNT = 200;

/**
 * MinerU API响应基础结构
 */
interface MineruResponse<T> {
  code: number;
  msg: string;
  trace_id: string;
  data: T;
}

/**
 * 批量上传响应数据
 */
interface BatchUploadData {
  batch_id: string;
  file_urls: string[];
}

/**
 * 任务状态响应数据
 */
interface TaskStatusData {
  batch_id: string;
  extract_result: Array<{
    file_name: string;
    state: "waiting-file" | "pending" | "running" | "done" | "failed" | "converting";
    err_msg: string;
    full_zip_url?: string;
    extract_progress?: {
      extracted_pages: number;
      total_pages: number;
      start_time: string;
    };
  }>;
}

/**
 * MinerU PDF解析器适配器
 */
export class MineruAdapter implements IPdfParser {
  readonly name = "MinerU";

  private apiKey: string;
  private apiUrl: string;

  constructor() {
    // 从偏好设置中读取配置
    this.apiKey = (getPref("mineruApiKey") as string) || "";
    this.apiUrl =
      (getPref("mineruApiUrl") as string) || DEFAULT_API_URL;
  }

  /**
   * 验证配置是否有效
   */
  validateConfig(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * 解析PDF文件
   */
  async parse(
    pdfPath: string,
    onProgress?: ProgressCallback,
  ): Promise<ParseResult> {
    // 验证配置
    if (!this.validateConfig()) {
      throw new Error("MinerU API Key未配置，请在设置中配置API Key");
    }

    // 获取文件名
    const fileName = this.getFileName(pdfPath);

    // 报告初始状态
    onProgress?.({ state: "pending" });

    // Step 1: 获取上传链接
    const { batchId, uploadUrl } = await this.getUploadUrl(fileName);

    // Step 2: 上传文件
    await this.uploadFile(pdfPath, uploadUrl);

    // Step 3: 轮询任务状态
    const zipUrl = await this.pollTaskStatus(batchId, fileName, onProgress);

    // Step 4: 下载并解析结果
    const result = await this.downloadAndExtract(zipUrl);

    onProgress?.({ state: "done" });

    return result;
  }

  /**
   * 获取文件名
   */
  private getFileName(filePath: string): string {
    // 兼容Windows和Unix路径
    const parts = filePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1];
  }

  /**
   * 获取上传链接
   */
  private async getUploadUrl(
    fileName: string,
  ): Promise<{ batchId: string; uploadUrl: string }> {
    const url = `${this.apiUrl}/file-urls/batch`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        files: [{ name: fileName }],
        model_version: "vlm",
      }),
    });

    if (!response.ok) {
      throw new Error(`获取上传链接失败: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as unknown as MineruResponse<BatchUploadData>;

    if (result.code !== 0) {
      throw new Error(`获取上传链接失败: ${result.msg}`);
    }

    return {
      batchId: result.data.batch_id,
      uploadUrl: result.data.file_urls[0],
    };
  }

  /**
   * 上传文件到MinerU
   */
  private async uploadFile(filePath: string, uploadUrl: string): Promise<void> {
    // 读取文件内容
    const fileData = await this.readFileAsArrayBuffer(filePath);

    // 上传文件
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: fileData,
    });

    if (!response.ok) {
      throw new Error(`文件上传失败: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * 读取文件为ArrayBuffer
   */
  private async readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
    // 使用Zotero的文件API读取文件
    const file = Zotero.File.pathToFile(filePath);
    const data = await Zotero.File.getBinaryContentsAsync(file);

    // 将二进制字符串转换为ArrayBuffer
    const buffer = new ArrayBuffer(data.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < data.length; i++) {
      view[i] = data.charCodeAt(i);
    }

    return buffer;
  }

  /**
   * 轮询任务状态
   */
  private async pollTaskStatus(
    batchId: string,
    fileName: string,
    onProgress?: ProgressCallback,
  ): Promise<string> {
    const url = `${this.apiUrl}/extract-results/batch/${batchId}`;

    for (let i = 0; i < MAX_POLL_COUNT; i++) {
      // 等待一段时间再查询
      await this.sleep(POLL_INTERVAL);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`查询任务状态失败: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as unknown as MineruResponse<TaskStatusData>;

      if (result.code !== 0) {
        throw new Error(`查询任务状态失败: ${result.msg}`);
      }

      // 查找当前文件的状态
      const fileResult = result.data.extract_result.find(
        (r) => r.file_name === fileName,
      );

      if (!fileResult) {
        continue;
      }

      // 报告进度
      const progress: ParseProgress = {
        state: fileResult.state === "waiting-file" ? "pending" : fileResult.state,
        extractedPages: fileResult.extract_progress?.extracted_pages,
        totalPages: fileResult.extract_progress?.total_pages,
        errorMessage: fileResult.err_msg || undefined,
      };
      onProgress?.(progress);

      // 检查状态
      switch (fileResult.state) {
        case "done":
          if (fileResult.full_zip_url) {
            return fileResult.full_zip_url;
          }
          throw new Error("解析完成但未返回结果链接");

        case "failed":
          throw new Error(`解析失败: ${fileResult.err_msg || "未知错误"}`);

        case "pending":
        case "running":
        case "converting":
        case "waiting-file":
          // 继续轮询
          break;
      }
    }

    throw new Error("解析超时，请稍后重试");
  }

  /**
   * 下载并解压结果
   */
  private async downloadAndExtract(zipUrl: string): Promise<ParseResult> {
    // 下载ZIP文件
    const response = await fetch(zipUrl);

    if (!response.ok) {
      throw new Error(`下载结果失败: ${response.status} ${response.statusText}`);
    }

    const zipData = await response.arrayBuffer();

    // 解压ZIP文件
    return this.extractZip(zipData);
  }

  /**
   * 解压ZIP文件并提取内容
   */
  private async extractZip(zipData: ArrayBuffer): Promise<ParseResult> {
    // 使用Zotero内置的ZIP处理
    // 创建临时文件
    const tempDir = Zotero.getTempDirectory();
    const tempZipPath = PathUtils.join(tempDir.path, `mineru_${Date.now()}.zip`);

    // 写入ZIP文件
    await IOUtils.write(tempZipPath, new Uint8Array(zipData));

    // 解压到临时目录
    const extractDir = PathUtils.join(tempDir.path, `mineru_extract_${Date.now()}`);
    await IOUtils.makeDirectory(extractDir);

    // 使用Zotero的ZIP提取功能
    const zipReader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(
      Ci.nsIZipReader,
    );
    const zipFile = Zotero.File.pathToFile(tempZipPath);
    zipReader.open(zipFile);

    const markdown: string[] = [];
    const images: ImageFile[] = [];

    // 遍历ZIP内容
    const entries = zipReader.findEntries("*");
    while (entries.hasMore()) {
      const entryName = entries.getNext();
      const entry = zipReader.getEntry(entryName);

      if (entry.isDirectory) continue;

      // 读取文件内容
      const inputStream = zipReader.getInputStream(entryName);
      const data = this.readInputStream(inputStream);

      if (entryName.endsWith(".md")) {
        // Markdown文件
        const decoder = new TextDecoder("utf-8");
        markdown.push(decoder.decode(data));
      } else if (this.isImageFile(entryName)) {
        // 图像文件
        const fileName = this.getFileName(entryName);
        images.push({
          name: fileName,
          data: data,
        });
      }
    }

    zipReader.close();

    // 清理临时文件
    await IOUtils.remove(tempZipPath);
    await IOUtils.remove(extractDir, { recursive: true });

    return {
      markdown: markdown.join("\n\n"),
      images,
    };
  }

  /**
   * 读取输入流为ArrayBuffer
   */
  private readInputStream(inputStream: nsIInputStream): ArrayBuffer {
    const binaryInputStream = Cc[
      "@mozilla.org/binaryinputstream;1"
    ].createInstance(Ci.nsIBinaryInputStream);
    binaryInputStream.setInputStream(inputStream);

    const available = binaryInputStream.available();
    const data = binaryInputStream.readBytes(available);

    // 转换为ArrayBuffer
    const buffer = new ArrayBuffer(data.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < data.length; i++) {
      view[i] = data.charCodeAt(i);
    }

    return buffer;
  }

  /**
   * 判断是否为图像文件
   */
  private isImageFile(fileName: string): boolean {
    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];
    const lowerName = fileName.toLowerCase();
    return imageExtensions.some((ext) => lowerName.endsWith(ext));
  }

  /**
   * 延时函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
