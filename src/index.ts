import { FastMCP } from 'fastmcp';
import { FormatRegistry } from './registry/format-registry.js';
import { GzipHandler } from './handlers/gzip-handler.js';

// 服务器版本
const SERVER_VERSION = '2.1.0';

// 创建格式注册表
const registry = new FormatRegistry();

/**
 * 注册所有格式处理器
 */
function registerHandlers() {
  // 注册GZIP处理器
  registry.register('gzip', new GzipHandler());
  
  // 这里添加其他格式处理器，如TarGzHandler, ZipHandler, SevenZipHandler等
  
  console.log(`Registered ${registry.getHandlerCount()} compression format handlers`);
}

/**
 * 安全添加工具，捕获可能的错误
 * @param server MCP服务器实例
 * @param tool 工具对象
 * @param toolName 工具名称（用于日志）
 */
function addToolSafely(server: any, tool: any, toolName: string) {
  try {
    server.addTool(tool);
    console.log(`Successfully loaded tool: ${toolName}`);
  } catch (error: any) {
    console.error(`Failed to load tool ${toolName}: ${error.message}`);
  }
}

// 启动主程序
async function main() {
  try {
    // 注册所有格式处理器
    registerHandlers();

    // 创建MCP服务器 - 使用any类型绕过TypeScript类型检查
    const serverOptions: any = {
      name: `Compression MCP Server v${SERVER_VERSION}`,
      version: SERVER_VERSION,
      transport: 'stdio'  // 明确指定传输类型为stdio
    };
    const server = new FastMCP(serverOptions);

    // 动态导入旧工具模块
    const zipModule = await import('./tools/zip.js');
    const unzipModule = await import('./tools/unzip.js');
    const listZipContentsModule = await import('./tools/list-zip-contents.js');
    const zipFolderModule = await import('./tools/zip-folder.js');
    const unzipFolderModule = await import('./tools/unzip-folder.js');
    const zipArchiveModule = await import('./tools/zip-archive.js');
    const sevenZipArchiveModule = await import('./tools/7z-archive.js');

    // 添加旧的独立工具（向后兼容）- 调用工具创建函数
    addToolSafely(server, zipModule.createZipTool(), 'zip');
    addToolSafely(server, unzipModule.createUnzipTool(), 'unzip');
    addToolSafely(server, listZipContentsModule.createZipContentsTool(), 'list-zip-contents');
    addToolSafely(server, zipFolderModule.createZipFolderTool(), 'zip-folder');
    addToolSafely(server, unzipFolderModule.createUnzipFolderTool(), 'unzip-folder');
    addToolSafely(server, zipArchiveModule.createZipArchiveTool(), 'zip-archive');
    addToolSafely(server, sevenZipArchiveModule.create7zArchiveTool(), '7z-archive');

    // 导入并添加统一压缩工具
    const { createUnifiedCompressionTool } = await import('./tools/unified-compression.js');
    const unifiedCompressionTool = createUnifiedCompressionTool(registry);
    addToolSafely(server, unifiedCompressionTool, 'compression');

    console.log('All tools loaded successfully!');

    // 连接/断开连接事件处理 - 简化为直接使用服务器实例
    try {
      // 使用connect/disconnect事件名称，兼容性更好
      server.on('connect', () => {
        console.log('Client connected to compression MCP server');
      });
      
      server.on('disconnect', () => {
        console.log('Client disconnected from compression MCP server');
      });
    } catch (error) {
      console.error('Could not register event handlers:', error);
    }

    // 启动服务器 - 使用服务器实例直接启动
    try {
      // 直接使用start方法，不传参数
      server.start();
      console.log(`Compression MCP Server v${SERVER_VERSION} is running`);
      console.log(`Supported formats: ${registry.getAllFormats().join(', ')}`);
      console.log('Ready to handle compression and decompression requests');
    } catch (error: any) {
      console.error(`Error starting server: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`Error starting server: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行主程序
main(); 