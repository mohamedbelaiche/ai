/**
 * نبراس AI — OpenRouter AI Chatbot Engine
 * Handles streaming responses, chat history, markdown parsing, and settings.
 */

// ==========================================================================
// Default Settings & State Initialization
// ==========================================================================
const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'meta-llama/llama-3.3-70b-instruct:free',
  customModel: '',
  temperature: 0.7,
  systemPrompt: 'أنت مساعد ذكي ومفيد ولطيف وواسع المعرفة. تجيب بدقة وبأسلوب منظم وواضح، وتستخدم التنسيق المناسب (عناوين، نقاط، جداول، وأكواد برمجية) لتقديم أفضل تجربة للمستخدم.',
  endpointMode: 'auto',
  theme: 'dark',
  direction: 'rtl',
};

const MODEL_NAMES = {
  'meta-llama/llama-3.3-70b-instruct:free': 'Llama 3.3 70B (مجاني)',
  'google/gemini-2.0-flash-exp:free': 'Gemini 2.0 Flash (مجاني)',
  'deepseek/deepseek-r1:free': 'DeepSeek R1 (مجاني)',
  'deepseek/deepseek-chat': 'DeepSeek V3',
  'openai/gpt-4o-mini': 'GPT-4o Mini',
  'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet',
};

class ChatApp {
  constructor() {
    this.settings = this.loadSettings();
    this.conversations = this.loadConversations();
    this.currentChatId = null;
    this.abortController = null;
    this.isGenerating = false;

    // Cache DOM Elements
    this.initDOMElements();

    // Apply saved preferences (Theme, Direction, etc.)
    this.applyPreferences();

    // Configure Marked.js & Highlight.js
    this.configureMarkdown();

    // Attach Event Listeners
    this.bindEvents();

    // Initialize or load conversation
    this.initConversation();
  }

