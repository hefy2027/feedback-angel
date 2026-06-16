# API 参考文档

本文档提供 MCP Feedback Enhanced 的完整 API 参考，包括 MCP 工具、Web API、WebSocket 通信协议和内部 API 接口。

## 📡 MCP 工具 API

MCP Feedback Enhanced 基于 FastMCP 框架实现，提供标准的 MCP 协议支持。

### interactive_feedback

AI 助手与用户进行交互式回馈的内核 MCP 工具。

#### 函数签名
```python
async def interactive_feedback(
    project_directory: str,
    summary: str,
    timeout: int = 600
) -> dict
```

#### 参数说明

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `project_directory` | `str` | ✅ | - | 项目目录路径，用于上下文显示 |
| `summary` | `str` | ✅ | - | AI 助手的工作摘要，向用户说明当前状态 |
| `timeout` | `int` | ❌ | `600` | 等待用户回馈的超时时间（秒） |

#### 返回值
```python
{
    "command_logs": "",  # 命令运行日志（保留字段）
    "interactive_feedback": str,  # 用户回馈内容
    "images": List[str]  # 用户上传的图片（Base64 编码）
}
```

#### 使用示例
```python
# 基本调用
result = await interactive_feedback(
    project_directory="./my-web-app",
    summary="我已完成登录功能的实现，包括表单验证和错误处理。请检查代码品质。"
)

# 自定义超时
result = await interactive_feedback(
    project_directory="./complex-project",
    summary="重构完成，请详细测试所有功能模块。",
    timeout=1200  # 20分钟
)
```

#### 错误处理
```python
try:
    result = await interactive_feedback(...)
except TimeoutError:
    print("用户回馈超时")
except ValidationError as e:
    print(f"参数验证错误: {e}")
except EnvironmentError as e:
    print(f"环境检测错误: {e}")
```

## 🌐 Web API

### HTTP 端点

#### GET /
主页重定向到回馈页面。

**响应**: `302 Redirect` → `/feedback`

#### GET /feedback
回馈页面主入口。

**响应**: `200 OK`
```html
<!DOCTYPE html>
<html>
<!-- 回馈页面 HTML 内容 -->
</html>
```

#### GET /static/{path}
静态资源服务（CSS、JS、图片等）。

**参数**:
- `path`: 静态资源路径

**响应**: `200 OK` 或 `404 Not Found`

#### GET /api/translations
获取多语言翻译资源。

**响应**: `200 OK`
```json
{
    "zh-TW": {
        "app": {
            "title": "MCP Feedback Enhanced"
        }
    },
    "en": {
        "app": {
            "title": "MCP Feedback Enhanced"
        }
    },
    "zh-CN": {
        "app": {
            "title": "MCP Feedback Enhanced"
        }
    }
}
```

#### GET /api/session-status
获取当前会话状态。

**响应**: `200 OK`
```json
{
    "has_session": true,
    "status": "active",
    "session_info": {
        "project_directory": "./my-project",
        "summary": "代码审查完成",
        "feedback_completed": false
    }
}
```

#### GET /api/current-session
获取当前会话详细信息。

**响应**: `200 OK`
```json
{
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_directory": "./my-project",
    "summary": "代码审查完成",
    "feedback_completed": false,
    "command_logs": "",
    "images_count": 0
}
```

**错误响应**: `404 Not Found`
```json
{
    "error": "没有活跃会话"
}
```

### WebSocket API

#### 连接端点
```
ws://localhost:{port}/ws
```

#### 消息格式
所有 WebSocket 消息都使用 JSON 格式：
```json
{
    "type": "message_type",
    "data": { /* 消息数据 */ },
    "timestamp": "2024-12-XX 10:30:00"
}
```

### 📤 客户端 → 服务器消息

#### submit_feedback
提交用户回馈。

```json
{
    "type": "submit_feedback",
    "data": {
        "feedback": "这个功能很好，但建议增加输入验证。",
        "images": [
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
        ],
        "settings": {
            "language": "zh-TW",
            "compress_images": true
        }
    }
}
```

