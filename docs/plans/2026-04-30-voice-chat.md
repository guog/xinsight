# 语音对话功能 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 为 xinsight 添加基于阿里云 DashScope 的实时语音对话功能（STT + TTS），支持纯语音/语音+文字两种显示模式，管理员可配置语音供应商。

**Architecture:**

- 语音供应商配置复用 LLM Provider 的环境变量驱动模式（`src/lib/voice.ts`）
- 实时通信使用 WebSocket（Next.js Route Handler + DashScope 流式 API）
- 前端录音使用 Web Audio API + MediaRecorder，跨平台兼容 Capacitor

**Tech Stack:** 阿里云 DashScope Paraformer (STT) + CosyVoice (TTS)、WebSocket、Web Audio API、Next.js API Routes

---

## Phase 1: 管理配置与基础设施

### Task 1: 语音供应商注册表

**Objective:** 创建类似 `src/lib/models.ts` 的语音供应商配置模块

**Files:**

- Create: `src/lib/voice.ts`
- Create: `src/__tests__/voice.test.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/voice.test.ts
import { describe, test, expect, beforeEach } from "vitest"

describe("voice provider registry", () => {
  beforeEach(() => {
    // 清除缓存
    const { _resetVoiceCache } = require("@/lib/voice")
    _resetVoiceCache()
  })

  test("returns empty when no API key configured", () => {
    delete process.env.DASHSCOPE_API_KEY
    delete process.env.VOICE_ENABLED
    const { getVoiceConfig } = require("@/lib/voice")
    const config = getVoiceConfig()
    expect(config.enabled).toBe(false)
    expect(config.sttProvider).toBeNull()
    expect(config.ttsProvider).toBeNull()
  })

  test("returns dashscope provider when configured", () => {
    process.env.DASHSCOPE_API_KEY = "sk-test"
    process.env.VOICE_ENABLED = "true"
    const { getVoiceConfig } = require("@/lib/voice")
    const config = getVoiceConfig()
    expect(config.enabled).toBe(true)
    expect(config.sttProvider).toMatchObject({
      id: "dashscope",
      name: "阿里云 DashScope",
      sttModel: "paraformer-realtime-v2",
    })
    expect(config.ttsProvider).toMatchObject({
      id: "dashscope",
      name: "阿里云 DashScope",
      ttsModel: "cosyvoice-v1",
    })
  })

  test("allows custom TTS voice via env", () => {
    process.env.DASHSCOPE_API_KEY = "sk-test"
    process.env.VOICE_ENABLED = "true"
    process.env.TTS_VOICE = "longxiaochun"
    const { getVoiceConfig } = require("@/lib/voice")
    const config = getVoiceConfig()
    expect(config.ttsProvider!.voice).toBe("longxiaochun")
  })
})
```

**Step 2: Run test to verify failure**

