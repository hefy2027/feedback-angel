/**
 * MCP Feedback Enhanced - 通知管理模块
 * ===================================
 * 
 * 处理浏览器通知功能，支持新会话通知和紧急状态通知
 * 使用 Web Notification API，提供极简的通知体验
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * 通知管理器建构函数
     */
    function NotificationManager(options) {
        options = options || {};
        
        // 通知设置
        this.enabled = false;
        this.permission = 'default';
        this.triggerMode = 'focusLost';  // 缺省为失去焦点时通知
        
        // 状态追踪
        this.lastSessionId = null;  // 避免重复通知同一会话
        this.isInitialized = false;
        this.hasFocus = true;  // 追踪窗口焦点状态
        
        // 设置键名
        this.STORAGE_KEY = 'notificationsEnabled';
        this.TRIGGER_MODE_KEY = 'notificationTriggerMode';
        
        // i18n 翻译函数
        this.t = options.t || function(key, defaultValue) { return defaultValue || key; };
        
        console.log('🔔 NotificationManager 建构完成');
    }

    /**
     * 初始化通知管理器
     */
    NotificationManager.prototype.initialize = function() {
        if (this.isInitialized) return;
        
        // 检查浏览器支持
        if (!this.checkBrowserSupport()) {
            console.warn('⚠️ 浏览器不支持 Notification API');
            return;
        }
        
        // 加载设置
        this.loadSettings();
        
        // 更新权限状态
        this.updatePermissionStatus();
        
        // 设置焦点追踪
        this.setupFocusTracking();
        
        this.isInitialized = true;
        console.log('✅ NotificationManager 初始化完成', {
            enabled: this.enabled,
            permission: this.permission,
            triggerMode: this.triggerMode
        });
    };

    /**
     * 检查浏览器支持
     */
    NotificationManager.prototype.checkBrowserSupport = function() {
        return 'Notification' in window;
    };

    /**
     * 加载设置
     */
    NotificationManager.prototype.loadSettings = function() {
        try {
            this.enabled = localStorage.getItem(this.STORAGE_KEY) === 'true';
            this.triggerMode = localStorage.getItem(this.TRIGGER_MODE_KEY) || 'focusLost';
        } catch (error) {
            console.error('❌ 加载通知设置失败:', error);
            this.enabled = false;
            this.triggerMode = 'focusLost';
        }
    };

    /**
     * 保存设置
     */
    NotificationManager.prototype.saveSettings = function() {
        try {
            localStorage.setItem(this.STORAGE_KEY, this.enabled.toString());
        } catch (error) {
            console.error('❌ 保存通知设置失败:', error);
        }
    };

    /**
     * 更新权限状态
     */
    NotificationManager.prototype.updatePermissionStatus = function() {
        if (this.checkBrowserSupport()) {
            this.permission = Notification.permission;
        }
    };

    /**
     * 请求通知权限
     */
    NotificationManager.prototype.requestPermission = async function() {
        if (!this.checkBrowserSupport()) {
            throw new Error('浏览器不支持通知功能');
        }
        
        try {
            const result = await Notification.requestPermission();
            this.permission = result;
            return result;
        } catch (error) {
            console.error('❌ 请求通知权限失败:', error);
            throw error;
        }
    };

    /**
     * 激活通知
     */
    NotificationManager.prototype.enable = async function() {
        // 检查权限
        if (this.permission === 'default') {
            const result = await this.requestPermission();
            if (result !== 'granted') {
                return false;
            }
        } else if (this.permission === 'denied') {
            console.warn('⚠️ 通知权限已被拒绝');
            return false;
        }
        
        this.enabled = true;
        this.saveSettings();
        console.log('✅ 通知已激活');
        return true;
    };

    /**
     * 停用通知
     */
    NotificationManager.prototype.disable = function() {
        this.enabled = false;
        this.saveSettings();
        console.log('🔇 通知已停用');
    };

    /**
     * 设置焦点追踪
     */
    NotificationManager.prototype.setupFocusTracking = function() {
        const self = this;
        
        // 监听焦点事件
        window.addEventListener('focus', function() {
            self.hasFocus = true;
            console.log('👁️ 窗口获得焦点');
        });
        
        window.addEventListener('blur', function() {
            self.hasFocus = false;
            console.log('👁️ 窗口失去焦点');
        });
    };

    /**
     * 检查是否可以显示通知
     */
    NotificationManager.prototype.canNotify = function() {
        if (!this.enabled || this.permission !== 'granted') {
            return false;
        }
        
        // 根据触发模式判断
        switch (this.triggerMode) {
            case 'always':
                return true;  // 总是通知
            case 'background':
                return document.hidden;  // 只在页面隐藏时通知
            case 'tabSwitch':
                return document.hidden;  // 只在切换标签页时通知
            case 'focusLost':
                return document.hidden || !this.hasFocus;  // 失去焦点或页面隐藏时通知
            default:
                return document.hidden || !this.hasFocus;
        }
    };

    /**
     * 新会话通知
     */
    NotificationManager.prototype.notifyNewSession = function(sessionId, projectPath) {
        // 避免重复通知
        if (sessionId === this.lastSessionId) {
            console.log('🔇 跳过重复的会话通知');
            return;
        }
        
        // 检查是否可以通知
        if (!this.canNotify()) {
            console.log('🔇 不符合通知条件', {
                enabled: this.enabled,
                permission: this.permission,
                pageHidden: document.hidden,
                hasFocus: this.hasFocus,
                triggerMode: this.triggerMode
            });
            return;
        }
        
        this.lastSessionId = sessionId;
        
        try {
            const notification = new Notification(this.t('notification.browser.title', 'MCP Feedback - 新会话'), {
                body: `${this.t('notification.browser.ready', '准备就绪')}: ${this.truncatePath(projectPath)}`,
                icon: '/static/icon-192.png',
                badge: '/static/icon-192.png',
                tag: 'mcp-session',
                timestamp: Date.now(),
                silent: false
            });
            
            // 点击后聚焦窗口
            notification.onclick = () => {
                window.focus();
                notification.close();
                console.log('🖱️ 通知被点击，窗口已聚焦');
            };
            
            // 5秒后自动关闭
            setTimeout(() => notification.close(), 5000);
            
            console.log('🔔 已发送新会话通知', {
                sessionId: sessionId,
                projectPath: projectPath
            });
        } catch (error) {
            console.error('❌ 发送通知失败:', error);
        }
    };

    /**
     * 紧急通知（连接问题等）
     */
    NotificationManager.prototype.notifyCritical = function(type, message) {
        if (!this.canNotify()) return;
        
        try {
            const notification = new Notification(this.t('notification.browser.criticalTitle', 'MCP Feedback - 警告'), {
                body: message,
                icon: '/static/icon-192.png',
                badge: '/static/icon-192.png',
                tag: 'mcp-critical',
                requireInteraction: true,  // 需要手动关闭
                timestamp: Date.now()
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
                console.log('🖱️ 紧急通知被点击');
            };
            
            console.log('⚠️ 已发送紧急通知', {
                type: type,
                message: message
            });
        } catch (error) {
            console.error('❌ 发送紧急通知失败:', error);
        }
    };

    /**
     * 路径截断显示
     */
    NotificationManager.prototype.truncatePath = function(path, maxLength) {
        maxLength = maxLength || 50;
        if (!path || path.length <= maxLength) return path || this.t('notification.browser.unknownProject', '未知项目');
        return '...' + path.slice(-(maxLength - 3));
    };

    /**
     * 设置触发模式
     */
    NotificationManager.prototype.setTriggerMode = function(mode) {
        const validModes = ['always', 'background', 'tabSwitch', 'focusLost'];
        if (validModes.includes(mode)) {
            this.triggerMode = mode;
            try {
                localStorage.setItem(this.TRIGGER_MODE_KEY, mode);
                console.log('✅ 通知触发模式已更新:', mode);
            } catch (error) {
                console.error('❌ 保存触发模式失败:', error);
            }
        }
    };

    /**
     * 获取当前设置
     */
    NotificationManager.prototype.getSettings = function() {
        return {
            enabled: this.enabled,
            permission: this.permission,
            browserSupported: this.checkBrowserSupport(),
            triggerMode: this.triggerMode
        };
    };

    /**
     * 测试通知
     */
    NotificationManager.prototype.testNotification = function() {
        if (!this.checkBrowserSupport()) {
            alert(this.t('notification.browser.notSupported', '您的浏览器不支持通知功能'));
            return;
        }
        
        if (this.permission !== 'granted') {
            alert(this.t('notification.browser.permissionRequired', '请先授权通知权限'));
            return;
        }
        
        try {
            const notification = new Notification(this.t('notification.browser.testTitle', '测试通知'), {
                body: this.t('notification.browser.testBody', '这是一个测试通知，5秒后将自动关闭'),
                icon: '/static/icon-192.png',
                tag: 'mcp-test',
                timestamp: Date.now()
            });
            
            notification.onclick = () => {
                notification.close();
            };
            
            setTimeout(() => notification.close(), 5000);
            
            console.log('🔔 测试通知已发送');
        } catch (error) {
            console.error('❌ 测试通知失败:', error);
            alert('发送测试通知失败');
        }
    };

    // 导出到全域命名空间
    window.MCPFeedback.NotificationManager = NotificationManager;

})();