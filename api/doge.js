// api/doge.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const response = await fetch(
      'https://www.okx.com/api/v5/market/ticker?instId=DOGE-USDT', 
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.okx.com/', // 必须加这个
          'Host': 'www.okx.com' // 必须加这个
        }
      }
    );

    if (!response.ok) {
      throw new Error(`OKX API Error: ${response.status}`);
    }

    const json = await response.json();
    
    // 欧易返回的数据结构
    if (json.code === '0' && json.data && json.data.length > 0) {
      res.status(200).json({
        price: json.data[0].last,
        symbol: 'DOGE'
      });
    } else {
      throw new Error('Failed to get price');
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
