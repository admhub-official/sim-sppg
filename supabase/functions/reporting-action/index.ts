import { CORS, getCaller } from './core.ts';
import {
  getDashboardKPI,
  getChartData,
  getSPPGData,
  getRekapHarian,
  getFilterOptions,
} from './reports.ts';
import {
  getAuditLog,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './activity.ts';

const json = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...CORS, 'Content-Type': 'application/json' } },
);

const handlers: Record<string, Function> = {
  getDashboardKPI,
  getChartData,
  getSPPGData,
  getRekapHarian,
  getFilterOptions,
  getAuditLog,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return json({ status: 'ok', service: 'reporting-action', version: 4 });
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);

  try {
    const caller = await getCaller(req);
    const body = await req.json();
    const fn = handlers[body?.function];
    if (!fn) return json({ error: `Fungsi tidak diizinkan: ${body?.function || ''}` }, 404);
    const result = await fn(Array.isArray(body.parameters) ? body.parameters : [], caller);
    return json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(
      { error: message, result: { success: false, message } },
      /akses|token/i.test(message) ? 403 : 400,
    );
  }
});
