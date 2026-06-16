#!/usr/bin/env python3
"""
Web UI 集成测试
"""

import asyncio
import time

import pytest

from tests.fixtures.test_data import TestData
from tests.helpers.test_utils import TestUtils


class TestWebUIIntegration:
    """Web UI 集成测试"""

    @pytest.mark.asyncio
    async def test_web_server_startup_and_routes(self, web_ui_manager):
        """测试 Web 服务器启动和基本路由"""
        # 启动服务器
        web_ui_manager.start_server()

        # 等待服务器启动
        await asyncio.sleep(3)

        # 验证服务器正在运行
        assert web_ui_manager.server_thread is not None
        assert web_ui_manager.server_thread.is_alive()

        # 测试基本路由可访问性
        import aiohttp

        base_url = f"http://{web_ui_manager.host}:{web_ui_manager.port}"

        async with aiohttp.ClientSession() as session:
            # 测试主页
            async with session.get(f"{base_url}/") as response:
                assert response.status == 200
                text = await response.text()
                assert "MCP Feedback Enhanced" in text

            # 测试静态文档
            async with session.get(f"{base_url}/static/css/style.css") as response:
                # 可能返回 200 或 404，但不应该是服务器错误
                assert response.status in [200, 404]

    @pytest.mark.asyncio
    async def test_session_api_integration(self, web_ui_manager, test_project_dir):
        """测试会话 API 集成"""
        import aiohttp

        # 创建会话
        session_id = web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        # 启动服务器
        web_ui_manager.start_server()
        await asyncio.sleep(3)

        base_url = f"http://{web_ui_manager.host}:{web_ui_manager.port}"

        async with aiohttp.ClientSession() as session:
            # 测试当前会话 API
            async with session.get(f"{base_url}/api/current-session") as response:
                assert response.status == 200
                data = await response.json()

                assert data["session_id"] == session_id
                assert data["project_directory"] == str(test_project_dir)
                assert data["summary"] == TestData.SAMPLE_SESSION["summary"]

    @pytest.mark.asyncio
    async def test_websocket_connection(self, web_ui_manager, test_project_dir):
        """测试 WebSocket 连接"""
        import aiohttp

        # 创建会话
        web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        # 启动服务器
        web_ui_manager.start_server()
        await asyncio.sleep(3)

        ws_url = f"ws://{web_ui_manager.host}:{web_ui_manager.port}/ws"

        async with aiohttp.ClientSession() as session:
            try:
                async with session.ws_connect(ws_url) as ws:
                    # 应该收到连接确认消息
                    msg = await asyncio.wait_for(ws.receive(), timeout=5)
                    assert msg.type == aiohttp.WSMsgType.TEXT

                    data = msg.json()
                    assert data["type"] == "connection_established"

                    # 可能会收到额外的消息（session_updated 或 status_update），先处理掉
                    try:
                        while True:
                            extra_msg = await asyncio.wait_for(ws.receive(), timeout=1)
                            if extra_msg.type == aiohttp.WSMsgType.TEXT:
                                extra_data = extra_msg.json()
                                if extra_data["type"] in [
                                    "session_updated",
                                    "status_update",
                                ]:
                                    continue
                                # 如果是其他类型的消息，可能是我们要的回应，先保存
                                break
                            break
                    except TimeoutError:
                        # 没有额外消息，继续测试
                        pass

                    # 测试发送心跳
                    heartbeat_msg = {
                        "type": "heartbeat",
                        "tabId": "test-tab-123",
                        "timestamp": time.time(),
                    }
                    await ws.send_str(str(heartbeat_msg).replace("'", '"'))

                    # 应该收到心跳回应
                    response = await asyncio.wait_for(ws.receive(), timeout=5)
                    if response.type == aiohttp.WSMsgType.TEXT:
                        response_data = response.json()
                        assert response_data["type"] == "heartbeat_response"

            except TimeoutError:
                pytest.fail("WebSocket 连接或通信超时")
            except Exception as e:
                pytest.fail(f"WebSocket 测试失败: {e}")


