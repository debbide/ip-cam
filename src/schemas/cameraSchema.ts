import { z } from 'zod';

export const cameraFormSchema = z.object({
  name: z.string()
    .trim()
    .min(1, { message: '请输入设备名称' })
    .max(50, { message: '设备名称不能超过50个字符' }),
  deviceName: z.string()
    .trim()
    .min(1, { message: '请输入手机型号' })
    .max(50, { message: '手机型号不能超过50个字符' }),
  ipAddress: z.string()
    .trim()
    .min(1, { message: '请输入IP地址' })
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, { message: '请输入有效的IP地址' }),
  port: z.coerce.number()
    .min(1, { message: '端口号必须大于0' })
    .max(65535, { message: '端口号不能超过65535' }),
  username: z.string()
    .trim()
    .max(50, { message: '用户名不能超过50个字符' })
    .optional(),
  password: z.string()
    .max(100, { message: '密码不能超过100个字符' })
    .optional(),
  mjpegPath: z.string()
    .trim()
    .min(1, { message: '请输入MJPEG路径' })
    .max(100, { message: 'MJPEG路径不能超过100个字符' }),
  rtspPath: z.string()
    .trim()
    .max(100, { message: 'RTSP路径不能超过100个字符' })
    .optional(),
  hasAudio: z.boolean().default(true),
  resolution: z.string().default('1920x1080'),
  fps: z.coerce.number().min(1).max(60).default(30),
  streamType: z.enum(['mjpeg', 'hls', 'flv', 'webrtc']).default('mjpeg'),
  hlsUrl: z.string().optional(),
  humanDetectionEnabled: z.boolean().default(false),
  humanDetectionRegion: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  rotation: z.union([
    z.literal(0),
    z.literal(90),
    z.literal(180),
    z.literal(270)
  ]).default(0),
});

export type CameraFormValues = z.infer<typeof cameraFormSchema>;
