/**
 * MCP Feedback Enhanced - 设置管理模块
 * ==================================
 * 
 * 处理应用程序设置的加载、保存和同步
 */

(function() {
    'use strict';

    // 确保命名空间和依赖存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    // 创建模块专用日志器
    const logger = window.MCPFeedback.Logger ?
        new window.MCPFeedback.Logger({ moduleName: 'SettingsManager' }) :
        console;

    /**
     * 设置管理器建构函数
     */
    function SettingsManager(options) {
        options = options || {};
        
        // 从 i18nManager 获取当前语言作为默认值
        const defaultLanguage = window.i18nManager ? window.i18nManager.getCurrentLanguage() : 'zh-TW';
        
        // 缺省设置
        this.defaultSettings = {
            layoutMode: 'combined-vertical',
            autoClose: false,
            language: defaultLanguage,  // 使用 i18nManager 的当前语言
            imageStorageMode: 'file',
            imageSizeLimit: 0,
            enableBase64Detail: false,
            // 移除 activeTab - 页签切换无需持久化
            sessionPanelCollapsed: false,
            // 自动定时提交设置
            autoSubmitEnabled: false,
            autoSubmitTimeout: 30,
            autoSubmitPromptId: null,
            // 音效通知设置
            audioNotificationEnabled: false,
            audioNotificationVolume: 50,
            selectedAudioId: 'default-beep',
            customAudios: [],
            // 会话历史设置
            sessionHistoryRetentionHours: 72,
            // 系统提示词设置
            systemPromptEnabled: false,
            systemPromptContent: '',
            // 用户消息记录设置
            userMessageRecordingEnabled: true,
            userMessagePrivacyLevel: 'full', // 'full', 'basic', 'disabled'
            // UI 元素尺寸设置
            combinedFeedbackTextHeight: 150, // combinedFeedbackText textarea 的高度（px）
            // 会话超时设置
            sessionTimeoutEnabled: false,  // 缺省关闭
            sessionTimeoutSeconds: 3600,   // 缺省 1 小时（秒）
            // 自动运行命令设置
            autoCommandEnabled: true,      // 是否激活自动运行命令
            commandOnNewSession: '',       // 新会话创建时运行的命令
            commandOnFeedbackSubmit: ''    // 提交回馈后运行的命令
        };
        
        // 当前设置
        this.currentSettings = Utils.deepClone(this.defaultSettings);
        
        // 回调函数
        this.onSettingsChange = options.onSettingsChange || null;
        this.onLanguageChange = options.onLanguageChange || null;
        this.onAutoSubmitStateChange = options.onAutoSubmitStateChange || null;

        console.log('✅ SettingsManager 建构函数初始化完成 - 即时保存模式');
    }

    /**
     * 加载设置
     */
    SettingsManager.prototype.loadSettings = function() {
        const self = this;
        
        return new Promise(function(resolve, reject) {
            logger.info('开始加载设置...');

            // 只从服务器端加载设置
            self.loadFromServer()
                .then(function(serverSettings) {
                    if (serverSettings && Object.keys(serverSettings).length > 0) {
                        self.currentSettings = self.mergeSettings(self.defaultSettings, serverSettings);
                        logger.info('从服务器端加载设置成功:', self.currentSettings);
                    } else {
                        console.log('没有找到设置，使用默认值');
                        self.currentSettings = Utils.deepClone(self.defaultSettings);
                    }
                    
                    // 同步语言设置到 i18nManager
                    if (self.currentSettings.language && window.i18nManager) {
                        const currentI18nLanguage = window.i18nManager.getCurrentLanguage();
                        if (self.currentSettings.language !== currentI18nLanguage) {
                            console.log('🔧 SettingsManager.loadSettings: 同步语言设置到 i18nManager');
                            console.log('  从:', currentI18nLanguage, '到:', self.currentSettings.language);
                            window.i18nManager.setLanguage(self.currentSettings.language);
                        }
                    }
                    
                    resolve(self.currentSettings);
                })
                .catch(function(error) {
                    console.error('加载设置失败:', error);
                    self.currentSettings = Utils.deepClone(self.defaultSettings);
                    resolve(self.currentSettings);
                });
        });
    };

    /**
     * 从服务器加载设置
     */
    SettingsManager.prototype.loadFromServer = function() {
        const lang = window.i18nManager ? window.i18nManager.getCurrentLanguage() : 'zh-TW';
        return fetch('/api/load-settings?lang=' + lang)
            .then(function(response) {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('服务器回应错误: ' + response.status);
                }
            })
            .catch(function(error) {
                console.warn('从服务器端加载设置失败:', error);
                return null;
            });
    };



    /**
     * 保存设置
     */
    SettingsManager.prototype.saveSettings = function(newSettings) {
        if (newSettings) {
            this.currentSettings = this.mergeSettings(this.currentSettings, newSettings);
        }

        logger.debug('保存设置:', this.currentSettings);

        // 只保存到服务器端
        this.saveToServer();

        // 触发回调
        if (this.onSettingsChange) {
            this.onSettingsChange(this.currentSettings);
        }

        return this.currentSettings;
    };



    /**
     * 保存到服务器（即时保存）
     */
    SettingsManager.prototype.saveToServer = function() {
        this._performServerSave();
    };

    /**
     * 运行实际的服务器保存操作
     */
    SettingsManager.prototype._performServerSave = function() {
        const self = this;

        const lang = window.i18nManager ? window.i18nManager.getCurrentLanguage() : 'zh-TW';
        fetch('/api/save-settings?lang=' + lang, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(self.currentSettings)
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data.status === 'success') {
                console.log('设置已即时同步到服务器端');
                // 处理消息代码
                if (data.messageCode && window.i18nManager) {
                    const message = window.i18nManager.t(data.messageCode, data.params);
                    console.log('服务器回应:', message);
                }
            } else {
                console.warn('同步设置到服务器端失败:', data);
            }
        })
        .catch(function(error) {
            console.warn('同步设置到服务器端时发生错误:', error);
        });
    };



    /**
     * 合并设置
     */
    SettingsManager.prototype.mergeSettings = function(defaultSettings, newSettings) {
        const merged = Utils.deepClone(defaultSettings);
        
        for (const key in newSettings) {
            if (newSettings.hasOwnProperty(key)) {
                merged[key] = newSettings[key];
            }
        }
        
        return merged;
    };

    /**
     * 获取设置值
     */
    SettingsManager.prototype.get = function(key, defaultValue) {
        if (key in this.currentSettings) {
            return this.currentSettings[key];
        }
        return defaultValue !== undefined ? defaultValue : this.defaultSettings[key];
    };

    /**
     * 设置设置值
     */
    SettingsManager.prototype.set = function(key, value) {
        const oldValue = this.currentSettings[key];
        this.currentSettings[key] = value;

        // 特殊处理语言变更
        if (key === 'language' && oldValue !== value) {
            this.handleLanguageChange(value);
        }

        // 所有设置变更都即时保存
        this.saveSettings();

        return this;
    };

    /**
     * 批量设置设置
     */
    SettingsManager.prototype.setMultiple = function(settings) {
        let languageChanged = false;
        const oldLanguage = this.currentSettings.language;
        
        for (const key in settings) {
            if (settings.hasOwnProperty(key)) {
                this.currentSettings[key] = settings[key];
                
                if (key === 'language' && oldLanguage !== settings[key]) {
                    languageChanged = true;
                }
            }
        }
        
        if (languageChanged) {
            this.handleLanguageChange(this.currentSettings.language);
        }
        
        this.saveSettings();
        return this;
    };

    /**
     * 处理语言变更
     */
    SettingsManager.prototype.handleLanguageChange = function(newLanguage) {
        console.log('🔄 SettingsManager.handleLanguageChange: ' + newLanguage);

        // 通知国际化系统（统一由 SettingsManager 管理）
        if (window.i18nManager) {
            // 使用 setLanguage 方法确保正确更新
            window.i18nManager.setLanguage(newLanguage);
        }

        // 延迟更新动态文本，确保 i18n 已经加载新语言
        setTimeout(() => {
            this.updatePrivacyLevelDescription(this.currentSettings.userMessagePrivacyLevel);
        }, 100);

        // 触发语言变更回调
        if (this.onLanguageChange) {
            this.onLanguageChange(newLanguage);
        }
    };

    /**
     * 重置设置
     */
    SettingsManager.prototype.resetSettings = function() {
        console.log('重置所有设置');

        // 重置为默认值
        this.currentSettings = Utils.deepClone(this.defaultSettings);

        // 立即保存重置后的设置到服务器
        this.saveToServer();

        // 触发回调
        if (this.onSettingsChange) {
            this.onSettingsChange(this.currentSettings);
        }

        return this.currentSettings;
    };

    /**
     * 验证自动提交设置
     */
    SettingsManager.prototype.validateAutoSubmitSettings = function(settings) {
        const errors = [];

        // 验证超时时间
        if (settings.autoSubmitTimeout !== undefined) {
            const timeout = parseInt(settings.autoSubmitTimeout);
            if (isNaN(timeout) || timeout < 1) {
                errors.push('自动提交时间必须大于等于 1 秒');
            } else if (timeout > 86400) { // 24 小时
                errors.push('自动提交时间不能超过 24 小时');
            }
        }

        // 验证提示词 ID
        if (settings.autoSubmitEnabled && !settings.autoSubmitPromptId) {
            errors.push('激活自动提交时必须选择一个提示词');
        }

        return errors;
    };

    /**
     * 设置自动提交功能
     */
    SettingsManager.prototype.setAutoSubmitSettings = function(enabled, timeout, promptId) {
        const newSettings = {
            autoSubmitEnabled: Boolean(enabled),
            autoSubmitTimeout: parseInt(timeout) || 30,
            autoSubmitPromptId: promptId || null
        };

        // 验证设置
        const errors = this.validateAutoSubmitSettings(newSettings);
        if (errors.length > 0) {
            throw new Error(errors.join('; '));
        }

        // 如果停用自动提交，清除提示词 ID
        if (!newSettings.autoSubmitEnabled) {
            newSettings.autoSubmitPromptId = null;
        }

        // 更新设置
        this.set('autoSubmitEnabled', newSettings.autoSubmitEnabled);
        this.set('autoSubmitTimeout', newSettings.autoSubmitTimeout);
        this.set('autoSubmitPromptId', newSettings.autoSubmitPromptId);

        console.log('自动提交设置已更新:', newSettings);
        return newSettings;
    };

    /**
     * 获取自动提交设置
     */
    SettingsManager.prototype.getAutoSubmitSettings = function() {
        return {
            enabled: this.get('autoSubmitEnabled'),
            timeout: this.get('autoSubmitTimeout'),
            promptId: this.get('autoSubmitPromptId')
        };
    };

    /**
     * 触发自动提交状态变更事件
     */
    SettingsManager.prototype.triggerAutoSubmitStateChange = function(enabled) {
        if (this.onAutoSubmitStateChange) {
            const settings = this.getAutoSubmitSettings();
            console.log('🔍 triggerAutoSubmitStateChange 调试:', {
                enabled: enabled,
                settings: settings,
                currentSettings: this.currentSettings
            });
            this.onAutoSubmitStateChange(enabled, settings);
        }

        console.log('自动提交状态变更:', enabled ? '激活' : '停用');
    };

    /**
     * 获取所有设置
     */
    SettingsManager.prototype.getAllSettings = function() {
        return Utils.deepClone(this.currentSettings);
    };

    /**
     * 应用设置到 UI
     */
    SettingsManager.prototype.applyToUI = function() {
        console.log('应用设置到 UI');
        
        // 应用布局模式
        this.applyLayoutMode();
        
        // 应用自动关闭设置
        this.applyAutoCloseToggle();
        
        // 应用语言设置
        this.applyLanguageSettings();
        
        // 应用图片设置
        this.applyImageSettings();

        // 应用系统提示词设置
        this.applySystemPromptSettings();

        // 应用自动提交设置
        this.applyAutoSubmitSettingsToUI();

        // 应用会话历史设置
        this.applySessionHistorySettings();

        // 应用用户消息记录设置
        this.applyUserMessageSettings();
        
        // 应用会话超时设置
        this.applySessionTimeoutSettings();
    };

    /**
     * 应用布局模式
     */
    SettingsManager.prototype.applyLayoutMode = function() {
        const layoutModeInputs = document.querySelectorAll('input[name="layoutMode"]');
        layoutModeInputs.forEach(function(input) {
            input.checked = input.value === this.currentSettings.layoutMode;
        }.bind(this));

        const expectedClassName = 'layout-' + this.currentSettings.layoutMode;
        if (document.body.className !== expectedClassName) {
            console.log('应用布局模式: ' + this.currentSettings.layoutMode);
            document.body.className = expectedClassName;
        }
    };

    /**
     * 应用自动关闭设置
     */
    SettingsManager.prototype.applyAutoCloseToggle = function() {
        const autoCloseToggle = Utils.safeQuerySelector('#autoCloseToggle');
        if (autoCloseToggle) {
            autoCloseToggle.classList.toggle('active', this.currentSettings.autoClose);
        }
    };

    /**
     * 应用语言设置
     */
    SettingsManager.prototype.applyLanguageSettings = function() {
        if (this.currentSettings.language && window.i18nManager) {
            const currentI18nLanguage = window.i18nManager.getCurrentLanguage();
            if (this.currentSettings.language !== currentI18nLanguage) {
                console.log('应用语言设置: ' + currentI18nLanguage + ' -> ' + this.currentSettings.language);
                window.i18nManager.setLanguage(this.currentSettings.language);
            }
        }

        // 更新下拉列表选项
        const languageSelect = Utils.safeQuerySelector('#settingsLanguageSelect');
        if (languageSelect) {
            console.log(`🔧 SettingsManager.applyLanguageSettings: 设置 select.value = ${this.currentSettings.language}`);
            languageSelect.value = this.currentSettings.language;
            console.log(`🔧 SettingsManager.applyLanguageSettings: 实际 select.value = ${languageSelect.value}`);
        }

        // 更新语言选项显示（兼容旧版卡片式选择器）
        const languageOptions = document.querySelectorAll('.language-option');
        languageOptions.forEach(function(option) {
            option.classList.toggle('active', option.getAttribute('data-lang') === this.currentSettings.language);
        }.bind(this));
    };

    /**
     * 应用图片设置
     */
    SettingsManager.prototype.applyImageSettings = function() {
        // 更新图片存储模式选择器
        const imageStorageModeSelect = Utils.safeQuerySelector('#imageStorageMode');
        if (imageStorageModeSelect) {
            imageStorageModeSelect.value = this.currentSettings.imageStorageMode;
        }
        this.updateImageModeUI(this.currentSettings.imageStorageMode);

        // 更新所有图片大小限制选择器（包括设置页签中的）
        const imageSizeLimitSelects = document.querySelectorAll('[id$="ImageSizeLimit"]');
        imageSizeLimitSelects.forEach(function(select) {
            select.value = this.currentSettings.imageSizeLimit.toString();
        }.bind(this));

        // 更新所有 Base64 兼容模式复选框（包括设置页签中的）
        const enableBase64DetailCheckboxes = document.querySelectorAll('[id$="EnableBase64Detail"]');
        enableBase64DetailCheckboxes.forEach(function(checkbox) {
            checkbox.checked = this.currentSettings.enableBase64Detail;
        }.bind(this));

        // 初始化时同步图片模式到后端
        this.syncImageModeToBackend(this.currentSettings.imageStorageMode);

        console.log('图片设置已应用到 UI:', {
            imageStorageMode: this.currentSettings.imageStorageMode,
            imageSizeLimit: this.currentSettings.imageSizeLimit,
            enableBase64Detail: this.currentSettings.enableBase64Detail
        });
    };

    /**
     * 更新图片模式相关 UI 显示
     */
    SettingsManager.prototype.updateImageModeUI = function(mode) {
        const descEl = Utils.safeQuerySelector('#imageStorageModeDesc');
        const base64Wrapper = Utils.safeQuerySelector('#base64DetailWrapper');

        if (descEl) {
            if (mode === 'file') {
                const fileDesc = window.i18nManager ?
                    window.i18nManager.t('images.settings.fileModeDesc', '文件模式：图片保存到磁盘，AI 通过文件路径读取，适合大图片') :
                    '文件模式：图片保存到磁盘，AI 通过文件路径读取，适合大图片';
                descEl.textContent = fileDesc;
            } else {
                const base64Desc = window.i18nManager ?
                    window.i18nManager.t('images.settings.base64ModeDesc', 'Base64 模式：图片编码为 Base64 直接传递给 AI，兼容性好') :
                    'Base64 模式：图片编码为 Base64 直接传递给 AI，兼容性好';
                descEl.textContent = base64Desc;
            }
        }

        if (base64Wrapper) {
            base64Wrapper.style.display = mode === 'base64' ? 'flex' : 'none';
        }
    };

    /**
     * 同步图片模式到后端
     */
    SettingsManager.prototype.syncImageModeToBackend = function(mode) {
        fetch('/api/image-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: mode })
        }).then(function(response) {
            return response.json();
        }).then(function(data) {
            if (data.success) {
                console.log('图片模式已同步到后端:', data);
            } else {
                console.error('图片模式同步失败:', data);
            }
        }).catch(function(error) {
            console.error('图片模式同步请求失败:', error);
        });
    };

    /**
     * 应用系统提示词设置到 UI
     */
    SettingsManager.prototype.applySystemPromptSettings = function() {
        const enabledCheckbox = Utils.safeQuerySelector('#systemPromptEnabled');
        if (enabledCheckbox) {
            enabledCheckbox.checked = this.currentSettings.systemPromptEnabled;
        }

        const contentTextarea = Utils.safeQuerySelector('#systemPromptContent');
        if (contentTextarea) {
            contentTextarea.value = this.currentSettings.systemPromptContent || '';
        }

        const contentWrapper = Utils.safeQuerySelector('#systemPromptContentWrapper');
        if (contentWrapper) {
            contentWrapper.style.display = this.currentSettings.systemPromptEnabled ? 'flex' : 'none';
        }
    };

    /**
     * 应用自动提交设置到 UI
     */
    SettingsManager.prototype.applyAutoSubmitSettingsToUI = function() {
        // 更新自动提交激活开关
        const autoSubmitToggle = Utils.safeQuerySelector('#autoSubmitToggle');
        if (autoSubmitToggle) {
            autoSubmitToggle.classList.toggle('active', this.currentSettings.autoSubmitEnabled);
        }

        // 更新自动提交超时时间输入框
        const autoSubmitTimeoutInput = Utils.safeQuerySelector('#autoSubmitTimeout');
        if (autoSubmitTimeoutInput) {
            autoSubmitTimeoutInput.value = this.currentSettings.autoSubmitTimeout;
        }

        // 更新自动提交提示词选择下拉列表
        const autoSubmitPromptSelect = Utils.safeQuerySelector('#autoSubmitPromptSelect');
        if (autoSubmitPromptSelect) {
            autoSubmitPromptSelect.value = this.currentSettings.autoSubmitPromptId || '';
        }

        // 更新自动提交状态显示
        this.updateAutoSubmitStatusDisplay();

        console.log('自动提交设置已应用到 UI:', {
            enabled: this.currentSettings.autoSubmitEnabled,
            timeout: this.currentSettings.autoSubmitTimeout,
            promptId: this.currentSettings.autoSubmitPromptId
        });
    };

    /**
     * 更新自动提交状态显示
     */
    SettingsManager.prototype.updateAutoSubmitStatusDisplay = function() {
        const statusElement = Utils.safeQuerySelector('#autoSubmitStatus');
        if (!statusElement) return;

        const statusIcon = statusElement.querySelector('span:first-child');
        const statusText = statusElement.querySelector('.button-text');

        if (this.currentSettings.autoSubmitEnabled && this.currentSettings.autoSubmitPromptId) {
            // 直接设置 HTML 内容，就像提示词按钮一样
            if (statusIcon) statusIcon.innerHTML = '⏰';
            if (statusText) {
                const enabledText = window.i18nManager ?
                    window.i18nManager.t('autoSubmit.enabled', '已激活') :
                    '已激活';
                statusText.textContent = `${enabledText} (${this.currentSettings.autoSubmitTimeout}秒)`;
            }
            statusElement.className = 'auto-submit-status-btn enabled';
        } else {
            // 直接设置 HTML 内容，就像提示词按钮一样
            if (statusIcon) statusIcon.innerHTML = '⏸️';
            if (statusText) {
                const disabledText = window.i18nManager ?
                    window.i18nManager.t('autoSubmit.disabled', '已停用') :
                    '已停用';
                statusText.textContent = disabledText;
            }
            statusElement.className = 'auto-submit-status-btn disabled';
        }
    };

    /**
     * 应用会话历史设置
     */
    SettingsManager.prototype.applySessionHistorySettings = function() {
        // 更新会话历史保存期限选择器
        const sessionHistoryRetentionSelect = Utils.safeQuerySelector('#sessionHistoryRetentionHours');
        if (sessionHistoryRetentionSelect) {
            sessionHistoryRetentionSelect.value = this.currentSettings.sessionHistoryRetentionHours.toString();
        }

        console.log('会话历史设置已应用到 UI:', {
            retentionHours: this.currentSettings.sessionHistoryRetentionHours
        });
    };

    /**
     * 应用用户消息记录设置
     */
    SettingsManager.prototype.applyUserMessageSettings = function() {
        // 更新用户消息记录激活开关
        const userMessageRecordingToggle = Utils.safeQuerySelector('#userMessageRecordingToggle');
        if (userMessageRecordingToggle) {
            userMessageRecordingToggle.checked = this.currentSettings.userMessageRecordingEnabled;
        }

        // 更新隐私等级选择器
        const userMessagePrivacySelect = Utils.safeQuerySelector('#userMessagePrivacyLevel');
        if (userMessagePrivacySelect) {
            userMessagePrivacySelect.value = this.currentSettings.userMessagePrivacyLevel;
        }

        console.log('用户消息记录设置已应用到 UI:', {
            recordingEnabled: this.currentSettings.userMessageRecordingEnabled,
            privacyLevel: this.currentSettings.userMessagePrivacyLevel
        });

        // 更新隐私等级描述
        this.updatePrivacyLevelDescription(this.currentSettings.userMessagePrivacyLevel);
    };

    /**
     * 应用会话超时设置
     */
    SettingsManager.prototype.applySessionTimeoutSettings = function() {
        // 更新会话超时激活开关
        const sessionTimeoutEnabled = Utils.safeQuerySelector('#sessionTimeoutEnabled');
        if (sessionTimeoutEnabled) {
            sessionTimeoutEnabled.checked = this.currentSettings.sessionTimeoutEnabled;
        }

        // 更新会话超时时间输入框
        const sessionTimeoutSeconds = Utils.safeQuerySelector('#sessionTimeoutSeconds');
        if (sessionTimeoutSeconds) {
            sessionTimeoutSeconds.value = this.currentSettings.sessionTimeoutSeconds;
        }

        console.log('会话超时设置已应用到 UI:', {
            enabled: this.currentSettings.sessionTimeoutEnabled,
            seconds: this.currentSettings.sessionTimeoutSeconds
        });
    };

    /**
     * 更新隐私等级描述文本
     */
    SettingsManager.prototype.updatePrivacyLevelDescription = function(privacyLevel) {
        const descriptionElement = Utils.safeQuerySelector('#userMessagePrivacyDescription');
        if (!descriptionElement || !window.i18nManager) {
            return;
        }

        let descriptionKey = '';
        switch (privacyLevel) {
            case 'full':
                descriptionKey = 'sessionHistory.userMessages.privacyDescription.full';
                break;
            case 'basic':
                descriptionKey = 'sessionHistory.userMessages.privacyDescription.basic';
                break;
            case 'disabled':
                descriptionKey = 'sessionHistory.userMessages.privacyDescription.disabled';
                break;
            default:
                descriptionKey = 'sessionHistory.userMessages.privacyDescription.full';
        }

        // 更新 data-i18n 属性，这样在语言切换时会自动更新
        descriptionElement.setAttribute('data-i18n', descriptionKey);

        // 立即更新文本内容
        const description = window.i18nManager.t(descriptionKey);
        descriptionElement.textContent = description;
    };

    /**
     * 设置事件监听器
     */
    SettingsManager.prototype.setupEventListeners = function() {
        const self = this;
        
        // 布局模式切换
        const layoutModeInputs = document.querySelectorAll('input[name="layoutMode"]');
        layoutModeInputs.forEach(function(input) {
            input.addEventListener('change', function(e) {
                self.set('layoutMode', e.target.value);
            });
        });

        // 自动关闭切换
        const autoCloseToggle = Utils.safeQuerySelector('#autoCloseToggle');
        if (autoCloseToggle) {
            autoCloseToggle.addEventListener('click', function() {
                const newValue = !self.get('autoClose');
                self.set('autoClose', newValue);
                autoCloseToggle.classList.toggle('active', newValue);
            });
        }

        // 语言切换 - 支持下拉列表
        const languageSelect = Utils.safeQuerySelector('#settingsLanguageSelect');
        if (languageSelect) {
            languageSelect.addEventListener('change', function(e) {
                const lang = e.target.value;
                console.log(`🔄 SettingsManager select change event: ${lang}`);
                self.set('language', lang);
            });
        }

        // 语言切换 - 兼容旧版卡片式选择器
        const languageOptions = document.querySelectorAll('.language-option');
        languageOptions.forEach(function(option) {
            option.addEventListener('click', function() {
                const lang = option.getAttribute('data-lang');
                self.set('language', lang);
            });
        });

        // 图片设置 - 大小限制选择器
        const settingsImageSizeLimit = Utils.safeQuerySelector('#settingsImageSizeLimit');
        if (settingsImageSizeLimit) {
            settingsImageSizeLimit.addEventListener('change', function(e) {
                const value = parseInt(e.target.value);
                self.set('imageSizeLimit', value);
                console.log('图片大小限制已更新:', value);
            });
        }

        // 图片设置 - Base64 兼容模式切换器
        const settingsEnableBase64Detail = Utils.safeQuerySelector('#settingsEnableBase64Detail');
        if (settingsEnableBase64Detail) {
            settingsEnableBase64Detail.addEventListener('change', function(e) {
                const value = e.target.checked;
                self.set('enableBase64Detail', value);
                console.log('Base64 兼容模式已更新:', value);
            });
        }

        // 自动提交功能激活开关
        const autoSubmitToggle = Utils.safeQuerySelector('#autoSubmitToggle');
        if (autoSubmitToggle) {
            autoSubmitToggle.addEventListener('click', function() {
                const newValue = !self.get('autoSubmitEnabled');
                const currentPromptId = self.get('autoSubmitPromptId');

                console.log('自动提交开关点击:', {
                    newValue: newValue,
                    currentPromptId: currentPromptId
                });

                try {
                    // 如果要激活自动提交，检查是否已选择提示词
                    if (newValue && (!currentPromptId || currentPromptId === '')) {
                        const message = window.i18nManager ? 
                            window.i18nManager.t('settingsUI.autoCommitNoPrompt', '请先选择一个提示词作为自动提交内容') : 
                            '请先选择一个提示词作为自动提交内容';
                        Utils.showMessage(message, Utils.CONSTANTS.MESSAGE_WARNING);
                        return;
                    }

                    self.set('autoSubmitEnabled', newValue);
                    autoSubmitToggle.classList.toggle('active', newValue);

                    console.log('自动提交状态已更新:', newValue);

                    // 触发自动提交状态变更事件
                    self.triggerAutoSubmitStateChange(newValue);
                } catch (error) {
                    Utils.showMessage(error.message, Utils.CONSTANTS.MESSAGE_ERROR);
                }
            });
        }

        // 自动提交超时时间设置
        const autoSubmitTimeoutInput = Utils.safeQuerySelector('#autoSubmitTimeout');
        if (autoSubmitTimeoutInput) {
            autoSubmitTimeoutInput.addEventListener('change', function(e) {
                const timeout = parseInt(e.target.value);
                try {
                    self.setAutoSubmitSettings(
                        self.get('autoSubmitEnabled'),
                        timeout,
                        self.get('autoSubmitPromptId')
                    );
                } catch (error) {
                    Utils.showMessage(error.message, Utils.CONSTANTS.MESSAGE_ERROR);
                    // 恢复原值
                    e.target.value = self.get('autoSubmitTimeout');
                }
            });
        }

        // 自动提交提示词选择
        const autoSubmitPromptSelect = Utils.safeQuerySelector('#autoSubmitPromptSelect');
        if (autoSubmitPromptSelect) {
            autoSubmitPromptSelect.addEventListener('change', function(e) {
                const promptId = e.target.value || null;
                console.log('自动提交提示词选择变更:', promptId);

                try {
                    // 如果选择了空值，清除自动提交设置
                    if (!promptId || promptId === '') {
                        self.set('autoSubmitPromptId', null);
                        self.set('autoSubmitEnabled', false);

                        // 同时清除所有提示词的 isAutoSubmit 标记
                        if (window.feedbackApp && window.feedbackApp.promptManager) {
                            window.feedbackApp.promptManager.clearAutoSubmitPrompt();
                            console.log('🔄 已清除所有提示词的自动提交标记');
                        } else {
                            console.warn('⚠️ promptManager 未找到，无法清除提示词标记');
                        }

                        // 触发状态变更事件，更新相关 UI 组件
                        self.triggerAutoSubmitStateChange(false);

                        // 更新 UI 元素（按钮状态、倒数计时器等）
                        self.applyAutoSubmitSettingsToUI();

                        console.log('清除自动提交设置并更新 UI');
                    } else {
                        // 设置新的自动提交提示词
                        self.set('autoSubmitPromptId', promptId);
                        console.log('设置自动提交提示词 ID:', promptId);

                        // 同时更新对应提示词的 isAutoSubmit 标记
                        if (window.feedbackApp && window.feedbackApp.promptManager) {
                            try {
                                window.feedbackApp.promptManager.setAutoSubmitPrompt(promptId);
                                console.log('🔄 已设置提示词的自动提交标记:', promptId);

                                // 触发状态变更事件，更新相关 UI 组件
                                const currentEnabled = self.get('autoSubmitEnabled');
                                self.triggerAutoSubmitStateChange(currentEnabled);

                                // 更新 UI 元素
                                self.applyAutoSubmitSettingsToUI();

                                console.log('🔄 已更新自动提交 UI 状态');
                            } catch (promptError) {
                                console.error('❌ 设置提示词自动提交标记失败:', promptError);
                                // 如果设置提示词失败，回滚设置
                                self.set('autoSubmitPromptId', null);
                                e.target.value = '';
                                throw promptError;
                            }
                        } else {
                            console.warn('⚠️ promptManager 未找到，无法设置提示词标记');
                        }
                    }
                } catch (error) {
                    Utils.showMessage(error.message, Utils.CONSTANTS.MESSAGE_ERROR);
                    // 恢复原值
                    e.target.value = self.get('autoSubmitPromptId') || '';
                }
            });
        }

        // 图片存储模式切换
        const imageStorageModeSelect = Utils.safeQuerySelector('#imageStorageMode');
        if (imageStorageModeSelect) {
            imageStorageModeSelect.addEventListener('change', function(e) {
                const mode = e.target.value;
                self.set('imageStorageMode', mode);
                self.updateImageModeUI(mode);
                self.syncImageModeToBackend(mode);
                console.log('图片存储模式已切换:', mode);
            });
        }

        // 系统提示词开关
        const systemPromptEnabledCheckbox = Utils.safeQuerySelector('#systemPromptEnabled');
        if (systemPromptEnabledCheckbox) {
            systemPromptEnabledCheckbox.addEventListener('change', function(e) {
                const enabled = e.target.checked;
                self.set('systemPromptEnabled', enabled);
                const contentWrapper = Utils.safeQuerySelector('#systemPromptContentWrapper');
                if (contentWrapper) {
                    contentWrapper.style.display = enabled ? 'flex' : 'none';
                }
                console.log('系统提示词:', enabled ? '启用' : '停用');
            });
        }

        // 系统提示词内容
        const systemPromptContentTextarea = Utils.safeQuerySelector('#systemPromptContent');
        if (systemPromptContentTextarea) {
            systemPromptContentTextarea.addEventListener('input', Utils.DOM.debounce(function(e) {
                self.set('systemPromptContent', e.target.value);
                console.log('系统提示词内容已更新');
            }, 500));
        }

        // 会话历史保存期限设置
        const sessionHistoryRetentionSelect = Utils.safeQuerySelector('#sessionHistoryRetentionHours');
        if (sessionHistoryRetentionSelect) {
            sessionHistoryRetentionSelect.addEventListener('change', function(e) {
                const hours = parseInt(e.target.value);
                self.set('sessionHistoryRetentionHours', hours);
                console.log('会话历史保存期限已更新:', hours, '小时');

                // 触发清理过期会话
                if (window.MCPFeedback && window.MCPFeedback.app && window.MCPFeedback.app.sessionManager) {
                    const sessionManager = window.MCPFeedback.app.sessionManager;
                    if (sessionManager.dataManager && sessionManager.dataManager.cleanupExpiredSessions) {
                        sessionManager.dataManager.cleanupExpiredSessions();
                    }
                }
            });
        }

        // 会话历史导出按钮
        const exportHistoryBtn = Utils.safeQuerySelector('#exportSessionHistoryBtn');
        if (exportHistoryBtn) {
            exportHistoryBtn.addEventListener('click', function() {
                if (window.MCPFeedback && window.MCPFeedback.SessionManager) {
                    window.MCPFeedback.SessionManager.exportSessionHistory();
                }
            });
        }

        // 会话历史清空按钮
        const clearHistoryBtn = Utils.safeQuerySelector('#clearSessionHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', function() {
                if (window.MCPFeedback && window.MCPFeedback.SessionManager) {
                    window.MCPFeedback.SessionManager.clearSessionHistory();
                }
            });
        }

        // 清空用户消息记录按钮
        const clearUserMessagesBtn = Utils.safeQuerySelector('#clearUserMessagesBtn');
        if (clearUserMessagesBtn) {
            clearUserMessagesBtn.addEventListener('click', function() {
                const i18n = window.i18nManager;
                const confirmMessage = i18n ?
                    i18n.t('sessionHistory.userMessages.confirmClearAll') :
                    '确定要清空所有会话的用户消息记录吗？此操作无法复原。';

                if (confirm(confirmMessage)) {
                    if (window.MCPFeedback && window.MCPFeedback.app && window.MCPFeedback.app.sessionManager) {
                        const success = window.MCPFeedback.app.sessionManager.dataManager.clearAllUserMessages();
                        if (success) {
                            const successMessage = i18n ?
                                i18n.t('sessionHistory.userMessages.clearSuccess') :
                                '用户消息记录已清空';
                            alert(successMessage);
                        }
                    }
                }
            });
        }

        // 用户消息记录激活开关
        const userMessageRecordingToggle = Utils.safeQuerySelector('#userMessageRecordingToggle');
        if (userMessageRecordingToggle) {
            userMessageRecordingToggle.addEventListener('change', function() {
                const newValue = userMessageRecordingToggle.checked;
                self.set('userMessageRecordingEnabled', newValue);
                console.log('用户消息记录状态已更新:', newValue);
            });
        }

        // 用户消息隐私等级选择
        const userMessagePrivacySelect = Utils.safeQuerySelector('#userMessagePrivacyLevel');
        if (userMessagePrivacySelect) {
            userMessagePrivacySelect.addEventListener('change', function(e) {
                const privacyLevel = e.target.value;
                self.set('userMessagePrivacyLevel', privacyLevel);
                self.updatePrivacyLevelDescription(privacyLevel);
                console.log('用户消息隐私等级已更新:', privacyLevel);
            });
        }

        // 会话超时激活开关
        const sessionTimeoutEnabled = Utils.safeQuerySelector('#sessionTimeoutEnabled');
        if (sessionTimeoutEnabled) {
            sessionTimeoutEnabled.addEventListener('change', function() {
                const newValue = sessionTimeoutEnabled.checked;
                self.set('sessionTimeoutEnabled', newValue);
                console.log('会话超时状态已更新:', newValue);
                
                // 触发 WebSocket 通知后端更新超时设置
                if (window.MCPFeedback && window.MCPFeedback.app && window.MCPFeedback.app.webSocketManager) {
                    window.MCPFeedback.app.webSocketManager.send({
                        type: 'update_timeout_settings',
                        settings: {
                            enabled: newValue,
                            seconds: self.get('sessionTimeoutSeconds')
                        }
                    });
                }
            });
        }

        // 会话超时时间设置
        const sessionTimeoutSeconds = Utils.safeQuerySelector('#sessionTimeoutSeconds');
        if (sessionTimeoutSeconds) {
            sessionTimeoutSeconds.addEventListener('change', function(e) {
                const seconds = parseInt(e.target.value);
                
                // 验证输入值范围
                if (isNaN(seconds) || seconds < 300) {
                    e.target.value = 300;
                    self.set('sessionTimeoutSeconds', 300);
                } else if (seconds > 86400) {
                    e.target.value = 86400;
                    self.set('sessionTimeoutSeconds', 86400);
                } else {
                    self.set('sessionTimeoutSeconds', seconds);
                }
                
                console.log('会话超时时间已更新:', self.get('sessionTimeoutSeconds'), '秒');
                
                // 触发 WebSocket 通知后端更新超时设置
                if (window.MCPFeedback && window.MCPFeedback.app && window.MCPFeedback.app.webSocketManager) {
                    window.MCPFeedback.app.webSocketManager.send({
                        type: 'update_timeout_settings',
                        settings: {
                            enabled: self.get('sessionTimeoutEnabled'),
                            seconds: self.get('sessionTimeoutSeconds')
                        }
                    });
                }
            });
        }

        // 重置设置
        const resetBtn = Utils.safeQuerySelector('#resetSettingsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                if (confirm('确定要重置所有设置吗？')) {
                    self.resetSettings();
                    self.applyToUI();
                }
            });
        }

    };

    // 将 SettingsManager 加入命名空间
    window.MCPFeedback.SettingsManager = SettingsManager;

    console.log('✅ SettingsManager 模块加载完成');

})();
