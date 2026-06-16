"""
错误处理框架测试模块

测试 ErrorHandler 类的各项功能，包括：
- 错误类型自动分类
- 用户友好错误信息生成
- 国际化支持
- 错误上下文记录
"""

from unittest.mock import patch

import pytest

# 移除手动路径操作，让 mypy 和 pytest 使用正确的模块解析
from mcp_feedback_enhanced.utils.error_handler import (
    ErrorHandler,
    ErrorSeverity,
    ErrorType,
)


class TestErrorHandler:
    """错误处理器测试类"""

    def test_classify_error_network(self):
        """测试网络错误分类"""
        # 测试 ConnectionError
        error = ConnectionError("Connection failed")
        assert ErrorHandler.classify_error(error) == ErrorType.NETWORK

        # 测试包含网络关键字的错误（不包含 timeout）
        # 修复 assignment 错误 - 使用正确的异常类型
        network_error = Exception("socket connection failed")
        assert ErrorHandler.classify_error(network_error) == ErrorType.NETWORK

    def test_classify_error_file_io(self):
        """测试文档 I/O 错误分类"""
        # 测试 FileNotFoundError
        error = FileNotFoundError("No such file or directory")
        assert ErrorHandler.classify_error(error) == ErrorType.FILE_IO

        # 测试包含文档关键字的错误（不包含权限关键字）
        # 修复 assignment 错误 - 使用正确的异常类型
        file_error = Exception("file not found")
        assert ErrorHandler.classify_error(file_error) == ErrorType.FILE_IO

    def test_classify_error_timeout(self):
        """测试超时错误分类"""
        error = TimeoutError("Operation timed out")
        assert ErrorHandler.classify_error(error) == ErrorType.TIMEOUT

        timeout_error = Exception("timeout occurred")
        assert ErrorHandler.classify_error(timeout_error) == ErrorType.TIMEOUT

    def test_classify_error_permission(self):
        """测试权限错误分类"""
        error = PermissionError("Access denied")
        assert ErrorHandler.classify_error(error) == ErrorType.PERMISSION

        permission_error = Exception("access denied")
        assert ErrorHandler.classify_error(permission_error) == ErrorType.PERMISSION

    def test_classify_error_validation(self):
        """测试验证错误分类"""
        error = ValueError("Invalid value")
        assert ErrorHandler.classify_error(error) == ErrorType.VALIDATION

        type_error = TypeError("Wrong type")
        assert ErrorHandler.classify_error(type_error) == ErrorType.VALIDATION

    def test_classify_error_default_system(self):
        """测试默认系统错误分类"""
        error = Exception("Some completely unknown issue")
        assert ErrorHandler.classify_error(error) == ErrorType.SYSTEM

    def test_format_user_error_basic(self):
        """测试基本用户友好错误信息生成"""
        error = ConnectionError("Connection failed")
        result = ErrorHandler.format_user_error(error)

        assert "❌" in result
        assert (
            "网络连接出现问题" in result
            or "网络连接出现问题" in result
            or "Network connection issue" in result
        )

    def test_format_user_error_with_context(self):
        """测试带上下文的错误信息生成"""
        error = FileNotFoundError("File not found")
        context = {"operation": "文档读取", "file_path": "/path/to/file.txt"}

        result = ErrorHandler.format_user_error(error, context=context)

        assert "❌" in result
        assert "文档读取" in result or "文档读取" in result or "文档读取" in result
        assert "/path/to/file.txt" in result

    def test_format_user_error_with_technical_details(self):
        """测试包含技术细节的错误信息"""
        error = ValueError("Invalid input")
        result = ErrorHandler.format_user_error(error, include_technical=True)

        assert "❌" in result
        assert "ValueError" in result
        assert "Invalid input" in result

    def test_get_error_solutions(self):
        """测试获取错误解决方案"""
        solutions = ErrorHandler.get_error_solutions(ErrorType.NETWORK)

        assert isinstance(solutions, list)
        assert len(solutions) > 0
        # 应该包含网络相关的解决方案
        solutions_text = " ".join(solutions).lower()
        assert any(
            keyword in solutions_text
            for keyword in ["网络", "网络", "network", "连接", "连接", "connection"]
        )

    def test_log_error_with_context(self):
        """测试带上下文的错误记录"""
        error = Exception("Test error")
        context = {"operation": "测试操作", "user": "test_user"}

        error_id = ErrorHandler.log_error_with_context(error, context=context)

        assert isinstance(error_id, str)
        assert error_id.startswith("ERR_")
        assert len(error_id.split("_")) == 3  # ERR_timestamp_id

    def test_create_error_response(self):
        """测试创建标准化错误响应"""
        error = ConnectionError("Network error")
        context = {"operation": "网络请求"}

        response = ErrorHandler.create_error_response(error, context=context)

        assert isinstance(response, dict)
        assert response["success"] is False
        assert "error_id" in response
        assert "error_type" in response
        assert "message" in response
        assert response["error_type"] == ErrorType.NETWORK.value
        assert "solutions" in response

    def test_create_error_response_for_user(self):
        """测试为用户界面创建错误响应"""
        error = FileNotFoundError("File not found")

        response = ErrorHandler.create_error_response(error, for_user=True)

        assert response["success"] is False
        assert "context" not in response  # 用户界面不应包含技术上下文
        assert "❌" in response["message"]  # 应该包含用户友好的格式

    @patch(
        "mcp_feedback_enhanced.utils.error_handler.ErrorHandler.get_i18n_error_message"
    )
    def test_language_support(self, mock_get_message):
        """测试多语言支持"""
        error = ConnectionError("Network error")

        # 测试繁体中文
        mock_get_message.return_value = "网络连接出现问题"
        result = ErrorHandler.format_user_error(error)
        assert "网络连接出现问题" in result

        # 测试简体中文
        mock_get_message.return_value = "网络连接出现问题"
        result = ErrorHandler.format_user_error(error)
        assert "网络连接出现问题" in result

        # 测试英文
        mock_get_message.return_value = "Network connection issue"
        result = ErrorHandler.format_user_error(error)
        assert "Network connection issue" in result

    def test_error_severity_logging(self):
        """测试错误严重程度记录"""
        error = Exception("Critical system error")

        # 测试高严重程度错误
        error_id = ErrorHandler.log_error_with_context(
            error, severity=ErrorSeverity.CRITICAL
        )

        assert isinstance(error_id, str)
        assert error_id.startswith("ERR_")

    def test_get_current_language_fallback(self):
        """测试语言获取回退机制"""
        # 由于 i18n 系统可能会覆盖环境变量，我们主要测试函数不会抛出异常
        language = ErrorHandler.get_current_language()
        assert isinstance(language, str)
        assert len(language) > 0

        # 测试语言代码格式
        assert language in ["zh-TW", "zh-CN", "en"] or "-" in language

    def test_i18n_integration(self):
        """测试国际化系统集成"""
        # 测试当 i18n 系统不可用时的回退
        error_type = ErrorType.NETWORK

        # 测试获取错误信息
        message = ErrorHandler.get_i18n_error_message(error_type)
        assert isinstance(message, str)
        assert len(message) > 0

        # 测试获取解决方案
        solutions = ErrorHandler.get_i18n_error_solutions(error_type)
        assert isinstance(solutions, list)

    def test_error_context_preservation(self):
        """测试错误上下文保存"""
        error = Exception("Test error")
        context = {
            "operation": "测试操作",
            "file_path": "/test/path",
            "user_id": "test_user",
            "timestamp": "2025-01-05",
        }

        error_id = ErrorHandler.log_error_with_context(error, context=context)

        # 验证错误 ID 格式
        assert isinstance(error_id, str)
        assert error_id.startswith("ERR_")

        # 上下文应该被记录到调试日志中（通过 debug_log）
        # 这里我们主要验证函数不会抛出异常

    def test_json_rpc_safety(self):
        """测试不影响 JSON RPC 通信"""
        # 错误处理应该只记录到 stderr（通过 debug_log）
        # 不应该影响 stdout 或 JSON RPC 响应

        error = Exception("Test error for JSON RPC safety")
        context = {"operation": "JSON RPC 测试"}

        # 这些操作不应该影响 stdout
        error_id = ErrorHandler.log_error_with_context(error, context=context)
        user_message = ErrorHandler.format_user_error(error)
        response = ErrorHandler.create_error_response(error)

        # 验证返回值类型正确
        assert isinstance(error_id, str)
        assert isinstance(user_message, str)
        assert isinstance(response, dict)

        # 验证不会抛出异常
        assert error_id.startswith("ERR_")
        assert "❌" in user_message
        assert response["success"] is False


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v"])
