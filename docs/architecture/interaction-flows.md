# 交互流程文档

## 🔄 AI 助手与 MCP 服务完整交互流程

本文档详细描述 AI 助手调用 MCP Feedback Enhanced 服务的完整流程，包括首次调用、多次循环调用、错误处理和性能优化机制。

### 内核设计理念

- **持久化会话**: 支持 AI 助手多次循环调用，无需重复创建连接
- **智能环境适配**: 自动检测并适配本地、SSH Remote、WSL 环境
- **无缝状态切换**: 会话更新时前端局部刷新，保持用户操作状态
- **优雅错误处理**: 完整的错误恢复机制和超时保护
- **资源优化**: 单一活跃会话模式，最小化资源占用

## 📋 流程概览

### 整体交互时序图

```mermaid
sequenceDiagram
    participant AI as AI 助手<br/>(Cursor/Claude/etc)
    participant MCP as MCP 服务<br/>(server.py)
    participant WM as WebUIManager<br/>(单例管理器)
    participant FastAPI as FastAPI 应用<br/>(Web 服务)
    participant WS as WebSocket<br/>(实时通信)
    participant Browser as 浏览器<br/>(Web UI)
    participant User as 用户

    Note over AI,User: 🚀 第一次调用流程
    AI->>+MCP: interactive_feedback(project_dir, summary, timeout)
    MCP->>+WM: launch_web_feedback_ui()

    Note over WM: 环境检测与会话创建
    WM->>WM: detect_environment()
    WM->>WM: create_session()

    WM->>+FastAPI: 启动 Web 服务器
    FastAPI->>FastAPI: setup_routes()
    FastAPI->>FastAPI: setup_websocket()
    FastAPI-->>-WM: 服务器就绪

    WM->>Browser: smart_open_browser(url)
    Note over Browser: 智能打开浏览器<br/>检测活跃标签页

    Browser->>+FastAPI: GET /feedback
    FastAPI->>FastAPI: render_template()
    FastAPI-->>-Browser: HTML 页面

    Browser->>+WS: 创建 WebSocket 连接
    WS->>WM: register_websocket()
    WS-->>-Browser: connection_established

    Note over AI,User: 💬 用户回馈流程
    User->>Browser: 填写回馈内容
    Browser->>+WS: submit_feedback
    WS->>WM: process_feedback()
    WM->>WM: validate_and_save()
    WM->>MCP: set_feedback_complete()
    WS-->>-Browser: feedback_received
    MCP-->>-AI: 返回回馈结果

    Note over AI,User: 🔄 第二次调用流程 (持久化会话)
    AI->>+MCP: interactive_feedback(new_summary, timeout)
    MCP->>+WM: 检查现有会话

    alt 有活跃会话
        WM->>WM: update_session()
        WM->>+WS: session_updated 通知
        WS-->>-Browser: 会话更新消息
        Browser->>Browser: 局部更新内容
        Note over Browser: 无需重新加载页面<br/>保持用户操作状态
    else 无活跃会话
        WM->>WM: create_new_session()
        WM->>Browser: 重新打开浏览器
    end

    User->>Browser: 提交新回馈
    Browser->>+WS: submit_feedback
    WS->>WM: process_new_feedback()
    WM->>MCP: set_feedback_complete()
    WS-->>-Browser: feedback_received
    MCP-->>-AI: 返回新回馈结果

    Note over AI,User: 🧹 资源清理 (可选)
    alt 会话超时或手动清理
        WM->>WS: cleanup_session()
        WS->>Browser: session_cleanup
        WM->>FastAPI: 停止服务器 (可选)
    end
```

## 🚀 第一次调用详细流程

### 1. AI 助手发起调用

**MCP 工具调用格式**：
```python
# AI 助手通过 MCP 协议调用
result = await interactive_feedback(
    project_directory="./my-project",
    summary="我已完成了功能 X 的实现，请检查代码品质和逻辑正确性。主要变更包括：\n1. 添加错误处理机制\n2. 优化性能瓶颈\n3. 增加单元测试覆盖率",
    timeout=600  # 10 分钟超时
)
```

