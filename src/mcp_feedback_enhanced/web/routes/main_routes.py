#!/usr/bin/env python3
"""
主要路由处理
============

设置 Web UI 的主要路由和处理逻辑。
"""

import json
import time
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import File, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from ... import __version__
from ...debug import web_debug_log as debug_log
from ..constants import get_message_code as get_msg_code


if TYPE_CHECKING:
    from ..main import WebUIManager


def load_user_layout_settings() -> str:
    """加载用户的布局模式设置"""
    try:
        # 使用统一的设置文件路径
        config_dir = Path.home() / ".config" / "mcp-feedback-enhanced"
        settings_file = config_dir / "ui_settings.json"

        if settings_file.exists():
            with open(settings_file, encoding="utf-8") as f:
                settings = json.load(f)
                layout_mode = settings.get("layoutMode", "combined-vertical")
                debug_log(f"从设置文件加载布局模式: {layout_mode}")
                # 修复 no-any-return 错误 - 确保返回 str 类型
                return str(layout_mode)
        else:
            debug_log("设置文件不存在，使用缺省布局模式: combined-vertical")
            return "combined-vertical"
    except Exception as e:
        debug_log(f"加载布局设置失败: {e}，使用缺省布局模式: combined-vertical")
        return "combined-vertical"


# 使用统一的消息代码系统
# 从 ..constants 导入的 get_msg_code 函数会处理所有消息代码
# 旧的 key 会自动映射到新的常量


