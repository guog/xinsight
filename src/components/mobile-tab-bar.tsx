"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, BookOpen, Settings, Database } from "lucide-react"
import { useUser } from "@/hooks/use-user"

const navItems = [
  { href: "/", label: "对话", icon: MessageSquare },
  { href: "/wiki", label: "知识库", icon: BookOpen },
  { href: "/settings", label: "设置", icon: Settings },
]

const adminNavItems = [
  { href: "/", label: "对话", icon: MessageSquare },
  { href: "/admin/datasources", label: "数据源", icon: Database },
  { href: "/wiki", label: "知识库", icon: BookOpen },
  { href: "/settings", label: "设置", icon: Settings },
]

/**
 * 移动端底部 Tab Bar
 * 仅在 md 以下显示，提供快速页面切换
 */
export function MobileTabBar() {
  const pathname = usePathname()
  const { isAdmin } = useUser()
  const items = isAdmin ? adminNavItems : navItems

  // 聊天主页不显示 tab bar（有自己的输入区域）
  if (pathname === "/") return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card/95 backdrop-blur-md border-t border-border safe-bottom safe-x">
      <div className="flex items-center justify-around h-14">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
              }`}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
