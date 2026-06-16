#!/usr/bin/env python3
"""
会话清理优化测试
================

测试 WebFeedbackSession 和 SessionCleanupManager 的清理功能。
"""

import asyncio
import time
from unittest.mock import Mock

import pytest

# 移除手动路径操作，让 mypy 和 pytest 使用正确的模块解析
from mcp_feedback_enhanced.web.models.feedback_session import (
    CleanupReason,
    SessionStatus,
    WebFeedbackSession,
)
from mcp_feedback_enhanced.web.utils.session_cleanup_manager import (
    CleanupPolicy,
    CleanupTrigger,
    SessionCleanupManager,
)


class TestWebFeedbackSessionCleanup:
    """测试 WebFeedbackSession 清理功能"""

    def setup_method(self):
        """测试前设置"""
        self.session_id = "test_session_001"
        self.project_dir = "/tmp/test_project"
        self.summary = "测试会话摘要"

        # 创建测试会话
        self.session = WebFeedbackSession(
            self.session_id,
            self.project_dir,
            self.summary,
            auto_cleanup_delay=60,  # 1分钟自动清理
            max_idle_time=30,  # 30秒最大空闲时间
        )

    def teardown_method(self):
        """测试后清理"""
        if hasattr(self, "session") and self.session:
            try:
                self.session._cleanup_sync_enhanced(CleanupReason.MANUAL)
            except:
                pass

    def test_session_initialization(self):
        """测试会话初始化"""
        assert self.session.session_id == self.session_id
        assert self.session.project_directory == self.project_dir
        assert self.session.summary == self.summary
        assert self.session.status == SessionStatus.WAITING
        assert self.session.auto_cleanup_delay == 60
        assert self.session.max_idle_time == 30
        assert self.session.cleanup_timer is not None
        assert len(self.session.cleanup_stats) > 0

    def test_is_expired_by_idle_time(self):
        """测试空闲时间过期检测"""
        # 新创建的会话不应该过期
        assert not self.session.is_expired()

        # 仿真空闲时间过长
        self.session.last_activity = time.time() - 40  # 40秒前
        assert self.session.is_expired()

    def test_is_expired_by_status(self):
        """测试状态过期检测"""
        # 设置为错误状态
        self.session.status = SessionStatus.ERROR
        self.session.last_activity = time.time() - 400  # 400秒前
        assert self.session.is_expired()

        # 设置为已过期状态
        self.session.status = SessionStatus.EXPIRED
        assert self.session.is_expired()

    def test_get_age_and_idle_time(self):
        """测试年龄和空闲时间计算"""
        # 测试年龄
        age = self.session.get_age()
        assert age >= 0
        assert age < 1  # 刚创建，应该小于1秒

        # 测试空闲时间
        idle_time = self.session.get_idle_time()
        assert idle_time >= 0
        assert idle_time < 1  # 刚创建，应该小于1秒

    def test_cleanup_timer_scheduling(self):
        """测试清理定时器调度"""
        # 检查定时器是否已设置
        assert self.session.cleanup_timer is not None
        assert self.session.cleanup_timer.is_alive()

        # 测试延长定时器
        old_timer = self.session.cleanup_timer
        self.session.extend_cleanup_timer(120)

        # 应该创建新的定时器
        assert self.session.cleanup_timer != old_timer
        assert self.session.cleanup_timer.is_alive()

    def test_cleanup_callbacks(self):
        """测试清理回调函数"""
        callback_called = False
        callback_session = None
        callback_reason = None

        def test_callback(session, reason):
            nonlocal callback_called, callback_session, callback_reason
            callback_called = True
            callback_session = session
            callback_reason = reason

        # 添加回调
        self.session.add_cleanup_callback(test_callback)
        assert len(self.session.cleanup_callbacks) == 1

        # 运行清理
        self.session._cleanup_sync_enhanced(CleanupReason.MANUAL)

        # 检查回调是否被调用
        assert callback_called
        assert callback_session == self.session
        assert callback_reason == CleanupReason.MANUAL

        # 移除回调
        self.session.remove_cleanup_callback(test_callback)
        assert len(self.session.cleanup_callbacks) == 0

    def test_cleanup_stats(self):
        """测试清理统计"""
        # 初始统计
        stats = self.session.get_cleanup_stats()
        assert stats["cleanup_count"] == 0
        assert stats["session_id"] == self.session_id
        assert stats["is_active"] == True

        # 运行清理
        self.session._cleanup_sync_enhanced(CleanupReason.EXPIRED)

        # 检查统计更新
        stats = self.session.get_cleanup_stats()
        assert stats["cleanup_count"] == 1
        assert stats["cleanup_reason"] == CleanupReason.EXPIRED.value
        assert stats["last_cleanup_time"] is not None
        assert stats["cleanup_duration"] >= 0

    @pytest.mark.asyncio
    async def test_async_cleanup(self):
        """测试异步清理"""
        # 仿真 WebSocket 连接
        mock_websocket = Mock()
        mock_websocket.send_json = Mock(return_value=asyncio.Future())
        mock_websocket.send_json.return_value.set_result(None)
        mock_websocket.close = Mock(return_value=asyncio.Future())
        mock_websocket.close.return_value.set_result(None)
        mock_websocket.client_state.DISCONNECTED = False

        self.session.websocket = mock_websocket

        # 运行异步清理
        await self.session._cleanup_resources_enhanced(CleanupReason.TIMEOUT)

        # 检查 WebSocket 是否被正确处理
        mock_websocket.send_json.assert_called_once()

        # 检查清理统计
        stats = self.session.get_cleanup_stats()
        assert stats["cleanup_count"] == 1
        assert stats["cleanup_reason"] == CleanupReason.TIMEOUT.value

    def test_status_update_resets_timer(self):
        """测试状态更新重置定时器"""
        old_timer = self.session.cleanup_timer

        # 更新状态为活跃 - 使用 next_step 方法
        self.session.next_step("测试活跃状态")

        # 检查定时器是否被重置
        assert self.session.cleanup_timer != old_timer
        # 修复 union-attr 错误 - 检查 Timer 是否存在且活跃
        assert self.session.cleanup_timer is not None
        assert self.session.cleanup_timer.is_alive()
        assert self.session.status == SessionStatus.ACTIVE