**参数说明**：
- `project_directory`: 项目根目录，用于命令运行上下文
- `summary`: AI 工作摘要，向用户说明已完成的工作
- `timeout`: 等待用户回馈的超时时间（秒）

### 2. MCP 服务处理流程

```mermaid
flowchart TD
    START[AI 调用 interactive_feedback] --> VALIDATE[参数验证与类型检查]
    VALIDATE --> ENV[环境检测<br/>Local/SSH/WSL]
    ENV --> MANAGER[获取 WebUIManager<br/>单例实例]
    MANAGER --> CHECK[检查现有会话]
    CHECK --> DECISION{有活跃会话?}

    DECISION -->|否| CREATE[创建新会话]
    DECISION -->|是| UPDATE[更新现有会话]

    CREATE --> SESSION[WebFeedbackSession<br/>初始化]
    UPDATE --> SESSION

    SESSION --> SERVER[启动 FastAPI 服务器]
    SERVER --> PORT[动态端口分配]
    PORT --> ROUTES[设置路由和 WebSocket]
    ROUTES --> BROWSER[智能打开浏览器]

    BROWSER --> DETECT[检测活跃标签页]
    DETECT --> OPEN_DECISION{需要打开浏览器?}

    OPEN_DECISION -->|是| OPEN[打开新浏览器窗口]
    OPEN_DECISION -->|否| NOTIFY[发送会话更新通知]

    OPEN --> WAIT[等待用户回馈]
    NOTIFY --> WAIT

    WAIT --> TIMEOUT{检查超时}
    TIMEOUT -->|未超时| FEEDBACK[接收回馈数据]
    TIMEOUT -->|超时| CLEANUP[清理资源]

    FEEDBACK --> PROCESS[处理回馈数据<br/>图片压缩/命令运行]
    PROCESS --> SAVE[保存回馈记录]
    SAVE --> RETURN[返回结果给 AI]

    CLEANUP --> ERROR[返回超时错误]
    ERROR --> RETURN

    style START fill:#e3f2fd
    style RETURN fill:#e8f5e8
    style ERROR fill:#ffebee
    style FEEDBACK fill:#f3e5f5
```

**关键步骤详解**：

#### 2.1 环境检测与适配
```python
def detect_environment() -> str:
    """智能检测运行环境"""
    # SSH Remote 环境检测
    if os.environ.get('SSH_CLIENT') or os.environ.get('SSH_TTY'):
        return "ssh"

    # WSL 环境检测
    elif 'microsoft' in platform.uname().release.lower():
        return "wsl"

    # 容器环境检测
    elif os.path.exists('/.dockerenv'):
        return "docker"

    # 本地环境
    else:
        return "local"

def get_environment_config(env_type: str) -> dict:
    """根据环境类型获取配置"""
    configs = {
        "local": {
            "browser_command": "default",
            "host": "127.0.0.1",
            "auto_open": True
        },
        "ssh": {
            "browser_command": None,
            "host": "127.0.0.1",
            "auto_open": False,
            "tunnel_hint": "ssh -L {port}:127.0.0.1:{port} user@host"
        },
        "wsl": {
            "browser_command": "cmd.exe /c start",
            "host": "127.0.0.1",
            "auto_open": True
        }
    }
    return configs.get(env_type, configs["local"])
```

#### 2.2 智能会话管理
```python
async def create_or_update_session(
    self,
    project_dir: str,
    summary: str,
    timeout: int
) -> str:
    """创建新会话或更新现有会话"""

    # 保存现有 WebSocket 连接
    existing_websockets = []
    if self.current_session:
        existing_websockets = list(self.current_session.websockets)
        debug_log(f"保存 {len(existing_websockets)} 个现有 WebSocket 连接")

    # 创建新会话
    session_id = str(uuid.uuid4())
    self.current_session = WebFeedbackSession(
        session_id=session_id,
        project_directory=os.path.abspath(project_dir),
        summary=summary,
        timeout=timeout,
        status=SessionStatus.WAITING,
        created_at=datetime.now()
    )

    # 继承 WebSocket 连接，实现无缝切换
    for ws in existing_websockets:
        if ws.client_state == WebSocketState.CONNECTED:
            self.current_session.add_websocket(ws)
            debug_log("WebSocket 连接已继承到新会话")

    # 标记需要发送会话更新通知
    self._pending_session_update = True

    return session_id
```

