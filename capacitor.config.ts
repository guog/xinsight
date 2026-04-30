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

// iOS 权限声明（需在 ios/App/App/Info.plist 中添加）:
//   <key>NSMicrophoneUsageDescription</key>
//   <string>XInsight 需要使用麦克风进行语音输入</string>
//
// Android 权限声明（需在 android/app/src/main/AndroidManifest.xml 中添加）:
//   <uses-permission android:name="android.permission.RECORD_AUDIO" />

export default config