**字段说明**:
- `feedback`: 用户回馈文本内容
- `images`: 图片数组（Base64 编码）
- `settings.language`: 界面语言
- `settings.compress_images`: 是否压缩略图片

#### heartbeat
心跳检测消息。

```json
{
    "type": "heartbeat",
    "data": {
        "timestamp": 1703123456789
    }
}
```

#### language_switch
切换界面语言。

```json
{
    "type": "language_switch",
    "data": {
        "language": "en"
    }
}
```

#### prompt_management
提示词管理操作。

```json
{
    "type": "prompt_management",
    "data": {
        "action": "add|update|delete|use",
        "prompt": {
            "id": "prompt_1_1703123456789",
            "name": "代码审查提示",
            "content": "请检查这段代码的逻辑正确性和性能优化建议。",
            "isAutoSubmit": false
        }
    }
}
```

**字段说明**:
- `action`: 操作类型（add=添加, update=更新, delete=删除, use=使用）
- `prompt.id`: 提示词唯一标识符
- `prompt.name`: 提示词名称
- `prompt.content`: 提示词内容
- `prompt.isAutoSubmit`: 是否为自动提交提示词

#### auto_submit_control
自动提交功能控制。

```json
{
    "type": "auto_submit_control",
    "data": {
        "action": "start|stop|update_settings",
        "settings": {
            "enabled": true,
            "timeout": 30,
            "promptId": "prompt_1_1703123456789"
        }
    }
}
```

**字段说明**:
- `action`: 控制动作（start=启动, stop=停止, update_settings=更新设置）
- `settings.enabled`: 是否激活自动提交
- `settings.timeout`: 自动提交倒数时间（秒）
- `settings.promptId`: 自动提交使用的提示词 ID

#### session_management（v2.4.3 重构增强）
会话管理操作。

```json
{
    "type": "session_management",
    "data": {
        "action": "get_history|get_stats|clear_history|export_history|view_details",
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "options": {
            "retentionHours": 72,
            "privacyLevel": "full",
            "includeUserMessages": true
        }
    }
}
```

**字段说明**:
- `action`: 管理动作（get_history=获取历史, get_stats=获取统计, clear_history=清除历史, export_history=导出历史, view_details=查看详情）
- `sessionId`: 会话 ID（可选）
- `options.retentionHours`: 历史保存时间（小时）
- `options.privacyLevel`: 隐私等级（full=完整, basic=基本, disabled=停用）
- `options.includeUserMessages`: 是否包含用户消息记录

#### audio_management（v2.4.3 添加）
音效管理操作。

```json
{
    "type": "audio_management",
    "data": {
        "action": "update_settings|test_audio|upload_custom|delete_custom",
        "settings": {
            "enabled": true,
            "volume": 75,
            "selectedAudioId": "notification-ding"
        },
        "customAudio": {
            "id": "custom_1_1703123456789",
            "name": "自订提示音",
            "data": "data:audio/mp3;base64,//uQx...",
            "mimeType": "audio/mp3"
        }
    }
}
```

**字段说明**:
- `action`: 操作类型（update_settings=更新设置, test_audio=测试播放, upload_custom=上传自订音效, delete_custom=删除自订音效）
- `settings.enabled`: 是否激活音效通知
- `settings.volume`: 音量（0-100）
- `settings.selectedAudioId`: 选中的音效 ID
- `customAudio`: 自订音效数据

#### height_management（v2.4.3 添加）
输入框高度管理。

```json
{
    "type": "height_management",
    "data": {
        "action": "save_height|load_height",
        "elementId": "combinedFeedbackText",
        "height": 200,
        "settingKey": "combinedFeedbackTextHeight"
    }
}
```

**字段说明**:
- `action`: 操作类型（save_height=保存高度, load_height=加载高度）
- `elementId`: 元素 ID
- `height`: 高度值（像素）
- `settingKey`: 设置键名

### 📥 服务器 → 客户端消息

#### connection_established
WebSocket 连接创建确认。

```json
{
    "type": "connection_established",
    "data": {
        "session_id": "550e8400-e29b-41d4-a716-446655440000",
        "server_time": "2024-12-XX 10:30:00"
    }
}
```

