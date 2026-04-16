// ... 前方的 Rate Limiting 保持不變 ...

export default async function handler(req, res) {
    // ... CORS 處理保持不變 ...

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '找不到 API Key' });

    try {
        const { contents, systemInstruction, knowledgeBase } = req.body;

        // 確保 systemInstruction 的文字能正確提取
        const baseInstruction = systemInstruction?.parts?.[0]?.text || "你是一個專業助手";
        const safeKnowledge = knowledgeBase || "";

        // 重新組合指令，確保知識庫被正確放入
        const finalInstruction = `${baseInstruction}\n\n【知識庫參考內容】：\n${safeKnowledge}`;

        const geminiPayload = {
            contents: contents,
            systemInstruction: { parts: [{ text: finalInstruction }] },
            // 修正：目前 1.5 系列的工具名稱
            tools: [{ google_search: {} }] 
        };

        // 修正：使用穩定的 v1beta 1.5-flash 網址
        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Server Error' });
    }
}
```

#### 2. 修正 `index.html` (前端呼叫邏輯)
請找到 `index.html` 內的 `sendMessage` 函數，確保它傳送的資料結構能對應到後端的 `req.body`。

```javascript
// 在 index.html 的 <script type="module"> 裡面找到 sendMessage 並更新：
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    chatBubble.classList.remove('hidden');
    chatText.innerHTML = `<span class="text-blue-800 text-sm opacity-70">你：${text}</span><br><span class="text-blue-900/60 text-sm animate-pulse">正在思考中...</span>`;
    
    conversationHistory.push({ role: "user", parts: [{ text: text }] });

    try {
        const response = await fetch(`/api/chat`, { // 確保這是你 Vercel API 的正確路徑
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: conversationHistory,
                // 這裡傳送知識庫內容
                knowledgeBase: knowledgeBaseText, 
                // 傳送系統設定
                systemInstruction: { 
                    parts: [{ text: systemPromptText + " 請務必回傳 JSON 格式。" }] 
                }
            })
        });

        const data = await response.json();
        
        // 檢查 API 回傳結構
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const aiRawText = data.candidates[0].content.parts[0].text;
            
            // 嘗試解析 JSON
            const jsonMatch = aiRawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const resJson = JSON.parse(jsonMatch[0]);
                chatText.innerHTML = resJson.reply;
                speakAndLipSync(resJson.reply);
                // 更新表情
                if (resJson.expression) targetExpression = resJson.expression;
            } else {
                // 如果不是 JSON，直接顯示文字
                chatText.innerHTML = aiRawText;
                speakAndLipSync(aiRawText);
            }
        }
    } catch (error) {
        chatText.innerHTML = "抱歉，連線出了點問題。";
    }
}
