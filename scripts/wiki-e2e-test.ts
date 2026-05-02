/**
 * Wiki Agent 端到端验证
 * 测试问答流程：wikiList → wikiSearch → wikiRead → 回答
 */
import { mastra } from "../src/mastra"

const agent = mastra.getAgent("wikiAgent")

console.log("🧪 Wiki Agent 端到端测试\n")
console.log("📝 问题: WMS系统的入库流程是什么？\n")

const response = await agent.generate("WMS系统的入库流程是什么？", { maxSteps: 10 })

console.log("📋 回答:")
console.log(response.text)
console.log("\n---")
console.log("🔧 工具调用:")
for (const step of response.steps) {
  for (const tc of step.toolCalls || []) {
    console.log(`  - ${tc.toolName}(${JSON.stringify(tc.args ?? {}).slice(0, 80)})`)
  }
}
console.log("\n✅ 测试完成")
