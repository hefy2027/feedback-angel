/**
 * MCP Feedback Enhanced - 会话详情弹窗模块
 * =======================================
 * 
 * 负责会话详情弹窗的创建、显示和管理
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Session = window.MCPFeedback.Session || {};

    const DOMUtils = window.MCPFeedback.Utils.DOM;
    const TimeUtils = window.MCPFeedback.Utils.Time;
    const StatusUtils = window.MCPFeedback.Utils.Status;

    /**
     * 会话详情弹窗管理器
     */
    function SessionDetailsModal(options) {
        options = options || {};

        // 弹窗选项
        this.enableEscapeClose = options.enableEscapeClose !== false;
        this.enableBackdropClose = options.enableBackdropClose !== false;
        this.showFullSessionId = options.showFullSessionId || false;

        // 当前弹窗引用
        this.currentModal = null;
        this.keydownHandler = null;

        // console.log('🔍 SessionDetailsModal 初始化完成');
    }

    /**
     * 显示会话详情
     */
    SessionDetailsModal.prototype.showSessionDetails = function(sessionData) {
        if (!sessionData) {
            this.showError('没有可显示的会话数据');
            return;
        }

        // console.log('🔍 显示会话详情:', sessionData.session_id);

        // 存储当前会话数据，供复制功能使用
        this.currentSessionData = sessionData;

        // 关闭现有弹窗
        this.closeModal();

        // 格式化会话详情
        const details = this.formatSessionDetails(sessionData);

        // 创建并显示弹窗
        this.createAndShowModal(details);
    };

    /**
     * 格式化会话详情
     */
    SessionDetailsModal.prototype.formatSessionDetails = function(sessionData) {
        // console.log('🔍 格式化会话详情:', sessionData);

        // 处理会话 ID - 显示完整 session ID
        const sessionId = sessionData.session_id || '未知';

        // 处理创建时间
        const createdTime = sessionData.created_at ?
            TimeUtils.formatTimestamp(sessionData.created_at) :
            '未知';

        // 处理持续时间
        let duration = '进行中';
        if (sessionData.duration && sessionData.duration > 0) {
            duration = TimeUtils.formatDuration(sessionData.duration);
        } else if (sessionData.created_at && sessionData.completed_at) {
            const durationSeconds = sessionData.completed_at - sessionData.created_at;
            duration = TimeUtils.formatDuration(durationSeconds);
        } else if (sessionData.created_at) {
            const elapsed = TimeUtils.calculateElapsedTime(sessionData.created_at);
            if (elapsed > 0) {
                duration = TimeUtils.formatDuration(elapsed) + ' (进行中)';
            }
        }

        // 处理状态
        const status = sessionData.status || 'waiting';
        const statusText = StatusUtils.getStatusText(status);
        const statusColor = StatusUtils.getStatusColor(status);

        // 处理用户消息记录
        const userMessages = sessionData.user_messages || [];
        const userMessageCount = userMessages.length;

        return {
            sessionId: sessionId,
            status: statusText,
            statusColor: statusColor,
            createdTime: createdTime,
            duration: duration,
            projectDirectory: sessionData.project_directory || (window.i18nManager ? window.i18nManager.t('sessionManagement.sessionDetails.unknown') : '未知'),
            summary: sessionData.summary || (window.i18nManager ? window.i18nManager.t('sessionManagement.sessionDetails.noSummary') : '暂无摘要'),
            userMessages: userMessages,
            userMessageCount: userMessageCount
        };
    };

    /**
     * 创建并显示弹窗
     */
    SessionDetailsModal.prototype.createAndShowModal = function(details) {
        // 创建弹窗 HTML
        const modalHtml = this.createModalHTML(details);

        // 插入到页面中
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 获取弹窗元素
        this.currentModal = document.getElementById('sessionDetailsModal');

        // 设置事件监听器
        this.setupEventListeners();

        // 添加显示动画
        this.showModal();
    };

    /**
     * 创建弹窗 HTML
     */
    SessionDetailsModal.prototype.createModalHTML = function(details) {
        const i18n = window.i18nManager;
        const title = i18n ? i18n.t('sessionManagement.sessionDetails.title') : '会话详细信息';
        const closeLabel = i18n ? i18n.t('sessionManagement.sessionDetails.close') : '关闭';
        const sessionIdLabel = i18n ? i18n.t('sessionManagement.sessionId') : '会话 ID';
        const statusLabel = i18n ? i18n.t('sessionManagement.status') : '状态';

        return `
            <div class="session-details-modal" id="sessionDetailsModal">
                <div class="modal-backdrop"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close" id="closeSessionDetails" aria-label="${closeLabel}">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-row">
                            <span class="detail-label">${sessionIdLabel}:</span>
                            <span class="detail-value session-id" title="${details.sessionId}">${details.sessionId}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${statusLabel}:</span>
                            <span class="detail-value" style="color: ${details.statusColor};">${details.status}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${i18n ? i18n.t('sessionManagement.createdTime') : '创建时间'}:</span>
                            <span class="detail-value">${details.createdTime}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${i18n ? i18n.t('sessionManagement.sessionDetails.duration') : '持续时间'}:</span>
                            <span class="detail-value">${details.duration}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${i18n ? i18n.t('sessionManagement.sessionDetails.projectDirectory') : '项目目录'}:</span>
                            <span class="detail-value project-path" title="${details.projectDirectory}">${details.projectDirectory}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${i18n ? i18n.t('sessionManagement.aiSummary') : 'AI 摘要'}:</span>
                            <div class="detail-value summary">
                                <div class="summary-actions">
                                    <button class="btn-copy-summary" title="拷贝摘要" aria-label="拷贝摘要">📋</button>
                                </div>
                                <div class="summary-content">${this.renderMarkdownSafely(details.summary)}</div>
                            </div>
                        </div>
                        ${this.createUserMessagesSection(details)}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" id="closeSessionDetailsBtn">${closeLabel}</button>
                    </div>
                </div>
            </div>
        `;
    };

    /**
     * 创建用户消息记录区段
     */
    SessionDetailsModal.prototype.createUserMessagesSection = function(details) {
        const i18n = window.i18nManager;
        const userMessages = details.userMessages || [];

        if (userMessages.length === 0) {
            return '';
        }

        const sectionTitle = i18n ? i18n.t('sessionHistory.userMessages.title') : '用户消息记录';
        const messageCountLabel = i18n ? i18n.t('sessionHistory.userMessages.messageCount') : '消息数量';

        let messagesHtml = '';

        userMessages.forEach((message, index) => {
            const timestamp = message.timestamp ? TimeUtils.formatTimestamp(message.timestamp) : '未知时间';
            const submissionMethod = message.submission_method === 'auto' ?
                (i18n ? i18n.t('sessionHistory.userMessages.auto') : '自动提交') :
                (i18n ? i18n.t('sessionHistory.userMessages.manual') : '手动提交');

            let contentHtml = '';

            if (message.content !== undefined) {
                // 完整记录模式
                const contentPreview = message.content.length > 100 ?
                    message.content.substring(0, 100) + '...' :
                    message.content;
                contentHtml = `
                    <div class="message-content">
                        <strong>内容:</strong> ${this.escapeHtml(contentPreview)}
                    </div>
                `;

                if (message.images && message.images.length > 0) {
                    const imageCountText = i18n ? i18n.t('sessionHistory.userMessages.imageCount') : '图片数量';
                    contentHtml += `
                        <div class="message-images">
                            <strong>${imageCountText}:</strong> ${message.images.length}
                        </div>
                    `;
                }
            } else if (message.content_length !== undefined) {
                // 基本统计模式
                const contentLengthLabel = i18n ? i18n.t('sessionHistory.userMessages.contentLength') : '内容长度';
                const imageCountLabel = i18n ? i18n.t('sessionHistory.userMessages.imageCount') : '图片数量';
                contentHtml = `
                    <div class="message-stats">
                        <strong>${contentLengthLabel}:</strong> ${message.content_length} 字符<br>
                        <strong>${imageCountLabel}:</strong> ${message.image_count || 0}
                    </div>
                `;
            } else if (message.privacy_note) {
                // 隐私保护模式
                contentHtml = `
                    <div class="message-privacy">
                        <em style="color: var(--text-secondary);">内容记录已停用（隐私设置）</em>
                    </div>
                `;
            }

            messagesHtml += `
                <div class="user-message-item" data-message-index="${index}">
                    <div class="message-header">
                        <span class="message-index">#${index + 1}</span>
                        <span class="message-time">${timestamp}</span>
                        <span class="message-method">${submissionMethod}</span>
                        <button class="btn-copy-message" title="拷贝消息内容" aria-label="拷贝消息内容" data-message-content="${this.escapeHtml(message.content)}">📋</button>
                    </div>
                    ${contentHtml}
                </div>
            `;
        });

        return `
            <div class="detail-row user-messages-section">
                <span class="detail-label">${sectionTitle}:</span>
                <div class="detail-value">
                    <div class="user-messages-summary">
                        <strong>${messageCountLabel}:</strong> ${userMessages.length}
                    </div>
                    <div class="user-messages-list">
                        ${messagesHtml}
                    </div>
                </div>
            </div>
        `;
    };

    /**
     * 设置事件监听器
     */
    SessionDetailsModal.prototype.setupEventListeners = function() {
        if (!this.currentModal) return;

        const self = this;

        // 关闭按钮
        const closeBtn = this.currentModal.querySelector('#closeSessionDetails');
        const closeFooterBtn = this.currentModal.querySelector('#closeSessionDetailsBtn');

        if (closeBtn) {
            DOMUtils.addEventListener(closeBtn, 'click', function() {
                self.closeModal();
            });
        }

        if (closeFooterBtn) {
            DOMUtils.addEventListener(closeFooterBtn, 'click', function() {
                self.closeModal();
            });
        }

        // 背景点击关闭
        if (this.enableBackdropClose) {
            const backdrop = this.currentModal.querySelector('.modal-backdrop');
            if (backdrop) {
                DOMUtils.addEventListener(backdrop, 'click', function() {
                    self.closeModal();
                });
            }
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

        // 复制摘要按钮
        const copyBtn = this.currentModal.querySelector('.btn-copy-summary');
        if (copyBtn) {
            DOMUtils.addEventListener(copyBtn, 'click', function() {
                self.copySummaryToClipboard();
            });
        }

        // 复制用户消息按钮
        const copyMessageBtns = this.currentModal.querySelectorAll('.btn-copy-message');
        copyMessageBtns.forEach(function(btn) {
            DOMUtils.addEventListener(btn, 'click', function(e) {
                e.stopPropagation(); // 防止事件冒泡
                const messageContent = btn.getAttribute('data-message-content');
                self.copyMessageToClipboard(messageContent);
            });
        });
    };

    /**
     * 显示弹窗动画
     */
    SessionDetailsModal.prototype.showModal = function() {
        if (!this.currentModal) return;

        // 弹窗已经通过 CSS 动画自动显示，无需额外处理
        // console.log('🔍 会话详情弹窗已显示');
    };

    /**
     * 关闭弹窗
     */
    SessionDetailsModal.prototype.closeModal = function() {
        if (!this.currentModal) return;

        // 移除键盘事件监听器
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }

        // 立即移除元素，无延迟
        DOMUtils.safeRemoveElement(this.currentModal);
        this.currentModal = null;
    };

    /**
     * 显示错误消息
     */
    SessionDetailsModal.prototype.showError = function(message) {
        if (window.MCPFeedback && window.MCPFeedback.Utils && window.MCPFeedback.Utils.showMessage) {
            window.MCPFeedback.Utils.showMessage(message, 'error');
        } else {
            alert(message);
        }
    };

    /**
     * HTML 转义
     */
    SessionDetailsModal.prototype.escapeHtml = function(text) {
        if (!text) return '';

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    /**
     * 安全地渲染 Markdown 内容
     */
    SessionDetailsModal.prototype.renderMarkdownSafely = function(content) {
        if (!content) return '';

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
     * 传统拷贝文本到剪贴板的方法
     */
    SessionDetailsModal.prototype.fallbackCopyTextToClipboard = function(text, successMessage) {
        const self = this;
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                // console.log('✅ 内容已拷贝到剪贴板（传统方法）');
                self.showToast(successMessage, 'success');
            } else {
                console.error('❌ 拷贝失败（传统方法）');
                self.showToast('❌ 拷贝失败，请手动拷贝', 'error');
            }
        } catch (err) {
            console.error('❌ 拷贝失败:', err);
            self.showToast('❌ 拷贝失败，请手动拷贝', 'error');
        } finally {
            document.body.removeChild(textArea);
        }
    };

    /**
     * 拷贝摘要内容到剪贴板
     */
    SessionDetailsModal.prototype.copySummaryToClipboard = function() {
        const self = this;

        try {
            // 获取原始摘要内容（Markdown 原代码）
            const summaryContent = this.currentSessionData && this.currentSessionData.summary ?
                this.currentSessionData.summary : '';

            if (!summaryContent) {
                console.warn('⚠️ 没有摘要内容可拷贝');
                return;
            }

            // 使用现代 Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(summaryContent).then(function() {
                    // console.log('✅ 摘要内容已拷贝到剪贴板');
                    self.showToast('✅ 摘要已拷贝到剪贴板', 'success');
                }).catch(function(err) {
                    console.error('❌ 拷贝失败:', err);
                    // 降级到传统方法
                    self.fallbackCopyTextToClipboard(summaryContent, '✅ 摘要已拷贝到剪贴板');
                });
            } else {
                // 降级到传统方法
                this.fallbackCopyTextToClipboard(summaryContent, '✅ 摘要已拷贝到剪贴板');
            }
        } catch (error) {
            console.error('❌ 拷贝摘要时发生错误:', error);
            this.showToast('❌ 拷贝失败，请手动拷贝', 'error');
        }
    };

    /**
     * 拷贝用户消息内容到剪贴板
     */
    SessionDetailsModal.prototype.copyMessageToClipboard = function(messageContent) {
        if (!messageContent) {
            console.warn('⚠️ 没有消息内容可拷贝');
            return;
        }

        const self = this;

        try {
            // 使用现代 Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(messageContent).then(function() {
                    // console.log('✅ 用户消息已拷贝到剪贴板');
                    self.showToast('✅ 消息已拷贝到剪贴板', 'success');
                }).catch(function(err) {
                    console.error('❌ 拷贝失败:', err);
                    // 降级到传统方法
                    self.fallbackCopyTextToClipboard(messageContent, '✅ 消息已拷贝到剪贴板');
                });
            } else {
                // 降级到传统方法
                this.fallbackCopyTextToClipboard(messageContent, '✅ 消息已拷贝到剪贴板');
            }
        } catch (error) {
            console.error('❌ 拷贝用户消息时发生错误:', error);
            this.showToast('❌ 拷贝失败，请手动拷贝', 'error');
        }
    };



    /**
     * 显示提示消息
     */
    SessionDetailsModal.prototype.showToast = function(message, type) {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = 'copy-toast copy-toast-' + type;
        toast.textContent = message;

        // 添加到弹窗中
        if (this.currentModal) {
            this.currentModal.appendChild(toast);

            // 显示动画
            setTimeout(function() {
                toast.classList.add('show');
            }, 10);

            // 自动隐藏
            setTimeout(function() {
                toast.classList.remove('show');
                setTimeout(function() {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 2000);
        }
    };

    /**
     * 检查是否有弹窗打开
     */
    SessionDetailsModal.prototype.isModalOpen = function() {
        return this.currentModal !== null;
    };

    /**
     * 强制关闭所有弹窗
     */
    SessionDetailsModal.prototype.forceCloseAll = function() {
        // 关闭当前弹窗
        this.closeModal();

        // 清理可能遗留的弹窗元素
        const existingModals = document.querySelectorAll('.session-details-modal');
        existingModals.forEach(modal => {
            DOMUtils.safeRemoveElement(modal);
        });

        // 清理事件监听器
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }

        this.currentModal = null;
    };

    /**
     * 清理资源
     */
    SessionDetailsModal.prototype.cleanup = function() {
        this.forceCloseAll();
        // console.log('🔍 SessionDetailsModal 清理完成');
    };

    // 将 SessionDetailsModal 加入命名空间
    window.MCPFeedback.Session.DetailsModal = SessionDetailsModal;

    // console.log('✅ SessionDetailsModal 模块加载完成');

})();
