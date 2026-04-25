// 鸿蒙 HarmonyOS NEXT WebView 壳工程
// 使用 ArkTS + Web 组件加载 xinsight PWA
//
// 前置条件：
// 1. 安装 DevEco Studio 5.0+
// 2. 创建 HarmonyOS NEXT 空白项目
// 3. 将以下代码放入主页面

// === entry/src/main/ets/pages/Index.ets ===

// import { webview } from '@kit.ArkWeb'
//
// @Entry
// @Component
// struct Index {
//   controller: webview.WebviewController = new webview.WebviewController()
//
//   // 配置 API 地址（部署后的 xinsight 服务地址）
//   private apiUrl: string = 'https://your-deployed-xinsight.example.com'
//
//   build() {
//     Column() {
//       Web({ src: this.apiUrl, controller: this.controller })
//         .javaScriptAccess(true)
//         .domStorageAccess(true)
//         .geolocationAccess(false)
//         .width('100%')
//         .height('100%')
//         .backgroundColor('#ffffff')
//     }
//     .width('100%')
//     .height('100%')
//   }
// }

// === 说明 ===
// 鸿蒙适配策略：
// 1. 初期：WebView 加载远程 PWA（最小开发成本）
// 2. 中期：WebView 加载本地静态资源（rawfile）+ 远程 API
// 3. 远期：按需用 ArkTS 原生化关键页面
//
// 本地资源加载方式：
// - 将 out/ 目录内容复制到 entry/src/main/resources/rawfile/web/
// - Web 组件 src 改为 $rawfile('web/index.html')
// - 配置 NEXT_PUBLIC_API_URL 指向远程 API 服务

export {}
