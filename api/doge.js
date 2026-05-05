// api/doge.js
export default async function handler(req, res) {
  // 解决 CORS 跨域问题
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 模拟实时价格 (DOGE大概在0.15左右波动)
    const price = (0.15 + (Math.random() - 0.5) * 0.01).toFixed(5);
    
    // 模拟余额
    const mockData = {
      success: true,
      price: parseFloat(price),
      usdtBalance: 100.00,  // 模拟有钱
      dogeBalance: 0,
      holding: false,
      avgPrice: 0,
      pnl: 0,
      pnlPercent: 0,
      aiConfidence: Math.floor(Math.random() * 40) + 60, // 60-100%
      canBuy: true,
      timestamp: new Date().toISOString()
    };

    // 如果前端传了 action=quant，就开启量化模式
    if (req.url?.includes('action=quant')) {
      mockData.quantRunning = true;
      console.log("✅ 量化交易已启动");
      return res.status(200).json({ success: true, message: "量化交易启动成功" });
    }

    // 模拟手动交易
    if (req.url?.includes('action=buy')) {
       return res.status(200).json({ success: true, message: "模拟买入成功", amount: 10, price: price });
    }
    if (req.url?.includes('action=sell')) {
       return res.status(200).json({ success: true, message: "模拟卖出成功", amount: 10, price: price });
    }

    res.status(200).json(mockData);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
