// api/doge.js
export default async function handler(req, res) {
  // 1. 设置 CORS 头，允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // 2. 构造请求选项 (重点：Headers 必须这样写)
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.google.com/',
        'Host': 'api.binance.com'  // 🔥 核心修复：必须加 Host
      }
    };

    // 3. 发起请求
    const response = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbol=DOGEUSDT',
      options
    );

    // 4. 检查响应是否成功
    if (!response.ok) {
      // 如果状态码不是 200，抛出错误
      const errorText = await response.text();
      console.error("Binance API Error:", response.status, errorText);
      throw new Error(`Binance API error: ${response.status}`);
    }

    // 5. 解析数据并返回
    const data = await response.json();
    
    res.status(200).json({
      price: data.lastPrice,
      high: data.highPrice,
      low: data.lowPrice,
      change: data.priceChangePercent + '%'
    });

  } catch (err) {
    console.error("Fetch failed:", err); // 打印错误到日志
    res.status(500).json({
      error: 'Failed to fetch price',
      message: err.message
    });
  }
}
