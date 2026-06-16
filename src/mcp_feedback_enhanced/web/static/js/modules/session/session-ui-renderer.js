/**
 * MCP Feedback Enhanced - 会话 UI 渲染模块
 * =======================================
 * 
 * 负责会话相关的 UI 渲染和更新
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Session = window.MCPFeedback.Session || {};

    const DOMUtils = window.MCPFeedback.Utils.DOM;
    const TimeUtils = window.MCPFeedback.Utils.Time;

    // 创建模块专用日志器
    const logger = window.MCPFeedback.Logger ?
        new window.MCPFeedback.Logger({ moduleName: 'SessionUIRenderer' }) :
        console;
    const StatusUtils = window.MCPFeedback.Utils.Status;
    
    // 调试模式标志 - 生产环境应设为 false
    const DEBUG_MODE = false;

    /**
     * 会话 UI 渲染器
     */
    function SessionUIRenderer(options) {
        options = options || {};

        // UI 元素引用
        this.currentSessionCard = null;
        this.historyList = null;
        this.statsElements = {};

        // 渲染选项
        this.showFullSessionId = options.showFullSessionId || false;
        this.enableAnimations = options.enableAnimations !== false;

        // 活跃时间定时器
        this.activeTimeTimer = null;
        this.currentSessionData = null;

        // 渲染防抖机制
        this.renderDebounceTimers = {
            stats: null,
            history: null,
            currentSession: null
        };
        this.renderDebounceDelay = options.renderDebounceDelay || 100; // 缺省 100ms 防抖延迟

        // 缓存上次渲染的数据，避免不必要的重渲染
        this.lastRenderedData = {
            stats: null,
            historyLength: 0,
            currentSessionId: null
        };

        this.initializeElements();
        this.initializeProjectPathDisplay();
        this.startActiveTimeTimer();

        logger.info('SessionUIRenderer 初始化完成，渲染防抖延迟:', this.renderDebounceDelay + 'ms');
    }

    /**
     * 初始化 UI 元素
     */
    SessionUIRenderer.prototype.initializeElements = function() {
        this.currentSessionCard = DOMUtils.safeQuerySelector('#currentSessionCard');
        this.historyList = DOMUtils.safeQuerySelector('#sessionHistoryList');

        // 统计元素
        this.statsElements = {
            todayCount: DOMUtils.safeQuerySelector('.stat-today-count'),
            averageDuration: DOMUtils.safeQuerySelector('.stat-average-duration')
        };
    };

    /**
     * 初始化项目路径显示
     */
    SessionUIRenderer.prototype.initializeProjectPathDisplay = function() {
        if (DEBUG_MODE) console.log('🎨 初始化项目路径显示');

        const projectPathElement = document.getElementById('projectPathDisplay');
        if (DEBUG_MODE) console.log('🎨 初始化时找到项目路径元素:', !!projectPathElement);

        if (projectPathElement) {
            const fullPath = projectPathElement.getAttribute('data-full-path');
            if (DEBUG_MODE) console.log('🎨 初始化时的完整路径:', fullPath);

            if (fullPath) {
                // 使用工具函数截断路径
                const pathResult = window.MCPFeedback.Utils.truncatePathFromRight(fullPath, 2, 40);
                if (DEBUG_MODE) console.log('🎨 初始化时路径处理:', { fullPath, shortPath: pathResult.truncated });

                // 更新显示文本
                DOMUtils.safeSetTextContent(projectPathElement, pathResult.truncated);

                // 添加点击拷贝功能
                if (!projectPathElement.hasAttribute('data-copy-handler')) {
                    if (DEBUG_MODE) console.log('🎨 初始化时添加点击拷贝功能');
                    projectPathElement.setAttribute('data-copy-handler', 'true');
                    projectPathElement.addEventListener('click', function() {
                        if (DEBUG_MODE) console.log('🎨 初始化的项目路径被点击');
                        const fullPath = this.getAttribute('data-full-path');
                        if (DEBUG_MODE) console.log('🎨 初始化时准备拷贝路径:', fullPath);

                        if (fullPath) {
                            const successMessage = window.i18nManager ?
                                window.i18nManager.t('app.pathCopied', '项目路径已拷贝到剪贴板') :
                                '项目路径已拷贝到剪贴板';
                            const errorMessage = window.i18nManager ?
                                window.i18nManager.t('app.pathCopyFailed', '拷贝路径失败') :
                                '拷贝路径失败';

                            if (DEBUG_MODE) console.log('🎨 初始化时调用拷贝函数');
                            window.MCPFeedback.Utils.copyToClipboard(fullPath, successMessage, errorMessage);
                        }
                    });
                } else {
                    if (DEBUG_MODE) console.log('🎨 初始化时点击拷贝功能已存在');
                }

                // 添加 tooltip 位置自动调整
                this.adjustTooltipPosition(projectPathElement);
            }
        }
    };

    /**
     * 渲染当前会话（带防抖机制）
     */
    SessionUIRenderer.prototype.renderCurrentSession = function(sessionData) {
        if (!this.currentSessionCard || !sessionData) return;

        const self = this;

        // 检查是否是新会话（会话 ID 变更）
        const isNewSession = !this.currentSessionData ||
                            this.currentSessionData.session_id !== sessionData.session_id;

        // 检查数据是否有变化
        if (!isNewSession && self.lastRenderedData.currentSessionId === sessionData.session_id &&
            self.currentSessionData &&
            self.currentSessionData.status === sessionData.status &&
            self.currentSessionData.summary === sessionData.summary) {
            // 数据没有重要变化，跳过渲染
            return;
        }

        // 清除之前的防抖定时器
        if (self.renderDebounceTimers.currentSession) {
            clearTimeout(self.renderDebounceTimers.currentSession);
        }

        // 对于新会话，立即渲染；对于更新，使用防抖
        if (isNewSession) {
            self._performCurrentSessionRender(sessionData, isNewSession);
        } else {
            self.renderDebounceTimers.currentSession = setTimeout(function() {
                self._performCurrentSessionRender(sessionData, false);
            }, self.renderDebounceDelay);
        }
    };

    /**
     * 运行实际的当前会话渲染
     */
    SessionUIRenderer.prototype._performCurrentSessionRender = function(sessionData, isNewSession) {
        if (DEBUG_MODE) console.log('🎨 渲染当前会话:', sessionData);

        // 更新缓存
        this.lastRenderedData.currentSessionId = sessionData.session_id;
        this.currentSessionData = sessionData;

        // 如果是新会话，重置活跃时间定时器
        if (isNewSession) {
            if (DEBUG_MODE) console.log('🎨 检测到新会话，重置活跃时间定时器');
            this.resetActiveTimeTimer();
        }

        // 更新会话 ID
        this.updateSessionId(sessionData);

        // 更新状态徽章
        this.updateStatusBadge(sessionData);

        // 更新时间信息
        this.updateTimeInfo(sessionData);

        // 更新项目信息
        this.updateProjectInfo(sessionData);

        // 更新摘要
        this.updateSummary(sessionData);

        // 更新会话状态栏
        this.updateSessionStatusBar(sessionData);
    };

    /**
     * 更新会话 ID 显示
     */
    SessionUIRenderer.prototype.updateSessionId = function(sessionData) {
        const sessionIdElement = this.currentSessionCard.querySelector('.session-id');
        if (sessionIdElement && sessionData.session_id) {
            const displayId = this.showFullSessionId ?
                sessionData.session_id :
                sessionData.session_id.substring(0, 8) + '...';
            const sessionIdLabel = window.i18nManager ? window.i18nManager.t('sessionManagement.sessionId') : '会话 ID';
            DOMUtils.safeSetTextContent(sessionIdElement, sessionIdLabel + ': ' + displayId);
        }
    };

    /**
     * 更新状态徽章
     */
    SessionUIRenderer.prototype.updateStatusBadge = function(sessionData) {
        const statusBadge = this.currentSessionCard.querySelector('.status-badge');
        if (statusBadge && sessionData.status) {
            StatusUtils.updateStatusIndicator(statusBadge, sessionData.status, {
                updateText: true,
                updateColor: false, // 使用 CSS 类控制颜色
                updateClass: true
            });
        }
    };

    /**
     * 更新时间信息
     */
    SessionUIRenderer.prototype.updateTimeInfo = function(sessionData) {
        const timeElement = this.currentSessionCard.querySelector('.session-time');
        if (timeElement && sessionData.created_at) {
            const timeText = TimeUtils.formatTimestamp(sessionData.created_at, { format: 'time' });
            const createdTimeLabel = window.i18nManager ? window.i18nManager.t('sessionManagement.createdTime') : '创建时间';
            DOMUtils.safeSetTextContent(timeElement, createdTimeLabel + ': ' + timeText);
        }
    };

    /**
     * 更新项目信息
     */
    SessionUIRenderer.prototype.updateProjectInfo = function(sessionData) {
        const projectElement = this.currentSessionCard.querySelector('.session-project');
        if (projectElement) {
            const projectDir = sessionData.project_directory || './';
            const projectLabel = window.i18nManager ? window.i18nManager.t('sessionManagement.project') : '项目';
            DOMUtils.safeSetTextContent(projectElement, projectLabel + ': ' + projectDir);
        }

        // 更新顶部状态栏的项目路径显示
        this.updateTopProjectPathDisplay(sessionData);
    };

    /**
     * 更新顶部状态栏的项目路径显示
     */
    SessionUIRenderer.prototype.updateTopProjectPathDisplay = function(sessionData) {
        if (DEBUG_MODE) console.log('🎨 updateProjectPathDisplay 被调用:', sessionData);

        const projectPathElement = document.getElementById('projectPathDisplay');
        if (DEBUG_MODE) console.log('🎨 找到项目路径元素:', !!projectPathElement);

        if (projectPathElement && sessionData.project_directory) {
            const fullPath = sessionData.project_directory;

            // 使用工具函数截断路径
            const pathResult = window.MCPFeedback.Utils.truncatePathFromRight(fullPath, 2, 40);
            if (DEBUG_MODE) console.log('🎨 路径处理:', { fullPath, shortPath: pathResult.truncated });

            // 更新显示文本
            DOMUtils.safeSetTextContent(projectPathElement, pathResult.truncated);

            // 更新完整路径属性
            projectPathElement.setAttribute('data-full-path', fullPath);

            // 添加点击拷贝功能（如果还没有）
            if (!projectPathElement.hasAttribute('data-copy-handler')) {
                if (DEBUG_MODE) console.log('🎨 添加点击拷贝功能');
                projectPathElement.setAttribute('data-copy-handler', 'true');
                projectPathElement.addEventListener('click', function() {
                    if (DEBUG_MODE) console.log('🎨 项目路径被点击');
                    const fullPath = this.getAttribute('data-full-path');
                    if (DEBUG_MODE) console.log('🎨 准备拷贝路径:', fullPath);

                    if (fullPath) {
                        const successMessage = window.i18nManager ?
                            window.i18nManager.t('app.pathCopied', '项目路径已拷贝到剪贴板') :
                            '项目路径已拷贝到剪贴板';
                        const errorMessage = window.i18nManager ?
                            window.i18nManager.t('app.pathCopyFailed', '拷贝路径失败') :
                            '拷贝路径失败';

                        if (DEBUG_MODE) console.log('🎨 调用拷贝函数');
                        window.MCPFeedback.Utils.copyToClipboard(fullPath, successMessage, errorMessage);
                    }
                });
            } else {
                if (DEBUG_MODE) console.log('🎨 点击拷贝功能已存在');
            }

            // 添加 tooltip 位置自动调整
            this.adjustTooltipPosition(projectPathElement);
        }
    };

    /**
     * 调整 tooltip 位置以避免超出窗口边界
     */
    SessionUIRenderer.prototype.adjustTooltipPosition = function(element) {
        if (!element) return;

        // 移除之前的位置类别
        element.classList.remove('tooltip-up', 'tooltip-left', 'tooltip-right');

        // 获取元素位置
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 检查是否需要调整垂直位置
        if (rect.bottom + 100 > viewportHeight) {
            element.classList.add('tooltip-up');
        }

        // 检查是否需要调整水平位置
        if (rect.left + 200 > viewportWidth) {
            element.classList.add('tooltip-right');
        } else if (rect.left < 200) {
            element.classList.add('tooltip-left');
        }
    };

    /**
     * 更新摘要
     */
    SessionUIRenderer.prototype.updateSummary = function(sessionData) {
        const summaryElement = this.currentSessionCard.querySelector('.session-summary');
        if (summaryElement) {
            const noSummaryText = window.i18nManager ? window.i18nManager.t('sessionManagement.noSummary') : '无摘要';
            const summary = sessionData.summary || noSummaryText;
            const summaryLabel = window.i18nManager ? window.i18nManager.t('sessionManagement.aiSummary') : 'AI 摘要';
            DOMUtils.safeSetTextContent(summaryElement, summaryLabel + ': ' + summary);
        }
    };

    /**
     * 更新会话状态栏
     */
    SessionUIRenderer.prototype.updateSessionStatusBar = function(sessionData) {
        if (!sessionData) return;

        if (DEBUG_MODE) console.log('🎨 更新会话状态栏:', sessionData);

        // 更新当前会话 ID - 显示缩短版本，完整ID存在data-full-id中
        const currentSessionElement = document.getElementById('currentSessionId');
        if (currentSessionElement && sessionData.session_id) {
            const shortId = sessionData.session_id.substring(0, 8) + '...';
            DOMUtils.safeSetTextContent(currentSessionElement, shortId);
            currentSessionElement.setAttribute('data-full-id', sessionData.session_id);

            // 添加点击拷贝功能（如果还没有）
            if (!currentSessionElement.hasAttribute('data-copy-handler')) {
                currentSessionElement.setAttribute('data-copy-handler', 'true');
                currentSessionElement.addEventListener('click', function() {
                    const fullId = this.getAttribute('data-full-id');
                    if (fullId) {
                        const successMessage = window.i18nManager ?
                            window.i18nManager.t('app.sessionIdCopied', '会话ID已拷贝到剪贴板') :
                            '会话ID已拷贝到剪贴板';
                        const errorMessage = window.i18nManager ?
                            window.i18nManager.t('app.sessionIdCopyFailed', '拷贝会话ID失败') :
                            '拷贝会话ID失败';

                        window.MCPFeedback.Utils.copyToClipboard(fullId, successMessage, errorMessage);
                    }
                });
            }
        }

        // 立即更新活跃时间（定时器会持续更新）
        this.updateActiveTime();
    };

    /**
     * 渲染会话历史列表（带防抖机制）
     */
    SessionUIRenderer.prototype.renderSessionHistory = function(sessionHistory) {
        if (!this.historyList || !sessionHistory) return;

        const self = this;

        // 检查数据是否有变化（简单比较长度）
        if (self.lastRenderedData.historyLength === sessionHistory.length) {
            // 长度没有变化，跳过渲染（可以进一步优化为深度比较）
            return;
        }

        // 清除之前的防抖定时器
        if (self.renderDebounceTimers.history) {
            clearTimeout(self.renderDebounceTimers.history);
        }

        // 设置新的防抖定时器
        self.renderDebounceTimers.history = setTimeout(function() {
            self._performHistoryRender(sessionHistory);
        }, self.renderDebounceDelay);
    };

    /**
     * 运行实际的会话历史渲染
     */
    SessionUIRenderer.prototype._performHistoryRender = function(sessionHistory) {
        if (DEBUG_MODE) console.log('🎨 渲染会话历史:', sessionHistory.length, '个会话');

        // 更新缓存
        this.lastRenderedData.historyLength = sessionHistory.length;

        // 清空现有内容
        DOMUtils.clearElement(this.historyList);

        if (sessionHistory.length === 0) {
            this.renderEmptyHistory();
            return;
        }

        // 渲染历史会话
        const fragment = document.createDocumentFragment();
        sessionHistory.forEach((session) => {
            const card = this.createSessionCard(session, true);
            fragment.appendChild(card);
        });

        this.historyList.appendChild(fragment);
    };

    /**
     * 渲染空历史状态
     */
    SessionUIRenderer.prototype.renderEmptyHistory = function() {
        const noHistoryText = window.i18nManager ? window.i18nManager.t('sessionManagement.noHistory') : '暂无历史会话';
        const emptyElement = DOMUtils.createElement('div', {
            className: 'no-sessions',
            textContent: noHistoryText
        });
        this.historyList.appendChild(emptyElement);
    };

    /**
     * 创建会话卡片
     */
    SessionUIRenderer.prototype.createSessionCard = function(sessionData, isHistory) {
        const card = DOMUtils.createElement('div', {
            className: 'session-card' + (isHistory ? ' history' : ''),
            attributes: {
                'data-session-id': sessionData.session_id
            }
        });

        // 创建卡片内容
        const header = this.createSessionHeader(sessionData);
        const info = this.createSessionInfo(sessionData, isHistory);
        const actions = this.createSessionActions(sessionData, isHistory);

        card.appendChild(header);
        card.appendChild(info);
        card.appendChild(actions);

        return card;
    };

    /**
     * 创建会话卡片标题
     */
    SessionUIRenderer.prototype.createSessionHeader = function(sessionData) {
        const header = DOMUtils.createElement('div', { className: 'session-header' });

        // 会话 ID 容器
        const sessionIdContainer = DOMUtils.createElement('div', {
            className: 'session-id'
        });

        // 会话 ID 标签
        const sessionIdLabel = DOMUtils.createElement('span', {
            attributes: {
                'data-i18n': 'sessionManagement.sessionId'
            },
            textContent: window.i18nManager ? window.i18nManager.t('sessionManagement.sessionId') : '会话 ID'
        });

        // 会话 ID 值
        const sessionIdValue = DOMUtils.createElement('span', {
            textContent: ': ' + (sessionData.session_id || '').substring(0, 8) + '...'
        });

        sessionIdContainer.appendChild(sessionIdLabel);
        sessionIdContainer.appendChild(sessionIdValue);

        // 状态徽章
        const statusContainer = DOMUtils.createElement('div', { className: 'session-status' });
        const statusText = StatusUtils.getStatusText(sessionData.status);

        // 添加调试信息
        if (DEBUG_MODE) {
            console.log('🎨 会话状态调试:', {
                sessionId: sessionData.session_id ? sessionData.session_id.substring(0, 8) + '...' : 'unknown',
                rawStatus: sessionData.status,
                displayText: statusText
            });
        }

        const statusBadge = DOMUtils.createElement('span', {
            className: 'status-badge ' + (sessionData.status || 'waiting'),
            textContent: statusText
        });

        statusContainer.appendChild(statusBadge);
        header.appendChild(sessionIdContainer);
        header.appendChild(statusContainer);

        return header;
    };

    /**
     * 创建会话信息区域
     */
    SessionUIRenderer.prototype.createSessionInfo = function(sessionData, isHistory) {
        const info = DOMUtils.createElement('div', { className: 'session-info' });

        // 时间信息容器
        const timeContainer = DOMUtils.createElement('div', {
            className: 'session-time'
        });

        // 时间标签
        const timeLabelKey = isHistory ? 'sessionManagement.createdTime' : 'sessionManagement.createdTime';
        const timeLabel = DOMUtils.createElement('span', {
            attributes: {
                'data-i18n': timeLabelKey
            },
            textContent: window.i18nManager ? window.i18nManager.t(timeLabelKey) : '创建时间'
        });

        // 时间值
        const timeText = sessionData.created_at ?
            TimeUtils.formatTimestamp(sessionData.created_at, { format: 'time' }) :
            '--:--:--';
        const timeValue = DOMUtils.createElement('span', {
            textContent: ': ' + timeText
        });

        timeContainer.appendChild(timeLabel);
        timeContainer.appendChild(timeValue);
        info.appendChild(timeContainer);

        // 历史会话显示持续时间
        if (isHistory) {
            const duration = this.calculateDisplayDuration(sessionData);
            
            // 持续时间容器
            const durationContainer = DOMUtils.createElement('div', {
                className: 'session-duration'
            });

            // 持续时间标签
            const durationLabel = DOMUtils.createElement('span', {
                attributes: {
                    'data-i18n': 'sessionManagement.sessionDetails.duration'
                },
                textContent: window.i18nManager ? window.i18nManager.t('sessionManagement.sessionDetails.duration') : '持续时间'
            });

            // 持续时间值
            const durationValue = DOMUtils.createElement('span', {
                textContent: ': ' + duration
            });

            durationContainer.appendChild(durationLabel);
            durationContainer.appendChild(durationValue);
            info.appendChild(durationContainer);
        }

        return info;
    };

    /**
     * 计算显示用的持续时间
     */
    SessionUIRenderer.prototype.calculateDisplayDuration = function(sessionData) {
        if (sessionData.duration && sessionData.duration > 0) {
            return TimeUtils.formatDuration(sessionData.duration);
        } else if (sessionData.created_at && sessionData.completed_at) {
            const duration = sessionData.completed_at - sessionData.created_at;
            return TimeUtils.formatDuration(duration);
        } else if (sessionData.created_at) {
            return TimeUtils.estimateSessionDuration(sessionData);
        }
        return window.i18nManager ? window.i18nManager.t('sessionManagement.sessionDetails.unknown') : '未知';
    };

    /**
     * 创建会话操作区域
     */
    SessionUIRenderer.prototype.createSessionActions = function(sessionData, isHistory) {
        const actions = DOMUtils.createElement('div', { className: 'session-actions' });

        // 查看详情按钮
        const viewButton = DOMUtils.createElement('button', {
            className: 'btn-small',
            attributes: {
                'data-i18n': 'sessionManagement.viewDetails'
            },
            textContent: window.i18nManager ? window.i18nManager.t('sessionManagement.viewDetails') : '详细信息'
        });

        // 添加查看详情点击事件
        DOMUtils.addEventListener(viewButton, 'click', function() {
            if (window.MCPFeedback && window.MCPFeedback.SessionManager) {
                window.MCPFeedback.SessionManager.viewSessionDetails(sessionData.session_id);
            }
        });

        actions.appendChild(viewButton);

        // 如果是历史会话，添加导出按钮
        if (isHistory) {
            const exportButton = DOMUtils.createElement('button', {
                className: 'btn-small btn-export',
                attributes: {
                    'data-i18n': 'sessionHistory.management.exportSingle'
                },
                textContent: window.i18nManager ? window.i18nManager.t('sessionHistory.management.exportSingle') : '导出此会话',
                style: 'margin-left: 4px; font-size: 11px; padding: 2px 6px;'
            });

            // 添加导出点击事件
            DOMUtils.addEventListener(exportButton, 'click', function(e) {
                e.stopPropagation(); // 防止触发父元素事件
                if (window.MCPFeedback && window.MCPFeedback.SessionManager) {
                    window.MCPFeedback.SessionManager.exportSingleSession(sessionData.session_id);
                }
            });

            actions.appendChild(exportButton);
        }

        return actions;
    };

    /**
     * 渲染统计信息（带防抖机制）
     */
    SessionUIRenderer.prototype.renderStats = function(stats) {
        if (!stats) return;

        const self = this;

        // 检查数据是否有变化
        if (self.lastRenderedData.stats &&
            self.lastRenderedData.stats.todayCount === stats.todayCount &&
            self.lastRenderedData.stats.averageDuration === stats.averageDuration) {
            // 数据没有变化，跳过渲染
            return;
        }

        // 清除之前的防抖定时器
        if (self.renderDebounceTimers.stats) {
            clearTimeout(self.renderDebounceTimers.stats);
        }

        // 设置新的防抖定时器
        self.renderDebounceTimers.stats = setTimeout(function() {
            self._performStatsRender(stats);
        }, self.renderDebounceDelay);
    };

    /**
     * 运行实际的统计信息渲染
     */
    SessionUIRenderer.prototype._performStatsRender = function(stats) {
        logger.debug('渲染统计信息:', stats);

        // 更新缓存
        this.lastRenderedData.stats = {
            todayCount: stats.todayCount,
            averageDuration: stats.averageDuration
        };

        // 更新今日会话数
        if (this.statsElements.todayCount) {
            DOMUtils.safeSetTextContent(this.statsElements.todayCount, stats.todayCount.toString());
            logger.debug('已更新今日会话数:', stats.todayCount);
        } else {
            logger.warn('找不到今日会话数元素 (.stat-today-count)');
        }

        // 更新今日平均时长
        if (this.statsElements.averageDuration) {
            const durationText = TimeUtils.formatDuration(stats.averageDuration);
            DOMUtils.safeSetTextContent(this.statsElements.averageDuration, durationText);
            logger.debug('已更新今日平均时长:', durationText);
        } else {
            logger.warn('找不到平均时长元素 (.stat-average-duration)');
        }
    };

    /**
     * 添加加载动画
     */
    SessionUIRenderer.prototype.showLoading = function(element) {
        if (element && this.enableAnimations) {
            DOMUtils.safeAddClass(element, 'loading');
        }
    };

    /**
     * 移除加载动画
     */
    SessionUIRenderer.prototype.hideLoading = function(element) {
        if (element && this.enableAnimations) {
            DOMUtils.safeRemoveClass(element, 'loading');
        }
    };

    /**
     * 启动活跃时间定时器
     */
    SessionUIRenderer.prototype.startActiveTimeTimer = function() {
        const self = this;

        // 清除现有定时器
        if (this.activeTimeTimer) {
            clearInterval(this.activeTimeTimer);
        }

        // 每秒更新活跃时间
        this.activeTimeTimer = setInterval(function() {
            self.updateActiveTime();
        }, 1000);

        if (DEBUG_MODE) console.log('🎨 活跃时间定时器已启动');
    };

    /**
     * 停止活跃时间定时器
     */
    SessionUIRenderer.prototype.stopActiveTimeTimer = function() {
        if (this.activeTimeTimer) {
            clearInterval(this.activeTimeTimer);
            this.activeTimeTimer = null;
            if (DEBUG_MODE) console.log('🎨 活跃时间定时器已停止');
        }
    };

    /**
     * 重置活跃时间定时器
     */
    SessionUIRenderer.prototype.resetActiveTimeTimer = function() {
        this.stopActiveTimeTimer();
        this.startActiveTimeTimer();
    };

    /**
     * 更新活跃时间显示
     */
    SessionUIRenderer.prototype.updateActiveTime = function() {
        if (!this.currentSessionData || !this.currentSessionData.created_at) {
            return;
        }

        const activeTimeElement = document.getElementById('sessionAge');
        if (activeTimeElement) {
            const timeText = TimeUtils.formatElapsedTime(this.currentSessionData.created_at);
            DOMUtils.safeSetTextContent(activeTimeElement, timeText);
        }
    };

    /**
     * 清理资源
     */
    SessionUIRenderer.prototype.cleanup = function() {
        // 停止定时器
        this.stopActiveTimeTimer();

        // 清理防抖定时器
        Object.keys(this.renderDebounceTimers).forEach(key => {
            if (this.renderDebounceTimers[key]) {
                clearTimeout(this.renderDebounceTimers[key]);
                this.renderDebounceTimers[key] = null;
            }
        });

        // 清理引用
        this.currentSessionCard = null;
        this.historyList = null;
        this.statsElements = {};
        this.currentSessionData = null;
        this.lastRenderedData = {
            stats: null,
            historyLength: 0,
            currentSessionId: null
        };

        if (DEBUG_MODE) console.log('🎨 SessionUIRenderer 清理完成');
    };

    // 将 SessionUIRenderer 加入命名空间
    window.MCPFeedback.Session.UIRenderer = SessionUIRenderer;

    if (DEBUG_MODE) console.log('✅ SessionUIRenderer 模块加载完成');

})();
