"use client"

import Link from "next/link"
import { ArrowLeft, Database } from "lucide-react"
import { usePathname } from "next/navigation"

const navItems = [{ href: "/admin/datasources", label: "数据源管理", icon: Database }]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

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
      {children}
    </main>
  )
}
