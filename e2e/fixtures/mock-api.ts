import type { Page, Route } from '@playwright/test';
import { emptyPage } from '../mocks/factories';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface MockCall {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  params: Record<string, string>;
  body: unknown;
}

export interface MockReply {
  status?: number;
  body?: unknown;
}

export type MockHandler = (call: MockCall) => MockReply;

/** Bọc dữ liệu giống ApiResponse của backend. */
export function ok<T>(data: T): MockReply {
  return { status: 200, body: { code: 200, message: 'OK', data } };
}

export function fail(status: number, errorCode: string, message: string): MockReply {
  return { status, body: { code: status, errorCode, message } };
}

interface Registered {
  method: Method;
  regex: RegExp;
  keys: string[];
  respond: MockHandler;
}

function compile(path: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${source}$`), keys };
}

function parseBody(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Giả toàn bộ /api/v1 cho một trang. Handler đăng ký sau được ưu tiên hơn, nên
 * test có thể ghi đè các giá trị mặc định. Request không có handler trả 501 và
 * làm test fail khi kết thúc, để API mới không bị bỏ sót âm thầm.
 */
export class MockApi {
  readonly calls: MockCall[] = [];
  readonly unhandled: string[] = [];
  private readonly registered: Registered[] = [];
  private strict = true;

  constructor(private readonly page: Page) {}

  async install(): Promise<void> {
    this.on('GET', '/api/v1/public/movies/featured', ok({ nowShowing: [], upcoming: [] }));
    this.on('GET', '/api/v1/public/movies', ok(emptyPage()));
    this.on('GET', '/api/v1/public/genres/all', ok([]));
    this.on('GET', '/api/v1/public/cinemas', ok([]));
    this.on('GET', '/api/v1/public/promotions', ok(emptyPage()));
    this.on('GET', '/api/v1/foods', ok([]));
    this.on('GET', '/api/v1/vouchers', ok([]));
    await this.page.route('**/api/v1/**', (route) => this.dispatch(route));
  }

  /** `path` nhận tham số dạng `/api/v1/bookings/:bookingId`. */
  on(method: Method, path: string, reply: MockReply | MockHandler): void {
    const { regex, keys } = compile(path);
    const respond = typeof reply === 'function' ? reply : () => reply;
    this.registered.unshift({ method, regex, keys, respond });
  }

  /** Dùng cho test chỉ quan tâm khung trang, không quan tâm dữ liệu. */
  allowUnhandled(): void {
    this.strict = false;
  }

  callsTo(method: Method, path: string): MockCall[] {
    const { regex } = compile(path);
    return this.calls.filter((call) => call.method === method && regex.test(call.path));
  }

  private async dispatch(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const call: MockCall = {
      method: request.method(),
      path: url.pathname,
      query: url.searchParams,
      headers: request.headers(),
      params: {},
      body: parseBody(request.postData()),
    };
    this.calls.push(call);

    for (const entry of this.registered) {
      if (entry.method !== call.method) continue;
      const match = entry.regex.exec(call.path);
      if (!match) continue;
      entry.keys.forEach((key, index) => {
        call.params[key] = match[index + 1];
      });
      const reply = entry.respond(call);
      await route.fulfill({
        status: reply.status ?? 200,
        contentType: 'application/json',
        body: JSON.stringify(reply.body ?? null),
      });
      return;
    }

    if (this.strict) this.unhandled.push(`${call.method} ${call.path}`);
    await route.fulfill({
      status: 501,
      contentType: 'application/json',
      body: JSON.stringify({ message: `Chưa mock: ${call.method} ${call.path}` }),
    });
  }
}
