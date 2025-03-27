# Compress Files

[![smithery badge](https://smithery.ai/badge/@tuskermanshu/compress-mcp-server)](https://smithery.ai/server/@tuskermanshu/compress-mcp-server)

基于TypeScript和fastmcp框架实现的具有文件压缩和解压功能的MCP服务器。

## 项目概述

本项目使用Model Context Protocol (MCP)技术，结合fastmcp框架，实现一个可以提供文件压缩和解压缩服务的MCP服务器。服务器将能够接收客户端的压缩和解压缩请求，处理文件，并返回结果。

## 技术栈

- TypeScript
- fastmcp
- pnpm (包管理)
- node-zlib (用于gzip压缩功能)
- tar & tar-stream (用于文件夹压缩/解压)
- jszip (用于ZIP格式支持)
- node-7z (用于7z格式支持)
- zod (用于参数验证)

## 项目特点

- 完全符合MCP规范的工具实现
- 严格的参数验证和类型检查
- 详细的进度报告
- 精确的错误处理
- 友好的用户反馈
- 安全的文件处理（防止路径遍历攻击）
- 多种压缩格式支持
- 标准化的返回格式

## 架构设计

项目采用模块化、可扩展的架构，基于策略模式和工厂模式，使得添加新的压缩格式变得简单。

### 核心组件

1. **压缩处理器接口 (CompressionHandler)**：
   - 定义了所有格式处理器必须实现的方法
   - 包括压缩、解压和内容列表三个主要功能
   - 提供格式检验和元数据访问方法

2. **格式注册表 (FormatRegistry)**：
   - 管理所有已注册的格式处理器
   - 根据格式名称或文件扩展名查找对应处理器
   - 支持动态注册新的处理器

3. **统一压缩工具 (UnifiedCompressionTool)**：
   - 提供单一工具入口
   - 解析参数并路由到相应的处理器实例
   - 标准化输入和输出

4. **公共工具类 (CompressionUtils)**：
   - 提供所有处理器共享的通用功能
   - 处理路径规范化、文件存在检查等
   - 格式化错误消息和操作结果

### 扩展方式

添加新的压缩格式只需要以下步骤：

1. 创建新的格式处理器类，实现CompressionHandler接口
2. 在主程序中注册新的处理器
3. 无需修改统一工具接口或其他组件

例如，添加新的RAR格式支持：

```typescript
// 1. 创建RAR处理器类
class RarHandler implements CompressionHandler {
  // 实现必要的方法
}

// 2. 在注册函数中添加
function registerHandlers() {
  // 现有处理器
  registry.register('gzip', new GzipHandler());
  
  // 添加新的RAR处理器
  registry.register('rar', new RarHandler());
}
```

### 架构优势

1. **关注点分离** - 每个处理器只关心自己的格式实现
2. **高度可扩展** - 轻松添加新的格式支持
3. **代码复用** - 共享通用功能，减少重复代码
4. **维护性好** - 修改一个格式不会影响其他格式
5. **便于测试** - 可以单独测试每个组件

## 实施步骤

### 1. 项目初始化与环境搭建
- [x] 创建项目目录
- [x] 初始化pnpm项目
- [x] 安装必要依赖(fastmcp, typescript等)
- [x] 配置TypeScript

### 2. 服务器基础架构设计
- [x] 创建主服务器文件
- [x] 配置服务器基本参数
- [x] 设置服务器启动配置

### 3. 压缩工具功能实现
- [x] 设计压缩文件工具
- [x] 实现单文件压缩功能
- [x] 实现多文件/目录压缩功能
- [x] 支持多种压缩格式(tar.gz, zip, 7z)

### 4. 解压工具功能实现
- [x] 设计解压文件工具
- [x] 实现解压缩功能
- [x] 添加解压路径选择功能

### 5. 资源管理功能
- [x] 实现压缩文件预览功能
- [x] 实现压缩文件内容列表功能

### 6. 用户交互优化
- [x] 添加进度报告功能
- [x] 实现错误处理机制
- [x] 添加安全机制（路径验证等）
- [x] 实现标准化返回格式

### 7. MCP规范兼容性
- [x] 更新工具输出格式以符合MCP规范
- [x] 添加isError标识
- [x] 标准化content字段
- [x] 使用类型化的text返回

### 8. 工具架构优化
- [x] 重构为模块化架构
- [x] 实现格式处理器接口
- [x] 创建格式注册表
- [x] 统一工具接口设计

### 9. 测试与部署
- [x] 基本功能测试
- [ ] 编写单元测试
- [ ] 进行集成测试
- [ ] 优化性能
- [ ] 准备部署文档

## 当前进度

目前已完成基本的服务器架构设计和主要功能实现，支持多种压缩格式。最新版本采用模块化、可扩展的架构，便于后续扩展和维护。

### 支持的压缩格式:

1. **gzip格式**：适用于单个文件压缩
2. **tar.gz格式**：适用于文件夹压缩
3. **ZIP格式**：通用的压缩格式，支持文件和文件夹
4. **7z格式**：高压缩率格式，支持文件和文件夹

所有工具都经过全面升级，具有以下功能：

- 严格的参数验证和类型检查（使用zod）
- 安全的文件路径处理（防止路径遍历攻击）
- 详细的进度报告（支持实时进度百分比）
- 精确的错误处理和友好的错误信息
- 标准化的MCP返回格式

## 目录结构

```
src/
├── handlers/               # 各种格式的具体处理器实现
│   ├── gzip-handler.ts     # GZIP格式处理器
│   ├── tar-gz-handler.ts   # TAR.GZ格式处理器
│   ├── zip-handler.ts      # ZIP格式处理器
│   └── 7z-handler.ts       # 7Z格式处理器
├── interfaces/             # 接口定义
│   └── compression-handler.ts # 压缩处理器接口
├── registry/               # 处理器注册表
│   └── format-registry.ts  # 格式注册表实现
├── tools/                  # MCP工具定义
│   ├── unified-compression.ts # 统一压缩工具
│   └── legacy/             # 旧版工具（保持兼容）
├── utils/                  # 通用工具类
│   └── compression-utils.ts # 压缩相关通用功能
└── index.ts                # 主入口点
```

## 下一步计划

1. 完成其他格式处理器的实现
2. 优化压缩和解压性能
3. 添加更多格式支持（如rar等）
4. 实现流式处理以支持更大文件
5. 添加文件加密/解密功能
6. 编写测试用例
7. 发布至NPM

## 安装方法

### Installing via Smithery

To install 压缩功能服务器 for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@tuskermanshu/compress-mcp-server):

```bash
npx -y @smithery/cli install @tuskermanshu/compress-mcp-server --client claude
```

### Manual Installation
1. 克隆本仓库
```bash
git clone <仓库地址>
cd zip-mcp-server
```

2. 安装依赖
```bash
pnpm install
```

3. 构建项目
```bash
pnpm build
```

4. 运行服务器
```bash
# 直接启动
pnpm start

# 开发模式
pnpm dev

# 使用MCP Inspector测试
pnpm inspect
```

## 可用工具

### 统一压缩工具（推荐使用）

| 工具名称 | 描述 | 主要参数 |
|---------|------|---------|
| `compression` | 统一的压缩/解压/列表工具，支持多种格式 | operation, format, sourcePath, outputDirectory, outputFileName, compressionLevel, stripComponents, previewLength |

### 原版独立工具（已弃用）

| 工具名称 | 描述 | 主要参数 |
|---------|------|---------|
| `zip` | 压缩单个文件为gzip格式 | sourceFilePath, outputDirectory, outputFileName, compressionLevel |
| `unzip` | 解压gzip格式的文件 | sourceFilePath, outputDirectory, outputFileName |
| `list-zip-contents` | 列出压缩文件的内容预览 | sourceFilePath, previewLength |
| `zip-folder` | 压缩文件夹为tar.gz格式 | sourceFolderPath, outputDirectory, outputFileName, compressionLevel |
| `unzip-folder` | 解压tar.gz格式的压缩文件夹 | sourceArchivePath, outputDirectory, stripComponents |
| `zip-archive` | 使用ZIP格式压缩文件或文件夹 | sourcePath, outputDirectory, outputFileName, compressionLevel |
| `7z-archive` | 使用7z格式压缩文件或文件夹 | sourcePath, outputDirectory, outputFileName, compressionLevel |

## 支持的压缩格式

| 格式 | 特点 | 适用场景 |
|------|------|---------|
| gzip (.gz) | 单文件压缩，速度快 | 单个文本文件，日志文件等 |
| tar.gz | 保留目录结构，Unix/Linux常用 | 文件夹压缩，特别是在Unix/Linux系统 |
| ZIP (.zip) | 通用格式，兼容性好 | 跨平台场景，需要分享给Windows用户 |
| 7z (.7z) | 高压缩比 | 大文件压缩，需要更高压缩率 |

## 统一压缩工具详细说明

新版本采用统一的压缩工具接口，提供一致的用户体验和更简单的接口。

### compression (统一压缩工具)

一站式工具，支持多种压缩格式和操作，包括压缩、解压和查看文件内容。

参数：
- `operation`: 操作类型（必需）
  - `compress`: 压缩文件或文件夹
  - `decompress`: 解压文件
  - `list`: 列出压缩文件内容
- `format`: 压缩格式（必需）
  - `gzip`: 单文件压缩格式
  - `tar.gz`: 文件夹压缩格式
  - `zip`: 通用ZIP压缩格式
  - `7z`: 高压缩比7z格式
- `sourcePath`: 源文件或文件夹路径（必需）
- `outputDirectory`: 输出目录，默认为源文件/文件夹所在目录
- `outputFileName`: 输出文件名，默认基于源名称和格式自动生成
- `compressionLevel`: 压缩级别(1-9)，默认为6
- `stripComponents`: 解压时忽略的目录层级数量（仅用于解压tar.gz）
- `previewLength`: 列出内容时的预览长度（字节数），默认为1000

## 扩展指南

### 添加新的压缩格式

1. 在`src/handlers`目录下创建新的处理器类文件，例如`rar-handler.ts`
2. 实现`CompressionHandler`接口的所有方法
3. 在`src/index.ts`中的`registerHandlers`函数中注册新的处理器

```typescript
// src/handlers/rar-handler.ts
export class RarHandler implements CompressionHandler {
  // 实现所有必要的接口方法
}

// src/index.ts
function registerHandlers() {
  // ...其他处理器
  registry.register('rar', new RarHandler());
}
```

不需要修改任何其他代码，统一工具会自动支持新的格式。

## 使用示例

使用Claude或其他支持MCP的工具连接到本服务器后，可以使用以下示例命令：

### 使用统一工具压缩文件(gzip):
```
compression工具可以处理多种压缩格式，例如:
{
  "operation": "compress",
  "format": "gzip",
  "sourcePath": "/path/to/file.txt",
  "compressionLevel": 6
}
```

### 使用统一工具压缩文件夹(tar.gz):
```
compression工具可以处理文件夹压缩:
{
  "operation": "compress",
  "format": "tar.gz",
  "sourcePath": "/path/to/folder",
  "compressionLevel": 9
}
```

### 使用统一工具解压ZIP文件:
```
compression工具可以解压多种格式:
{
  "operation": "decompress",
  "format": "zip",
  "sourcePath": "/path/to/archive.zip",
  "outputDirectory": "/path/to/output"
}
```

### 使用统一工具查看7z文件内容:
```
compression工具可以列出压缩文件内容:
{
  "operation": "list",
  "format": "7z",
  "sourcePath": "/path/to/archive.7z"
}
```

## 版本历史

### v2.1.0
- 重构为模块化、可扩展架构
- 实现格式处理器接口设计
- 创建格式注册表
- 改进错误处理和进度报告

### v2.0.0
- 重构为统一压缩工具接口
- 支持一致的参数结构
- 改进错误处理和进度报告

### v1.0.0
- 初始版本
- 支持多种独立的压缩和解压工具

## 安全说明

本项目实现了多种安全机制：

1. **路径验证** - 防止路径遍历攻击，确保用户不能访问系统上的任意文件
2. **参数验证** - 使用zod库进行严格的输入验证
3. **错误处理** - 捕获所有可能的错误并提供友好的提示，不泄露系统信息
4. **文件名安全检查** - 确保文件名不包含路径分隔符

## 贡献指南

欢迎对本项目做出贡献！请fork项目，创建分支，提交变更后发起pull request。

## 许可证

MIT许可证 