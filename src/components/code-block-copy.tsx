"use client"

import { useEffect } from "react"

export function CodeBlockCopyProvider() {
  useEffect(() => {
    const addCopyButtons = () => {
      document.querySelectorAll("pre:not([data-copy-added])").forEach((pre) => {
        pre.setAttribute("data-copy-added", "true")
        ;(pre as HTMLElement).style.position = "relative"

        const btn = document.createElement("button")
        btn.className =
          "absolute top-2 right-2 px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-muted-foreground opacity-0 transition-opacity"
        btn.textContent = "复制"
        btn.addEventListener("click", async () => {
          const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? ""
          await navigator.clipboard.writeText(code)
          btn.textContent = "已复制!"
          setTimeout(() => {
            btn.textContent = "复制"
          }, 2000)
        })

        pre.addEventListener("mouseenter", () => {
          btn.style.opacity = "1"
        })
        pre.addEventListener("mouseleave", () => {
          btn.style.opacity = "0"
        })
        pre.appendChild(btn)
      })
    }

    addCopyButtons()

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(addCopyButtons, 200)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      observer.disconnect()
    }
  }, [])

  return null
}
