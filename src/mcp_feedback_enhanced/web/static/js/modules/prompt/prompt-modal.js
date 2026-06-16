/**
 * MCP Feedback Enhanced - 提示词弹窗管理模块
 * ==========================================
 * 
 * 处理提示词添加、编辑、选择的弹窗接口
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Prompt = window.MCPFeedback.Prompt || {};

    const Utils = window.MCPFeedback.Utils;

    /**
     * 提示词弹窗管理器
     */
    function PromptModal(options) {
        options = options || {};

        // 弹窗选项
        this.enableEscapeClose = options.enableEscapeClose !== false;
        this.enableBackdropClose = options.enableBackdropClose !== false;

        // 当前弹窗引用
        this.currentModal = null;
        this.keydownHandler = null;

        // 回调函数
        this.onSave = options.onSave || null;
        this.onSelect = options.onSelect || null;
        this.onCancel = options.onCancel || null;

        console.log('🔍 PromptModal 初始化完成');
    }

    /**
     * 显示添加提示词弹窗
     */
    PromptModal.prototype.showAddModal = function() {
        const modalData = {
            type: 'add',
            title: this.t('prompts.modal.addTitle', '添加提示词'),
            prompt: {
                name: '',
                content: ''
            }
        };

        this.createAndShowModal(modalData);
    };

    /**
     * 显示编辑提示词弹窗
     */
    PromptModal.prototype.showEditModal = function(prompt) {
        if (!prompt) {
            console.error('❌ 编辑提示词时缺少提示词数据');
            return;
        }

        const modalData = {
            type: 'edit',
            title: this.t('prompts.modal.editTitle', '编辑提示词'),
            prompt: {
                id: prompt.id,
                name: prompt.name,
                content: prompt.content
            }
        };

        this.createAndShowModal(modalData);
    };

    /**
     * 显示选择提示词弹窗
     */
    PromptModal.prototype.showSelectModal = function(prompts) {
        if (!prompts || !Array.isArray(prompts)) {
            console.error('❌ 选择提示词时缺少提示词列表');
            return;
        }

        const modalData = {
            type: 'select',
            title: this.t('prompts.select.title', '选择常用提示词'),
            prompts: prompts
        };

        this.createAndShowModal(modalData);
    };

    /**
     * 创建并显示弹窗
     */
    PromptModal.prototype.createAndShowModal = function(modalData) {
        // 如果已有弹窗，先关闭
        if (this.currentModal) {
            this.closeModal();
        }

        // 创建弹窗 HTML
        const modalHtml = this.createModalHTML(modalData);

        // 插入到页面中
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 获取弹窗元素
        this.currentModal = document.getElementById('promptModal');

        // 设置事件监听器
        this.setupEventListeners(modalData);

        // 添加显示动画
        this.showModal();

        // 聚焦到第一个输入框
        this.focusFirstInput();
    };

    /**
     * 创建弹窗 HTML
     */
    PromptModal.prototype.createModalHTML = function(modalData) {
        const modalId = 'promptModal';
        
        if (modalData.type === 'select') {
            return this.createSelectModalHTML(modalId, modalData);
        } else {
            return this.createEditModalHTML(modalId, modalData);
        }
    };

    /**
     * 创建编辑弹窗 HTML
     */
    PromptModal.prototype.createEditModalHTML = function(modalId, modalData) {
        return `
            <div id="${modalId}" class="modal-overlay">
                <div class="modal-container">
                    <div class="modal-header">
                        <h3 class="modal-title">${Utils.escapeHtml(modalData.title)}</h3>
                        <button type="button" class="modal-close-btn" aria-label="关闭">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="promptForm" class="prompt-form">
                            <div class="input-group">
                                <label for="promptName" class="input-label">${this.t('prompts.modal.nameLabel', '提示词名称')}</label>
                                <input 
                                    type="text" 
                                    id="promptName" 
                                    class="text-input" 
                                    value="${Utils.escapeHtml(modalData.prompt.name)}"
                                    placeholder="${this.t('prompts.modal.namePlaceholder', '请输入提示词名称...')}"
                                    required
                                    maxlength="100"
                                />
                            </div>
                            <div class="input-group">
                                <label for="promptContent" class="input-label">${this.t('prompts.modal.contentLabel', '提示词内容')}</label>
                                <textarea 
                                    id="promptContent" 
                                    class="text-input" 
                                    placeholder="${this.t('prompts.modal.contentPlaceholder', '请输入提示词内容...')}"
                                    required
                                    rows="8"
                                    style="min-height: 200px; resize: vertical;"
                                >${Utils.escapeHtml(modalData.prompt.content)}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary modal-cancel-btn">
                            ${this.t('prompts.modal.cancel', '取消')}
                        </button>
                        <button type="submit" form="promptForm" class="btn btn-primary modal-save-btn">
                            ${this.t('prompts.modal.save', '保存')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    /**
     * 创建选择弹窗 HTML
     */
    PromptModal.prototype.createSelectModalHTML = function(modalId, modalData) {
        const promptsHtml = modalData.prompts.map(prompt => `
            <div class="prompt-item" data-prompt-id="${prompt.id}">
                <div class="prompt-item-header">
                    <h4 class="prompt-item-name">${Utils.escapeHtml(prompt.name)}</h4>
                    <span class="prompt-item-date">${this.formatDate(prompt.createdAt)}</span>
                </div>
                <div class="prompt-item-content">${Utils.escapeHtml(this.truncateText(prompt.content, 100))}</div>
                ${prompt.lastUsedAt ? `<div class="prompt-item-used">最近使用：${this.formatDate(prompt.lastUsedAt)}</div>` : ''}
            </div>
        `).join('');

        return `
            <div id="${modalId}" class="modal-overlay">
                <div class="modal-container modal-large">
                    <div class="modal-header">
                        <h3 class="modal-title">${Utils.escapeHtml(modalData.title)}</h3>
                        <button type="button" class="modal-close-btn" aria-label="关闭">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="prompt-list">
                            ${promptsHtml || '<div class="empty-state">尚无常用提示词</div>'}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary modal-cancel-btn">
                            ${this.t('prompts.modal.cancel', '取消')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    /**
     * 设置事件监听器
     */
    PromptModal.prototype.setupEventListeners = function(modalData) {
        const self = this;

        // 关闭按钮
        const closeBtn = this.currentModal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                self.closeModal();
            });
        }

        // 取消按钮
        const cancelBtn = this.currentModal.querySelector('.modal-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                self.closeModal();
            });
        }

        // 背景点击关闭
        if (this.enableBackdropClose) {
            this.currentModal.addEventListener('click', function(e) {
                if (e.target === self.currentModal) {
                    self.closeModal();
                }
            });
        }

        // ESC 键关闭
        if (this.enableEscapeClose) {
            this.keydownHandler = function(e) {
                if (e.key === 'Escape') {
                    self.closeModal();
                }
            };
            document.addEventListener('keydown', this.keydownHandler);
        }

        // 根据弹窗类型设置特定事件
        if (modalData.type === 'select') {
            this.setupSelectModalEvents();
        } else {
            this.setupEditModalEvents(modalData);
        }
    };

    /**
     * 设置编辑弹窗事件
     */
    PromptModal.prototype.setupEditModalEvents = function(modalData) {
        const self = this;
        const form = this.currentModal.querySelector('#promptForm');
        
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                self.handleFormSubmit(modalData);
            });
        }
    };

    /**
     * 设置选择弹窗事件
     */
    PromptModal.prototype.setupSelectModalEvents = function() {
        const self = this;
        const promptItems = this.currentModal.querySelectorAll('.prompt-item');
        
        promptItems.forEach(function(item) {
            item.addEventListener('click', function() {
                const promptId = item.getAttribute('data-prompt-id');
                self.handlePromptSelect(promptId);
            });
        });
    };

    /**
     * 处理表单提交
     */
    PromptModal.prototype.handleFormSubmit = function(modalData) {
        const nameInput = this.currentModal.querySelector('#promptName');
        const contentInput = this.currentModal.querySelector('#promptContent');
        
        if (!nameInput || !contentInput) {
            console.error('❌ 找不到表单输入元素');
            return;
        }

        const name = nameInput.value.trim();
        const content = contentInput.value.trim();

        if (!name || !content) {
            this.showError(this.t('prompts.modal.emptyFields', '请填写所有必填字段'));
            return;
        }

        const promptData = {
            name: name,
            content: content
        };

        if (modalData.type === 'edit') {
            promptData.id = modalData.prompt.id;
        }

        // 触发保存回调
        if (this.onSave) {
            try {
                this.onSave(promptData, modalData.type);
                this.closeModal();
            } catch (error) {
                this.showError(error.message);
            }
        }
    };

    /**
     * 处理提示词选择
     */
    PromptModal.prototype.handlePromptSelect = function(promptId) {
        if (this.onSelect) {
            this.onSelect(promptId);
        }
        this.closeModal();
    };

    /**
     * 显示弹窗动画
     */
    PromptModal.prototype.showModal = function() {
        if (!this.currentModal) return;

        // 添加显示类触发动画
        requestAnimationFrame(() => {
            this.currentModal.classList.add('show');
        });
    };

    /**
     * 关闭弹窗
     */
    PromptModal.prototype.closeModal = function() {
        if (!this.currentModal) return;

        // 移除键盘事件监听器
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }

        // 添加关闭动画
        this.currentModal.classList.add('hide');

        // 延迟移除元素
        setTimeout(() => {
            if (this.currentModal) {
                this.currentModal.remove();
                this.currentModal = null;
            }
        }, 300); // 与 CSS 动画时间一致

        // 触发取消回调
        if (this.onCancel) {
            this.onCancel();
        }
    };

    /**
     * 聚焦到第一个输入框
     */
    PromptModal.prototype.focusFirstInput = function() {
        if (!this.currentModal) return;

        const firstInput = this.currentModal.querySelector('input, textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 100);
        }
    };

    /**
     * 显示错误消息
     */
    PromptModal.prototype.showError = function(message) {
        if (window.MCPFeedback && window.MCPFeedback.Utils && window.MCPFeedback.Utils.showMessage) {
            window.MCPFeedback.Utils.showMessage(message, 'error');
        } else {
            alert(message);
        }
    };

    /**
     * 翻译函数
     */
    PromptModal.prototype.t = function(key, fallback) {
        if (window.i18nManager && typeof window.i18nManager.t === 'function') {
            return window.i18nManager.t(key, fallback);
        }
        return fallback || key;
    };

    /**
     * 格式化日期
     */
    PromptModal.prototype.formatDate = function(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (error) {
            return dateString;
        }
    };

    /**
     * 截断文本
     */
    PromptModal.prototype.truncateText = function(text, maxLength) {
        if (!text || text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    };

    // 将 PromptModal 加入命名空间
    window.MCPFeedback.Prompt.PromptModal = PromptModal;

    console.log('✅ PromptModal 模块加载完成');

})();