def setup_routes(manager: "WebUIManager"):
    """设置路由"""

    @manager.app.get("/", response_class=HTMLResponse)
    async def index(request: Request):
        """统一回馈页面 — 多会话模式"""
        waiting = manager.get_waiting_sessions()

        if not waiting:
            # 没有等待中的会话时，仍然显示 feedback.html 保持上一次的界面
            layout_mode = load_user_layout_settings()
            return manager.templates.TemplateResponse(
                request,
                "feedback.html",
                context={
                    "project_directory": ".",
                    "summary": "",
                    "title": "Interactive Feedback - 回馈收集",
                    "version": __version__,
                    "has_session": False,
                    "layout_mode": layout_mode,
                    "session_id": "",
                },
            )

        # 使用最近创建的等待会话作为初始渲染
        latest = waiting[-1]
        layout_mode = load_user_layout_settings()

        return manager.templates.TemplateResponse(
            request,
            "feedback.html",
            context={
                "project_directory": latest.project_directory,
                "summary": latest.summary,
                "title": "Interactive Feedback - 回馈收集",
                "version": __version__,
                "has_session": True,
                "layout_mode": layout_mode,
                "session_id": latest.session_id,
            },
        )

    @manager.app.get("/api/translations")
    async def get_translations():
        """获取翻译数据 - 从 Web 专用翻译文件加载"""
        translations = {}

        # 获取 Web 翻译文件目录
        web_locales_dir = Path(__file__).parent.parent / "locales"
        supported_languages = ["zh-TW", "zh-CN", "en"]

        for lang_code in supported_languages:
            lang_dir = web_locales_dir / lang_code
            translation_file = lang_dir / "translation.json"

            try:
                if translation_file.exists():
                    with open(translation_file, encoding="utf-8") as f:
                        lang_data = json.load(f)
                        translations[lang_code] = lang_data
                        debug_log(f"成功加载 Web 翻译: {lang_code}")
                else:
                    debug_log(f"Web 翻译文件不存在: {translation_file}")
                    translations[lang_code] = {}
            except Exception as e:
                debug_log(f"加载 Web 翻译文件失败 {lang_code}: {e}")
                translations[lang_code] = {}

        debug_log(f"Web 翻译 API 返回 {len(translations)} 种语言的数据")
        return JSONResponse(content=translations)

    @manager.app.get("/api/waiting-sessions")
    async def get_waiting_sessions():
        """获取所有等待中的会话"""
        sessions_data = []
        for s in manager.get_waiting_sessions():
            sessions_data.append({
                "session_id": s.session_id,
                "project_directory": s.project_directory,
                "summary": s.summary,
                "status": s.status.value,
                "created_at": int(s.created_at * 1000),
            })
        sessions_data.sort(key=lambda x: x["created_at"], reverse=True)
        return JSONResponse(content={"sessions": sessions_data})

    @manager.app.get("/api/session-status")
    async def get_session_status(request: Request):
        """获取当前会话状态（兼容旧代码）"""
        current_session = manager.get_current_session()

        # 从请求头获取客户端语言
        lang = (
            request.headers.get("Accept-Language", "zh-TW").split(",")[0].split("-")[0]
        )
        if lang == "zh":
            lang = "zh-TW"

        if not current_session:
            return JSONResponse(
                content={
                    "has_session": False,
                    "status": "no_session",
                    "messageCode": get_msg_code("no_active_session"),
                }
            )

        return JSONResponse(
            content={
                "has_session": True,
                "status": "active",
                "session_info": {
                    "project_directory": current_session.project_directory,
                    "summary": current_session.summary,
                    "feedback_completed": current_session.feedback_completed.is_set(),
                },
            }
        )

    @manager.app.get("/api/current-session")
    async def get_current_session(request: Request):
        """获取当前会话详细信息"""
        current_session = manager.get_current_session()

        # 从查找参数获取语言，如果没有则从会话获取，最后使用默认值

        if not current_session:
            return JSONResponse(
                status_code=404,
                content={
                    "error": "No active session",
                    "messageCode": get_msg_code("no_active_session"),
                },
            )

        return JSONResponse(
            content={
                "session_id": current_session.session_id,
                "project_directory": current_session.project_directory,
                "summary": current_session.summary,
                "feedback_completed": current_session.feedback_completed.is_set(),
                "command_logs": current_session.command_logs,
                "images_count": len(current_session.images),
            }
        )

    @manager.app.get("/api/all-sessions")
    async def get_all_sessions(request: Request):
        """获取所有会话的实时状态"""

        try:
            sessions_data = []

            # 获取所有会话的实时状态
            for session_id, session in manager.sessions.items():
                session_info = {
                    "session_id": session.session_id,
                    "project_directory": session.project_directory,
                    "summary": session.summary,
                    "status": session.status.value,
                    "status_message": session.status_message,
                    "created_at": int(session.created_at * 1000),  # 转换为毫秒
                    "last_activity": int(session.last_activity * 1000),
                    "feedback_completed": session.feedback_completed.is_set(),
                    "has_websocket": session.websocket is not None,
                    "is_current": session == manager.get_current_session(),
                    "user_messages": session.user_messages,  # 包含用户消息记录
                }
                sessions_data.append(session_info)

            # 按创建时间排序（最新的在前）
            sessions_data.sort(key=lambda x: x["created_at"], reverse=True)

            debug_log(f"返回 {len(sessions_data)} 个会话的实时状态")
            return JSONResponse(content={"sessions": sessions_data})

        except Exception as e:
            debug_log(f"获取所有会话状态失败: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "error": f"Failed to get sessions: {e!s}",
                    "messageCode": get_msg_code("get_sessions_failed"),
                },
            )

    @manager.app.post("/api/add-user-message")
    async def add_user_message(request: Request):
        """添加用户消息到会话"""

        try:
            data = await request.json()
            session_id = data.get("session_id")

            if session_id:
                session = manager.get_session(session_id)
            else:
                session = manager.get_current_session()

            if not session:
                return JSONResponse(
                    status_code=404,
                    content={
                        "error": "No active session",
                        "messageCode": get_msg_code("no_active_session"),
                    },
                )

            session.add_user_message(data)

            debug_log(f"用户消息已添加到会话 {session.session_id}")
            return JSONResponse(
                content={
                    "status": "success",
                    "messageCode": get_msg_code("user_message_recorded"),
                }
            )

        except Exception as e:
            debug_log(f"添加用户消息失败: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "error": f"Failed to add user message: {e!s}",
                    "messageCode": get_msg_code("add_user_message_failed"),
                },
            )

    @manager.app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket, lang: str = "zh-TW"):
        """WebSocket 端点 — 浏览器全局连接，消息按 session_id 路由"""
        from ..models import SessionStatus

        await websocket.accept()

        manager._browser_websocket = websocket
        debug_log("浏览器 WebSocket 连接已建立")

        # 发送连接成功 + 所有等待中的会话列表
        try:
            waiting_sessions = []
            for s in manager.get_waiting_sessions():
                waiting_sessions.append({
                    "session_id": s.session_id,
                    "project_directory": s.project_directory,
                    "summary": s.summary,
                    "status": s.status.value,
                    "created_at": int(s.created_at * 1000),
                })

            await websocket.send_json({
                "type": "connection_established",
                "messageCode": get_msg_code("websocket_connected"),
                "waiting_sessions": waiting_sessions,
            })

            # 兼容旧代码：如果有等待中的会话，也发送 status_update
            current = manager.get_current_session()
            if current:
                await websocket.send_json(
                    {"type": "status_update", "status_info": current.get_status_info()}
                )

        except Exception as e:
            debug_log(f"发送连接确认失败: {e}")

        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)

                msg_type = message.get("type")

                # 心跳是全局的，不需要 session_id
                if msg_type == "heartbeat":
                    # 同时更新所有等待中会话的心跳
                    for s in manager.get_waiting_sessions():
                        s.last_heartbeat = time.time()
                        s.last_activity = time.time()
                    await websocket.send_json({
                        "type": "heartbeat_response",
                        "timestamp": message.get("timestamp", 0),
                    })
                    continue

                # 其他消息需要 session_id 路由
                session_id = message.get("session_id")

                if not session_id:
                    # 兼容旧代码：没有 session_id 时使用最新的等待会话
                    current = manager.get_current_session()
                    if current:
                        session_id = current.session_id
                    else:
                        debug_log(f"消息缺少 session_id 且无等待会话: {msg_type}")
                        continue

                session = manager.get_session(session_id)
                if not session:
                    debug_log(f"找不到会话: {session_id}")
                    await websocket.send_json({
                        "type": "error",
                        "session_id": session_id,
                        "message": "Session not found",
                    })
                    continue

                await handle_websocket_message(manager, session, message, websocket)

        except WebSocketDisconnect:
            debug_log("浏览器 WebSocket 连接断开")
        except ConnectionResetError:
            debug_log("浏览器 WebSocket 连接被重置")
        except Exception as e:
            debug_log(f"WebSocket 错误: {e}")
        finally:
            if manager._browser_websocket == websocket:
                manager._browser_websocket = None
                debug_log("已清理浏览器 WebSocket 连接")

    @manager.app.post("/api/save-settings")
    async def save_settings(request: Request):
        """保存设置到文件"""

        try:
            data = await request.json()

            # 使用统一的设置文件路径
            config_dir = Path.home() / ".config" / "mcp-feedback-enhanced"
            config_dir.mkdir(parents=True, exist_ok=True)
            settings_file = config_dir / "ui_settings.json"

            # 保存设置到文件
            with open(settings_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            debug_log(f"设置已保存到: {settings_file}")

            return JSONResponse(
                content={
                    "status": "success",
                    "messageCode": get_msg_code("settings_saved"),
                }
            )

        except Exception as e:
            debug_log(f"保存设置失败: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": f"Save failed: {e!s}",
                    "messageCode": get_msg_code("save_failed"),
                },
            )

    @manager.app.get("/api/load-settings")
    async def load_settings(request: Request):
        """从文件加载设置"""

        try:
            # 使用统一的设置文件路径
            config_dir = Path.home() / ".config" / "mcp-feedback-enhanced"
            settings_file = config_dir / "ui_settings.json"

            if settings_file.exists():
                with open(settings_file, encoding="utf-8") as f:
                    settings = json.load(f)

                debug_log(f"设置已从文件加载: {settings_file}")
                return JSONResponse(content=settings)
            debug_log("设置文件不存在，返回空设置")
            return JSONResponse(content={})

        except Exception as e:
            debug_log(f"加载设置失败: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": f"Load failed: {e!s}",
                    "messageCode": get_msg_code("load_failed"),
                },
            )

    @manager.app.post("/api/clear-settings")
    async def clear_settings(request: Request):
        """清除设置文件"""

        try:
            # 使用统一的设置文件路径
            config_dir = Path.home() / ".config" / "mcp-feedback-enhanced"
            settings_file = config_dir / "ui_settings.json"

            if settings_file.exists():
                settings_file.unlink()
                debug_log(f"设置文件已删除: {settings_file}")
            else:
                debug_log("设置文件不存在，无需删除")

            return JSONResponse(
                content={
                    "status": "success",
                    "messageCode": get_msg_code("settings_cleared"),
                }
            )

        except Exception as e:
            debug_log(f"清除设置失败: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": f"Clear failed: {e!s}",
                    "messageCode": get_msg_code("clear_failed"),
                },
            )

    # ===== 图片文档存储模式 API =====

    @manager.app.get("/api/image-config")
    async def get_image_config():
        """返回当前图片模式配置"""
        from ...utils.image_storage import ImageStorageManager

        storage = ImageStorageManager.get_instance()
        return JSONResponse(
            content={
                "mode": "file" if storage.is_file_mode() else "base64",
                "image_mode": storage.image_mode,
                "upload_url": "/api/upload-image"
                if storage.is_file_mode()
                else None,
            }
        )

    @manager.app.post("/api/image-config")
    async def update_image_config(request: Request):
        """更新图片模式配置"""
        from ...utils.image_storage import ImageStorageManager

        try:
            data = await request.json()
            mode = data.get("mode", "base64")
            image_dir = data.get("image_dir")

            storage = ImageStorageManager.get_instance()
            result = storage.switch_mode(mode, image_dir)

            return JSONResponse(content={
                "success": True,
                **result,
                "upload_url": "/api/upload-image" if storage.is_file_mode() else None,
            })
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"error": str(e)},
            )

    @manager.app.post("/api/upload-image")
    async def upload_image(request: Request, image: UploadFile = File(...)):
        """上传图片文档（文档模式）"""
        from ...utils.image_storage import ImageStorageManager

        storage = ImageStorageManager.get_instance()
        if not storage.is_file_mode():
            return JSONResponse(
                status_code=400,
                content={
                    "error": "File mode not enabled",
                    "messageCode": "image.file_mode_disabled",
                },
            )

        # 从查询参数或表单中获取 session_id
        session_id = request.query_params.get("session_id")
        if session_id:
            session = manager.get_session(session_id)
        else:
            session = manager.get_current_session()

        if not session:
            return JSONResponse(
                status_code=404,
                content={
                    "error": "No active session",
                    "messageCode": get_msg_code("no_active_session"),
                },
            )

        data = await image.read()
        if not data:
            return JSONResponse(
                status_code=400,
                content={"error": "Empty file"},
            )

        result = storage.save_image(
            session.session_id,
            image.filename or "image.png",
            data,
        )
        result["url"] = storage.get_image_url(
            session.session_id, result["filename"]
        )
        result["status"] = "success"
        debug_log(
            f"图片上传成功: {result['filename']} ({result['size']} bytes)"
        )
        return JSONResponse(content=result)

    @manager.app.get("/api/images/{session_id}/{filename}")
    async def serve_image(session_id: str, filename: str):
        """提供图片文档服务"""
        from ...utils.image_storage import ImageStorageManager

        storage = ImageStorageManager.get_instance()
        if not storage.is_file_mode():
            return JSONResponse(
                status_code=404,
                content={"error": "File mode not enabled"},
            )

        image_path = storage.get_image_path(session_id, filename)
        if not image_path.exists():
            return JSONResponse(
                status_code=404,
                content={"error": "Image not found"},
            )

        # 路径遍历安全检查
        try:
            base = storage.base_dir
            if base:
                image_path.resolve().relative_to(base.resolve())
        except (ValueError, AttributeError):
            return JSONResponse(
                status_code=403,
                content={"error": "Access denied"},
            )

        return FileResponse(str(image_path))

    @manager.app.get("/api/load-session-history")
    async def load_session_history(request: Request):
        """从文件加载会话历史"""

        try:
            # 使用统一的设置文件路径
            config_dir = Path.home() / ".config" / "mcp-feedback-enhanced"
            history_file = config_dir / "session_history.json"

            if history_file.exists():
                with open(history_file, encoding="utf-8") as f:
                    history_data = json.load(f)

                debug_log(f"会话历史已从文件加载: {history_file}")

                # 确保数据格式兼容性
                if isinstance(history_data, dict):
                    # 新格式：包含版本信息和其他元数据
                    sessions = history_data.get("sessions", [])
                    last_cleanup = history_data.get("lastCleanup", 0)
                else:
                    # 旧格式：直接是会话数组（向后兼容）
                    sessions = history_data if isinstance(history_data, list) else []
                    last_cleanup = 0

                # 回传会话历史数据
                return JSONResponse(
                    content={"sessions": sessions, "lastCleanup": last_cleanup}
                )

            debug_log("会话历史文件不存在，返回空历史")
            return JSONResponse(content={"sessions": [], "lastCleanup": 0})

        except Exception as e:
            debug_log(f"加载会话历史失败: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": f"Load failed: {e!s}",
                    "messageCode": get_msg_code("load_failed"),
                },
            )

    @manager.app.post("/api/save-session-history")
    async def save_session_history(request: Request):
        """保存会话历史到文件"""

        try:
            data = await request.json()

            # 使用统一的设置文件路径
            config_dir = Path.home() / ".config" / "mcp-feedback-enhanced"
            config_dir.mkdir(parents=True, exist_ok=True)
            history_file = config_dir / "session_history.json"

            # 创建新格式的数据结构
            history_data = {
                "version": "1.0",
                "sessions": data.get("sessions", []),
                "lastCleanup": data.get("lastCleanup", 0),
                "savedAt": int(time.time() * 1000),  # 当前时间戳
            }

            # 保存会话历史到文件
            with open(history_file, "w", encoding="utf-8") as f:
                json.dump(history_data, f, ensure_ascii=False, indent=2)

            debug_log(f"会话历史已保存到: {history_file}")
            session_count = len(history_data["sessions"])
            debug_log(f"保存了 {session_count} 个会话记录")

            return JSONResponse(
                content={
                    "status": "success",
                    "messageCode": get_msg_code("session_history_saved"),
                    "params": {"count": session_count},
                }
            )

        except Exception as e:
            debug_log(f"保存会话历史失败: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": f"Save failed: {e!s}",
                    "messageCode": get_msg_code("save_failed"),
                },
            )

    @manager.app.get("/api/log-level")
    async def get_log_level(request: Request):
        """获取日志等级设置"""

        try:
            # 使用统一的设置文件路径
            config_dir = Path.home() / ".config" / "mcp-feedback-enhanced"
            settings_file = config_dir / "ui_settings.json"

            if settings_file.exists():
                with open(settings_file, encoding="utf-8") as f:
                    settings_data = json.load(f)
                    log_level = settings_data.get("logLevel", "INFO")
                    debug_log(f"从设置文件加载日志等级: {log_level}")
                    return JSONResponse(content={"logLevel": log_level})
            else:
                # 缺省日志等级
                default_log_level = "INFO"
                debug_log(f"使用缺省日志等级: {default_log_level}")
                return JSONResponse(content={"logLevel": default_log_level})

        except Exception as e:
            debug_log(f"获取日志等级失败: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "error": f"Failed to get log level: {e!s}",
                    "messageCode": get_msg_code("get_log_level_failed"),
                },
            )

    @manager.app.post("/api/log-level")
    async def set_log_level(request: Request):
        """设置日志等级"""

        try:
            data = await request.json()
            log_level = data.get("logLevel")

            if not log_level or log_level not in ["DEBUG", "INFO", "WARN", "ERROR"]:
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "Invalid log level",
                        "messageCode": get_msg_code("invalid_log_level"),
                    },
                )

            # 使用统一的设置文件路径
            config_dir = Path.home() / ".config" / "mcp-feedback-enhanced"
            config_dir.mkdir(parents=True, exist_ok=True)
            settings_file = config_dir / "ui_settings.json"

            # 加载现有设置或创建新设置
            settings_data = {}
            if settings_file.exists():
                with open(settings_file, encoding="utf-8") as f:
                    settings_data = json.load(f)

            # 更新日志等级
            settings_data["logLevel"] = log_level

            # 保存设置到文件
            with open(settings_file, "w", encoding="utf-8") as f:
                json.dump(settings_data, f, ensure_ascii=False, indent=2)

            debug_log(f"日志等级已设置为: {log_level}")

            return JSONResponse(
                content={
                    "status": "success",
                    "logLevel": log_level,
                    "messageCode": get_msg_code("log_level_updated"),
                }
            )

        except Exception as e:
            debug_log(f"设置日志等级失败: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": f"Set failed: {e!s}",
                    "messageCode": get_msg_code("set_failed"),
                },
            )


