/**
 * LLM Client Configuration
 * Configured for Alibaba Cloud Bailian (百炼平台)
 * Using Anthropic API format
 */
import { ChatAnthropic } from "@langchain/anthropic";
import type { StructuredTool } from "@langchain/core/tools";
import { BaseMessage } from "@langchain/core/messages";
/**
 * Create LLM client with Alibaba Cloud Bailian configuration
 *
 * 阿里云百炼平台使用 Anthropic 兼容格式
 * 文档: https://bailian.aliyun.com/
 *
 * 注意：百炼的 Coding Plan 通常使用特定的应用端点
 */
export declare function createLLMClient(): ChatAnthropic;
/**
 * Create LLM client with tool binding
 */
export declare function createLLMWithTools(tools: StructuredTool[]): import("@langchain/core/runnables").Runnable<import("@langchain/core/language_models/base").BaseLanguageModelInput, import("@langchain/core/messages").AIMessageChunk<import("@langchain/core/messages").MessageStructure<import("@langchain/core/messages").MessageToolSet>>, import("@langchain/anthropic").ChatAnthropicCallOptions>;
/**
 * Convert our message format to LangChain format
 */
export declare function toLangChainMessages(messages: {
    role: string;
    content: string | unknown[];
}[]): BaseMessage[];
/**
 * Estimate token count (rough approximation: 4 chars per token)
 */
export declare function estimateTokenCount(text: string): number;
export declare function estimateMessageTokens(messages: BaseMessage[]): number;
//# sourceMappingURL=client.d.ts.map