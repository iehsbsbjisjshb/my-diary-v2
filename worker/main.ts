export interface Env {
  STATE_KV: KVNamespace;
  SYNC_SECRET: string;
  ALLOWED_ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || '*';
    const securityHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret',
      'Access-Control-Max-Age': '86400',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: securityHeaders });
    }

    const url = new URL(request.url);

    // Проверка эндпоинта /state
    if (url.pathname !== '/state' && url.pathname !== '/state/') {
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...securityHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Авторизация по заголовку X-Sync-Secret
    const clientSecret = request.headers.get('X-Sync-Secret');
    if (!env.SYNC_SECRET || clientSecret !== env.SYNC_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...securityHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /state — возвращает JSON из KV или {}
    if (request.method === 'GET') {
      const state = await env.STATE_KV.get('state');
      const responseBody = state ? state : '{}';
      return new Response(responseBody, {
        status: 200,
        headers: { ...securityHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /state — сохраняет JSON в KV
    if (request.method === 'PUT') {
      // Проверка Content-Length до чтения тела
      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      const MAX_BODY = 512 * 1024; // 512 KB
      if (contentLength > MAX_BODY) {
        return new Response(JSON.stringify({ error: 'Payload Too Large' }), {
          status: 413,
          headers: { ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const text = await request.text();
        if (text.length > MAX_BODY) {
          return new Response(JSON.stringify({ error: 'Payload Too Large' }), {
            status: 413,
            headers: { ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const parsed = JSON.parse(text);
        
        // Структурная валидация
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
          throw new Error('Invalid state structure');
        }
        if (parsed.version !== 2) {
          throw new Error('Unknown state version');
        }
        
        // Запрет prototype pollution
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        const hasDangerous = (obj: any, depth = 0): boolean => {
          if (depth > 5 || typeof obj !== 'object' || obj === null) return false;
          return Object.keys(obj).some(k => dangerousKeys.includes(k) || hasDangerous(obj[k], depth + 1));
        };
        if (hasDangerous(parsed)) {
          throw new Error('Forbidden keys in payload');
        }

        await env.STATE_KV.put('state', text);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...securityHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Invalid JSON or Forbidden', details: err?.message }), {
          status: 400,
          headers: { ...securityHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...securityHeaders, 'Content-Type': 'application/json' },
    });
  },
};
