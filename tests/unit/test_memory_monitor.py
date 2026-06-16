#!/usr/bin/env python3
"""
内存监控系统测试
================

测试集成式内存监控系统的功能，包括：
- 内存监控准确性
- 警告机制
- 清理触发
- 统计和分析功能
"""

from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest

from mcp_feedback_enhanced.utils.memory_monitor import (
    MemoryAlert,
    MemoryMonitor,
    MemorySnapshot,
    get_memory_monitor,
)


class TestMemorySnapshot:
    """测试内存快照数据类"""

    def test_memory_snapshot_creation(self):
        """测试内存快照创建"""
        snapshot = MemorySnapshot(
            timestamp=datetime.now(),
            system_total=8 * 1024**3,  # 8GB
            system_available=4 * 1024**3,  # 4GB
            system_used=4 * 1024**3,  # 4GB
            system_percent=50.0,
            process_rss=100 * 1024**2,  # 100MB
            process_vms=200 * 1024**2,  # 200MB
            process_percent=1.25,
            gc_objects=10000,
        )

        assert snapshot.system_total == 8 * 1024**3
        assert snapshot.system_percent == 50.0
        assert snapshot.process_rss == 100 * 1024**2
        assert snapshot.gc_objects == 10000


class TestMemoryAlert:
    """测试内存警告数据类"""

    def test_memory_alert_creation(self):
        """测试内存警告创建"""
        alert = MemoryAlert(
            level="warning",
            message="内存使用率较高: 85.0%",
            timestamp=datetime.now(),
            memory_percent=85.0,
            recommended_action="考虑运行轻量级清理",
        )

        assert alert.level == "warning"
        assert alert.memory_percent == 85.0
        assert "85.0%" in alert.message


