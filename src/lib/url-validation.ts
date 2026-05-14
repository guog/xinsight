/** SSRF 防护：校验 URL 是否安全（禁止内网地址） */
export function validateExternalUrl(urlStr: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return "URL 格式无效"
  }

  // 只允许 http/https
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return "仅支持 http/https 协议"
  }

  const hostname = parsed.hostname.toLowerCase()

  // 禁止 localhost
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return "不允许访问本地地址"
  }

  // 禁止内网 IP 段
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number)
    // 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x, 0.x.x.x
    if (
      a === 10 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    ) {
      return "不允许访问内网地址"
    }
  }

  return null
}
