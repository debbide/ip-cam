FROM node:20-alpine

# 安装 FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# 复制依赖文件
COPY package.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY src ./src

# 创建 HLS 输出目录
RUN mkdir -p /app/hls

# 暴露端口
EXPOSE 3001

# 启动服务
CMD ["npm", "start"]
