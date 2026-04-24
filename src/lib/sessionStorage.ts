/**
 * Session 儲存抽象層
 * - 使用 sessionStorage：關閉瀏覽器/分頁後即清除，下次開啟需重新登入
 * - 統一管理 token / user 鍵值
 */

const TOKEN_KEY = 'dms_token';
const USER_KEY = 'dms_user';

export const sessionStore = {
  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
  },
  getUser<T = unknown>(): T | null {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  setUser(user: unknown): void {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },
};

/** 閒置自動登出時間（毫秒）：10 分鐘 */
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
