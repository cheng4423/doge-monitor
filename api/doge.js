// api/doge.js
// ✅ 欧易 OKX 模拟盘 + AI 分析（返回 signal 和 reason）

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // 1️⃣ 获取 DOGE 实时数据
    const response = await fetch(
      'https://www.okx.com/api/v5/market/ticker?instId=DOGE-USDT',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.okx.com/',
          'Host': 'www.okx.com'
        }
      }
    );
    
    const json = await response.json();
    if (json.code !== '0') throw new Error(json.msg || 'OKX API 错误');

    const data = json.data[0];
    const price = parseFloat(data.last);
    const open = parseFloat(data.open24h);
    const high = parseFloat(data.high24h);
    const low = parseFloat(data.low24h);
    const vol = parseFloat(data.vol24h);
    
    const change = ((price - open) / open) * 100;
    
    // 2️⃣ 🧠 AI 分析逻辑
    let signal = 'HOLD';
    let reason = '';
    let confidence = 0;

    // 策略 1：大跌抄底
    if (change <= -2.0) {
      signal = 'BUY';
      confidence = 85;
      reason = `暴跌 ${change.toFixed(2)}%，价格已跌破支撑位 ${low.toFixed(4)}，是绝佳抄底机会`;
    } 
    // 策略 2：大涨止盈
    else if (change >= 2.5) {
      signal = 'SELL';
      confidence = 80;
      reason = `暴涨 ${change.toFixed(2)}%，已接近阻力位 ${high.toFixed(4)}，建议分批止盈`;
    }
    // 策略 3：小幅下跌
    else if (change <= -0.8) {
      signal = 'BUY';
      confidence = 65;
      reason = `回调 ${change.toFixed(2)}%，成交量 ${(vol/10000).toFixed(0)}万，是低吸机会`;
    }
    // 策略 4：小幅上涨
    else if (change >= 1.2) {
      signal = 'SELL';
      confidence = 60;
      reason = `上涨 ${change.toFixed(2)}%，但成交量一般，建议部分止盈`;
    }
    // 策略 5：震荡观望
    else {
      signal = 'HOLD';
      confidence = 70;
      reason = `价格在 ${low.toFixed(4)}-${high.toFixed(4)} 区间震荡（${change.toFixed(2)}%），等待突破`;
    }

    // 3️⃣ 返回给前端的数据
    res.status(200).json({
      success: true,
      price,
      change: change.toFixed(2),
      high: high.toFixed(4),
      low: low.toFixed(4),
      volume: (vol/10000).toFixed(0),
      signal,  // ✅ 前端需要的字段
      reason,  // ✅ 前端需要的字段
      confidence,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('API 错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
