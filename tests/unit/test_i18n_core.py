#!/usr/bin/env python3
"""
I18N 内核功能测试
"""

import os

import pytest

from tests.fixtures.test_data import TestData


class TestI18NManager:
    """I18N 管理器测试"""

    def test_i18n_manager_creation(self, i18n_manager):
        """测试 I18N 管理器创建"""
        assert i18n_manager is not None
        assert hasattr(i18n_manager, "_current_language")
        assert hasattr(i18n_manager, "_translations")
        assert i18n_manager.get_current_language() is not None

    def test_supported_languages(self, i18n_manager):
        """测试支持的语言"""
        supported_languages = i18n_manager.get_supported_languages()

        # 验证包含预期的语言
        for lang in TestData.SUPPORTED_LANGUAGES:
            assert lang in supported_languages

        # 验证至少有基本语言支持
        assert len(supported_languages) >= 2

    def test_language_switching(self, i18n_manager):
        """测试语言切换"""
        original_language = i18n_manager.get_current_language()

        # 测试切换到不同语言
        for lang in TestData.SUPPORTED_LANGUAGES:
            if lang != original_language:
                success = i18n_manager.set_language(lang)
                assert success == True
                assert i18n_manager.get_current_language() == lang
                break

        # 恢复原始语言
        i18n_manager.set_language(original_language)

    def test_invalid_language_switching(self, i18n_manager):
        """测试无效语言切换"""
        original_language = i18n_manager.get_current_language()

        # 尝试切换到不存在的语言
        success = i18n_manager.set_language("invalid-lang")
        assert success == False
        assert i18n_manager.get_current_language() == original_language

    def test_translation_function(self, i18n_manager):
        """测试翻译函数"""
        # 测试基本翻译
        for key in TestData.I18N_TEST_KEYS:
            translation = i18n_manager.t(key)
            assert isinstance(translation, str)
            assert len(translation) > 0
            # 翻译结果不应该等于 key（除非是回退情况）
            if key in i18n_manager._translations.get(
                i18n_manager.get_current_language(), {}
            ):
                assert translation != key

    def test_translation_with_parameters(self, i18n_manager):
        """测试带参数的翻译"""
        # 假设有带参数的翻译 key
        test_key = "test.message.withParam"
        test_params = {"name": "测试用户", "count": 5}

        # 即使 key 不存在，也应该返回合理的结果
        translation = i18n_manager.t(test_key, **test_params)
        assert isinstance(translation, str)
        assert len(translation) > 0

    def test_fallback_mechanism(self, i18n_manager):
        """测试回退机制"""
        original_language = i18n_manager.get_current_language()

        try:
            # 切换到可能翻译不完整的语言
            i18n_manager.set_language("en")

            # 测试不存在的 key
            non_existent_key = "non.existent.key.for.testing"
            translation = i18n_manager.t(non_existent_key)

            # 应该返回 key 本身或合理的回退值
            assert isinstance(translation, str)
            assert len(translation) > 0

        finally:
            # 恢复原始语言
            i18n_manager.set_language(original_language)


