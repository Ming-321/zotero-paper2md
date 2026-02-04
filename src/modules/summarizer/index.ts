/**
 * 总结翻译模块入口
 *
 * 提供将 Markdown 论文转换为中文总结的功能
 */

import {
  SummaryResult,
  SummarizationOptions,
  SummarizationProgress,
} from "./types";
import { createProviderFromPrefs, validateProviderConfig } from "./providers";
import { runSummarizationAgent, assembleSummaryMarkdown } from "./agent";
import { parseSections, extractFrontMatter } from "./markdownParser";
import {
  getItemStorageDir,
  getBaseName,
  getPdfPath,
} from "../markdownHandler/fileManager";
import { extractMetadata } from "../markdownHandler/metadataInjector";
import { ItemMetadata } from "../markdownHandler/types";
import { getPref } from "../../utils/prefs";

// 导出类型
export * from "./types";

// 导出子模块
export * from "./providers";
export { parseSections, extractFrontMatter } from "./markdownParser";
export { runSummarizationAgent, assembleSummaryMarkdown } from "./agent";

/** 总结文件后缀 */
const SUMMARY_SUFFIX = "_summary";

/**
 * 为 Zotero 条目生成论文总结
 *
 * @param item Zotero 条目
 * @param options 总结选项
 * @returns 总结结果
 */
