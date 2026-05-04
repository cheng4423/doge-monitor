// api/doge.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // 🔥 修正点：Headers 的键名要大写，并且加上 Host
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.google.com/',
        'Host': 'api.binance.com'  // 🔥 加上这个 Host 头，解决 403
      }
    };

    const response = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbol=DOGEUSDT',
      options
    );

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
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