async def handle_websocket_message(
    manager: "WebUIManager", session, data: dict, websocket: WebSocket | None = None
):
    """处理 WebSocket 消息 — 通过参数传递 websocket"""
    message_type = data.get("type")
    ws = websocket or manager._browser_websocket

    if message_type == "submit_feedback":
        feedback = data.get("feedback", "")
        images = data.get("images", [])
        settings = data.get("settings", {})
        system_prompt = data.get("system_prompt", "")
        await session.submit_feedback(feedback, images, settings, system_prompt)

        # 通知前端此会话已完成
        if ws:
            try:
                await ws.send_json({
                    "type": "session_completed",
                    "session_id": session.session_id,
                })
            except Exception:
                pass

    elif message_type == "run_command":
        command = data.get("command", "")
        if command.strip():
            await session.run_command(command)

    elif message_type == "get_status":
        if ws:
            try:
                await ws.send_json({
                    "type": "status_update",
                    "session_id": session.session_id,
                    "status_info": session.get_status_info(),
                })
            except Exception as e:
                debug_log(f"发送状态更新失败: {e}")

    elif message_type == "user_timeout":
        debug_log(f"收到用户超时通知: {session.session_id}")
        await session._cleanup_resources_on_timeout()

    elif message_type == "pong":
        debug_log(f"收到 pong 回应，时间戳: {data.get('timestamp', 'N/A')}")

    elif message_type == "update_timeout_settings":
        settings = data.get("settings", {})
        debug_log(f"收到超时设置更新: {settings}")
        if settings.get("enabled"):
            session.update_timeout_settings(
                enabled=True, timeout_seconds=settings.get("seconds", 3600)
            )
        else:
            session.update_timeout_settings(enabled=False)

    else:
        debug_log(f"未知的消息类型: {message_type}")


async def _delayed_server_stop(manager: "WebUIManager"):
    """延迟停止服务器"""
    import asyncio

    await asyncio.sleep(5)  # 等待 5 秒让前端有时间关闭
    from ..main import stop_web_ui

    stop_web_ui()
    debug_log("Web UI 服务器已因用户超时而停止")
