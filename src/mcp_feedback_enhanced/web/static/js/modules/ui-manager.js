/**
 * MCP Feedback Enhanced - UI 管理模块
 * =================================
 * 
 * 处理 UI 状态更新、指示器管理和页签切换
 */

(function() {
    'use strict';

    // 确保命名空间和依赖存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * UI 管理器建构函数
     */
    function UIManager(options) {
        options = options || {};
        
        // 当前状态
        this.currentTab = options.currentTab || 'combined';
        this.feedbackState = Utils.CONSTANTS.FEEDBACK_WAITING;
        this.layoutMode = options.layoutMode || 'combined-vertical';
        this.lastSubmissionTime = null;
        
        // UI 元素
        this.connectionIndicator = null;
        this.connectionText = null;
        this.tabButtons = null;
        this.tabContents = null;
        this.submitBtn = null;
        this.feedbackText = null;
        
        // 回调函数
        this.onTabChange = options.onTabChange || null;
        this.onLayoutModeChange = options.onLayoutModeChange || null;

        // 初始化防抖函数
        this.initDebounceHandlers();

        this.initUIElements();
    }

    /**
     * 初始化防抖处理器
     */
    UIManager.prototype.initDebounceHandlers = function() {
        // 为状态指示器更新添加防抖
        this._debouncedUpdateStatusIndicator = Utils.DOM.debounce(
            this._originalUpdateStatusIndicator.bind(this),
            100,
            false
        );

        // 为状态指示器元素更新添加防抖
        this._debouncedUpdateStatusIndicatorElement = Utils.DOM.debounce(
            this._originalUpdateStatusIndicatorElement.bind(this),
            50,
            false
        );
    };

    /**
     * 初始化 UI 元素
     */
    UIManager.prototype.initUIElements = function() {
        // 基本 UI 元素
        this.connectionIndicator = Utils.safeQuerySelector('#connectionIndicator');
        this.connectionText = Utils.safeQuerySelector('#connectionText');

        // 页签相关元素
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');

        // 回馈相关元素
        this.submitBtn = Utils.safeQuerySelector('#submitBtn');

        console.log('✅ UI 元素初始化完成');
    };

    /**
     * 初始化页签功能
     */
    UIManager.prototype.initTabs = function() {
        const self = this;
        
        // 设置页签点击事件
        this.tabButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                const tabName = button.getAttribute('data-tab');
                self.switchTab(tabName);
            });
        });

        // 根据布局模式确定初始页签
        let initialTab = this.currentTab;
        if (this.layoutMode.startsWith('combined')) {
            initialTab = 'combined';
        } else if (this.currentTab === 'combined') {
            initialTab = 'feedback';
        }

        // 设置初始页签
        this.setInitialTab(initialTab);
    };

    /**
     * 设置初始页签（不触发保存）
     */
    UIManager.prototype.setInitialTab = function(tabName) {
        this.currentTab = tabName;
        this.updateTabDisplay(tabName);
        this.handleSpecialTabs(tabName);
        console.log('初始化页签: ' + tabName);
    };

    /**
     * 切换页签
     */
    UIManager.prototype.switchTab = function(tabName) {
        this.currentTab = tabName;
        this.updateTabDisplay(tabName);
        this.handleSpecialTabs(tabName);
        
        // 触发回调
        if (this.onTabChange) {
            this.onTabChange(tabName);
        }
        
        console.log('切换到页签: ' + tabName);
    };

    /**
     * 更新页签显示
     */
    UIManager.prototype.updateTabDisplay = function(tabName) {
        // 更新按钮状态
        this.tabButtons.forEach(function(button) {
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // 更新内容显示
        this.tabContents.forEach(function(content) {
            if (content.id === 'tab-' + tabName) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    };

    /**
     * 处理特殊页签
     */
    UIManager.prototype.handleSpecialTabs = function(tabName) {
        if (tabName === 'combined') {
            this.handleCombinedMode();
        }
    };

    /**
     * 处理合并模式
     */
    UIManager.prototype.handleCombinedMode = function() {
        console.log('切换到组合模式');
        
        // 确保合并模式的布局样式正确应用
        const combinedTab = Utils.safeQuerySelector('#tab-combined');
        if (combinedTab) {
            combinedTab.classList.remove('combined-vertical', 'combined-horizontal');
            if (this.layoutMode === 'combined-vertical') {
                combinedTab.classList.add('combined-vertical');
            } else if (this.layoutMode === 'combined-horizontal') {
                combinedTab.classList.add('combined-horizontal');
            }
        }
    };

    /**
     * 更新页签可见性
     */
    UIManager.prototype.updateTabVisibility = function() {
        const combinedTab = document.querySelector('.tab-button[data-tab="combined"]');
        const feedbackTab = document.querySelector('.tab-button[data-tab="feedback"]');
        const summaryTab = document.querySelector('.tab-button[data-tab="summary"]');

        // 只使用合并模式：显示合并模式页签，隐藏回馈和AI摘要页签
        if (combinedTab) combinedTab.style.display = 'inline-block';
        if (feedbackTab) feedbackTab.style.display = 'none';
        if (summaryTab) summaryTab.style.display = 'none';
    };

    /**
     * 设置回馈状态
     */
    UIManager.prototype.setFeedbackState = function(state, sessionId) {
        const previousState = this.feedbackState;
        this.feedbackState = state;

        if (sessionId) {
            console.log('🔄 会话 ID: ' + sessionId.substring(0, 8) + '...');
        }

        console.log('📊 状态变更: ' + previousState + ' → ' + state);
        this.updateUIState();
        this.updateStatusIndicator();
    };

    /**
     * 更新 UI 状态
     */
    UIManager.prototype.updateUIState = function() {
        this.updateSubmitButton();
        this.updateFeedbackInputs();
        this.updateImageUploadAreas();
    };

    /**
     * 更新提交按钮状态
     */
    UIManager.prototype.updateSubmitButton = function() {
        const submitButtons = [
            Utils.safeQuerySelector('#submitBtn')
        ].filter(function(btn) { return btn !== null; });

        const self = this;
        submitButtons.forEach(function(button) {
            if (!button) return;

            switch (self.feedbackState) {
                case Utils.CONSTANTS.FEEDBACK_WAITING:
                    button.textContent = window.i18nManager ? window.i18nManager.t('buttons.submit') : '提交回馈';
                    button.className = 'btn btn-primary';
                    button.disabled = false;
                    break;
                case Utils.CONSTANTS.FEEDBACK_PROCESSING:
                    button.textContent = window.i18nManager ? window.i18nManager.t('buttons.processing') : '处理中...';
                    button.className = 'btn btn-secondary';
                    button.disabled = true;
                    break;
                case Utils.CONSTANTS.FEEDBACK_SUBMITTED:
                    button.textContent = window.i18nManager ? window.i18nManager.t('buttons.submitted') : '已提交';
                    button.className = 'btn btn-success';
                    button.disabled = true;
                    break;
            }
        });
    };

    /**
     * 更新回馈输入框状态
     */
    UIManager.prototype.updateFeedbackInputs = function() {
        const feedbackInput = Utils.safeQuerySelector('#combinedFeedbackText');
        const canInput = this.feedbackState === Utils.CONSTANTS.FEEDBACK_WAITING;

        if (feedbackInput) {
            feedbackInput.disabled = !canInput;
        }
    };

    /**
     * 更新图片上传区域状态
     */
    UIManager.prototype.updateImageUploadAreas = function() {
        const uploadAreas = [
            Utils.safeQuerySelector('#feedbackImageUploadArea'),
            Utils.safeQuerySelector('#combinedImageUploadArea')
        ].filter(function(area) { return area !== null; });

        const canUpload = this.feedbackState === Utils.CONSTANTS.FEEDBACK_WAITING;
        uploadAreas.forEach(function(area) {
            if (canUpload) {
                area.classList.remove('disabled');
            } else {
                area.classList.add('disabled');
            }
        });
    };

    /**
     * 更新状态指示器（原始版本，供防抖使用）
     */
    UIManager.prototype._originalUpdateStatusIndicator = function() {
        const feedbackStatusIndicator = Utils.safeQuerySelector('#feedbackStatusIndicator');
        const combinedStatusIndicator = Utils.safeQuerySelector('#combinedFeedbackStatusIndicator');

        const statusInfo = this.getStatusInfo();

        if (feedbackStatusIndicator) {
            this._originalUpdateStatusIndicatorElement(feedbackStatusIndicator, statusInfo);
        }

        if (combinedStatusIndicator) {
            this._originalUpdateStatusIndicatorElement(combinedStatusIndicator, statusInfo);
        }

        // 减少重复日志：只在状态真正改变时记录
        if (!this._lastStatusInfo || this._lastStatusInfo.status !== statusInfo.status) {
            console.log('✅ 状态指示器已更新: ' + statusInfo.status + ' - ' + statusInfo.title);
            this._lastStatusInfo = statusInfo;
        }
    };

    /**
     * 更新状态指示器（防抖版本）
     */
    UIManager.prototype.updateStatusIndicator = function() {
        if (this._debouncedUpdateStatusIndicator) {
            this._debouncedUpdateStatusIndicator();
        } else {
            // 回退到原始方法（防抖未初始化时）
            this._originalUpdateStatusIndicator();
        }
    };

    /**
     * 获取状态信息
     */
    UIManager.prototype.getStatusInfo = function() {
        let icon, title, message, status;

        switch (this.feedbackState) {
            case Utils.CONSTANTS.FEEDBACK_WAITING:
                icon = '⏳';
                title = window.i18nManager ? window.i18nManager.t('status.waiting.title') : '等待回馈';
                message = window.i18nManager ? window.i18nManager.t('status.waiting.message') : '请提供您的回馈意见';
                status = 'waiting';
                break;

            case Utils.CONSTANTS.FEEDBACK_PROCESSING:
                icon = '⚙️';
                title = window.i18nManager ? window.i18nManager.t('status.processing.title') : '处理中';
                message = window.i18nManager ? window.i18nManager.t('status.processing.message') : '正在提交您的回馈...';
                status = 'processing';
                break;

            case Utils.CONSTANTS.FEEDBACK_SUBMITTED:
                const timeStr = this.lastSubmissionTime ?
                    new Date(this.lastSubmissionTime).toLocaleTimeString() : '';
                icon = '✅';
                title = window.i18nManager ? window.i18nManager.t('status.submitted.title') : '回馈已提交';
                message = window.i18nManager ? window.i18nManager.t('status.submitted.message') : '等待下次 MCP 调用';
                if (timeStr) {
                    message += ' (' + timeStr + ')';
                }
                status = 'submitted';
                break;

            default:
                icon = '⏳';
                title = window.i18nManager ? window.i18nManager.t('status.waiting.title') : '等待回馈';
                message = window.i18nManager ? window.i18nManager.t('status.waiting.message') : '请提供您的回馈意见';
                status = 'waiting';
        }

        return { icon: icon, title: title, message: message, status: status };
    };

    /**
     * 更新单个状态指示器元素（原始版本，供防抖使用）
     */
    UIManager.prototype._originalUpdateStatusIndicatorElement = function(element, statusInfo) {
        if (!element) return;

        // 更新状态类别
        element.className = 'feedback-status-indicator status-' + statusInfo.status;
        element.style.display = 'block';

        // 更新标题
        const titleElement = element.querySelector('.status-title');
        if (titleElement) {
            titleElement.textContent = statusInfo.icon + ' ' + statusInfo.title;
        }

        // 更新消息
        const messageElement = element.querySelector('.status-message');
        if (messageElement) {
            messageElement.textContent = statusInfo.message;
        }

        // 减少重复日志：只记录元素 ID 变化
        if (element.id) {
            console.log('🔧 已更新状态指示器: ' + element.id + ' -> ' + statusInfo.status);
        }
    };

    /**
     * 更新单个状态指示器元素（防抖版本）
     */
    UIManager.prototype.updateStatusIndicatorElement = function(element, statusInfo) {
        if (this._debouncedUpdateStatusIndicatorElement) {
            this._debouncedUpdateStatusIndicatorElement(element, statusInfo);
        } else {
            // 回退到原始方法（防抖未初始化时）
            this._originalUpdateStatusIndicatorElement(element, statusInfo);
        }
    };

    /**
     * 更新连接状态
     */
    UIManager.prototype.updateConnectionStatus = function(status, text) {
        if (this.connectionIndicator) {
            this.connectionIndicator.className = 'connection-indicator ' + status;
        }
        if (this.connectionText) {
            this.connectionText.textContent = text;
        }
    };

    /**
     * 安全地渲染 Markdown 内容
     */
    UIManager.prototype.renderMarkdownSafely = function(content) {
        try {
            // 检查 marked 和 DOMPurify 是否可用
            if (typeof window.marked === 'undefined' || typeof window.DOMPurify === 'undefined') {
                console.warn('⚠️ Markdown 库未加载，使用纯文本显示');
                return this.escapeHtml(content);
            }

            // 使用 marked 解析 Markdown
            const htmlContent = window.marked.parse(content);

            // 使用 DOMPurify 清理 HTML
            const cleanHtml = window.DOMPurify.sanitize(htmlContent, {
                ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr', 'del', 's', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
                ALLOWED_ATTR: ['href', 'title', 'class', 'align', 'style'],
                ALLOW_DATA_ATTR: false
            });

            return cleanHtml;
        } catch (error) {
            console.error('❌ Markdown 渲染失败:', error);
            return this.escapeHtml(content);
        }
    };

    /**
     * HTML 转义函数
     */
    UIManager.prototype.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    /**
     * 更新 AI 摘要内容
     */
    UIManager.prototype.updateAISummaryContent = function(summary) {
        console.log('📝 更新 AI 摘要内容...', '内容长度:', summary ? summary.length : 'undefined');
        console.log('📝 marked 可用:', typeof window.marked !== 'undefined');
        console.log('📝 DOMPurify 可用:', typeof window.DOMPurify !== 'undefined');

        // 渲染 Markdown 内容
        const renderedContent = this.renderMarkdownSafely(summary);
        console.log('📝 渲染后内容长度:', renderedContent ? renderedContent.length : 'undefined');

        const summaryContent = Utils.safeQuerySelector('#summaryContent');
        if (summaryContent) {
            summaryContent.innerHTML = renderedContent;
            console.log('✅ 已更新分页模式摘要内容（Markdown 渲染）');
        } else {
            console.warn('⚠️ 找不到 #summaryContent 元素');
        }

        const combinedSummaryContent = Utils.safeQuerySelector('#combinedSummaryContent');
        if (combinedSummaryContent) {
            combinedSummaryContent.innerHTML = renderedContent;
            console.log('✅ 已更新合并模式摘要内容（Markdown 渲染）');
        } else {
            console.warn('⚠️ 找不到 #combinedSummaryContent 元素');
        }
    };

    /**
     * 重置回馈表单
     * @param {boolean} clearText - 是否清空文本内容，缺省为 false
     */
    UIManager.prototype.resetFeedbackForm = function(clearText) {
        console.log('🔄 重置回馈表单...');

        // 根据参数决定是否清空回馈输入
        const feedbackInput = Utils.safeQuerySelector('#combinedFeedbackText');
        if (feedbackInput) {
            if (clearText === true) {
                feedbackInput.value = '';
                console.log('📝 已清空文本内容');
            }
            // 只有在等待状态才激活输入框
            const canInput = this.feedbackState === Utils.CONSTANTS.FEEDBACK_WAITING;
            feedbackInput.disabled = !canInput;
        }

        // 重新激活提交按钮
        const submitButtons = [
            Utils.safeQuerySelector('#submitBtn')
        ].filter(function(btn) { return btn !== null; });

        submitButtons.forEach(function(button) {
            button.disabled = false;
            const defaultText = window.i18nManager ? window.i18nManager.t('buttons.submit') : '提交回馈';
            button.textContent = button.getAttribute('data-original-text') || defaultText;
        });

        console.log('✅ 回馈表单重置完成');
    };

    /**
     * 应用布局模式
     */
    UIManager.prototype.applyLayoutMode = function(layoutMode) {
        this.layoutMode = layoutMode;
        
        const expectedClassName = 'layout-' + layoutMode;
        if (document.body.className !== expectedClassName) {
            console.log('应用布局模式: ' + layoutMode);
            document.body.className = expectedClassName;
        }

        this.updateTabVisibility();
        
        // 如果当前页签不是合并模式，则切换到合并模式页签
        if (this.currentTab !== 'combined') {
            this.currentTab = 'combined';
        }
        
        // 触发回调
        if (this.onLayoutModeChange) {
            this.onLayoutModeChange(layoutMode);
        }
    };

    /**
     * 获取当前页签
     */
    UIManager.prototype.getCurrentTab = function() {
        return this.currentTab;
    };

    /**
     * 获取当前回馈状态
     */
    UIManager.prototype.getFeedbackState = function() {
        return this.feedbackState;
    };

    /**
     * 设置最后提交时间
     */
    UIManager.prototype.setLastSubmissionTime = function(timestamp) {
        this.lastSubmissionTime = timestamp;
        this.updateStatusIndicator();
    };

    // 将 UIManager 加入命名空间
    window.MCPFeedback.UIManager = UIManager;

    console.log('✅ UIManager 模块加载完成');

})();
