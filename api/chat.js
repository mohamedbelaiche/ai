export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const body = await req.json();
    const { messages, model, temperature, apiKey: clientApiKey, stream = true } = body;

    // Use environment variable if set on Vercel, otherwise fallback to client-supplied key
    const apiKey = process.env.OPENROUTER_API_KEY || clientApiKey;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'مفتاح OpenRouter API غير متوفر. يرجى إدخال المفتاح في إعدادات الواجهة أو تعيين OPENROUTER_API_KEY في متغيرات البيئة على Vercel.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const selectedModel = model || 'recursive/flint-v1.0:free';
    const siteUrl = req.headers.get('origin') || 'https://vercel.app';

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': 'OpenRouter AI Chatbot',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: messages || [],
        stream: Boolean(stream),
        temperature: typeof temperature === 'number' ? temperature : 0.7,
      }),
    });

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      return new Response(errText, {
        status: openRouterResponse.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (stream) {
      return new Response(openRouterResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else {
      const data = await openRouterResponse.json();
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'خطأ في معالجة الطلب على الخادم' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
