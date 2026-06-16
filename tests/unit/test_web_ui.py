#!/usr/bin/env python3
"""
Web UI 单元测试
"""

import time

import pytest

from tests.fixtures.test_data import TestData
from tests.helpers.test_utils import TestUtils


class TestWebUIManager:
    """Web UI 管理器测试"""

    def test_web_ui_manager_creation(self, web_ui_manager):
        """测试 WebUIManager 创建"""
        assert web_ui_manager is not None
        assert web_ui_manager.host == "127.0.0.1"
        assert web_ui_manager.port > 0  # 应该分配了端口
        assert web_ui_manager.app is not None

    def test_web_ui_manager_session_management(self, web_ui_manager, test_project_dir):
        """测试会话管理"""
        # 测试创建会话
        session_id = web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        assert session_id is not None
        assert len(session_id) > 0

        # 测试获取当前会话
        current_session = web_ui_manager.get_current_session()
        assert current_session is not None
        assert current_session.session_id == session_id
        assert current_session.project_directory == str(test_project_dir)
        assert current_session.summary == TestData.SAMPLE_SESSION["summary"]

    def test_session_switching(self, web_ui_manager, test_project_dir):
        """测试会话切换"""
        # 创建第一个会话
        web_ui_manager.create_session(str(test_project_dir), "第一个会话")

        # 创建第二个会话
        session_id_2 = web_ui_manager.create_session(
            str(test_project_dir), "第二个会话"
        )

        # 验证当前会话是最新的
        current_session = web_ui_manager.get_current_session()
        assert current_session.session_id == session_id_2
        assert current_session.summary == "第二个会话"

    def test_global_tabs_management(self, web_ui_manager):
        """测试全局标签页管理"""
        # 测试初始状态
        assert web_ui_manager.get_global_active_tabs_count() == 0

        # 仿真添加活跃标签页
        tab_info = {"timestamp": time.time(), "last_seen": time.time()}
        web_ui_manager.global_active_tabs["tab-1"] = tab_info

        assert web_ui_manager.get_global_active_tabs_count() == 1

        # 测试过期标签页清理
        old_tab_info = {
            "timestamp": time.time() - 120,  # 2分钟前
            "last_seen": time.time() - 120,
        }
        web_ui_manager.global_active_tabs["tab-old"] = old_tab_info

        # 获取计数时应该自动清理过期标签页
        count = web_ui_manager.get_global_active_tabs_count()
        assert count == 1  # 只剩下有效的标签页


class TestWebFeedbackSession:
    """Web 回馈会话测试"""

    def test_session_creation(self, test_project_dir):
        """测试会话创建"""
        from mcp_feedback_enhanced.web.models import WebFeedbackSession

        session = WebFeedbackSession(
            "test-session", str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        assert session.session_id == "test-session"
        assert session.project_directory == str(test_project_dir)
        assert session.summary == TestData.SAMPLE_SESSION["summary"]
        assert session.websocket is None
        assert session.feedback_result is None
        assert len(session.images) == 0

    def test_session_status_management(self, test_project_dir):
        """测试会话状态管理"""
        from mcp_feedback_enhanced.web.models import (
            SessionStatus,
            WebFeedbackSession,
        )

        session = WebFeedbackSession(
            "test-session", str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        # 测试初始状态
        assert session.status == SessionStatus.WAITING

        # 测试状态更新 - 使用 next_step 方法
        # 首先进入 ACTIVE 状态
        result = session.next_step("会话已激活")
        assert result is True
        assert session.status == SessionStatus.ACTIVE
        # 然后进入 FEEDBACK_SUBMITTED 状态
        result = session.next_step("已提交回馈")  # type: ignore[unreachable]
        assert result is True
        assert session.status == SessionStatus.FEEDBACK_SUBMITTED
        assert session.status_message == "已提交回馈"

    def test_session_age_and_idle_time(self, test_project_dir):
        """测试会话年龄和空闲时间"""
        from mcp_feedback_enhanced.web.models import WebFeedbackSession

        session = WebFeedbackSession(
            "test-session", str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        # 测试年龄计算
        age = session.get_age()
        assert age >= 0
        assert age < 1  # 应该小于1秒

        # 测试空闲时间
        idle_time = session.get_idle_time()
        assert idle_time >= 0
        assert idle_time < 1  # 应该小于1秒

    @pytest.mark.asyncio
    async def test_session_feedback_submission(self, test_project_dir):
        """测试回馈提交"""
        from mcp_feedback_enhanced.web.models import (
            SessionStatus,
            WebFeedbackSession,
        )

        session = WebFeedbackSession(
            "test-session", str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        # 提交回馈
        await session.submit_feedback(
            TestData.SAMPLE_FEEDBACK["feedback"],
            TestData.SAMPLE_FEEDBACK["images"],
            TestData.SAMPLE_FEEDBACK["settings"],
        )

        # 验证回馈已保存
        assert session.feedback_result == TestData.SAMPLE_FEEDBACK["feedback"]
        assert session.images == TestData.SAMPLE_FEEDBACK["images"]
        assert session.settings == TestData.SAMPLE_FEEDBACK["settings"]
        assert session.status == SessionStatus.FEEDBACK_SUBMITTED


class TestWebUIRoutes:
    """Web UI 路由测试"""

    @pytest.mark.asyncio
    async def test_index_route_no_session(self, web_ui_manager):
        """测试主页路由（无会话）"""
        from fastapi.testclient import TestClient

        client = TestClient(web_ui_manager.app)
        response = client.get("/")

        assert response.status_code == 200
        assert "MCP Feedback Enhanced" in response.text

    @pytest.mark.asyncio
    async def test_index_route_with_session(self, web_ui_manager, test_project_dir):
        """测试主页路由（有会话）"""
        from fastapi.testclient import TestClient

        # 创建会话
        web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        client = TestClient(web_ui_manager.app)
        response = client.get("/")

        assert response.status_code == 200
        assert TestData.SAMPLE_SESSION["summary"] in response.text

    @pytest.mark.asyncio
    async def test_api_current_session(self, web_ui_manager, test_project_dir):
        """测试当前会话 API"""
        from fastapi.testclient import TestClient

        # 创建会话
        session_id = web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        client = TestClient(web_ui_manager.app)
        response = client.get("/api/current-session")

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        assert data["project_directory"] == str(test_project_dir)
        assert data["summary"] == TestData.SAMPLE_SESSION["summary"]


class TestWebUIUtilities:
    """Web UI 工具函数测试"""

    def test_find_free_port(self):
        """测试端口查找"""
        port = TestUtils.find_free_port()
        assert isinstance(port, int)
        assert 8000 <= port <= 8100

    def test_validate_web_response(self):
        """测试 Web 回应验证"""
        # 测试有效回应
        valid_response = {
            "command_logs": "test logs",
            "interactive_feedback": "test feedback",
            "images": [],
        }
        assert TestUtils.validate_web_response(valid_response) == True

        # 测试无效回应
        invalid_response = {
            "command_logs": "test logs"
            # 缺少必要字段
        }
        assert TestUtils.validate_web_response(invalid_response) == False

    def test_validate_session_info(self):
        """测试会话信息验证"""
        # 测试有效会话信息
        valid_session = TestData.SAMPLE_SESSION
        assert TestUtils.validate_session_info(valid_session) == True

        # 测试无效会话信息
        invalid_session = {
            "session_id": "test"
            # 缺少必要字段
        }
        assert TestUtils.validate_session_info(invalid_session) == False
