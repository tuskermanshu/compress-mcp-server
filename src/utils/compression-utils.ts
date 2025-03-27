import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// 异步文件操作
const fsAccess = promisify(fs.access);
const fsStat = promisify(fs.stat);
const fsMkdir = promisify(fs.mkdir);

// MCP返回类型
export interface MCPResult {
  isError: boolean;
  content?: {
    text: string;
    [key: string]: any;
  };
  error?: {
    message: string;
    details?: string;
  };
}

// 进度信息接口
export interface ProgressInfo {
  bytesProcessed: number;
  totalBytes?: number;
  percentComplete?: number;
  stage: string;
  detail?: string;
}

export type ProgressCallback = (progress: ProgressInfo) => void;

// 压缩选项
export interface CompressionOptions {
  compressionLevel?: number;
  outputDirectory?: string;
  outputFileName?: string;
  [key: string]: any;
}

// 解压选项
export interface DecompressionOptions {
  stripComponents?: number;
  outputDirectory?: string;
  [key: string]: any;
}

// 列表选项
export interface ListOptions {
  previewLength?: number;
  [key: string]: any;
}

/**
 * 压缩工具通用功能
 */
export class CompressionUtils {
  /**
   * 规范化文件路径，防止路径遍历攻击
   */
  static normalizePath(filePath: string): string {
    const normalized = path.normalize(filePath);
    // 防止路径遍历攻击
    if (normalized.includes('..')) {
      throw new Error('Path traversal detected. Path cannot contain ".."');
    }
    return normalized;
  }

  /**
   * 检查文件是否存在
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsAccess(filePath, fs.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查路径是否为文件
   */
  static async isFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fsStat(filePath);
      return stats.isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查路径是否为目录
   */
  static async isDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await fsStat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * 确保目录存在，如果不存在则创建
   */
  static async ensureDir(dirPath: string): Promise<void> {
    try {
      await fsAccess(dirPath, fs.constants.F_OK);
      // 确认是目录
      if (!await this.isDirectory(dirPath)) {
        throw new Error(`Path exists but is not a directory: ${dirPath}`);
      }
    } catch (error: any) {
      // 目录不存在，创建它
      await fsMkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 获取文件大小
   */
  static async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fsStat(filePath);
      return stats.size;
    } catch (error: any) {
      throw new Error(`Failed to get file size: ${error.message}`);
    }
  }

  /**
   * 解析输出路径
   */
  static resolveOutputPath(
    sourcePath: string, 
    outputDir?: string, 
    outputFileName?: string,
    defaultExt?: string
  ): string {
    // 如果没有提供输出目录，使用源文件目录
    const sourceDir = path.dirname(sourcePath);
    const targetDir = outputDir || sourceDir;
    
    // 如果没有提供输出文件名，基于源文件名生成
    if (!outputFileName) {
      const sourceBaseName = path.basename(sourcePath);
      if (defaultExt) {
        // 如果提供了默认扩展名，添加它
        outputFileName = `${sourceBaseName}${defaultExt}`;
      } else {
        outputFileName = sourceBaseName;
      }
    }
    
    return path.join(targetDir, outputFileName);
  }

  /**
   * 计算和格式化压缩比率
   */
  static formatCompressionRatio(originalSize: number, compressedSize: number): string {
    const ratio = (compressedSize / originalSize) * 100;
    return `${ratio.toFixed(2)}%`;
  }

  /**
   * 创建成功结果
   */
  static createSuccessResult(message: string, data?: Record<string, any>): MCPResult {
    return {
      isError: false,
      content: {
        text: message,
        ...data
      }
    };
  }

  /**
   * 创建错误结果
   */
  static createErrorResult(message: string, details?: string): MCPResult {
    return {
      isError: true,
      error: {
        message,
        details
      }
    };
  }

  /**
   * 获取文件扩展名（支持复合扩展名如.tar.gz）
   */
  static getFileExtension(filePath: string): string {
    const basename = path.basename(filePath);
    
    // 检查特殊的复合扩展名
    if (basename.endsWith('.tar.gz')) {
      return '.tar.gz';
    }
    
    return path.extname(filePath);
  }

  /**
   * 移除文件扩展名（支持复合扩展名）
   */
  static removeExtension(filePath: string, extension?: string): string {
    const ext = extension || this.getFileExtension(filePath);
    
    if (ext && filePath.endsWith(ext)) {
      return filePath.slice(0, -ext.length);
    }
    
    return filePath;
  }

  /**
   * 格式化进度信息
   */
  static formatProgress(
    bytesProcessed: number, 
    totalBytes?: number, 
    stage?: string, 
    detail?: string
  ): ProgressInfo {
    const progress: ProgressInfo = {
      bytesProcessed,
      stage: stage || 'processing',
    };
    
    if (totalBytes) {
      progress.totalBytes = totalBytes;
      progress.percentComplete = Math.min(Math.round((bytesProcessed / totalBytes) * 100), 100);
    }
    
    if (detail) {
      progress.detail = detail;
    }
    
    return progress;
  }

  /**
   * 格式化字节大小为人类可读格式
   */
  static formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
} 