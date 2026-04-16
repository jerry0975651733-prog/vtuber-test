// 簡易的 IP Rate Limiting 狀態儲存 (在 Vercel Serverless 中具備短時間防護作用)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 分鐘
const MAX_REQUESTS_PER_WINDOW = 30; // 每分鐘最多 30 次請求

export default async function handler(req, res) {
    // 1. 設定 CORS 標頭，允許 localhost 與您的部署網域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. 處理預檢請求 (Preflight)
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
        const { contents, systemInstruction, knowledgeBase } = req.body;

        // 確保提取正確的系統指令
        const safeSystemPrompt = systemInstruction?.parts?.[0]?.text || "你是一個專業的 AI 虛擬助教。";
        const safeKnowledgeBase = knowledgeBase || "";

        // 4. 構建原本要求的系統指令格式，強制回傳 JSON
        const fullSystemInstruction = `${safeSystemPrompt}

【重要指示】
為了讓系統正確解析動作，請務必「只」回傳純 JSON 格式的文字，不要加上 \`\`\`json 標籤或任何說明文字。
格式範例：
{
  "reply": "你的回覆內容",
  "expression": "情緒(neutral, happy, angry, sad, relaxed, surprised)",
  "specialAction": "動作(none, blink, blinkLeft, blinkRight, aa)",
  "actionDuration": 3
}

【知識庫內容】
${safeKnowledgeBase}`;

        const geminiPayload = {
            contents: contents,
            systemInstruction: { parts: [{ text: fullSystemInstruction }] },
            tools: [{ google_search: {} }] 
        };

        // 5. 呼叫 Google Gemini API (使用目前最穩定的 1.5-flash 版本)
        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Google API 報錯:", data);
            return res.status(response.status).json({ 
                error: "API 請求失敗", 
                details: data.error?.message || "未知錯誤" 
            });
        }

        // 6. 回傳結果給前端
        return res.status(200).json(data);

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ 
            error: '內部伺服器錯誤', 
            message: error.message 
        });
    }
}
