<script>
/* =========================================================
   DUAL.INFODOSE v5.1 — KOBΦ VOICE FIX + ADVANCED DOWNLOADS
   Atualizado: sincronização de tema automático corrigida
   CHAVES MIGRADAS → di_ system
========================================================= */

const STORAGE = {
    USER_NAME: 'di_userName',
    API_KEY: 'di_apiKey',
    MODEL: 'di_modelName',

    SYSTEM_ROLE: 'di_trainingText',
    TRAINING_FILE: 'di_trainingFileName',

    ASSISTANT_ENABLED: 'di_assistantEnabled',
    TRAINING_ACTIVE: 'di_trainingActive',

    INFODOSE_NAME: 'di_infodoseName',

    CONVERSATION: 'di_conversation',
    CRISTALIZADOS: 'di_cristalizados',

    // opcionais / expansão
    BG_IMAGE: 'di_bgImage',
    CUSTOM_CSS: 'di_customCss',
    SOLAR_MODE: 'di_solarMode',
    SOLAR_AUTO: 'di_solarAuto'
};


const FOOTER_TEXTS = {
    closed: { 
        ritual: [ "tocar o campo é consentir", "registro aguarda presença", "abrir é escolher ouvir" ], 
        tecnico: [ "latência detectada", "campo em espera", "aguardando input" ] 
    },
    open: { 
        sustentado: [ "campo ativo", "consciência expandida", "fluxo de dados aberto" ], 
        estavel: [ "sinal estabilizado", "link neural firme", "processando..." ] 
    },
    loading: [ "sincronizando neuro-link...", "buscando no éter...", "decodificando sinal...", "aguarde a fusão..." ]
};

let lastText = null;
function getRandomText(arr) { 
    if (!arr || arr.length === 0) return "Processando...";
    let t; 
    do { t = arr[Math.floor(Math.random() * arr.length)]; } while (t === lastText && arr.length > 1); 
    lastText = t; 
    return t; 
}

