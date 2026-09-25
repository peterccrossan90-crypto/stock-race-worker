const symbols = ["NVDA", "AVGO", "TSM", "AMD", "MU", "VRT", "RKLB", "NKE"];

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname !== "/quotes") {
      return new Response("Stock Race Worker is running.");
    }

    const requested = (url.searchParams.get("symbols") || symbols.join(","))
      .split(",")
      .map(s => s.trim().toUpperCase())
      .filter(s => symbols.includes(s));

    const data = {};

    await Promise.all(
      requested.map(async (symbol) => {
        try {
          const yahooUrl =
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
            `?range=1d&interval=1m&includePrePost=false`;

          const response = await fetch(yahooUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
              "Accept": "application/json"
            }
          });

          const text = await response.text();

          if (!response.ok) {
            data[symbol] = {
              error: `Yahoo HTTP ${response.status}`,
              detail: text.slice(0, 200)
            };
            return;
          }

          let j;

          try {
            j = JSON.parse(text);
          } catch {
            data[symbol] = {
              error: "Yahoo returned invalid JSON",
              detail: text.slice(0, 200)
            };
            return;
          }

          if (!j.chart || !j.chart.result || !j.chart.result[0]) {
            data[symbol] = {
              error: "Yahoo returned no chart data"
            };
            return;
          }

          const x = j.chart.result[0];
          const meta = x.meta;
          const q = x.indicators.quote[0];

          const closes = (q.close || []).filter(v => v != null);
          const opens = (q.open || []).filter(v => v != null);
          const highs = (q.high || []).filter(v => v != null);
          const lows = (q.low || []).filter(v => v != null);
          const volumes = (q.volume || []).filter(v => v != null);

          if (!closes.length) {
            data[symbol] = {
              error: "Yahoo returned no price data"
            };
            return;
          }

          const price = closes[closes.length - 1];
          const open =
            meta.regularMarketOpen ||
            opens[0] ||
            meta.previousClose;

          data[symbol] = {
            symbol,
            price,
            open,
            high: highs.length ? Math.max(...highs) : price,
            low: lows.length ? Math.min(...lows) : price,
            volume: volumes.reduce((a, v) => a + v, 0),
            percentChange: open
              ? ((price - open) / open) * 100
              : 0,
            marketState: meta.marketState,
            currency: meta.currency
          };

        } catch (error) {
          data[symbol] = {
            error: error.message
          };
        }
      })
    );

    return new Response(
      JSON.stringify({
        ok: true,
        source: "Yahoo Finance",
        updated: new Date().toISOString(),
        data
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS"
        }
      }
    );
  }
};
