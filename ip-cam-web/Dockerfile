# ========================================
# 阶段 1: 构建前端
# ========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# 复制前端源码 (使用主项目的统一版代码)
COPY package.json package-lock.json* ./
COPY src ./src
COPY public ./public
COPY index.html vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js components.json ./

# 安装依赖并构建
RUN npm install
RUN npm run build

# ========================================
# 阶段 2: 最终运行镜像
# ========================================
FROM node:20-alpine

# 安装必要工具
RUN apk add --no-cache \
    supervisor \
    nginx \
    curl \
    wget \
    ffmpeg \
    openssl

# 安装 MediaMTX
RUN wget -q https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_amd64.tar.gz \
    && tar -xzf mediamtx_v1.9.3_linux_amd64.tar.gz -C /usr/local/bin/ \
    && rm mediamtx_v1.9.3_linux_amd64.tar.gz \
    && chmod +x /usr/local/bin/mediamtx

# 创建工作目录
WORKDIR /app

# 复制前端构建产物
COPY --from=frontend-builder /build/dist /usr/share/nginx/html

# 复制后端代码 (使用分离版的后端，因为它有完整的 API)
COPY ip-cam-separated/backend/rtsp-server ./rtsp-server
RUN cd rtsp-server && npm install --production

# 复制配置文件
COPY ip-cam-web/mediamtx.yml /etc/mediamtx.yml
COPY ip-cam-web/supervisord.conf /etc/supervisord.conf
COPY ip-cam-web/nginx/nginx.conf /etc/nginx/nginx.conf
COPY ip-cam-web/nginx/generate-cert.sh /usr/local/bin/generate-cert.sh
RUN chmod +x /usr/local/bin/generate-cert.sh

# 创建数据目录
RUN mkdir -p /app/data /etc/nginx/ssl /var/log/nginx

# 暴露端口
# 443 - HTTPS (Nginx)
# 80  - HTTP (重定向到 HTTPS)
# 8554 - RTSP
# 8289/udp - WebRTC ICE
EXPOSE 80 443 8554 8289/udp

# 启动脚本
COPY ip-cam-web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
