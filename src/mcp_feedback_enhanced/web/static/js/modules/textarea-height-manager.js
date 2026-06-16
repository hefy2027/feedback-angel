/**
 * Textarea 高度管理器
 * 负责监听 textarea 高度变化并持久化设置
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * TextareaHeightManager 建构函数
     */
    function TextareaHeightManager(options) {
        options = options || {};
        
        // 设置管理器实例
        this.settingsManager = options.settingsManager || null;
        
        // 已注册的 textarea 元素
        this.registeredTextareas = new Map();
        
        // ResizeObserver 实例
        this.resizeObserver = null;
        
        // 防抖计时器
        this.debounceTimers = new Map();
        
        // 防抖延迟（毫秒）
        this.debounceDelay = options.debounceDelay || 500;
        
        console.log('📏 TextareaHeightManager 建构函数初始化完成');
    }

    /**
     * 初始化高度管理器
     */
    TextareaHeightManager.prototype.initialize = function() {
        console.log('📏 开始初始化 TextareaHeightManager...');
        
        // 检查 ResizeObserver 支持
        if (!window.ResizeObserver) {
            console.warn('📏 浏览器不支持 ResizeObserver，将使用备用方案');
            this.initializeFallback();
            return;
        }
        
        // 创建 ResizeObserver
        this.createResizeObserver();
        
        console.log('✅ TextareaHeightManager 初始化完成');
    };

    /**
     * 创建 ResizeObserver
     */
    TextareaHeightManager.prototype.createResizeObserver = function() {
        const self = this;
        
        this.resizeObserver = new ResizeObserver(function(entries) {
            entries.forEach(function(entry) {
                const element = entry.target;
                const config = self.registeredTextareas.get(element);
                
                if (config) {
                    self.handleResize(element, config);
                }
            });
        });
        
        console.log('📏 ResizeObserver 创建完成');
    };

    /**
     * 处理 textarea 尺寸变化
     */
    TextareaHeightManager.prototype.handleResize = function(element, config) {
        const self = this;
        const settingKey = config.settingKey;
        
        // 清除之前的防抖计时器
        if (this.debounceTimers.has(settingKey)) {
            clearTimeout(this.debounceTimers.get(settingKey));
        }
        
        // 设置新的防抖计时器
        const timer = setTimeout(function() {
            const currentHeight = element.offsetHeight;
            
            // 检查高度是否有变化
            if (currentHeight !== config.lastHeight) {
                console.log('📏 侦测到 ' + settingKey + ' 高度变化:', config.lastHeight + 'px → ' + currentHeight + 'px');
                
                // 更新记录的高度
                config.lastHeight = currentHeight;
                
                // 保存到设置
                if (self.settingsManager) {
                    self.settingsManager.set(settingKey, currentHeight);
                }
            }
            
            // 清除计时器记录
            self.debounceTimers.delete(settingKey);
        }, this.debounceDelay);
        
        this.debounceTimers.set(settingKey, timer);
    };

    /**
     * 注册 textarea 元素
     */
    TextareaHeightManager.prototype.registerTextarea = function(elementId, settingKey) {
        const element = Utils.safeQuerySelector('#' + elementId);
        
        if (!element) {
            console.warn('📏 找不到元素:', elementId);
            return false;
        }
        
        if (element.tagName.toLowerCase() !== 'textarea') {
            console.warn('📏 元素不是 textarea:', elementId);
            return false;
        }
        
        // 加载并应用保存的高度
        this.loadAndApplyHeight(element, settingKey);
        
        // 创建配置对象
        const config = {
            elementId: elementId,
            settingKey: settingKey,
            lastHeight: element.offsetHeight
        };
        
        // 注册到 Map
        this.registeredTextareas.set(element, config);
        
        // 开始监听
        if (this.resizeObserver) {
            this.resizeObserver.observe(element);
        }
        
        console.log('📏 已注册 textarea:', elementId, '设置键:', settingKey);
        return true;
    };

    /**
     * 加载并应用保存的高度
     */
    TextareaHeightManager.prototype.loadAndApplyHeight = function(element, settingKey) {
        if (!this.settingsManager) {
            console.warn('📏 没有设置管理器，无法加载高度设置');
            return;
        }
        
        const savedHeight = this.settingsManager.get(settingKey);
        
        if (savedHeight && typeof savedHeight === 'number' && savedHeight > 0) {
            // 确保不小于最小高度
            const minHeight = this.getMinHeight(element);
            const finalHeight = Math.max(savedHeight, minHeight);
            
            // 应用高度
            element.style.height = finalHeight + 'px';
            
            console.log('📏 已恢复 ' + settingKey + ' 高度:', finalHeight + 'px');
        } else {
            console.log('📏 没有找到 ' + settingKey + ' 的保存高度，使用默认值');
        }
    };

    /**
     * 获取元素的最小高度
     */
    TextareaHeightManager.prototype.getMinHeight = function(element) {
        const computedStyle = window.getComputedStyle(element);
        const minHeight = computedStyle.minHeight;
        
        if (minHeight && minHeight !== 'none') {
            const value = parseInt(minHeight);
            if (!isNaN(value)) {
                return value;
            }
        }
        
        // 缺省最小高度
        return 150;
    };

    /**
     * 取消注册 textarea 元素
     */
    TextareaHeightManager.prototype.unregisterTextarea = function(elementId) {
        const element = Utils.safeQuerySelector('#' + elementId);
        
        if (!element) {
            return false;
        }
        
        const config = this.registeredTextareas.get(element);
        
        if (config) {
            // 停止监听
            if (this.resizeObserver) {
                this.resizeObserver.unobserve(element);
            }
            
            // 清除防抖计时器
            if (this.debounceTimers.has(config.settingKey)) {
                clearTimeout(this.debounceTimers.get(config.settingKey));
                this.debounceTimers.delete(config.settingKey);
            }
            
            // 从 Map 中移除
            this.registeredTextareas.delete(element);
            
            console.log('📏 已取消注册 textarea:', elementId);
            return true;
        }
        
        return false;
    };

    /**
     * 备用方案初始化（当不支持 ResizeObserver 时）
     */
    TextareaHeightManager.prototype.initializeFallback = function() {
        console.log('📏 使用备用方案初始化...');
        
        // 备用方案可以使用 MutationObserver 或定期检查
        // 这里先实作基本功能，主要是加载保存的高度
        console.log('📏 备用方案初始化完成（仅支持加载功能）');
    };

    /**
     * 销毁管理器
     */
    TextareaHeightManager.prototype.destroy = function() {
        console.log('📏 开始销毁 TextareaHeightManager...');
        
        // 清除所有防抖计时器
        this.debounceTimers.forEach(function(timer) {
            clearTimeout(timer);
        });
        this.debounceTimers.clear();
        
        // 停止所有监听
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        // 清除注册记录
        this.registeredTextareas.clear();
        
        console.log('✅ TextareaHeightManager 销毁完成');
    };

    // 将 TextareaHeightManager 加入命名空间
    window.MCPFeedback.TextareaHeightManager = TextareaHeightManager;

    console.log('✅ TextareaHeightManager 模块加载完成');

})();
