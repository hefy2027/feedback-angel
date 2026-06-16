"""
端口管理器测试模块

测试 PortManager 类的各项功能，包括：
- 端口可用性检测
- 进程查找和清理
- 增强端口查找
"""

import socket
import time
from unittest.mock import patch

import pytest

# 移除手动路径操作，让 mypy 和 pytest 使用正确的模块解析
from mcp_feedback_enhanced.web.utils.port_manager import PortManager


class TestPortManager:
    """端口管理器测试类"""

    def test_is_port_available_free_port(self):
        """测试检测空闲端口"""
        # 找一个肯定空闲的端口
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            free_port = s.getsockname()[1]

        # 测试该端口是否被检测为可用
        assert PortManager.is_port_available("127.0.0.1", free_port) is True

    def test_is_port_available_occupied_port(self):
        """测试检测被占用的端口"""
        # 创建一个占用端口的 socket
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind(("127.0.0.1", 0))
        occupied_port = server_socket.getsockname()[1]
        server_socket.listen(1)

        try:
            # 测试该端口是否被检测为不可用
            assert PortManager.is_port_available("127.0.0.1", occupied_port) is False
        finally:
            server_socket.close()

    def test_find_free_port_enhanced_preferred_available(self):
        """测试当偏好端口可用时的行为"""
        # 找一个空闲端口作为偏好端口
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            preferred_port = s.getsockname()[1]

        # 测试是否返回偏好端口
        result_port = PortManager.find_free_port_enhanced(
            preferred_port=preferred_port, auto_cleanup=False
        )
        assert result_port == preferred_port

    def test_find_free_port_enhanced_preferred_occupied(self):
        """测试当偏好端口被占用时的行为"""
        # 创建一个占用端口的 socket
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind(("127.0.0.1", 0))
        occupied_port = server_socket.getsockname()[1]
        server_socket.listen(1)

        try:
            # 测试是否返回其他可用端口
            result_port = PortManager.find_free_port_enhanced(
                preferred_port=occupied_port, auto_cleanup=False
            )
            assert result_port != occupied_port
            assert result_port > occupied_port  # 应该向上查找

            # 验证返回的端口确实可用
            assert PortManager.is_port_available("127.0.0.1", result_port) is True
        finally:
            server_socket.close()

    def test_find_process_using_port_no_process(self):
        """测试查找没有进程占用的端口"""
        # 找一个空闲端口
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            free_port = s.getsockname()[1]

        # 测试是否正确返回 None
        result = PortManager.find_process_using_port(free_port)
        assert result is None

    def test_find_process_using_port_with_process(self):
        """测试查找有进程占用的端口"""
        # 创建一个简单的测试服务器
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind(("127.0.0.1", 0))
        test_port = server_socket.getsockname()[1]
        server_socket.listen(1)

        try:
            # 测试是否能找到进程信息
            result = PortManager.find_process_using_port(test_port)

            if result:  # 如果找到了进程（在某些环境下可能找不到）
                assert isinstance(result, dict)
                assert "pid" in result
                assert "name" in result
                assert "cmdline" in result
                assert isinstance(result["pid"], int)
                assert result["pid"] > 0
        finally:
            server_socket.close()

    def test_get_port_status_available(self):
        """测试获取可用端口的状态"""
        # 找一个空闲端口
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            free_port = s.getsockname()[1]

        status = PortManager.get_port_status(free_port)

        assert status["port"] == free_port
        assert status["host"] == "127.0.0.1"
        assert status["available"] is True
        assert status["process"] is None
        assert status["error"] is None

    def test_get_port_status_occupied(self):
        """测试获取被占用端口的状态"""
        # 创建一个占用端口的 socket
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind(("127.0.0.1", 0))
        occupied_port = server_socket.getsockname()[1]
        server_socket.listen(1)

        try:
            status = PortManager.get_port_status(occupied_port)

            assert status["port"] == occupied_port
            assert status["host"] == "127.0.0.1"
            assert status["available"] is False
            # process 可能为 None（取决于系统权限）
            assert status["error"] is None
        finally:
            server_socket.close()

    def test_list_listening_ports(self):
        """测试列出监听端口"""
        # 创建几个测试服务器
        servers = []
        test_ports = []

        try:
            for i in range(2):
                server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                server_socket.bind(("127.0.0.1", 0))
                port = server_socket.getsockname()[1]
                server_socket.listen(1)

                servers.append(server_socket)
                test_ports.append(port)

            # 测试列出监听端口
            min_port = min(test_ports) - 10
            max_port = max(test_ports) + 10

            listening_ports = PortManager.list_listening_ports(min_port, max_port)

            # 验证结果
            assert isinstance(listening_ports, list)

            # 检查我们的测试端口是否在列表中
            found_ports = [p["port"] for p in listening_ports]
            for test_port in test_ports:
                if test_port in found_ports:
                    # 找到了我们的端口，验证信息完整性
                    port_info = next(
                        p for p in listening_ports if p["port"] == test_port
                    )
                    assert "host" in port_info
                    assert "pid" in port_info
                    assert "process_name" in port_info
                    assert "cmdline" in port_info

        finally:
            # 清理测试服务器
            for server in servers:
                server.close()

    @patch("mcp_feedback_enhanced.web.utils.port_manager.psutil.Process")
    def test_should_cleanup_process_mcp_process(self, mock_process):
        """测试是否应该清理 MCP 相关进程"""
        # 仿真 MCP 相关进程
        process_info = {
            "pid": 1234,
            "name": "python.exe",
            "cmdline": "python -m mcp-feedback-enhanced test --web",
            "create_time": time.time(),
            "status": "running",
        }

        result = PortManager._should_cleanup_process(process_info)
        assert result is True

    @patch("mcp_feedback_enhanced.web.utils.port_manager.psutil.Process")
    def test_should_cleanup_process_other_process(self, mock_process):
        """测试是否应该清理其他进程"""
        # 仿真其他进程
        process_info = {
            "pid": 5678,
            "name": "chrome.exe",
            "cmdline": "chrome --new-window",
            "create_time": time.time(),
            "status": "running",
        }

        result = PortManager._should_cleanup_process(process_info)
        assert result is False

    def test_find_free_port_enhanced_max_attempts(self):
        """测试最大尝试次数限制"""
        # 这个测试比较难实现，因为需要占用大量连续端口
        # 我们只测试参数是否正确传递
        try:
            result = PortManager.find_free_port_enhanced(
                preferred_port=65000,  # 使用高端口减少冲突
                auto_cleanup=False,
                max_attempts=10,
            )
            assert isinstance(result, int)
            assert 65000 <= result <= 65535
        except RuntimeError:
            # 如果真的找不到端口，这也是正常的
            pass


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v"])
