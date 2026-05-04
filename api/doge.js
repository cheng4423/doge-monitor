// api/doge.js
// ✅ 终极稳定版：解决 Vercel + Binance 403 问题

export default async function handler(req, res) {
  // 1. 允许跨域（必须）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // 2. 请求 Binance API（关键：Headers 必须齐全）
    const response = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbol=DOGEUSDT',
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.binance.com/', // 🔥 必须是 binance 域名
          'Origin': 'https://www.binance.com',   // 🔥 增加 Origin
          'Host': 'api.binance.com'             // 🔥 核心：指定 Host
        }
      }
    );

    // 3. 错误处理
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Binance Error:', response.status, errorText);
      throw new Error(`Binance API Error: ${response.status}`);
    }

    // 4. 解析数据并返回给前端
    const data = await response.json();
    
    res.status(200).json({
      price: data.lastPrice,        // 最新价格
      high: data.highPrice,         // 24h最高
      low: data.lowPrice,           // 24h最低
      change: data.priceChangePercent // 涨跌幅
    });

  } catch (error) {
    console.error('Server Error:', error);
    // 如果出错，返回错误信息
    res.status(500).json({
      error: 'Failed to fetch price',
      message: error.message
    });
  }
}
