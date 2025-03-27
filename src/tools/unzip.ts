import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { join, basename, dirname, isAbsolute, resolve, normalize } from 'path';
import { createGunzip } from 'zlib';
import { z } from 'zod';
import { pipeline } from 'stream/promises';

// 解压工具参数定义 - 使用更严格的验证
const unzipParameters = z.object({
  sourceFilePath: z.string()
    .min(1, "File path cannot be empty")
    .refine(path => {
      try {
        return normalize(path) === path; // Ensure path is normalized to prevent path traversal attacks
      } catch {
        return false;
      }
    }, "Invalid file path")
    .refine(path => path.endsWith('.gz'), "File must be in .gz format")
    .describe("Path to the gzip file to decompress"),
  outputDirectory: z.string().optional()
    .refine(path => {
      if (!path) return true;
      try {
        return normalize(path) === path;
      } catch {
        return false;
      }
    }, "Invalid output directory path")
    .describe("Output directory (defaults to source file's directory)"),
  outputFileName: z.string().optional()
    .refine(name => {
      if (!name) return true;
      return !name.includes('/') && !name.includes('\\'); // 防止路径注入
    }, "Filename cannot contain path separators")
    .describe("Output filename (defaults to original file name without .gz suffix)"),
});

// 导出解压工具创建函数
export function createUnzipTool() {
  return {
    name: "unzip",
    description: "Decompress gzip files. Specify output directory and filename. Supports progress reporting. Suitable for decompressing .gz files.",
    parameters: unzipParameters,
    execute: async (args: z.infer<typeof unzipParameters>, { reportProgress }: { reportProgress: (progress: { progress: number, total: number, message?: string }) => void }) => {
      const { sourceFilePath, outputDirectory, outputFileName } = args;

      try {
        // 路径安全检查
        const absoluteSourcePath = isAbsolute(sourceFilePath) 
          ? sourceFilePath 
          : resolve(process.cwd(), sourceFilePath);
        
        // 检查源文件是否存在
        let fileStats;
        try {
          fileStats = await fs.stat(absoluteSourcePath);
          if (!fileStats.isFile()) {
            return {
              isError: true,
              content: [{ type: "text", text: `Error: ${absoluteSourcePath} is not a file` }]
            };
          }
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot access file ${absoluteSourcePath}. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // 确定输出目录和文件名
        const baseDir = dirname(absoluteSourcePath);
        const outputDir = outputDirectory 
          ? (isAbsolute(outputDirectory) ? outputDirectory : resolve(process.cwd(), outputDirectory))
          : baseDir;
        
        // 默认输出文件名是去掉.gz后缀
        let baseOutputFileName = outputFileName;
        if (!baseOutputFileName) {
          const srcFilename = basename(absoluteSourcePath);
          baseOutputFileName = srcFilename.endsWith('.gz') 
            ? srcFilename.slice(0, -3) 
            : `${srcFilename}.extracted`;
        }
        
        const outputPath = join(outputDir, baseOutputFileName);

        // 确保输出目录存在
        try {
          await fs.mkdir(outputDir, { recursive: true });
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot create output directory ${outputDir}. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // 报告开始解压
        reportProgress({
          progress: 0,
          total: 100,
          message: `Starting decompression of ${absoluteSourcePath}...`
        });

        // 创建读取流、解压流和写入流
        let source, destination;
        try {
          source = createReadStream(absoluteSourcePath);
          destination = createWriteStream(outputPath);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot create file streams. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
        
        const gunzip = createGunzip();

        // 设置进度报告
        const totalSize = fileStats.size;
        let processedBytes = 0;

        source.on('data', (chunk) => {
          processedBytes += chunk.length;
          const progress = Math.round((processedBytes / totalSize) * 100);
          
          reportProgress({
            progress,
            total: 100,
            message: `Decompressing... ${progress}%`
          });
        });

        // 执行解压
        try {
          await pipeline(source, gunzip, destination);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error during decompression: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // 获取解压后文件大小用于报告
        let extractedStats;
        try {
          extractedStats = await fs.stat(outputPath);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot get decompressed file information: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // 报告完成
        reportProgress({
          progress: 100,
          total: 100,
          message: "Decompression completed!"
        });

        // 计算解压率
        const extractionRatio = ((extractedStats.size / fileStats.size) - 1) * 100;
        const extractionRatioFormatted = extractionRatio > 0 
          ? `+${extractionRatio.toFixed(2)}%` 
          : `${extractionRatio.toFixed(2)}%`;

        return {
          content: [
            { 
              type: "text", 
              text: `File successfully decompressed to: ${outputPath}\nCompressed file size: ${fileStats.size} bytes\nDecompressed size: ${extractedStats.size} bytes\nExpansion ratio: ${extractionRatioFormatted}` 
            }
          ]
        };
      } catch (error) {
        console.error('Error during decompression:', error);
        return {
          isError: true,
          content: [{ type: "text", text: `Decompression failed: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  };
} 