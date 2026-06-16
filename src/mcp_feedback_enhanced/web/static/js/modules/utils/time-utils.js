/**
 * MCP Feedback Enhanced - 时间处理工具模块
 * ========================================
 * 
 * 提供时间格式化、计算和显示功能
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Utils = window.MCPFeedback.Utils || {};

    /**
     * 时间工具类
     */
    const TimeUtils = {
        /**
         * 格式化时间戳为可读时间
         */
        formatTimestamp: function(timestamp, options) {
            options = options || {};
            
            if (!timestamp) return '未知';

            try {
                // 处理时间戳格式（毫秒转秒）
                let normalizedTimestamp = timestamp;
                if (timestamp > 1e12) {
                    normalizedTimestamp = timestamp / 1000;
                }

                const date = new Date(normalizedTimestamp * 1000);
                if (isNaN(date.getTime())) {
                    return '无效时间';
                }

                if (options.format === 'time') {
                    // 只返回时间部分
                    return date.toLocaleTimeString();
                } else if (options.format === 'date') {
                    // 只返回日期部分
                    return date.toLocaleDateString();
                } else if (options.format === 'iso') {
                    // ISO 格式
                    return date.toISOString();
                } else {
                    // 完整格式
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');

                    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
                }
            } catch (error) {
                console.warn('时间格式化失败:', timestamp, error);
                return '格式错误';
            }
        },

        /**
         * 格式化持续时间（秒）- 支持国际化
         */
        formatDuration: function(seconds) {
            if (!seconds || seconds < 0) {
                const secondsText = this.getTimeUnitText('seconds');
                return `0${secondsText}`;
            }

            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = Math.floor(seconds % 60);

            const hoursText = this.getTimeUnitText('hours');
            const minutesText = this.getTimeUnitText('minutes');
            const secondsText = this.getTimeUnitText('seconds');

            if (hours > 0) {
                return `${hours}${hoursText}${minutes > 0 ? minutes + minutesText : ''}`;
            } else if (minutes > 0) {
                return `${minutes}${minutesText}${remainingSeconds > 0 ? remainingSeconds + secondsText : ''}`;
            } else {
                return `${remainingSeconds}${secondsText}`;
            }
        },

        /**
         * 获取时间单位文本（支持国际化）
         */
        getTimeUnitText: function(unit) {
            if (window.i18nManager && typeof window.i18nManager.t === 'function') {
                return window.i18nManager.t(`timeUnits.${unit}`, unit);
            }

            // 回退到默认值（繁体中文）
            const fallbackUnits = {
                'seconds': '秒',
                'minutes': '分钟',
                'hours': '小时',
                'days': '天',
                'ago': '前',
                'justNow': '刚刚',
                'about': '约'
            };

            return fallbackUnits[unit] || unit;
        },

        /**
         * 格式化相对时间（多久之前）- 支持国际化
         */
        formatRelativeTime: function(timestamp) {
            if (!timestamp) return '未知';

            try {
                let normalizedTimestamp = timestamp;
                if (timestamp > 1e12) {
                    normalizedTimestamp = timestamp / 1000;
                }

                const now = Date.now() / 1000;
                const diff = now - normalizedTimestamp;

                const minutesText = this.getTimeUnitText('minutes');
                const hoursText = this.getTimeUnitText('hours');
                const daysText = this.getTimeUnitText('days');
                const agoText = this.getTimeUnitText('ago');
                const justNowText = this.getTimeUnitText('justNow');

                if (diff < 60) {
                    return justNowText;
                } else if (diff < 3600) {
                    const minutes = Math.floor(diff / 60);
                    return `${minutes}${minutesText}${agoText}`;
                } else if (diff < 86400) {
                    const hours = Math.floor(diff / 3600);
                    return `${hours}${hoursText}${agoText}`;
                } else {
                    const days = Math.floor(diff / 86400);
                    return `${days}${daysText}${agoText}`;
                }
            } catch (error) {
                console.warn('相对时间计算失败:', timestamp, error);
                return '计算错误';
            }
        },

        /**
         * 计算经过时间（从指定时间到现在）
         */
        calculateElapsedTime: function(startTimestamp) {
            if (!startTimestamp) return 0;

            try {
                let normalizedTimestamp = startTimestamp;
                if (startTimestamp > 1e12) {
                    normalizedTimestamp = startTimestamp / 1000;
                }

                const now = Date.now() / 1000;
                return Math.max(0, now - normalizedTimestamp);
            } catch (error) {
                console.warn('经过时间计算失败:', startTimestamp, error);
                return 0;
            }
        },

        /**
         * 格式化经过时间为 MM:SS 格式
         */
        formatElapsedTime: function(startTimestamp) {
            const elapsed = this.calculateElapsedTime(startTimestamp);
            const minutes = Math.floor(elapsed / 60);
            const seconds = Math.floor(elapsed % 60);
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        },

        /**
         * 获取当前时间戳（秒）
         */
        getCurrentTimestamp: function() {
            return Math.floor(Date.now() / 1000);
        },

        /**
         * 获取当前时间戳（毫秒）
         */
        getCurrentTimestampMs: function() {
            return Date.now();
        },

        /**
         * 检查时间戳是否有效
         */
        isValidTimestamp: function(timestamp) {
            if (!timestamp || typeof timestamp !== 'number') return false;
            
            // 检查是否在合理范围内（1970年到2100年）
            const minTimestamp = 0;
            const maxTimestamp = 4102444800; // 2100年1月1日
            
            let normalizedTimestamp = timestamp;
            if (timestamp > 1e12) {
                normalizedTimestamp = timestamp / 1000;
            }
            
            return normalizedTimestamp >= minTimestamp && normalizedTimestamp <= maxTimestamp;
        },

        /**
         * 标准化时间戳（统一转换为秒）
         */
        normalizeTimestamp: function(timestamp) {
            if (!this.isValidTimestamp(timestamp)) return null;
            
            if (timestamp > 1e12) {
                return timestamp / 1000;
            }
            return timestamp;
        },

        /**
         * 创建倒计时器
         */
        createCountdown: function(endTimestamp, callback, options) {
            options = options || {};
            const interval = options.interval || 1000;
            
            const timer = setInterval(function() {
                const now = Date.now() / 1000;
                const remaining = endTimestamp - now;
                
                if (remaining <= 0) {
                    clearInterval(timer);
                    if (callback) callback(0, true);
                    return;
                }
                
                if (callback) callback(remaining, false);
            }, interval);
            
            return timer;
        },

        /**
         * 格式化倒计时显示
         */
        formatCountdown: function(remainingSeconds) {
            if (remainingSeconds <= 0) return '00:00';
            
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = Math.floor(remainingSeconds % 60);
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        },

        /**
         * 获取今天的开始时间戳
         */
        getTodayStartTimestamp: function() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.floor(today.getTime() / 1000);
        },

        /**
         * 创建自动提交倒计时器
         */
        createAutoSubmitCountdown: function(timeoutSeconds, onTick, onComplete, options) {
            options = options || {};
            const interval = options.interval || 1000;

            let remainingTime = timeoutSeconds;
            let timer = null;
            let isPaused = false;
            let isCompleted = false;

            const countdownManager = {
                start: function() {
                    if (timer || isCompleted) return;

                    timer = setInterval(function() {
                        if (isPaused || isCompleted) return;

                        remainingTime--;

                        if (onTick) {
                            onTick(remainingTime, false);
                        }

                        if (remainingTime <= 0) {
                            isCompleted = true;
                            clearInterval(timer);
                            timer = null;

                            if (onComplete) {
                                onComplete();
                            }
                        }
                    }, interval);

                    // 立即触发第一次 tick
                    if (onTick) {
                        onTick(remainingTime, false);
                    }

                    return this;
                },

                pause: function() {
                    isPaused = true;
                    return this;
                },

                resume: function() {
                    isPaused = false;
                    return this;
                },

                stop: function() {
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                    isCompleted = true;
                    return this;
                },

                reset: function(newTimeoutSeconds) {
                    this.stop();
                    remainingTime = newTimeoutSeconds || timeoutSeconds;
                    isPaused = false;
                    isCompleted = false;
                    return this;
                },

                getRemainingTime: function() {
                    return remainingTime;
                },

                isPaused: function() {
                    return isPaused;
                },

                isCompleted: function() {
                    return isCompleted;
                },

                isRunning: function() {
                    return timer !== null && !isPaused && !isCompleted;
                }
            };

            return countdownManager;
        },

        /**
         * 格式化自动提交倒计时显示
         */
        formatAutoSubmitCountdown: function(remainingSeconds) {
            if (remainingSeconds <= 0) return '00:00';

            const hours = Math.floor(remainingSeconds / 3600);
            const minutes = Math.floor((remainingSeconds % 3600) / 60);
            const seconds = Math.floor(remainingSeconds % 60);

            if (hours > 0) {
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            } else {
                return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        },

        /**
         * 检查时间戳是否是今天
         */
        isToday: function(timestamp) {
            if (!this.isValidTimestamp(timestamp)) return false;
            
            const normalizedTimestamp = this.normalizeTimestamp(timestamp);
            const todayStart = this.getTodayStartTimestamp();
            const todayEnd = todayStart + 86400; // 24小时后
            
            return normalizedTimestamp >= todayStart && normalizedTimestamp < todayEnd;
        },

        /**
         * 估算会话持续时间（用于历史会话）- 支持国际化
         */
        estimateSessionDuration: function(sessionData) {
            // 基础时间 2 分钟
            let estimatedMinutes = 2;

            // 根据摘要长度调整
            if (sessionData.summary) {
                const summaryLength = sessionData.summary.length;
                if (summaryLength > 100) {
                    estimatedMinutes += Math.floor(summaryLength / 50);
                }
            }

            // 根据会话 ID 的哈希值增加随机性
            if (sessionData.session_id) {
                const hash = this.simpleHash(sessionData.session_id);
                const variation = (hash % 5) + 1; // 1-5 分钟的变化
                estimatedMinutes += variation;
            }

            // 限制在合理范围内
            estimatedMinutes = Math.max(1, Math.min(estimatedMinutes, 15));

            const aboutText = this.getTimeUnitText('about');
            const minutesText = this.getTimeUnitText('minutes');
            return `${aboutText} ${estimatedMinutes} ${minutesText}`;
        },

        /**
         * 简单哈希函数
         */
        simpleHash: function(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为 32 位整数
            }
            return Math.abs(hash);
        }
    };

    // 将 TimeUtils 加入命名空间
    window.MCPFeedback.TimeUtils = TimeUtils;
    window.MCPFeedback.Utils.Time = TimeUtils; // 保持向后兼容

    console.log('✅ TimeUtils 模块加载完成');

})();
