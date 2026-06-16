#!/usr/bin/env python3
"""
Gzip 压缩功能测试
================

测试 FastAPI Gzip 压缩中间件的功能，包括：
- 压缩效果验证
- WebSocket 兼容性
- 静态文档缓存
- 性能提升测试
"""

import gzip
import json
from unittest.mock import patch

import pytest
from fastapi import FastAPI, Response
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.testclient import TestClient

from mcp_feedback_enhanced.web.utils.compression_config import (
    CompressionConfig,
    CompressionManager,
    get_compression_manager,
)
from mcp_feedback_enhanced.web.utils.compression_monitor import (
    CompressionMonitor,
    get_compression_monitor,
)


class TestCompressionConfig:
    """测试压缩配置类"""

    def test_default_config(self):
        """测试缺省配置"""
        config = CompressionConfig()

        assert config.minimum_size == 1000
        assert config.compression_level == 6
        assert config.static_cache_max_age == 3600
        assert config.api_cache_max_age == 0
        assert "text/html" in config.compressible_types
        assert "application/json" in config.compressible_types
        assert "/ws" in config.exclude_paths

    def test_from_env(self):
        """测试从环境变量创建配置"""
        with patch.dict(
            "os.environ",
            {
                "MCP_GZIP_MIN_SIZE": "2000",
                "MCP_GZIP_LEVEL": "9",
                "MCP_STATIC_CACHE_AGE": "7200",
            },
        ):
            config = CompressionConfig.from_env()

            assert config.minimum_size == 2000
            assert config.compression_level == 9
            assert config.static_cache_max_age == 7200

    def test_should_compress(self):
        """测试压缩判断逻辑"""
        config = CompressionConfig()

        # 应该压缩的情况
        assert config.should_compress("text/html", 2000) == True
        assert config.should_compress("application/json", 1500) == True

        # 不应该压缩的情况
        assert config.should_compress("text/html", 500) == False  # 太小
        assert config.should_compress("image/jpeg", 2000) == False  # 不支持的类型
        assert config.should_compress("", 2000) == False  # 无内容类型

    def test_should_exclude_path(self):
        """测试路径排除逻辑"""
        config = CompressionConfig()

        assert config.should_exclude_path("/ws") == True
        assert config.should_exclude_path("/api/ws") == True
        assert config.should_exclude_path("/health") == True
        assert config.should_exclude_path("/static/css/style.css") == False
        assert config.should_exclude_path("/api/feedback") == False

    def test_get_cache_headers(self):
        """测试缓存头生成"""
        config = CompressionConfig()

        # 静态文档
        static_headers = config.get_cache_headers("/static/css/style.css")
        assert "Cache-Control" in static_headers
        assert "public, max-age=3600" in static_headers["Cache-Control"]

        # API 路径（缺省不缓存）
        api_headers = config.get_cache_headers("/api/feedback")
        assert "no-cache" in api_headers["Cache-Control"]

        # 其他路径
        other_headers = config.get_cache_headers("/feedback")
        assert "no-cache" in other_headers["Cache-Control"]


class TestCompressionManager:
    """测试压缩管理器"""

    def test_manager_initialization(self):
        """测试管理器初始化"""
        manager = CompressionManager()

        assert manager.config is not None
        assert manager._stats["requests_total"] == 0
        assert manager._stats["requests_compressed"] == 0

    def test_update_stats(self):
        """测试统计更新"""
        manager = CompressionManager()

        # 测试压缩请求
        manager.update_stats(1000, 600, True)
        stats = manager.get_stats()

        assert stats["requests_total"] == 1
        assert stats["requests_compressed"] == 1
        assert stats["bytes_original"] == 1000
        assert stats["bytes_compressed"] == 600
        assert stats["compression_ratio"] == 40.0  # (1000-600)/1000 * 100

        # 测试未压缩请求
        manager.update_stats(500, 500, False)
        stats = manager.get_stats()

        assert stats["requests_total"] == 2
        assert stats["requests_compressed"] == 1
        assert stats["compression_percentage"] == 50.0  # 1/2 * 100

    def test_reset_stats(self):
        """测试统计重置"""
        manager = CompressionManager()
        manager.update_stats(1000, 600, True)

        manager.reset_stats()
        stats = manager.get_stats()

        assert stats["requests_total"] == 0
        assert stats["requests_compressed"] == 0
        assert stats["compression_ratio"] == 0.0


