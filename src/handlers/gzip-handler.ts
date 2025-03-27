import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { CompressionHandler, OperationResult } from '../interfaces/compression-handler.js';
import { 
  CompressionUtils, 
  ProgressCallback, 
  CompressionOptions, 
  DecompressionOptions, 
  ListOptions
} from '../utils/compression-utils.js';

/**
 * GZIP格式处理器
 * 处理.gz格式文件的压缩和解压
 */
export class GzipHandler implements CompressionHandler {
  /**
   * 获取支持的文件扩展名
   */
  getSupportedExtensions(): string[] {
    return ['.gz'];
  }

  /**
   * 获取格式名称
   */
  getFormatName(): string {
    return 'gzip';
  }

  /**
   * 检查文件格式是否有效
   */
  isFormatValid(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.gz');
  }

  /**
   * 压缩文件
   */
  async compress(
    sourcePath: string,
    targetPath: string,
    options: CompressionOptions,
    progressCallback?: ProgressCallback
  ): Promise<OperationResult> {
    try {
      // 验证源文件存在且为文件
      if (!await CompressionUtils.fileExists(sourcePath)) {
        return CompressionUtils.createErrorResult(`Source file does not exist: ${sourcePath}`);
      }

      if (!await CompressionUtils.isFile(sourcePath)) {
        return CompressionUtils.createErrorResult(
          `Source path is not a file: ${sourcePath}`,
          'Please use a regular file for gzip compression.'
        );
      }

      // 获取源文件大小
      const sourceSize = await CompressionUtils.getFileSize(sourcePath);
      
      // 确保目标目录存在
      const targetDir = path.dirname(targetPath);
      await CompressionUtils.ensureDir(targetDir);

      // 设置压缩级别
      const compressionLevel = options.compressionLevel || 6;
      
      // 创建读写流和gzip压缩流
      const sourceStream = createReadStream(sourcePath);
      const gzipStream = createGzip({ level: compressionLevel });
      const targetStream = createWriteStream(targetPath);
      
      // 进度跟踪
      let processedBytes = 0;
      if (progressCallback) {
        progressCallback(CompressionUtils.formatProgress(0, sourceSize, 'compressing'));
        
        sourceStream.on('data', (chunk) => {
          processedBytes += chunk.length;
          progressCallback!(CompressionUtils.formatProgress(
            processedBytes, 
            sourceSize, 
            'compressing'
          ));
        });
      }

      // 执行压缩
      await pipeline(sourceStream, gzipStream, targetStream);
      
      // 获取压缩后文件大小计算压缩比
      const compressedSize = await CompressionUtils.getFileSize(targetPath);
      const ratio = CompressionUtils.formatCompressionRatio(sourceSize, compressedSize);
      
      // 返回成功结果
      return CompressionUtils.createSuccessResult(
        `Successfully compressed file to ${targetPath}`,
        {
          originalSize: sourceSize,
          compressedSize,
          compressionRatio: ratio,
          sourcePath,
          targetPath
        }
      );
    } catch (error: any) {
      return CompressionUtils.createErrorResult(
        `Error compressing file: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * 解压文件
   */
  async decompress(
    sourcePath: string,
    targetDir: string,
    options: DecompressionOptions,
    progressCallback?: ProgressCallback
  ): Promise<OperationResult> {
    try {
      // 验证源文件存在且为文件
      if (!await CompressionUtils.fileExists(sourcePath)) {
        return CompressionUtils.createErrorResult(`Source file does not exist: ${sourcePath}`);
      }

      if (!await CompressionUtils.isFile(sourcePath)) {
        return CompressionUtils.createErrorResult(`Source path is not a file: ${sourcePath}`);
      }

      // 确保目标目录存在
      await CompressionUtils.ensureDir(targetDir);
      
      // 确定输出文件名，默认移除.gz扩展名
      const sourceBaseName = path.basename(sourcePath);
      let targetFileName = sourceBaseName;
      
      if (sourceBaseName.endsWith('.gz')) {
        targetFileName = sourceBaseName.slice(0, -3);
      }
      
      const targetPath = path.join(targetDir, targetFileName);
      
      // 获取源文件大小
      const sourceSize = await CompressionUtils.getFileSize(sourcePath);
      
      // 创建读写流和gunzip解压流
      const sourceStream = createReadStream(sourcePath);
      const gunzipStream = createGunzip();
      const targetStream = createWriteStream(targetPath);
      
      // 进度跟踪
      let processedBytes = 0;
      if (progressCallback) {
        progressCallback(CompressionUtils.formatProgress(0, sourceSize, 'decompressing'));
        
        sourceStream.on('data', (chunk) => {
          processedBytes += chunk.length;
          progressCallback!(CompressionUtils.formatProgress(
            processedBytes, 
            sourceSize, 
            'decompressing'
          ));
        });
      }

      // 执行解压
      await pipeline(sourceStream, gunzipStream, targetStream);
      
      // 获取解压后文件大小
      const decompressedSize = await CompressionUtils.getFileSize(targetPath);
      
      // 返回成功结果
      return CompressionUtils.createSuccessResult(
        `Successfully decompressed file to ${targetPath}`,
        {
          compressedSize: sourceSize,
          decompressedSize,
          expansionRatio: CompressionUtils.formatCompressionRatio(sourceSize, decompressedSize),
          sourcePath,
          targetPath
        }
      );
    } catch (error: any) {
      return CompressionUtils.createErrorResult(
        `Error decompressing file: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * 列出压缩文件内容
   */
  async listContents(
    sourcePath: string,
    options: ListOptions,
    progressCallback?: ProgressCallback
  ): Promise<OperationResult> {
    try {
      // 验证源文件存在且为文件
      if (!await CompressionUtils.fileExists(sourcePath)) {
        return CompressionUtils.createErrorResult(`Source file does not exist: ${sourcePath}`);
      }

      if (!await CompressionUtils.isFile(sourcePath)) {
        return CompressionUtils.createErrorResult(`Source path is not a file: ${sourcePath}`);
      }

      // 检查是否为有效的gzip文件
      if (!this.isFormatValid(sourcePath)) {
        return CompressionUtils.createErrorResult(
          `File is not a valid gzip file: ${sourcePath}`,
          'File must have .gz extension'
        );
      }

      // 获取源文件大小
      const sourceSize = await CompressionUtils.getFileSize(sourcePath);
      
      // 预览长度
      const previewLength = options.previewLength || 1000;
      
      if (progressCallback) {
        progressCallback(CompressionUtils.formatProgress(0, sourceSize, 'reading'));
      }
      
      // 创建临时缓冲区接收解压数据
      const chunks: Buffer[] = [];
      let totalLength = 0;
      
      // 初始化读取流和gunzip流
      const sourceStream = createReadStream(sourcePath);
      const gunzipStream = createGunzip();
      
      gunzipStream.on('data', (chunk) => {
        chunks.push(chunk);
        totalLength += chunk.length;
        
        // 如果已经读取足够长度，停止读取
        if (totalLength >= previewLength) {
          sourceStream.destroy();
          gunzipStream.destroy();
        }
        
        if (progressCallback) {
          progressCallback(CompressionUtils.formatProgress(
            Math.min(totalLength, sourceSize),
            sourceSize,
            'reading'
          ));
        }
      });
      
      // 执行读取
      try {
        await pipeline(sourceStream, gunzipStream);
      } catch (error: any) {
        // 手动中断导致的错误可以忽略
        if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
          throw error;
        }
      }
      
      // 连接所有缓冲区
      const buffer = Buffer.concat(chunks, totalLength);
      let previewContent = buffer.toString('utf8', 0, Math.min(previewLength, totalLength));
      
      // 文件名（不含.gz扩展名）
      const originalFileName = CompressionUtils.removeExtension(path.basename(sourcePath), '.gz');
      
      if (progressCallback) {
        progressCallback(CompressionUtils.formatProgress(
          sourceSize,
          sourceSize,
          'complete'
        ));
      }
      
      // 返回成功结果
      return CompressionUtils.createSuccessResult(
        `Content preview of ${sourcePath}`,
        {
          fileName: originalFileName,
          compressedSize: sourceSize,
          previewSize: totalLength,
          preview: previewContent,
          isTruncated: totalLength > previewLength
        }
      );
    } catch (error: any) {
      return CompressionUtils.createErrorResult(
        `Error reading compressed file: ${error.message}`,
        error.stack
      );
    }
  }
} 