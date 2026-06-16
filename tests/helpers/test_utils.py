#!/usr/bin/env python3
"""
测试工具函数
"""

import asyncio
import socket
import time
from typing import Any


class TestUtils:
    """测试工具类"""

    @staticmethod
    def find_free_port(start_port: int = 8000, max_attempts: int = 100) -> int:
        """寻找可用端口"""
        for port in range(start_port, start_port + max_attempts):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(("127.0.0.1", port))
                    return port
            except OSError:
                continue
        raise RuntimeError(
            f"无法找到可用端口 (尝试范围: {start_port}-{start_port + max_attempts})"
        )

    @staticmethod
    async def wait_for_condition(
        condition_func, timeout: float = 10.0, check_interval: float = 0.1
    ) -> bool:
        """等待条件满足"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if (
                await condition_func()
                if asyncio.iscoroutinefunction(condition_func)
                else condition_func()
            ):
                return True
            await asyncio.sleep(check_interval)
        return False

    @staticmethod
    def create_test_session_data(
        session_id: str = "test-session-123",
        project_directory: str = "/test/project",
        summary: str = "测试摘要",
    ) -> dict[str, Any]:
        """创建测试会话数据"""
        return {
            "session_id": session_id,
            "project_directory": project_directory,
            "summary": summary,
            "status": "waiting",
            "created_at": time.time(),
            "last_activity": time.time(),
        }

    @staticmethod
    def create_test_feedback_data(
        feedback: str = "测试回馈", images: list[dict] | None = None
    ) -> dict[str, Any]:
        """创建测试回馈数据"""
        return {
            "feedback": feedback,
            "images": images or [],
            "settings": {
                "image_size_limit": 1024 * 1024,  # 1MB
                "enable_base64_detail": True,
            },
        }

    @staticmethod
    def validate_web_response(response_data: dict[str, Any]) -> bool:
        """验证 Web 回应格式"""
        required_fields = ["command_logs", "interactive_feedback", "images"]
        return all(field in response_data for field in required_fields)

    @staticmethod
    def validate_session_info(session_info: dict[str, Any]) -> bool:
        """验证会话信息格式"""
        required_fields = ["session_id", "project_directory", "summary", "status"]
        return all(field in session_info for field in required_fields)


class MockWebSocketClient:
    """仿真 WebSocket 客户端"""

    def __init__(self):
        self.connected = False
        self.messages = []
        self.responses = []

    async def connect(self, url: str) -> bool:
        """仿真连接"""
        self.connected = True
        return True

    async def send_json(self, data: dict[str, Any]):
        """仿真发送 JSON 数据"""
        if not self.connected:
            raise RuntimeError("WebSocket 未连接")
        self.messages.append(data)

    async def receive_json(self) -> dict[str, Any]:
        """仿真接收 JSON 数据"""
        if not self.connected:
            raise RuntimeError("WebSocket 未连接")
        if self.responses:
            response = self.responses.pop(0)
            # 修复 no-any-return 错误 - 确保返回明确类型
            return dict(response)  # 明确返回 dict[str, Any] 类型
        # 返回默认回应
        return {"type": "connection_established", "message": "连接成功"}

    def add_response(self, response: dict[str, Any]):
        """添加仿真回应"""
        self.responses.append(response)

    async def close(self):
        """关闭连接"""
        self.connected = False


class PerformanceTimer:
    """性能计时器"""

    def __init__(self):
        self.start_time: float | None = None
        self.end_time: float | None = None

    def start(self):
        """开始计时"""
        self.start_time = time.time()

    def stop(self):
        """停止计时"""
        self.end_time = time.time()

    @property
    def duration(self) -> float:
        """获取持续时间"""
        if self.start_time is None:
            return 0.0
        end = self.end_time or time.time()
        return end - self.start_time

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()
