/**
 * 国际化（i18n）模块
 * =================
 * 
 * 处理多语言支持和界面文本翻译
 * 从后端 /api/translations 加载翻译数据
 */

class I18nManager {
    constructor() {
        this.currentLanguage = this.getDefaultLanguage();
        this.translations = {};
        this.loadingPromise = null;
    }
    
    getDefaultLanguage() {
        // 1. 先检查本地保存的设置
        const savedLanguage = localStorage.getItem('language');
        if (savedLanguage && ['zh-TW', 'zh-CN', 'en'].includes(savedLanguage)) {
            console.log('🌐 使用保存的语言设置:', savedLanguage);
            return savedLanguage;
        }
        
        // 2. 检查浏览器语言
        const browserLang = navigator.language || navigator.userLanguage;
        console.log('🌐 浏览器语言:', browserLang);
        
        if (browserLang.startsWith('zh-TW') || browserLang.includes('Hant')) {
            console.log('🌐 侦测到繁体中文环境');
            return 'zh-TW';
        }
        if (browserLang.startsWith('zh') || browserLang.includes('Hans')) {
            console.log('🌐 侦测到简体中文环境');
            return 'zh-CN';
        }
        if (browserLang.startsWith('en')) {
            console.log('🌐 侦测到英文环境');
            return 'en';
        }
        
        // 3. 缺省使用繁体中文
        console.log('🌐 使用缺省语言: zh-TW');
        return 'zh-TW';
    }

    async init() {
        console.log(`i18nManager 使用缺省语言: ${this.currentLanguage}`);

        // 加载翻译数据
        await this.loadTranslations();

        // 应用翻译
        this.applyTranslations();

        // 设置语言选择器
        this.setupLanguageSelectors();

        // 延迟一点再更新动态内容，确保应用程序已初始化
        setTimeout(() => {
            this.updateDynamicContent();
        }, 100);
    }

    async loadTranslations() {
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = fetch('/api/translations')
            .then(response => response.json())
            .then(data => {
                this.translations = data;
                console.log('翻译数据加载完成:', Object.keys(this.translations));
                
                // 检查当前语言是否有翻译数据
                if (!this.translations[this.currentLanguage] || Object.keys(this.translations[this.currentLanguage]).length === 0) {
                    console.warn(`当前语言 ${this.currentLanguage} 没有翻译数据，回退到 zh-TW`);
                    this.currentLanguage = 'zh-TW';
                }
            })
            .catch(error => {
                console.error('加载翻译数据失败:', error);
                // 使用最小的回退翻译
                this.translations = this.getMinimalFallbackTranslations();
            });

        return this.loadingPromise;
    }

    getMinimalFallbackTranslations() {
        // 最小的回退翻译，只包含关键项目
        return {
            'zh-TW': {
                'app': {
                    'title': 'MCP Feedback Enhanced',
                    'projectDirectory': '项目目录'
                },
                'tabs': {
                    'feedback': '💬 回馈',
                    'summary': '📋 AI 摘要',
                    'command': '⚡ 命令',
                    'settings': '⚙️ 设置'
                },
                'buttons': {
                    'cancel': '❌ 取消',
                    'submit': '✅ 提交回馈'
                },
                'settings': {
                    'language': '语言'
                }
            }
        };
    }