class TestSessionCleanupManager:
    """测试 SessionCleanupManager 功能"""

    def setup_method(self):
        """测试前设置"""
        # 创建仿真的 WebUIManager
        self.mock_web_ui_manager = Mock()
        self.mock_web_ui_manager.sessions = {}
        self.mock_web_ui_manager.current_session = None
        self.mock_web_ui_manager.cleanup_expired_sessions = Mock(return_value=0)
        self.mock_web_ui_manager.cleanup_sessions_by_memory_pressure = Mock(
            return_value=0
        )

        # 创建清理策略
        self.policy = CleanupPolicy(
            max_idle_time=30,
            max_session_age=300,
            max_sessions=5,
            cleanup_interval=10,
            enable_auto_cleanup=True,
        )

        # 创建清理管理器
        self.cleanup_manager = SessionCleanupManager(
            self.mock_web_ui_manager, self.policy
        )

    def teardown_method(self):
        """测试后清理"""
        if hasattr(self, "cleanup_manager"):
            self.cleanup_manager.stop_auto_cleanup()

    def test_cleanup_manager_initialization(self):
        """测试清理管理器初始化"""
        assert self.cleanup_manager.web_ui_manager == self.mock_web_ui_manager
        assert self.cleanup_manager.policy == self.policy
        assert not self.cleanup_manager.is_running
        assert self.cleanup_manager.cleanup_thread is None
        assert len(self.cleanup_manager.cleanup_callbacks) == 0
        assert len(self.cleanup_manager.cleanup_history) == 0

    def test_auto_cleanup_start_stop(self):
        """测试自动清理启动和停止"""
        # 启动自动清理
        result = self.cleanup_manager.start_auto_cleanup()
        assert result == True
        assert self.cleanup_manager.is_running == True
        assert self.cleanup_manager.cleanup_thread is not None
        assert self.cleanup_manager.cleanup_thread.is_alive()

        # 停止自动清理
        result = self.cleanup_manager.stop_auto_cleanup()
        assert result == True
        assert self.cleanup_manager.is_running == False

    def test_trigger_cleanup_memory_pressure(self):
        """测试内存压力清理触发"""
        # 设置仿真返回值
        self.mock_web_ui_manager.cleanup_sessions_by_memory_pressure.return_value = 3

        # 触发内存压力清理
        cleaned = self.cleanup_manager.trigger_cleanup(
            CleanupTrigger.MEMORY_PRESSURE, force=True
        )

        # 检查结果
        assert cleaned == 3
        self.mock_web_ui_manager.cleanup_sessions_by_memory_pressure.assert_called_once_with(
            True
        )

        # 检查统计更新
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] == 1
        assert stats["memory_pressure_cleanups"] == 1
        assert stats["total_sessions_cleaned"] == 3

    def test_trigger_cleanup_expired(self):
        """测试过期清理触发"""
        # 设置仿真返回值
        self.mock_web_ui_manager.cleanup_expired_sessions.return_value = 2

        # 触发过期清理
        cleaned = self.cleanup_manager.trigger_cleanup(CleanupTrigger.EXPIRED)

        # 检查结果
        assert cleaned == 2
        self.mock_web_ui_manager.cleanup_expired_sessions.assert_called_once()

        # 检查统计更新
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] == 1
        assert stats["expired_cleanups"] == 1
        assert stats["total_sessions_cleaned"] == 2

    def test_cleanup_statistics(self):
        """测试清理统计功能"""
        # 初始统计
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] == 0
        assert stats["total_sessions_cleaned"] == 0
        assert stats["is_auto_cleanup_running"] == False

        # 运行一些清理操作
        self.mock_web_ui_manager.cleanup_expired_sessions.return_value = 1
        self.cleanup_manager.trigger_cleanup(CleanupTrigger.EXPIRED)

        self.mock_web_ui_manager.cleanup_sessions_by_memory_pressure.return_value = 2
        self.cleanup_manager.trigger_cleanup(CleanupTrigger.MEMORY_PRESSURE)

        # 检查统计
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] == 2
        assert stats["expired_cleanups"] == 1
        assert stats["memory_pressure_cleanups"] == 1
        assert stats["total_sessions_cleaned"] == 3
        assert stats["average_cleanup_time"] >= 0

    def test_cleanup_history(self):
        """测试清理历史记录"""
        # 初始历史为空
        history = self.cleanup_manager.get_cleanup_history()
        assert len(history) == 0

        # 运行清理操作
        self.mock_web_ui_manager.cleanup_expired_sessions.return_value = 1
        self.cleanup_manager.trigger_cleanup(CleanupTrigger.EXPIRED)

        # 检查历史记录
        history = self.cleanup_manager.get_cleanup_history()
        assert len(history) == 1

        record = history[0]
        assert record["trigger"] == CleanupTrigger.EXPIRED.value
        assert record["cleaned_count"] == 1
        assert "timestamp" in record
        assert "duration" in record

    def test_policy_update(self):
        """测试策略更新"""
        # 更新策略
        self.cleanup_manager.update_policy(
            max_idle_time=60, max_sessions=10, enable_auto_cleanup=False
        )

        # 检查策略是否更新
        assert self.cleanup_manager.policy.max_idle_time == 60
        assert self.cleanup_manager.policy.max_sessions == 10
        assert self.cleanup_manager.policy.enable_auto_cleanup == False

    def test_stats_reset(self):
        """测试统计重置"""
        # 运行一些操作产生统计
        self.mock_web_ui_manager.cleanup_expired_sessions.return_value = 1
        self.cleanup_manager.trigger_cleanup(CleanupTrigger.EXPIRED)

        # 检查有统计数据
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] > 0

        # 重置统计
        self.cleanup_manager.reset_stats()

        # 检查统计已重置
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] == 0
        assert stats["total_sessions_cleaned"] == 0

        history = self.cleanup_manager.get_cleanup_history()
        assert len(history) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