/* --- APP CORE --- */
const App = {
    state: { 
        open: false, 
        messages: [], 
        isAutoSolar: true, 
        solarMode: null, // <-- inicializado como null para forçar sync inicial
        isProcessing: false,
        isListening: false,
        recognition: null 
    },
    
    init() {
        const s = localStorage;
        document.getElementById('apiKeyInput').value = s.getItem(STORAGE.API_KEY) || '';
        document.getElementById('systemRoleInput').value = s.getItem(STORAGE.SYSTEM_ROLE) || 'Você é Dual';
        
        const savedUser = s.getItem(STORAGE.USER_NAME) || 'Viajante';
        document.getElementById('inputUserId').value = savedUser;
        document.getElementById('inputModel').value = s.getItem(STORAGE.MODEL) || 'arcee-ai/trinity-mini:free';

        const savedAuto = s.getItem(STORAGE.SOLAR_AUTO);
        this.state.isAutoSolar = savedAuto === 'false' ? false : true;
        
        // remove qualquer classe de modo pré-injetada (evita mismatch visual no boot)
        document.body.classList.remove('mode-day','mode-sunset','mode-night');

        if (this.state.isAutoSolar) this.autoByTime();
        else this.setMode(s.getItem(STORAGE.SOLAR_MODE) || 'night');

        this.indexedDB.loadCustomCSS();
        this.indexedDB.loadBackground();
        this.setupVoiceSystem();
        this.bindEvents();
        this.updateUI();
        this.toggleField(false, true); 
        this.renderDeck();
        
        setTimeout(() => {
            const h = new Date().getHours();
            let greeting = "Bem-vindo de volta";
            if (h >= 5 && h < 12) greeting = "Bom dia";
            else if (h >= 12 && h < 18) greeting = "Boa tarde";
            else greeting = "Boa noite";
            this.announce(`Dual Infodose Online. ${greeting}, ${savedUser}.`);
        }, 1200);

        if(typeof particlesJS !== 'undefined') particlesJS('particles-js', {particles:{number:{value:30},color:{value:"#ffffff"},opacity:{value:0.5},size:{value:2},line_linked:{enable:true,distance:150,color:"#ffffff",opacity:0.2,width:1}}});
    },

    setupVoiceSystem() {
        if (!('webkitSpeechRecognition' in window)) {
            console.warn("Voz não suportada neste navegador.");
            return;
        }
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = true; 
        recognition.interimResults = true;

        recognition.onstart = () => {
            this.state.isListening = true;
            document.getElementById('btnVoice').classList.add('listening');
            this.showToast("Canal de voz aberto. Fale...");
        };
        recognition.onend = () => {
            this.state.isListening = false;
            document.getElementById('btnVoice').classList.remove('listening');
        };
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                else finalTranscript += event.results[i][0].transcript;
            }
            document.getElementById('userInput').value = finalTranscript;
        };
        recognition.onerror = (event) => {
            console.error("Erro voz:", event.error);
            this.state.isListening = false;
            document.getElementById('btnVoice').classList.remove('listening');
            if(event.error === 'no-speech') this.showToast("Nenhum som detectado.");
        };
        this.state.recognition = recognition;
    },

    toggleVoice() {
        if (!this.state.recognition) {
            alert("Voz não suportada ou não inicializada.");
            return;
        }
        if (this.state.isListening) this.state.recognition.stop();
        else {
            document.getElementById('userInput').value = ''; 
            try { this.state.recognition.start(); } catch (e) { console.error("Erro ao iniciar voz:", e); }
        }
    },

    setupFileUpload() {
        const input = document.getElementById('fileUploadInput');
        const preview = document.getElementById('filePreview');
        const btn = document.getElementById('btnUploadFile');
        btn.onclick = () => input.click();
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const info = preview.querySelector('.file-info span');
            const actions = preview.querySelector('.file-actions');
            info.textContent = `${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
            preview.classList.add('active');
            actions.innerHTML = `
                <button class="btn-preview" onclick="App.cancelUpload()">✕</button>
                <button class="btn-preview primary" onclick="App.confirmUpload('${file.name}')">Assimilar</button>
            `;
        };
    },

    cancelUpload() {
        const p = document.getElementById('filePreview');
        p.classList.remove('active');
        document.getElementById('fileUploadInput').value = '';
    },

    confirmUpload(fileName) {
        const file = document.getElementById('fileUploadInput').files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.addMessage('system', `Memória assimilada: ${fileName}`);
            this.state.messages.push({
                role: 'user', 
                content: `[SISTEMA DE ARQUIVO: ${fileName}]\n\n${content}\n\n[FIM DO ARQUIVO]`
            });
            this.announce("Arquivo lido e correlacionado.");
            this.cancelUpload();
        };
        if (file.type.startsWith('image')) {
             this.addMessage('system', `Imagem detectada (metadados): ${fileName}`);
             this.cancelUpload();
        } else {
            reader.readAsText(file);
        }
    },

    speakText(text) {
        if (!text) return;
        window.speechSynthesis.cancel(); 
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR'; u.rate = 1.1; 
        window.speechSynthesis.speak(u);
    },
    announce(text, isError = false) { this.showToast(text, isError); },

    async crystallizeSession() {
        if(this.state.messages.length === 0) {
            this.announce("O vazio não pode ser cristalizado.", true);
            return;
        }
        const title = this.state.messages.find(m => m.role === 'user')?.content || "Memória Sem Nome";
        const crystal = {
            id: Date.now(),
            date: new Date().toLocaleString(),
            title: title.substring(0, 25) + (title.length>25 ? "..." : ""),
            data: [...this.state.messages]
        };
        await this.indexedDB.saveDeckItem(crystal);
        this.renderDeck();
        this.announce("Memória Cristalizada.");
        const d = document.getElementById('drawerDeck');
        if(!d.classList.contains('open')) toggleDrawer('drawerDeck');
    },

    async renderDeck() {
        const items = await this.indexedDB.getDeck();
        const container = document.getElementById('deckList');
        if(!items || items.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:20px">O vazio reina aqui.<br>Use o botão 💎 para salvar.</div>';
            return;
        }
        container.innerHTML = items.sort((a,b) => b.id - a.id).map(item => `
            <div class="deck-item">
                <div class="deck-info">
                    <h4>${item.title}</h4>
                    <span>${item.date} • ${item.data.length} msgs</span>
                </div>
                <div style="display:flex; gap:10px">
                    <button class="tool-btn" onclick="App.restoreMemory(${item.id})"><svg><use href="#icon-restore"></use></svg></button>
                    <button class="tool-btn" style="color:var(--danger)" onclick="App.deleteMemory(${item.id})"><svg><use href="#icon-trash"></use></svg></button>
                </div>
            </div>
        `).join('');
    },

    async restoreMemory(id) {
        const items = await this.indexedDB.getDeck();
        const item = items.find(i => i.id === id);
        if(item) {
            document.getElementById('chat-container').innerHTML = '';
            this.state.messages = [];
            item.data.forEach(msg => this.addMessage(msg.role === 'assistant' ? 'ai' : 'user', msg.content));
            toggleDrawer('drawerDeck');
            this.announce("Memória restaurada.");
        }
    },

    async deleteMemory(id) {
        if(!confirm("Quebrar este cristal?")) return;
        await this.indexedDB.deleteDeckItem(id);
        this.renderDeck();
        this.announce("Fragmentos dispersos.");
    },

    async handleSend() {
        const input = document.getElementById('userInput');
        const txt = input.value.trim();
        if (!txt || this.state.isProcessing) return;
        
        input.value = '';
        this.addMessage('user', txt);
        this.state.isProcessing = true;
        
        const footerHandle = document.getElementById('field-toggle-handle');
        const loadTxt = getRandomText(FOOTER_TEXTS.loading);
        footerHandle.innerHTML = `<span class="footer-dot pulse" style="background:var(--primary)"></span> ${loadTxt}`;
        this.speakText(loadTxt); 

        const key = localStorage.getItem(STORAGE.API_KEY);
        const model = document.getElementById('inputModel').value;

        if (!key && !model.includes(':free')) {
            this.announce("Erro: API Key necessária.", true);
            this.state.isProcessing = false;
            return;
        }

        try {
            document.body.classList.add('loading');
            if (!this.state.open) this.toggleField(true, true);

            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${key}`, 
                    'Content-Type': 'application/json',
                    'HTTP-Referer': location.origin 
                },
                body: JSON.stringify({
                    model: model,
                    messages: [ 
                        { role: 'system', content: document.getElementById('systemRoleInput').value },
                        ...this.state.messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: txt } 
                    ]
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error.message || "Erro desconhecido");

            const aiTxt = data.choices?.[0]?.message?.content || "Sem sinal.";
            this.addMessage('ai', aiTxt);

        } catch (e) {
            this.announce("Falha na conexão.", true);
            this.addMessage('system', `Erro: ${e.message}`);
        } finally {
            document.body.classList.remove('loading');
            this.state.isProcessing = false; 
            this.toggleField(this.state.open, true);
        }
    },

    // --- NOVA FUNÇÃO ADDMESSAGE (com suporte a dataset.raw e ícones SVG)
    addMessage(role, text) {
        const c = document.getElementById('chat-container');
        const d = document.createElement('div');
        d.className = `msg-block ${role}`;
        d.dataset.raw = text || '';

        let html = role === 'ai' ? marked.parse(text) : text.replace(/\n/g, '<br>');
        
        if(role !== 'system') {
            html += `<div class="msg-tools">
                <button class="tool-btn" onclick="Utils.copy(this)" title="Copiar"><svg><use href="#icon-copy"></use></svg></button>
                <button class="tool-btn" onclick="Utils.speak(this)" title="Ouvir"><svg><use href="#icon-mic"></use></svg></button>
                ${role === 'user' ? `<button class="tool-btn" onclick="Utils.edit(this)" title="Editar"><svg><use href="#icon-edit"></use></svg></button>` : ''}
                ${role === 'ai' ? `
                  <button class="tool-btn" onclick="DownloadUtils.downloadMessage(this)" title="Download bruto"><svg><use href="#icon-download"></use></svg></button>
                  <button class="tool-btn" onclick="DownloadUtils.openSandbox(this)" title="Abrir sandbox"><svg><use href="#icon-sandbox"></use></svg></button>
                  <button class="tool-btn" onclick="DownloadUtils.exportPdf(this)" title="Exportar PDF"><svg><use href="#icon-pdf"></use></svg></button>
                  <button class="tool-btn" onclick="DownloadUtils.downloadMarkdown(this)" title="Salvar como .md"><svg><use href="#icon-md"></use></svg></button>
                ` : ''}
            </div>`;
            this.state.messages.push({ role: role==='ai'?'assistant':'user', content: text });
        }
        
        d.innerHTML = html;
        
        if (role === 'ai') {
            const codeBlocks = d.querySelectorAll('pre');
            codeBlocks.forEach(pre => {
                const btn = document.createElement('button');
                btn.className = 'copy-code-btn';
                btn.textContent = 'Copiar Código';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const code = pre.querySelector('code').innerText;
                    navigator.clipboard.writeText(code);
                    btn.textContent = 'Copiado!';
                    btn.style.color = '#00ff00';
                    setTimeout(() => { btn.textContent = 'Copiar Código'; btn.style.color = ''; }, 2000);
                };
                pre.appendChild(btn);
            });
        }
        
        c.appendChild(d);
        c.scrollTop = c.scrollHeight;
    },

    setMode(mode) {
        this.state.solarMode = mode;
        document.body.classList.remove('mode-day', 'mode-sunset', 'mode-night');
        document.body.classList.add(`mode-${mode}`);
        localStorage.setItem(STORAGE.SOLAR_MODE, mode);
        // sincroniza camadas visuais (sol, partículas, background)
        this.syncVisuals(mode);
        this.updateUI();
    },

    // centraliza ajustes visuais para evitar duplicação
    syncVisuals(mode) {
        const sun = document.querySelector('.sun-background');
        const particles = document.getElementById('particles-js');
        const bg = document.getElementById('bg-fake-custom');
        if (sun) {
            if (mode === 'day') sun.style.opacity = '0.5';
            else if (mode === 'sunset') sun.style.opacity = '0.4';
            else sun.style.opacity = '0';
        }
        if (particles) {
            if (mode === 'day') particles.style.opacity = '0.1';
            else particles.style.opacity = '0.3';
        }
        if (bg) {
            if (mode === 'day') bg.style.opacity = '0.15';
            else bg.style.opacity = '0.2';
        }
    },
    
    cycleSolar() {
        this.state.isAutoSolar = false;
        localStorage.setItem(STORAGE.SOLAR_AUTO, 'false');
        if (this.state.solarMode === 'day') this.setMode('sunset');
        else if (this.state.solarMode === 'sunset') this.setMode('night');
        else this.setMode('day');
        this.announce(`Modo ${this.translateMode(this.state.solarMode)}`);
    },

    enableAutoSolar() {
        this.state.isAutoSolar = true;
        localStorage.setItem(STORAGE.SOLAR_AUTO, 'true');
        this.autoByTime();
        this.announce("Sincronização Automática.");
    },

    autoByTime() {
        if (!this.state.isAutoSolar) return;
        const h = new Date().getHours();
        let m = 'night';
        if (h >= 6 && h < 17) m = 'day';
        else if (h >= 17 && h < 19) m = 'sunset';
        else m = 'night';

        // sempre aplica o modo (corrige mismatch entre state e classe do body)
        this.setMode(m);
    },

    translateMode(m) {
        if(m==='day') return 'DIA';
        if(m==='sunset') return 'OCASO';
        return 'NOITE';
    },

    toggleField(forceState, silent = false) {
        const isOpen = forceState !== undefined ? forceState : !this.state.open;
        this.state.open = isOpen;
        
        const chat = document.getElementById('chat-container');
        chat.classList.toggle('collapsed', !isOpen);
        document.body.classList.toggle('field-closed', !isOpen);
        
        if (this.state.isProcessing) return;

        const msgs = this.state.messages.length;
        const type = isOpen ? (msgs > 5 ? 'estavel' : 'sustentado') : (msgs > 5 ? 'tecnico' : 'ritual');
        const text = getRandomText(FOOTER_TEXTS[isOpen ? 'open' : 'closed'][type]);
        
        const handle = document.getElementById('field-toggle-handle');
        handle.innerHTML = `<span class="footer-dot"></span> ${text}`;
        
        if (!silent) this.speakText(text);
        if (isOpen) chat.scrollTop = chat.scrollHeight;
    },

    updateUI() {
        const m = this.state.solarMode;
        const auto = this.state.isAutoSolar;
        const label = document.getElementById('statusSolarMode');
        const ind = document.getElementById('modeIndicator');
        const btnAuto = document.getElementById('btnAutoSolar');
        
        label.textContent = `${this.translateMode(m)} ${auto ? '(AUTO)' : '(MANUAL)'}`;
        label.style.color = auto ? 'var(--primary)' : 'orange';
        ind.textContent = `SISTEMA: ${this.translateMode(m)} // ${auto ? 'SYNC' : 'OVERRIDE'}`;
        btnAuto.style.opacity = auto ? '1' : '0.5';
        document.getElementById('usernameDisplay').textContent = document.getElementById('inputUserId').value;
    },

    bindEvents() {
        document.getElementById('btnSend').onclick = () => this.handleSend();
        document.getElementById('userInput').onkeypress = (e) => { if(e.key==='Enter') this.handleSend(); };
        document.getElementById('field-toggle-handle').onclick = () => this.toggleField(undefined, false);
        document.getElementById('orbToggle').onclick = () => { toggleDrawer('drawerProfile'); this.speakText("Cockpit Solar"); };
        document.getElementById('btnCrystallize').onclick = () => this.crystallizeSession();
        document.getElementById('btnCycleSolar').onclick = () => this.cycleSolar();
        document.getElementById('btnAutoSolar').onclick = () => { this.enableAutoSolar(); this.updateUI(); };
        
        document.getElementById('inputUserId').onchange = (e) => {
            localStorage.setItem(STORAGE.USER_NAME, e.target.value);
            this.updateUI();
            this.announce(`Identidade redefinida: ${e.target.value}`);
        };

        document.getElementById('inputModel').onchange = (e) => {
            localStorage.setItem(STORAGE.MODEL, e.target.value);
            this.updateUI();
            this.showToast("Modelo Atualizado");
        };

        document.getElementById('btnSaveConfig').onclick = () => {
            localStorage.setItem(STORAGE.API_KEY, document.getElementById('apiKeyInput').value);
            localStorage.setItem(STORAGE.SYSTEM_ROLE, document.getElementById('systemRoleInput').value);
            this.indexedDB.saveCustomCSS(document.getElementById('customCssInput').value);
            toggleDrawer('drawerSettings');
            this.announce("Configurações salvas.");
        };

        document.getElementById('bgUploadInput').onchange = (e) => this.indexedDB.handleBackgroundUpload(e.target.files[0]);
        document.getElementById('btnSettings').onclick = () => toggleDrawer('drawerSettings');
        document.getElementById('btnDeck').onclick = () => toggleDrawer('drawerDeck');
        document.getElementById('btnClearCss').onclick = () => this.indexedDB.clearAsset(STORAGE.CUSTOM_CSS);
        document.getElementById('btnVoice').onclick = () => this.toggleVoice();
        
        this.setupFileUpload();
    },

    showToast(msg, isError = false) {
        const t = document.getElementById('nv-toast');
        t.textContent = msg; 
        t.style.borderLeft = isError ? '4px solid #ff4444' : '4px solid var(--primary)';
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
        this.speakText(msg);
    },

    indexedDB: {
        dbName: "InfodoseDB",
        async getDB() {
            return new Promise((res, rej) => {
                const r = indexedDB.open("InfodoseDB", 2);
                r.onupgradeneeded = e => {
                    const db = e.target.result;
                    if(!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', {keyPath: 'id'});
                    if(!db.objectStoreNames.contains('deck')) db.createObjectStore('deck', {keyPath: 'id'});
                };
                r.onsuccess = e => res(e.target.result);
                r.onerror = e => rej(e);
            });
        },
        async putAsset(id, data) { const db = await this.getDB(); db.transaction(['assets'],'readwrite').objectStore('assets').put({id, ...data}); },
        async getAsset(id) { const db = await this.getDB(); return new Promise(r => { const q = db.transaction(['assets'],'readonly').objectStore('assets').get(id); q.onsuccess = () => r(q.result); }); },
        async clearAsset(id) { 
            const db = await this.getDB(); db.transaction(['assets'],'readwrite').objectStore('assets').delete(id);
            if(id === STORAGE.CUSTOM_CSS) { document.getElementById('custom-styles').textContent = ''; document.getElementById('customCssInput').value = ''; }
            if(id === STORAGE.BG_IMAGE) { document.getElementById('bg-fake-custom').style.backgroundImage = 'none'; document.getElementById('bgStatusText').textContent = 'Nenhum'; }
        },
        async handleBackgroundUpload(file) {
            if(!file) return;
            await this.putAsset(STORAGE.BG_IMAGE, {blob: file});
            this.loadBackground();
        },
        async loadBackground() {
            const d = await this.getAsset(STORAGE.BG_IMAGE);
            if(d && d.blob) {
                document.getElementById('bg-fake-custom').style.backgroundImage = `url('${URL.createObjectURL(d.blob)}')`;
                document.getElementById('bgStatusText').textContent = 'Ativo';
            }
        },
        async saveCustomCSS(css) { await this.putAsset(STORAGE.CUSTOM_CSS, {css}); this.loadCustomCSS(); },
        async loadCustomCSS() { 
            const d = await this.getAsset(STORAGE.CUSTOM_CSS); 
            if(d?.css) {
                document.getElementById('custom-styles').textContent = d.css;
                document.getElementById('customCssInput').value = d.css;
            }
        },
        async saveDeckItem(item) { const db = await this.getDB(); db.transaction(['deck'],'readwrite').objectStore('deck').put(item); },
        async getDeck() { const db = await this.getDB(); return new Promise(r => { const q = db.transaction(['deck'],'readonly').objectStore('deck').getAll(); q.onsuccess = () => r(q.result); }); },
        async deleteDeckItem(id) { const db = await this.getDB(); db.transaction(['deck'],'readwrite').objectStore('deck').delete(id); }
    }
};

