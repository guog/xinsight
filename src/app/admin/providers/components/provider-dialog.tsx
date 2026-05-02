"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Provider {
  id: string
  name: string
  type: "cloud" | "local"
  apiFormat: string
  baseUrl: string
  apiKey?: string
  apiKeyRequired?: boolean
}

interface Preset {
  id: string
  name: string
  type: "cloud" | "local"
  apiFormat: string
  baseUrl: string
  apiKeyRequired: boolean
}

interface ProviderDialogProps {
  open: boolean
  onClose: () => void
  provider?: Provider | null
  onSaved: () => void
}

export function ProviderDialog({ open, onClose, provider, onSaved }: ProviderDialogProps) {
  const isEdit = !!provider
  const [form, setForm] = useState({
    id: "",
    name: "",
    type: "cloud" as "cloud" | "local",
    apiFormat: "openai",
    baseUrl: "",
    apiKey: "",
    apiKeyRequired: true,
  })
  const [presets, setPresets] = useState<Preset[]>([])
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      fetch("/api/admin/providers/presets")
        .then((r) => r.json())
        .then((data) => setPresets(data))
        .catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (provider) {
      setForm({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        apiFormat: provider.apiFormat,
        baseUrl: provider.baseUrl,
        apiKey: "",
        apiKeyRequired: provider.apiKeyRequired ?? true,
      })
    } else {
      setForm({ id: "", name: "", type: "cloud", apiFormat: "openai", baseUrl: "", apiKey: "", apiKeyRequired: true })
    }
  }, [provider, open])

  function applyPreset(presetId: string) {
    const p = presets.find((x) => x.id === presetId)
    if (p) {
      setForm((f) => ({ ...f, id: p.id, name: p.name, type: p.type, apiFormat: p.apiFormat, baseUrl: p.baseUrl, apiKeyRequired: p.apiKeyRequired }))
    }
  }

  async function testConnection() {
    setTesting(true)
    try {
      const res = await fetch("/api/admin/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      alert(data.success ? "连接成功" : `连接失败: ${data.error || "未知错误"}`)
    } catch {
      alert("测试请求失败")
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const url = isEdit ? `/api/admin/providers/${provider!.id}` : "/api/admin/providers"
      const method = isEdit ? "PUT" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (res.ok) {
        onSaved()
        onClose()
      } else {
        const data = await res.json()
        alert(`保存失败: ${data.error || res.statusText}`)
      }
    } catch {
      alert("保存请求失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑提供商" : "添加提供商"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!isEdit && presets.length > 0 && (
            <div>
              <label className="text-sm font-medium">预设</label>
              <Select onValueChange={applyPreset}>
                <SelectTrigger><SelectValue placeholder="选择预设..." /></SelectTrigger>
                <SelectContent>
                  {presets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium">名称</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium">ID</label>
            <Input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} disabled={isEdit} />
          </div>
          <div>
            <label className="text-sm font-medium">类型</label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "cloud" | "local" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cloud">云端</SelectItem>
                <SelectItem value="local">本地</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">API 格式</label>
            <Select value={form.apiFormat} onValueChange={(v) => setForm((f) => ({ ...f, apiFormat: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="custom">自定义</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Base URL</label>
            <Input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.example.com/v1" />
          </div>
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} placeholder={isEdit ? "留空则不修改" : ""} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.apiKeyRequired} onChange={(e) => setForm((f) => ({ ...f, apiKeyRequired: e.target.checked }))} />
            <label className="text-sm">需要 API Key</label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={testConnection} disabled={testing}>
            {testing ? "测试中..." : "测试连接"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
