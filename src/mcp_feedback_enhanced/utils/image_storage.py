"""
图片存储管理器
=============

支持 base64 和文件两种图片处理模式，通过环境变量 MCP_IMAGE_DIR 控制。
- 未设置 MCP_IMAGE_DIR → base64 模式（原有行为）
- 设置 MCP_IMAGE_DIR → 文件模式（图片存磁盘）
"""

import os
import shutil
import time
from pathlib import Path
from typing import Any

from ..debug import server_debug_log as debug_log


class ImageStorageManager:
    """图片存储管理器 - 支持 base64 和文件两种模式"""

    _instance: "ImageStorageManager | None" = None

    def __init__(self):
        raw_dir = os.getenv("MCP_IMAGE_DIR")
        self.image_mode: str = os.getenv("MCP_IMAGE_MODE", "filepath")
        self._base_dir: Path | None = None

        if raw_dir is not None:
            candidate = Path(raw_dir)
            try:
                candidate.mkdir(parents=True, exist_ok=True)
                self._base_dir = candidate
            except Exception as e:
                import tempfile

                fallback = Path(tempfile.gettempdir()) / "mcp-images"
                fallback.mkdir(parents=True, exist_ok=True)
                self._base_dir = fallback
                debug_log(
                    f"MCP_IMAGE_DIR 路径无效 ({raw_dir}): {e}，回退到 {fallback}"
                )

        mode_str = "file" if self.is_file_mode() else "base64"
        debug_log(
            f"ImageStorageManager 初始化: mode={mode_str}, "
            f"dir={self._base_dir}, image_mode={self.image_mode}"
        )

    @classmethod
    def get_instance(cls) -> "ImageStorageManager":
        """获取单例实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls):
        """重置单例（用于测试）"""
        cls._instance = None

    def is_file_mode(self) -> bool:
        """是否为文件存储模式"""
        return self._base_dir is not None

    @staticmethod
    def _get_default_image_dir() -> Path:
        """获取默认图片存储目录：优先 MCP_IMAGE_DIR 环境变量，否则用 %TEMP%/mcp-images"""
        env_dir = os.getenv("MCP_IMAGE_DIR")
        if env_dir:
            return Path(env_dir)
        import tempfile
        return Path(tempfile.gettempdir()) / "mcp-images"

    def switch_mode(self, mode: str, image_dir: str | None = None) -> dict[str, Any]:
        """运行时切换图片存储模式

        Args:
            mode: 'file' 或 'base64'
            image_dir: 文件模式的存储目录（可选，默认使用环境变量或系统临时目录）

        Returns:
            包含当前模式信息的字典
        """
        if mode == "file":
            if image_dir:
                candidate = Path(image_dir)
            else:
                candidate = self._get_default_image_dir()

            try:
                candidate.mkdir(parents=True, exist_ok=True)
                self._base_dir = candidate
            except Exception as e:
                fallback = self._get_default_image_dir()
                fallback.mkdir(parents=True, exist_ok=True)
                self._base_dir = fallback
                debug_log(f"指定路径无效 ({image_dir}): {e}，回退到 {fallback}")
        else:
            self._base_dir = None

        mode_str = "file" if self.is_file_mode() else "base64"
        debug_log(
            f"图片模式已切换: mode={mode_str}, dir={self._base_dir}"
        )
        return {
            "mode": mode_str,
            "image_mode": self.image_mode,
            "base_dir": str(self._base_dir) if self._base_dir else None,
        }

    @property
    def base_dir(self) -> Path | None:
        """获取基础目录（只读）"""
        return self._base_dir

    def get_session_image_dir(self, session_id: str) -> Path:
        """获取会话的图片存储目录，不存在则创建"""
        if not self._base_dir:
            raise RuntimeError("文件模式未启用")
        session_dir = self._base_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        return session_dir

    def save_image(
        self, session_id: str, filename: str, data: bytes
    ) -> dict[str, Any]:
        """保存图片文件

        Args:
            session_id: 会话 ID
            filename: 原始文件名
            data: 图片二进制数据

        Returns:
            包含 filename, filepath, size 的字典
        """
        session_dir = self.get_session_image_dir(session_id)
        safe_name = self._make_safe_filename(filename)
        filepath = session_dir / safe_name
        filepath.write_bytes(data)
        debug_log(f"图片已保存: {filepath} ({len(data)} bytes)")
        return {
            "filename": safe_name,
            "filepath": str(filepath),
            "size": len(data),
        }

    def _make_safe_filename(self, filename: str) -> str:
        """生成安全的文件名，加时间戳前缀避免冲突"""
        cleaned = filename.replace("/", "_").replace("\\", "_").replace("\x00", "_")
        return f"{int(time.time())}_{cleaned}"

    def get_image_path(self, session_id: str, filename: str) -> Path:
        """获取图片的绝对路径"""
        if not self._base_dir:
            raise RuntimeError("文件模式未启用")
        return self._base_dir / session_id / filename

    def get_image_url(self, session_id: str, filename: str) -> str:
        """获取图片的 HTTP URL 路径"""
        return f"/api/images/{session_id}/{filename}"

    def get_image_references_text(
        self, session_id: str, server_url: str = ""
    ) -> str:
        """生成 AI 提示词中的图片引用文本

        Args:
            session_id: 会话 ID
            server_url: 服务器 URL（url 模式需要）

        Returns:
            格式化的图片引用文本
        """
        if not self._base_dir:
            return ""
        session_dir = self._base_dir / session_id
        if not session_dir.exists():
            return ""

        image_files = sorted(
            f for f in session_dir.iterdir() if f.is_file()
        )
        if not image_files:
            return ""

        lines = []
        for img_file in image_files:
            if self.image_mode == "url" and server_url:
                ref = f"{server_url}{self.get_image_url(session_id, img_file.name)}"
            else:
                ref = str(img_file)
            lines.append(f"  - {ref}")

        return (
            "=== 图片附件 ===\n请查看以下图片:\n" + "\n".join(lines)
        )

    def cleanup_session_images(self, session_id: str) -> int:
        """清理指定会话的图片文件

        Returns:
            删除的文件数量
        """
        if not self._base_dir:
            return 0
        session_dir = self._base_dir / session_id
        if not session_dir.exists():
            return 0

        count = sum(1 for f in session_dir.iterdir() if f.is_file())
        try:
            shutil.rmtree(session_dir)
            debug_log(f"已清理会话 {session_id} 的 {count} 个图片文件")
        except Exception as e:
            debug_log(f"清理会话图片失败: {e}")
            count = 0
        return count

    def list_session_images(self, session_id: str) -> list[dict[str, Any]]:
        """列出会话的所有图片"""
        if not self._base_dir:
            return []
        session_dir = self._base_dir / session_id
        if not session_dir.exists():
            return []

        result = []
        for f in sorted(session_dir.iterdir()):
            if f.is_file():
                result.append(
                    {
                        "filename": f.name,
                        "filepath": str(f),
                        "size": f.stat().st_size,
                        "url": self.get_image_url(session_id, f.name),
                    }
                )
        return result
