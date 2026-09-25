const symbols = ["NVDA","AVGO","TSM","AMD","MU","VRT","RKLB","NKE"];

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

    await Promise.all(requested.map(async symbol => {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m&includePrePost=false`
        );

        const j = await r.json();
        const x = j.chart.result[0];
        const meta = x.meta;
        const q = x.indicators.quote[0];

        const closes = q.close.filter(v => v != null);
        const opens = q.open.filter(v => v != null);
        const highs = q.high.filter(v => v != null);
        const lows = q.low.filter(v => v != null);

        const price = closes[closes.length - 1];
        const open = meta.regularMarketOpen || opens[0];

        data[symbol] = {
          symbol,
          price,
          open,
          high: Math.max(...highs),
          low: Math.min(...lows),
          volume: q.volume.reduce((a,v) => a + (v || 0), 0),
          percentChange: ((price - open) / open) * 100,
          marketState: meta.marketState,
          currency: meta.currency
        };
      } catch (e) {
        data[symbol] = { error: e.message };
      }
    }));

    return new Response(JSON.stringify({
      ok: true,
      source: "Yahoo Finance",
      updated: new Date().toISOString(),
      data
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