Run: `bun run test src/__tests__/voice.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/lib/voice.ts
/**
 * 语音服务配置 — 环境变量驱动
 *
 * 环境变量：
 * - VOICE_ENABLED: "true" 启用语音模式
 * - DASHSCOPE_API_KEY: 阿里云 DashScope API Key（与 Qwen LLM 共用）
 * - STT_MODEL: STT 模型（默认 paraformer-realtime-v2）
 * - TTS_MODEL: TTS 模型（默认 cosyvoice-v1）
 * - TTS_VOICE: TTS 音色（默认 longxiaochun）
 * - TTS_SAMPLE_RATE: 采样率（默认 22050）
 */

export interface STTProviderInfo {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  sttModel: string
  /** 支持的语言列表 */
  languages: string[]
}

export interface TTSProviderInfo {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  ttsModel: string
  voice: string
  sampleRate: number
  /** 可用音色列表 */
  availableVoices: VoiceOption[]
}

export interface VoiceOption {
  id: string
  name: string
  language: string
  gender: "male" | "female"
}

export interface VoiceConfig {
  enabled: boolean
  sttProvider: STTProviderInfo | null
  ttsProvider: TTSProviderInfo | null
}

const DEFAULT_VOICES: VoiceOption[] = [
  { id: "longxiaochun", name: "龙小淳", language: "zh", gender: "female" },
  { id: "longlaotie", name: "龙老铁", language: "zh", gender: "male" },
  { id: "longshu", name: "龙书", language: "zh", gender: "male" },
  { id: "longshuo", name: "龙硕", language: "en", gender: "male" },
  { id: "longjielidou", name: "龙杰力豆", language: "zh", gender: "male" },
  { id: "longyue", name: "龙悦", language: "zh", gender: "female" },
  { id: "longwan", name: "龙婉", language: "zh", gender: "female" },
]

let _cachedConfig: VoiceConfig | null = null

function buildVoiceConfig(): VoiceConfig {
  const enabled = process.env.VOICE_ENABLED === "true"
  const apiKey = process.env.DASHSCOPE_API_KEY || ""

  if (!enabled || !apiKey) {
    return { enabled: false, sttProvider: null, ttsProvider: null }
  }

  const sttModel = process.env.STT_MODEL || "paraformer-realtime-v2"
  const ttsModel = process.env.TTS_MODEL || "cosyvoice-v1"
  const voice = process.env.TTS_VOICE || "longxiaochun"
  const sampleRate = parseInt(process.env.TTS_SAMPLE_RATE || "22050", 10)

  return {
    enabled: true,
    sttProvider: {
      id: "dashscope",
      name: "阿里云 DashScope",
      apiKey,
      baseUrl: "wss://dashscope.aliyuncs.com/api-ws/v1/inference",
      sttModel,
      languages: ["zh", "en", "ja", "ko"],
    },
    ttsProvider: {
      id: "dashscope",
      name: "阿里云 DashScope",
      apiKey,
      baseUrl: "wss://dashscope.aliyuncs.com/api-ws/v1/inference",
      ttsModel,
      voice,
      sampleRate,
      availableVoices: DEFAULT_VOICES,
    },
  }
}

export function getVoiceConfig(): VoiceConfig {
  if (!_cachedConfig) {
    _cachedConfig = buildVoiceConfig()
  }
  return _cachedConfig
}

export function _resetVoiceCache() {
  _cachedConfig = null
}
```

**Step 4: Run test to verify pass**

Run: `bun run test src/__tests__/voice.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/voice.ts src/__tests__/voice.test.ts
git commit -m "feat(voice): 添加语音供应商注册表"
```

---

### Task 2: 语音配置 API 端点

**Objective:** 暴露语音配置状态给前端（不含 API Key），管理员可通过此端点检查配置

**Files:**

- Create: `src/app/api/voice/config/route.ts`
- Create: `src/__tests__/api-voice-config.test.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/api-voice-config.test.ts
import { describe, test, expect, beforeEach } from "vitest"

describe("GET /api/voice/config", () => {
  beforeEach(() => {
    const { _resetVoiceCache } = require("@/lib/voice")
    _resetVoiceCache()
  })

  test("returns disabled when VOICE_ENABLED is not set", async () => {
    delete process.env.VOICE_ENABLED
    const { GET } = await import("@/app/api/voice/config/route")
    const res = await GET()
    const data = await res.json()
    expect(data.enabled).toBe(false)
    expect(data.stt).toBeNull()
    expect(data.tts).toBeNull()
  })

  test("returns config without apiKey when enabled", async () => {
    process.env.VOICE_ENABLED = "true"
    process.env.DASHSCOPE_API_KEY = "sk-secret"
    const { GET } = await import("@/app/api/voice/config/route")
    const res = await GET()
    const data = await res.json()
    expect(data.enabled).toBe(true)
    expect(data.stt.model).toBe("paraformer-realtime-v2")
    expect(data.tts.model).toBe("cosyvoice-v1")
    expect(data.tts.voices).toHaveLength(7)
    // API Key 不应暴露
    expect(data.stt.apiKey).toBeUndefined()
    expect(data.tts.apiKey).toBeUndefined()
  })
})
```

