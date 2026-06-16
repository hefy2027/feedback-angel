#!/usr/bin/env python3
"""
I18N 集成测试
"""

import asyncio
import os

import pytest

from tests.fixtures.test_data import TestData


class TestI18NWebIntegration:
    """I18N 与 Web UI 集成测试"""

    @pytest.mark.asyncio
    async def test_i18n_in_web_templates(
        self, web_ui_manager, i18n_manager, test_project_dir
    ):
        """测试 Web 模板中的 I18N 功能"""
        # 创建会话
        web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        # 启动服务器
        web_ui_manager.start_server()
        await asyncio.sleep(3)

        import aiohttp

        base_url = f"http://{web_ui_manager.host}:{web_ui_manager.port}"

        # 测试不同语言的页面渲染
        for lang in TestData.SUPPORTED_LANGUAGES:
            i18n_manager.set_language(lang)

            async with aiohttp.ClientSession() as session:
                # 测试主页
                async with session.get(f"{base_url}/") as response:
                    assert response.status == 200
                    text = await response.text()

                    # 页面应该包含当前语言的内容
                    assert len(text) > 0

                    # 检查是否包含基本的 UI 元素
                    # 这些元素应该根据语言进行本地化
                    assert "MCP Feedback" in text

    def test_i18n_api_endpoints(self, web_ui_manager, i18n_manager):
        """测试 I18N API 端点"""
        import asyncio

        # 启动服务器
        web_ui_manager.start_server()

        async def test_api():
            await asyncio.sleep(3)

            # 测试语言切换 API（如果存在）
            for lang in TestData.SUPPORTED_LANGUAGES:
                # 这里可以测试语言切换 API
                # 例如 POST /api/set-language
                pass

        asyncio.run(test_api())


class TestI18NMCPIntegration:
    """I18N 与 MCP 集成测试"""

    def test_i18n_in_mcp_responses(self, i18n_manager):
        """测试 MCP 回应中的 I18N"""
        # 测试不同语言下的错误消息
        for lang in TestData.SUPPORTED_LANGUAGES:
            i18n_manager.set_language(lang)

            # 测试常见错误消息的本地化
            error_keys = ["error.connection", "error.timeout", "error.invalid_input"]

            for key in error_keys:
                message = i18n_manager.t(key)
                assert isinstance(message, str)
                assert len(message) > 0

                # 不同语言的消息应该不同（除非回退到同一语言）
                if lang != i18n_manager._fallback_language:
                    # 简化测试，只检查翻译是否存在
                    if message != key:  # 如果不是回退到 key 本身
                        # 这里可以进一步验证翻译的差异
                        pass


class TestI18NFileSystemIntegration:
    """I18N 文档系统集成测试"""

    def test_translation_files_exist(self):
        """测试翻译文档存在"""
        # 获取 I18N 文档目录
        from mcp_feedback_enhanced.i18n import I18nManager

        manager = I18nManager()
        locales_dir = manager._locales_dir

        assert locales_dir.exists(), f"翻译目录不存在: {locales_dir}"

        # 检查每种支持语言的翻译文档（使用正确的路径结构）
        for lang in TestData.SUPPORTED_LANGUAGES:
            lang_dir = locales_dir / lang
            lang_file = lang_dir / "translation.json"
            assert lang_file.exists(), f"翻译文档不存在: {lang_file}"

            # 检查文档内容
            import json

            try:
                with open(lang_file, encoding="utf-8") as f:
                    translations = json.load(f)
                assert isinstance(translations, dict)
                assert len(translations) > 0
            except json.JSONDecodeError as e:
                pytest.fail(f"翻译文档 {lang_file} JSON 格式错误: {e}")
            except Exception as e:
                pytest.fail(f"读取翻译文档 {lang_file} 失败: {e}")

    def test_translation_file_encoding(self):
        """测试翻译文档编码"""
        from mcp_feedback_enhanced.i18n import I18nManager

        manager = I18nManager()
        locales_dir = manager._locales_dir

        for lang in TestData.SUPPORTED_LANGUAGES:
            lang_dir = locales_dir / lang
            lang_file = lang_dir / "translation.json"

            if lang_file.exists():
                # 测试 UTF-8 编码
                try:
                    with open(lang_file, encoding="utf-8") as f:
                        content = f.read()
                    assert len(content) > 0
                except UnicodeDecodeError:
                    pytest.fail(f"翻译文档 {lang_file} 不是有效的 UTF-8 编码")