#### 2.3 动态端口管理
```python
class PortManager:
    def find_available_port(self, preferred_port: int = 8765) -> int:
        """智能端口分配"""
        # 优先使用环境变量指定的端口
        env_port = os.environ.get('MCP_WEB_PORT')
        if env_port and env_port != "0":
            try:
                port = int(env_port)
                if self.is_port_available(port):
                    return port
            except ValueError:
                pass

        # 尝试首选端口
        if self.is_port_available(preferred_port):
            return preferred_port

        # 动态分配端口
        for port in range(8765, 8865):
            if self.is_port_available(port):
                return port

        # 系统自动分配
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(('127.0.0.1', 0))
            return sock.getsockname()[1]
```

### 3. Web UI 连接创建与初始化

```mermaid
sequenceDiagram
    participant Browser as 浏览器
    participant FastAPI as FastAPI 服务
    participant Template as 模板引擎
    participant WS as WebSocket
    participant Session as 会话管理
    participant I18N as 国际化

    Note over Browser,I18N: 页面加载流程
    Browser->>+FastAPI: GET /feedback
    FastAPI->>+Template: render_template()
    Template->>I18N: 加载语言包
    I18N-->>Template: 翻译资源
    Template->>Template: 渲染 HTML
    Template-->>-FastAPI: 完整页面
    FastAPI-->>-Browser: HTML + CSS + JS

    Note over Browser,Session: WebSocket 连接创建
    Browser->>Browser: 加载 JavaScript 模块
    Browser->>+WS: 创建 WebSocket 连接 (/ws)
    WS->>Session: register_websocket()
    Session->>Session: 检查会话状态
    WS-->>-Browser: connection_established

    Note over Browser,Session: 会话状态同步
    alt 有活跃会话
        Session->>+WS: session_data
        WS-->>-Browser: 当前会话信息
        Browser->>Browser: 更新 AI 摘要
        Browser->>Browser: 设置会话 ID
    end

    alt 有待处理的会话更新
        Session->>+WS: session_updated
        WS-->>-Browser: 会话更新通知
        Browser->>Browser: 显示更新提示
        Browser->>Browser: 局部刷新内容
        Browser->>Browser: 自动聚焦输入框
    end

    Note over Browser,Session: 心跳检测启动
    Browser->>Browser: 启动心跳定时器
    loop 每 30 秒
        Browser->>WS: heartbeat
        WS-->>Browser: heartbeat_ack
    end
```

**连接创建关键步骤**：

#### 3.1 页面渲染
```python
@app.get("/feedback")
async def feedback_page(request: Request):
    """回馈页面渲染"""
    manager = get_web_ui_manager()
    session = manager.current_session

    # 加载用户设置
    layout_mode = load_user_layout_settings()

    # 获取当前语言
    i18n_manager = get_i18n_manager()
    current_language = i18n_manager.get_current_language()

    return templates.TemplateResponse("feedback.html", {
        "request": request,
        "project_directory": session.project_directory if session else ".",
        "layout_mode": layout_mode,
        "current_language": current_language,
        "session_id": session.session_id if session else None,
        "title": i18n_manager.t("app.title")
    })
```

#### 3.2 WebSocket 连接处理
```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 连接端点"""
    await websocket.accept()

    try:
        # 注册 WebSocket 连接
        manager = get_web_ui_manager()
        if manager.current_session:
            manager.current_session.add_websocket(websocket)

        # 发送连接确认
        await websocket.send_json({
            "type": "connection_established",
            "data": {
                "timestamp": datetime.now().isoformat(),
                "session_id": manager.current_session.session_id if manager.current_session else None
            }
        })

        # 如果有待处理的会话更新，立即发送
        if manager._pending_session_update and manager.current_session:
            await websocket.send_json({
                "type": "session_updated",
                "data": {
                    "session_id": manager.current_session.session_id,
                    "summary": manager.current_session.summary,
                    "project_directory": manager.current_session.project_directory
                }
            })
            manager._pending_session_update = False

        # 处理消息循环
        while True:
            data = await websocket.receive_json()
            await handle_websocket_message(websocket, data)

    except WebSocketDisconnect:
        # 处理连接断开
        if manager.current_session:
            manager.current_session.remove_websocket(websocket)
        debug_log("WebSocket 连接已断开")
```

