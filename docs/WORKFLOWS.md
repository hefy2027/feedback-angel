# GitHub Actions 工作流程说明

本项目使用 GitHub Actions 自动化发布流程。

## 🏗️ 工作流程架构

### 发布工作流程 (publish.yml)

**用途**: 负责版本管理和 PyPI 发布

**触发条件**:
- 手动触发 (workflow_dispatch)

**功能**:
- 自动或手动版本号管理
- 发布到 PyPI
- 创建 GitHub Release

## 🚀 使用方式

### 发布新版本时

1. **手动触发发布** - 在 GitHub Actions 页面运行 "Auto Release to PyPI"
2. **选择发布选项**:
   - `version_type`: patch/minor/major (或使用 custom_version)

## 📋 最佳实践

### 发布流程

1. **准备发布**:
   - 更新 CHANGELOG 文档
   - 测试本地功能

2. **运行发布**:
   - 手动触发 "Auto Release to PyPI" 工作流程
   - 选择适当的版本类型

3. **发布后验证**:
   - 检查 PyPI 上的新版本
   - 测试安装: `uvx feedback-angel@latest`

## 🔧 故障排除

### 发布流程问题

1. **版本冲突**:
   - 检查 PyPI 上是否已存在相同版本
   - 确认版本号格式正确 (X.Y.Z)

2. **权限问题**:
   - 确认 PYPI_API_TOKEN 密钥已正确设置
   - 检查 GitHub Token 权限
