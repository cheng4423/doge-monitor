// api/doge.js
// ✅ 终极买入修复版 (解决 All operations failed)
import crypto from 'crypto';

// ===== 1. 环境 =====
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'REAL';
const BASE = 'https://www.okx.com';

// ===== 2. 交易参数 (✅ 关键修改) =====
const MIN_DOGE_TO_BUY = 15;    // 确保至少买 15 个 DOGE (防止数量太少被拒)
const TRADE_USDT_AMOUNT = 25;  // 每次买入 25 USDT (确保金额够大)

// ===== 3. 持仓状态 =====
let activePosition = null;

// ===== 4. 签名 =====
function sign(ts, method, path, body = '') {
  return crypto.createHmac('sha256', SECRET).update(ts + method + path + body).digest('base64');
}

// ===== 5. 获取行情 =====
async function getMarketData() {
  try {
    const res = await fetch(`${BASE}/api/v5/market/ticker?instId=DOGE-USDT`);
    const json = await res.json();
    if (json.code !== '0') throw new Error(json.msg);
    
    // ✅ 防御：如果返回数据为空，给个默认值防止后面报错
    if (!json.data || !json.data[0]) {
      console.log("⚠️ 行情数据为空，使用默认价格 0.1");
      return { last: "0.1000" }; 
    }
    return json.data[0];
  } catch (e) {
    console.log("❌ 获取行情异常:", e.message);
    return { last: "0.1000" }; // 出错时返回一个安全值
  }
}

// ===== 6. 执行买入 (✅ 核心修复) =====
export async function executeBuy() {
  try {
    console.log("🚀 开始执行买入流程...");
    
    const market = await getMarketData();
    // 确保 last 是字符串，避免 undefined
    const priceStr = market.last || "0.1";
    const price = parseFloat(priceStr);
    
    // ✅ 核心修复：计算数量
    // 1. 先算出能买多少个
    let amount = TRADE_USDT_AMOUNT / price;
    
    // 2. 强制向上取整到整数 (OKX 现货通常要求整数个 DOGE)
    amount = Math.ceil(amount); 
    
    // 3. 如果算出来还不到最小限制，就强行设为最小限制
    if (amount < MIN_DOGE_TO_BUY) {
      amount = MIN_DOGE_TO_BUY;
      console.log(`⚠️ 计算数量不足，强制修正为最小购买量: ${amount}`);
    }

    console.log(`💰 准备买入: ${amount} DOGE (约 ${TRADE_USDT_AMOUNT} USDT)`);

    // ===== 7. 构造请求 =====
    const ts = Date.now().toString();
    const method = 'POST';
    const path = '/api/v5/trade/order';
    const body = JSON.stringify({
      instId: 'DOGE-USDT',
      tdMode: 'cash', // 现货模式
      side: 'buy',
      ordType: 'market', // 市价单
      sz: amount.toString(), // 数量
      // px: '' // 市价单不需要价格，留空
    });

    const signature = sign(ts, method, path, body);

    const response = await fetch(BASE + path, {
      method: method,
      headers: {
        'OK-ACCESS-KEY': API_KEY,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': ts,
        'OK-ACCESS-PASSPHRASE': PASSPHRASE,
        'Content-Type': 'application/json'
      },
      body: body
    });

    const result = await response.json();
    console.log("📡 API 返回结果:", JSON.stringify(result));

    // ===== 8. 结果判断 =====
    if (result.code === '0' && result.data && result.data[0].sCode === '0') {
      console.log("✅ 买入成功！订单号:", result.data[0].ordId);
      return { success: true, orderId: result.data[0].ordId };
    } else {
      console.log("❌ 买入失败:", result.msg || result.data[0].sMsg);
      return { success: false, error: result.msg || result.data[0].sMsg };
    }

  } catch (err) {
    console.log("❌ 代码执行错误:", err);
    return { success: false, error: err.message };
  }
}

// ===== 9. 导出启动函数 =====
export async function startBot() {
  console.log("✅ 交易系统启动完成，等待信号...");
  // 这里可以放你的循环逻辑
}
