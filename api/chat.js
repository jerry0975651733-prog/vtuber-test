<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>AI 考試解憂傾聽者</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { 
            margin: 0; 
            overflow: hidden; 
            background: linear-gradient(135deg, #2c1a1a 0%, #1a202c 100%); 
            touch-action: none; 
            font-family: 'Noto Sans TC', sans-serif;
        }
        #canvas-container { width: 100vw; height: 100vh; position: absolute; top: 0; left: 0; z-index: 0; }
        #ui-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; pointer-events: none; }
        .pointer-events-auto { pointer-events: auto; }
        
        /* 毛玻璃效果的對話框 */
        .glass-panel {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 1.5rem;
        }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* 訊息泡泡樣式 */
        .message-bubble {
            max-width: 80%;
            padding: 0.75rem 1rem;
            border-radius: 1rem;
            margin-bottom: 0.5rem;
            font-size: 0.95rem;
            line-height: 1.5;
            word-wrap: break-word;
        }
        .user-message { background: rgba(99, 102, 241, 0.4); color: white; align-self: flex-end; border-bottom-right-radius: 0.25rem; }
        .ai-message { background: rgba(255, 255, 255, 0.15); color: white; align-self: flex-start; border-bottom-left-radius: 0.25rem; }

        @keyframes subtle-glow {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0.9; }
        }
        .glow-text { animation: subtle-glow 3s infinite ease-in-out; }

        /* 麥克風正在錄音的動畫 */
        .mic-active { color: #f87171 !important; filter: drop-shadow(0 0 8px #f87171); }
    </style>

    <script type="importmap">
        {
            "imports": {
                "three": "https://cdn.jsdelivr.net/npm/three@0.154.0/build/three.module.js",
                "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.154.0/examples/jsm/",
                "@pixiv/three-vrm": "https://unpkg.com/@pixiv/three-vrm@2.0.2/lib/three-vrm.module.js"
            }
        }
    </script>
</head>
<body>
    <div id="canvas-container"></div>

    <div id="ui-layer" class="flex flex-col justify-end p-4 md:p-8">
        <!-- 頂部狀態列 -->
        <div class="absolute top-6 left-6 pointer-events-auto">
            <div class="glass-panel px-4 py-2 flex items-center gap-3">
                <div id="status-dot" class="w-3 h-3 bg-green-400 rounded-full glow-text"></div>
                <span id="status-text" class="text-white text-sm font-medium tracking-wide">傾聽者正在陪伴你...</span>
            </div>
        </div>

        <!-- 聊天顯示區域 -->
        <div id="chat-display" class="w-full max-w-2xl mx-auto mb-6 overflow-y-auto max-h-[40vh] no-scrollbar flex flex-col pointer-events-auto">
            <!-- 訊息會動態插入此處 -->
        </div>

        <!-- 輸入區域 -->
        <div class="w-full max-w-2xl mx-auto glass-panel p-2 pointer-events-auto">
            <div class="flex items-center gap-2">
                <input type="text" id="chat-input" 
                    class="flex-1 bg-transparent border-none text-white px-4 py-3 focus:outline-none placeholder-gray-400" 
                    placeholder="準備考試辛苦了，想說說心事嗎？">
                <button id="mic-btn" class="p-3 rounded-full hover:bg-white/10 transition-colors">
                    <svg id="mic-icon" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                </button>
                <button id="send-btn" class="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-xl transition-all font-bold">
                    發送
                </button>
            </div>
        </div>
    </div>

    <script type="module">
        import * as THREE from 'three';
        import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

        let scene, camera, renderer, currentVrm, controls;
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        // --- 初始化場景 ---
        function init() {
            scene = new THREE.Scene();
            scene.fog = new THREE.Fog(0x1a202c, 5, 15);

            camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 1.4, 3.0);

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.outputEncoding = THREE.sRGBEncoding;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            document.getElementById('canvas-container').appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);

            const mainLight = new THREE.DirectionalLight(0xffe4b5, 1.0);
            mainLight.position.set(2, 2, 2);
            scene.add(mainLight);

            const fillLight = new THREE.PointLight(0xadd8e6, 0.5);
            fillLight.position.set(-2, 1, 1);
            scene.add(fillLight);

            controls = new OrbitControls(camera, renderer.domElement);
            controls.target.set(0, 1.3, 0);
            controls.enableDamping = true;
            controls.minDistance = 1.5;
            controls.maxDistance = 5;

            const vrmUrl = new URL('./model.vrm', window.location.href).href;
            loadVRM(vrmUrl);

            animate();
        }

        function loadVRM(url) {
            loader.load(url, (gltf) => {
                const vrm = gltf.userData.vrm;
                VRMUtils.removeUnnecessaryJoints(gltf.scene);
                VRMUtils.rotateVRM0(vrm);
                scene.add(vrm.scene);
                currentVrm = vrm;
                if (currentVrm.expressionManager) {
                    currentVrm.expressionManager.setValue('relaxed', 0.5);
                }
            }, undefined, (error) => {
                console.error('模型載入失敗:', error);
                if (!url.startsWith('http')) loadVRM('model.vrm');
            });
        }

        function animate() {
            requestAnimationFrame(animate);
            if (currentVrm) {
                currentVrm.update(1/60);
                currentVrm.scene.position.y = Math.sin(Date.now() * 0.001) * 0.01;
            }
            controls.update();
            renderer.render(scene, camera);
        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        init();

        // --- 核心對話與語音邏輯 (原 chat.js 邏輯整合) ---
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const chatDisplay = document.getElementById('chat-display');
        const micBtn = document.getElementById('mic-btn');
        const micIcon = document.getElementById('mic-icon');
        const statusText = document.getElementById('status-text');

        let isSpeaking = false;
        let isRecording = false;
        let recognition = null;

        // 語法顯示訊息
        function appendMessage(text, role) {
            const bubble = document.createElement('div');
            bubble.className = `message-bubble ${role === 'user' ? 'user-message' : 'ai-message'}`;
            bubble.innerText = text;
            chatDisplay.appendChild(bubble);
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }

        // 修改表情函數
        function changeExpression(expressionName, duration = 3000) {
            if (!currentVrm || !currentVrm.expressionManager) return;
            // 先重置
            ['happy', 'sad', 'angry', 'relaxed', 'surprised'].forEach(e => currentVrm.expressionManager.setValue(e, 0));
            // 設定新表情
            currentVrm.expressionManager.setValue(expressionName, 1.0);
            setTimeout(() => {
                currentVrm.expressionManager.setValue(expressionName, 0);
                currentVrm.expressionManager.setValue('relaxed', 0.5);
            }, duration);
        }

        // 語音合成 (TTS)
        function speakText(text) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-TW';
            utterance.rate = 1.0;
            utterance.onstart = () => { isSpeaking = true; statusText.innerText = "傾聽者正在回應你..."; };
            utterance.onend = () => { isSpeaking = false; statusText.innerText = "傾聽者正在陪伴你..."; };
            window.speechSynthesis.speak(utterance);
        }

        // 發送訊息到 API (這裡需要對接您的後端或直接呼叫 Gemini)
        async function sendMessage() {
            const text = chatInput.value.trim();
            if (!text || isSpeaking) return;

            appendMessage(text, 'user');
            chatInput.value = '';
            statusText.innerText = "思考中...";

            try {
                // 這裡模擬 API 回覆，您可以將此處替換為 fetch('your-api-url')
                // 參考您原本的 chat.js 呼叫邏輯
                const mockReplies = [
                    { text: "準備考試真的很辛苦，適時休息也是很重要的喔。", emotion: "relaxed" },
                    { text: "我一直都會在這裡聽你說，別壓力太大。", emotion: "happy" },
                    { text: "聽起來你最近有點焦慮，要不要試著深呼吸三次？", emotion: "surprised" }
                ];
                const reply = mockReplies[Math.floor(Math.random() * mockReplies.length)];

                setTimeout(() => {
                    appendMessage(reply.text, 'ai');
                    speakText(reply.text);
                    changeExpression(reply.emotion);
                }, 1000);

            } catch (error) {
                console.error("API 錯誤:", error);
                appendMessage("抱歉，我現在有點不舒服，等一下再聊好嗎？", 'ai');
            }
        }

        // 語音辨識 (STT)
        if ('webkitSpeechRecognition' in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'zh-TW';

            recognition.onstart = () => {
                isRecording = true;
                micIcon.classList.add('mic-active');
                statusText.innerText = "正在聆聽你的心聲...";
            };

            recognition.onend = () => {
                isRecording = false;
                micIcon.classList.remove('mic-active');
            };

            recognition.onresult = (event) => {
                const result = event.results[0][0].transcript;
                chatInput.value = result;
                sendMessage();
            };
        }

        micBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                window.speechSynthesis.cancel();
                recognition.start();
            }
        });

        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

    </script>
</body>
</html>
