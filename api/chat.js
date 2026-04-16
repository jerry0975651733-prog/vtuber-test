// 簡易的 IP Rate Limiting 狀態儲存
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 分鐘
const MAX_REQUESTS_PER_WINDOW = 15; // 每分鐘最多 15 次請求

export default async function handler(req, res) {
    // 1. 設定 CORS 標頭，允許你的網址連線
    const allowedOrigins = [
        'https://vtuber-3dgame.vercel.app', 
        'https://davidkuodcam-crypto.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:5500'
    ];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*'); // 測試期間先允許所有，確保連線成功
    }

    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '伺服器未設定 API Key' });

    try {
        const { contents, knowledgeBase } = req.body;

        // 強制設定「考試解憂傾聽者」的角色設定
        const systemPrompt = `你是一個溫柔且充滿同理心的「考試解憂傾聽者」，名字叫「美智」。
你的對象是文藻外語大學的學生。你的目標是聽他們訴說考試壓力，給予情感支持，而不是一味地說教。

【知識庫內容】：
${knowledgeBase || "文藻校園環境溫馨，圖書館是讀書的好地方。"}

【回覆規範】：
請務必「只」回傳純 JSON 格式，不要包含文字說明。
格式：
{
  "reply": "你的鼓勵回覆",
  "expression": "情緒(relaxed, happy, surprised, sad, angry)",
  "specialAction": "none"
}`;

        const geminiPayload = {
            contents: contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: [{ google_search: {} }] 
        };

        // 使用目前最穩定的 1.5-flash 模型
        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: "API 請求失敗", details: errorText });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({ error: '內部伺服器錯誤', message: error.message });
    }
}
