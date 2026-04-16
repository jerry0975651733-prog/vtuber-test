// 簡易的 IP Rate Limiting 狀態儲存 (在 Vercel Serverless 中具備短時間防護作用)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 分鐘
const MAX_REQUESTS_PER_WINDOW = 15; // 每分鐘最多 15 次請求

export default async function handler(req, res) {
    // 1. 設定 CORS 標頭 - 允許你的網域連線
    const allowedOrigins = [
        'https://vtuber-3dgame.vercel.app', 
        'https://davidkuodcam-crypto.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:5500'
    ];
    const origin = req.headers.origin;
    
    // 測試期間若遇到跨域問題，可暫時將其改為 res.setHeader('Access-Control-Allow-Origin', '*');
    if (allowedOrigins.includes(origin) || (origin && origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. 處理瀏覽器的預檢請求 (Preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 只允許 POST 方法
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 3. 取得 API Key (請確保 Vercel 環境變數中有 GEMINI_API_KEY)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: '伺服器未設定 GEMINI_API_KEY 環境變數' });
    }

    try {
        const { contents, knowledgeBase } = req.body;

        // 4. 定義系統指令與角色設定
        // 這裡強制美智以溫柔的語氣回答，並要求回傳 JSON 格式以便前端解析表情
        const systemPrompt = `你是一個溫柔且充滿同理心的「考試解憂傾聽者」，名字叫「美智」。
你的對象是文藻外語大學的學生。你的目標是聽他們訴說考試壓力，給予情感支持。

【知識庫內容】：
${knowledgeBase || "文藻校園環境溫馨，圖書館 8 樓是讀書聖地。考多益可以多聽聽力，累了就去買大苑子。"}

【回覆規範】：
請務必「只」回傳純 JSON 格式，不要包含文字說明或 \`\`\`json 標籤。
格式範例：
{
  "reply": "你的回覆文字",
  "expression": "情緒(relaxed, happy, surprised, sad, angry)",
  "specialAction": "none"
}`;

        // 5. 封裝要傳送給 Google Gemini 的 Payload
        const geminiPayload = {
            contents: contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: [{ google_search: {} }] 
        };

        // 6. 呼叫 Google Gemini API (使用穩定的 1.5-flash)
        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Google API 報錯:", data);
            return res.status(response.status).json({ error: "API 失敗", details: data.error?.message });
        }

        // 7. 回傳結果給前端
        return res.status(200).json(data);

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: '內部伺服器錯誤', message: error.message });
    }
}