#### session_updated
会话更新通知（AI 再次调用时）。

```json
{
    "type": "session_updated",
    "data": {
        "session_id": "new-session-id",
        "summary": "根据您的建议，我已修改了错误处理逻辑。",
        "project_directory": "./my-project",
        "timestamp": "2024-12-XX 10:35:00"
    }
}
```

#### feedback_received
回馈接收确认。

```json
{
    "type": "feedback_received",
    "data": {
        "session_id": "session-id",
        "status": "success",
        "message": "回馈已成功接收"
    }
}
```

#### status_update
状态更新通知。

```json
{
    "type": "status_update",
    "data": {
        "status": "FEEDBACK_PROCESSING",
        "message": "正在处理您的回馈...",
        "progress": 50
    }
}
```

#### auto_submit_status
自动提交状态更新。

```json
{
    "type": "auto_submit_status",
    "data": {
        "enabled": true,
        "countdown": 25,
        "promptId": "prompt_1_1703123456789",
        "promptName": "代码审查提示"
    }
}
```

**字段说明**:
- `enabled`: 自动提交是否激活
- `countdown`: 剩余倒数时间（秒）
- `promptId`: 当前自动提交提示词 ID
- `promptName`: 当前自动提交提示词名称

#### session_history（v2.4.3 增强）
会话历史数据。

```json
{
    "type": "session_history",
    "data": {
        "sessions": [
            {
                "session_id": "session-1",
                "summary": "代码审查完成",
                "status": "completed",
                "created_at": "2024-12-13T10:30:00Z",
                "completed_at": "2024-12-13T10:35:00Z",
                "feedback_length": 150,
                "user_messages": [
                    {
                        "timestamp": "2024-12-13T10:32:00Z",
                        "content": "代码看起来不错",
                        "type": "text",
                        "submission_method": "manual"
                    }
                ],
                "project_directory": "./my-project"
            }
        ],
        "stats": {
            "total": 10,
            "completed": 8,
            "average_feedback_length": 120,
            "today_count": 3,
            "average_duration": 300
        },
        "retention_info": {
            "retention_hours": 72,
            "oldest_session": "2024-12-11T10:30:00Z",
            "cleanup_count": 2
        }
    }
}
```

#### audio_notification（v2.4.3 添加）
音效通知触发。

```json
{
    "type": "audio_notification",
    "data": {
        "trigger": "session_updated",
        "audioId": "notification-ding",
        "volume": 75,
        "timestamp": "2024-12-13T10:30:00Z"
    }
}
```

**字段说明**:
- `trigger`: 触发事件（session_updated=会话更新, feedback_received=回馈接收）
- `audioId`: 播放的音效 ID
- `volume`: 播放音量
- `timestamp`: 触发时间

#### audio_settings_update（v2.4.3 添加）
音效设置更新通知。

```json
{
    "type": "audio_settings_update",
    "data": {
        "settings": {
            "enabled": true,
            "volume": 75,
            "selectedAudioId": "soft-chime"
        },
        "availableAudios": [
            {
                "id": "default-beep",
                "name": "经典提示音",
                "isDefault": true
            },
            {
                "id": "custom_1",
                "name": "自订音效1",
                "isDefault": false
            }
        ]
    }
}
```

#### height_settings_update（v2.4.3 添加）
高度设置更新通知。

```json
{
    "type": "height_settings_update",
    "data": {
        "elementId": "combinedFeedbackText",
        "height": 200,
        "saved": true,
        "timestamp": "2024-12-13T10:30:00Z"
    }
}
```

#### error
错误消息。

```json
{
    "type": "error",
    "data": {
        "error_code": "VALIDATION_ERROR",
        "message": "回馈内容不能为空",
        "details": {
            "field": "feedback",
            "value": ""
        }
    }
}
```

## 🔧 内部 API

### WebUIManager API

#### create_session()
```python
async def create_session(
    self,
    summary: str,
    project_directory: str
) -> WebFeedbackSession
```

创建新的回馈会话。

