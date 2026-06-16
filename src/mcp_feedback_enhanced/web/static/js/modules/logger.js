/**
 * MCP Feedback Enhanced - 日志管理模块
 * ===================================
 * 
 * 统一的日志管理系统，支持不同等级的日志输出
 * 生产环境可关闭详细日志以提升性能
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};

    /**
     * 日志等级枚举
     */
    const LogLevel = {
        ERROR: 0,    // 错误：严重问题，必须记录
        WARN: 1,     // 警告：潜在问题，建议记录
        INFO: 2,     // 信息：一般信息，正常记录
        DEBUG: 3,    // 调试：详细信息，开发时记录
        TRACE: 4     // 追踪：最详细信息，深度调试时记录
    };

    /**
     * 日志等级名称映射
     */
    const LogLevelNames = {
        [LogLevel.ERROR]: 'ERROR',
        [LogLevel.WARN]: 'WARN',
        [LogLevel.INFO]: 'INFO',
        [LogLevel.DEBUG]: 'DEBUG',
        [LogLevel.TRACE]: 'TRACE'
    };

    /**
     * 日志管理器
     */
    function Logger(options) {
        options = options || {};
        
        // 当前日志等级（缺省为 INFO）
        this.currentLevel = this.parseLogLevel(options.level) || LogLevel.INFO;
        
        // 模块名称
        this.moduleName = options.moduleName || 'App';
        
        // 是否激活时间戳
        this.enableTimestamp = options.enableTimestamp !== false;
        
        // 是否激活模块名称
        this.enableModuleName = options.enableModuleName !== false;
        
        // 是否激活颜色（仅在支持的环境中）
        this.enableColors = options.enableColors !== false;
        
        // 自订输出函数
        this.customOutput = options.customOutput || null;
        
        // 日志缓冲区（用于收集日志）
        this.logBuffer = [];
        this.maxBufferSize = options.maxBufferSize || 1000;
        
        // 颜色映射
        this.colors = {
            [LogLevel.ERROR]: '#f44336',   // 红色
            [LogLevel.WARN]: '#ff9800',    // 橙色
            [LogLevel.INFO]: '#2196f3',    // 蓝色
            [LogLevel.DEBUG]: '#4caf50',   // 绿色
            [LogLevel.TRACE]: '#9c27b0'    // 紫色
        };
    }

    /**
     * 解析日志等级
     */
    Logger.prototype.parseLogLevel = function(level) {
        if (typeof level === 'number') {
            return level;
        }
        
        if (typeof level === 'string') {
            const upperLevel = level.toUpperCase();
            for (const [value, name] of Object.entries(LogLevelNames)) {
                if (name === upperLevel) {
                    return parseInt(value);
                }
            }
        }
        
        return null;
    };

    /**
     * 设置日志等级
     */
    Logger.prototype.setLevel = function(level) {
        const parsedLevel = this.parseLogLevel(level);
        if (parsedLevel !== null) {
            this.currentLevel = parsedLevel;
            this.info('日志等级已设置为:', LogLevelNames[this.currentLevel]);
        } else {
            this.warn('无效的日志等级:', level);
        }
    };

    /**
     * 获取当前日志等级
     */
    Logger.prototype.getLevel = function() {
        return this.currentLevel;
    };

    /**
     * 检查是否应该记录指定等级的日志
     */
    Logger.prototype.shouldLog = function(level) {
        return level <= this.currentLevel;
    };

    /**
     * 格式化日志消息
     */
    Logger.prototype.formatMessage = function(level, args) {
        const parts = [];
        
        // 添加时间戳
        if (this.enableTimestamp) {
            const now = new Date();
            const timestamp = now.toISOString().substr(11, 12); // HH:mm:ss.SSS
            parts.push(`[${timestamp}]`);
        }
        
        // 添加等级
        parts.push(`[${LogLevelNames[level]}]`);
        
        // 添加模块名称
        if (this.enableModuleName) {
            parts.push(`[${this.moduleName}]`);
        }
        
        // 组合前缀
        const prefix = parts.join(' ');
        
        // 转换参数为字符串
        const messages = Array.from(args).map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        });
        
        return {
            prefix: prefix,
            message: messages.join(' '),
            fullMessage: prefix + ' ' + messages.join(' ')
        };
    };

    /**
     * 输出日志
     */
    Logger.prototype.output = function(level, formatted) {
        // 添加到缓冲区
        this.addToBuffer(level, formatted);
        
        // 如果有自订输出函数，使用它
        if (this.customOutput) {
            this.customOutput(level, formatted);
            return;
        }
        
        // 使用浏览器控制台
        const consoleMethods = {
            [LogLevel.ERROR]: 'error',
            [LogLevel.WARN]: 'warn',
            [LogLevel.INFO]: 'info',
            [LogLevel.DEBUG]: 'log',
            [LogLevel.TRACE]: 'log'
        };
        
        const method = consoleMethods[level] || 'log';
        
        // 如果支持颜色且激活
        if (this.enableColors && console.log.toString().indexOf('native') === -1) {
            const color = this.colors[level];
            console[method](`%c${formatted.fullMessage}`, `color: ${color}`);
        } else {
            console[method](formatted.fullMessage);
        }
    };

    /**
     * 添加到日志缓冲区
     */
    Logger.prototype.addToBuffer = function(level, formatted) {
        const logEntry = {
            timestamp: Date.now(),
            level: level,
            levelName: LogLevelNames[level],
            moduleName: this.moduleName,
            message: formatted.message,
            fullMessage: formatted.fullMessage
        };
        
        this.logBuffer.push(logEntry);
        
        // 限制缓冲区大小
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }
    };

    /**
     * 通用日志方法
     */
    Logger.prototype.log = function(level) {
        if (!this.shouldLog(level)) {
            return;
        }
        
        const args = Array.prototype.slice.call(arguments, 1);
        const formatted = this.formatMessage(level, args);
        this.output(level, formatted);
    };

    /**
     * 错误日志
     */
    Logger.prototype.error = function() {
        this.log.apply(this, [LogLevel.ERROR].concat(Array.prototype.slice.call(arguments)));
    };

    /**
     * 警告日志
     */
    Logger.prototype.warn = function() {
        this.log.apply(this, [LogLevel.WARN].concat(Array.prototype.slice.call(arguments)));
    };

    /**
     * 信息日志
     */
    Logger.prototype.info = function() {
        this.log.apply(this, [LogLevel.INFO].concat(Array.prototype.slice.call(arguments)));
    };

    /**
     * 调试日志
     */
    Logger.prototype.debug = function() {
        this.log.apply(this, [LogLevel.DEBUG].concat(Array.prototype.slice.call(arguments)));
    };

    /**
     * 追踪日志
     */
    Logger.prototype.trace = function() {
        this.log.apply(this, [LogLevel.TRACE].concat(Array.prototype.slice.call(arguments)));
    };

    /**
     * 获取日志缓冲区
     */
    Logger.prototype.getBuffer = function() {
        return this.logBuffer.slice(); // 返回副本
    };

    /**
     * 清空日志缓冲区
     */
    Logger.prototype.clearBuffer = function() {
        this.logBuffer = [];
    };

    /**
     * 导出日志
     */
    Logger.prototype.exportLogs = function(options) {
        options = options || {};
        const format = options.format || 'json';
        const minLevel = this.parseLogLevel(options.minLevel) || LogLevel.ERROR;
        
        const filteredLogs = this.logBuffer.filter(log => log.level <= minLevel);
        
        if (format === 'json') {
            return JSON.stringify(filteredLogs, null, 2);
        } else if (format === 'text') {
            return filteredLogs.map(log => log.fullMessage).join('\n');
        }
        
        return filteredLogs;
    };

    // 全域日志管理器
    const globalLogger = new Logger({
        moduleName: 'Global',
        level: LogLevel.INFO
    });

    // 从环境变量或 URL 参数检测日志等级
    function detectLogLevel() {
        // 检查 URL 参数
        const urlParams = new URLSearchParams(window.location.search);
        const urlLogLevel = urlParams.get('logLevel') || urlParams.get('log_level');
        if (urlLogLevel) {
            return urlLogLevel;
        }

        // 检查是否为开发环境
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return LogLevel.DEBUG;
        }

        return LogLevel.INFO;
    }

    // 从 API 加载日志等级
    function loadLogLevelFromAPI() {
        const lang = window.i18nManager ? window.i18nManager.getCurrentLanguage() : 'zh-TW';
        fetch('/api/log-level?lang=' + lang)
            .then(function(response) {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('加载日志等级失败: ' + response.status);
            })
            .then(function(data) {
                const apiLogLevel = data.logLevel;
                if (apiLogLevel && Object.values(LogLevel).includes(apiLogLevel)) {
                    currentLogLevel = apiLogLevel;
                    console.log('📋 从 API 加载日志等级:', apiLogLevel);
                }
            })
            .catch(function(error) {
                console.warn('⚠️ 加载日志等级失败，使用默认值:', error);
            });
    }

    // 保存日志等级到 API
    function saveLogLevelToAPI(logLevel) {
        const lang = window.i18nManager ? window.i18nManager.getCurrentLanguage() : 'zh-TW';
        fetch('/api/log-level?lang=' + lang, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                logLevel: logLevel
            })
        })
        .then(function(response) {
            if (response.ok) {
                return response.json();
            }
            throw new Error('保存日志等级失败: ' + response.status);
        })
        .then(function(data) {
            console.log('📋 日志等级已保存:', data.logLevel);
            // 处理消息代码
            if (data.messageCode && window.i18nManager) {
                const message = window.i18nManager.t(data.messageCode, data.params);
                console.log('服务器回应:', message);
            }
        })
        .catch(function(error) {
            console.warn('⚠️ 保存日志等级失败:', error);
        });
    }

    // 设置全域日志等级
    globalLogger.setLevel(detectLogLevel());

    // 页面加载后从 API 加载日志等级
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadLogLevelFromAPI);
    } else {
        loadLogLevelFromAPI();
    }

    // 导出到全域命名空间
    window.MCPFeedback.Logger = Logger;
    window.MCPFeedback.LogLevel = LogLevel;
    window.MCPFeedback.logger = globalLogger;

    // 导出设置方法
    window.MCPFeedback.setLogLevel = function(logLevel) {
        if (Object.values(LogLevel).includes(logLevel)) {
            globalLogger.setLevel(logLevel);
            saveLogLevelToAPI(logLevel);
            console.log('📋 日志等级已更新:', LogLevelNames[logLevel]);
        } else {
            console.warn('⚠️ 无效的日志等级:', logLevel);
        }
    };

    console.log('✅ Logger 模块加载完成，当前等级:', LogLevelNames[globalLogger.getLevel()]);

})();
