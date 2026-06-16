/**
 * MCP Feedback Enhanced - 多会话管理模块
 * =======================================
 *
 * 管理多个并发的待回复会话，支持列表展示和会话切换。
 */

(function() {
    'use strict';

    window.MCPFeedback = window.MCPFeedback || {};

    function MultiSessionManager(options) {
        options = options || {};
        this.sessions = {};
        this.selectedSessionId = null;
        this.onSessionSelect = options.onSessionSelect || null;
        this.onSessionsChange = options.onSessionsChange || null;
        this.containerEl = null;

        console.log('📋 MultiSessionManager 初始化');
    }

    MultiSessionManager.prototype.init = function(containerSelector) {
        this.containerEl = document.querySelector(containerSelector);
    };

    MultiSessionManager.prototype.addSession = function(sessionInfo) {
        this.sessions[sessionInfo.session_id] = sessionInfo;
        this.render();

        if (Object.keys(this.sessions).length === 1) {
            this.selectSession(sessionInfo.session_id);
        }

        if (this.onSessionsChange) {
            this.onSessionsChange(this.getSessions());
        }
    };

    MultiSessionManager.prototype.removeSession = function(sessionId) {
        delete this.sessions[sessionId];

        if (this.selectedSessionId === sessionId) {
            var remaining = Object.keys(this.sessions);
            this.selectedSessionId = remaining.length > 0 ? remaining[0] : null;
        }

        this.render();

        if (this.onSessionsChange) {
            this.onSessionsChange(this.getSessions());
        }

        if (this.selectedSessionId && this.onSessionSelect) {
            this.onSessionSelect(this.selectedSessionId, this.sessions[this.selectedSessionId]);
        }
    };

    MultiSessionManager.prototype.selectSession = function(sessionId) {
        if (!this.sessions[sessionId]) return;

        this.selectedSessionId = sessionId;
        this.render();

        if (this.onSessionSelect) {
            this.onSessionSelect(sessionId, this.sessions[sessionId]);
        }
    };

    MultiSessionManager.prototype.getSessions = function() {
        var self = this;
        return Object.keys(this.sessions).map(function(id) {
            return self.sessions[id];
        }).sort(function(a, b) {
            return b.created_at - a.created_at;
        });
    };

    MultiSessionManager.prototype.getCount = function() {
        return Object.keys(this.sessions).length;
    };

    MultiSessionManager.prototype.getSelectedSession = function() {
        return this.selectedSessionId ? this.sessions[this.selectedSessionId] : null;
    };

    MultiSessionManager.prototype.getSelectedSessionId = function() {
        return this.selectedSessionId;
    };

    MultiSessionManager.prototype.render = function() {
        if (!this.containerEl) return;

        var sessions = this.getSessions();
        var self = this;

        if (sessions.length === 0) {
            this.containerEl.innerHTML = '<div class="no-pending-sessions">' +
                (window.i18nManager ? window.i18nManager.t('multiSession.noPending') : '没有待回复的会话') +
                '</div>';
            return;
        }

        var html = '';
        sessions.forEach(function(session) {
            var isSelected = session.session_id === self.selectedSessionId;
            var shortId = session.session_id.substring(0, 8);
            var projectName = session.project_directory.split(/[/\\]/).pop() || session.project_directory;
            var timeStr = new Date(session.created_at).toLocaleTimeString();

            // 截取 summary 的第一行非空行作为标题
            var title = self.extractTitle(session.summary);

            html += '<div class="pending-session-item' + (isSelected ? ' selected' : '') + '" ' +
                    'data-session-id="' + session.session_id + '">' +
                    '<div class="pending-session-header">' +
                        '<span class="pending-session-project">' + self.escapeHtml(projectName) + '</span>' +
                        '<span class="pending-session-time">' + timeStr + '</span>' +
                    '</div>' +
                    '<div class="pending-session-summary">' + self.escapeHtml(title) + '</div>' +
                    '<div class="pending-session-id">#' + shortId + '</div>' +
                '</div>';
        });

        this.containerEl.innerHTML = html;

        var items = this.containerEl.querySelectorAll('.pending-session-item');
        items.forEach(function(item) {
            item.addEventListener('click', function() {
                var id = this.getAttribute('data-session-id');
                self.selectSession(id);
            });
        });
    };

    MultiSessionManager.prototype.extractTitle = function(summary) {
        if (!summary) return '';
        var lines = summary.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/^#+\s*/, '').trim();
            if (line) return this.truncate(line, 60);
        }
        return this.truncate(summary, 60);
    };

    MultiSessionManager.prototype.escapeHtml = function(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    };

    MultiSessionManager.prototype.truncate = function(str, maxLen) {
        if (!str) return '';
        return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    };

    window.MCPFeedback.MultiSessionManager = MultiSessionManager;
})();
