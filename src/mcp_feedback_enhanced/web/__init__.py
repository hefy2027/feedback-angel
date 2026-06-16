#!/usr/bin/env python3
"""
MCP Feedback Enhanced Web UI 模块

基于 FastAPI 和 WebSocket 的 Web 用户接口，提供丰富的交互回馈功能。
支持文本输入、图片上传、命令运行等功能，设计采用现代化的 Web UI 架构。

主要功能：
- FastAPI Web 应用程序
- WebSocket 实时通信
- 多语言国际化支持
- 图片上传与预览
- 命令运行与结果展示
- 响应式设计
- 本地和远程环境适配
"""

from .main import WebUIManager, get_web_ui_manager, launch_web_feedback_ui, stop_web_ui


__all__ = [
    "WebUIManager",
    "get_web_ui_manager",
    "launch_web_feedback_ui",
    "stop_web_ui",
]
