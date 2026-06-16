# 简化发布流程 / Simplified Release Workflow

## 🎯 概述 / Overview

此项目已采用简化的发布流程，不再需要创建版本化目录（如 `v2.3.0/`），而是直接更新 CHANGELOG 文档。

This project now uses a simplified release workflow that no longer requires creating versioned directories (like `v2.3.0/`), but instead directly updates CHANGELOG files.

## 📋 新的发布流程 / New Release Process

### 1. 更新 CHANGELOG 文档 / Update CHANGELOG Files

在发布前，请手动更新以下三个文档：
Before releasing, manually update these three files:

- `RELEASE_NOTES/CHANGELOG.en.md`
- `RELEASE_NOTES/CHANGELOG.zh-TW.md`
- `RELEASE_NOTES/CHANGELOG.zh-CN.md`

### 2. CHANGELOG 格式要求 / CHANGELOG Format Requirements

每个新版本应该按照以下格式添加到 CHANGELOG 文档的顶部：
Each new version should be added to the top of CHANGELOG files in this format:

```markdown
## [v2.3.0] - 版本标题 / Version Title

### 🌟 亮点 / Highlights
本次发布的主要特色...

### ✨ 新功能 / New Features
- 🆕 **功能名称**: 功能描述

### 🐛 错误修复 / Bug Fixes
- 🔧 **问题修复**: 修复描述

### 🚀 改进功能 / Improvements
- ⚡ **性能优化**: 优化描述

---
```

### 3. 运行发布 / Execute Release

1. 确保所有 CHANGELOG 文档都已更新
   Ensure all CHANGELOG files are updated

2. 前往 GitHub Actions 页面
   Go to GitHub Actions page

3. 运行 "Auto Release to PyPI" workflow
   Run "Auto Release to PyPI" workflow

4. 选择版本类型（patch/minor/major）
   Select version type (patch/minor/major)

### 📊 版本类型说明 / Version Type Explanation

选择适当的版本类型非常重要，请根据变更内容选择：
Choosing the appropriate version type is important, select based on the changes:

#### 🔧 Patch (修补版本)
- **用途 / Usage**: 错误修复、小幅改进、安全修补
- **范例 / Example**: `2.3.0 → 2.3.1`
- **适用情况 / When to use**:
  - 🐛 修复 bug / Bug fixes
  - 🔒 安全性修补 / Security patches
  - 📝 文档更新 / Documentation updates
  - 🎨 小幅 UI 调整 / Minor UI tweaks

#### ✨ Minor (次要版本)
- **用途 / Usage**: 新功能、功能增强、向后兼容的变更
- **范例 / Example**: `2.3.0 → 2.4.0`
- **适用情况 / When to use**:
  - 🆕 添加功能 / New features
  - 🚀 功能增强 / Feature enhancements
  - 🎯 性能改进 / Performance improvements
  - 🌐 新的语言支持 / New language support

#### 🚨 Major (主要版本)
- **用途 / Usage**: 重大变更、不向后兼容的修改、架构重构
- **范例 / Example**: `2.3.0 → 3.0.0`
- **适用情况 / When to use**:
  - 💥 破坏性变更 / Breaking changes
  - 🏗️ 架构重构 / Architecture refactoring
  - 🔄 API 变更 / API changes
  - 📦 依赖项重大更新 / Major dependency updates

#### 🤔 如何选择 / How to Choose

**问自己这些问题 / Ask yourself these questions**:

1. **会破坏现有功能吗？** / **Will it break existing functionality?**
   - 是 / Yes → Major
   - 否 / No → 继续下一个问题 / Continue to next question

2. **是否添加了功能？** / **Does it add new functionality?**
   - 是 / Yes → Minor
   - 否 / No → 继续下一个问题 / Continue to next question

3. **只是修复或小幅改进？** / **Just fixes or minor improvements?**
   - 是 / Yes → Patch

## 🔄 自动化流程 / Automated Process

GitHub workflow 将自动：
The GitHub workflow will automatically:

1. ✅ 版本号码升级 / Version bump
2. ✅ 从 CHANGELOG 提取亮点 / Extract highlights from CHANGELOG
3. ✅ 生成多语系 GitHub Release / Generate multi-language GitHub Release
4. ✅ 发布到 PyPI / Publish to PyPI
5. ✅ 创建 Git 标签 / Create Git tags

## 📦 GitHub Release 格式 / GitHub Release Format

自动生成的 Release 将包含：
Auto-generated releases will include:

- 🌟 版本亮点 / Version highlights
- 🌐 多语系 CHANGELOG 链接 / Multi-language CHANGELOG links
- 📦 安装指令 / Installation commands
- 🔗 相关链接 / Related links

## ⚠️ 注意事项 / Important Notes

1. **不再需要版本目录**：旧的 `RELEASE_NOTES/v2.x.x/` 目录结构已弃用
   **No more version directories**: Old `RELEASE_NOTES/v2.x.x/` directory structure is deprecated

2. **手动更新 CHANGELOG**：发布前必须手动更新 CHANGELOG 文档
   **Manual CHANGELOG updates**: CHANGELOG files must be manually updated before release

3. **格式一致性**：请保持 CHANGELOG 格式的一致性以确保自动提取正常运作
   **Format consistency**: Maintain CHANGELOG format consistency for proper auto-extraction

## 🗂️ 旧版本目录清理 / Old Version Directory Cleanup

现有的版本目录（`v2.2.1` 到 `v2.2.5`）可以选择性保留作为历史记录，或者清理以简化项目结构。

Existing version directories (`v2.2.1` to `v2.2.5`) can optionally be kept for historical records or cleaned up to simplify project structure.

## 🚀 优点 / Benefits

- ✅ 减少维护负担 / Reduced maintenance burden
- ✅ 单一真实来源 / Single source of truth
- ✅ 简化的项目结构 / Simplified project structure
- ✅ 自动化的 Release 生成 / Automated release generation