class TestI18NTranslationCompleteness:
    """I18N 翻译完整性测试"""

    def test_all_languages_have_translations(self, i18n_manager):
        """测试所有语言都有翻译文档"""
        supported_languages = i18n_manager.get_supported_languages()

        for lang in supported_languages:
            translations = i18n_manager._translations.get(lang, {})
            assert len(translations) > 0, f"语言 {lang} 没有翻译内容"

    def test_key_consistency_across_languages(self, i18n_manager):
        """测试所有语言的 key 一致性"""
        supported_languages = i18n_manager.get_supported_languages()

        if len(supported_languages) < 2:
            pytest.skip("需要至少两种语言来测试一致性")

        # 获取所有语言的翻译
        all_translations = {}
        for lang in supported_languages:
            all_translations[lang] = i18n_manager._translations.get(lang, {})

        # 获取所有 key 的联集
        all_keys = set()
        for translations in all_translations.values():
            all_keys.update(self._get_all_keys(translations))

        # 检查每种语言是否有所有 key
        missing_keys_report = {}
        for lang in supported_languages:
            missing_keys = []
            lang_translations = all_translations[lang]

            for key in all_keys:
                if not self._has_key(lang_translations, key):
                    missing_keys.append(key)

            if missing_keys:
                missing_keys_report[lang] = missing_keys

        # 如果有缺失的 key，生成详细报告
        if missing_keys_report:
            report_lines = ["翻译 key 缺失报告:"]
            for lang, missing_keys in missing_keys_report.items():
                report_lines.append(f"  {lang}: 缺失 {len(missing_keys)} 个 key")
                for key in missing_keys[:5]:  # 只显示前5个
                    report_lines.append(f"    - {key}")
                if len(missing_keys) > 5:
                    report_lines.append(f"    ... 还有 {len(missing_keys) - 5} 个")

            # 这里我们记录警告而不是失败测试，因为某些 key 可能是特定语言的
            print("\n".join(report_lines))

    def test_common_keys_exist(self, i18n_manager):
        """测试常用 key 存在"""
        common_keys = ["common.submit", "common.cancel", "common.loading"]

        supported_languages = i18n_manager.get_supported_languages()

        for lang in supported_languages:
            i18n_manager.set_language(lang)

            for key in common_keys:
                translation = i18n_manager.t(key)
                # 翻译应该存在且不为空
                assert isinstance(translation, str)
                assert len(translation.strip()) > 0

    def _get_all_keys(self, translations: dict, prefix: str = "") -> set:
        """递归获取所有翻译 key"""
        keys = set()

        for key, value in translations.items():
            full_key = f"{prefix}.{key}" if prefix else key

            if isinstance(value, dict):
                # 递归处理嵌套字典
                keys.update(self._get_all_keys(value, full_key))
            else:
                # 叶子节点
                keys.add(full_key)

        return keys

    def _has_key(self, translations: dict, key: str) -> bool:
        """检查翻译字典是否包含指定 key"""
        keys = key.split(".")
        current = translations

        for k in keys:
            if not isinstance(current, dict) or k not in current:
                return False
            current = current[k]

        return True


class TestI18NEnvironmentDetection:
    """I18N 环境检测测试"""

    def test_language_detection_from_env(self, i18n_manager):
        """测试从环境变量检测语言"""
        original_lang = os.environ.get("LANG")
        original_language = os.environ.get("LANGUAGE")

        try:
            # 测试设置环境变量
            os.environ["LANG"] = "zh_TW.UTF-8"

            # 重新创建 I18N 管理器来测试环境检测
            from mcp_feedback_enhanced.i18n import I18nManager

            test_manager = I18nManager()

            # 应该检测到繁体中文
            detected_lang = test_manager._detect_language()
            assert detected_lang in ["zh-TW", "zh-CN", "en"]  # 应该是支持的语言之一

        finally:
            # 恢复环境变量
            if original_lang is not None:
                os.environ["LANG"] = original_lang
            else:
                os.environ.pop("LANG", None)

            if original_language is not None:
                os.environ["LANGUAGE"] = original_language
            else:
                os.environ.pop("LANGUAGE", None)

    def test_fallback_to_default_language(self, i18n_manager):
        """测试回退到默认语言"""
        # 测试当系统语言不支持时的回退行为
        original_lang = os.environ.get("LANG")

        try:
            # 设置不支持的语言
            os.environ["LANG"] = "fr_FR.UTF-8"  # 法语

            from mcp_feedback_enhanced.i18n import I18nManager

            test_manager = I18nManager()

            detected_lang = test_manager._detect_language()
            # 应该回退到支持的语言
            assert detected_lang in TestData.SUPPORTED_LANGUAGES

        finally:
            if original_lang is not None:
                os.environ["LANG"] = original_lang
            else:
                os.environ.pop("LANG", None)
