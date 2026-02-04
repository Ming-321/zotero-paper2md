/**
 * 总结 Agent
 *
 * 实现工具调用循环，让 AI 自主决定如何处理论文
 */

import {
  Section,
  SectionType,
  ChatMessage,
  ToolDefinition,
  ToolCall,
  AgentState,
  SectionSummary,
  SummarizationProgress,
  SummarizationProgressCallback,
} from "./types";
import { IAIProvider } from "./providers/types";
import {
  parseSections,
  getSectionContent,
  formatSectionsForAgent,
} from "./markdownParser";
import { SUMMARIZATION_SYSTEM_PROMPT } from "./prompts";

/** 最大步骤数（防止无限循环） */
const MAX_STEPS = 50;

/**
 * Agent 工具定义
 */
const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "getSections",
      description: "获取论文的所有章节标题和结构。调用此工具了解论文的整体结构。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "readSection",
      description: "读取指定章节的完整内容。用于获取需要总结的章节详情。",
      parameters: {
        type: "object",
        properties: {
          sectionTitle: {
            type: "string",
            description: "要读取的章节标题",
          },
        },
        required: ["sectionTitle"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "writeSummary",
      description:
        "输出一个章节的总结。根据章节类型采用不同格式：normal（普通章节）、method（方法章节）、experiment（实验章节）、appendix（附录章节）。",
      parameters: {
        type: "object",
        properties: {
          sectionTitle: {
            type: "string",
            description: "章节标题",
          },
          sectionType: {
            type: "string",
            enum: ["normal", "method", "experiment", "appendix"],
            description: "章节类型",
          },
          summary: {
            type: "string",
            description: "Markdown 格式的总结内容",
          },
        },
        required: ["sectionTitle", "sectionType", "summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finalize",
      description: "所有章节总结完成后调用此工具，表示总结任务完成。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

/**
 * 创建 Agent 上下文
 */
interface AgentContext {
  /** AI Provider */
  provider: IAIProvider;
  /** 解析后的章节 */
  sections: Section[];
  /** 原始 Markdown 内容 */
  markdown: string;
  /** Agent 状态 */
  state: AgentState;
  /** 进度回调 */
  onProgress?: SummarizationProgressCallback;
}

/**
 * 运行总结 Agent
 *
 * @param provider AI Provider
 * @param markdown 原始 Markdown 内容
 * @param onProgress 进度回调
 * @returns 章节总结 Map
 */
export async function runSummarizationAgent(
  provider: IAIProvider,
  markdown: string,
  onProgress?: SummarizationProgressCallback,
): Promise<Map<string, SectionSummary>> {
  // 解析章节
  const sections = parseSections(markdown);

  // 初始化状态
  const state: AgentState = {
    processedSections: [],
    summaries: new Map(),
    stepCount: 0,
    isComplete: false,
  };

  // 创建上下文
  const context: AgentContext = {
    provider,
    sections,
    markdown,
    state,
    onProgress,
  };

  // 初始化消息
  const messages: ChatMessage[] = [
    { role: "system", content: SUMMARIZATION_SYSTEM_PROMPT },
    {
      role: "user",
      content: "请分析这篇论文并生成结构化的中文总结。首先获取章节结构，然后逐章节进行总结。",
    },
  ];

  // 报告开始
  onProgress?.({
    stage: "analyzing",
    progress: 0,
    totalSections: sections.length,
  });

  // Agent 循环
  while (!state.isComplete && state.stepCount < MAX_STEPS) {
    state.stepCount++;
    const startTime = Date.now();
    ztoolkit.log(`Paper2MD: Agent 步骤 ${state.stepCount}，开始调用 AI...`);

    // 更新进度：显示正在思考
    const thinkingProgress = Math.min(
      10 + (state.processedSections.length / Math.max(sections.length, 1)) * 80,
      89,
    );
    onProgress?.({
      stage: "summarizing",
      progress: thinkingProgress,
      currentSection: state.stepCount === 1 ? "正在分析论文结构..." : `AI 正在思考... (步骤 ${state.stepCount})`,
      completedSections: [...state.processedSections],
      totalSections: sections.length,
    });

    // 调用 AI
    let response;
    try {
      response = await provider.chat(messages, AGENT_TOOLS, {
        temperature: 0.3, // 较低的温度以获得更稳定的输出
      });
      const elapsed = Date.now() - startTime;
      ztoolkit.log(`Paper2MD: AI 响应成功，耗时: ${elapsed}ms，finish_reason: ${response.choices[0]?.finish_reason}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      ztoolkit.log(`Paper2MD: AI 调用失败: ${errorMsg}`);
      throw error;
    }

    const choice = response.choices[0];
    if (!choice) {
      ztoolkit.log("Paper2MD: AI 响应没有 choices");
      throw new Error("AI 响应格式错误：没有 choices");
    }

    const message = choice.message;
    ztoolkit.log(`Paper2MD: AI 消息 role: ${message.role}, tool_calls: ${message.tool_calls?.length || 0}`);

    // 添加 assistant 消息到历史
    messages.push(message);

    // 检查是否需要调用工具
    if (choice.finish_reason === "tool_calls" && message.tool_calls) {
      ztoolkit.log(`Paper2MD: 执行 ${message.tool_calls.length} 个工具调用`);
      // 执行工具调用
      for (const toolCall of message.tool_calls) {
        const result = await executeToolCall(toolCall, context);

        // 添加工具结果到消息
        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      }
    } else {
      // AI 完成了回复，但没有调用 finalize
      // 可能是出错了，提示继续
      if (!state.isComplete) {
        messages.push({
          role: "user",
          content: "请继续处理剩余章节，或者如果已全部完成，请调用 finalize 工具。",
        });
      }
    }

    // 更新进度
    const progress = Math.min(
      (state.processedSections.length / sections.length) * 100,
      99,
    );
    onProgress?.({
      stage: "summarizing",
      progress,
      currentSection: state.processedSections[state.processedSections.length - 1],
      completedSections: [...state.processedSections],
      totalSections: sections.length,
    });
  }

  // 检查是否超出步骤限制
  if (state.stepCount >= MAX_STEPS && !state.isComplete) {
    ztoolkit.log("Paper2MD: Agent 达到最大步骤数，强制完成");
  }

  return state.summaries;
}

/**
 * 执行工具调用
 */
async function executeToolCall(
  toolCall: ToolCall,
  context: AgentContext,
): Promise<unknown> {
  const { name, arguments: argsString } = toolCall.function;

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsString);
  } catch {
    return { error: "参数解析失败" };
  }

  ztoolkit.log(`Paper2MD: Agent 调用工具 ${name}`, args);

  switch (name) {
    case "getSections":
      return handleGetSections(context);

    case "readSection":
      return handleReadSection(args.sectionTitle as string, context);

    case "writeSummary":
      return handleWriteSummary(
        args.sectionTitle as string,
        args.sectionType as SectionType,
        args.summary as string,
        context,
      );

    case "finalize":
      return handleFinalize(context);

    default:
      return { error: `未知工具: ${name}` };
  }
}

/**
 * 处理 getSections 工具调用
 */
function handleGetSections(context: AgentContext): unknown {
  const formatted = formatSectionsForAgent(context.sections);
  return {
    success: true,
    sections: formatted,
    totalSections: context.sections.length,
  };
}

/**
 * 处理 readSection 工具调用
 */
function handleReadSection(
  sectionTitle: string,
  context: AgentContext,
): unknown {
  const content = getSectionContent(context.sections, sectionTitle);

  if (!content) {
    return {
      success: false,
      error: `未找到章节: ${sectionTitle}`,
    };
  }

  return {
    success: true,
    title: sectionTitle,
    content,
  };
}

/**
 * 处理 writeSummary 工具调用
 */
function handleWriteSummary(
  sectionTitle: string,
  sectionType: SectionType,
  summary: string,
  context: AgentContext,
): unknown {
  // 保存总结
  context.state.summaries.set(sectionTitle, {
    title: sectionTitle,
    type: sectionType,
    content: summary,
  });

  // 标记为已处理
  if (!context.state.processedSections.includes(sectionTitle)) {
    context.state.processedSections.push(sectionTitle);
  }

  ztoolkit.log(`Paper2MD: 已总结章节 "${sectionTitle}" (${sectionType})`);

  return {
    success: true,
    message: `已保存章节 "${sectionTitle}" 的总结`,
  };
}

/**
 * 处理 finalize 工具调用
 */
function handleFinalize(context: AgentContext): unknown {
  context.state.isComplete = true;

  ztoolkit.log(
    `Paper2MD: Agent 完成，共处理 ${context.state.summaries.size} 个章节`,
  );

  return {
    success: true,
    message: "总结任务完成",
    totalSections: context.state.summaries.size,
  };
}

/**
 * 将总结结果组装为 Markdown
 *
 * @param summaries 章节总结 Map
 * @param sections 原始章节结构（用于排序）
 * @returns Markdown 内容
 */
export function assembleSummaryMarkdown(
  summaries: Map<string, SectionSummary>,
  sections: Section[],
): string {
  const lines: string[] = [];

  // 添加标题
  lines.push("# 论文总结\n");

  // 按原始章节顺序输出
  function outputSection(section: Section, level: number = 2) {
    const summary = summaries.get(section.title);

    if (summary) {
      // 输出章节标题
      lines.push(`${"#".repeat(level)} ${section.title}\n`);

      // 输出总结内容
      lines.push(summary.content);
      lines.push("");
    }

    // 递归处理子章节
    if (section.subsections) {
      for (const sub of section.subsections) {
        outputSection(sub, Math.min(level + 1, 6));
      }
    }
  }

  for (const section of sections) {
    outputSection(section);
  }

  return lines.join("\n");
}
