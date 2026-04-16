// 簡易的 IP Rate Limiting 狀態儲存 (注意: 在 Vercel Serverless 中每次啟動可能重置，但仍具備短時間防護作用)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 分鐘
const MAX_REQUESTS_PER_WINDOW = 15; // 每分鐘最多 15 次請求，防刷配額

export default async function handler(req, res) {
    // 1. 設定 CORS 標頭，嚴格限制來源 (白名單)
    const allowedOrigins = ['https://vtuber-3dgame.vercel.app'];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origin && origin.includes('localhost')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
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

    // --- 安全性加強：簡易 Rate Limiting ---
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const currentTime = Date.now();
    if (rateLimitMap.has(ip)) {
        const clientData = rateLimitMap.get(ip);
        if (currentTime - clientData.startTime < RATE_LIMIT_WINDOW_MS) {
            if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
                return res.status(429).json({ error: '請求過於頻繁 (Rate Limit Exceeded)，請稍後再試。' });
            }
            clientData.count++;
        } else {
            rateLimitMap.set(ip, { count: 1, startTime: currentTime });
        }
    } else {
        rateLimitMap.set(ip, { count: 1, startTime: currentTime });
    }
    // -------------------------------------

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("錯誤: 找不到 GEMINI_API_KEY 環境變數");
        return res.status(500).json({ error: '伺服器端環境變數設定錯誤' });
    }

    try {
        // --- 安全性加強：Payload 驗證與重組 ---
        // 拒絕直接轉發 req.body，而是從中提取允許的欄位
        const { contents, systemPrompt, knowledgeBase } = req.body;

        if (!contents || !Array.isArray(contents)) {
            return res.status(400).json({ error: '無效的對話格式' });
        }

        // 後端嚴格把控 System Instruction 的格式，確保 JSON 與核心邏輯不會被前端覆蓋
        const defaultPrompt = "你是一個專業的 AI 虛擬助教，回答要簡短生動。";
        const safeSystemPrompt = systemPrompt ? systemPrompt : defaultPrompt;
        const safeKnowledgeBase = knowledgeBase ? knowledgeBase : "";

        const fullSystemInstruction = `${safeSystemPrompt}\n\n【重要指示】\n為了讓系統正確解析動作，請務必「只」回傳純 JSON 格式的文字，不要加上 \`\`\`json 標籤或任何其他說明。JSON 格式必須為：\n{\n  "reply": "你的回覆內容",\n  "expression": "情緒(neutral, happy, angry, sad, relaxed, surprised)",\n  "specialAction": "動作(none, blink, blinkLeft, blinkRight, aa)",\n  "actionDuration": 3\n}\n\n【知識庫內容】\n${safeKnowledgeBase}`;

        // 重新封裝要傳送給 Gemini 的資料結構
        const geminiPayload = {
            contents: contents,
            systemInstruction: { parts: [{ text: fullSystemInstruction }] },
            // 修正：Gemini API 官方規定的工具名稱必須是底線分隔的 google_search
            tools: [{ google_search: {} }] 
        };
        // -------------------------------------

        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload) // 發送經過我們後端重組與淨化過的安全 Payload
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('向 Gemini API 請求時發生錯誤:', error);
        return res.status(500).json({ error: '後端伺服器發生未預期的錯誤' });
    }
}

