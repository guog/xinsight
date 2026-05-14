import { NextResponse } from "next/server"
import { requireAuth, requireAdmin, handleAuthError } from "@/lib/auth"

export type AuthenticatedUser = {
  id: string
  username: string
  displayName: string
  role: string
}

export type AuthenticatedHandler<T = unknown> = (
  user: AuthenticatedUser,
  ...args: T[]
) => Promise<Response>

/**
 * 高阶函数：统一认证检查
 * 包装 route handler，自动完成 requireAuth + 错误处理
 */
export function withAuth(
  handler: (user: AuthenticatedUser, request: Request, context: unknown) => Promise<Response>,
) {
  return async (request: Request, context: unknown): Promise<Response> => {
    try {
      let user: AuthenticatedUser
      try {
        user = await requireAuth()
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        throw error
      }
      return await handler(user, request, context)
    } catch (error) {
      console.error("请求处理失败:", error)
      return NextResponse.json({ error: "服务器内部错误" }, { status: 500 })
    }
  }
}

/**
 * 高阶函数：统一管理员认证检查
 */
export function withAdmin(
  handler: (user: AuthenticatedUser, request: Request, context: unknown) => Promise<Response>,
) {
  return async (request: Request, context: unknown): Promise<Response> => {
    try {
      let user: AuthenticatedUser
      try {
        user = await requireAdmin()
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        throw error
      }
      return await handler(user, request, context)
    } catch (error) {
      console.error("请求处理失败:", error)
      return NextResponse.json({ error: "服务器内部错误" }, { status: 500 })
    }
  }
}
