/**
 * MCP Feedback Enhanced - 音效管理模块
 * ===================================
 * 
 * 处理音效通知的播放、管理和设置功能
 * 使用 HTML5 Audio API 进行音效播放
 * 支持自订音效上传和 base64 保存
 */

(function() {
    'use strict';

    // 确保命名空间存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * 音效管理器建构函数
     */
    function AudioManager(options) {
        options = options || {};
        
        // 设置管理器引用
        this.settingsManager = options.settingsManager || null;
        
        // 当前音效设置
        this.currentAudioSettings = {
            enabled: false,
            volume: 50,
            selectedAudioId: 'default-beep',
            customAudios: []
        };
        
        // 缺省音效（base64 编码的简单提示音）
        this.defaultAudios = {
            'default-beep': {
                id: 'default-beep',
                name: '经典提示音',
                data: this.generateBeepSound(),
                mimeType: 'audio/wav',
                isDefault: true
            },
            'notification-ding': {
                id: 'notification-ding',
                name: '通知铃声',
                data: this.generateDingSound(),
                mimeType: 'audio/wav',
                isDefault: true
            },
            'soft-chime': {
                id: 'soft-chime',
                name: '轻柔钟声',
                data: this.generateChimeSound(),
                mimeType: 'audio/wav',
                isDefault: true
            }
        };
        
        // 当前播放的 Audio 对象
        this.currentAudio = null;

        // 用户交互检测
        this.userHasInteracted = false;
        this.pendingNotifications = [];
        this.autoplayBlocked = false;
        this.interactionListenersAdded = false;

        // 回调函数
        this.onSettingsChange = options.onSettingsChange || null;

        // 启动音效播放标记
        this.startupNotificationPlayed = false;

        console.log('🔊 AudioManager 初始化完成');
    }

    /**
     * 初始化音效管理器
     */
    AudioManager.prototype.initialize = function() {
        this.loadAudioSettings();
        this.setupUserInteractionDetection();
        console.log('✅ AudioManager 初始化完成');
    };

    /**
     * 加载音效设置
     */
    AudioManager.prototype.loadAudioSettings = function() {
        if (!this.settingsManager) {
            console.warn('⚠️ SettingsManager 未设置，使用缺省音效设置');
            return;
        }

        try {
            // 从设置管理器加载音效相关设置
            this.currentAudioSettings.enabled = this.settingsManager.get('audioNotificationEnabled', false);
            this.currentAudioSettings.volume = this.settingsManager.get('audioNotificationVolume', 50);
            this.currentAudioSettings.selectedAudioId = this.settingsManager.get('selectedAudioId', 'default-beep');
            this.currentAudioSettings.customAudios = this.settingsManager.get('customAudios', []);
            
            console.log('📥 音效设置已加载:', this.currentAudioSettings);
        } catch (error) {
            console.error('❌ 加载音效设置失败:', error);
        }
    };

    /**
     * 保存音效设置
     */
    AudioManager.prototype.saveAudioSettings = function() {
        if (!this.settingsManager) {
            console.warn('⚠️ SettingsManager 未设置，无法保存音效设置');
            return;
        }

        try {
            this.settingsManager.set('audioNotificationEnabled', this.currentAudioSettings.enabled);
            this.settingsManager.set('audioNotificationVolume', this.currentAudioSettings.volume);
            this.settingsManager.set('selectedAudioId', this.currentAudioSettings.selectedAudioId);
            this.settingsManager.set('customAudios', this.currentAudioSettings.customAudios);
            
            console.log('💾 音效设置已保存');
            
            // 触发回调
            if (this.onSettingsChange) {
                this.onSettingsChange(this.currentAudioSettings);
            }
        } catch (error) {
            console.error('❌ 保存音效设置失败:', error);
        }
    };

    /**
     * 播放通知音效（智能播放策略）
     */
    AudioManager.prototype.playNotification = function() {
        if (!this.currentAudioSettings.enabled) {
            console.log('🔇 音效通知已停用');
            return;
        }

        try {
            const audioData = this.getAudioById(this.currentAudioSettings.selectedAudioId);
            if (!audioData) {
                console.warn('⚠️ 找不到指定的音效，使用缺省音效');
                this.playAudioSmart(this.defaultAudios['default-beep']);
                return;
            }

            this.playAudioSmart(audioData);
        } catch (error) {
            console.error('❌ 播放通知音效失败:', error);
        }
    };

    /**
     * 播放启动音效通知（应用程序就绪时播放）
     */
    AudioManager.prototype.playStartupNotification = function() {
        if (!this.currentAudioSettings.enabled) {
            console.log('🔇 音效通知已停用，跳过启动音效');
            return;
        }

        // 确保启动音效只播放一次
        if (this.startupNotificationPlayed) {
            console.log('🔇 启动音效已播放过，跳过重复播放');
            return;
        }

        this.startupNotificationPlayed = true;
        console.log('🎵 播放应用程序启动音效');

        try {
            const audioData = this.getAudioById(this.currentAudioSettings.selectedAudioId);
            if (!audioData) {
                console.warn('⚠️ 找不到指定的音效，使用缺省启动音效');
                this.playAudioSmart(this.defaultAudios['default-beep']);
                return;
            }

            this.playAudioSmart(audioData);
        } catch (error) {
            console.error('❌ 播放启动音效失败:', error);
        }
    };

    /**
     * 智能音效播放（处理自动播放限制）
     */
    AudioManager.prototype.playAudioSmart = function(audioData) {
        // 如果已知自动播放被阻止，直接加入待播放队列
        if (this.autoplayBlocked && !this.userHasInteracted) {
            this.addToPendingNotifications(audioData);
            return;
        }

        // 尝试播放
        this.playAudio(audioData)
            .then(() => {
                // 播放成功，清空待播放队列
                this.processPendingNotifications();
            })
            .catch((error) => {
                if (error.name === 'NotAllowedError') {
                    // 自动播放被阻止
                    this.autoplayBlocked = true;
                    this.addToPendingNotifications(audioData);
                    this.showAutoplayBlockedNotification();
                }
            });
    };

    /**
     * 播放指定的音效（返回 Promise）
     */
    AudioManager.prototype.playAudio = function(audioData) {
        return new Promise((resolve, reject) => {
            try {
                // 停止当前播放的音效
                if (this.currentAudio) {
                    this.currentAudio.pause();
                    this.currentAudio = null;
                }

                // 创建新的 Audio 对象
                this.currentAudio = new Audio();
                this.currentAudio.src = 'data:' + audioData.mimeType + ';base64,' + audioData.data;
                this.currentAudio.volume = this.currentAudioSettings.volume / 100;

                // 播放音效
                const playPromise = this.currentAudio.play();

                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('🔊 音效播放成功:', audioData.name);
                            resolve();
                        })
                        .catch(error => {
                            console.error('❌ 音效播放失败:', error);
                            reject(error);
                        });
                } else {
                    // 旧版浏览器，假设播放成功
                    console.log('🔊 音效播放（旧版浏览器）:', audioData.name);
                    resolve();
                }
            } catch (error) {
                console.error('❌ 播放音效时发生错误:', error);
                reject(error);
            }
        });
    };

    /**
     * 根据 ID 获取音效数据
     */
    AudioManager.prototype.getAudioById = function(audioId) {
        // 先检查缺省音效
        if (this.defaultAudios[audioId]) {
            return this.defaultAudios[audioId];
        }

        // 再检查自订音效
        return this.currentAudioSettings.customAudios.find(audio => audio.id === audioId) || null;
    };

    /**
     * 获取所有可用的音效
     */
    AudioManager.prototype.getAllAudios = function() {
        const allAudios = [];
        
        // 添加缺省音效
        Object.values(this.defaultAudios).forEach(audio => {
            allAudios.push(audio);
        });
        
        // 添加自订音效
        this.currentAudioSettings.customAudios.forEach(audio => {
            allAudios.push(audio);
        });
        
        return allAudios;
    };

    /**
     * 添加自订音效
     */
    AudioManager.prototype.addCustomAudio = function(name, file) {
        return new Promise((resolve, reject) => {
            if (!name || !file) {
                reject(new Error('音效名称和文件不能为空'));
                return;
            }

            // 检查文件类型
            if (!this.isValidAudioFile(file)) {
                reject(new Error('不支持的音效文件格式'));
                return;
            }

            // 检查名称是否重复
            if (this.isAudioNameExists(name)) {
                reject(new Error('音效名称已存在'));
                return;
            }

            // 转换为 base64
            this.fileToBase64(file)
                .then(base64Data => {
                    const audioData = {
                        id: this.generateAudioId(),
                        name: name.trim(),
                        data: base64Data,
                        mimeType: file.type,
                        createdAt: new Date().toISOString(),
                        isDefault: false
                    };

                    this.currentAudioSettings.customAudios.push(audioData);
                    this.saveAudioSettings();

                    console.log('➕ 添加自订音效:', audioData.name);
                    resolve(audioData);
                })
                .catch(error => {
                    reject(error);
                });
        });
    };

    /**
     * 删除自订音效
     */
    AudioManager.prototype.removeCustomAudio = function(audioId) {
        const index = this.currentAudioSettings.customAudios.findIndex(audio => audio.id === audioId);
        if (index === -1) {
            throw new Error('找不到指定的音效');
        }

        const removedAudio = this.currentAudioSettings.customAudios.splice(index, 1)[0];
        
        // 如果删除的是当前选中的音效，切换到缺省音效
        if (this.currentAudioSettings.selectedAudioId === audioId) {
            this.currentAudioSettings.selectedAudioId = 'default-beep';
        }

        this.saveAudioSettings();
        console.log('🗑️ 删除自订音效:', removedAudio.name);
        
        return removedAudio;
    };

    /**
     * 设置音量
     */
    AudioManager.prototype.setVolume = function(volume) {
        if (volume < 0 || volume > 100) {
            throw new Error('音量必须在 0-100 之间');
        }

        this.currentAudioSettings.volume = volume;
        this.saveAudioSettings();
        console.log('🔊 音量已设置为:', volume);
    };

    /**
     * 设置是否激活音效通知
     */
    AudioManager.prototype.setEnabled = function(enabled) {
        this.currentAudioSettings.enabled = !!enabled;
        this.saveAudioSettings();
        console.log('🔊 音效通知已', enabled ? '激活' : '停用');
    };

    /**
     * 设置选中的音效
     */
    AudioManager.prototype.setSelectedAudio = function(audioId) {
        if (!this.getAudioById(audioId)) {
            throw new Error('找不到指定的音效');
        }

        this.currentAudioSettings.selectedAudioId = audioId;
        this.saveAudioSettings();
        console.log('🎵 已选择音效:', audioId);
    };

    /**
     * 检查是否为有效的音效文件
     */
    AudioManager.prototype.isValidAudioFile = function(file) {
        const validTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg'];
        return validTypes.includes(file.type);
    };

    /**
     * 检查音效名称是否已存在
     */
    AudioManager.prototype.isAudioNameExists = function(name) {
        // 检查缺省音效
        const defaultExists = Object.values(this.defaultAudios).some(audio => audio.name === name);
        if (defaultExists) return true;

        // 检查自订音效
        return this.currentAudioSettings.customAudios.some(audio => audio.name === name);
    };

    /**
     * 文件转 base64
     */
    AudioManager.prototype.fileToBase64 = function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function() {
                // 移除 data URL 前缀，只保留 base64 数据
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = function() {
                reject(new Error('文件读取失败'));
            };
            reader.readAsDataURL(file);
        });
    };

    /**
     * 生成音效 ID
     */
    AudioManager.prototype.generateAudioId = function() {
        return 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    };

    /**
     * 生成经典提示音（440Hz，0.3秒）
     */
    AudioManager.prototype.generateBeepSound = function() {
        return this.generateToneWAV(440, 0.3, 0.5);
    };

    /**
     * 生成通知铃声（800Hz + 600Hz 和弦，0.4秒）
     */
    AudioManager.prototype.generateDingSound = function() {
        return this.generateToneWAV(800, 0.4, 0.4);
    };

    /**
     * 生成轻柔钟声（523Hz，0.5秒，渐弱）
     */
    AudioManager.prototype.generateChimeSound = function() {
        return this.generateToneWAV(523, 0.5, 0.3);
    };

    /**
     * 生成指定频率和时长的 WAV 音效
     * @param {number} frequency - 频率（Hz）
     * @param {number} duration - 持续时间（秒）
     * @param {number} volume - 音量（0-1）
     */
    AudioManager.prototype.generateToneWAV = function(frequency, duration, volume) {
        const sampleRate = 44100;
        const numSamples = Math.floor(sampleRate * duration);
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);

        // WAV 文件标头
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, numSamples * 2, true);

        // 生成音效数据
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const fadeOut = Math.max(0, 1 - (t / duration) * 0.5); // 渐弱效果
            const sample = Math.sin(2 * Math.PI * frequency * t) * volume * fadeOut;
            const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
            view.setInt16(44 + i * 2, intSample, true);
        }

        // 转换为 base64
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    /**
     * 设置用户交互检测
     */
    AudioManager.prototype.setupUserInteractionDetection = function() {
        if (this.interactionListenersAdded) return;

        const self = this;
        const interactionEvents = ['click', 'keydown', 'touchstart'];

        const handleUserInteraction = function() {
            if (!self.userHasInteracted) {
                self.userHasInteracted = true;
                console.log('🎯 检测到用户交互，音效播放已解锁');

                // 播放待播放的通知
                self.processPendingNotifications();

                // 移除事件监听器
                interactionEvents.forEach(event => {
                    document.removeEventListener(event, handleUserInteraction, true);
                });
                self.interactionListenersAdded = false;
            }
        };

        // 添加事件监听器
        interactionEvents.forEach(event => {
            document.addEventListener(event, handleUserInteraction, true);
        });

        this.interactionListenersAdded = true;
        console.log('🎯 用户交互检测已设置');
    };

    /**
     * 添加到待播放通知队列
     */
    AudioManager.prototype.addToPendingNotifications = function(audioData) {
        // 限制队列长度，避免积累太多通知
        if (this.pendingNotifications.length >= 3) {
            this.pendingNotifications.shift(); // 移除最旧的通知
        }

        this.pendingNotifications.push({
            audioData: audioData,
            timestamp: Date.now()
        });

        console.log('📋 音效已加入待播放队列:', audioData.name, '队列长度:', this.pendingNotifications.length);
    };

    /**
     * 处理待播放的通知
     */
    AudioManager.prototype.processPendingNotifications = function() {
        if (this.pendingNotifications.length === 0) return;

        console.log('🔊 处理待播放通知，数量:', this.pendingNotifications.length);

        // 只播放最新的通知，避免音效重叠
        const latestNotification = this.pendingNotifications[this.pendingNotifications.length - 1];
        this.pendingNotifications = []; // 清空队列

        this.playAudio(latestNotification.audioData)
            .then(() => {
                console.log('🔊 待播放通知播放成功');
            })
            .catch(error => {
                console.warn('⚠️ 待播放通知播放失败:', error);
            });
    };

    /**
     * 显示自动播放被阻止的通知
     */
    AudioManager.prototype.showAutoplayBlockedNotification = function() {
        // 只显示一次通知
        if (this.autoplayNotificationShown) return;
        this.autoplayNotificationShown = true;

        console.log('🔇 浏览器阻止音效自动播放，请点击页面任意位置以激活音效通知');

        // 可以在这里添加 UI 通知逻辑
        if (window.MCPFeedback && window.MCPFeedback.Utils && window.MCPFeedback.Utils.showMessage) {
            const message = window.i18nManager ?
                window.i18nManager.t('notification.autoplayBlocked', '浏览器阻止音效自动播放，请点击页面以激活音效通知') :
                '浏览器阻止音效自动播放，请点击页面以激活音效通知';
            window.MCPFeedback.Utils.showMessage(message, 'info');
        }
    };

    /**
     * 获取当前设置
     */
    AudioManager.prototype.getSettings = function() {
        return Utils.deepClone(this.currentAudioSettings);
    };

    // 导出到全域命名空间
    window.MCPFeedback.AudioManager = AudioManager;

})();
