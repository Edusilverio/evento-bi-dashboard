import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LAT = -3.85;
const LON = -32.42;
const EVENT_DAYS = [
  "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04",
  "2026-09-05", "2026-09-06", "2026-09-07",
];

const FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=America%2FSao_Paulo&forecast_days=16`;

const ARCHIVE_URL =
  `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=2016-09-01&end_date=2025-09-10&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America%2FSao_Paulo`;

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const [forecastRes, archiveRes] = await Promise.allSettled([
      fetch(FORECAST_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`forecast ${r.status}`)))),
      fetch(ARCHIVE_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`archive ${r.status}`)))),
    ]);

    const forecast = forecastRes.status === 'fulfilled' ? forecastRes.value : null;
    const archive = archiveRes.status === 'fulfilled' ? archiveRes.value : null;

    if (!forecast && !archive) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível obter a previsão do tempo no momento.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Climatology: average per month-day across years
    const clim: Record<string, { max: number[]; min: number[]; prec: number[] }> = {};
    if (archive?.daily?.time) {
      const d = archive.daily;
      d.time.forEach((t: string, i: number) => {
        const md = t.slice(5); // MM-DD
        clim[md] ??= { max: [], min: [], prec: [] };
        if (typeof d.temperature_2m_max?.[i] === 'number') clim[md].max.push(d.temperature_2m_max[i]);
        if (typeof d.temperature_2m_min?.[i] === 'number') clim[md].min.push(d.temperature_2m_min[i]);
        if (typeof d.precipitation_sum?.[i] === 'number') clim[md].prec.push(d.precipitation_sum[i]);
      });
    }

    const fd = forecast?.daily;
    const days = EVENT_DAYS.map((date) => {
      const idx = fd?.time ? fd.time.indexOf(date) : -1;
      if (idx >= 0) {
        return {
          data: date,
          temp_max: fd.temperature_2m_max?.[idx] ?? null,
          temp_min: fd.temperature_2m_min?.[idx] ?? null,
          precipitacao: fd.precipitation_sum?.[idx] ?? null,
          probabilidade_chuva: fd.precipitation_probability_max?.[idx] ?? null,
          vento: fd.wind_speed_10m_max?.[idx] ?? null,
          weather_code: fd.weather_code?.[idx] ?? null,
          fonte: 'previsao' as const,
        };
      }
      const c = clim[date.slice(5)];
      const prec = c ? avg(c.prec) : null;
      return {
        data: date,
        temp_max: c ? avg(c.max) : null,
        temp_min: c ? avg(c.min) : null,
        precipitacao: prec,
        probabilidade_chuva: prec === null ? null : Math.min(100, Math.round(prec * 20)),
        vento: null,
        weather_code: prec === null ? null : prec >= 5 ? 61 : prec >= 1 ? 80 : prec >= 0.2 ? 3 : 0,
        fonte: 'climatologia' as const,
      };
    });

    return new Response(JSON.stringify({ days, updated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
    });
  } catch (e) {
    console.error('[weather-forecast]', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
