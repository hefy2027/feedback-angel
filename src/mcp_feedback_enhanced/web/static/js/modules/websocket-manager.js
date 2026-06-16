/**
 * MCP Feedback Enhanced - WebSocket 管理模块
 * =========================================
 * 
 * 处理 WebSocket 连接、消息传递和重连逻辑
 */

(function() {
    'use strict';

    // 确保命名空间和依赖存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * WebSocket 管理器建构函数
     */
    function WebSocketManager(options) {
        options = options || {};

        this.websocket = null;
        this.isConnected = false;
        this.connectionReady = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || Utils.CONSTANTS.MAX_RECONNECT_ATTEMPTS;
        this.reconnectDelay = options.reconnectDelay || Utils.CONSTANTS.DEFAULT_RECONNECT_DELAY;
        this.heartbeatInterval = null;
        this.heartbeatFrequency = options.heartbeatFrequency || Utils.CONSTANTS.DEFAULT_HEARTBEAT_FREQUENCY;

        // 事件回调
        this.onOpen = options.onOpen || null;
        this.onMessage = options.onMessage || null;
        this.onClose = options.onClose || null;
        this.onError = options.onError || null;
        this.onConnectionStatusChange = options.onConnectionStatusChange || null;

        // 标签页管理器引用
        this.tabManager = options.tabManager || null;

        // 连接监控器引用
        this.connectionMonitor = options.connectionMonitor || null;

        // 待处理的提交
        this.pendingSubmission = null;
        this.sessionUpdatePending = false;

        // 网络状态检测
        this.networkOnline = navigator.onLine;
        this.setupNetworkStatusDetection();
        
        // 会话超时计时器
        this.sessionTimeoutTimer = null;
        this.sessionTimeoutInterval = null; // 用于更新倒数显示
        this.sessionTimeoutRemaining = 0; // 剩余秒数
        this.sessionTimeoutSettings = {
            enabled: false,
            seconds: 3600
        };
    }

    /**
     * 创建 WebSocket 连接
     */
    WebSocketManager.prototype.connect = function() {
        if (!Utils.isWebSocketSupported()) {
            console.error('❌ 浏览器不支持 WebSocket');
            return;
        }

        // 确保 WebSocket URL 格式正确
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = protocol + '//' + host + '/ws';

        console.log('尝试连接 WebSocket:', wsUrl);
        const connectingMessage = window.i18nManager ? window.i18nManager.t('connectionMonitor.connecting') : '连接中...';
        this.updateConnectionStatus('connecting', connectingMessage);

        try {
            // 如果已有连接，先关闭
            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }

            // 添加语言参数到 WebSocket URL
            const language = window.i18nManager ? window.i18nManager.getCurrentLanguage() : 'zh-TW';
            const wsUrlWithLang = wsUrl + (wsUrl.includes('?') ? '&' : '?') + 'lang=' + language;
            this.websocket = new WebSocket(wsUrlWithLang);
            this.setupWebSocketEvents();

        } catch (error) {
            console.error('WebSocket 连接失败:', error);
            const connectionFailedMessage = window.i18nManager ? window.i18nManager.t('connectionMonitor.connectionFailed') : '连接失败';
            this.updateConnectionStatus('error', connectionFailedMessage);
        }
    };

    /**
     * 设置 WebSocket 事件监听器
     */
    WebSocketManager.prototype.setupWebSocketEvents = function() {
        const self = this;

        this.websocket.onopen = function() {
            self.handleOpen();
        };

        this.websocket.onmessage = function(event) {
            self.handleMessage(event);
        };

        this.websocket.onclose = function(event) {
            self.handleClose(event);
        };

        this.websocket.onerror = function(error) {
            self.handleError(error);
        };
    };

    /**
     * 处理连接打开
     */
    WebSocketManager.prototype.handleOpen = function() {
        this.isConnected = true;
        this.connectionReady = false; // 等待连接确认
        const connectedMessage = window.i18nManager ? window.i18nManager.t('connectionMonitor.connected') : '已连接';
        this.updateConnectionStatus('connected', connectedMessage);
        console.log('WebSocket 连接已创建');

        // 重置重连计数器和延迟
        this.reconnectAttempts = 0;
        this.reconnectDelay = Utils.CONSTANTS.DEFAULT_RECONNECT_DELAY;

        // 通知连接监控器
        if (this.connectionMonitor) {
            this.connectionMonitor.startMonitoring();
        }

        // 开始心跳
        this.startHeartbeat();

        // 请求会话状态
        this.requestSessionStatus();

        // 调用外部回调
        if (this.onOpen) {
            this.onOpen();
        }
    };

    /**
     * 处理消息接收
     */
    WebSocketManager.prototype.handleMessage = function(event) {
        try {
            const data = Utils.safeJsonParse(event.data, null);
            if (data) {
                // 记录消息到监控器
                if (this.connectionMonitor) {
                    this.connectionMonitor.recordMessage();
                }

                this.processMessage(data);

                // 调用外部回调
                if (this.onMessage) {
                    this.onMessage(data);
                }
            }
        } catch (error) {
            console.error('解析 WebSocket 消息失败:', error);
        }
    };

    /**
     * 处理连接关闭
     */
    WebSocketManager.prototype.handleClose = function(event) {
        this.isConnected = false;
        this.connectionReady = false;
        console.log('WebSocket 连接已关闭, code:', event.code, 'reason:', event.reason);

        // 停止心跳
        this.stopHeartbeat();

        // 通知连接监控器
        if (this.connectionMonitor) {
            this.connectionMonitor.stopMonitoring();
        }

        // 处理不同的关闭原因
        if (event.code === 4004) {
            const noActiveSessionMessage = window.i18nManager ? window.i18nManager.t('connectionMonitor.noActiveSession') : '没有活跃会话';
            this.updateConnectionStatus('disconnected', noActiveSessionMessage);
        } else {
            const disconnectedMessage = window.i18nManager ? window.i18nManager.t('connectionMonitor.disconnected') : '已断开';
            this.updateConnectionStatus('disconnected', disconnectedMessage);
            this.handleReconnection(event);
        }

        // 调用外部回调
        if (this.onClose) {
            this.onClose(event);
        }
    };

    /**
     * 处理连接错误
     */
    WebSocketManager.prototype.handleError = function(error) {
        console.error('WebSocket 错误:', error);
        const connectionErrorMessage = window.i18nManager ? window.i18nManager.t('connectionMonitor.connectionError') : '连接错误';
        this.updateConnectionStatus('error', connectionErrorMessage);

        // 调用外部回调
        if (this.onError) {
            this.onError(error);
        }
    };

    /**
     * 处理重连逻辑
     */
    WebSocketManager.prototype.handleReconnection = function(event) {
        // 会话更新导致的正常关闭，立即重连
        if (event.code === 1000 && event.reason === '会话更新') {
            console.log('🔄 会话更新导致的连接关闭，立即重连...');
            this.sessionUpdatePending = true;
            const self = this;
            setTimeout(function() {
                self.connect();
            }, 200);
        }
        // 检查是否应该重连
        else if (this.shouldAttemptReconnect(event)) {
            this.reconnectAttempts++;

            // 改进的指数退避算法：基础延迟 * 2^重试次数，加上随机抖动
            const baseDelay = Utils.CONSTANTS.DEFAULT_RECONNECT_DELAY;
            const exponentialDelay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
            const jitter = Math.random() * 1000; // 0-1秒的随机抖动
            this.reconnectDelay = Math.min(exponentialDelay + jitter, 30000); // 最大 30 秒

            console.log(Math.round(this.reconnectDelay / 1000) + '秒后尝试重连... (第' + this.reconnectAttempts + '次)');

            // 更新状态为重连中
            const reconnectingTemplate = window.i18nManager ? window.i18nManager.t('connectionMonitor.reconnecting') : '重连中... (第{attempt}次)';
            const reconnectingMessage = reconnectingTemplate.replace('{attempt}', this.reconnectAttempts);
            this.updateConnectionStatus('reconnecting', reconnectingMessage);

            const self = this;
            setTimeout(function() {
                console.log('🔄 开始重连 WebSocket... (第' + self.reconnectAttempts + '次)');
                self.connect();
            }, this.reconnectDelay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('❌ 达到最大重连次数，停止重连');
            const maxReconnectMessage = window.i18nManager ? window.i18nManager.t('connectionMonitor.maxReconnectReached') : 'WebSocket 连接失败，请刷新页面重试';
            Utils.showMessage(maxReconnectMessage, Utils.CONSTANTS.MESSAGE_ERROR);
        }
    };

    /**
     * 处理消息
     */
    WebSocketManager.prototype.processMessage = function(data) {
        console.log('收到 WebSocket 消息:', data);

        switch (data.type) {
            case 'connection_established':
                console.log('WebSocket 连接确认');
                this.connectionReady = true;
                this.handleConnectionReady();
                // 处理消息代码
                if (data.messageCode && window.i18nManager) {
                    const message = window.i18nManager.t(data.messageCode);
                    Utils.showMessage(message, Utils.CONSTANTS.MESSAGE_SUCCESS);
                }
                break;
            case 'heartbeat_response':
                this.handleHeartbeatResponse();
                // 记录 pong 时间到监控器
                if (this.connectionMonitor) {
                    this.connectionMonitor.recordPong();
                }
                break;
            case 'ping':
                // 处理来自服务器的 ping 消息（用于连接检测）
                console.log('收到服务器 ping，立即回应 pong');
                this.send({
                    type: 'pong',
                    timestamp: data.timestamp
                });
                break;
            case 'update_timeout_settings':
                // 处理超时设置更新
                if (data.settings) {
                    this.updateSessionTimeoutSettings(data.settings);
                }
                break;
            default:
                // 其他消息类型由外部处理
                break;
        }
    };

    /**
     * 处理连接就绪
     */
    WebSocketManager.prototype.handleConnectionReady = function() {
        // 如果有待提交的内容，现在可以提交了
        if (this.pendingSubmission) {
            console.log('🔄 连接就绪，提交待处理的内容');
            const self = this;
            setTimeout(function() {
                if (self.pendingSubmission) {
                    self.send(self.pendingSubmission);
                    self.pendingSubmission = null;
                }
            }, 100);
        }
    };

    /**
     * 处理心跳回应
     */
    WebSocketManager.prototype.handleHeartbeatResponse = function() {
        if (this.tabManager) {
            this.tabManager.updateLastActivity();
        }
    };

    /**
     * 发送消息
     */
    WebSocketManager.prototype.send = function(data) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            try {
                this.websocket.send(JSON.stringify(data));
                return true;
            } catch (error) {
                console.error('发送 WebSocket 消息失败:', error);
                return false;
            }
        } else {
            console.warn('WebSocket 未连接，无法发送消息');
            return false;
        }
    };

    /**
     * 请求会话状态
     */
    WebSocketManager.prototype.requestSessionStatus = function() {
        this.send({
            type: 'get_status'
        });
    };

    /**
     * 开始心跳
     */
    WebSocketManager.prototype.startHeartbeat = function() {
        this.stopHeartbeat();

        const self = this;
        this.heartbeatInterval = setInterval(function() {
            if (self.websocket && self.websocket.readyState === WebSocket.OPEN) {
                // 记录 ping 时间到监控器
                if (self.connectionMonitor) {
                    self.connectionMonitor.recordPing();
                }

                self.send({
                    type: 'heartbeat',
                    tabId: self.tabManager ? self.tabManager.getTabId() : null,
                    timestamp: Date.now()
                });
            }
        }, this.heartbeatFrequency);

        console.log('💓 WebSocket 心跳已启动，频率: ' + this.heartbeatFrequency + 'ms');
    };

    /**
     * 停止心跳
     */
    WebSocketManager.prototype.stopHeartbeat = function() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('💔 WebSocket 心跳已停止');
        }
    };

    /**
     * 更新连接状态
     */
    WebSocketManager.prototype.updateConnectionStatus = function(status, text) {
        if (this.onConnectionStatusChange) {
            this.onConnectionStatusChange(status, text);
        }
    };

    /**
     * 设置待处理的提交
     */
    WebSocketManager.prototype.setPendingSubmission = function(data) {
        this.pendingSubmission = data;
    };

    /**
     * 检查是否已连接且就绪
     */
    WebSocketManager.prototype.isReady = function() {
        return this.isConnected && this.connectionReady;
    };

    /**
     * 设置网络状态检测
     */
    WebSocketManager.prototype.setupNetworkStatusDetection = function() {
        const self = this;

        // 监听网络状态变化
        window.addEventListener('online', function() {
            console.log('🌐 网络已恢复，尝试重新连接...');
            self.networkOnline = true;

            // 如果 WebSocket 未连接且不在重连过程中，立即尝试连接
            if (!self.isConnected && self.reconnectAttempts < self.maxReconnectAttempts) {
                // 重置重连计数器，因为网络问题已解决
                self.reconnectAttempts = 0;
                self.reconnectDelay = Utils.CONSTANTS.DEFAULT_RECONNECT_DELAY;

                setTimeout(function() {
                    self.connect();
                }, 1000); // 延迟 1 秒确保网络稳定
            }
        });

        window.addEventListener('offline', function() {
            console.log('🌐 网络已断开');
            self.networkOnline = false;

            // 更新连接状态
            const offlineMessage = window.i18nManager ?
                window.i18nManager.t('connectionMonitor.offline', '网络已断开') :
                '网络已断开';
            self.updateConnectionStatus('offline', offlineMessage);
        });
    };

    /**
     * 检查是否应该尝试重连
     */
    WebSocketManager.prototype.shouldAttemptReconnect = function(event) {
        // 如果网络脱机，不尝试重连
        if (!this.networkOnline) {
            console.log('🌐 网络脱机，跳过重连');
            return false;
        }

        // 如果是正常关闭，不重连
        if (event.code === 1000) {
            return false;
        }

        // 如果达到最大重连次数，不重连
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            return false;
        }

        return true;
    };

    /**
     * 更新会话超时设置
     */
    WebSocketManager.prototype.updateSessionTimeoutSettings = function(settings) {
        this.sessionTimeoutSettings = settings;
        console.log('会话超时设置已更新:', settings);
        
        // 重新启动计时器
        if (settings.enabled) {
            this.startSessionTimeout();
        } else {
            this.stopSessionTimeout();
        }
    };

    /**
     * 启动会话超时计时器
     */
    WebSocketManager.prototype.startSessionTimeout = function() {
        // 先停止现有计时器
        this.stopSessionTimeout();
        
        if (!this.sessionTimeoutSettings.enabled) {
            return;
        }
        
        const timeoutSeconds = this.sessionTimeoutSettings.seconds;
        this.sessionTimeoutRemaining = timeoutSeconds;
        
        console.log('启动会话超时计时器:', timeoutSeconds, '秒');
        
        // 显示倒数计时器
        const displayElement = document.getElementById('sessionTimeoutDisplay');
        if (displayElement) {
            displayElement.style.display = '';
        }
        
        const self = this;
        
        // 更新倒数显示
        function updateDisplay() {
            const minutes = Math.floor(self.sessionTimeoutRemaining / 60);
            const seconds = self.sessionTimeoutRemaining % 60;
            const displayText = minutes.toString().padStart(2, '0') + ':' + 
                               seconds.toString().padStart(2, '0');
            
            const timerElement = document.getElementById('sessionTimeoutTimer');
            if (timerElement) {
                timerElement.textContent = displayText;
            }
            
            // 当剩余时间少于60秒时，改变显示样式
            if (self.sessionTimeoutRemaining < 60 && displayElement) {
                displayElement.classList.add('countdown-warning');
            }
        }
        
        // 立即更新一次显示
        updateDisplay();
        
        // 每秒更新倒数
        this.sessionTimeoutInterval = setInterval(function() {
            self.sessionTimeoutRemaining--;
            updateDisplay();
            
            if (self.sessionTimeoutRemaining <= 0) {
                clearInterval(self.sessionTimeoutInterval);
                self.sessionTimeoutInterval = null;
                
                console.log('会话超时，准备关闭进程');
                
                // 发送超时通知给后端
                if (self.isConnected) {
                    self.send({
                        type: 'user_timeout',
                        timestamp: Date.now()
                    });
                }
                
                // 显示超时消息
                const timeoutMessage = window.i18nManager ?
                    window.i18nManager.t('sessionTimeout.triggered', '会话已超时，进程即将关闭') :
                    '会话已超时，进程即将关闭';
                Utils.showMessage(timeoutMessage, Utils.CONSTANTS.MESSAGE_WARNING);
                
                // 延迟关闭，让用户看到消息
                setTimeout(function() {
                    window.close();
                }, 3000);
            }
        }, 1000);
    };

    /**
     * 停止会话超时计时器
     */
    WebSocketManager.prototype.stopSessionTimeout = function() {
        if (this.sessionTimeoutTimer) {
            clearTimeout(this.sessionTimeoutTimer);
            this.sessionTimeoutTimer = null;
        }
        
        if (this.sessionTimeoutInterval) {
            clearInterval(this.sessionTimeoutInterval);
            this.sessionTimeoutInterval = null;
        }
        
        // 隐藏倒数显示
        const displayElement = document.getElementById('sessionTimeoutDisplay');
        if (displayElement) {
            displayElement.style.display = 'none';
            displayElement.classList.remove('countdown-warning');
        }
        
        console.log('会话超时计时器已停止');
    };

    /**
     * 重置会话超时计时器（用户有活动时调用）
     */
    WebSocketManager.prototype.resetSessionTimeout = function() {
        if (this.sessionTimeoutSettings.enabled) {
            console.log('重置会话超时计时器');
            this.startSessionTimeout();
        }
    };

    /**
     * 关闭连接
     */
    WebSocketManager.prototype.close = function() {
        this.stopHeartbeat();
        this.stopSessionTimeout();
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.isConnected = false;
        this.connectionReady = false;
    };

    // 将 WebSocketManager 加入命名空间
    window.MCPFeedback.WebSocketManager = WebSocketManager;

    console.log('✅ WebSocketManager 模块加载完成');

})();
