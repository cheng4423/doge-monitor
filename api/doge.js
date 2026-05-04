// api/doge.js
// ✅ 欧易 OKX 狗狗币价格接口（已修复 URL 和解析）

export default async function handler(req, res) {
  // 1. 允许前端跨域访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // 2. 🔥 修改点：URL 换成欧易的
    const response = await fetch(
      'https://www.okx.com/api/v5/market/ticker?instId=DOGE-USDT',
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json',
          'Referer': 'https://www.okx.com/' // 欧易需要这个 Referer
        }
      }
    );

    // 3. 检查请求是否成功
    if (!response.ok) {
      throw new Error(`OKX API Error: ${response.status}`);
    }

    const json = await response.json();

    // 4. 🔥 修改点：欧易返回的数据在 data[0] 里
    // 欧易的成功码是 "0"
    if (json.code !== '0') {
      throw new Error(json.msg || 'OKX returned error');
    }

    const d = json.data[0];

    // 5. 返回给前端的数据
    res.status(200).json({
      price: d.last,           // 最新价格
      high: d.high24h,         // 24小时最高
      low: d.low24h,           // 24小时最低
      change: d.sodUtc8         // 今日涨跌幅（UTC+8）
    });

  } catch (error) {
    console.error('Fetch DOGE price failed:', error);
    res.status(500).json({
      error: 'Failed to fetch price',
      message: error.message
    });
  }
}