export async function summarizeItem(
  item: Zotero.Item,
  options: SummarizationOptions = {},
): Promise<SummaryResult> {
  const { onProgress } = options;

  try {
    ztoolkit.log("Paper2MD: 开始生成总结...");

    // Step 1: 验证条目
    if (!item.isRegularItem()) {
      throw new Error("请选择一个文献条目（而非附件或笔记）");
    }

    // Step 2: 检查 AI 配置
    const provider = createProviderFromPrefs(
      (key: string) => getPref(key as keyof _ZoteroTypes.Prefs["PluginPrefsMap"]),
    );
    if (!provider) {
      throw new Error("请先在设置中配置 AI 服务（API Key 等）");
    }

    // Step 3: 获取 Markdown 文件路径
    const storageDir = await getItemStorageDir(item);
    const pdfPath = await getPdfPath(item);

    if (!pdfPath) {
      throw new Error("该条目没有 PDF 附件");
    }

    const baseName = getBaseName(pdfPath);
    const markdownPath = PathUtils.join(storageDir, `${baseName}.md`);

    // Step 4: 读取 Markdown 内容
    if (!(await IOUtils.exists(markdownPath))) {
      throw new Error(
        '未找到 Markdown 文件，请先执行"转换为 Markdown"操作',
      );
    }

    onProgress?.({ stage: "parsing", progress: 5 });

    const markdownContent = await Zotero.File.getContentsAsync(markdownPath);
    if (!markdownContent || typeof markdownContent !== "string") {
      throw new Error("Markdown 文件内容为空");
    }

    ztoolkit.log(
      `Paper2MD: 读取 Markdown 文件成功，长度: ${markdownContent.length}`,
    );

    // Step 5: 运行 Agent
    onProgress?.({ stage: "analyzing", progress: 10 });

    const summaries = await runSummarizationAgent(
      provider,
      markdownContent,
      (progress) => {
        // 将 Agent 进度映射到 10-90%
        const mappedProgress = 10 + (progress.progress * 0.8);
        onProgress?.({
          ...progress,
          progress: mappedProgress,
        });
      },
    );

    ztoolkit.log(`Paper2MD: Agent 完成，生成 ${summaries.size} 个章节总结`);

    // Step 6: 组装最终 Markdown
    onProgress?.({ stage: "saving", progress: 90 });

    const sections = parseSections(markdownContent);
    const summaryContent = assembleSummaryMarkdown(summaries, sections);

    // 添加元数据头
    const metadata = extractMetadata(item, "AI Summary");
    const finalContent = injectSummaryMetadata(summaryContent, metadata, item);

    // Step 7: 保存文件
    const summaryPath = PathUtils.join(
      storageDir,
      `${baseName}${SUMMARY_SUFFIX}.md`,
    );
    await Zotero.File.putContentsAsync(summaryPath, finalContent);

    ztoolkit.log(`Paper2MD: 总结文件保存到: ${summaryPath}`);

    // Step 8: 注册为 Zotero 笔记（BetterNote 兼容）
    await registerSummaryAsNote(item, finalContent);

    onProgress?.({ stage: "saving", progress: 100 });

    ztoolkit.log("Paper2MD: 总结生成完成!");

    return {
      success: true,
      summaryPath,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    ztoolkit.log(`Paper2MD: 总结生成失败 - ${errorMessage}`);
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
 * 检查条目是否可以生成总结
 *
 * @param item Zotero 条目
 * @returns 是否可以生成总结
 */
export async function canSummarizeItem(item: Zotero.Item): Promise<boolean> {
  // 必须是常规条目
  if (!item.isRegularItem()) {
    return false;
  }

  // 必须有 PDF 附件
  const pdfPath = await getPdfPath(item);
  if (!pdfPath) {
    return false;
  }

  // 检查是否有对应的 Markdown 文件
  const storageDir = await getItemStorageDir(item);
  const baseName = getBaseName(pdfPath);
  const markdownPath = PathUtils.join(storageDir, `${baseName}.md`);

  return IOUtils.exists(markdownPath);
}

/**
 * 检查 AI 服务配置是否完整
 *
 * @returns 是否配置完整
 */
export function isAIConfigured(): boolean {
  const apiUrl = getPref("aiApiUrl") as string;
  const apiKey = getPref("aiApiKey") as string;
  const model = getPref("aiModel") as string;

  // 如果没有设置，检查是否有预设
  const preset = getPref("aiProvider") as string;
  if (!preset || preset === "custom") {
    return validateProviderConfig({ apiUrl, apiKey, model });
  }

  // 使用预设时只需要 API Key
  return Boolean(apiKey && apiKey.trim().length > 0);
}

/**
 * 注入总结元数据到 Markdown
 */
function injectSummaryMetadata(
  content: string,
  metadata: ItemMetadata,
  item: Zotero.Item,
): string {
  const preset = getPref("aiProvider") as string || "unknown";
  const model = getPref("aiModel") as string || "unknown";

  const yamlLines = [
    "---",
    `title: "${metadata.title || ""}"`,
  ];

  // 添加作者
  if (metadata.authors && metadata.authors.length > 0) {
    yamlLines.push("authors:");
    for (const author of metadata.authors) {
      yamlLines.push(`  - "${author}"`);
    }
  }

  // 添加其他元数据
  if (metadata.year) yamlLines.push(`year: ${metadata.year}`);
  if (metadata.doi) yamlLines.push(`doi: "${metadata.doi}"`);
  yamlLines.push(`zotero_key: "${item.key}"`);
  yamlLines.push(`summary_generated_at: "${new Date().toISOString()}"`);
  yamlLines.push(`ai_provider: "${preset}"`);
  yamlLines.push(`ai_model: "${model}"`);
  yamlLines.push("---\n");

  return yamlLines.join("\n") + content;
}

/**
 * 注册总结为 Zotero 笔记（BetterNote 兼容）
 */
async function registerSummaryAsNote(
  item: Zotero.Item,
  markdownContent: string,
): Promise<void> {
  try {
    const title = item.getField("title") as string || "Untitled";
    const noteTitle = `📝 AI 总结: ${title}`;

    // 检查是否已存在同名笔记
    const noteIDs = item.getNotes();
    let existingNoteItem: Zotero.Item | null = null;

    for (const noteID of noteIDs) {
      const existingNote = await Zotero.Items.getAsync(noteID);
      if (existingNote) {
        const existingContent = existingNote.getNote();
        // 检查笔记标题是否匹配
        if (existingContent.includes("AI 总结:") || existingContent.includes("AI Summary")) {
          existingNoteItem = existingNote;
          break;
        }
      }
    }

    // 创建或更新笔记
    let note: Zotero.Item;
    if (existingNoteItem) {
      note = existingNoteItem;
      ztoolkit.log(`Paper2MD: 找到现有笔记，将更新`);
    } else {
      note = new Zotero.Item("note");
      note.libraryID = item.libraryID;
      note.parentID = item.id;
      // 先创建空笔记
      note.setNote(`<div data-schema-version="8"><h1>${escapeHtml(noteTitle)}</h1><p>正在生成...</p></div>`);
      await note.saveTx();
      ztoolkit.log(`Paper2MD: 创建新笔记`);
    }

    // 移除 YAML front matter（如果存在）
    const contentWithoutYaml = markdownContent.replace(/^---[\s\S]*?---\n*/m, "");

    // 在标题前添加 Markdown 标题
    const fullMarkdown = `# ${noteTitle}\n\n${contentWithoutYaml}`;

    // 尝试使用 Better Notes API 进行转换（如果可用）
    // Better Notes 使用 remark-math 来正确处理公式
    const betterNotesApi = (Zotero as any).BetterNotes?.api?.convert;

    if (betterNotesApi?.md2note) {
      try {
        ztoolkit.log(`Paper2MD: 使用 Better Notes API 转换 Markdown...`);
        // md2note 需要 MDStatus 对象和 noteItem
        const mdStatus = {
          content: fullMarkdown,
          filedir: "",  // 没有文件目录
        };
        const htmlContent = await betterNotesApi.md2note(mdStatus, note, { isImport: true });
        ztoolkit.log(`Paper2MD: Better Notes 转换完成，长度: ${htmlContent?.length || 0}`);

        if (htmlContent) {
          note.setNote(htmlContent);
          await note.saveTx();
          ztoolkit.log(`Paper2MD: 笔记内容已更新 (Better Notes API)`);
          return;
        }
      } catch (bnError) {
        ztoolkit.log(`Paper2MD: Better Notes API 转换失败，回退到内置转换器 - ${bnError}`);
      }
    } else {
      ztoolkit.log(`Paper2MD: Better Notes API 不可用，使用内置转换器`);
    }

    // 回退到内置的 Markdown 转换器
    try {
      ztoolkit.log(`Paper2MD: 使用内置转换器转换 Markdown...`);
      const htmlContent = formatMarkdownForNote(markdownContent, noteTitle);
      ztoolkit.log(`Paper2MD: HTML 转换完成，长度: ${htmlContent.length}`);
      note.setNote(htmlContent);
      await note.saveTx();
      ztoolkit.log(`Paper2MD: 笔记内容已更新 (内置转换器)`);
    } catch (formatError) {
      ztoolkit.log(`Paper2MD: HTML 转换或保存失败 - ${formatError}`);
      if (formatError instanceof Error && formatError.stack) {
        ztoolkit.log(`Paper2MD: 错误堆栈 - ${formatError.stack}`);
      }
    }
  } catch (error) {
    ztoolkit.log(`Paper2MD: 创建笔记失败 - ${error}`);
    if (error instanceof Error && error.stack) {
      ztoolkit.log(`Paper2MD: 错误堆栈 - ${error.stack}`);
    }
    // 笔记创建失败不影响主流程
  }
}

/**
 * 将 Markdown 转换为 Zotero 笔记 HTML 格式
 */
function formatMarkdownForNote(
  markdown: string,
  title: string,
): string {
  // 将 Markdown 转换为 HTML
  const htmlContent = markdownToHtml(markdown);

  return `<div data-schema-version="8"><h1>${escapeHtml(title)}</h1>${htmlContent}</div>`;
}


/**
 * 清理公式内容
 * 处理 AI 可能生成的格式问题
 */
function cleanMathContent(content: string, isBlock: boolean): string {
  // 去除前后空格
  content = content.trim();

  // 处理 AI 可能生成的多余 $ 符号
  // 例如：$$ $formula$ $$ -> formula
  if (content.startsWith("$") && content.endsWith("$")) {
    content = content.slice(1, -1).trim();
  }

  // 处理公式前后的多余空格（这是导致渲染失败的常见原因）
  // Zotero 需要 $公式$ 而不是 $ 公式 $
  content = content.trim();

  return content;
}

/**
 * 预处理公式格式
 * 修复 AI 可能生成的非标准公式格式
 */
function preprocessMathFormulas(text: string): string {
  // 修复 $$$...$$$（三个美元符号）-> $$...$$（标准块级公式）
  // AI 有时会错误地使用三个美元符号
  text = text.replace(/\$\$\$\s*([\s\S]*?)\s*\$\$\$/g, "$$$$1$$");

  // 修复 $$ $..$ $$ 格式（块级公式内部嵌套行内公式符号）
  // 例如：$$ $x^2$ $$ -> $$x^2$$
  text = text.replace(/\$\$\s*\$\s*([\s\S]*?)\s*\$\s*\$\$/g, "$$$$1$$");

  // 修复单个 $ 后面紧跟 $$ 的情况
  // 例如：$$$formula$$ -> $$formula$$
  text = text.replace(/\$\$\$([^\$]+)\$\$/g, "$$$$1$$");

  // 修复 $$ 后面紧跟单个 $ 的情况
  // 例如：$$formula$$$ -> $$formula$$
  text = text.replace(/\$\$([^\$]+)\$\$\$/g, "$$$$1$$");

  return text;
}

/**
 * 简单的 Markdown 到 HTML 转换器
 * 保留 LaTeX 公式格式 ($..$ 和 $$..$$)
 *
 * 公式格式说明（基于 Zotero note-editor 的 ProseMirror schema）：
 * - 行内公式: <span class="math">$公式内容$</span>
 * - 块级公式: <pre class="math">$$公式内容$$</pre>
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // 处理 YAML front matter - 移除
  html = html.replace(/^---[\s\S]*?---\n*/m, "");

  // 预处理：修复非标准的公式格式（如 $$$...$$$）
  html = preprocessMathFormulas(html);

  // 保护 LaTeX 公式（先用占位符替换）
  const mathPlaceholders: { type: "block" | "inline"; content: string }[] = [];

  // 步骤 1: 保护块级公式 $$...$$
  // 支持多行公式，包括公式前后有空格的情况
  // 使用非贪婪匹配，但需要确保正确匹配成对的 $$
  html = html.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (_match, content) => {
    const cleanContent = cleanMathContent(content, true);
    mathPlaceholders.push({ type: "block", content: cleanContent });
    return `__MATH_PLACEHOLDER_${mathPlaceholders.length - 1}__`;
  });

  // 步骤 2: 保护行内公式 $...$
  // 改进的正则：
  // - 不使用 lookbehind（某些环境不支持）
  // - 匹配 $ 后面不是 $ 的内容，直到下一个单独的 $
  // - 支持公式前后有空格的情况
  html = html.replace(/\$\s*([^\$]+?)\s*\$/g, (_match, content, offset) => {
    // 检查是否是独立的 $（不是 $$ 的一部分）
    // 检查前一个字符是否是 $
    if (offset > 0 && html[offset - 1] === "$") {
      return _match; // 这是 $$ 的一部分，跳过
    }
    // 检查后一个字符是否是 $
    const endPos = offset + _match.length;
    if (endPos < html.length && html[endPos] === "$") {
      return _match; // 这是 $$ 的一部分，跳过
    }

    const cleanContent = cleanMathContent(content, false);
    // 跳过空内容
    if (!cleanContent) {
      return _match;
    }
    mathPlaceholders.push({ type: "inline", content: cleanContent });
    return `__MATH_PLACEHOLDER_${mathPlaceholders.length - 1}__`;
  });

  // 处理代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang || "text"}">${escapeHtml(code.trim())}</code></pre>`;
  });

  // 处理行内代码（注意不要匹配公式占位符）
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 处理标题 (#### 到 #)
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // 处理粗体（注意不要匹配公式内的 *）
  html = html.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");

  // 处理表格
  html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content.split("|").map((cell: string) => cell.trim());
    // 检查是否是分隔行（全是 --- 或 :---: 等）
    if (cells.every((cell: string) => /^[-:]+$/.test(cell))) {
      return ""; // 跳过分隔行
    }
    const cellHtml = cells.map((cell: string) => `<td>${cell}</td>`).join("");
    return `<tr>${cellHtml}</tr>`;
  });

  // 包裹连续的表格行
  html = html.replace(/((<tr>.*<\/tr>\n?)+)/g, "<table>$1</table>");

  // 移除图片（不再处理图片，直接忽略）
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "");

  // 处理链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 处理无序列表
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // 处理水平线
  html = html.replace(/^---$/gm, "<hr>");

  // 处理段落（连续的非空行）
  const lines = html.split("\n");
  const result: string[] = [];
  let inParagraph = false;
  let paragraphContent = "";

  for (const line of lines) {
    const trimmed = line.trim();
    // 如果是空行或者是 HTML 标签开头
    if (!trimmed || /^<(h[1-6]|ul|ol|table|pre|hr|blockquote|div)/.test(trimmed)) {
      if (inParagraph && paragraphContent) {
        result.push(`<p>${paragraphContent.trim()}</p>`);
        paragraphContent = "";
      }
      inParagraph = false;
      if (trimmed) {
        result.push(trimmed);
      }
    } else if (/^<\/(h[1-6]|ul|ol|table|pre|blockquote|div)>/.test(trimmed)) {
      result.push(trimmed);
    } else if (/^<(li|tr|td|th|code)/.test(trimmed)) {
      // 这些标签在其父标签内，直接添加
      if (inParagraph && paragraphContent) {
        result.push(`<p>${paragraphContent.trim()}</p>`);
        paragraphContent = "";
        inParagraph = false;
      }
      result.push(trimmed);
    } else {
      // 普通文本行
      if (!inParagraph) {
        inParagraph = true;
      }
      paragraphContent += (paragraphContent ? " " : "") + trimmed;
    }
  }

  // 处理最后的段落
  if (inParagraph && paragraphContent) {
    result.push(`<p>${paragraphContent.trim()}</p>`);
  }

  html = result.join("\n");

  // 恢复 LaTeX 公式（包裹在正确的 HTML 标签中）
  // Zotero 笔记编辑器需要（基于 zotero/note-editor 的 ProseMirror schema）:
  // - 行内公式: <span class="math">$...$</span>
  // - 块级公式: <pre class="math">$$...$$</pre>
  // 重要：$ 和公式内容之间不能有空格！
  mathPlaceholders.forEach((item, index) => {
    const placeholder = `__MATH_PLACEHOLDER_${index}__`;
    if (html.includes(placeholder)) {
      if (item.type === "block") {
        // 块级公式：使用 <pre class="math">$$内容$$</pre>
        html = html.replace(
          placeholder,
          `<pre class="math">$$${item.content}$$</pre>`,
        );
      } else {
        // 行内公式：使用 <span class="math">$内容$</span>
        html = html.replace(
          placeholder,
          `<span class="math">$${item.content}$</span>`,
        );
      }
    }
  });

  return html;
}

/**
 * 转义 HTML 特殊字符（仅用于代码块内容）
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
