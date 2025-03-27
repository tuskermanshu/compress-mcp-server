# 压缩功能MCP服务器

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

## 安装方法

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

### 原版独立工具（即将废弃⚠️）

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

## 开发者指南

### 目录结构

```
src/
├── handlers/               # 格式处理器实现
│   ├── gzip-handler.ts     # GZIP格式处理器
│   └── [other-format]-handler.ts
├── interfaces/             # 接口定义
│   └── compression-handler.ts  # 压缩处理器接口
├── registry/               # 处理器注册表
│   └── format-registry.ts
├── tools/                  # MCP工具定义
│   ├── unified-compression.ts  # 统一压缩工具
│   └── legacy/             # 旧版独立工具
├── utils/                  # 公共工具
│   └── compression-utils.ts
└── index.ts                # 主入口点
```

### 添加新的压缩格式

#### 步骤1: 创建新的处理器类

在`src/handlers`目录下创建一个新文件，例如`src/handlers/new-format-handler.ts`:

```typescript
import { CompressionHandler, OperationResult } from '../interfaces/compression-handler.js';
import { 
  CompressionUtils, 
  ProgressCallback, 
  CompressionOptions, 
  DecompressionOptions, 
  ListOptions 
} from '../utils/compression-utils.js';

export class NewFormatHandler implements CompressionHandler {
  // 返回支持的文件扩展名
  getSupportedExtensions(): string[] {
    return ['.newext'];
  }
  
  // 返回格式名称
  getFormatName(): string {
    return 'newformat';
  }
  
  // 检查文件是否是此格式
  isFormatValid(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.newext');
  }
  
  // 实现压缩方法
  async compress(
    sourcePath: string,
    targetPath: string,
    options: CompressionOptions,
    progressCallback?: ProgressCallback
  ): Promise<OperationResult> {
    try {
      // 1. 验证输入
      // 2. 执行压缩
      // 3. 报告进度
      
      return CompressionUtils.createSuccessResult(
        `Successfully compressed to ${targetPath}`,
        { /* 相关数据 */ }
      );
    } catch (error: any) {
      return CompressionUtils.createErrorResult(
        `Compression error: ${error.message}`,
        error.stack
      );
    }
  }
  
  // 实现解压方法
  async decompress(
    sourcePath: string,
    targetDir: string,
    options: DecompressionOptions,
    progressCallback?: ProgressCallback
  ): Promise<OperationResult> {
    // 实现解压逻辑...
  }
  
  // 实现列出内容方法
  async listContents(
    sourcePath: string,
    options: ListOptions,
    progressCallback?: ProgressCallback
  ): Promise<OperationResult> {
    // 实现列表逻辑...
  }
}
```

#### 步骤2: 注册新的处理器

在`src/index.ts`中，修改`registerHandlers`函数：

```typescript
// 导入新的处理器
import { NewFormatHandler } from './handlers/new-format-handler.js';

function registerHandlers() {
  // 现有处理器
  registry.register('gzip', new GzipHandler());
  
  // 添加新处理器
  registry.register('newformat', new NewFormatHandler());
  
  console.log(`Registered ${registry.getHandlerCount()} compression format handlers`);
}
```

#### 步骤3: 测试新格式

无需修改统一工具，它会自动发现并使用新格式。可以这样使用新格式：

```json
{
  "operation": "compress",
  "format": "newformat",
  "sourcePath": "/path/to/file.txt",
  "outputFileName": "compressed-file.newext"
}
```

### 最佳实践和推荐

1. **共享功能使用 CompressionUtils**
   - 路径处理、错误处理、进度报告等通用功能应使用CompressionUtils

2. **处理器只关注格式特定的逻辑**
   - 保持处理器聚焦于特定格式的压缩/解压算法

3. **输入验证在统一工具和处理器中都进行**
   - 统一工具验证基本参数
   - 处理器验证格式特定的要求

4. **进度报告**
   - 使用progressCallback参数报告进度
   - 格式化进度信息可使用`CompressionUtils.formatProgress`

5. **错误处理**
   - 捕获所有可能的异常
   - 使用`CompressionUtils.createErrorResult`创建标准化错误响应

### 通用数据结构

- **CompressionOptions** - 压缩选项
  - `compressionLevel?: number` - 压缩级别(1-9)
  - `outputDirectory?: string` - 输出目录
  - `outputFileName?: string` - 输出文件名

- **DecompressionOptions** - 解压选项
  - `stripComponents?: number` - 忽略的目录层级
  - `outputDirectory?: string` - 输出目录

- **ListOptions** - 列表选项
  - `previewLength?: number` - 预览长度

- **ProgressInfo** - 进度信息
  - `bytesProcessed: number` - 已处理字节数
  - `totalBytes?: number` - 总字节数
  - `percentComplete?: number` - 完成百分比
  - `stage: string` - 当前阶段
  - `detail?: string` - 详细信息

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