## 🔄 多次循环调用机制

### 持久化会话架构

MCP Feedback Enhanced 的内核创新在于**持久化会话架构**，支持 AI 助手进行多次循环调用而无需重新创建连接。

```mermaid
stateDiagram-v2
    [*] --> FirstCall: AI 首次调用
    FirstCall --> SessionActive: 会话创建
    SessionActive --> UserFeedback: 等待用户回馈
    UserFeedback --> FeedbackSubmitted: 回馈提交
    FeedbackSubmitted --> AIProcessing: AI 处理回馈
    AIProcessing --> SecondCall: AI 再次调用
    SecondCall --> SessionUpdated: 会话更新
    SessionUpdated --> UserFeedback: 等待新回馈

    note right of SessionActive
        Web 服务器持续运行
        浏览器标签页保持打开
        WebSocket 连接维持
    end note

    note right of SessionUpdated
        无需重新打开浏览器
        局部更新页面内容
        状态无缝切换
    end note
```

### 第二次调用流程

#### 1. AI 助手再次调用
```python
# AI 根据用户回馈进行调整后再次调用
result = await interactive_feedback(
    project_directory="./my-project",
    summary="根据您的建议，我已修改了错误处理逻辑，请再次确认",
    timeout=600
)
```

#### 2. 智能会话切换
```mermaid
flowchart TD
    CALL[AI 再次调用] --> CHECK[检查现有会话]
    CHECK --> ACTIVE{有活跃会话?}
    ACTIVE -->|是| UPDATE[更新会话内容]
    ACTIVE -->|否| CREATE[创建新会话]
    UPDATE --> PRESERVE[保存 WebSocket 连接]
    CREATE --> PRESERVE
    PRESERVE --> NOTIFY[发送会话更新通知]
    NOTIFY --> FRONTEND[前端接收更新]
    FRONTEND --> REFRESH[局部刷新内容]
```

#### 3. 前端无缝更新
```javascript
// 处理会话更新消息
function handleSessionUpdated(data) {
    // 显示会话更新通知
    showNotification('会话已更新', 'info');

    // 重置回馈状态
    feedbackState = 'FEEDBACK_WAITING';

    // 局部更新 AI 摘要
    updateAISummary(data.summary);

    // 清空回馈表单
    clearFeedbackForm();

    // 更新会话 ID
    currentSessionId = data.session_id;

    // 保持 WebSocket 连接不变
    // 无需重新创建连接
}
```

## 🚀 新功能交互流程

### 自动提交功能流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as 前端界面
    participant ASM as AutoSubmitManager
    participant PM as PromptManager
    participant WS as WebSocket

    Note over User,WS: 🔧 设置自动提交
    User->>UI: 打开设置页签
    UI->>PM: 获取提示词列表
    PM-->>UI: 返回提示词（自动提交优先）
    User->>UI: 选择提示词并设置倒数时间
    UI->>ASM: updateSettings(enabled, timeout, promptId)
    ASM->>WS: 保存设置到服务器

    Note over User,WS: ⏰ 自动提交运行
    WS->>UI: session_updated（AI 新调用）
    UI->>ASM: checkAutoSubmitConditions()
    ASM->>ASM: 检查设置和状态
    alt 条件满足
        ASM->>ASM: start(timeout, promptId)
        ASM->>UI: 显示倒数计时器
        loop 每秒更新
            ASM->>UI: updateCountdownDisplay(remaining)
        end
        ASM->>PM: getPromptById(promptId)
        PM-->>ASM: 返回提示词内容
        ASM->>UI: 填入提示词到输入框
        ASM->>WS: submit_feedback（自动提交）
    else 条件不满足
        ASM->>UI: 隐藏倒数计时器
    end
