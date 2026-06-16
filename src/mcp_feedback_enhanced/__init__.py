#!/usr/bin/env python3
"""
Feedback Angel (Interactive Feedback MCP)
==========================================

交互式用户回馈 MCP 服务器，提供 AI 辅助开发中的回馈收集功能。
Forked from MCP Feedback Enhanced (https://github.com/Minidoracat/mcp-feedback-enhanced)

原始作者: Fábio Ferreira
增强功能: Web UI 支持、图片上传、现代化界面设计

特色：
- Web UI 接口支持
- 智能环境检测
- 命令运行功能
- 图片上传支持
- 现代化深色主题
- 重构的模块化架构
"""

__version__ = "2.6.6"
__author__ = "Minidoracat"
__email__ = "minidora0702@gmail.com"

import os

from .server import main as run_server

# 导入新的 Web UI 模块
from .web import WebUIManager, get_web_ui_manager, launch_web_feedback_ui, stop_web_ui


# 保持向后兼容性
feedback_ui = None

# 主要导出接口
__all__ = [
    "WebUIManager",
    "__author__",
    "__version__",
    "feedback_ui",
    "get_web_ui_manager",
    "launch_web_feedback_ui",
    "run_server",
    "stop_web_ui",
]


def main():
    """主要入口点，用于 uvx 运行"""
    from .__main__ import main as cli_main

    return cli_main()
