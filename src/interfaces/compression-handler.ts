import { 
  ProgressCallback, 
  CompressionOptions, 
  DecompressionOptions, 
  ListOptions, 
  MCPResult 
} from '../utils/compression-utils.js';

/**
 * 压缩处理器返回结果
 */
export interface OperationResult extends MCPResult {}

/**
 * 压缩处理器接口
 * 所有具体的格式处理器必须实现此接口
 */
export interface CompressionHandler {
  /**
   * 获取支持的文件扩展名数组
   */
  getSupportedExtensions(): string[];
  
  /**
   * 获取格式名称
   */
  getFormatName(): string;
  
  /**
   * 检查文件格式是否有效
   * @param filePath 文件路径
   */
  isFormatValid(filePath: string): boolean;
  
  /**
   * 压缩文件或文件夹
   * @param sourcePath 源文件或文件夹路径
   * @param targetPath 目标文件路径
   * @param options 压缩选项
   * @param progressCallback 进度回调函数
   */
  compress(
    sourcePath: string,
    targetPath: string,
    options: CompressionOptions,
    progressCallback?: ProgressCallback
  ): Promise<OperationResult>;
  
  /**
   * 解压文件
   * @param sourcePath 压缩文件路径
   * @param targetDir 目标目录
   * @param options 解压选项
   * @param progressCallback 进度回调函数
   */
  decompress(
    sourcePath: string,
    targetDir: string,
    options: DecompressionOptions,
    progressCallback?: ProgressCallback
  ): Promise<OperationResult>;
  
  /**
   * 列出压缩文件内容
   * @param sourcePath 压缩文件路径
   * @param options 列表选项
   * @param progressCallback 进度回调函数
   */
  listContents(
    sourcePath: string,
    options: ListOptions,
    progressCallback?: ProgressCallback
  ): Promise<OperationResult>;
} 