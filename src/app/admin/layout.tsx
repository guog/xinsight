"use client"
import Link from "next/link"
import { ArrowLeft, Database, Bot, BookOpen } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useUser } from "@/hooks/use-user"

const navItems = [
  { href: "/admin/datasources", label: "数据源管理", icon: Database },
  { href: "/admin/agents", label: "Agent 管理", icon: Bot },
  { href: "/admin/wiki", label: "知识库", icon: BookOpen },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { loading, isAdmin } = useUser()

  // 非管理员重定向到首页
  if (loading) {
    return (
      <main className="flex items-center justify-center h-dvh">
        <p className="text-muted-foreground">加载中...</p>
      </main>
    )
  }

  if (!isAdmin) {
    router.push("/")
    return null
  }
  return (
    <main className="flex flex-col h-dvh max-w-4xl mx-auto w-full px-4 py-4">
      <header className="flex items-center gap-3 mb-6">
        <Link href="/" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-semibold">管理后台</h1>
        <nav className="ml-6 flex gap-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                pathname?.startsWith(href)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {/* 面包屑 */}
      {pathname && pathname !== "/admin" && (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <span>管理后台</span>
          {pathname.startsWith("/admin/datasources") && (
            <>
              <span>&gt;</span>
              <Link href="/admin/datasources" className="hover:text-foreground transition-colors">
                数据源管理
              </Link>
              {pathname.includes("/new") && (
                <>
                  <span>&gt;</span>
                  <span className="text-foreground">新建</span>
                </>
              )}
              {pathname.includes("/edit") && (
                <>
                  <span>&gt;</span>
                  <span className="text-foreground">编辑</span>
                </>
              )}
            </>
          )}
          {pathname.startsWith("/admin/agents") && (
            <>
              <span>&gt;</span>
              <Link href="/admin/agents" className="hover:text-foreground transition-colors">
                Agent 管理
              </Link>
              {pathname.includes("/new") && (
                <>
                  <span>&gt;</span>
                  <span className="text-foreground">新建</span>
                </>
              )}
              {pathname.includes("/edit") && (
                <>
                  <span>&gt;</span>
                  <span className="text-foreground">编辑</span>
                </>
              )}
            </>
          )}
        </nav>
      )}
      {children}
    </main>
  )
}
