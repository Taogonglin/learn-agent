/**
 * Agent 功能测试脚本
 * 测试 LangGraph Agent 的基本功能
 */

import { createAgentGraph, createInitialState } from "./agents/graph.js";
import { HumanMessage } from "@langchain/core/messages";
import dotenv from "dotenv";

dotenv.config();

console.log("=".repeat(60));
console.log("LangGraph Agent 功能测试");
console.log("=".repeat(60));

// 测试 1: 创建 Agent 实例
console.log("\n[Test 1] 创建 Agent 实例...");
try {
  const graph = createAgentGraph();
  console.log("✓ Agent 实例创建成功");
} catch (error) {
  console.error("✗ Agent 实例创建失败:", error);
  process.exit(1);
}

// 测试 2: 创建初始状态
console.log("\n[Test 2] 创建初始状态...");
try {
  const state = createInitialState();
  console.log("✓ 初始状态创建成功");
  console.log(`  - 消息数: ${state.messages.length}`);
  console.log(`  - Todos: ${state.todos.length}`);
  console.log(`  - 技能数: ${state.loadedSkills.length}`);
  console.log(`  - 任务数: ${state.tasks.length}`);
  console.log(`  - 后台任务: ${state.backgroundJobs.length}`);
} catch (error) {
  console.error("✗ 初始状态创建失败:", error);
  process.exit(1);
}

// 测试 3: 检查环境变量
console.log("\n[Test 3] 检查环境变量...");
const requiredEnvVars = ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "ANTHROPIC_MODEL"];
let hasAllEnvVars = true;
for (const envVar of requiredEnvVars) {
  const value = process.env[envVar];
  if (value) {
    console.log(`✓ ${envVar}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`✗ ${envVar}: 未设置`);
    hasAllEnvVars = false;
  }
}

if (!hasAllEnvVars) {
  console.log("\n⚠️ 警告: 部分环境变量未设置，LLM 调用可能失败");
}

// 测试 4: 尝试运行 Agent（如果环境变量配置正确）
console.log("\n[Test 4] 运行 Agent 测试...");
if (hasAllEnvVars) {
  try {
    const graph = createAgentGraph();
    const state = createInitialState();
    state.messages.push(new HumanMessage({ content: "Hello, this is a test message." }));

    console.log("  启动 Agent 流...");
    const stream = await graph.stream(state, {
      configurable: {
        thread_id: `test_${Date.now()}`,
      },
    });

    let updateCount = 0;
    for await (const update of stream) {
      updateCount++;
      console.log(`  收到更新 #${updateCount}`);
    }

    console.log(`✓ Agent 运行完成，共 ${updateCount} 次状态更新`);
  } catch (error) {
    console.error("✗ Agent 运行失败:", error instanceof Error ? error.message : String(error));
    console.log("\n这可能是因为:");
    console.log("1. API 密钥无效");
    console.log("2. 网络连接问题");
    console.log("3. API 端点配置错误");
  }
} else {
  console.log("  跳过（环境变量不完整）");
}

console.log("\n" + "=".repeat(60));
console.log("测试完成");
console.log("=".repeat(60));
