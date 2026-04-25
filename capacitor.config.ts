import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.xinsight.app",
  appName: "xinsight",
  webDir: "out",
  server: {
    // 开发时可指向本地 Next.js dev server
    // url: "http://localhost:3000",
    androidScheme: "https",
  },
}

export default config