class TestMemoryMonitor:
    """测试内存监控器"""

    def test_monitor_initialization(self):
        """测试监控器初始化"""
        monitor = MemoryMonitor(
            warning_threshold=0.7,
            critical_threshold=0.85,
            emergency_threshold=0.95,
            monitoring_interval=10,
        )

        assert monitor.warning_threshold == 0.7
        assert monitor.critical_threshold == 0.85
        assert monitor.emergency_threshold == 0.95
        assert monitor.monitoring_interval == 10
        assert not monitor.is_monitoring
        assert len(monitor.snapshots) == 0
        assert len(monitor.alerts) == 0

    @patch("mcp_feedback_enhanced.utils.memory_monitor.psutil")
    def test_collect_memory_snapshot(self, mock_psutil):
        """测试内存快照收集"""
        # 仿真 psutil 返回值
        mock_virtual_memory = Mock()
        mock_virtual_memory.total = 8 * 1024**3
        mock_virtual_memory.available = 4 * 1024**3
        mock_virtual_memory.used = 4 * 1024**3
        mock_virtual_memory.percent = 50.0

        mock_memory_info = Mock()
        mock_memory_info.rss = 100 * 1024**2
        mock_memory_info.vms = 200 * 1024**2

        mock_process = Mock()
        mock_process.memory_info.return_value = mock_memory_info
        mock_process.memory_percent.return_value = 1.25

        mock_psutil.virtual_memory.return_value = mock_virtual_memory
        mock_psutil.Process.return_value = mock_process

        monitor = MemoryMonitor()
        snapshot = monitor._collect_memory_snapshot()

        assert snapshot.system_total == 8 * 1024**3
        assert snapshot.system_percent == 50.0
        assert snapshot.process_rss == 100 * 1024**2
        assert snapshot.process_percent == 1.25

    def test_memory_status_classification(self):
        """测试内存状态分类"""
        monitor = MemoryMonitor(
            warning_threshold=0.8, critical_threshold=0.9, emergency_threshold=0.95
        )

        assert monitor._get_memory_status(0.5) == "normal"
        assert monitor._get_memory_status(0.85) == "warning"
        assert monitor._get_memory_status(0.92) == "critical"
        assert monitor._get_memory_status(0.97) == "emergency"

    def test_callback_management(self):
        """测试回调函数管理"""
        monitor = MemoryMonitor()

        cleanup_callback = Mock()
        alert_callback = Mock()

        # 添加回调
        monitor.add_cleanup_callback(cleanup_callback)
        monitor.add_alert_callback(alert_callback)

        assert cleanup_callback in monitor.cleanup_callbacks
        assert alert_callback in monitor.alert_callbacks

        # 移除回调
        monitor.remove_cleanup_callback(cleanup_callback)
        monitor.remove_alert_callback(alert_callback)

        assert cleanup_callback not in monitor.cleanup_callbacks
        assert alert_callback not in monitor.alert_callbacks

    @patch("mcp_feedback_enhanced.utils.memory_monitor.gc")
    def test_cleanup_triggering(self, mock_gc):
        """测试清理触发"""
        monitor = MemoryMonitor()
        cleanup_callback = Mock()
        monitor.add_cleanup_callback(cleanup_callback)

        mock_gc.collect.return_value = 42

        # 测试普通清理
        monitor._trigger_cleanup()

        assert monitor.cleanup_triggers_count == 1
        cleanup_callback.assert_called_once()
        mock_gc.collect.assert_called()

        # 测试紧急清理
        cleanup_callback.reset_mock()
        mock_gc.collect.reset_mock()

        monitor._trigger_emergency_cleanup()

        # 紧急清理会调用多次垃圾回收
        assert mock_gc.collect.call_count == 3

    @patch("mcp_feedback_enhanced.utils.memory_monitor.psutil")
    def test_memory_usage_checking(self, mock_psutil):
        """测试内存使用检查和警告触发"""
        monitor = MemoryMonitor(
            warning_threshold=0.8, critical_threshold=0.9, emergency_threshold=0.95
        )

        alert_callback = Mock()
        cleanup_callback = Mock()
        monitor.add_alert_callback(alert_callback)
        monitor.add_cleanup_callback(cleanup_callback)

        # 仿真不同的内存使用情况
        test_cases = [
            (75.0, "normal", 0, 0),  # 正常情况
            (85.0, "warning", 1, 0),  # 警告情况
            (92.0, "critical", 1, 1),  # 危险情况
            (97.0, "emergency", 1, 1),  # 紧急情况
        ]

        for (
            memory_percent,
            expected_status,
            expected_alerts,
            expected_cleanups,
        ) in test_cases:
            # 重置计数器
            alert_callback.reset_mock()
            cleanup_callback.reset_mock()
            monitor.alerts.clear()
            monitor.cleanup_triggers_count = 0

            # 创建仿真快照
            snapshot = MemorySnapshot(
                timestamp=datetime.now(),
                system_total=8 * 1024**3,
                system_available=int(8 * 1024**3 * (100 - memory_percent) / 100),
                system_used=int(8 * 1024**3 * memory_percent / 100),
                system_percent=memory_percent,
                process_rss=100 * 1024**2,
                process_vms=200 * 1024**2,
                process_percent=1.25,
                gc_objects=10000,
            )

            # 检查内存使用
            monitor._check_memory_usage(snapshot)

            # 验证结果
            assert monitor._get_memory_status(memory_percent / 100.0) == expected_status

            if expected_alerts > 0:
                assert len(monitor.alerts) == expected_alerts
                assert alert_callback.call_count == expected_alerts

            if expected_cleanups > 0:
                assert cleanup_callback.call_count == expected_cleanups

    def test_memory_trend_analysis(self):
        """测试内存趋势分析"""
        monitor = MemoryMonitor()

        # 测试数据不足的情况
        assert monitor._analyze_memory_trend() == "insufficient_data"

        # 添加稳定趋势的快照
        base_time = datetime.now()
        for i in range(10):
            snapshot = MemorySnapshot(
                timestamp=base_time + timedelta(seconds=i * 30),
                system_total=8 * 1024**3,
                system_available=4 * 1024**3,
                system_used=4 * 1024**3,
                system_percent=50.0 + (i % 2),  # 轻微波动
                process_rss=100 * 1024**2,
                process_vms=200 * 1024**2,
                process_percent=1.25,
                gc_objects=10000,
            )
            monitor.snapshots.append(snapshot)

        assert monitor._analyze_memory_trend() == "stable"

        # 清空并添加递增趋势的快照
        monitor.snapshots.clear()
        for i in range(10):
            snapshot = MemorySnapshot(
                timestamp=base_time + timedelta(seconds=i * 30),
                system_total=8 * 1024**3,
                system_available=4 * 1024**3,
                system_used=4 * 1024**3,
                system_percent=50.0 + i * 2,  # 递增趋势
                process_rss=100 * 1024**2,
                process_vms=200 * 1024**2,
                process_percent=1.25,
                gc_objects=10000,
            )
            monitor.snapshots.append(snapshot)

        assert monitor._analyze_memory_trend() == "increasing"

    @patch("mcp_feedback_enhanced.utils.memory_monitor.psutil")
    def test_get_current_memory_info(self, mock_psutil):
        """测试获取当前内存信息"""
        # 仿真 psutil 返回值
        mock_virtual_memory = Mock()
        mock_virtual_memory.total = 8 * 1024**3
        mock_virtual_memory.available = 4 * 1024**3
        mock_virtual_memory.used = 4 * 1024**3
        mock_virtual_memory.percent = 50.0

        mock_memory_info = Mock()
        mock_memory_info.rss = 100 * 1024**2
        mock_memory_info.vms = 200 * 1024**2

        mock_process = Mock()
        mock_process.memory_info.return_value = mock_memory_info
        mock_process.memory_percent.return_value = 1.25

        mock_psutil.virtual_memory.return_value = mock_virtual_memory
        mock_psutil.Process.return_value = mock_process

        monitor = MemoryMonitor()
        info = monitor.get_current_memory_info()

        assert "system" in info
        assert "process" in info
        assert info["system"]["total_gb"] == 8.0
        assert info["system"]["usage_percent"] == 50.0
        assert info["process"]["rss_mb"] == 100.0
        assert info["status"] == "normal"

    def test_memory_stats_calculation(self):
        """测试内存统计计算"""
        monitor = MemoryMonitor()
        monitor.start_time = datetime.now() - timedelta(minutes=5)

        # 添加一些测试快照
        base_time = datetime.now()
        for i in range(5):
            snapshot = MemorySnapshot(
                timestamp=base_time + timedelta(seconds=i * 30),
                system_total=8 * 1024**3,
                system_available=4 * 1024**3,
                system_used=4 * 1024**3,
                system_percent=50.0 + i * 5,  # 50%, 55%, 60%, 65%, 70%
                process_rss=100 * 1024**2,
                process_vms=200 * 1024**2,
                process_percent=1.0 + i * 0.2,  # 1.0%, 1.2%, 1.4%, 1.6%, 1.8%
                gc_objects=10000,
            )
            monitor.snapshots.append(snapshot)

        # 添加一些警告
        monitor.alerts.append(
            MemoryAlert(
                level="warning",
                message="Test warning",
                timestamp=datetime.now(),
                memory_percent=85.0,
                recommended_action="Test action",
            )
        )

        monitor.cleanup_triggers_count = 2

        stats = monitor.get_memory_stats()

        assert stats.snapshots_count == 5
        assert stats.average_system_usage == 60.0  # (50+55+60+65+70)/5
        assert stats.peak_system_usage == 70.0
        assert stats.average_process_usage == 1.4  # (1.0+1.2+1.4+1.6+1.8)/5
        assert stats.peak_process_usage == 1.8
        assert stats.alerts_count == 1
        assert stats.cleanup_triggers == 2
        assert stats.monitoring_duration > 0

    def test_export_memory_data(self):
        """测试内存数据导出"""
        monitor = MemoryMonitor()

        # 添加一些测试数据
        monitor.alerts.append(
            MemoryAlert(
                level="warning",
                message="Test warning",
                timestamp=datetime.now(),
                memory_percent=85.0,
                recommended_action="Test action",
            )
        )

        with patch.object(monitor, "get_current_memory_info") as mock_info:
            mock_info.return_value = {
                "system": {"usage_percent": 75.0},
                "status": "warning",
            }

            exported_data = monitor.export_memory_data()

            assert "config" in exported_data
            assert "current_info" in exported_data
            assert "stats" in exported_data
            assert "recent_alerts" in exported_data
            assert "is_monitoring" in exported_data

            assert exported_data["config"]["warning_threshold"] == 0.8
            assert len(exported_data["recent_alerts"]) == 1


def test_global_memory_monitor_singleton():
    """测试全域内存监控器单例模式"""
    monitor1 = get_memory_monitor()
    monitor2 = get_memory_monitor()

    assert monitor1 is monitor2
    assert isinstance(monitor1, MemoryMonitor)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