  // ==========================================================================
  // Storage & Persistence
  // ==========================================================================
  loadSettings() {
    try {
      const stored = localStorage.getItem('nibras_settings');
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.warn('Could not load settings from localStorage:', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('nibras_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Could not save settings to localStorage:', e);
    }
  }

  loadConversations() {
    try {
      const stored = localStorage.getItem('nibras_conversations');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Could not load conversations from localStorage:', e);
      return [];
    }
  }

  saveConversations() {
    try {
      localStorage.setItem('nibras_conversations', JSON.stringify(this.conversations));
    } catch (e) {
      console.warn('Could not save conversations to localStorage:', e);
    }
  }

  // ==========================================================================
  // DOM Cache
  // ==========================================================================
  initDOMElements() {
    this.dom = {
      appContainer: document.getElementById('appContainer'),
      sidebar: document.getElementById('sidebar'),
      sidebarOverlay: document.getElementById('sidebarOverlay'),
      toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
      closeSidebarBtn: document.getElementById('closeSidebarBtn'),
      newChatBtn: document.getElementById('newChatBtn'),
      chatHistoryList: document.getElementById('chatHistoryList'),
      clearAllHistoryBtn: document.getElementById('clearAllHistoryBtn'),
      sidebarModelName: document.getElementById('sidebarModelName'),
      sidebarSettingsBtn: document.getElementById('sidebarSettingsBtn'),

      // Topbar
      modelDropdownTrigger: document.getElementById('modelDropdownTrigger'),
      modelDropdownMenu: document.getElementById('modelDropdownMenu'),
      modelDropdownWrapper: document.querySelector('.model-selector-wrapper'),
      topbarModelName: document.getElementById('topbarModelName'),
      connectionStatus: document.getElementById('connectionStatus'),
      connectionStatusText: document.getElementById('connectionStatusText'),
      exportChatBtn: document.getElementById('exportChatBtn'),
      clearChatBtn: document.getElementById('clearChatBtn'),
      dirToggleBtn: document.getElementById('dirToggleBtn'),
      themeToggleBtn: document.getElementById('themeToggleBtn'),
      settingsBtn: document.getElementById('settingsBtn'),

      // Chat area
      chatContainer: document.getElementById('chatContainer'),
      welcomeScreen: document.getElementById('welcomeScreen'),
      messagesStream: document.getElementById('messagesStream'),
      scrollBottomBtn: document.getElementById('scrollBottomBtn'),
      chatInput: document.getElementById('chatInput'),
      tokenHint: document.getElementById('tokenHint'),
      stopGenerationBtn: document.getElementById('stopGenerationBtn'),
      sendBtn: document.getElementById('sendBtn'),

      // Settings Modal
      settingsModal: document.getElementById('settingsModal'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      apiKeyInput: document.getElementById('apiKeyInput'),
      toggleApiKeyVisibility: document.getElementById('toggleApiKeyVisibility'),
      modelSelect: document.getElementById('modelSelect'),
      customModelGroup: document.getElementById('customModelGroup'),
      customModelInput: document.getElementById('customModelInput'),
      temperatureSlider: document.getElementById('temperatureSlider'),
      tempValue: document.getElementById('tempValue'),
      systemPromptInput: document.getElementById('systemPromptInput'),
      endpointMode: document.getElementById('endpointMode'),

      // Toast
      toastContainer: document.getElementById('toastContainer'),
    };
  }

  // ==========================================================================
  // Markdown & Highlight Configuration
  // ==========================================================================
  configureMarkdown() {
    if (typeof marked !== 'undefined') {
      const renderer = new marked.Renderer();

      // Custom code renderer with language badge and Copy Code button
      renderer.code = (code, language) => {
        const validLang = language && hljs.getLanguage(language) ? language : 'plaintext';
        let highlighted = code;
        try {
          highlighted = hljs.highlight(code, { language: validLang }).value;
        } catch (e) {
          highlighted = hljs.highlightAuto(code).value;
        }

        const langDisplay = validLang.toUpperCase();
        return `
          <div class="code-block-wrapper">
            <div class="code-block-header">
              <span>${langDisplay}</span>
              <button class="copy-code-btn" onclick="window.chatApp.copyCodeSnippet(this)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>نسخ الكود</span>
              </button>
            </div>
            <pre><code class="hljs language-${validLang}">${highlighted}</code></pre>
          </div>
        `;
      };

      marked.setOptions({
        renderer: renderer,
        gfm: true,
        breaks: true,
      });
    }
  }

  // ==========================================================================
  // Preferences (Theme & Direction)
  // ==========================================================================
  applyPreferences() {
    document.documentElement.setAttribute('data-theme', this.settings.theme);
    document.documentElement.setAttribute('dir', this.settings.direction);
    document.documentElement.lang = this.settings.direction === 'rtl' ? 'ar' : 'en';

    this.updateModelLabels();
  }

  updateModelLabels() {
    const activeModel = this.settings.model === 'custom' ? (this.settings.customModel || 'Custom') : this.settings.model;
    const displayName = MODEL_NAMES[activeModel] || activeModel.split('/').pop();
    this.dom.topbarModelName.textContent = displayName;
    this.dom.sidebarModelName.textContent = displayName;

    // Highlight active in dropdown
    document.querySelectorAll('.model-item').forEach(el => {
      if (el.getAttribute('data-model') === this.settings.model) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  bindEvents() {
    // Sidebar
    this.dom.toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
    this.dom.closeSidebarBtn?.addEventListener('click', () => this.toggleSidebar(false));
    this.dom.sidebarOverlay?.addEventListener('click', () => this.toggleSidebar(false));
    this.dom.newChatBtn.addEventListener('click', () => this.createNewChat());
    this.dom.clearAllHistoryBtn.addEventListener('click', () => this.clearAllHistory());
    this.dom.sidebarSettingsBtn.addEventListener('click', () => this.openSettings());

    // Topbar Actions
    this.dom.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    this.dom.dirToggleBtn.addEventListener('click', () => this.toggleDirection());
    this.dom.settingsBtn.addEventListener('click', () => this.openSettings());
    this.dom.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
    this.dom.exportChatBtn.addEventListener('click', () => this.exportCurrentChat());

    // Model Selector Dropdown
    this.dom.modelDropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dom.modelDropdownWrapper.classList.toggle('open');
    });

    document.querySelectorAll('.model-item[data-model]').forEach(btn => {
      btn.addEventListener('click', () => {
        const model = btn.getAttribute('data-model');
        this.selectModel(model);
        this.dom.modelDropdownWrapper.classList.remove('open');
      });
    });

    const customBtn = document.getElementById('customModelBtn');
    if (customBtn) {
      customBtn.addEventListener('click', () => {
        this.dom.modelDropdownWrapper.classList.remove('open');
        this.openSettings('custom');
      });
    }

    document.addEventListener('click', (e) => {
      if (!this.dom.modelDropdownWrapper.contains(e.target)) {
        this.dom.modelDropdownWrapper.classList.remove('open');
      }
    });

    // Chat Suggestions
    document.querySelectorAll('.suggestion-card').forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        if (prompt) {
          this.dom.chatInput.value = prompt;
          this.sendMessage();
        }
      });
    });