#### smart_open_browser()
```python
async def smart_open_browser(self, url: str) -> bool
```

智能打开浏览器，避免重复打开。

**返回值**:
- `True`: 检测到活跃标签页，未打开新窗口
- `False`: 打开了新浏览器窗口

### WebFeedbackSession API

#### submit_feedback()
```python
async def submit_feedback(
    self,
    feedback: str,
    images: List[str],
    settings: dict
) -> None
```

提交用户回馈到会话。

#### wait_for_feedback()
```python
async def wait_for_feedback(self, timeout: int = 600) -> dict
```

等待用户回馈完成。

#### add_websocket()
```python
def add_websocket(self, websocket: WebSocket) -> None
```

添加 WebSocket 连接到会话。

### PromptManager API

#### addPrompt()
```python
def addPrompt(self, name: str, content: str) -> dict
```

添加提示词到管理器。

**参数**:
- `name`: 提示词名称（必须唯一）
- `content`: 提示词内容

**返回值**: 新建的提示词对象

#### updatePrompt()
```python
def updatePrompt(self, id: str, name: str, content: str) -> dict
```

更新现有提示词。

#### deletePrompt()
```python
def deletePrompt(self, id: str) -> bool
```

删除指定提示词。

#### usePrompt()
```python
def usePrompt(self, id: str) -> dict
```

使用提示词（更新最近使用记录）。

#### getPromptsSortedByUsage()
```python
def getPromptsSortedByUsage(self) -> List[dict]
```

获取按使用频率排序的提示词列表，自动提交提示词优先显示。

### SessionManager API（v2.4.3 重构增强）

#### getCurrentSession()
```python
def getCurrentSession(self) -> dict
```

获取当前活跃会话信息。

#### getSessionHistory()
```python
def getSessionHistory(self, retentionHours: int = 72) -> List[dict]
```

获取会话历史记录，支持保存期限过滤。

#### getSessionStats()
```python
def getSessionStats(self) -> dict
```

获取会话统计信息，包含今日统计和平均时长。

#### exportSessionHistory()
```python
def exportSessionHistory(self, format: str = "json") -> str
```

导出会话历史数据。

**参数**:
- `format`: 导出格式（json, csv）

#### cleanupExpiredSessions()
```python
def cleanupExpiredSessions(self, retentionHours: int = 72) -> int
```

清理过期会话记录。

**返回值**: 清理的会话数量

### AudioManager API（v2.4.3 添加）

#### playNotification()
```python
def playNotification(self) -> None
```

播放通知音效。

#### updateSettings()
```python
def updateSettings(self, enabled: bool, volume: int, selectedAudioId: str) -> None
```

更新音效设置。

#### addCustomAudio()
```python
def addCustomAudio(self, name: str, audioData: str, mimeType: str) -> dict
```

添加自订音效。

**参数**:
- `name`: 音效名称
- `audioData`: Base64 编码的音效数据
- `mimeType`: MIME 类型（audio/mp3, audio/wav, audio/ogg）

#### deleteCustomAudio()
```python
def deleteCustomAudio(self, audioId: str) -> bool
```

删除自订音效。

#### getAllAudios()
```python
def getAllAudios(self) -> List[dict]
```

获取所有可用音效（内置 + 自订）。

### TextareaHeightManager API（v2.4.3 添加）

#### registerTextarea()
```python
def registerTextarea(self, elementId: str, settingKey: str) -> bool
```

注册 textarea 元素进行高度管理。

#### saveHeight()
```python
def saveHeight(self, elementId: str, height: int) -> None
```

保存 textarea 高度到设置。

#### loadHeight()
```python
def loadHeight(self, elementId: str) -> int
```

从设置加载 textarea 高度。

#### unregisterTextarea()
```python
def unregisterTextarea(self, elementId: str) -> None
```

取消注册 textarea 元素。

### AutoSubmitManager API

#### start()
```python
def start(self, timeoutSeconds: int, promptId: str) -> None
```

启动自动提交倒数计时器。

#### stop()
```python
def stop(self) -> None
```

