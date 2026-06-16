#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试数据和常量
"""

from typing import Dict, Any, List


class TestData:
    """测试数据类"""

    # 测试会话数据
    SAMPLE_SESSION: Dict[str, Any] = {
        "session_id": "test-session-12345",
        "project_directory": "/test/project",
        "summary": "测试 AI 工作摘要 - 已完成代码重构",
        "status": "waiting",
        "timeout": 600
    }

    # 测试回馈数据
    SAMPLE_FEEDBACK: Dict[str, Any] = {
        "feedback": "测试回馈内容 - 代码看起来不错，请继续",
        "images": [],
        "settings": {
            "image_size_limit": 1024 * 1024,
            "enable_base64_detail": True
        }
    }
    
    # 测试图片数据（Base64 编码的小图片）
    SAMPLE_IMAGE_BASE64: str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

    # 测试 WebSocket 消息
    WEBSOCKET_MESSAGES: Dict[str, Dict[str, Any]] = {
        "connection_established": {
            "type": "connection_established",
            "message": "WebSocket 连接已创建"
        },
        "session_updated": {
            "type": "session_updated",
            "message": "新会话已创建，正在更新页面内容",
            "session_info": SAMPLE_SESSION
        },
        "feedback_received": {
            "type": "feedback_received",
            "message": "回馈已成功提交"
        },
        "status_update": {
            "type": "status_update",
            "status_info": {
                "session_id": "test-session-12345",
                "status": "waiting",
                "project_directory": "/test/project"
            }
        }
    }
    
    # I18N 测试数据
    I18N_TEST_KEYS: List[str] = [
        "common.submit",
        "common.cancel",
        "common.loading",
        "feedback.placeholder",
        "feedback.submit",
        "status.waiting",
        "status.processing",
        "error.connection",
        "error.timeout"
    ]

    # 支持的语言列表
    SUPPORTED_LANGUAGES: List[str] = ["zh-TW", "zh-CN", "en"]

    # 测试环境变量
    TEST_ENV_VARS: Dict[str, str] = {
        "MCP_DEBUG": "true",
        "MCP_WEB_PORT": "8765",
        "MCP_TEST_MODE": "true"
    }

    # 测试配置
    TEST_CONFIG: Dict[str, Dict[str, Any]] = {
        "web_ui": {
            "host": "127.0.0.1",
            "port": 0,  # 使用随机端口
            "timeout": 30
        },
        "mcp": {
            "timeout": 60,
            "retry_count": 3
        },
        "i18n": {
            "default_language": "zh-TW",
            "fallback_language": "en"
        }
    }


class MockResponses:
    """仿真回应数据"""
    
    @staticmethod
    def successful_feedback_response() -> Dict[str, Any]:
        """成功的回馈回应"""
        return {
            "command_logs": "$ echo 'test'\ntest\n",
            "interactive_feedback": "用户确认：功能正常运作",
            "images": []
        }
    
    @staticmethod
    def feedback_with_images_response() -> Dict[str, Any]:
        """包含图片的回馈回应"""
        return {
            "command_logs": "",
            "interactive_feedback": "请查看附加的截屏",
            "images": [
                {
                    "data": TestData.SAMPLE_IMAGE_BASE64,
                    "filename": "screenshot.png",
                    "size": 1024
                }
            ]
        }
    
    @staticmethod
    def timeout_response() -> Dict[str, Any]:
        """超时回应"""
        return {
            "command_logs": "",
            "interactive_feedback": "用户回馈超时，使用默认行为",
            "images": []
        }
    
    @staticmethod
    def error_response(error_message: str) -> Dict[str, Any]:
        """错误回应"""
        return {
            "error": error_message,
            "command_logs": "",
            "interactive_feedback": "",
            "images": []
        }
    
    @staticmethod
    def mcp_initialize_response() -> Dict[str, Any]:
        """MCP 初始化回应"""
        return {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {
                        "listChanged": True
                    }
                },
                "serverInfo": {
                    "name": "mcp-feedback-enhanced",
                    "version": "2.3.0"
                }
            }
        }
    
    @staticmethod
    def mcp_tools_list_response() -> Dict[str, Any]:
        """MCP 工具列表回应"""
        return {
            "jsonrpc": "2.0",
            "id": 2,
            "result": {
                "tools": [
                    {
                        "name": "interactive_feedback",
                        "description": "收集用户的交互回馈，支持文本和图片",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "project_directory": {
                                    "type": "string",
                                    "description": "项目目录路径"
                                },
                                "summary": {
                                    "type": "string", 
                                    "description": "AI 工作完成的摘要说明"
                                },
                                "timeout": {
                                    "type": "integer",
                                    "description": "等待用户回馈的超时时间（秒）"
                                }
                            }
                        }
                    }
                ]
            }
        }


class TestScenarios:
    """测试场景数据"""
    
    BASIC_WORKFLOW = {
        "name": "basic_workflow",
        "description": "基本 MCP 工作流程测试",
        "steps": [
            "启动 MCP 服务器",
            "初始化连接",
            "调用 interactive_feedback 工具",
            "验证回应格式"
        ],
        "expected_result": {
            "success": True,
            "has_feedback": True,
            "response_format_valid": True
        }
    }
    
    WEB_UI_TEST = {
        "name": "web_ui_startup",
        "description": "Web UI 启动测试",
        "steps": [
            "创建 WebUIManager",
            "启动 Web 服务器",
            "验证服务器可访问",
            "测试基本路由"
        ],
        "expected_result": {
            "server_started": True,
            "routes_accessible": True,
            "websocket_available": True
        }
    }
    
    I18N_TEST = {
        "name": "i18n_functionality",
        "description": "国际化功能测试",
        "steps": [
            "加载 I18N 管理器",
            "测试语言切换",
            "验证翻译完整性",
            "测试回退机制"
        ],
        "expected_result": {
            "languages_loaded": True,
            "translations_complete": True,
            "fallback_working": True
        }
    }