    // 支持嵌套键值的翻译函数，支持参数替换
    t(key, params = {}) {
        const langData = this.translations[this.currentLanguage] || {};
        let translation = this.getNestedValue(langData, key);

        // 如果没有找到翻译，返回默认值或键名
        if (!translation) {
            return typeof params === 'string' ? params : key;
        }

        // 如果 params 是字符串，当作默认值处理（向后兼容）
        if (typeof params === 'string') {
            return translation;
        }

        // 参数替换：将 {key} 替换为对应的值
        if (typeof params === 'object' && params !== null) {
            Object.keys(params).forEach(paramKey => {
                const placeholder = `{${paramKey}}`;
                translation = translation.replace(new RegExp(placeholder, 'g'), params[paramKey]);
            });
        }

        return translation;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    setLanguage(language) {
        console.log(`🔄 i18nManager.setLanguage() 被调用: ${this.currentLanguage} -> ${language}`);
        if (this.translations[language]) {
            this.currentLanguage = language;
            this.applyTranslations();

            // 更新所有语言选择器（包括现代化版本）
            this.setupLanguageSelectors();

            // 更新 HTML lang 属性
            document.documentElement.lang = language;

            console.log(`✅ i18nManager 语言已切换到: ${language}`);
        } else {
            console.warn(`❌ i18nManager 不支持的语言: ${language}`);
        }
    }

    applyTranslations() {
        // 翻译所有有 data-i18n 属性的元素
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.textContent = translation;
            }
        });

        // 翻译有 data-i18n-placeholder 属性的元素
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.placeholder = translation;
            }
        });

        // 翻译有 data-i18n-title 属性的元素
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.title = translation;
            }
        });

        // 翻译有 data-i18n-aria-label 属性的元素
        const ariaLabelElements = document.querySelectorAll('[data-i18n-aria-label]');
        ariaLabelElements.forEach(element => {
            const key = element.getAttribute('data-i18n-aria-label');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.setAttribute('aria-label', translation);
            }
        });

        // 更新动态内容
        this.updateDynamicContent();

        // 更新音效选择器翻译
        this.updateAudioSelectTranslations();

        console.log('翻译已应用:', this.currentLanguage);
    }

    updateDynamicContent() {
        // 只更新终端欢迎信息，不要覆盖 AI 摘要
        this.updateTerminalWelcome();

        // 更新会话管理相关的动态内容
        this.updateSessionManagementContent();

        // 更新连接监控相关的动态内容
        this.updateConnectionMonitorContent();

        // 更新提示词按钮文本
        this.updatePromptInputButtons();

        // 更新应用程序中的动态状态文本（使用新的模块化架构）
        if (window.feedbackApp && window.feedbackApp.isInitialized) {
            // 更新 UI 状态
            if (window.feedbackApp.uiManager && typeof window.feedbackApp.uiManager.updateUIState === 'function') {
                window.feedbackApp.uiManager.updateUIState();
            }

            if (window.feedbackApp.uiManager && typeof window.feedbackApp.uiManager.updateStatusIndicator === 'function') {
                window.feedbackApp.uiManager.updateStatusIndicator();
            }


        }
    }

    updateTerminalWelcome() {
        const commandOutput = document.getElementById('commandOutput');
        if (commandOutput && window.feedbackApp && window.feedbackApp.isInitialized) {
            const welcomeTemplate = this.t('dynamic.terminalWelcome');
            if (welcomeTemplate && welcomeTemplate !== 'dynamic.terminalWelcome') {
                // 使用 currentSessionId 而不是 sessionId
                const sessionId = window.feedbackApp.currentSessionId || window.feedbackApp.sessionId || 'unknown';
                const welcomeMessage = welcomeTemplate.replace('{sessionId}', sessionId);
                commandOutput.textContent = welcomeMessage;
            }
        }
    }

    updateSessionManagementContent() {
        // 更新会话管理面板中的动态文本
        if (window.feedbackApp && window.feedbackApp.sessionManager) {
            // 触发会话管理器重新渲染，这会使用最新的翻译
            if (typeof window.feedbackApp.sessionManager.updateDisplay === 'function') {
                window.feedbackApp.sessionManager.updateDisplay();
            }

            // 重新渲染统计信息以更新时间单位
            if (window.feedbackApp.sessionManager.dataManager &&
                window.feedbackApp.sessionManager.uiRenderer) {
                const stats = window.feedbackApp.sessionManager.dataManager.getStats();
                window.feedbackApp.sessionManager.uiRenderer.renderStats(stats);
                console.log('🌐 已更新统计信息的语言显示');
                
                // 重新渲染会话历史以更新所有动态创建的元素
                const sessionHistory = window.feedbackApp.sessionManager.dataManager.getSessionHistory();
                window.feedbackApp.sessionManager.uiRenderer.renderSessionHistory(sessionHistory);
                console.log('🌐 已更新会话历史的语言显示');
            }
        }

        // 更新状态徽章文本
        const statusBadges = document.querySelectorAll('.status-badge');
        statusBadges.forEach(badge => {
            const statusClass = Array.from(badge.classList).find(cls =>
                ['waiting', 'active', 'completed', 'error', 'connecting', 'connected', 'disconnected'].includes(cls)
            );
            if (statusClass && window.MCPFeedback && window.MCPFeedback.Utils && window.MCPFeedback.Utils.Status) {
                badge.textContent = window.MCPFeedback.Utils.Status.getStatusText(statusClass);
            }
        });
    }

    updateConnectionMonitorContent() {
        // 更新连接监控器中的动态文本
        if (window.feedbackApp && window.feedbackApp.connectionMonitor) {
            // 触发连接监控器重新更新显示
            if (typeof window.feedbackApp.connectionMonitor.updateDisplay === 'function') {
                window.feedbackApp.connectionMonitor.updateDisplay();
            }
        }

        // 更新连接状态文本
        const statusText = document.querySelector('.status-text');
        if (statusText && window.MCPFeedback && window.MCPFeedback.Utils && window.MCPFeedback.Utils.Status) {
            // 从元素的类名或数据属性中获取状态
            const indicator = statusText.closest('.connection-indicator');
            if (indicator) {
                const statusClass = Array.from(indicator.classList).find(cls =>
                    ['connecting', 'connected', 'disconnected', 'reconnecting'].includes(cls)
                );
                if (statusClass) {
                    statusText.textContent = window.MCPFeedback.Utils.Status.getConnectionStatusText(statusClass);
                }
            }
        }
    }

    updatePromptInputButtons() {
        // 更新提示词输入按钮的文本和状态
        if (window.feedbackApp && window.feedbackApp.promptInputButtons) {
            // 触发提示词按钮更新文本
            if (typeof window.feedbackApp.promptInputButtons.updateButtonTexts === 'function') {
                window.feedbackApp.promptInputButtons.updateButtonTexts();
            }
            // 触发提示词按钮更新状态（包括 tooltip）
            if (typeof window.feedbackApp.promptInputButtons.updateButtonStates === 'function') {
                window.feedbackApp.promptInputButtons.updateButtonStates();
            }
        }
    }

    setupLanguageSelectors() {
        // 设置页签的下拉选择器
        const selector = document.getElementById('settingsLanguageSelect');
        if (selector) {
            // 只设置当前值，不绑定事件（让 SettingsManager 统一处理）
            selector.value = this.currentLanguage;
            console.log(`🔧 setupLanguageSelectors: 设置 select.value = ${this.currentLanguage}`);
            
            // 不再绑定事件监听器，避免与 SettingsManager 冲突
            // 事件处理完全交由 SettingsManager 负责
        }

        // 新版现代化语言选择器
        const languageOptions = document.querySelectorAll('.language-option');
        if (languageOptions.length > 0) {
            // 只设置当前语言的活跃状态，不绑定事件
            languageOptions.forEach(option => {
                const lang = option.getAttribute('data-lang');
                if (lang === this.currentLanguage) {
                    option.classList.add('active');
                } else {
                    option.classList.remove('active');
                }
            });
            // 事件监听器由 SettingsManager 统一处理，避免重复绑定
        }
    }

    updateAudioSelectTranslations() {
        // 更新音效设置区域的所有翻译
        if (window.feedbackApp && window.feedbackApp.audioSettingsUI) {
            if (typeof window.feedbackApp.audioSettingsUI.updateTranslations === 'function') {
                window.feedbackApp.audioSettingsUI.updateTranslations();
            }
        }
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getAvailableLanguages() {
        return Object.keys(this.translations);
    }
}

// 创建全域实例
window.i18nManager = new I18nManager(); 