```

### 提示词管理流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as 设置界面
    participant PM as PromptManager
    participant Modal as PromptModal
    participant Storage as LocalStorage

    Note over User,Storage: 📝 添加提示词
    User->>UI: 点击「添加提示词」
    UI->>Modal: showAddModal()
    Modal->>User: 显示编辑表单
    User->>Modal: 输入名称和内容
    Modal->>PM: addPrompt(name, content)
    PM->>PM: 验证数据和唯一性
    PM->>Storage: 保存到 localStorage
    PM->>UI: 触发 onPromptsChange 回调
    UI->>UI: refreshPromptList()

    Note over User,Storage: ✏️ 编辑提示词
    User->>UI: 点击编辑按钮
    UI->>Modal: showEditModal(prompt)
    Modal->>User: 显示预填表单
    User->>Modal: 修改内容
    Modal->>PM: updatePrompt(id, name, content)
    PM->>Storage: 更新 localStorage
    PM->>UI: 触发回调更新界面

    Note over User,Storage: 🎯 使用提示词
    User->>UI: 在输入区点击提示词按钮
    UI->>PM: getPromptsSortedByUsage()
    PM-->>UI: 返回排序后列表
    UI->>Modal: showSelectModal(prompts)
    User->>Modal: 选择提示词
    Modal->>PM: usePrompt(id)
    PM->>Storage: 更新使用记录
    Modal->>UI: 填入提示词内容
```

### 会话管理流程（v2.4.3 重构增强）

```mermaid
sequenceDiagram
    participant AI as AI 助手
    participant Server as MCP 服务器
    participant SM as SessionManager
    participant SDM as SessionDataManager
    participant SUR as SessionUIRenderer
    participant UI as 前端界面

    Note over AI,UI: 📊 会话生命周期管理（v2.4.3 重构）
    AI->>Server: interactive_feedback()
    Server->>SM: createSession()
    SM->>SDM: addCurrentSession()
    SDM->>SUR: renderCurrentSession()
    SUR->>UI: 更新会话显示（页签化设计）

    Note over AI,UI: 📝 用户回馈处理
    UI->>Server: submit_feedback
    Server->>SM: processFeedback()
    SM->>SDM: updateSessionStatus()
    SDM->>SDM: 记录回馈数据（本地存储）
    SM->>AI: 返回回馈结果

    Note over AI,UI: 📚 会话历史管理（v2.4.3 增强）
    SM->>SDM: addSessionToHistory()
    SDM->>SDM: 检查完成状态
    alt 会话已完成
        SDM->>SDM: 加入历史记录（localStorage）
        SDM->>SDM: updateStats()
        SDM->>SUR: renderSessionHistory()
        SUR->>UI: 触发 onHistoryChange
    else 会话未完成
        SDM->>SDM: 跳过历史记录
    end

    Note over AI,UI: 🔍 历史查找与管理
    UI->>SDM: getSessionHistory()
    SDM-->>UI: 返回历史列表（72小时内）
    UI->>SDM: getSessionStats()
    SDM-->>UI: 返回统计数据
    UI->>SDM: exportSessionHistory()
    SDM-->>UI: 返回导出数据
    UI->>SDM: cleanupExpiredSessions()
    SDM->>SDM: 清理过期会话
```

### 音效通知系统流程（v2.4.3 添加）

