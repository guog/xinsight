"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface VoiceConfig {
  enabled: boolean
  stt?: {
    provider: string
    model: string
    language: string
  }
  tts?: {
    provider: string
    model: string
    voice: string
  }
}

export default function AdminVoicePage() {
  const [config, setConfig] = useState<VoiceConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/voice/config")
      .then((res) => {
        if (!res.ok) throw new Error("获取配置失败")
        return res.json()
      })
      .then((data) => setConfig(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">语音对话配置</h1>

      {/* 状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span
              className={`inline-block size-2.5 rounded-full ${
                config?.enabled ? "bg-green-500" : "bg-red-500"
              }`}
            />
            语音模式：{loading ? "加载中..." : config?.enabled ? "已启用" : "未启用"}
          </CardTitle>
        </CardHeader>
        {config?.enabled && (
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-muted-foreground mb-1">STT（语音识别）</p>
                <p>供应商：{config.stt?.provider ?? "—"}</p>
                <p>模型：{config.stt?.model ?? "—"}</p>
                <p>语言：{config.stt?.language ?? "—"}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">TTS（语音合成）</p>
                <p>供应商：{config.tts?.provider ?? "—"}</p>
                <p>模型：{config.tts?.model ?? "—"}</p>
                <p>音色：{config.tts?.voice ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {error && <p className="text-sm text-destructive">错误：{error}</p>}

      {/* 部署指引 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">部署指引</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal list-inside space-y-3">
            <li>
              <span className="font-medium">开通 DashScope 服务</span>
              <p className="ml-5 text-muted-foreground">
                前往阿里云控制台开通 DashScope（通义千问语音服务），获取 API Key。
              </p>
            </li>
            <li>
              <span className="font-medium">配置环境变量</span>
              <p className="ml-5 text-muted-foreground">
                在 <code className="px-1 py-0.5 bg-muted rounded">.env.local</code> 中添加：
              </p>
              <pre className="ml-5 mt-1 p-3 bg-muted rounded-lg overflow-x-auto text-xs">
                {`DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
VOICE_STT_MODEL=paraformer-realtime-v2
VOICE_TTS_MODEL=cosyvoice-v1
VOICE_TTS_VOICE=longxiaochun
VOICE_LANGUAGE=zh-cn`}
              </pre>
            </li>
            <li>
              <span className="font-medium">重启服务</span>
              <p className="ml-5 text-muted-foreground">
                执行 <code className="px-1 py-0.5 bg-muted rounded">bun run dev</code>{" "}
                或重新部署生产环境，使配置生效。
              </p>
            </li>
            <li>
              <span className="font-medium">可用音色</span>
              <div className="ml-5 mt-1">
                <table className="w-full text-xs border border-border rounded">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-3 py-1.5 text-left">音色 ID</th>
                      <th className="px-3 py-1.5 text-left">描述</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-3 py-1">longxiaochun</td>
                      <td className="px-3 py-1">龙小淳 - 温柔女声</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1">longxiaoxia</td>
                      <td className="px-3 py-1">龙小夏 - 活泼女声</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1">longyuan</td>
                      <td className="px-3 py-1">龙媛 - 知性女声</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1">longhua</td>
                      <td className="px-3 py-1">龙华 - 标准男声</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1">longjielidou</td>
                      <td className="px-3 py-1">龙杰力豆 - 活力男声</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
