import path from 'path';
import { z } from 'zod';
import { CompressionUtils } from '../utils/compression-utils.js';
import { FormatRegistry } from '../registry/format-registry.js';

// 操作类型枚举
const OperationType = z.enum(['compress', 'decompress', 'list']);
type OperationType = z.infer<typeof OperationType>;

// 统一的参数模式
const unifiedCompressionParameters = z.object({
  operation: z.enum(['compress', 'decompress', 'list']),
  format: z.string().min(1, 'Format cannot be empty'),
  sourcePath: z.string().min(1, 'Source path cannot be empty'),
  outputDirectory: z.string().optional(),
  outputFileName: z.string().optional(),
  compressionLevel: z.number().min(1).max(9).default(6).optional(),
  stripComponents: z.number().min(0).default(0).optional(),
  previewLength: z.number().min(1).max(10000).default(1000).optional(),
});

/**
 * 创建统一压缩工具
 * @param registry 格式注册表实例
 */
export function createUnifiedCompressionTool(registry: FormatRegistry) {
  return {
    name: 'compression',
    description: `Unified compression tool that supports multiple operations (compress, decompress, list) and formats.
This tool consolidates all compression functionality into a single interface.

Formats supported: ${registry.getAllFormats().join(', ')}

Operations:
- compress: Compress a file or directory
- decompress: Extract a compressed file
- list: Show contents of a compressed file

Each operation has specific parameters. See examples below.`,
    parameters: unifiedCompressionParameters,
    async execute(params: z.infer<typeof unifiedCompressionParameters>) {
      try {
        const { operation, format, sourcePath } = params;
        
        // 获取适当的处理器
        const handler = registry.getHandlerByFormat(format);
        if (!handler) {
          return CompressionUtils.createErrorResult(
            `Unsupported format: ${format}`,
            `Supported formats are: ${registry.getAllFormats().join(', ')}`
          );
        }
        
        // 检查源路径是否存在
        if (!await CompressionUtils.fileExists(sourcePath)) {
          return CompressionUtils.createErrorResult(`Source path does not exist: ${sourcePath}`);
        }
        
        // 根据操作类型分发到适当的处理器方法
        switch (operation) {
          case 'compress': {
            const { outputDirectory, outputFileName, compressionLevel } = params;
            
            // 检查是否是目录或文件
            const isDirectory = await CompressionUtils.isDirectory(sourcePath);
            const isFile = await CompressionUtils.isFile(sourcePath);
            
            if (!isDirectory && !isFile) {
              return CompressionUtils.createErrorResult(
                `Source path must be a file or directory: ${sourcePath}`
              );
            }
            
            // 确定扩展名
            const extensions = handler.getSupportedExtensions();
            const defaultExt = extensions.length > 0 ? extensions[0] : '';
            
            // 解析输出路径
            const targetPath = CompressionUtils.resolveOutputPath(
              sourcePath, 
              outputDirectory, 
              outputFileName,
              defaultExt
            );
            
            // 检查输出文件是否已存在
            if (await CompressionUtils.fileExists(targetPath)) {
              return CompressionUtils.createErrorResult(
                `Output file already exists: ${targetPath}`,
                'Please specify a different output file name or directory'
              );
            }
            
            // 执行压缩
            return handler.compress(
              sourcePath, 
              targetPath, 
              { compressionLevel: compressionLevel || 6 }
            );
          }
          
          case 'decompress': {
            const { outputDirectory, stripComponents } = params;
            
            // 检查源路径是否为文件
            if (!await CompressionUtils.isFile(sourcePath)) {
              return CompressionUtils.createErrorResult(
                `Source path must be a file: ${sourcePath}`
              );
            }
            
            // 检查格式是否有效
            if (!handler.isFormatValid(sourcePath)) {
              return CompressionUtils.createErrorResult(
                `File is not a valid ${format} file: ${sourcePath}`,
                `Expected file extensions: ${handler.getSupportedExtensions().join(', ')}`
              );
            }
            
            // 解析输出目录
            const targetDir = outputDirectory || path.dirname(sourcePath);
            
            // 确保输出目录存在
            await CompressionUtils.ensureDir(targetDir);
            
            // 执行解压
            return handler.decompress(
              sourcePath, 
              targetDir, 
              { stripComponents: stripComponents || 0 }
            );
          }
          
          case 'list': {
            const { previewLength } = params;
            
            // 检查源路径是否为文件
            if (!await CompressionUtils.isFile(sourcePath)) {
              return CompressionUtils.createErrorResult(
                `Source path must be a file: ${sourcePath}`
              );
            }
            
            // 检查格式是否有效
            if (!handler.isFormatValid(sourcePath)) {
              return CompressionUtils.createErrorResult(
                `File is not a valid ${format} file: ${sourcePath}`,
                `Expected file extensions: ${handler.getSupportedExtensions().join(', ')}`
              );
            }
            
            // 执行内容列表
            return handler.listContents(
              sourcePath, 
              { previewLength: previewLength || 1000 }
            );
          }
          
          default:
            // 这里不应该到达，因为zod已经验证了operation类型
            return CompressionUtils.createErrorResult(
              `Unsupported operation: ${operation as string}`,
              `Supported operations are: compress, decompress, list`
            );
        }
      } catch (error: any) {
        return CompressionUtils.createErrorResult(
          `Error during ${params.operation} operation: ${error.message}`,
          error.stack
        );
      }
    }
  };
}