停止自动提交倒数计时器。

#### updateSettings()
```python
def updateSettings(self, enabled: bool, timeout: int, promptId: str) -> None
```

更新自动提交设置。

## 📊 状态码和错误码

### HTTP 状态码
- `200 OK`: 请求成功
- `302 Found`: 重定向
- `404 Not Found`: 资源不存在
- `500 Internal Server Error`: 服务器内部错误

### WebSocket 错误码
```python
class ErrorCodes:
    VALIDATION_ERROR = "VALIDATION_ERROR"
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"
    PROCESSING_ERROR = "PROCESSING_ERROR"
    CONNECTION_ERROR = "CONNECTION_ERROR"
```

### 会话状态
```python
class SessionStatus:
    WAITING = "FEEDBACK_WAITING"
    PROCESSING = "FEEDBACK_PROCESSING"
    SUBMITTED = "FEEDBACK_SUBMITTED"
    ERROR = "ERROR"
```

### 提示词状态
```python
class PromptStatus:
    ACTIVE = "active"           # 活跃提示词
    AUTO_SUBMIT = "auto_submit" # 自动提交提示词
    ARCHIVED = "archived"       # 已归档提示词
```

### 自动提交状态
```python
class AutoSubmitStatus:
    DISABLED = "disabled"       # 已停用
    ENABLED = "enabled"         # 已激活
    COUNTDOWN = "countdown"     # 倒数计时中
    COMPLETED = "completed"     # 已完成提交
```

### 音效通知状态（v2.4.3 添加）
```python
class AudioNotificationStatus:
    DISABLED = "disabled"       # 已停用
    ENABLED = "enabled"         # 已激活
    PLAYING = "playing"         # 播放中
    ERROR = "error"             # 播放错误
```

### 会话历史状态（v2.4.3 添加）
```python
class SessionHistoryStatus:
    ACTIVE = "active"           # 活跃会话
    COMPLETED = "completed"     # 已完成会话
    EXPIRED = "expired"         # 已过期会话
    ARCHIVED = "archived"       # 已归档会话
```

### 隐私等级（v2.4.3 添加）
```python
class PrivacyLevel:
    FULL = "full"               # 完整记录
    BASIC = "basic"             # 基本记录
    DISABLED = "disabled"       # 停用记录
```

## 🔒 安全考虑

### 输入验证
- 回馈内容长度限制：最大 10,000 字符
- 图片大小限制：单张最大 5MB
- 图片数量限制：最多 10 张
- 支持的图片格式：PNG, JPEG, GIF, WebP
- 提示词名称长度限制：最大 100 字符
- 提示词内容长度限制：最大 5,000 字符
- 提示词数量限制：最多 50 个
- **音效文档限制（v2.4.3 添加）**：
  - 支持格式：MP3, WAV, OGG
  - 单个文档最大：2MB
  - 自订音效数量：最多 20 个
  - 音效名称长度：最大 50 字符
- **会话历史限制（v2.4.3 添加）**：
  - 缺省保存期限：72 小时
  - 最大保存期限：168 小时（7天）
  - 单个会话最大用户消息数：100 条

### 资源保护
- WebSocket 连接数限制：每会话最多 5 个连接
- 会话超时自动清理
- 内存使用监控和限制

### 跨域设置
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境，生产环境应限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📚 相关文档

- **[系统架构总览](./system-overview.md)** - 了解整体架构设计理念和技术栈
- **[组件详细说明](./component-details.md)** - 深入了解各层组件的具体实现
- **[交互流程文档](./interaction-flows.md)** - 详细的用户交互和系统流程
- **[部署指南](./deployment-guide.md)** - 环境配置和部署最佳实践

---

**版本**: 2.4.3
**最后更新**: 2025年6月14日
**维护者**: Minidoracat
**API 版本**: v1
**协议支持**: MCP 2.0+, WebSocket, HTTP/1.1, Web Audio API
**v2.4.3 新功能**: 音效通知系统、会话管理重构、智能记忆功能、一键拷贝
**历史功能**: 自动提交、提示词管理、会话管理、语系切换优化
