/**
 * MCP Feedback Enhanced - DOM 操作工具模块
 * ==========================================
 * 
 * 提供通用的 DOM 操作和元素管理功能
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Utils = window.MCPFeedback.Utils || {};

    /**
     * DOM 工具类
     */
    const DOMUtils = {
        /**
         * 安全查找选择器
         */
        safeQuerySelector: function(selector) {
            try {
                return document.querySelector(selector);
            } catch (error) {
                console.warn('查找选择器失败:', selector, error);
                return null;
            }
        },

        /**
         * 安全查找所有选择器
         */
        safeQuerySelectorAll: function(selector) {
            try {
                return document.querySelectorAll(selector);
            } catch (error) {
                console.warn('查找所有选择器失败:', selector, error);
                return [];
            }
        },

        /**
         * 安全设置文本内容
         */
        safeSetTextContent: function(element, text) {
            if (element && typeof element.textContent !== 'undefined') {
                element.textContent = text || '';
                return true;
            }
            return false;
        },

        /**
         * 安全设置 HTML 内容
         */
        safeSetInnerHTML: function(element, html) {
            if (element && typeof element.innerHTML !== 'undefined') {
                element.innerHTML = html || '';
                return true;
            }
            return false;
        },

        /**
         * 安全添加 CSS 类
         */
        safeAddClass: function(element, className) {
            if (element && element.classList && className) {
                element.classList.add(className);
                return true;
            }
            return false;
        },

        /**
         * 安全移除 CSS 类
         */
        safeRemoveClass: function(element, className) {
            if (element && element.classList && className) {
                element.classList.remove(className);
                return true;
            }
            return false;
        },

        /**
         * 安全切换 CSS 类
         */
        safeToggleClass: function(element, className) {
            if (element && element.classList && className) {
                element.classList.toggle(className);
                return true;
            }
            return false;
        },

        /**
         * 检查元素是否包含指定类
         */
        hasClass: function(element, className) {
            return element && element.classList && element.classList.contains(className);
        },

        /**
         * 创建元素
         */
        createElement: function(tagName, options) {
            options = options || {};
            const element = document.createElement(tagName);

            if (options.className) {
                element.className = options.className;
            }

            if (options.id) {
                element.id = options.id;
            }

            if (options.textContent) {
                element.textContent = options.textContent;
            }

            if (options.innerHTML) {
                element.innerHTML = options.innerHTML;
            }

            if (options.attributes) {
                Object.keys(options.attributes).forEach(function(key) {
                    element.setAttribute(key, options.attributes[key]);
                });
            }

            if (options.styles) {
                Object.keys(options.styles).forEach(function(key) {
                    element.style[key] = options.styles[key];
                });
            }

            return element;
        },

        /**
         * 安全移除元素
         */
        safeRemoveElement: function(element) {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
                return true;
            }
            return false;
        },

        /**
         * 清空元素内容
         */
        clearElement: function(element) {
            if (element) {
                while (element.firstChild) {
                    element.removeChild(element.firstChild);
                }
                return true;
            }
            return false;
        },

        /**
         * 显示元素
         */
        showElement: function(element) {
            if (element) {
                element.style.display = '';
                return true;
            }
            return false;
        },

        /**
         * 隐藏元素
         */
        hideElement: function(element) {
            if (element) {
                element.style.display = 'none';
                return true;
            }
            return false;
        },

        /**
         * 切换元素显示状态
         */
        toggleElement: function(element) {
            if (element) {
                const isHidden = element.style.display === 'none' || 
                               window.getComputedStyle(element).display === 'none';
                if (isHidden) {
                    this.showElement(element);
                } else {
                    this.hideElement(element);
                }
                return true;
            }
            return false;
        },

        /**
         * 设置元素属性
         */
        setAttribute: function(element, name, value) {
            if (element && name) {
                element.setAttribute(name, value);
                return true;
            }
            return false;
        },

        /**
         * 获取元素属性
         */
        getAttribute: function(element, name) {
            if (element && name) {
                return element.getAttribute(name);
            }
            return null;
        },

        /**
         * 移除元素属性
         */
        removeAttribute: function(element, name) {
            if (element && name) {
                element.removeAttribute(name);
                return true;
            }
            return false;
        },

        /**
         * 添加事件监听器
         */
        addEventListener: function(element, event, handler, options) {
            if (element && event && typeof handler === 'function') {
                element.addEventListener(event, handler, options);
                return true;
            }
            return false;
        },

        /**
         * 移除事件监听器
         */
        removeEventListener: function(element, event, handler, options) {
            if (element && event && typeof handler === 'function') {
                element.removeEventListener(event, handler, options);
                return true;
            }
            return false;
        },

        /**
         * 获取元素的边界矩形
         */
        getBoundingRect: function(element) {
            if (element && typeof element.getBoundingClientRect === 'function') {
                return element.getBoundingClientRect();
            }
            return null;
        },

        /**
         * 检查元素是否在窗口内
         */
        isElementInViewport: function(element) {
            const rect = this.getBoundingRect(element);
            if (!rect) return false;

            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        },

        /**
         * 滚动到元素
         */
        scrollToElement: function(element, options) {
            if (element && typeof element.scrollIntoView === 'function') {
                element.scrollIntoView(options || { behavior: 'smooth', block: 'center' });
                return true;
            }
            return false;
        },

        /**
         * 防抖函数 - 延迟运行，在指定时间内重复调用会重置计时器
         * @param {Function} func - 要防抖的函数
         * @param {number} delay - 延迟时间（毫秒）
         * @param {boolean} immediate - 是否立即运行第一次调用
         * @returns {Function} 防抖后的函数
         */
        debounce: function(func, delay, immediate) {
            let timeoutId;
            return function() {
                const context = this;
                const args = arguments;

                const later = function() {
                    timeoutId = null;
                    if (!immediate) {
                        func.apply(context, args);
                    }
                };

                const callNow = immediate && !timeoutId;
                clearTimeout(timeoutId);
                timeoutId = setTimeout(later, delay);

                if (callNow) {
                    func.apply(context, args);
                }
            };
        },

        /**
         * 节流函数 - 限制函数运行频率，在指定时间内最多运行一次
         * @param {Function} func - 要节流的函数
         * @param {number} limit - 时间间隔（毫秒）
         * @returns {Function} 节流后的函数
         */
        throttle: function(func, limit) {
            let inThrottle;
            return function() {
                const context = this;
                const args = arguments;

                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(function() {
                        inThrottle = false;
                    }, limit);
                }
            };
        },

        /**
         * 创建带有防抖的函数包装器
         * @param {Object} target - 目标对象
         * @param {string} methodName - 方法名称
         * @param {number} delay - 防抖延迟时间
         * @param {boolean} immediate - 是否立即运行
         * @returns {Function} 原始函数的引用
         */
        wrapWithDebounce: function(target, methodName, delay, immediate) {
            if (!target || typeof target[methodName] !== 'function') {
                console.warn('无法为不存在的方法添加防抖:', methodName);
                return null;
            }

            const originalMethod = target[methodName];
            target[methodName] = this.debounce(originalMethod.bind(target), delay, immediate);
            return originalMethod;
        },

        /**
         * 创建带有节流的函数包装器
         * @param {Object} target - 目标对象
         * @param {string} methodName - 方法名称
         * @param {number} limit - 节流时间间隔
         * @returns {Function} 原始函数的引用
         */
        wrapWithThrottle: function(target, methodName, limit) {
            if (!target || typeof target[methodName] !== 'function') {
                console.warn('无法为不存在的方法添加节流:', methodName);
                return null;
            }

            const originalMethod = target[methodName];
            target[methodName] = this.throttle(originalMethod.bind(target), limit);
            return originalMethod;
        }
    };

    // 将 DOMUtils 加入命名空间
    window.MCPFeedback.DOMUtils = DOMUtils;
    window.MCPFeedback.Utils.DOM = DOMUtils; // 保持向后兼容

    console.log('✅ DOMUtils 模块加载完成');

})();