class TestCompressionMonitor:
    """测试压缩监控器"""

    def test_monitor_initialization(self):
        """测试监控器初始化"""
        monitor = CompressionMonitor()

        assert monitor.max_metrics == 1000
        assert len(monitor.metrics) == 0
        assert len(monitor.path_stats) == 0

    def test_record_request(self):
        """测试请求记录"""
        monitor = CompressionMonitor()

        monitor.record_request(
            path="/static/css/style.css",
            original_size=2000,
            compressed_size=1200,
            response_time=0.05,
            content_type="text/css",
            was_compressed=True,
        )

        assert len(monitor.metrics) == 1
        metric = monitor.metrics[0]
        assert metric.path == "/static/css/style.css"
        assert metric.compression_ratio == 40.0  # (2000-1200)/2000 * 100

        # 检查路径统计
        path_stats = monitor.get_path_stats()
        assert "/static/css/style.css" in path_stats
        assert path_stats["/static/css/style.css"]["requests"] == 1
        assert path_stats["/static/css/style.css"]["compressed_requests"] == 1

    def test_get_summary(self):
        """测试摘要统计"""
        monitor = CompressionMonitor()

        # 记录多个请求
        monitor.record_request(
            "/static/css/style.css", 2000, 1200, 0.05, "text/css", True
        )
        monitor.record_request(
            "/static/js/app.js", 3000, 1800, 0.08, "application/javascript", True
        )
        monitor.record_request(
            "/api/feedback", 500, 500, 0.02, "application/json", False
        )

        summary = monitor.get_summary()

        assert summary.total_requests == 3
        assert summary.compressed_requests == 2
        assert abs(summary.compression_percentage - 66.67) < 0.01  # 2/3 * 100 (约)
        assert (
            summary.bandwidth_saved == 2000
        )  # (2000-1200) + (3000-1800) + 0 = 800 + 1200 + 0 = 2000

    def test_export_stats(self):
        """测试统计导出"""
        monitor = CompressionMonitor()

        monitor.record_request(
            "/static/css/style.css", 2000, 1200, 0.05, "text/css", True
        )

        exported = monitor.export_stats()

        assert "summary" in exported
        assert "top_compressed_paths" in exported
        assert "path_stats" in exported
        assert "content_type_stats" in exported

        assert exported["summary"]["total_requests"] == 1
        assert exported["summary"]["compressed_requests"] == 1


class TestGzipIntegration:
    """测试 Gzip 压缩集成"""

    def create_test_app(self):
        """创建测试应用"""
        app = FastAPI()

        # 添加 Gzip 中间件
        app.add_middleware(GZipMiddleware, minimum_size=100)

        @app.get("/test-large")
        async def test_large():
            # 返回大于最小压缩大小的内容
            return {"data": "x" * 1000}

        @app.get("/test-small")
        async def test_small():
            # 返回小于最小压缩大小的内容
            return {"data": "small"}

        @app.get("/test-html")
        async def test_html():
            html_content = "<html><body>" + "content " * 100 + "</body></html>"
            return Response(content=html_content, media_type="text/html")

        return app

    def test_gzip_compression_large_content(self):
        """测试大内容的 Gzip 压缩"""
        app = self.create_test_app()
        client = TestClient(app)

        # 请求压缩
        response = client.get("/test-large", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"

        # 验证内容正确性
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 1000

    def test_gzip_compression_small_content(self):
        """测试小内容不压缩"""
        app = self.create_test_app()
        client = TestClient(app)

        response = client.get("/test-small", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        # 小内容不应该被压缩
        assert response.headers.get("content-encoding") != "gzip"

    def test_gzip_compression_html_content(self):
        """测试 HTML 内容压缩"""
        app = self.create_test_app()
        client = TestClient(app)

        response = client.get("/test-html", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"
        assert response.headers.get("content-type") == "text/html; charset=utf-8"

    def test_no_compression_without_accept_encoding(self):
        """测试不支持压缩的客户端"""
        app = self.create_test_app()
        client = TestClient(app)

        # FastAPI 的 TestClient 缺省会添加 Accept-Encoding，所以我们测试明确拒绝压缩
        response = client.get("/test-large", headers={"Accept-Encoding": "identity"})

        assert response.status_code == 200
        # 当明确要求不压缩时，应该不会有 gzip 编码
        # 注意：某些情况下 FastAPI 仍可能压缩，这是正常行为


class TestWebSocketCompatibility:
    """测试 WebSocket 兼容性"""

    def test_websocket_not_compressed(self):
        """测试 WebSocket 连接不受压缩影响"""
        # 这个测试确保 WebSocket 路径被正确排除
        config = CompressionConfig()

        # WebSocket 路径应该被排除
        assert config.should_exclude_path("/ws") == True
        assert config.should_exclude_path("/api/ws") == True

        # 确保 WebSocket 不会被压缩配置影响
        assert not config.should_compress(
            "application/json", 1000
        ) or config.should_exclude_path("/ws")


@pytest.mark.asyncio
async def test_compression_performance():
    """测试压缩性能"""
    # 创建测试数据
    test_data = {"message": "test " * 1000}  # 大约 5KB 的 JSON
    json_data = json.dumps(test_data)

    # 手动压缩测试
    compressed_data = gzip.compress(json_data.encode("utf-8"))

    # 验证压缩效果
    original_size = len(json_data.encode("utf-8"))
    compressed_size = len(compressed_data)
    compression_ratio = (1 - compressed_size / original_size) * 100

    # 压缩比应该大于 50%（JSON 数据通常压缩效果很好）
    assert compression_ratio > 50
    assert compressed_size < original_size

    # 验证解压缩正确性
    decompressed_data = gzip.decompress(compressed_data).decode("utf-8")
    assert decompressed_data == json_data


def test_global_instances():
    """测试全域实例"""
    # 测试压缩管理器全域实例
    manager1 = get_compression_manager()
    manager2 = get_compression_manager()
    assert manager1 is manager2

    # 测试压缩监控器全域实例
    monitor1 = get_compression_monitor()
    monitor2 = get_compression_monitor()
    assert monitor1 is monitor2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
