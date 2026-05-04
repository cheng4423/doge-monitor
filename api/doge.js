// api/doge.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const response = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbol=DOGEUSDT'
    );

    // 修正：这里必须是小写的 ok
    if (!response.ok) {
      // 抛出具体的错误状态码，方便排查
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    res.status(200).json({
      price: data.lastPrice,
      high: data.highPrice,
      low: data.lowPrice,
      change: data.priceChangePercent + '%'
    });

  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch price',
      message: err.message
    });
  }
}