**Step 2: Run test to verify failure**

Run: `bun run test src/__tests__/api-voice-config.test.ts`

**Step 3: Write implementation**

```typescript
// src/app/api/voice/config/route.ts
import { NextResponse } from "next/server"
import { getVoiceConfig } from "@/lib/voice"

export async function GET() {
  const config = getVoiceConfig()

  if (!config.enabled) {
    return NextResponse.json({ enabled: false, stt: null, tts: null })
  }

  return NextResponse.json({
    enabled: true,
    stt: {
      provider: config.sttProvider!.id,
      name: config.sttProvider!.name,
      model: config.sttProvider!.sttModel,
      languages: config.sttProvider!.languages,
    },
    tts: {
      provider: config.ttsProvider!.id,
      name: config.ttsProvider!.name,
      model: config.ttsProvider!.ttsModel,
      voice: config.ttsProvider!.voice,
      sampleRate: config.ttsProvider!.sampleRate,
      voices: config.ttsProvider!.availableVoices,
    },
  })
}
```

**Step 4: Run test, verify pass**

**Step 5: Commit**

```bash
git add src/app/api/voice/config/route.ts src/__tests__/api-voice-config.test.ts
git commit -m "feat(voice): 添加语音配置 API 端点"
```

---

### Task 3: 管理后台语音配置页面

**Objective:** 管理员页面展示语音配置状态、部署指引

**Files:**

- Create: `src/app/admin/voice/page.tsx`
- Modify: `src/components/sidebar.tsx` (添加管理入口)

**Step 1: Create admin voice config page**

