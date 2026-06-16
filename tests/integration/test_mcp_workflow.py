#!/usr/bin/env python3
"""
MCP 工作流程集成测试
"""

import asyncio

import pytest

from tests.fixtures.test_data import TestData
from tests.helpers.mcp_client import MCPWorkflowTester, SimpleMCPClient
from tests.helpers.test_utils import TestUtils


class TestMCPBasicWorkflow:
    """MCP 基本工作流程测试"""

    @pytest.mark.asyncio
    async def test_mcp_server_startup(self):
        """测试 MCP 服务器启动"""
        client = SimpleMCPClient(timeout=30)

        try:
            # 测试服务器启动
            success = await client.start_server()
            assert success == True, "MCP 服务器启动失败"

            # 验证进程存在
            assert client.server_process is not None
            assert client.server_process.poll() is None  # 进程应该还在运行

        finally:
            await client.cleanup()

    @pytest.mark.asyncio
    async def test_mcp_initialization(self):
        """测试 MCP 初始化"""
        client = SimpleMCPClient(timeout=30)

        try:
            # 启动服务器
            assert await client.start_server() == True

            # 测试初始化
            success = await client.initialize()
            assert success == True, "MCP 初始化失败"
            assert client.initialized == True

        finally:
            await client.cleanup()

    @pytest.mark.asyncio
    async def test_interactive_feedback_call_timeout(self, test_project_dir):
        """测试 interactive_feedback 调用（超时情况）"""
        client = SimpleMCPClient(timeout=30)

        try:
            # 启动并初始化
            assert await client.start_server() == True
            assert await client.initialize() == True

            # 调用 interactive_feedback（设置短超时）
            result = await client.call_interactive_feedback(
                str(test_project_dir),
                "测试调用 - 预期超时",
                timeout=5,  # 5秒超时
            )

            # 验证结果格式
            assert isinstance(result, dict)

            # 由于是自动化测试环境，预期会超时或返回默认回应
            if "error" in result:
                # 超时是预期的行为
                assert "超时" in result["error"] or "timeout" in result["error"].lower()
            else:
                # 或者返回了默认的回应
                assert TestUtils.validate_web_response(result)

        finally:
            await client.cleanup()


class TestMCPWorkflowIntegration:
    """MCP 工作流程集成测试"""

    @pytest.mark.asyncio
    async def test_complete_workflow(self, test_project_dir):
        """测试完整的 MCP 工作流程"""
        tester = MCPWorkflowTester(timeout=60)

        result = await tester.test_basic_workflow(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        # 验证测试结果
        assert isinstance(result, dict)
        assert "success" in result
        assert "steps" in result
        assert "errors" in result
        assert "performance" in result

        # 检查关键步骤
        steps = result["steps"]
        assert steps.get("server_started") == True, "服务器启动失败"
        assert steps.get("initialized") == True, "初始化失败"

        # interactive_feedback 调用可能超时，这在测试环境是正常的
        if not steps.get("interactive_feedback_called"):
            # 检查是否是超时错误
            errors = result["errors"]
            timeout_error_found = any(
                "超时" in error or "timeout" in error.lower() for error in errors
            )
            assert timeout_error_found, (
                f"interactive_feedback 调用失败，但不是超时错误: {errors}"
            )

        # 验证性能数据
        performance = result["performance"]
        assert "total_duration" in performance
        assert performance["total_duration"] > 0

    @pytest.mark.asyncio
    async def test_multiple_calls_workflow(self, test_project_dir):
        """测试多次调用工作流程（仿真第二次循环）"""
        tester = MCPWorkflowTester(timeout=60)

        # 第一次调用
        result1 = await tester.test_basic_workflow(
            str(test_project_dir), "第一次 AI 调用 - 完成初始任务"
        )

        # 第二次调用
        result2 = await tester.test_basic_workflow(
            str(test_project_dir), "第二次 AI 调用 - 根据回馈调整"
        )

        # 两次调用都应该成功启动服务器和初始化
        for i, result in enumerate([result1, result2], 1):
            assert result["steps"].get("server_started") == True, (
                f"第{i}次调用服务器启动失败"
            )
            assert result["steps"].get("initialized") == True, f"第{i}次调用初始化失败"


class TestMCPErrorHandling:
    """MCP 错误处理测试"""

    @pytest.mark.asyncio
    async def test_invalid_project_directory(self):
        """测试无效项目目录处理"""
        client = SimpleMCPClient(timeout=30)

        try:
            assert await client.start_server() == True
            assert await client.initialize() == True

            # 使用不存在的目录
            result = await client.call_interactive_feedback(
                "/non/existent/directory", "测试无效目录", timeout=5
            )

            # 应该能处理错误而不崩溃
            assert isinstance(result, dict)

        finally:
            await client.cleanup()

    @pytest.mark.asyncio
    async def test_server_cleanup_on_error(self):
        """测试错误时的服务器清理"""
        client = SimpleMCPClient(timeout=30)

        try:
            assert await client.start_server() == True

            # 记录进程 ID
            process = client.server_process
            assert process is not None

            # 仿真错误情况（不初始化就调用工具）
            result = await client.call_interactive_feedback(
                "/test", "测试错误处理", timeout=5
            )

            # 应该返回错误
            assert "error" in result

        finally:
            # 清理应该正常工作
            await client.cleanup()

            # 验证进程已被清理
            if process:
                assert process.poll() is not None  # 进程应该已结束


class TestMCPPerformance:
    """MCP 性能测试"""

    @pytest.mark.asyncio
    async def test_startup_performance(self):
        """测试启动性能"""
        from tests.helpers.test_utils import PerformanceTimer

        client = SimpleMCPClient(timeout=30)

        try:
            with PerformanceTimer() as timer:
                success = await client.start_server()
                assert success == True

            # 启动时间应该在合理范围内（30秒内）
            assert timer.duration < 30, f"服务器启动时间过长: {timer.duration:.2f}秒"

            with PerformanceTimer() as timer:
                success = await client.initialize()
                assert success == True

            # 初始化时间应该很快（5秒内）
            assert timer.duration < 5, f"初始化时间过长: {timer.duration:.2f}秒"

        finally:
            await client.cleanup()

    @pytest.mark.asyncio
    async def test_concurrent_initialization(self):
        """测试并发初始化（确保不会冲突）"""
        clients = [SimpleMCPClient(timeout=30) for _ in range(2)]

        try:
            # 并发启动多个客户端
            startup_tasks = [client.start_server() for client in clients]
            startup_results = await asyncio.gather(
                *startup_tasks, return_exceptions=True
            )

            # 至少有一个应该成功（其他可能因为端口冲突失败）
            successful_clients = []
            for i, (client, result) in enumerate(
                zip(clients, startup_results, strict=False)
            ):
                if isinstance(result, bool) and result:
                    successful_clients.append(client)
                elif isinstance(result, Exception):
                    print(f"客户端 {i} 启动失败（预期）: {result}")

            assert len(successful_clients) >= 1, "至少应该有一个客户端成功启动"

            # 测试成功的客户端初始化
            for client in successful_clients:
                success = await client.initialize()
                assert success == True

        finally:
            # 清理所有客户端
            cleanup_tasks = [client.cleanup() for client in clients]
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)