    // Textarea Auto-expand & Keybindings
    this.dom.chatInput.addEventListener('input', () => this.handleTextareaInput());
    this.dom.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Send & Stop buttons
    this.dom.sendBtn.addEventListener('click', () => this.sendMessage());
    this.dom.stopGenerationBtn.addEventListener('click', () => this.stopGeneration());

    // Scroll to bottom button
    this.dom.chatContainer.addEventListener('scroll', () => {
      const scrollPos = this.dom.chatContainer.scrollHeight - this.dom.chatContainer.scrollTop - this.dom.chatContainer.clientHeight;
      if (scrollPos > 120) {
        this.dom.scrollBottomBtn.classList.add('visible');
      } else {
        this.dom.scrollBottomBtn.classList.remove('visible');
      }
    });

    this.dom.scrollBottomBtn.addEventListener('click', () => {
      this.scrollToBottom(true);
    });

    // Settings Modal
    this.dom.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
    this.dom.cancelSettingsBtn.addEventListener('click', () => this.closeSettings());
    this.dom.saveSettingsBtn.addEventListener('click', () => this.saveSettingsFromModal());
    this.dom.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.dom.settingsModal) this.closeSettings();
    });

    this.dom.toggleApiKeyVisibility.addEventListener('click', () => {
      const isPassword = this.dom.apiKeyInput.type === 'password';
      this.dom.apiKeyInput.type = isPassword ? 'text' : 'password';
    });

    this.dom.modelSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        this.dom.customModelGroup.classList.remove('hidden');
      } else {
        this.dom.customModelGroup.classList.add('hidden');
      }
    });

    this.dom.temperatureSlider.addEventListener('input', (e) => {
      this.dom.tempValue.textContent = e.target.value;
    });
  }

  // ==========================================================================
  // Conversations Management
  // ==========================================================================
  initConversation() {
    if (this.conversations.length > 0) {
      this.loadChatSession(this.conversations[0].id);
    } else {
      this.createNewChat(false);
    }
    this.renderHistoryList();
  }

  createNewChat(render = true) {
    if (this.isGenerating) this.stopGeneration();

    const newChat = {
      id: 'chat_' + Date.now(),
      title: 'محادثة جديدة',
      createdAt: new Date().toISOString(),
      messages: [],
    };

    this.conversations.unshift(newChat);
    this.currentChatId = newChat.id;
    this.saveConversations();

    if (render) {
      this.renderCurrentChat();
      this.renderHistoryList();
      this.toggleSidebar(false);
      this.dom.chatInput.focus();
    }
  }

  getCurrentChat() {
    return this.conversations.find(c => c.id === this.currentChatId);
  }

  loadChatSession(id) {
    if (this.isGenerating) this.stopGeneration();

    this.currentChatId = id;
    this.renderCurrentChat();
    this.renderHistoryList();
    this.toggleSidebar(false);
  }

  deleteChat(id, e) {
    if (e) e.stopPropagation();

    this.conversations = this.conversations.filter(c => c.id !== id);
    this.saveConversations();

    if (this.currentChatId === id) {
      if (this.conversations.length > 0) {
        this.currentChatId = this.conversations[0].id;
      } else {
        this.createNewChat(false);
      }
    }

    this.renderCurrentChat();
    this.renderHistoryList();
    this.showToast('تم حذف المحادثة', 'info');
  }

  clearCurrentChat() {
    const current = this.getCurrentChat();
    if (!current || current.messages.length === 0) return;

    if (confirm('هل أنت متأكد من رغبتك في مسح رسائل هذه المحادثة؟')) {
      current.messages = [];
      this.saveConversations();
      this.renderCurrentChat();
      this.showToast('تم مسح الرسائل', 'info');
    }
  }

  clearAllHistory() {
    if (this.conversations.length === 0) return;
    if (confirm('هل أنت متأكد من حذف كافة المحادثات السابقة؟ لا يمكن التراجع عن هذا الإجراء.')) {
      this.conversations = [];
      this.saveConversations();
      this.createNewChat(true);
      this.showToast('تم حذف كافة المحادثات', 'info');
    }
  }

  renderHistoryList() {
    this.dom.chatHistoryList.innerHTML = '';

    if (this.conversations.length === 0) {
      this.dom.chatHistoryList.innerHTML = `<div class="history-empty-hint">لا توجد محادثات سابقة بعد</div>`;
      return;
    }

    this.conversations.forEach(chat => {
      const item = document.createElement('div');
      item.className = `history-item ${chat.id === this.currentChatId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="history-title" title="${this.escapeHtml(chat.title)}">${this.escapeHtml(chat.title)}</span>
        <div class="history-actions">
          <button class="history-del-btn" title="حذف المحادثة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      item.addEventListener('click', () => this.loadChatSession(chat.id));
      const delBtn = item.querySelector('.history-del-btn');
      delBtn.addEventListener('click', (e) => this.deleteChat(chat.id, e));

      this.dom.chatHistoryList.appendChild(item);
    });
  }

  // ==========================================================================
  // Chat Rendering
  // ==========================================================================
  renderCurrentChat() {
    const current = this.getCurrentChat();
    this.dom.messagesStream.innerHTML = '';

    if (!current || current.messages.length === 0) {
      this.dom.welcomeScreen.classList.remove('hidden');
      return;
    }

    this.dom.welcomeScreen.classList.add('hidden');

    current.messages.forEach(msg => {
      this.appendMessageElement(msg.role, msg.content, false);
    });

    this.scrollToBottom();
  }

  appendMessageElement(role, content, animate = true) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;

    const isUser = role === 'user';
    const avatar = isUser ? `
      <div class="message-avatar" title="أنت">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
    ` : `
      <div class="message-avatar" title="نبراس AI">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
      </div>
    `;

    const htmlContent = isUser ? this.escapeHtml(content).replace(/\n/g, '<br>') : this.parseMarkdown(content);

    wrapper.innerHTML = `
      ${avatar}
      <div class="message-bubble">
        <div class="message-text">${htmlContent}</div>
        <div class="message-actions">
          <button class="msg-action-btn copy-msg-btn" title="نسخ الرسالة" onclick="window.chatApp.copyMessageText(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>نسخ</span>
          </button>
          ${!isUser ? `
            <button class="msg-action-btn regen-btn" title="إعادة التوليد" onclick="window.chatApp.regenerateLastResponse()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
              <span>إعادة</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    this.dom.messagesStream.appendChild(wrapper);
    if (animate) this.scrollToBottom(true);

    return wrapper;
  }

  // ==========================================================================
  // Send & Stream Message Engine
  // ==========================================================================
  async sendMessage() {
    const text = this.dom.chatInput.value.trim();
    if (!text || this.isGenerating) return;

    // Hide Welcome Screen
    this.dom.welcomeScreen.classList.add('hidden');

    const current = this.getCurrentChat();
    if (!current) return;

    // Auto Title Generation for Chat from first message
    if (current.messages.length === 0) {
      const words = text.split(/\s+/).slice(0, 6).join(' ');
      current.title = words + (text.split(/\s+/).length > 6 ? '...' : '');
      this.renderHistoryList();
    }

    // Add user message to state & UI
    const userMsg = { role: 'user', content: text, timestamp: Date.now() };
    current.messages.push(userMsg);
    this.appendMessageElement('user', text);

    // Reset textarea
    this.dom.chatInput.value = '';
    this.handleTextareaInput();

    // Prepare Bot message placeholder
    const botMsgWrapper = this.appendMessageElement('bot', '');
    const botBubble = botMsgWrapper.querySelector('.message-text');
    const streamingCursor = document.createElement('span');
    streamingCursor.className = 'streaming-cursor';
    botBubble.appendChild(streamingCursor);

    // Set Generating state
    this.setGenerating(true);

    let fullBotReply = '';

    try {
      // Build conversation payload
      const messagesPayload = [];

      // System Prompt
      if (this.settings.systemPrompt.trim()) {
        messagesPayload.push({
          role: 'system',
          content: this.settings.systemPrompt.trim(),
        });
      }

      // History Context (last 10 messages)
      const contextMessages = current.messages.slice(-10);
      messagesPayload.push(...contextMessages.map(m => ({ role: m.role, content: m.content })));

      // Model determination
      const selectedModel = this.settings.model === 'custom' 
        ? (this.settings.customModel.trim() || 'meta-llama/llama-3.3-70b-instruct:free')
        : this.settings.model;

      // Abort controller for cancellation
      this.abortController = new AbortController();

      // Determine Endpoint
      const response = await this.executeChatRequest(messagesPayload, selectedModel, this.abortController.signal);

      if (!response.ok) {
        let errMessage = `خطأ ${response.status}: فشل الاتصال بالنموذج`;
        try {
          const errData = await response.json();
          if (errData.error) {
            errMessage = typeof errData.error === 'string' ? errData.error : (errData.error.message || JSON.stringify(errData.error));
          }
        } catch (_) {
          const errText = await response.text();
          if (errText) errMessage = errText;
        }
        throw new Error(errMessage);
      }

      // Read SSE Stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // save incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') break;

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const token = data.choices?.[0]?.delta?.content || '';
              if (token) {
                fullBotReply += token;
                botBubble.innerHTML = this.parseMarkdown(fullBotReply);
                botBubble.appendChild(streamingCursor);
                this.scrollToBottom();
              }
            } catch (err) {
              // Partial JSON or heartbeat chunk, continue
            }
          }
        }
      }

      // Completed successfully
      streamingCursor.remove();
      botBubble.innerHTML = this.parseMarkdown(fullBotReply);

      // Save to chat state
      current.messages.push({
        role: 'assistant',
        content: fullBotReply,
        timestamp: Date.now(),
      });
      this.saveConversations();

      this.setStatus('جاهز', 'ready');
    } catch (err) {
      streamingCursor.remove();
      if (err.name === 'AbortError') {
        if (fullBotReply) {
          current.messages.push({
            role: 'assistant',
            content: fullBotReply + '\n\n*(تم إيقاف التوليد)*',
            timestamp: Date.now(),
          });
          this.saveConversations();
          botBubble.innerHTML = this.parseMarkdown(fullBotReply + '\n\n*(تم إيقاف التوليد)*');
        } else {
          botBubble.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">تم إيقاف التوليد بواسطة المستخدم.</span>';
        }
        this.setStatus('تم الإيقاف', 'ready');
      } else {
        console.error('Chat error:', err);
        const errorHtml = `
          <div style="color:var(--status-danger); padding:8px; background:rgba(239, 68, 68, 0.1); border-radius:8px; border:1px solid rgba(239, 68, 68, 0.2);">
            <strong>حدث خطأ أثناء المحادثة:</strong><br>
            ${this.escapeHtml(err.message || 'فشل الاتصال بالخادم')}
            <br><small style="color:var(--text-muted)">تحقق من إدخال مفتاح API في الإعدادات أو تعيين OPENROUTER_API_KEY على Vercel.</small>
          </div>
        `;
        botBubble.innerHTML = errorHtml;
        this.setStatus('خطأ في الاتصال', 'error');
        this.showToast(err.message || 'حدث خطأ في الاتصال', 'error');
      }
    } finally {
      this.setGenerating(false);
      this.abortController = null;
      this.scrollToBottom(true);
    }
  }

  /**
   * Smart request router:
   * 1. Mode 'proxy': uses /api/chat
   * 2. Mode 'direct': calls openrouter.ai directly using apiKey
   * 3. Mode 'auto': attempts /api/chat first. If unreachable (e.g. running statically without Vercel backend), falls back to direct OpenRouter call.
   */
  async executeChatRequest(messages, model, signal) {
    const payload = {
      model: model,
      messages: messages,
      stream: true,
      temperature: parseFloat(this.settings.temperature) || 0.7,
      apiKey: this.settings.apiKey.trim() || undefined,
    };

    const directOpenRouter = () => {
      const key = this.settings.apiKey.trim();
      if (!key) {
        throw new Error('يرجى إدخال مفتاح OpenRouter API في شاشة الإعدادات للتمكن من الدردشة.');
      }
      return fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'نبراس AI — OpenRouter Chatbot',
        },
        body: JSON.stringify({
          model: payload.model,
          messages: payload.messages,
          stream: true,
          temperature: payload.temperature,
        }),
        signal: signal,
      });
    };

    if (this.settings.endpointMode === 'direct') {
      return directOpenRouter();
    }

    if (this.settings.endpointMode === 'proxy') {
      return fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: signal,
      });
    }

    // Auto Mode: Try Vercel Serverless /api/chat first
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: signal,
      });

      // If /api/chat exists (even with 401 error), return it
      if (res.status !== 404) {
        return res;
      }
      // If 404 (local static file without Vercel CLI), fallback to direct
      console.info('/api/chat not found (static environment). Falling back to direct client-side OpenRouter call.');
      return directOpenRouter();
    } catch (e) {
      // Network failure reaching /api/chat, try direct
      if (this.settings.apiKey.trim()) {
        return directOpenRouter();
      }
      throw e;
    }
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  regenerateLastResponse() {
    const current = this.getCurrentChat();
    if (!current || current.messages.length === 0 || this.isGenerating) return;

    // Pop the last assistant message
    const lastMsg = current.messages[current.messages.length - 1];
    if (lastMsg.role === 'assistant') {
      current.messages.pop();
      this.saveConversations();
      this.renderCurrentChat();
    }

    // Retrigger with last user prompt
    const lastUserMsg = current.messages[current.messages.length - 1];
    if (lastUserMsg && lastUserMsg.role === 'user') {
      // Re-trigger by popping user msg and setting input
      current.messages.pop();
      this.dom.chatInput.value = lastUserMsg.content;
      this.sendMessage();
    }
  }

  // ==========================================================================
  // Helper UI Methods
  // ==========================================================================
  setGenerating(isGenerating) {
    this.isGenerating = isGenerating;
    this.dom.sendBtn.disabled = isGenerating;
    if (isGenerating) {
      this.dom.stopGenerationBtn.classList.remove('hidden');
      this.dom.sendBtn.classList.add('hidden');
      this.setStatus('جاري التفكير والتوليد...', 'loading');
    } else {
      this.dom.stopGenerationBtn.classList.add('hidden');
      this.dom.sendBtn.classList.remove('hidden');
      this.setStatus('جاهز', 'ready');
    }
  }

  setStatus(text, state = 'ready') {
    this.dom.connectionStatusText.textContent = text;
    this.dom.connectionStatus.className = `connection-status ${state}`;
  }

  handleTextareaInput() {
    const textarea = this.dom.chatInput;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${newHeight}px`;

    const length = textarea.value.length;
    this.dom.tokenHint.textContent = length > 0 ? `${length} حرف` : 'جاهز للكتابة';
  }

  scrollToBottom(smooth = false) {
    const container = this.dom.chatContainer;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  toggleSidebar(forceState) {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const isOpen = forceState !== undefined ? forceState : !this.dom.sidebar.classList.contains('open');
      this.dom.sidebar.classList.toggle('open', isOpen);
      this.dom.sidebarOverlay.classList.toggle('active', isOpen);
    } else {
      const isClosed = forceState !== undefined ? !forceState : !this.dom.sidebar.classList.contains('closed');
      this.dom.sidebar.classList.toggle('closed', isClosed);
    }
  }

  toggleTheme() {
    this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
    this.saveSettings();
    this.applyPreferences();
    this.showToast(`تم التبديل إلى المظهر ${this.settings.theme === 'dark' ? 'الداكن' : 'الفاتح'}`, 'info');
  }

  toggleDirection() {
    this.settings.direction = this.settings.direction === 'rtl' ? 'ltr' : 'rtl';
    this.saveSettings();
    this.applyPreferences();
    this.showToast(`تم تغيير الاتجاه إلى: ${this.settings.direction.toUpperCase()}`, 'info');
  }

  selectModel(model) {
    this.settings.model = model;
    this.saveSettings();
    this.updateModelLabels();
    this.showToast(`تم اختيار النموذج: ${MODEL_NAMES[model] || model}`, 'success');
  }

  // ==========================================================================
  // Settings Modal Handlers
  // ==========================================================================
  openSettings(focusTab) {
    this.dom.apiKeyInput.value = this.settings.apiKey;
    this.dom.modelSelect.value = this.settings.model;
    this.dom.customModelInput.value = this.settings.customModel || '';
    this.dom.temperatureSlider.value = this.settings.temperature;
    this.dom.tempValue.textContent = this.settings.temperature;
    this.dom.systemPromptInput.value = this.settings.systemPrompt;
    this.dom.endpointMode.value = this.settings.endpointMode;

    if (this.settings.model === 'custom' || focusTab === 'custom') {
      this.dom.modelSelect.value = 'custom';
      this.dom.customModelGroup.classList.remove('hidden');
      if (focusTab === 'custom') this.dom.customModelInput.focus();
    } else {
      this.dom.customModelGroup.classList.add('hidden');
    }

    this.dom.settingsModal.classList.add('open');
  }

  closeSettings() {
    this.dom.settingsModal.classList.remove('open');
  }

  saveSettingsFromModal() {
    this.settings.apiKey = this.dom.apiKeyInput.value.trim();
    this.settings.model = this.dom.modelSelect.value;
    this.settings.customModel = this.dom.customModelInput.value.trim();
    this.settings.temperature = parseFloat(this.dom.temperatureSlider.value) || 0.7;
    this.settings.systemPrompt = this.dom.systemPromptInput.value;
    this.settings.endpointMode = this.dom.endpointMode.value;

    this.saveSettings();
    this.updateModelLabels();
    this.closeSettings();
    this.showToast('تم حفظ الإعدادات بنجاح', 'success');
  }

  // ==========================================================================
  // Export & Copy Helpers
  // ==========================================================================
  exportCurrentChat() {
    const current = this.getCurrentChat();
    if (!current || current.messages.length === 0) {
      this.showToast('لا توجد رسائل لتصديرها في هذه المحادثة', 'error');
      return;
    }

    let textContent = `# ${current.title}\n`;
    textContent += `التاريخ: ${new Date(current.createdAt).toLocaleString('ar-EG')}\n`;
    textContent += `النموذج: ${this.settings.model}\n\n---\n\n`;

    current.messages.forEach(msg => {
      const sender = msg.role === 'user' ? 'المستخدم' : 'نبراس AI';
      textContent += `### ${sender}:\n${msg.content}\n\n`;
    });

    const blob = new Blob([textContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${current.title.replace(/[\/\\?%*:|"<>]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('تم تصدير المحادثة كملف Markdown', 'success');
  }

  copyMessageText(button) {
    const bubble = button.closest('.message-bubble');
    const textEl = bubble.querySelector('.message-text');
    const text = textEl.innerText;

    navigator.clipboard.writeText(text).then(() => {
      this.showToast('تم نسخ نص الرسالة', 'success');
    }).catch(() => {
      this.showToast('فشل النسخ إلى الحافظة', 'error');
    });
  }

  copyCodeSnippet(button) {
    const codeBlock = button.closest('.code-block-wrapper');
    const code = codeBlock.querySelector('code').innerText;

    navigator.clipboard.writeText(code).then(() => {
      const span = button.querySelector('span');
      const original = span.textContent;
      span.textContent = 'تم النسخ!';
      button.style.color = 'var(--status-success)';

      setTimeout(() => {
        span.textContent = original;
        button.style.color = '';
      }, 2000);
    }).catch(() => {
      this.showToast('فشل نسخ الكود', 'error');
    });
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  parseMarkdown(text) {
    if (typeof marked !== 'undefined') {
      const rawHtml = marked.parse(text);
      if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(rawHtml);
      }
      return rawHtml;
    }
    return this.escapeHtml(text);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.chatApp = new ChatApp();
});
