/**
 * 跨平台 HTTP 客户端封装
 *
 * iOS WKWebView 有 ATS (App Transport Security) 限制，
 * 会阻止对 HTTP (非 HTTPS) 的请求。
 *
 * 此模块在 Capacitor 原生环境下使用 @capacitor/http 插件，
 * 绕过 WKWebView 的限制，直接通过原生网络层发送请求。
 *
 * 在 Web 和 Electron 环境下使用标准 fetch API。
 */

import { isCapacitor } from './platform';

// Capacitor HTTP 插件类型定义
interface CapacitorHttpPlugin {
  request(options: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    data?: any;
    responseType?: 'text' | 'json' | 'blob' | 'arraybuffer';
    connectTimeout?: number;
    readTimeout?: number;
  }): Promise<{
    status: number;
    headers: Record<string, string>;
    data: any;
    url: string;
  }>;
  get(options: {
    url: string;
    headers?: Record<string, string>;
    params?: Record<string, string>;
    responseType?: 'text' | 'json' | 'blob' | 'arraybuffer';
    connectTimeout?: number;
    readTimeout?: number;
  }): Promise<{
    status: number;
    headers: Record<string, string>;
    data: any;
    url: string;
  }>;
  post(options: {
    url: string;
    headers?: Record<string, string>;
    data?: any;
    responseType?: 'text' | 'json' | 'blob' | 'arraybuffer';
    connectTimeout?: number;
    readTimeout?: number;
  }): Promise<{
    status: number;
    headers: Record<string, string>;
    data: any;
    url: string;
  }>;
}

// 动态导入 Capacitor HTTP 插件
let CapHttp: CapacitorHttpPlugin | null = null;

async function getCapacitorHttp(): Promise<CapacitorHttpPlugin | null> {
  if (!isCapacitor()) return null;

  if (CapHttp) return CapHttp;

  try {
    // 优先尝试官方插件
    const { CapacitorHttp } = await import('@capacitor/core');
    CapHttp = CapacitorHttp as unknown as CapacitorHttpPlugin;
    console.log('[NativeHttp] Using @capacitor/core CapacitorHttp');
    return CapHttp;
  } catch {
    try {
      // 回退到社区插件
      const { Http } = await import('@capacitor-community/http');
      CapHttp = Http as unknown as CapacitorHttpPlugin;
      console.log('[NativeHttp] Using @capacitor-community/http');
      return CapHttp;
    } catch (e) {
      console.warn('[NativeHttp] No Capacitor HTTP plugin available, falling back to fetch');
      return null;
    }
  }
}

// 统一的响应接口
export interface NativeHttpResponse<T = any> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  url: string;
}

// 请求选项
export interface NativeHttpOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * 发起 HTTP 请求
 *
 * 在 Capacitor 原生环境下使用原生 HTTP 插件（绕过 WKWebView ATS 限制），
 * 在其他环境下使用标准 fetch API。
 */
export async function nativeRequest<T = any>(
  url: string,
  options: NativeHttpOptions = {}
): Promise<NativeHttpResponse<T>> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 30000,
    signal
  } = options;

  // 在 Capacitor 原生环境尝试使用原生 HTTP 插件
  if (isCapacitor()) {
    const http = await getCapacitorHttp();
    if (http) {
      try {
        // 处理请求数据
        let data = body;
        let requestHeaders = { ...headers };

        if (body && typeof body === 'object' && !(body instanceof FormData)) {
          data = body;
          if (!requestHeaders['Content-Type']) {
            requestHeaders['Content-Type'] = 'application/json';
          }
        }

        const response = await http.request({
          url,
          method,
          headers: requestHeaders,
          data,
          responseType: 'json',
          connectTimeout: timeout,
          readTimeout: timeout
        });

        return {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          statusText: getStatusText(response.status),
          headers: response.headers || {},
          data: response.data,
          url: response.url
        };
      } catch (error: any) {
        console.error('[NativeHttp] Native request failed:', error);
        // 如果原生请求失败，回退到 fetch
      }
    }
  }

  // 使用标准 fetch API
  const fetchOptions: RequestInit = {
    method,
    headers,
    signal
  };

  if (body) {
    if (body instanceof FormData) {
      fetchOptions.body = body;
    } else if (typeof body === 'object') {
      fetchOptions.body = JSON.stringify(body);
      if (!headers['Content-Type']) {
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    } else {
      fetchOptions.body = body;
    }
  }

  // 添加超时
  let timeoutId: NodeJS.Timeout | undefined;
  const controller = new AbortController();

  if (!signal && timeout > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;
  } else if (signal) {
    fetchOptions.signal = signal;
  }

  try {
    const response = await fetch(url, fetchOptions);

    let data: T;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text() as unknown as T;
    }

    // 转换 headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      url: response.url
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * GET 请求便捷方法
 */
export async function httpGet<T = any>(
  url: string,
  options: Omit<NativeHttpOptions, 'method' | 'body'> = {}
): Promise<NativeHttpResponse<T>> {
  return nativeRequest<T>(url, { ...options, method: 'GET' });
}

/**
 * POST 请求便捷方法
 */
export async function httpPost<T = any>(
  url: string,
  body?: any,
  options: Omit<NativeHttpOptions, 'method' | 'body'> = {}
): Promise<NativeHttpResponse<T>> {
  return nativeRequest<T>(url, { ...options, method: 'POST', body });
}

/**
 * PUT 请求便捷方法
 */
export async function httpPut<T = any>(
  url: string,
  body?: any,
  options: Omit<NativeHttpOptions, 'method' | 'body'> = {}
): Promise<NativeHttpResponse<T>> {
  return nativeRequest<T>(url, { ...options, method: 'PUT', body });
}

/**
 * DELETE 请求便捷方法
 */
export async function httpDelete<T = any>(
  url: string,
  options: Omit<NativeHttpOptions, 'method'> = {}
): Promise<NativeHttpResponse<T>> {
  return nativeRequest<T>(url, { ...options, method: 'DELETE' });
}

/**
 * 获取 HTTP 状态文本
 */
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  return statusTexts[status] || 'Unknown';
}

/**
 * 创建一个与 fetch 兼容的 API 包装器
 * 可以作为 fetch 的直接替代品使用
 */
export async function nativeFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  // 如果不是 Capacitor 环境，直接使用 fetch
  if (!isCapacitor()) {
    return fetch(url, init);
  }

  const http = await getCapacitorHttp();

  // 如果没有原生 HTTP 插件，回退到 fetch
  if (!http) {
    return fetch(url, init);
  }

  try {
    const method = (init?.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {};

    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, init.headers);
      }
    }

    let data: any = undefined;
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          data = JSON.parse(init.body);
        } catch {
          data = init.body;
        }
      } else if (init.body instanceof FormData) {
        // FormData 需要特殊处理，回退到 fetch
        return fetch(url, init);
      } else {
        data = init.body;
      }
    }

    const response = await http.request({
      url,
      method,
      headers,
      data,
      responseType: 'text',
      connectTimeout: 30000,
      readTimeout: 30000
    });

    // 创建一个模拟的 Response 对象
    const responseBody = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data);

    return new Response(responseBody, {
      status: response.status,
      statusText: getStatusText(response.status),
      headers: new Headers(response.headers)
    });
  } catch (error) {
    console.warn('[NativeHttp] Native fetch failed, falling back to standard fetch:', error);
    return fetch(url, init);
  }
}

// 导出默认对象
export default {
  request: nativeRequest,
  get: httpGet,
  post: httpPost,
  put: httpPut,
  delete: httpDelete,
  fetch: nativeFetch
};
