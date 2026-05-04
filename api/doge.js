// api/doge.js
// 🎯 10 USDT 专用版 - 纯模拟学习

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // 1. 获取价格
    const response = await fetch(
      'https://www.okx.com/api/v5/market/ticker?instId=DOGE-USDT',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const json = await response.json();
    const price = parseFloat(json.data[0].last);
    const open = parseFloat(json.data[0].open24h);
    const change = ((price - open) / open) * 100;

    // 2. 简单 AI 策略（适合学习）
    let signal = 'HOLD';
    let reason = '';
    
    if (change <= -1) {
      signal = 'BUY';
      reason = `下跌 ${change.toFixed(2)}%，学习机会`;
    } else if (change >= 2) {
      signal = 'SELL';
      reason = `上涨 ${change.toFixed(2)}%，学习止盈`;
    } else {
      signal = 'HOLD';
      reason = '小幅波动，继续学习';
    }

    // 3. 模拟账户（初始 10,000 模拟 USDT）
    if (!global.simBalance) global.simBalance = 10000;
    if (!global.simDoge) global.simDoge = 0;
    
    const tradeValue = global.simBalance * 0.01;  // 只交易 1%
    const fee = tradeValue * 0.001;  // 0.1% 手续费

    res.status(200).json({
      success: true,
      mode: 'LEARNING',  // 学习模式
      price,
      signal,
      reason,
      change: change.toFixed(2),
      
      // 模拟账户
      simBalance: global.simBalance.toFixed(2),
      simDoge: global.simDoge.toFixed(0),
      simTotal: (global.simBalance + global.simDoge * price).toFixed(2),
      
      // 10 USDT 真实账户
      realBalance: 10.00,
      warning: '⚠️ 当前为学习模式，无真实交易',
      
      timestamp: new Date().toLocaleTimeString()
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      tip: '建议先用模拟账户学习 1 周'
    });
  }
}
