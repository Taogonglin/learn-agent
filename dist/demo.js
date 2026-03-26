/**
 * Agent 循环演示
 * 展示真正的多轮 Agent 循环
 */

import { createAgentGraph, createInitialState } from "./agents/graph.js";
import { HumanMessage } from "@langchain/core/messages";
import dotenv from "dotenv";

dotenv.config();

console.log("=".repeat(70));
console.log("🤖 Agent Loop Demonstration - 真正的多轮 Agent 循环");
console.log("=".repeat(70));

console.log(`
📋 循环流程说明：

  ┌─────────────────────────────────────────────────────────────┐
  │                    AGENT LOOP (Agent 循环)                   │
  └─────────────────────────────────────────────────────────────┘

  START
    │
    ▼
  ┌───────────┐     ┌──────────────────┐
  │ llm_call  │────►│ shouldContinue?  │
  └───────────┘     └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
      有 tool_calls      无 tool_calls     stop=true
            │                │                │
            ▼                ▼                ▼
  ┌─────────────────┐   ┌──────┐        ┌──────┐
  │ tool_execution  │   │ END  │        │ END  │
  └────────┬────────┘   └──────┘        └──────┘
           │
           │ (执行工具，更新状态)
           │
           └──────────────────────┐
                                  │
           ┌──────────────────────┘
           │
           ▼
    回到 llm_call (LLM 看到结果，决定下一步)

  循环特点：
  1️⃣  LLM 可以多次调用工具
  2️⃣  工具结果反馈给 LLM
  3️⃣  LLM 根据结果决定下一步
  4️⃣  直到任务完成才停止
`);

async function main() {
  const graph = createAgentGraph();

  console.log("\n🚀 启动测试...\n");

  // 场景 1：简单问候（预期 1 轮，LLM 不调用工具）
  console.log("─".repeat(70));
  console.log("【场景 1】简单问候");
  console.log("─".repeat(70));

  const state1 = createInitialState();
  state1.messages.push(new HumanMessage({ content: "Hello!" }));

  const stream1 = await graph.stream(state1, {
    configurable: { thread_id: `demo_1_${Date.now()}` },
  });

  let round1 = 0;
  for await (const update of stream1) {
    round1++;
    const s = update.__start__ || update;
    const msgCount = s?.messages?.length || 0;
    console.log(`  第 ${round1} 轮 - 消息数: ${msgCount}`);
  }

  console.log(`✅ 场景 1 完成，共 ${round1} 轮`);
  console.log("   (LLM 直接回复，没有调用工具)\n");

  // 场景 2：请求使用工具（预期多轮）
  console.log("─".repeat(70));
  console.log("【场景 2】要求创建待办列表（可能触发工具）");
  console.log("─".repeat(70));

  const state2 = createInitialState();
  state2.messages.push(new HumanMessage({
    content: "Create a todo list for implementing a feature with 3 steps: 1) Setup project 2) Write code 3) Test"
  }));

  const stream2 = await graph.stream(state2, {
    configurable: { thread_id: `demo_2_${Date.now()}` },
  });

  let round2 = 0;

  for await (const update of stream2) {
    round2++;
    const s = update.__start__ || update;
    const msgs = s?.messages || [];
    const lastMsg = msgs[msgs.length - 1];

    let detail = `  第 ${round2} 轮`;

    if (lastMsg) {
      if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
        detail += ` - LLM 请求调用 ${lastMsg.tool_calls.length} 个工具`;
        lastMsg.tool_calls.forEach((tc, i) => {
          detail += `\n     [Tool ${i+1}] ${tc.name}`;
        });
      } else if (typeof lastMsg.content === 'string' && lastMsg.content.startsWith('[')) {
        detail += ` - 工具执行结果`;
      } else if (lastMsg.content) {
        const content = String(lastMsg.content).slice(0, 50);
        detail += ` - LLM 回复: "${content}..."`;
      }
    }

    console.log(detail);
  }

  console.log(`✅ 场景 2 完成，共 ${round2} 轮`);
  if (round2 > 1) {
    console.log("   (Agent 循环工作正常！LLM 调用了工具)\n");
  } else {
    console.log("   (LLM 选择直接回复，未调用工具)\n");
  }

  console.log("=".repeat(70));
  console.log("✨ Agent 循环演示完成！");
  console.log("=".repeat(70));
  console.log(`
总结：
- 场景 1: ${round1} 轮 (简单任务)
- 场景 2: ${round2} 轮 (复杂任务)

真正的 Agent 可以：
✓ 根据任务复杂度自主决定调用工具
✓ 多轮交互直到任务完成
✓ 工具结果反馈给 LLM 做下一步决策
`);
}

main().catch(console.error);
