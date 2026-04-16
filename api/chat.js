// 簡易的 IP Rate Limiting 狀態儲存
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; 
const MAX_REQUESTS_PER_WINDOW = 30; 

export default async function handler(req, res) {
    // 1. 設定 CORS 標頭，允許所有網域以解決連線問題
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. 處理預檢請求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 3. 取得 API Key (確保在 Vercel 後台已設定)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: '伺服器未設定 GEMINI_API_KEY 環境變數，請在 Vercel Settings 中新增。' });
    }

    try {
        const { contents, systemInstruction, knowledgeBase } = req.body;

        const safeSystemPrompt = systemInstruction?.parts?.[0]?.text || "你是一個專業、親切的 AI 虛擬助教。";
        const safeKnowledgeBase = knowledgeBase || "";

        // 4. 強制 AI 回傳 JSON 格式
        const fullSystemInstruction = `${safeSystemPrompt}

【重要指示】
請務必只回傳純 JSON 格式的文字，不要加上 \`\`\`json 標籤。
格式範例：
{
  "reply": "回覆內容",
  "expression": "情緒(neutral, happy, angry, sad, relaxed, surprised)",
  "specialAction": "none",
  "actionDuration": 3
}

【知識庫內容】
${safeKnowledgeBase}`;

        const geminiPayload = {
            contents: contents,
            systemInstruction: { parts: [{ text: fullSystemInstruction }] },
            tools: [{ google_search: {} }] 
        };

        // 5. 呼叫 Google Gemini 1.5 Flash API
        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        const data = await response.json();

        // 6. 錯誤處理與結果回傳
        if (!response.ok) {
            return res.status(response.status).json({ 
                error: "Google API 呼叫失敗", 
                details: data.error?.message || "未知 API 錯誤" 
            });
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("Server Crash:", error);
        return res.status(500).json({ 
            error: '後端執行錯誤', 
            message: error.message 
        });
    }
}
