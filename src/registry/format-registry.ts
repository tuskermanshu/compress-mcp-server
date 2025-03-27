import { CompressionHandler } from '../interfaces/compression-handler.js';

/**
 * 格式注册表 - 管理所有压缩格式处理器
 */
export class FormatRegistry {
  private handlers: Map<string, CompressionHandler> = new Map();
  private extensionMap: Map<string, CompressionHandler> = new Map();
  
  /**
   * 注册新的格式处理器
   * @param formatName 格式名称
   * @param handler 处理器实例
   */
  register(formatName: string, handler: CompressionHandler): void {
    // 注册格式名称
    this.handlers.set(formatName.toLowerCase(), handler);
    
    // 注册所有支持的扩展名
    const extensions = handler.getSupportedExtensions();
    for (const ext of extensions) {
      this.extensionMap.set(ext.toLowerCase(), handler);
    }
  }
  
  /**
   * 通过格式名称获取处理器
   * @param formatName 格式名称
   * @returns 对应的处理器实例，找不到则返回undefined
   */
  getHandlerByFormat(formatName: string): CompressionHandler | undefined {
    return this.handlers.get(formatName.toLowerCase());
  }
  
  /**
   * 通过文件扩展名获取处理器
   * @param extension 文件扩展名
   * @returns 对应的处理器实例，找不到则返回undefined
   */
  getHandlerByExtension(extension: string): CompressionHandler | undefined {
    const ext = extension.toLowerCase();
    // 首先检查复合扩展名
    if (ext.endsWith('.tar.gz') && this.extensionMap.has('.tar.gz')) {
      return this.extensionMap.get('.tar.gz');
    }
    
    return this.extensionMap.get(ext);
  }
  
  /**
   * 通过文件路径获取合适的处理器
   * @param filePath 文件路径
   * @returns 对应的处理器实例，找不到则返回undefined
   */
  getHandlerForFile(filePath: string): CompressionHandler | undefined {
    for (const handler of this.handlers.values()) {
      if (handler.isFormatValid(filePath)) {
        return handler;
      }
    }
    return undefined;
  }
  
  /**
   * 获取所有已注册的格式
   * @returns 格式名称数组
   */
  getAllFormats(): string[] {
    return Array.from(this.handlers.keys());
  }
  
  /**
   * 获取所有支持的扩展名
   * @returns 扩展名数组
   */
  getAllExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }
  
  /**
   * 获取已注册的处理器数量
   * @returns 处理器数量
   */
  getHandlerCount(): number {
    return this.handlers.size;
  }
} 