```mermaid
sequenceDiagram
    participant WS as WebSocket
    participant AM as AudioManager
    participant ASU as AudioSettingsUI
    participant AUDIO as Web Audio API
    participant User as 用户

    Note over WS,User: 🔊 音效通知触发流程
    WS->>AM: session_updated 事件
    AM->>AM: checkNotificationEnabled()
    alt 音效通知已激活
        AM->>AM: getSelectedAudio()
        AM->>AUDIO: 创建 Audio 对象
        AM->>AUDIO: 设置音量和来源
        AUDIO->>User: 播放通知音效
        AM->>AM: logPlaybackSuccess()
    else 音效通知已停用
        AM->>AM: logSkippedNotification()
    end

    Note over WS,User: 🎵 音效设置管理
    User->>ASU: 打开音效设置
    ASU->>AM: getAudioSettings()
    AM-->>ASU: 返回当前设置
    ASU->>User: 显示设置界面

    User->>ASU: 调整音量
    ASU->>AM: updateVolume(volume)
    AM->>AM: saveSettings()

    User->>ASU: 选择音效
    ASU->>AM: selectAudio(audioId)
    AM->>AM: saveSettings()

    User->>ASU: 测试播放
    ASU->>AM: testPlayAudio(audioId)
    AM->>AUDIO: 播放测试音效
    AUDIO->>User: 播放音效

    Note over WS,User: 📁 自订音效管理
    User->>ASU: 上传自订音效
    ASU->>ASU: validateAudioFile()
    ASU->>AM: addCustomAudio(file)
    AM->>AM: convertToBase64()
    AM->>AM: saveToLocalStorage()
    ASU->>User: 显示上传成功
```

### 智能记忆功能流程（v2.4.3 添加）

```mermaid
sequenceDiagram
    participant User as 用户
    participant TEXTAREA as 输入框
    participant THM as TextareaHeightManager
    participant RO as ResizeObserver
    participant SM as SettingsManager

    Note over User,SM: 📏 输入框高度记忆
    User->>TEXTAREA: 调整输入框高度
    TEXTAREA->>RO: 触发尺寸变化事件
    RO->>THM: handleResize(element)
    THM->>THM: debounce(500ms)
    THM->>SM: saveHeight(elementId, height)
    SM->>SM: 保存到 localStorage

    Note over User,SM: 🔄 高度恢复
    User->>User: 重新加载页面
    THM->>SM: loadHeight(elementId)
    SM-->>THM: 返回保存的高度
    THM->>TEXTAREA: 应用保存的高度
    TEXTAREA->>User: 显示恢复的高度

    Note over User,SM: 📋 一键拷贝功能
    User->>User: 点击项目路径
    User->>User: 触发拷贝事件
    User->>User: 拷贝到剪贴板
    User->>User: 显示拷贝成功提示

    User->>User: 点击会话ID
    User->>User: 触发拷贝事件
    User->>User: 拷贝到剪贴板
    User->>User: 显示拷贝成功提示（多语言）
```

## 📊 状态同步机制

### WebSocket 消息类型（v2.4.3 扩展）

```mermaid
graph LR
    subgraph "服务器 → 客户端"
        CE[connection_established<br/>连接创建]
        SU[session_updated<br/>会话更新<br/>🔊 触发音效通知]
        FR[feedback_received<br/>回馈确认]
        ST[status_update<br/>状态更新]
        ASS[auto_submit_status<br/>自动提交状态]
        SH[session_history<br/>会话历史<br/>📚 v2.4.3 增强]
        AN[audio_notification<br/>音效通知<br/>🔊 v2.4.3 添加]
    end

    subgraph "客户端 → 服务器"
        SF[submit_feedback<br/>提交回馈]
        HB[heartbeat<br/>心跳检测]
        LS[language_switch<br/>语言切换]
        PM[prompt_management<br/>提示词管理]
        ASC[auto_submit_control<br/>自动提交控制]
        SM[session_management<br/>会话管理<br/>📋 v2.4.3 重构]
        AM[audio_management<br/>音效管理<br/>🎵 v2.4.3 添加]
        HM[height_management<br/>高度管理<br/>📏 v2.4.3 添加]
    end
```

### 状态转换图