class TestWebUISessionManagement:
    """Web UI 会话管理集成测试"""

    @pytest.mark.asyncio
    async def test_session_lifecycle(self, web_ui_manager, test_project_dir):
        """测试会话生命周期"""
        # 1. 创建会话
        session_id = web_ui_manager.create_session(str(test_project_dir), "第一个会话")

        current_session = web_ui_manager.get_current_session()
        assert current_session is not None
        assert current_session.session_id == session_id

        # 2. 创建第二个会话（仿真第二次 MCP 调用）
        session_id_2 = web_ui_manager.create_session(
            str(test_project_dir), "第二个会话"
        )

        # 当前会话应该切换到新会话
        current_session = web_ui_manager.get_current_session()
        assert current_session.session_id == session_id_2
        assert current_session.summary == "第二个会话"

        # 3. 测试会话状态更新
        from mcp_feedback_enhanced.web.models import SessionStatus

        current_session.update_status(SessionStatus.FEEDBACK_SUBMITTED, "已提交回馈")
        assert current_session.status == SessionStatus.FEEDBACK_SUBMITTED

    @pytest.mark.asyncio
    async def test_session_feedback_flow(self, web_ui_manager, test_project_dir):
        """测试会话回馈流程"""
        # 创建会话
        web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        session = web_ui_manager.get_current_session()

        # 仿真提交回馈
        await session.submit_feedback(
            TestData.SAMPLE_FEEDBACK["feedback"],
            TestData.SAMPLE_FEEDBACK["images"],
            TestData.SAMPLE_FEEDBACK["settings"],
        )

        # 验证回馈已保存
        assert session.feedback_result == TestData.SAMPLE_FEEDBACK["feedback"]
        assert session.images == TestData.SAMPLE_FEEDBACK["images"]
        assert session.settings == TestData.SAMPLE_FEEDBACK["settings"]

        # 验证状态已更新
        from mcp_feedback_enhanced.web.models import SessionStatus

        assert session.status == SessionStatus.FEEDBACK_SUBMITTED

    @pytest.mark.asyncio
    async def test_session_timeout_handling(self, web_ui_manager, test_project_dir):
        """测试会话超时处理"""
        # 创建会话，设置短超时
        web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        session = web_ui_manager.get_current_session()

        # 测试超时等待
        try:
            result = await asyncio.wait_for(
                session.wait_for_feedback(timeout=1),  # 1秒超时
                timeout=2,  # 外部超时保护
            )
            # 如果没有超时，应该返回默认结果
            assert TestUtils.validate_web_response(result)
        except TimeoutError:
            # 超时是预期的行为
            pass


class TestWebUIErrorHandling:
    """Web UI 错误处理集成测试"""

    @pytest.mark.asyncio
    async def test_no_session_handling(self, web_ui_manager):
        """测试无会话时的处理"""
        import aiohttp

        # 确保没有活跃会话
        web_ui_manager.clear_current_session()

        # 启动服务器
        web_ui_manager.start_server()
        await asyncio.sleep(3)

        base_url = f"http://{web_ui_manager.host}:{web_ui_manager.port}"

        async with aiohttp.ClientSession() as session:
            # 测试主页应该显示等待页面
            async with session.get(f"{base_url}/") as response:
                assert response.status == 200
                text = await response.text()
                assert "MCP Feedback Enhanced" in text

            # 测试当前会话 API 应该返回无会话状态
            async with session.get(f"{base_url}/api/current-session") as response:
                assert response.status == 404  # 或其他适当的状态码

    @pytest.mark.asyncio
    async def test_websocket_without_session(self, web_ui_manager):
        """测试无会话时的 WebSocket 连接"""
        import aiohttp

        # 确保没有活跃会话
        web_ui_manager.clear_current_session()

        # 启动服务器
        web_ui_manager.start_server()
        await asyncio.sleep(3)

        ws_url = f"ws://{web_ui_manager.host}:{web_ui_manager.port}/ws"

        async with aiohttp.ClientSession() as session:
            try:
                async with session.ws_connect(ws_url) as ws:
                    # 连接应该被拒绝或立即关闭
                    msg = await asyncio.wait_for(ws.receive(), timeout=5)

                    if msg.type == aiohttp.WSMsgType.CLOSE:
                        # 连接被关闭是预期的
                        assert True
                    # 如果收到消息，应该是错误消息
                    elif msg.type == aiohttp.WSMsgType.TEXT:
                        data = msg.json()
                        assert "error" in data or data.get("type") == "error"

            except aiohttp.WSServerHandshakeError:
                # WebSocket 握手失败也是预期的
                assert True
            except TimeoutError:
                # 超时也可能是预期的行为
                assert True


class TestWebUIPerformance:
    """Web UI 性能集成测试"""

    @pytest.mark.asyncio
    async def test_server_startup_time(self, web_ui_manager):
        """测试服务器启动时间"""
        from tests.helpers.test_utils import PerformanceTimer

        with PerformanceTimer() as timer:
            web_ui_manager.start_server()
            await asyncio.sleep(3)  # 等待启动完成

        # 启动时间应该在合理范围内
        assert timer.duration < 10, f"Web 服务器启动时间过长: {timer.duration:.2f}秒"

        # 验证服务器确实在运行
        assert web_ui_manager.server_thread is not None
        assert web_ui_manager.server_thread.is_alive()

    @pytest.mark.asyncio
    async def test_multiple_session_performance(self, web_ui_manager, test_project_dir):
        """测试多会话性能"""
        from tests.helpers.test_utils import PerformanceTimer

        session_ids = []

        with PerformanceTimer() as timer:
            # 创建多个会话
            for i in range(10):
                session_id = web_ui_manager.create_session(
                    str(test_project_dir), f"测试会话 {i + 1}"
                )
                session_ids.append(session_id)

        # 创建会话的时间应该是线性的，不应该有明显的性能下降
        avg_time_per_session = timer.duration / 10
        assert avg_time_per_session < 0.1, (
            f"每个会话创建时间过长: {avg_time_per_session:.3f}秒"
        )

        # 验证最后一个会话是当前活跃会话
        current_session = web_ui_manager.get_current_session()
        assert current_session.session_id == session_ids[-1]
