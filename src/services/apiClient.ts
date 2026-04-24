import axios, { AxiosError } from 'axios';
import { toast } from '@/hooks/use-toast';
import { sessionStore } from '@/lib/sessionStorage';

// 後端 API 基礎 URL，部署時請修改為實際位址
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:5001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request 攔截器：自動加上 JWT Token
apiClient.interceptors.request.use(config => {
  const token = sessionStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 後端統一錯誤格式
interface ApiErrorPayload {
  code?: number;
  message?: string;
  traceId?: string;
}

// Response 攔截器：401 自動登出 + 集中錯誤提示
apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError<ApiErrorPayload>) => {
    const status = error.response?.status;
    const payload = error.response?.data;
    const message = payload?.message || error.message || '未知錯誤';

    // 401：自動登出
    if (status === 401) {
      sessionStore.clear();
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // 全域 toast：但允許呼叫端用 config.meta.silent 關閉
    const silent = (error.config as any)?.silent === true;
    if (!silent) {
      const title =
        status === 400 ? '輸入有誤' :
        status === 403 ? '權限不足' :
        status === 404 ? '找不到資源' :
        status && status >= 500 ? '伺服器錯誤' :
        '連線失敗';
      toast({
        title,
        description: payload?.traceId ? `${message}（${payload.traceId}）` : message,
        variant: 'destructive',
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