const Utils = {
    copy(btn) { navigator.clipboard.writeText(btn.closest('.msg-block').innerText); App.showToast("Copiado para a área de transferência"); },
    speak(btn) { App.speakText(btn.closest('.msg-block').innerText.replace(/<[^>]*>?/gm, '')); },
    edit(btn) {
        const blk = btn.closest('.msg-block'); 
        const txt = blk.innerText.replace("content_copy", "").trim(); 
        document.getElementById('userInput').value = txt;
        blk.remove();
        App.speakText("Modo edição ativado");
    }
};

// --- DOWNLOAD UTILS ATUALIZADO (SVG + PDF SCALE + MARKDOWN) ---
const DownloadUtils = {
  _getBlock(btn) { return btn.closest('.msg-block'); },

  _getCleanHtml(block) {
    const clone = block.cloneNode(true);
    const tools = clone.querySelector('.msg-tools');
    if (tools) tools.remove();
    return clone.innerHTML;
  },

  _guessFilename(base, extFallback='txt') {
    const t = new Date().toISOString().replace(/[:.]/g,'-');
    if (!base) return `ai-output-${t}.${extFallback}`;
    if (/<\s*!doctype|<html|<body|<head/i.test(base)) return `ai-output-${t}.html`;
    if (/<pre|<code/i.test(base)) return `ai-code-${t}.${extFallback}`;
    return `ai-output-${t}.${extFallback}`;
  },

  downloadMessage(btn) {
    try {
      const block = this._getBlock(btn);
      if(!block) return;
      const content = this._getCleanHtml(block);
      const isHTML = /<\s*!doctype|<html|<body|<head|<\/div>/i.test(content);
      const mime = isHTML ? 'text/html' : 'text/plain';
      const ext = isHTML ? 'html' : 'txt';
      const filename = this._guessFilename(content, ext);
      const blob = new Blob([content], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      App.showToast(`Download iniciado: ${filename}`);
    } catch (e) {
      console.error(e);
      App.showToast('Erro ao gerar download', true);
    }
  },

  downloadMarkdown(btn) {
    try {
      const block = this._getBlock(btn);
      if(!block) return;
      const raw = block.dataset.raw || block.innerText || '';
      const filename = this._guessFilename(raw, 'md').replace(/\.(html|txt)$/, '.md');
      const blob = new Blob([raw], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      App.showToast(`Markdown salvo: ${filename}`);
    } catch (e) {
      console.error(e);
      App.showToast('Erro ao salvar .md', true);
    }
  },

  openSandbox(btn) {
    try {
      const block = this._getBlock(btn);
      if(!block) return;
      const content = this._getCleanHtml(block);
      let page = content;
      if(!/<\s*!doctype|<html/i.test(content)) {
        page = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sandbox - AI Output</title></head><body>${content}</body></html>`;
      }
      const blob = new Blob([page], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      App.showToast('Sandbox aberto em nova aba');
    } catch (e) {
      console.error(e);
      App.showToast('Erro ao abrir sandbox', true);
    }
  },

  async exportPdf(btn) {
    try {
      if(typeof html2pdf === 'undefined') {
        App.showToast('Biblioteca PDF indisponível. Abrindo sandbox...', true);
        return this.openSandbox(btn);
      }
      const block = this._getBlock(btn);
      if(!block) return;
      const content = this._getCleanHtml(block);

      const container = document.createElement('div');
      container.style.position = 'fixed'; container.style.left = '-9999px'; container.style.top = '0';
      container.style.width = '1100px'; container.style.padding = '20px'; container.style.background = '#ffffff';
      container.innerHTML = content;
      document.body.appendChild(container);

      const orientation = (container.scrollWidth > container.scrollHeight) ? 'landscape' : 'portrait';
      const filename = this._guessFilename(content, 'pdf').replace(/\.(html|txt)$/, '.pdf');

      await html2pdf().from(container).set({
        margin: [12, 12, 12, 12],
        filename: filename,
        html2canvas: { scale: 3, useCORS: true, logging: false },
        jsPDF: { unit: 'pt', format: 'a4', orientation: orientation }
      }).save();

      document.body.removeChild(container);
      App.showToast(`PDF gerado: ${filename}`);
    } catch (e) {
      console.error(e);
      App.showToast('Falha ao gerar PDF. Abrindo sandbox...', true);
      this.openSandbox(btn);
    }
  }
};

function toggleDrawer(id) { document.getElementById(id).classList.toggle('open'); }
window.onload = () => App.init();
</script>