export interface Env {
  STATE_KV: KVNamespace;
  SYNC_SECRET: string;
  ALLOWED_ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret',
      'Access-Control-Max-Age': '86400',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Проверка эндпоинта /state
    if (url.pathname !== '/state' && url.pathname !== '/state/') {
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Авторизация по заголовку X-Sync-Secret
    const clientSecret = request.headers.get('X-Sync-Secret');
    if (!env.SYNC_SECRET || clientSecret !== env.SYNC_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /state — возвращает JSON из KV или {}
    if (request.method === 'GET') {
      const state = await env.STATE_KV.get('state');
      const responseBody = state ? state : '{}';
      return new Response(responseBody, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /state — сохраняет JSON в KV
    if (request.method === 'PUT') {
      try {
        const text = await request.text();
        JSON.parse(text); // валидация корректности JSON
        await env.STATE_KV.put('state', text);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Invalid JSON', details: err?.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
