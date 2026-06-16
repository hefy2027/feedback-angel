/**
 * MCP Feedback Enhanced - 音效设置 UI 模块
 * ======================================
 * 
 * 处理音效通知设置的用户接口
 * 参考 prompt-settings-ui.js 的设计模式
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * 音效设置 UI 建构函数
     */
    function AudioSettingsUI(options) {
        options = options || {};
        
        // 容器元素
        this.container = options.container || null;
        
        // 音效管理器引用
        this.audioManager = options.audioManager || null;
        
        // i18n 翻译函数
        this.t = options.t || function(key, defaultValue) { return defaultValue || key; };
        
        // UI 元素引用
        this.enabledToggle = null;
        this.volumeSlider = null;
        this.volumeValue = null;
        this.audioSelect = null;
        this.testButton = null;
        this.uploadButton = null;
        this.uploadInput = null;
        this.audioList = null;
        
        console.log('🎨 AudioSettingsUI 初始化完成');
    }

    /**
     * 初始化 UI
     */
    AudioSettingsUI.prototype.initialize = function() {
        if (!this.container) {
            console.error('❌ AudioSettingsUI 容器未设置');
            return;
        }

        if (!this.audioManager) {
            console.error('❌ AudioManager 未设置');
            return;
        }

        this.createUI();
        this.setupEventListeners();
        this.refreshUI();

        // 主动应用翻译到新创建的元素
        this.applyInitialTranslations();

        console.log('✅ AudioSettingsUI 初始化完成');
    };

    /**
     * 创建 UI 结构
     */
    AudioSettingsUI.prototype.createUI = function() {
        const html = `
            <div class="settings-card">
                <div class="settings-card-header">
                    <h3 class="settings-card-title" data-i18n="audio.notification.title">
                        🔊 音效通知设置
                    </h3>
                </div>
                <div class="settings-card-body">
                    <div class="audio-management-description" data-i18n="audio.notification.description">
                        设置会话更新时的音效通知
                    </div>
                    
                    <div class="audio-settings-controls">
                    <!-- 激活开关 -->
                    <div class="setting-item">
                        <div class="setting-info">
                            <div class="setting-label" data-i18n="audio.notification.enabled"></div>
                            <div class="setting-description" data-i18n="audio.notification.enabledDesc"></div>
                        </div>
                        <div class="setting-control">
                            <button type="button" id="audioNotificationEnabled" class="toggle-btn" data-i18n-aria-label="aria.toggleAudioNotification">
                                <span class="toggle-slider"></span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- 音量控制 -->
                    <div class="audio-setting-item">
                        <label class="audio-setting-label" data-i18n="audio.notification.volume">音量</label>
                        <div class="audio-volume-control">
                            <input type="range" id="audioVolumeSlider" class="audio-volume-slider" 
                                   min="0" max="100" value="50">
                            <span id="audioVolumeValue" class="audio-volume-value">50%</span>
                        </div>
                    </div>
                    
                    <!-- 音效选择 -->
                    <div class="audio-setting-item">
                        <label class="audio-setting-label" data-i18n="audio.notification.selectAudio">选择音效</label>
                        <div class="audio-select-control">
                            <select id="audioSelect" class="audio-select">
                                <!-- 选项将动态生成 -->
                            </select>
                            <button type="button" id="audioTestButton" class="btn btn-secondary audio-test-btn">
                                <span data-i18n="audio.notification.testPlay">测试播放</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- 自订音效上传 -->
                    <div class="audio-setting-item">
                        <label class="audio-setting-label" data-i18n="audio.notification.uploadCustom">上传自订音效</label>
                        <div class="audio-upload-control">
                            <input type="file" id="audioUploadInput" class="audio-upload-input" 
                                   accept="audio/mp3,audio/wav,audio/ogg" style="display: none;">
                            <button type="button" id="audioUploadButton" class="btn btn-primary audio-upload-btn">
                                📁 <span data-i18n="audio.notification.chooseFile">选择文件</span>
                            </button>
                            <span class="audio-upload-hint" data-i18n="audio.notification.supportedFormats">
                                支持 MP3、WAV、OGG 格式
                            </span>
                        </div>
                    </div>
                    
                    <!-- 自订音效列表 -->
                    <div class="audio-setting-item">
                        <label class="audio-setting-label" data-i18n="audio.notification.customAudios">自订音效</label>
                        <div class="audio-custom-list" id="audioCustomList">
                            <!-- 自订音效列表将在这里动态生成 -->
                        </div>
                    </div>
                </div>
                </div>
            </div>
        `;

        this.container.insertAdjacentHTML('beforeend', html);

        // 获取 UI 元素引用
        this.enabledToggle = this.container.querySelector('#audioNotificationEnabled');
        this.volumeSlider = this.container.querySelector('#audioVolumeSlider');
        this.volumeValue = this.container.querySelector('#audioVolumeValue');
        this.audioSelect = this.container.querySelector('#audioSelect');
        this.testButton = this.container.querySelector('#audioTestButton');
        this.uploadButton = this.container.querySelector('#audioUploadButton');
        this.uploadInput = this.container.querySelector('#audioUploadInput');
        this.audioList = this.container.querySelector('#audioCustomList');
    };

    /**
     * 设置事件监听器
     */
    AudioSettingsUI.prototype.setupEventListeners = function() {
        const self = this;

        // 激活开关事件
        if (this.enabledToggle) {
            this.enabledToggle.addEventListener('click', function() {
                const newValue = !self.enabledToggle.classList.contains('active');
                self.handleEnabledChange(newValue);
            });
        }

        // 音量滑杆事件
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', function(e) {
                self.handleVolumeChange(parseInt(e.target.value));
            });
        }

        // 音效选择事件
        if (this.audioSelect) {
            this.audioSelect.addEventListener('change', function(e) {
                self.handleAudioSelect(e.target.value);
            });
        }

        // 测试播放事件
        if (this.testButton) {
            this.testButton.addEventListener('click', function() {
                self.handleTestPlay();
            });
        }

        // 上传按钮事件
        if (this.uploadButton) {
            this.uploadButton.addEventListener('click', function() {
                self.uploadInput.click();
            });
        }

        // 文件上传事件
        if (this.uploadInput) {
            this.uploadInput.addEventListener('change', function(e) {
                self.handleFileUpload(e.target.files[0]);
            });
        }

        // 设置音效管理器回调
        if (this.audioManager) {
            this.audioManager.onSettingsChange = function(settings) {
                console.log('🎨 音效设置变更，重新渲染 UI');
                self.refreshUI();
            };
        }

        // 语言变更将由 i18n.js 直接调用 updateAudioSelectTranslations 方法
    };

    /**
     * 处理激活状态变更
     */
    AudioSettingsUI.prototype.handleEnabledChange = function(enabled) {
        try {
            this.audioManager.setEnabled(enabled);
            this.updateControlsState();
            this.showSuccess(this.t('audio.notification.enabledChanged', '音效通知设置已更新'));
        } catch (error) {
            console.error('❌ 设置激活状态失败:', error);
            this.showError(error.message);
            // 恢复原状态
            this.enabledToggle.classList.toggle('active', this.audioManager.getSettings().enabled);
        }
    };

    /**
     * 处理音量变更
     */
    AudioSettingsUI.prototype.handleVolumeChange = function(volume) {
        try {
            this.audioManager.setVolume(volume);
            this.volumeValue.textContent = volume + '%';
        } catch (error) {
            console.error('❌ 设置音量失败:', error);
            this.showError(error.message);
        }
    };

    /**
     * 处理音效选择
     */
    AudioSettingsUI.prototype.handleAudioSelect = function(audioId) {
        try {
            this.audioManager.setSelectedAudio(audioId);
            this.showSuccess(this.t('audio.notification.audioSelected', '音效已选择'));
        } catch (error) {
            console.error('❌ 选择音效失败:', error);
            this.showError(error.message);
            // 恢复原选择
            this.audioSelect.value = this.audioManager.getSettings().selectedAudioId;
        }
    };

    /**
     * 处理测试播放
     */
    AudioSettingsUI.prototype.handleTestPlay = function() {
        try {
            const selectedAudioId = this.audioSelect.value;
            const audioData = this.audioManager.getAudioById(selectedAudioId);
            
            if (audioData) {
                this.audioManager.playAudio(audioData);
                this.showSuccess(this.t('audio.notification.testPlaying', '正在播放测试音效'));
            } else {
                this.showError(this.t('audio.notification.audioNotFound', '找不到选择的音效'));
            }
        } catch (error) {
            console.error('❌ 测试播放失败:', error);
            this.showError(error.message);
        }
    };

    /**
     * 处理文件上传
     */
    AudioSettingsUI.prototype.handleFileUpload = function(file) {
        if (!file) return;

        // 生成缺省文件名称（去除扩展名）
        const defaultName = file.name.replace(/\.[^/.]+$/, '');

        // 显示美观的名称输入模态框
        this.showAudioNameModal(defaultName, (audioName) => {
            if (!audioName || !audioName.trim()) {
                this.showError(this.t('audio.notification.nameRequired', '音效名称不能为空'));
                return;
            }

            // 显示上传中状态
            this.uploadButton.disabled = true;
            this.uploadButton.innerHTML = '⏳ <span data-i18n="audio.notification.uploading">上传中...</span>';

            this.audioManager.addCustomAudio(audioName.trim(), file)
                .then(audioData => {
                    this.showSuccess(this.t('audio.notification.uploadSuccess', '音效上传成功: ') + audioData.name);
                    this.refreshAudioSelect();
                    this.refreshCustomAudioList();
                    // 清空文件输入
                    this.uploadInput.value = '';
                })
                .catch(error => {
                    console.error('❌ 上传音效失败:', error);
                    this.showError(error.message);
                })
                .finally(() => {
                    // 恢复按钮状态
                    this.uploadButton.disabled = false;
                    this.uploadButton.innerHTML = '📁 <span data-i18n="audio.notification.chooseFile">选择文件</span>';
                });
        });
    };

    /**
     * 处理删除自订音效
     */
    AudioSettingsUI.prototype.handleDeleteCustomAudio = function(audioId) {
        const audioData = this.audioManager.getAudioById(audioId);
        if (!audioData) return;

        const confirmMessage = this.t('audio.notification.deleteConfirm', '确定要删除音效 "{name}" 吗？')
            .replace('{name}', audioData.name);
        
        if (!confirm(confirmMessage)) return;

        try {
            this.audioManager.removeCustomAudio(audioId);
            this.showSuccess(this.t('audio.notification.deleteSuccess', '音效已删除'));
            this.refreshAudioSelect();
            this.refreshCustomAudioList();
        } catch (error) {
            console.error('❌ 删除音效失败:', error);
            this.showError(error.message);
        }
    };

    /**
     * 刷新整个 UI
     */
    AudioSettingsUI.prototype.refreshUI = function() {
        const settings = this.audioManager.getSettings();
        
        // 更新激活状态
        if (this.enabledToggle) {
            this.enabledToggle.classList.toggle('active', settings.enabled);
        }
        
        // 更新音量
        if (this.volumeSlider && this.volumeValue) {
            this.volumeSlider.value = settings.volume;
            this.volumeValue.textContent = settings.volume + '%';
        }
        
        // 更新音效选择
        this.refreshAudioSelect();
        
        // 更新自订音效列表
        this.refreshCustomAudioList();
        
        // 更新控制项状态
        this.updateControlsState();
    };

    /**
     * 刷新音效选择下拉列表
     */
    AudioSettingsUI.prototype.refreshAudioSelect = function() {
        if (!this.audioSelect) return;

        const settings = this.audioManager.getSettings();
        const allAudios = this.audioManager.getAllAudios();
        
        // 清空现有选项
        this.audioSelect.innerHTML = '';
        
        // 添加音效选项
        allAudios.forEach(audio => {
            const option = document.createElement('option');
            option.value = audio.id;

            // 使用翻译后的名称
            let displayName = audio.name;
            if (audio.isDefault) {
                // 为缺省音效提供翻译
                const translationKey = this.getDefaultAudioTranslationKey(audio.id);
                if (translationKey) {
                    displayName = this.t(translationKey, audio.name);
                }
                displayName += ' (' + this.t('audio.notification.default', '缺省') + ')';
            }

            option.textContent = displayName;

            // 为缺省音效选项添加 data-i18n 属性，以便语言切换时自动更新
            if (audio.isDefault) {
                const translationKey = this.getDefaultAudioTranslationKey(audio.id);
                if (translationKey) {
                    option.setAttribute('data-audio-id', audio.id);
                    option.setAttribute('data-is-default', 'true');
                    option.setAttribute('data-translation-key', translationKey);
                }
            }

            if (audio.id === settings.selectedAudioId) {
                option.selected = true;
            }
            this.audioSelect.appendChild(option);
        });
    };

    /**
     * 刷新自订音效列表
     */
    AudioSettingsUI.prototype.refreshCustomAudioList = function() {
        if (!this.audioList) return;

        const customAudios = this.audioManager.getSettings().customAudios;
        
        if (customAudios.length === 0) {
            this.audioList.innerHTML = `
                <div class="audio-empty-state">
                    <div style="font-size: 32px; margin-bottom: 8px;">🎵</div>
                    <div data-i18n="audio.notification.noCustomAudios">尚未上传任何自订音效</div>
                </div>
            `;
            return;
        }

        let html = '';
        customAudios.forEach(audio => {
            html += this.createCustomAudioItemHTML(audio);
        });
        
        this.audioList.innerHTML = html;
        this.setupCustomAudioEvents();
    };

    /**
     * 创建自订音效项目 HTML
     */
    AudioSettingsUI.prototype.createCustomAudioItemHTML = function(audio) {
        const createdDate = new Date(audio.createdAt).toLocaleDateString();
        
        return `
            <div class="audio-custom-item" data-audio-id="${audio.id}">
                <div class="audio-custom-info">
                    <div class="audio-custom-name">${Utils.escapeHtml(audio.name)}</div>
                    <div class="audio-custom-meta">
                        <span data-i18n="audio.notification.created">创建于</span>: ${createdDate}
                        | <span data-i18n="audio.notification.format">格式</span>: ${audio.mimeType}
                    </div>
                </div>
                <div class="audio-custom-actions">
                    <button type="button" class="btn btn-sm btn-secondary audio-play-btn" 
                            data-audio-id="${audio.id}" title="播放">
                        ▶️
                    </button>
                    <button type="button" class="btn btn-sm btn-danger audio-delete-btn" 
                            data-audio-id="${audio.id}" title="删除">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    };

    /**
     * 设置自订音效项目事件
     */
    AudioSettingsUI.prototype.setupCustomAudioEvents = function() {
        const self = this;

        // 播放按钮事件
        const playButtons = this.audioList.querySelectorAll('.audio-play-btn');
        playButtons.forEach(button => {
            button.addEventListener('click', function() {
                const audioId = button.getAttribute('data-audio-id');
                const audioData = self.audioManager.getAudioById(audioId);
                if (audioData) {
                    self.audioManager.playAudio(audioData);
                }
            });
        });

        // 删除按钮事件
        const deleteButtons = this.audioList.querySelectorAll('.audio-delete-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const audioId = button.getAttribute('data-audio-id');
                self.handleDeleteCustomAudio(audioId);
            });
        });
    };

    /**
     * 更新控制项状态
     */
    AudioSettingsUI.prototype.updateControlsState = function() {
        const enabled = this.enabledToggle ? this.enabledToggle.classList.contains('active') : false;
        
        // 根据激活状态禁用/激活控制项
        const controls = [
            this.volumeSlider,
            this.audioSelect,
            this.testButton,
            this.uploadButton
        ];
        
        controls.forEach(control => {
            if (control) {
                control.disabled = !enabled;
            }
        });
    };

    /**
     * 显示成功消息
     */
    AudioSettingsUI.prototype.showSuccess = function(message) {
        if (Utils && Utils.showMessage) {
            Utils.showMessage(message, Utils.CONSTANTS.MESSAGE_SUCCESS);
        } else {
            console.log('✅', message);
        }
    };

    /**
     * 显示错误消息
     */
    AudioSettingsUI.prototype.showError = function(message) {
        if (Utils && Utils.showMessage) {
            Utils.showMessage(message, Utils.CONSTANTS.MESSAGE_ERROR);
        } else {
            console.error('❌', message);
        }
    };

    /**
     * 显示音效名称输入模态框
     */
    AudioSettingsUI.prototype.showAudioNameModal = function(defaultName, onConfirm) {
        const self = this;

        // 创建模态框 HTML
        const modalHTML = `
            <div class="audio-name-modal-overlay" id="audioNameModalOverlay">
                <div class="audio-name-modal">
                    <div class="audio-name-modal-header">
                        <h4 data-i18n="audio.notification.enterAudioName">输入音效名称</h4>
                        <button type="button" class="audio-name-modal-close" id="audioNameModalClose">×</button>
                    </div>
                    <div class="audio-name-modal-body">
                        <label for="audioNameInput" data-i18n="audio.notification.audioName">音效名称:</label>
                        <input type="text" id="audioNameInput" class="audio-name-input"
                               value="${Utils.escapeHtml(defaultName)}"
                               placeholder="${this.t('audio.notification.audioNamePlaceholder', '请输入音效名称...')}"
                               maxlength="50">
                        <div class="audio-name-hint" data-i18n="audio.notification.audioNameHint">
                            留空将使用缺省文件名称
                        </div>
                    </div>
                    <div class="audio-name-modal-footer">
                        <button type="button" class="btn btn-secondary" id="audioNameModalCancel">
                            <span data-i18n="buttons.cancel">取消</span>
                        </button>
                        <button type="button" class="btn btn-primary" id="audioNameModalConfirm">
                            <span data-i18n="buttons.ok">确定</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 添加模态框到页面
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 获取元素引用
        const overlay = document.getElementById('audioNameModalOverlay');
        const input = document.getElementById('audioNameInput');
        const closeBtn = document.getElementById('audioNameModalClose');
        const cancelBtn = document.getElementById('audioNameModalCancel');
        const confirmBtn = document.getElementById('audioNameModalConfirm');

        // 聚焦输入框并选中文本
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);

        // 关闭模态框函数
        const closeModal = () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };

        // 确认函数
        const confirm = () => {
            const audioName = input.value.trim() || defaultName;
            closeModal();
            if (onConfirm) {
                onConfirm(audioName);
            }
        };

        // 事件监听器
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        confirmBtn.addEventListener('click', confirm);

        // 点击遮罩关闭
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeModal();
            }
        });

        // Enter 键确认，Escape 键取消
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            }
        });
    };



    /**
     * 应用初始翻译到新创建的元素
     */
    AudioSettingsUI.prototype.applyInitialTranslations = function() {
        if (!this.container) return;

        // 对容器内所有有 data-i18n 属性的元素应用翻译
        const elements = this.container.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.textContent = translation;
            }
        });

        // 对有 data-i18n-placeholder 属性的元素应用翻译
        const placeholderElements = this.container.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.placeholder = translation;
            }
        });

        // 对有 data-i18n-aria-label 属性的元素应用翻译
        const ariaLabelElements = this.container.querySelectorAll('[data-i18n-aria-label]');
        ariaLabelElements.forEach(element => {
            const key = element.getAttribute('data-i18n-aria-label');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.setAttribute('aria-label', translation);
            }
        });

        console.log('🌐 AudioSettingsUI 初始翻译已应用');
    };

    /**
     * 更新所有翻译（包括静态文本和动态内容）
     */
    AudioSettingsUI.prototype.updateTranslations = function() {
        // 更新所有静态文本元素
        this.applyInitialTranslations();

        // 更新音效选择器的翻译
        this.updateAudioSelectTranslations();

        console.log('🌐 AudioSettingsUI 翻译已更新');
    };

    /**
     * 更新音效选择器的翻译
     */
    AudioSettingsUI.prototype.updateAudioSelectTranslations = function() {
        if (!this.audioSelect) return;

        const options = this.audioSelect.querySelectorAll('option[data-is-default="true"]');
        options.forEach(option => {
            const audioId = option.getAttribute('data-audio-id');
            const translationKey = option.getAttribute('data-translation-key');

            if (audioId && translationKey) {
                const audioData = this.audioManager.getAudioById(audioId);
                if (audioData) {
                    const translatedName = this.t(translationKey, audioData.name);
                    const defaultText = this.t('audio.notification.default', '缺省');
                    option.textContent = translatedName + ' (' + defaultText + ')';
                }
            }
        });
    };

    /**
     * 获取缺省音效的翻译键值
     */
    AudioSettingsUI.prototype.getDefaultAudioTranslationKey = function(audioId) {
        const translationMap = {
            'default-beep': 'audio.notification.defaultBeep',
            'notification-ding': 'audio.notification.notificationDing',
            'soft-chime': 'audio.notification.softChime'
        };
        return translationMap[audioId] || null;
    };

    // 导出到全域命名空间
    window.MCPFeedback.AudioSettingsUI = AudioSettingsUI;

})();