```tsx
// src/app/admin/voice/page.tsx
"use client"

import { useState, useEffect } from "react"

interface VoiceConfigResponse {
  enabled: boolean
  stt: {
    provider: string
    name: string
    model: string
    languages: string[]
  } | null
  tts: {
    provider: string
    name: string
    model: string
    voice: string
    sampleRate: number
    voices: { id: string; name: string; language: string; gender: string }[]
  } | null
}

export default function VoiceAdminPage() {
  const [config, setConfig] = useState<VoiceConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/voice/config")
      .then((r) => r.json())
      .then(setConfig)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8">加载中...</div>

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-bold">语音对话配置</h1>

      {/* 状态指示 */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${config?.enabled ? "bg-green-500" : "bg-red-500"}`}
          />
          <span className="font-medium">语音模式：{config?.enabled ? "已启用" : "未启用"}</span>
        </div>

        {config?.enabled && (
          <div className="grid grid-cols-2 gap-6 mt-4">
            <div className="space-y-2">
              <h3 className="font-medium">语音识别 (STT)</h3>
              <p className="text-sm text-muted-foreground">供应商：{config.stt?.name}</p>
              <p className="text-sm text-muted-foreground">模型：{config.stt?.model}</p>
              <p className="text-sm text-muted-foreground">
                支持语言：{config.stt?.languages.join(", ")}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">语音合成 (TTS)</h3>
              <p className="text-sm text-muted-foreground">供应商：{config.tts?.name}</p>
              <p className="text-sm text-muted-foreground">模型：{config.tts?.model}</p>
              <p className="text-sm text-muted-foreground">当前音色：{config.tts?.voice}</p>
            </div>
          </div>
        )}
      </div>

      {/* 部署指引 */}
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">部署指引</h2>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <h3>1. 开通阿里云 DashScope 服务</h3>
          <ol>
            <li>
              访问{" "}
              <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener">
                DashScope 控制台
              </a>
            </li>
            <li>开通「语音识别」和「语音合成」服务</li>
            <li>在 API-KEY 管理中创建或复用已有 Key</li>
          </ol>

          <h3>2. 配置环境变量</h3>
          <p>
            在 <code>.env.local</code> 中添加：
          </p>
          <pre className="bg-muted p-4 rounded text-xs">
            {`# 语音功能开关
VOICE_ENABLED=true

# DashScope API Key（如已配置 Qwen 则无需重复）
DASHSCOPE_API_KEY=sk-your-key

# 可选：自定义模型和音色
# STT_MODEL=paraformer-realtime-v2
# TTS_MODEL=cosyvoice-v1
# TTS_VOICE=longxiaochun
# TTS_SAMPLE_RATE=22050`}
          </pre>

          <h3>3. 重启服务</h3>
          <p>
            修改环境变量后需重启 <code>bun run dev</code> 使配置生效。
          </p>

          <h3>4. 可用音色列表</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>名称</th>
                <th>语言</th>
                <th>性别</th>
              </tr>
            </thead>
            <tbody>
              {config?.tts?.voices.map((v) => (
                <tr key={v.id}>
                  <td>
                    <code>{v.id}</code>
                  </td>
                  <td>{v.name}</td>
                  <td>{v.language}</td>
                  <td>{v.gender === "male" ? "男" : "女"}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={4}>启用语音后可查看</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Add sidebar entry for admin voice page**

在 `src/components/sidebar.tsx` 中添加管理员语音配置入口链接。

**Step 3: Commit**

```bash
git add src/app/admin/voice/page.tsx src/components/sidebar.tsx
git commit -m "feat(voice): 添加管理后台语音配置页面与部署指引"
```

---

## Phase 2: 核心实时语音链路

### Task 4: DashScope STT WebSocket 客户端

**Objective:** 服务端 WebSocket 封装，连接 DashScope Paraformer 实时流式识别

**Files:**

- Create: `src/lib/voice/dashscope-stt.ts`
- Create: `src/__tests__/dashscope-stt.test.ts`

**Implementation notes:**

- DashScope Paraformer Realtime API 使用 WebSocket 协议
- 发送 PCM 16bit 16kHz 音频帧，返回实时识别结果
- 支持中英混合 (`language_hints: ["zh", "en"]`)
- 消息格式: JSON header + binary audio payload

**核心接口：**

```typescript
// src/lib/voice/dashscope-stt.ts
export interface STTSession {
  /** 发送音频数据（PCM 16bit 16kHz） */
  sendAudio(chunk: ArrayBuffer): void
  /** 结束识别 */
  finish(): void
  /** 关闭连接 */
  close(): void
  /** 事件：识别结果 */
  onResult: (text: string, isFinal: boolean) => void
  /** 事件：错误 */
  onError: (error: Error) => void
}

export function createSTTSession(
  apiKey: string,
  options?: {
    model?: string
    languages?: string[]
  },
): STTSession
```

**测试策略:** Mock WebSocket，验证协议消息格式和回调触发。

---

### Task 5: DashScope TTS WebSocket 客户端

**Objective:** 服务端 WebSocket 封装，连接 DashScope CosyVoice 流式合成

**Files:**

- Create: `src/lib/voice/dashscope-tts.ts`
- Create: `src/__tests__/dashscope-tts.test.ts`

**核心接口：**

```typescript
// src/lib/voice/dashscope-tts.ts
export interface TTSSession {
  /** 发送文本（可增量发送） */
  sendText(text: string): void
  /** 通知文本发送完毕 */
  flush(): void
  /** 关闭连接 */
  close(): void
  /** 事件：音频数据（PCM 或 MP3） */
  onAudio: (chunk: ArrayBuffer) => void
  /** 事件：合成完毕 */
  onDone: () => void
  /** 事件：错误 */
  onError: (error: Error) => void
}

export function createTTSSession(
  apiKey: string,
  options?: {
    model?: string
    voice?: string
    sampleRate?: number
    format?: "pcm" | "mp3"
  },
): TTSSession
```

---

### Task 6: 语音对话 WebSocket API Route

**Objective:** Next.js WebSocket 端点，桥接前端↔STT↔LLM↔TTS

**Files:**

- Create: `src/app/api/voice/stream/route.ts`

**协议设计（客户端↔服务端 WebSocket 消息）：**

```typescript
// 客户端 → 服务端
type ClientMessage =
  | { type: "audio"; data: string } // base64 PCM 音频帧
  | { type: "start"; agentId: string; chatId?: string; modelId?: string }
  | { type: "stop" } // 用户停止说话
  | { type: "end" } // 结束会话

// 服务端 → 客户端
type ServerMessage =
  | { type: "stt_partial"; text: string } // 实时识别中间结果
  | { type: "stt_final"; text: string } // 识别最终结果
  | { type: "llm_delta"; text: string } // LLM 流式文本
  | { type: "llm_done"; fullText: string } // LLM 完成
  | { type: "tts_audio"; data: string } // base64 音频帧
  | { type: "tts_done" } // TTS 播放完毕
  | { type: "error"; message: string } // 错误
```

**流程：**

1. 客户端发 `start` → 服务端初始化 STT session
2. 客户端发 `audio` 帧 → 服务端转发给 STT
3. STT 返回 `stt_partial` / `stt_final` → 推给客户端
4. 用户 `stop` / STT 检测到语音结束 → 将最终文本送入 LLM Agent
5. LLM 流式生成 → 边出文本边送 TTS（chunk by sentence）→ `llm_delta` + `tts_audio` 推给客户端
6. 全部完成 → `tts_done`

**Step: Commit**

```bash
git add src/lib/voice/ src/app/api/voice/stream/
git commit -m "feat(voice): 实现 STT/TTS 客户端和语音 WebSocket API"
```

---

## Phase 3: 前端语音 UI

### Task 7: 音频录制 Hook

**Objective:** 封装浏览器麦克风录音，输出 PCM 16kHz 数据

**Files:**

- Create: `src/hooks/use-audio-recorder.ts`

**核心接口：**

```typescript
export function useAudioRecorder() {
  return {
    isRecording: boolean,
    start: () => Promise<void>,      // 请求麦克风权限并开始
    stop: () => void,                // 停止录音
    onAudioChunk: (cb: (chunk: ArrayBuffer) => void) => void,
    error: string | null,
  }
}
```

**实现要点：**

- 使用 `AudioContext` + `ScriptProcessorNode` / `AudioWorklet` 获取 PCM
- 下采样到 16kHz 16bit mono（DashScope 要求）
- Capacitor 环境下通过 `@capacitor-community/media` 或原生插件获取麦克风权限

---

### Task 8: 语音 WebSocket Hook

**Objective:** 封装与 `/api/voice/stream` 的 WebSocket 通信

**Files:**

- Create: `src/hooks/use-voice-chat.ts`

**核心接口：**

```typescript
export function useVoiceChat(options: {
  agentId: string
  chatId?: string
  modelId?: string
}) {
  return {
    status: "idle" | "connecting" | "listening" | "thinking" | "speaking",
    sttText: string,           // 实时识别文本
    llmText: string,           // LLM 回复文本（累积）
    isConnected: boolean,
    start: () => void,         // 开始语音对话
    stop: () => void,          // 停止当前录音
    end: () => void,           // 结束会话
    error: string | null,
  }
}
```

---

### Task 9: 波形可视化组件

**Objective:** 实时音频波形 / 动画组件

**Files:**

- Create: `src/components/voice/waveform.tsx`

**实现：**

- 使用 `AnalyserNode.getByteTimeDomainData()` 获取实时波形
- Canvas 绘制平滑波形动画
- 支持两种模式的样式：全屏背景 vs 前景小图

---

### Task 10: 语音对话界面

**Objective:** 语音模式主界面，支持纯语音/语音+文字子模式切换

**Files:**

- Create: `src/components/voice/voice-chat-panel.tsx`
- Create: `src/components/voice/voice-mode-toggle.tsx`

**UI 结构：**

```
┌─────────────────────────────────┐
│  [文字模式切换] [显示文字按钮]   │  ← 顶栏
├─────────────────────────────────┤
│                                 │
│     ╭─ 波形动画背景 ─╮          │  ← 纯语音模式：全屏波形
│     │   ◉ 正在聆听   │          │
│     ╰────────────────╯          │
│                                 │
│  [识别文本: ...]  (可选显示)     │  ← 语音+文字模式：叠加消息
│  [回复文本: ...]  (可选显示)     │
│                                 │
├─────────────────────────────────┤
│  [🎙️ 按住说话 / 点击结束]       │  ← 底栏
│  [音色选择] [结束对话]           │
└─────────────────────────────────┘
```

---

### Task 11: 模式切换集成到主聊天页面

**Objective:** 在现有聊天页面添加语音/文字模式切换按钮

**Files:**

- Modify: `src/app/page.tsx` (添加语音模式入口)
- Create: `src/hooks/use-voice-config.ts` (获取语音配置、控制显隐)

**逻辑：**

- 调用 `/api/voice/config` 检查是否启用
- 启用时显示模式切换按钮（麦克风图标）
- 切换时渲染 `VoiceChatPanel` 替代或覆盖文字聊天区域
- 语音+文字子模式时，背景为波形，前景为消息列表

---

## Phase 4: 跨平台适配

### Task 12: Capacitor 麦克风权限插件

**Objective:** 确保 iOS/Android 上麦克风权限正确请求

**Files:**

- Modify: `capacitor.config.ts` (添加权限声明)
- Create: `src/lib/voice/platform.ts` (平台检测 + 权限请求)

**要点：**

- iOS: `NSMicrophoneUsageDescription` in Info.plist
- Android: `RECORD_AUDIO` permission
- Web: 标准 `getUserMedia`
- Tauri: 使用系统权限 API

---

### Task 13: 音频播放适配

**Objective:** 跨平台音频流式播放（PCM → AudioContext playback）

**Files:**

- Create: `src/lib/voice/audio-player.ts`

**实现：**

- Web: `AudioContext` + `AudioBufferSourceNode` 队列播放
- 低延迟：收到 TTS 音频帧即刻入队播放，不等完整回复
- 支持中断（用户打断时停止播放）

---

## Phase 5: 消息持久化与历史

### Task 14: 语音消息持久化

**Objective:** 语音对话的文本内容同样保存到数据库

**Files:**

- Modify: `src/app/api/voice/stream/route.ts`

**逻辑：**

- STT 最终文本 → 保存为 user message（parts 中增加 `{ type: "audio" }` 标记）
- LLM 完整回复 → 保存为 assistant message
- 复用现有 `chats` + `messages` 表结构
- 用户切回文字模式时可看到语音对话历史

---

## 环境变量汇总

```bash
# .env.local 新增
VOICE_ENABLED=true                    # 全局开关
# DASHSCOPE_API_KEY 已存在（Qwen 共用）
STT_MODEL=paraformer-realtime-v2      # 可选
TTS_MODEL=cosyvoice-v1                # 可选
TTS_VOICE=longxiaochun                # 可选
TTS_SAMPLE_RATE=22050                 # 可选
```

---

## 验收标准

1. ✅ 管理员配置 `VOICE_ENABLED=true` + `DASHSCOPE_API_KEY` 后，用户聊天页面出现语音模式入口
2. ✅ 未配置时语音入口不显示
3. ✅ 语音模式下：用户说话 → 实时显示识别文本 → Agent 回复 → TTS 朗读
4. ✅ 纯语音子模式：仅显示波形动画
5. ✅ 语音+文字子模式：波形背景 + 消息文本/图表前景
6. ✅ 支持中英混合语音识别
7. ✅ 语音对话内容持久化到 DB，切回文字模式可见
8. ✅ Web / iOS / Android / 桌面端麦克风权限正常
9. ✅ 管理后台显示配置状态和完整部署指引
10. ✅ 所有核心模块有单元测试覆盖
