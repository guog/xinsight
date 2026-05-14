# 部署指南

## 服务端口分配

| 服务           | 默认端口 | 环境变量                        | 说明                    |
| -------------- | -------- | ------------------------------- | ----------------------- |
| Next.js        | 3000     | `PORT`                          | 前端 + API              |
| Mastra Studio  | 3001     | `PORT`（mastra:dev 脚本内设置） | 仅开发环境使用          |
| MES Mock API   | 3002     | —                               | 模拟 MES 接口           |
| 语音 WebSocket | 3003     | `VOICE_WS_PORT`                 | 语音对话 WebSocket 服务 |

## Nginx 反向代理配置

生产环境建议使用 Nginx 将 Next.js（HTTP）和语音 WebSocket 统一代理到同一个端口，对外只暴露一个入口：

```nginx
upstream nextjs {
    server 127.0.0.1:3000;
}

upstream voice_ws {
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name your-domain.com;

    # 语音 WebSocket 代理
    location /ws/voice {
        proxy_pass http://voice_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Next.js 应用代理
    location / {
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

使用 Nginx 代理后，前端环境变量应配置为：

```env
NEXT_PUBLIC_VOICE_WS_URL=ws://your-domain.com/ws/voice
```

## 环境变量

详见 `.env.example`。生产环境必须配置：

- `DEEPSEEK_API_KEY` — DeepSeek 模型密钥
- `DATABASE_URL` — SQLite 数据库路径
- `VOICE_WS_PORT` — 语音 WebSocket 端口（默认 3003）
- `NEXT_PUBLIC_VOICE_WS_URL` — 前端连接语音 WebSocket 的地址