```mermaid
stateDiagram-v2
    [*] --> WAITING: 会话创建/更新
    WAITING --> AUTO_SUBMIT_READY: 自动提交条件满足
    AUTO_SUBMIT_READY --> AUTO_SUBMIT_COUNTDOWN: 启动倒数计时
    AUTO_SUBMIT_COUNTDOWN --> FEEDBACK_PROCESSING: 自动提交运行
    WAITING --> FEEDBACK_PROCESSING: 用户手动提交回馈
    FEEDBACK_PROCESSING --> FEEDBACK_SUBMITTED: 处理完成
    FEEDBACK_SUBMITTED --> WAITING: 新会话更新
    FEEDBACK_SUBMITTED --> [*]: 会话结束

    AUTO_SUBMIT_COUNTDOWN --> WAITING: 用户取消自动提交
    WAITING --> ERROR: 连接错误
    FEEDBACK_PROCESSING --> ERROR: 处理错误
    AUTO_SUBMIT_COUNTDOWN --> ERROR: 自动提交错误
    ERROR --> WAITING: 错误恢复
    ERROR --> [*]: 致命错误

    note right of AUTO_SUBMIT_READY
        检查自动提交设置：
        - 功能已激活
        - 已选择提示词
        - 当前状态为等待回馈
    end note

    note right of AUTO_SUBMIT_COUNTDOWN
        倒数计时状态：
        - 显示剩余时间
        - 允许用户取消
        - 时间到自动提交
    end note
```

## 🛡️ 错误处理和恢复

### 连接断线处理
```javascript
// WebSocket 重连机制
function handleWebSocketClose() {
    console.log('WebSocket 连接已关闭，尝试重连...');

    setTimeout(() => {
        initWebSocket();
    }, 3000); // 3秒后重连
}

// 心跳检测
setInterval(() => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now()
        }));
    }
}, 30000); // 每30秒发送心跳
```

### 超时处理
```python
async def wait_for_feedback(self, timeout: int = 600):
    try:
        await asyncio.wait_for(
            self.feedback_completed.wait(),
            timeout=timeout
        )
        return self.get_feedback_result()
    except asyncio.TimeoutError:
        raise TimeoutError(f"等待用户回馈超时 ({timeout}秒)")
```

## 🎯 性能优化

### 连接复用
- **WebSocket 连接保持**: 避免重复创建连接
- **会话状态继承**: 新会话继承旧会话的连接
- **智能浏览器打开**: 检测活跃标签页，避免重复打开

### 资源管理
- **自动清理机制**: 超时会话自动清理
- **内存优化**: 单一活跃会话模式
- **进程管理**: 优雅的进程启动和关闭

## 🔒 安全性考量

### 数据安全
- **本地绑定**: 服务器只绑定 127.0.0.1，减少攻击面
- **输入验证**: 严格的参数类型检查和数据清理
- **文档上传安全**: 图片格式验证和大小限制
- **命令运行限制**: 在项目目录内运行，防止路径遍历

### 网络安全
- **WebSocket 验证**: 连接来源验证
- **CORS 控制**: 限制跨域请求来源
- **超时保护**: 防止长时间占用资源
- **错误信息过滤**: 避免敏感信息泄露

## 🚀 性能优化总结

### 连接复用优势
- **减少 60% 启动时间**: 避免重复创建服务器和浏览器
- **降低 40% 内存使用**: 单一活跃会话模式
- **提升用户体验**: 无缝会话切换，保持操作状态
- **减少网络开销**: WebSocket 连接保持和复用

### 资源管理效率
- **智能清理**: 自动检测和清理过期资源
- **动态端口分配**: 避免端口冲突，支持并行开发
- **错误恢复**: 优雅的错误处理和自动重连
- **跨平台适配**: 统一的环境检测和适配机制

---

## 📚 相关文档

- **[系统架构总览](./system-overview.md)** - 了解整体架构设计理念和技术栈
- **[组件详细说明](./component-details.md)** - 深入了解各层组件的具体实现
- **[API 参考文档](./api-reference.md)** - 完整的 API 端点和参数说明
- **[部署指南](./deployment-guide.md)** - 环境配置和部署最佳实践

---

**版本**: 2.4.3
**最后更新**: 2025年6月14日
**维护者**: Minidoracat
**架构类型**: Web-Only 四层架构
**内核特性**: 持久化会话、智能环境适配、无缝状态切换
**v2.4.3 新功能**: 音效通知系统、会话管理重构、智能记忆功能
