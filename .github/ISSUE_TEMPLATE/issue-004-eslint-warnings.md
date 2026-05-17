---
title: "ESLint 存在 37 个未使用导入和变量警告"
labels: ["good first issue", "ai:trae"]
---

## 问题描述
ESLint 检查发现 37 个警告，主要为未使用的导入和变量。

## 警告列表
1. `next.config.ts:2` - 'resolve' is defined but never used
2. `packages/mes-mock-api/src/index.ts:54` - Assign object to a variable before exporting as module default
3. `scripts/wiki-ingest.ts:101` - '_e' is defined but never used
4. `src/__tests__/api-schemas.test.ts:4` - 'UpdateDatasourceSchema' is defined but never used
5. `src/__tests__/auth-mocked.test.ts:77` - Unexpected any
6. `src/__tests__/console-log-api-base.test.ts:43` - 'inEffectDef' is assigned but never used
7. `src/__tests__/dashscope-tts.test.ts:10` - 'mockOnClose' is assigned but never used
8. `src/__tests__/dashscope-tts.test.ts:51` - 'session' is assigned but never used
9. `src/__tests__/datasource-query-tool.test.ts:29` - Unexpected any
10. `src/__tests__/datasource-query-tool.test.ts:159` - Unexpected any
11. `src/__tests__/providers.test.ts:1` - 'mock' is defined but never used
12. `src/__tests__/seed.test.ts:1` - 'beforeEach' is defined but never used
13. `src/__tests__/voice-platform.test.ts` - Multiple unexpected any
14. `src/__tests__/wiki-path-traversal.test.ts:2` - 'resolve' is defined but never used
15. `src/__tests__/with-auth-detailed.test.ts:76` - 'res' is assigned but never used
16. `src/app/admin/datasources/page.tsx:5` - 'Loader2' is defined but never used
17. `src/app/page.tsx:7` - 'Download', 'Check' are defined but never used
18. `src/components/agent-message.tsx:278` - 'showMeetingHeader' is defined but never used
19. `src/components/agent-message.tsx:323` - 'args' is defined but never used
20. `src/hooks/use-agent-progress.ts:3` - 'useRef' is defined but never used
21. `src/lib/crypto.ts:9` - 'AUTH_TAG_LENGTH' is assigned but never used
22. `src/lib/voice/platform.ts` - Multiple unexpected any

## 修复建议
运行 `bun run lint:fix` 自动修复大部分问题。
