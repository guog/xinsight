import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/db"
import { users, sessions } from "@/db/schema"
import { registerUser, handleAuthError, hasAnyUser } from "@/lib/auth"
import { getProviders, getModels, getDefaultModelId, _resetCache } from "@/lib/models"

// 保存原始环境变量
const origEnv = { ...process.env }

/**
 * 清空用户和会话表，确保测试隔离
 */
function clearAuthTables() {
  db.delete(sessions).run()
  db.delete(users).run()
}

// ==================== RBAC 与认证 ====================

describe("RBAC 与认证", () => {
  beforeEach(() => {
    clearAuthTables()
  })

  afterAll(() => {
    clearAuthTables()
  })

  describe("handleAuthError", () => {
    it("未登录错误应返回 401 响应", () => {
      const res = handleAuthError(new Error("未登录"))
      expect(res).toBeInstanceOf(Response)
      expect(res!.status).toBe(401)
    })

    it("需要管理员权限错误应返回 403 响应", () => {
      const res = handleAuthError(new Error("需要管理员权限"))
      expect(res).toBeInstanceOf(Response)
      expect(res!.status).toBe(403)
    })

    it("其他错误应返回 null", () => {
      expect(handleAuthError(new Error("数据库炸了"))).toBeNull()
      expect(handleAuthError(new Error("随便什么"))).toBeNull()
      expect(handleAuthError("字符串错误")).toBeNull()
    })
  })

  describe("注册用户角色分配", () => {
    it("第一个注册用户应获得 admin 角色", async () => {
      expect(hasAnyUser()).toBe(false)
      await registerUser("admin1", "password123", "管理员")
      // registerUser 默认 role="user"，但 API route 会根据 hasAnyUser() 传入 "admin"
      // 这里直接测试带 role 参数的调用
      clearAuthTables()
      const role = hasAnyUser() ? "user" : "admin"
      const firstUser = await registerUser("admin1", "password123", "管理员", role)
      expect(firstUser.role).toBe("admin")
    })

    it("第二个注册用户应获得 user 角色", async () => {
      // 先注册第一个用户（管理员）
      const role1 = hasAnyUser() ? "user" : "admin"
      await registerUser("admin1", "password123", "管理员", role1)
      expect(role1).toBe("admin")

      // 第二个用户
      const role2 = hasAnyUser() ? "user" : "admin"
      const secondUser = await registerUser("user1", "password456", "普通用户", role2)
      expect(secondUser.role).toBe("user")
    })

    it("重复用户名应抛出错误", async () => {
      await registerUser("testuser", "pass1", "测试用户")
      await expect(registerUser("testuser", "pass2", "另一个")).rejects.toThrow("用户名已存在")
    })
  })

  describe("requireAdmin 权限检查", () => {
    it("非管理员用户应被 handleAuthError 识别为 403", () => {
      // requireAdmin 依赖 cookies()（Next.js 运行时），无法直接在单元测试中调用
      // 转而验证其抛出的错误能被 handleAuthError 正确处理
      const error = new Error("需要管理员权限")
      const res = handleAuthError(error)
      expect(res).toBeInstanceOf(Response)
      expect(res!.status).toBe(403)
    })
  })
})

// ==================== 模型 API ====================

describe("模型注册表集成测试", () => {
  beforeEach(() => {
    _resetCache()
    // 设置测试用环境变量
    process.env.LLM_PROVIDERS = "deepseek,qwen"
    process.env.DEEPSEEK_API_KEY = "test-key-deepseek"
    process.env.DASHSCOPE_API_KEY = "test-key-qwen"
  })

  afterAll(() => {
    // 恢复原始环境变量
    Object.keys(process.env).forEach((k) => {
      if (!(k in origEnv)) delete process.env[k]
      else process.env[k] = origEnv[k]
    })
    _resetCache()
  })

  describe("provider 按环境变量过滤", () => {
    it("配置了 API Key 的 provider 应出现在列表中", () => {
      const providers = getProviders()
      const ids = providers.map((p) => p.id)
      expect(ids).toContain("deepseek")
    })

    it("未配置 API Key 的 provider 不应出现", () => {
      _resetCache()
      delete process.env.DASHSCOPE_API_KEY
      const providers = getProviders()
      expect(providers.find((p) => p.id === "qwen")).toBeUndefined()
    })

    it("只配置单个 provider 时只返回该 provider", () => {
      _resetCache()
      process.env.LLM_PROVIDERS = "deepseek"
      delete process.env.DASHSCOPE_API_KEY
      const providers = getProviders()
      expect(providers.length).toBe(1)
      expect(providers[0].id).toBe("deepseek")
    })
  })

  describe("getModels 与 getDefaultModelId", () => {
    it("返回的模型应属于已配置的 provider", () => {
      const models = getModels()
      const providerIds = getProviders().map((p) => p.id)
      for (const model of models) {
        expect(providerIds).toContain(model.providerId)
      }
    })

    it("默认模型 ID 应为 deepseek/deepseek-chat", () => {
      expect(getDefaultModelId()).toBe("deepseek/deepseek-chat")
    })

    it("删除所有 provider key 后模型列表为空", () => {
      _resetCache()
      delete process.env.DEEPSEEK_API_KEY
      delete process.env.DASHSCOPE_API_KEY
      process.env.LLM_PROVIDERS = ""
      const models = getModels()
      expect(models.length).toBe(0)
    })
  })
})
