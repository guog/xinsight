import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#252525" },
  ],
}

export const metadata: Metadata = {
  title: "xinsight — AI 洞察助手",
  description: "基于多 Agent 的 AI 应用，提供智能对话与深度洞察",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "xinsight",
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
