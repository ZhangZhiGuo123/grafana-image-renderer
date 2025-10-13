# Grafana Image Renderer - 国内网络优化指南

本文档介绍如何在国内网络环境下优化 Grafana Image Renderer 的安装和使用。

## PUPPETEER 和 Chromium 安装位置

### 1. 依赖安装位置

- **package.json**: 包含 `puppeteer`、`puppeteer-cluster` 和 `@puppeteer/browsers` 依赖
- **scripts/download_chrome.js**: 负责下载 Chrome 浏览器的脚本
- **Dockerfile**: 在 Docker 镜像中安装 Chromium 浏览器
- **scripts/package_target.sh**: 打包时控制是否下载 Chrome

### 2. 下载源地址

- **原始下载源**: `https://storage.googleapis.com/chrome-for-testing-public`
- **npm 包源**: `https://registry.yarnpkg.com/`

## 国内网络优化方案

### 方案一：使用国内镜像源

#### 1. 使用提供的 .npmrc 配置文件

项目中已创建 `.npmrc` 文件，配置了国内镜像源：

```bash
# 安装依赖时会自动使用国内镜像源
npm install
# 或
yarn install
```

#### 2. 使用国内镜像版本的 Chrome 下载脚本

使用 `scripts/download_chrome_cn.js` 替代原始脚本：

```bash
# 修改 scripts/package_target.sh 中的下载脚本
node scripts/download_chrome_cn.js "${ARCH}" "${OUT}"
```

#### 3. 使用国内镜像版本的 Dockerfile

使用 `Dockerfile.cn` 构建镜像：

```bash
docker build -f Dockerfile.cn -t grafana-image-renderer:cn .
```

### 方案二：跳过 Chromium 安装

#### 1. 环境变量方式

设置环境变量跳过 Puppeteer 的 Chromium 下载：

```bash
# 设置环境变量
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 然后安装依赖
npm install
```

#### 2. 使用提供的 npm 脚本

```bash
# 使用跳过 Chromium 下载的安装脚本
npm run install:skip-chromium
```

#### 3. 打包时跳过 Chrome 下载

```bash
# 构建时跳过 Chrome 下载
make build_package ARCH=linux-x64-unknown SKIP_CHROMIUM=true OUT=plugin-linux-x64-no-chromium
```

#### 4. 使用系统已安装的 Chrome/Chromium

如果系统已安装 Chrome 或 Chromium，可以通过配置文件指定路径：

```json
{
  "rendering": {
    "chromeBin": "/usr/bin/google-chrome"
  }
}
```

或通过环境变量：

```bash
export CHROME_BIN="/usr/bin/google-chrome"
```

## 推荐使用方式

### 开发环境

1. 使用 `.npmrc` 配置国内镜像源
2. 设置 `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` 跳过下载
3. 使用系统安装的 Chrome 浏览器

```bash
# 1. 设置环境变量
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export CHROME_BIN="/usr/bin/google-chrome"

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run watch
```

### 生产环境

#### Docker 部署

使用国内镜像版本的 Dockerfile：

```bash
docker build -f Dockerfile.cn -t grafana-image-renderer:cn .
docker run -p 8081:8081 grafana-image-renderer:cn
```

#### 二进制部署

构建不包含 Chromium 的版本：

```bash
make build_package ARCH=linux-x64-unknown SKIP_CHROMIUM=true OUT=plugin-linux-x64-no-chromium
```

然后在目标服务器上安装 Chrome/Chromium：

```bash
# Ubuntu/Debian
sudo apt-get install chromium-browser

# CentOS/RHEL
sudo yum install chromium
```

## 配置说明

### 环境变量

- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`: 跳过 Puppeteer 的 Chromium 下载
- `CHROME_BIN`: 指定 Chrome/Chromium 可执行文件路径
- `GF_PLUGIN_RENDERING_CHROME_BIN`: Grafana 插件模式下的 Chrome 路径配置

### 配置文件

在 `default.json`、`dev.json` 等配置文件中设置：

```json
{
  "rendering": {
    "chromeBin": "/path/to/chrome"
  }
}
```

## 故障排除

### 1. Chrome 下载失败

- 检查网络连接
- 尝试使用国内镜像源
- 考虑跳过下载，使用系统 Chrome

### 2. Chrome 启动失败

- 检查 Chrome 路径是否正确
- 确认 Chrome 版本兼容性
- 检查系统依赖库是否完整

### 3. 渲染失败

- 检查 Chrome 参数配置
- 确认字体和语言环境设置
- 查看详细错误日志

## 相关文件

- `.npmrc`: npm 镜像源配置
- `scripts/download_chrome_cn.js`: 国内镜像版本的 Chrome 下载脚本
- `Dockerfile.cn`: 国内镜像版本的 Dockerfile
- `package.json`: 添加了跳过 Chromium 安装的脚本