class TestI18NEnvironmentIntegration:
    """I18N 环境集成测试"""

    def test_language_detection_in_different_environments(self):
        """测试不同环境下的语言检测"""
        from mcp_feedback_enhanced.i18n import I18nManager

        # 保存原始环境变量
        original_env = {}
        env_vars = ["LANG", "LANGUAGE", "LC_ALL", "LC_MESSAGES"]
        for var in env_vars:
            original_env[var] = os.environ.get(var)

        try:
            # 测试不同的环境设置
            test_cases = [
                {"MCP_LANGUAGE": "zh-TW", "expected": "zh-TW"},
                {"MCP_LANGUAGE": "zh-CN", "expected": "zh-CN"},
                {"MCP_LANGUAGE": "en", "expected": "en"},
                {"LANG": "zh_TW.UTF-8", "expected": "zh-TW"},
                {"LANG": "zh_CN.UTF-8", "expected": "zh-CN"},
                {"LANG": "en_US.UTF-8", "expected": "en"},
                {"LANG": "ja_JP.UTF-8", "expected": "en"},  # 不支持的语言应回退
            ]

            for test_case in test_cases:
                # 清理环境变量
                for var in env_vars:
                    os.environ.pop(var, None)
                # 也清理 MCP_LANGUAGE
                os.environ.pop("MCP_LANGUAGE", None)

                # 设置测试模式，禁用系统语言检测
                os.environ["MCP_TEST_MODE"] = "true"

                # 设置测试环境
                for key, value in test_case.items():
                    if key != "expected":
                        os.environ[key] = value

                # 创建新的管理器实例，并清理可能的保存设置
                import tempfile
                from pathlib import Path

                with tempfile.TemporaryDirectory() as temp_dir:
                    # 临时修改配置文档路径，避免使用真实的用户配置
                    manager = I18nManager()
                    manager._config_file = Path(temp_dir) / "test_language.json"

                    # 修复 attr-defined 错误 - 使用正确的方法名
                    detected = manager._detect_language()

                    # 验证检测结果
                    expected = test_case["expected"]
                    assert detected == expected, (
                        f"环境 {test_case} 检测到 {detected}，预期 {expected}"
                    )

        finally:
            # 恢复原始环境变量
            # 修复 assignment 和 unreachable 错误 - 明确处理类型
            for var in original_env:
                original_value: str | None = original_env.get(var)
                if original_value is not None:
                    os.environ[var] = original_value
                elif var in os.environ:
                    # 如果原始值为 None，且变量存在于环境中，则移除
                    os.environ.pop(var, None)

    def test_i18n_with_web_ui_manager(self, web_ui_manager, i18n_manager):
        """测试 I18N 与 WebUIManager 的集成"""
        # 验证 WebUIManager 使用了 I18N 管理器
        assert hasattr(web_ui_manager, "i18n")
        assert web_ui_manager.i18n is not None

        # 测试语言切换对 WebUIManager 的影响
        original_lang = i18n_manager.get_current_language()

        for lang in TestData.SUPPORTED_LANGUAGES:
            if lang != original_lang:
                success = i18n_manager.set_language(lang)
                assert success == True

                # WebUIManager 应该能够访问当前语言设置
                current_lang = web_ui_manager.i18n.get_current_language()
                assert current_lang == lang
                break

        # 恢复原始语言
        i18n_manager.set_language(original_lang)
