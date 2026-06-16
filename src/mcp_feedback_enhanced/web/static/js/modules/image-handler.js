/**
 * MCP Feedback Enhanced - 图片处理模块
 * ==================================
 * 
 * 处理图片上传、预览、压缩和管理功能
 */

(function() {
    'use strict';

    // 确保命名空间和依赖存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * 图片处理器建构函数
     */
    function ImageHandler(options) {
        options = options || {};

        this.imageSizeLimit = options.imageSizeLimit || 0;
        this.enableBase64Detail = options.enableBase64Detail || false;
        this.layoutMode = options.layoutMode || 'combined-vertical';
        this.currentImagePrefix = '';

        // UI 元素（保留用于设置同步）
        this.imageSizeLimitSelect = null;
        this.enableBase64DetailCheckbox = null;

        // 回调函数
        this.onSettingsChange = options.onSettingsChange || null;

        // 创建文件上传管理器
        const self = this;
        this.fileUploadManager = new window.MCPFeedback.FileUploadManager({
            maxFileSize: this.imageSizeLimit,
            enableBase64Detail: this.enableBase64Detail,
            onFileAdd: function(fileData) {
                console.log('📁 文件已添加:', fileData.name);
            },
            onFileRemove: function(fileData, index) {
                console.log('🗑️ 文件已移除:', fileData.name);
            },
            onSettingsChange: function() {
                if (self.onSettingsChange) {
                    self.onSettingsChange();
                }
            }
        });

        console.log('🖼️ ImageHandler 建构函数初始化完成');
    }

    /**
     * 初始化图片处理器
     */
    ImageHandler.prototype.init = function() {
        console.log('🖼️ 开始初始化图片处理功能...');

        // 初始化设置元素
        this.initImageSettingsElements();

        // 初始化文件上传管理器
        this.fileUploadManager.initialize();

        console.log('✅ 图片处理功能初始化完成');
    };

    /**
     * 动态初始化图片相关元素
     */
    ImageHandler.prototype.initImageSettingsElements = function() {
        // 查找设置页签中的图片设置元素
        this.imageSizeLimitSelect = Utils.safeQuerySelector('#settingsImageSizeLimit');
        this.enableBase64DetailCheckbox = Utils.safeQuerySelector('#settingsEnableBase64Detail');

        // 初始化设置事件监听器
        this.initImageSettings();

        console.log('✅ 图片设置元素初始化完成');
    };





    /**
     * 移除图片设置事件监听器
     */
    ImageHandler.prototype.removeImageSettingsListeners = function() {
        if (this.imageSizeLimitSelect && this.imageSizeLimitChangeHandler) {
            this.imageSizeLimitSelect.removeEventListener('change', this.imageSizeLimitChangeHandler);
            this.imageSizeLimitChangeHandler = null;
        }

        if (this.enableBase64DetailCheckbox && this.enableBase64DetailChangeHandler) {
            this.enableBase64DetailCheckbox.removeEventListener('change', this.enableBase64DetailChangeHandler);
            this.enableBase64DetailChangeHandler = null;
        }
    };

    /**
     * 初始化图片设置事件
     */
    ImageHandler.prototype.initImageSettings = function() {
        const self = this;

        // 移除旧的设置事件监听器
        this.removeImageSettingsListeners();

        if (this.imageSizeLimitSelect) {
            this.imageSizeLimitChangeHandler = function(e) {
                self.imageSizeLimit = parseInt(e.target.value);
                if (self.onSettingsChange) {
                    self.onSettingsChange();
                }
            };
            this.imageSizeLimitSelect.addEventListener('change', this.imageSizeLimitChangeHandler);
        }

        if (this.enableBase64DetailCheckbox) {
            this.enableBase64DetailChangeHandler = function(e) {
                self.enableBase64Detail = e.target.checked;
                if (self.onSettingsChange) {
                    self.onSettingsChange();
                }
            };
            this.enableBase64DetailCheckbox.addEventListener('change', this.enableBase64DetailChangeHandler);
        }
    };





    /**
     * 获取图片数据
     */
    ImageHandler.prototype.getImages = function() {
        return this.fileUploadManager.getFiles();
    };

    /**
     * 清空所有图片
     */
    ImageHandler.prototype.clearImages = function() {
        this.fileUploadManager.clearFiles();
    };

    /**
     * 重新初始化（用于布局模式切换）
     */
    ImageHandler.prototype.reinitialize = function(layoutMode) {
        console.log('🔄 重新初始化图片处理功能...');

        this.layoutMode = layoutMode;

        // 重新初始化设置元素
        this.initImageSettingsElements();

        console.log('✅ 图片处理功能重新初始化完成');
    };

    /**
     * 更新设置
     */
    ImageHandler.prototype.updateSettings = function(settings) {
        this.imageSizeLimit = settings.imageSizeLimit || 0;
        this.enableBase64Detail = settings.enableBase64Detail || false;

        // 更新文件上传管理器设置
        this.fileUploadManager.updateSettings({
            imageSizeLimit: this.imageSizeLimit,
            enableBase64Detail: this.enableBase64Detail
        });

        // 同步到 UI 元素
        if (this.imageSizeLimitSelect) {
            this.imageSizeLimitSelect.value = this.imageSizeLimit.toString();
        }
        if (this.enableBase64DetailCheckbox) {
            this.enableBase64DetailCheckbox.checked = this.enableBase64Detail;
        }
    };

    /**
     * 清理资源
     */
    ImageHandler.prototype.cleanup = function() {
        this.removeImageSettingsListeners();
        this.fileUploadManager.cleanup();
    };

    // 将 ImageHandler 加入命名空间
    window.MCPFeedback.ImageHandler = ImageHandler;

    console.log('✅ ImageHandler 模块加载完成');

})();
