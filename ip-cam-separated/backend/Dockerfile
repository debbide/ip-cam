FROM node:20-alpine

# 安装必要工具
RUN apk add --no-cache supervisor curl wget ffmpeg

# 安装 MediaMTX
RUN wget -q https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_amd64.tar.gz \
    && tar -xzf mediamtx_v1.9.3_linux_amd64.tar.gz -C /usr/local/bin/ \
    && rm mediamtx_v1.9.3_linux_amd64.tar.gz \
    && chmod +x /usr/local/bin/mediamtx

# 创建工作目录
WORKDIR /app

# 复制 rtsp-server
COPY rtsp-server ./rtsp-server
RUN cd rtsp-server && npm install --production

# 复制配置文件
COPY mediamtx.yml /etc/mediamtx.yml
COPY supervisord.conf /etc/supervisord.conf

# 暴露端口
# 3001 - API
# 8554 - RTSP
# 8888 - HLS
# 8889 - WebRTC (WHEP)
# 8189/udp - WebRTC ICE/STUN
EXPOSE 3001 8554 8888 8889 8189/udp

# 启动 Supervisor
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
