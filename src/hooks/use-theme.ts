"use client"

import { useState, useEffect, useCallback } from "react"

type Theme = "light" | "dark" | "system"
type Density = "comfortable" | "compact"

const STORAGE_KEY = "xinsight:theme"
const DENSITY_KEY = "xinsight:density"

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme
  document.documentElement.classList.toggle("dark", resolved === "dark")
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system"
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "system"
}

function getInitialDensity(): Density {
  if (typeof window === "undefined") return "comfortable"
  return (localStorage.getItem(DENSITY_KEY) as Density) ?? "comfortable"
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [density, setDensityState] = useState<Density>(getInitialDensity)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // 监听系统主题变化
  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme("system")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    applyTheme(t)
  }, [])

  const setDensity = useCallback((d: Density) => {
    setDensityState(d)
    localStorage.setItem(DENSITY_KEY, d)
  }, [])

  return { theme, setTheme, density, setDensity }
}
