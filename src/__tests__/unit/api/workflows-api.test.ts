import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock db
const mockAll = vi.fn()
const mockGet = vi.fn()
const mockRun = vi.fn()

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        all: mockAll,
      })),
      where: vi.fn(() => ({
        get: mockGet,
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      run: mockRun,
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        run: mockRun,
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      run: mockRun,
    })),
  })),
}

vi.mock("@/db", () => ({
  db: mockDb,
}))

vi.mock("@/db/schema", () => ({
  workflows: {},
  workflowExecutions: {},
}))

// Mock auth
const mockRequireAdmin = vi.fn()
vi.mock("@/lib/auth", async () => {
  const { NextResponse } = await import("next/server")
  return {
    requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
    handleAuthError: (error: unknown) => {
      if (error instanceof Error && error.message === "无权访问") {
        return NextResponse.json({ error: "无权访问" }, { status: 403 })
      }
      return null
    },
  }
})

// Mock WorkflowEngine
const mockExecute = vi.fn()
vi.mock("@/lib/workflow/workflow-engine", () => ({
  WorkflowEngine: {
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}))

// 动态载入 API
const { GET: listGET, POST: listPOST } = await import("@/app/api/admin/workflows/route")
const {
  GET: detailGET,
  PUT: detailPUT,
  DELETE: detailDELETE,
} = await import("@/app/api/admin/workflows/[id]/route")
const { POST: triggerPOST } = await import("@/app/api/admin/workflows/[id]/trigger/route")

describe("Workflows API — /api/admin/workflows", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset()
    mockAll.mockReset()
    mockGet.mockReset()
    mockRun.mockReset()
    mockExecute.mockReset()

    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" })
  })

  describe("GET /api/admin/workflows", () => {
    it("非管理员返回 403", async () => {
      mockRequireAdmin.mockRejectedValue(new Error("无权访问"))
      const response = await listGET()
      expect(response.status).toBe(403)
    })

    it("管理员成功获取工作流列表", async () => {
      mockAll.mockReturnValue([{ id: "wf-1", name: "流程1" }])
      const response = await listGET()
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.workflows).toHaveLength(1)
      expect(data.workflows[0].id).toBe("wf-1")
    })
  })

  describe("POST /api/admin/workflows", () => {
    it("管理员能够成功创建工作流", async () => {
      mockGet.mockReturnValue(null) // ID不存在
      const req = new Request("http://localhost/api/admin/workflows", {
        method: "POST",
        body: JSON.stringify({
          id: "new-wf",
          name: "新流程",
          definition: "{}",
        }),
      })

      const response = await listPOST(req)
      expect(response.status).toBe(201)
      expect(mockRun).toHaveBeenCalled()
    })

    it("创建时如果ID已存在返回 409 冲突", async () => {
      mockGet.mockReturnValue({ id: "existing-wf" })
      const req = new Request("http://localhost/api/admin/workflows", {
        method: "POST",
        body: JSON.stringify({
          id: "existing-wf",
          name: "同名流程",
          definition: "{}",
        }),
      })

      const response = await listPOST(req)
      expect(response.status).toBe(409)
    })
  })

  describe("GET /api/admin/workflows/[id]", () => {
    it("获取工作流详情", async () => {
      mockGet.mockReturnValue({ id: "wf-1", name: "工作流详情" })
      const response = await detailGET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "wf-1" }),
      })
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.workflow.id).toBe("wf-1")
    })

    it("获取不存在工作流时返回 404", async () => {
      mockGet.mockReturnValue(null)
      const response = await detailGET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "non-existent" }),
      })
      expect(response.status).toBe(404)
    })
  })

  describe("PUT /api/admin/workflows/[id]", () => {
    it("修改工作流定义", async () => {
      mockGet.mockReturnValue({ id: "wf-1", name: "原工作流" })
      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          name: "修改后的名字",
          status: "published",
        }),
      })

      const response = await detailPUT(req, {
        params: Promise.resolve({ id: "wf-1" }),
      })
      expect(response.status).toBe(200)
      expect(mockRun).toHaveBeenCalled()
    })
  })

  describe("DELETE /api/admin/workflows/[id]", () => {
    it("级联删除工作流", async () => {
      mockGet.mockReturnValue({ id: "wf-1" })
      const response = await detailDELETE(new Request("http://localhost"), {
        params: Promise.resolve({ id: "wf-1" }),
      })
      expect(response.status).toBe(200)
      expect(mockRun).toHaveBeenCalled()
    })
  })

  describe("POST /api/admin/workflows/[id]/trigger", () => {
    it("成功触发工作流执行", async () => {
      mockExecute.mockResolvedValue({ status: "success", result: "流程输出" })
      const req = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          input: { key: "value" },
        }),
      })

      const response = await triggerPOST(req, {
        params: Promise.resolve({ id: "wf-1" }),
      })
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.result.result).toBe("流程输出")
      expect(mockExecute).toHaveBeenCalledWith(
        "wf-1",
        { key: "value" },
        { userId: "admin-1", role: "admin" },
      )
    })

    it("参数不合法时返回 400 校验错误", async () => {
      const req = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          input: { nested: { invalid: true } }, // 嵌套对象，违反扁平 Zod 限制
        }),
      })

      const response = await triggerPOST(req, {
        params: Promise.resolve({ id: "wf-1" }),
      })
      expect(response.status).toBe(400)
    })
  })
})
