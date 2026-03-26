/**
 * LLM Client Configuration
 * Configured for Alibaba Cloud Bailian (百炼平台)
 * Using Anthropic API format
 */

import { ChatAnthropic } from "@langchain/anthropic";
import type { StructuredTool } from "@langchain/core/tools";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import * as fs from "fs";

// 手动读取 .env 文件并强制设置环境变量
try {
  const envContent = fs.readFileSync(".env", "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match && match[1] && match[2]) {
      const key = match[1];
      const value = match[2];
      if (value && !value.startsWith("#")) {
        process.env[key] = value.trim();
      }
    }
  });
} catch (e) {
  // .env 文件不存在时忽略
}

// Validate environment variables
const requiredEnvVars = ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`Warning: ${envVar} is not set`);
  }
}

/**
 * Create LLM client with Alibaba Cloud Bailian configuration
 *
 * 阿里云百炼平台使用 Anthropic 兼容格式
 * 文档: https://bailian.aliyun.com/
 *
 * 注意：百炼的 Coding Plan 通常使用特定的应用端点
 */
export function createNamedLLMClient(modelNameOverride?: string): ChatAnthropic {
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const modelName = modelNameOverride || process.env.ANTHROPIC_MODEL || "kimi-k2.5";
  const debugEnabled = process.env.DEBUG === "true";

  if (debugEnabled) {
    console.log("[DEBUG] 正在创建 LLM 客户端...");
    console.log(`[DEBUG] API Key: ${apiKey ? apiKey.substring(0, 20) + "..." : "未设置"}`);
    console.log(`[DEBUG] Base URL: ${baseURL}`);
    console.log(`[DEBUG] Model: ${modelName}`);
  }

  if (!apiKey) {
    throw new Error("ANTHROPIC_AUTH_TOKEN 环境变量未设置 (使用阿里云百炼的 API-KEY)");
  }

  if (!baseURL) {
    throw new Error("ANTHROPIC_BASE_URL 环境变量未设置");
  }

  // 阿里云百炼使用 Anthropic 兼容模式
  const model = new ChatAnthropic({
    model: modelName,
    anthropicApiKey: apiKey,
    anthropicApiUrl: baseURL,
    temperature: 0,
    maxTokens: 8000,
    streaming: false,
  });

  if (debugEnabled) {
    console.log("[DEBUG] LLM 客户端创建成功");
  }

  return model;
}

export function createLLMClient(): ChatAnthropic {
  return createNamedLLMClient();
}

/**
 * Create LLM client with tool binding
 */
export function createLLMWithTools(tools: StructuredTool[]) {
  const model = createLLMClient();
  return model.bindTools(tools);
}

/**
 * Convert our message format to LangChain format
 */
export function toLangChainMessages(messages: { role: string; content: string | unknown[] }[]): BaseMessage[] {
  return messages.map((msg) => {
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

    switch (msg.role) {
      case "system":
        return new SystemMessage(content);
      case "assistant":
        return new AIMessage(content);
      case "user":
      default:
        return new HumanMessage(content);
    }
  });
}

/**
 * Estimate token count (rough approximation: 4 chars per token)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(messages: BaseMessage[]): number {
  const text = messages.map((m) => m.content).join("");
  return estimateTokenCount(text);
}
