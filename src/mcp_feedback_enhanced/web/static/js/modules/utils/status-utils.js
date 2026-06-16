/**
 * MCP Feedback Enhanced - 状态处理工具模块
 * ========================================
 * 
 * 提供状态映射、颜色管理和状态转换功能
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Utils = window.MCPFeedback.Utils || {};

    /**
     * 状态工具类
     */
    const StatusUtils = {
        /**
         * 获取会话状态文本（使用 i18n）
         */
        getSessionStatusText: function(status) {
            if (!window.i18nManager) {
                // 回退到硬编码文本
                const fallbackMap = {
                    'waiting': '等待回馈',
                    'waiting_for_feedback': '等待回馈',
                    'active': '进行中',
                    'feedback_submitted': '已提交回馈',
                    'completed': '已完成',
                    'timeout': '已逾时',
                    'error': '错误',
                    'expired': '已过期',
                    'connecting': '连接中',
                    'connected': '已连接',
                    'disconnected': '已断开',
                    'processing': '处理中',
                    'ready': '就绪',
                    'closed': '已关闭'
                };
                return fallbackMap[status] || status;
            }

            // 使用 i18n 翻译
            const i18nKeyMap = {
                'waiting': 'connectionMonitor.waiting',
                'waiting_for_feedback': 'connectionMonitor.waiting',
                'active': 'status.processing.title',
                'feedback_submitted': 'status.submitted.title',
                'completed': 'status.completed.title',
                'timeout': 'session.timeout',
                'error': 'status.error',
                'expired': 'session.timeout',
                'connecting': 'connectionMonitor.connecting',
                'connected': 'connectionMonitor.connected',
                'disconnected': 'connectionMonitor.disconnected',
                'processing': 'status.processing.title',
                'ready': 'connectionMonitor.connected',
                'closed': 'connectionMonitor.disconnected'
            };

            const i18nKey = i18nKeyMap[status];
            return i18nKey ? window.i18nManager.t(i18nKey) : status;
        },

        /**
         * 获取连接状态文本（使用 i18n）
         */
        getConnectionStatusText: function(status) {
            if (!window.i18nManager) {
                // 回退到硬编码文本
                const fallbackMap = {
                    'connecting': '连接中',
                    'connected': '已连接',
                    'disconnected': '已断开',
                    'reconnecting': '重连中',
                    'error': '连接错误'
                };
                return fallbackMap[status] || status;
            }

            // 使用 i18n 翻译
            const i18nKeyMap = {
                'connecting': 'connectionMonitor.connecting',
                'connected': 'connectionMonitor.connected',
                'disconnected': 'connectionMonitor.disconnected',
                'reconnecting': 'connectionMonitor.reconnecting',
                'error': 'status.error'
            };

            const i18nKey = i18nKeyMap[status];
            return i18nKey ? window.i18nManager.t(i18nKey) : status;
        },

        /**
         * 状态颜色映射
         */
        STATUS_COLOR_MAP: {
            'waiting': '#9c27b0',
            'waiting_for_feedback': '#9c27b0',
            'active': '#2196f3',
            'feedback_submitted': '#4caf50',
            'completed': '#4caf50',
            'timeout': '#ff5722',
            'error': '#f44336',
            'expired': '#757575',
            'connecting': '#ff9800',
            'connected': '#4caf50',
            'disconnected': '#757575',
            'reconnecting': '#9c27b0',
            'processing': '#2196f3',
            'ready': '#4caf50',
            'closed': '#757575'
        },

        /**
         * 获取连接品质标签（使用 i18n）
         */
        getConnectionQualityLabel: function(level) {
            if (!window.i18nManager) {
                // 回退到硬编码文本
                const fallbackLabels = {
                    'excellent': '优秀',
                    'good': '良好',
                    'fair': '一般',
                    'poor': '较差',
                    'unknown': '未知'
                };
                return fallbackLabels[level] || level;
            }

            const i18nKey = `connectionMonitor.quality.${level}`;
            return window.i18nManager.t(i18nKey);
        },

        /**
         * 连接品质等级
         */
        CONNECTION_QUALITY_LEVELS: {
            'excellent': { threshold: 50, color: '#4caf50' },
            'good': { threshold: 100, color: '#8bc34a' },
            'fair': { threshold: 200, color: '#ff9800' },
            'poor': { threshold: Infinity, color: '#f44336' }
        },

        /**
         * 获取状态文本（统一入口，优先使用新方法）
         */
        getStatusText: function(status) {
            if (!status) {
                return window.i18nManager ? window.i18nManager.t('sessionManagement.sessionDetails.unknown') : '未知';
            }

            // 优先尝试会话状态
            const sessionText = this.getSessionStatusText(status);
            if (sessionText !== status) {
                return sessionText;
            }

            // 然后尝试连接状态
            const connectionText = this.getConnectionStatusText(status);
            if (connectionText !== status) {
                return connectionText;
            }

            return status;
        },

        /**
         * 获取状态颜色
         */
        getStatusColor: function(status) {
            if (!status) return '#757575';
            return this.STATUS_COLOR_MAP[status] || '#757575';
        },

        /**
         * 根据延迟计算连接品质
         */
        calculateConnectionQuality: function(latency) {
            if (typeof latency !== 'number' || latency < 0) {
                return {
                    level: 'unknown',
                    label: this.getConnectionQualityLabel('unknown'),
                    color: '#757575'
                };
            }

            for (const [level, config] of Object.entries(this.CONNECTION_QUALITY_LEVELS)) {
                if (latency < config.threshold) {
                    return {
                        level: level,
                        label: this.getConnectionQualityLabel(level),
                        color: config.color
                    };
                }
            }

            return {
                level: 'poor',
                label: this.getConnectionQualityLabel('poor'),
                color: '#f44336'
            };
        },

        /**
         * 获取信号强度等级（基于连接品质）
         */
        getSignalStrength: function(quality) {
            const strengthMap = {
                'excellent': 3,
                'good': 2,
                'fair': 1,
                'poor': 0,
                'unknown': 0
            };

            return strengthMap[quality] || 0;
        },

        /**
         * 检查状态是否为已完成状态
         */
        isCompletedStatus: function(status) {
            const completedStatuses = [
                'completed', 
                'feedback_submitted', 
                'timeout', 
                'error', 
                'expired', 
                'closed'
            ];
            return completedStatuses.includes(status);
        },

        /**
         * 检查状态是否为活跃状态
         */
        isActiveStatus: function(status) {
            const activeStatuses = [
                'waiting',
                'waiting_for_feedback',
                'active',
                'processing',
                'connected',
                'ready'
            ];
            return activeStatuses.includes(status);
        },

        /**
         * 检查状态是否为错误状态
         */
        isErrorStatus: function(status) {
            const errorStatuses = ['error', 'timeout', 'disconnected'];
            return errorStatuses.includes(status);
        },

        /**
         * 检查状态是否为连接中状态
         */
        isConnectingStatus: function(status) {
            const connectingStatuses = ['connecting', 'reconnecting'];
            return connectingStatuses.includes(status);
        },

        /**
         * 获取状态优先级（用于排序）
         */
        getStatusPriority: function(status) {
            const priorityMap = {
                'error': 1,
                'timeout': 2,
                'disconnected': 3,
                'connecting': 4,
                'reconnecting': 5,
                'waiting': 6,
                'waiting_for_feedback': 6,
                'processing': 7,
                'active': 8,
                'ready': 9,
                'connected': 10,
                'feedback_submitted': 11,
                'completed': 12,
                'closed': 13,
                'expired': 14
            };

            return priorityMap[status] || 0;
        },

        /**
         * 创建状态徽章 HTML
         */
        createStatusBadge: function(status, options) {
            options = options || {};
            const text = this.getStatusText(status);
            const color = this.getStatusColor(status);
            const className = options.className || 'status-badge';
            
            return `<span class="${className} ${status}" style="color: ${color};">${text}</span>`;
        },

        /**
         * 更新状态指示器
         */
        updateStatusIndicator: function(element, status, options) {
            if (!element) return false;

            options = options || {};
            const text = this.getStatusText(status);
            const color = this.getStatusColor(status);

            // 更新文本
            if (options.updateText !== false) {
                element.textContent = text;
            }

            // 更新颜色
            if (options.updateColor !== false) {
                element.style.color = color;
            }

            // 更新 CSS 类
            if (options.updateClass !== false) {
                // 移除旧的状态类
                element.className = element.className.replace(/\b(waiting|active|completed|error|connecting|connected|disconnected|reconnecting|processing|ready|closed|expired|timeout|feedback_submitted)\b/g, '');
                // 添加新的状态类
                element.classList.add(status);
            }

            return true;
        },

        /**
         * 格式化状态变更日志
         */
        formatStatusChangeLog: function(oldStatus, newStatus, timestamp) {
            const oldText = this.getStatusText(oldStatus);
            const newText = this.getStatusText(newStatus);
            const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : '现在';
            
            return `${timeStr}: ${oldText} → ${newText}`;
        },

        /**
         * 检查状态转换是否有效
         */
        isValidStatusTransition: function(fromStatus, toStatus) {
            // 定义有效的状态转换规则
            const validTransitions = {
                'waiting': ['active', 'processing', 'timeout', 'error', 'connected'],
                'waiting_for_feedback': ['active', 'processing', 'timeout', 'error', 'feedback_submitted'],
                'active': ['processing', 'feedback_submitted', 'completed', 'timeout', 'error'],
                'processing': ['completed', 'feedback_submitted', 'error', 'timeout'],
                'connecting': ['connected', 'error', 'disconnected', 'timeout'],
                'connected': ['disconnected', 'error', 'reconnecting'],
                'disconnected': ['connecting', 'reconnecting'],
                'reconnecting': ['connected', 'error', 'disconnected'],
                'feedback_submitted': ['completed', 'closed'],
                'completed': ['closed'],
                'error': ['connecting', 'waiting', 'closed'],
                'timeout': ['closed', 'waiting'],
                'ready': ['active', 'waiting', 'processing']
            };

            const allowedTransitions = validTransitions[fromStatus];
            return allowedTransitions ? allowedTransitions.includes(toStatus) : true;
        },

        /**
         * 获取状态描述
         */
        getStatusDescription: function(status) {
            const descriptions = {
                'waiting': '系统正在等待用户提供回馈',
                'waiting_for_feedback': '系统正在等待用户提供回馈',
                'active': '会话正在进行中',
                'processing': '系统正在处理用户的回馈',
                'feedback_submitted': '用户已提交回馈',
                'completed': '会话已成功完成',
                'timeout': '会话因超时而结束',
                'error': '会话遇到错误',
                'expired': '会话已过期',
                'connecting': '正在创建连接',
                'connected': '连接已创建',
                'disconnected': '连接已断开',
                'reconnecting': '正在尝试重新连接',
                'ready': '系统已就绪',
                'closed': '会话已关闭'
            };

            return descriptions[status] || '未知状态';
        }
    };

    // 将 StatusUtils 加入命名空间
    window.MCPFeedback.StatusUtils = StatusUtils;
    window.MCPFeedback.Utils.Status = StatusUtils; // 保持向后兼容

    console.log('✅ StatusUtils 模块加载完成');

})();
