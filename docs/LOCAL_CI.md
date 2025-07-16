# 本地 CI 测试指南

这个指南将帮助您在本地测试 Tornado Core 的 CI 流程，确保代码在提交到 GitHub 之前能够通过所有检查。

## 🚀 快速开始

### 1. 首次设置

```bash
# 方法一：使用 Makefile（推荐）
make install

# 方法二：手动设置
npm run ci:setup
./scripts/setup-git-hooks.sh
```

### 2. 基本用法

```bash
# 快速检查（提交前）
make check

# 完整 CI 流程
make ci

# 查看所有可用命令
make help
```

## 📋 可用的测试方法

### 🎯 npm 脚本方式

```bash
# 完整本地 CI 流程
npm run ci:local

# 分步执行
npm run ci:setup      # 环境设置
npm run ci:lint       # 代码质量检查
npm run ci:security   # 安全审计
npm run ci:build      # 构建项目
npm run ci:test       # 运行测试
npm run ci:coverage   # 覆盖率分析
```

### 🔧 脚本方式

```bash
# 基本用法
./scripts/local-ci.sh

# 带选项运行
./scripts/local-ci.sh --verbose --coverage

# 跳过某些步骤
./scripts/local-ci.sh --skip-setup --skip-build

# 查看帮助
./scripts/local-ci.sh --help
```

#### 脚本选项说明

| 选项              | 说明           |
| ----------------- | -------------- |
| `--skip-setup`    | 跳过环境设置   |
| `--skip-build`    | 跳过构建过程   |
| `--skip-tests`    | 跳过测试执行   |
| `--skip-lint`     | 跳过代码检查   |
| `--skip-security` | 跳过安全审计   |
| `--coverage`      | 运行覆盖率分析 |
| `--verbose`       | 显示详细输出   |
| `--help`          | 显示帮助信息   |

### 🐳 Docker 方式

```bash
# 在 Docker 中运行 CI（最接近 GitHub Actions）
make docker-ci

# 或直接使用 docker-compose
docker-compose up tornado-ci

# 性能测试
make docker-performance
```

### 🎭 Act 方式（GitHub Actions 本地运行）

首先安装 act：

```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows (使用 Chocolatey)
choco install act-cli
```

然后运行：

```bash
# 测试主要工作流
make act-test

# 测试安全扫描
make act-security

# 测试代码检查
make act-lint

# 直接使用 act
act -j test          # 运行测试任务
act -j security      # 运行安全任务
act -j lint          # 运行检查任务
act                  # 运行所有任务
```

## 🔄 工作流程建议

### 📝 开发时

1. **首次设置**

   ```bash
   make install
   ```

2. **开发过程中**

   ```bash
   # 快速检查（每次提交前）
   make check

   # 或者依赖 Git hooks（自动运行）
   git commit -m "your changes"
   ```

3. **准备推送时**

   ```bash
   # 完整测试
   make ci

   # 如果一切正常，推送代码
   git push
   ```

### 🚀 CI/CD 最佳实践

```bash
# 1. 开发 → 快速检查
make check

# 2. 功能完成 → 完整测试
make ci

# 3. 准备发布 → Docker 测试
make docker-ci

# 4. 最终验证 → GitHub Actions 本地测试
make act-test
```

## 🛠️ 高级用法

### 自定义检查

创建自己的检查脚本：

```bash
# 创建自定义检查
cat > scripts/custom-check.sh << 'EOF'
#!/bin/bash
echo "🔍 Running custom checks..."
# 在这里添加您的自定义检查
EOF

chmod +x scripts/custom-check.sh

# 在 CI 中使用
./scripts/custom-check.sh && make ci
```

### 环境变量配置

```bash
# 设置详细输出
export CI_VERBOSE=true

# 跳过某些检查
export SKIP_SECURITY_AUDIT=true

# 自定义 Ganache 端口
export GANACHE_PORT=8546
```

### 性能分析

```bash
# 分析构建时间
time make build

# 分析测试时间
time make test

# 完整性能分析
make ci-coverage
```

## 🔧 故障排除

### 常见问题

1. **Ganache 端口冲突**

   ```bash
   # 查找占用端口的进程
   lsof -i :8545

   # 杀掉进程
   kill -9 <PID>

   # 或者清理
   make clean
   ```

2. **依赖安装失败**

   ```bash
   # 清理并重新安装
   make emergency-clean
   make setup
   ```

3. **电路构建失败**

   ```bash
   # 清理电路缓存
   rm -rf build/circuits
   npm run build:circuit
   ```

4. **权限问题**
   ```bash
   # 确保脚本可执行
   chmod +x scripts/*.sh
   ```

### 调试技巧

1. **启用详细输出**

   ```bash
   make ci VERBOSE=true
   # 或
   ./scripts/local-ci.sh --verbose
   ```

2. **分步调试**

   ```bash
   # 只运行特定步骤
   make lint
   make build
   make test
   ```

3. **查看日志**

   ```bash
   # Ganache 日志
   tail -f ganache.log

   # Docker 日志
   docker-compose logs tornado-ci
   ```

## 📊 环境状态检查

```bash
# 检查环境状态
make status

# 验证环境配置
make validate

# 查看详细信息
make status && make validate
```

## 🎯 性能优化

### 缓存策略

1. **依赖缓存**

   ```bash
   # 使用 yarn 缓存
   yarn install --prefer-offline
   ```

2. **电路缓存**

   ```bash
   # 电路构建结果会自动缓存
   # 手动清理缓存
   rm -rf build/circuits
   ```

3. **Docker 缓存**
   ```bash
   # 构建时使用缓存
   docker-compose build --no-cache tornado-ci
   ```

### 并行执行

```bash
# 并行运行检查（需要 GNU parallel）
parallel ::: "make lint" "make build" "yarn audit"
```

## 🔒 安全注意事项

1. **私钥安全**

   - 永远不要在 CI 中使用真实私钥
   - 使用测试网络和测试私钥

2. **依赖安全**

   ```bash
   # 定期安全审计（推荐使用 yarn）
   yarn audit
   # 或者如果使用 npm
   npm audit
   ```

3. **容器安全**
   ```bash
   # 扫描 Docker 镜像
   docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
     -v $(pwd):/root/.cache/ aquasec/trivy \
     image catthehacker/ubuntu:act-latest
   ```

## 📚 相关资源

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Act 工具文档](https://github.com/nektos/act)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Truffle 测试指南](https://www.trufflesuite.com/docs/truffle/testing/testing-your-contracts)

## 🤝 贡献

如果您发现本地 CI 工具的问题或有改进建议，请：

1. 创建 Issue 描述问题
2. 提交 Pull Request 修复问题
3. 更新相关文档

---

💡 **提示**: 定期运行 `make ci` 可以确保您的代码始终保持高质量，避免在 GitHub Actions 中发现问题。
