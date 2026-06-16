/**
 * MCP Feedback Enhanced - 通知设置接口模块
 * =====================================
 * 
 * 处理浏览器通知的设置接口，提供简单的开关控制
 * 与 NotificationManager 配合使用
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * 通知设置接口建构函数
     */
    function NotificationSettings(options) {
        options = options || {};
        
        // 容器元素
        this.container = options.container || null;
        
        // 通知管理器引用
        this.notificationManager = options.notificationManager || null;
        
        // i18n 翻译函数
        this.t = options.t || function(key, defaultValue) { return defaultValue || key; };
        
        // UI 元素引用
        this.toggle = null;
        this.statusDiv = null;
        this.testButton = null;
        this.triggerOptionsDiv = null;
        
        console.log('🎨 NotificationSettings 初始化完成');
    }

    /**
     * 初始化设置接口
     */
    NotificationSettings.prototype.initialize = function() {
        if (!this.container) {
            console.error('❌ NotificationSettings 容器未设置');
            return;
        }

        if (!this.notificationManager) {
            console.error('❌ NotificationManager 未设置');
            return;
        }

        this.createUI();
        this.setupEventListeners();
        this.updateUI();

        // 应用翻译到动态生成的内容
        if (window.i18nManager) {
            window.i18nManager.applyTranslations();
        }

        console.log('✅ NotificationSettings 初始化完成');
    };

    /**
     * 创建 UI 结构
     */
    NotificationSettings.prototype.createUI = function() {
        const html = `
            <!-- 激活开关 -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-label" data-i18n="notification.settingLabel"></div>
                    <div class="setting-description" data-i18n="notification.description"></div>
                    <!-- 权限状态 -->
                    <div id="permissionStatus" class="permission-status">
                        <!-- 动态更新 -->
                    </div>
                </div>
                <div class="setting-control">
                    <button type="button" id="notificationToggle" class="toggle-btn" data-i18n-aria-label="aria.toggleNotification">
                        <span class="toggle-slider"></span>
                    </button>
                </div>
            </div>
            
            <!-- 通知触发情境 -->
            <div class="setting-item notification-trigger" style="display: none;">
                <div class="setting-info">
                    <div class="setting-label" data-i18n="notification.triggerTitle"></div>
                    <div class="setting-description" data-i18n="notification.triggerDescription"></div>
                </div>
                <div class="trigger-options">
                    <label class="radio-option">
                        <input type="radio" name="notificationTrigger" value="focusLost" checked>
                        <span data-i18n="notification.trigger.focusLost"></span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="notificationTrigger" value="tabSwitch">
                        <span data-i18n="notification.trigger.tabSwitch"></span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="notificationTrigger" value="background">
                        <span data-i18n="notification.trigger.background"></span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="notificationTrigger" value="always">
                        <span data-i18n="notification.trigger.always"></span>
                    </label>
                </div>
            </div>
            
            <!-- 测试按钮 -->
            <div class="setting-item notification-actions" style="display: none;">
                <div class="setting-info">
                    <div class="setting-label" data-i18n="notification.testTitle"></div>
                    <div class="setting-description" data-i18n="notification.testDescription"></div>
                </div>
                <div class="setting-control">
                    <button type="button" id="testNotification" class="btn-primary">
                        <span data-i18n="notification.test"></span>
                    </button>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // 取得元素引用
        this.toggle = this.container.querySelector('#notificationToggle');
        this.statusDiv = this.container.querySelector('#permissionStatus');
        this.testButton = this.container.querySelector('#testNotification');
        this.triggerOptionsDiv = this.container.querySelector('.notification-trigger');
    };

    /**
     * 设置事件监听器
     */
    NotificationSettings.prototype.setupEventListeners = function() {
        const self = this;
        
        // 开关切换事件
        this.toggle.addEventListener('click', async function(e) {
            const isActive = self.toggle.classList.contains('active');
            if (!isActive) {
                await self.enableNotifications();
            } else {
                self.disableNotifications();
            }
        });
        
        // 测试按钮事件
        if (this.testButton) {
            this.testButton.addEventListener('click', function() {
                self.notificationManager.testNotification();
            });
        }
        
        // 监听页面可见性变化，更新权限状态
        document.addEventListener('visibilitychange', function() {
            self.updatePermissionStatus();
        });
        
        // 触发模式选项事件
        const triggerRadios = this.container.querySelectorAll('input[name="notificationTrigger"]');
        triggerRadios.forEach(function(radio) {
            radio.addEventListener('change', function() {
                if (radio.checked) {
                    self.notificationManager.setTriggerMode(radio.value);
                    self.showMessage(
                        self.t('notification.triggerModeUpdated', '通知触发模式已更新'),
                        'success'
                    );
                }
            });
        });
    };

    /**
     * 更新 UI 状态
     */
    NotificationSettings.prototype.updateUI = function() {
        const settings = this.notificationManager.getSettings();
        
        // 设置开关状态
        if (settings.enabled) {
            this.toggle.classList.add('active');
        } else {
            this.toggle.classList.remove('active');
        }
        
        // 更新权限状态显示
        this.updatePermissionStatus();
        
        // 显示/隐藏测试按钮和触发选项
        const actionsDiv = this.container.querySelector('.notification-actions');
        if (actionsDiv) {
            actionsDiv.style.display = (settings.enabled && settings.permission === 'granted') ? 'block' : 'none';
        }
        
        if (this.triggerOptionsDiv) {
            this.triggerOptionsDiv.style.display = (settings.enabled && settings.permission === 'granted') ? 'block' : 'none';
            
            // 设置当前选中的触发模式
            const currentMode = settings.triggerMode || 'focusLost';
            const radio = this.container.querySelector(`input[name="notificationTrigger"][value="${currentMode}"]`);
            if (radio) {
                radio.checked = true;
            }
        }
    };

    /**
     * 激活通知
     */
    NotificationSettings.prototype.enableNotifications = async function() {
        try {
            const success = await this.notificationManager.enable();
            
            if (success) {
                this.showMessage(this.t('notification.enabled', '通知已激活 ✅'), 'success');
                this.updateUI();
            } else {
                // 权限被拒绝或其他问题
                this.toggle.classList.remove('active');
                this.updatePermissionStatus();
                
                if (this.notificationManager.permission === 'denied') {
                    this.showMessage(
                        this.t('notification.permissionDenied', '浏览器已封锁通知，请在浏览器设置中允许'),
                        'error'
                    );
                } else {
                    this.showMessage(
                        this.t('notification.permissionRequired', '需要通知权限才能激活此功能'),
                        'warning'
                    );
                }
            }
        } catch (error) {
            console.error('❌ 激活通知失败:', error);
            this.toggle.checked = false;
            this.showMessage(
                this.t('notification.enableFailed', '激活通知失败'),
                'error'
            );
        }
    };

    /**
     * 停用通知
     */
    NotificationSettings.prototype.disableNotifications = function() {
        this.notificationManager.disable();
        this.showMessage(this.t('notification.disabled', '通知已关闭'), 'info');
        this.updateUI();
    };

    /**
     * 更新权限状态显示
     */
    NotificationSettings.prototype.updatePermissionStatus = function() {
        const settings = this.notificationManager.getSettings();
        
        if (!settings.browserSupported) {
            this.statusDiv.innerHTML = `<span data-i18n="notification.notSupported"></span>`;
            this.statusDiv.className = 'permission-status status-unsupported';
            this.toggle.disabled = true;
            return;
        }
        
        const statusMessages = {
            'granted': {
                icon: '✅',
                text: this.t('notification.permissionGranted', '已授权'),
                class: 'status-granted',
                i18nKey: 'notification.permissionGranted'
            },
            'denied': {
                icon: '❌',
                text: this.t('notification.permissionDeniedStatus', '已拒绝（请在浏览器设置中修改）'),
                class: 'status-denied',
                i18nKey: 'notification.permissionDeniedStatus'
            },
            'default': {
                icon: '⏸',
                text: this.t('notification.permissionDefault', '尚未设置'),
                class: 'status-default',
                i18nKey: 'notification.permissionDefault'
            }
        };
        
        const status = statusMessages[settings.permission] || statusMessages['default'];
        
        // 将图标和文本合并在同一个元素内，并加入 data-i18n 属性以支持动态语言切换
        this.statusDiv.innerHTML = `<span data-i18n="${status.i18nKey}">${status.icon} ${status.text}</span>`;
        this.statusDiv.className = `permission-status ${status.class}`;
    };

    /**
     * 显示消息
     */
    NotificationSettings.prototype.showMessage = function(message, type) {
        // 使用 Utils 的消息显示功能
        if (Utils && Utils.showMessage) {
            Utils.showMessage(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    };

    /**
     * 刷新接口
     */
    NotificationSettings.prototype.refresh = function() {
        this.updateUI();
    };

    /**
     * 清理资源
     */
    NotificationSettings.prototype.destroy = function() {
        // 移除事件监听器
        if (this.toggle) {
            this.toggle.removeEventListener('change', this.enableNotifications);
        }
        
        if (this.testButton) {
            this.testButton.removeEventListener('click', this.notificationManager.testNotification);
        }
        
        // 清空容器
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        console.log('🧹 NotificationSettings 已清理');
    };

    // 导出到全域命名空间
    window.MCPFeedback.NotificationSettings = NotificationSettings;

})();