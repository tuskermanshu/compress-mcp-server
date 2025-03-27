import { promises as fs } from 'fs';
import { join, basename, dirname, isAbsolute, resolve, normalize } from 'path';
import { z } from 'zod';
import * as JSZip from 'jszip';

// ZIP压缩工具参数定义
const zipArchiveParameters = z.object({
  sourcePath: z.string()
    .min(1, "路径不能为空")
    .refine(path => {
      try {
        return normalize(path) === path; // 确保路径已规范化，防止路径遍历攻击
      } catch {
        return false;
      }
    }, "路径无效")
    .describe("要压缩的文件或文件夹路径"),
  outputDirectory: z.string().optional()
    .transform(dir => dir || '')
    .refine(dir => {
      if (!dir) return true;
      try {
        return normalize(dir) === dir; // 确保路径已规范化，防止路径遍历攻击
      } catch {
        return false;
      }
    }, "输出目录路径无效")
    .describe("输出目录（默认为源文件所在目录）"),
  outputFileName: z.string().optional()
    .refine(name => {
      if (!name) return true;
      return !name.includes('/') && !name.includes('\\'); // 确保文件名不包含路径分隔符
    }, "文件名不能包含路径分隔符")
    .describe("输出文件名（默认为原文件或文件夹名+.zip）"),
  compressionLevel: z.number().int().min(1).max(9).default(6)
    .describe("压缩级别 (1-9)，值越大压缩比越高但速度越慢")
});

// 递归获取文件夹中的所有文件
async function getFilesRecursively(dir: string, rootDir: string): Promise<{filePath: string, relativePath: string}[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  const files: {filePath: string, relativePath: string}[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = fullPath.replace(rootDir + '/', '');
    
    if (entry.isDirectory()) {
      const subDirFiles = await getFilesRecursively(fullPath, rootDir);
      files.push(...subDirFiles);
    } else {
      files.push({
        filePath: fullPath,
        relativePath: relPath
      });
    }
  }
  
  return files;
}

// 导出ZIP压缩工具
export function createZipArchiveTool() {
  return {
    name: "zip-archive",
    description: "Use ZIP format to compress files or folders. Specify output directory, filename, and compression level. Supports progress reporting.",
    parameters: zipArchiveParameters,
    execute: async (args: z.infer<typeof zipArchiveParameters>, { reportProgress }: { reportProgress: (progress: { progress: number, total: number, message?: string }) => void }) => {
      const { sourcePath, outputDirectory, outputFileName, compressionLevel } = args;

      try {
        // 路径规范化处理
        const absoluteSourcePath = isAbsolute(sourcePath) 
          ? sourcePath 
          : resolve(process.cwd(), sourcePath);

        // 检查源路径是否存在
        let sourceStats;
        try {
          sourceStats = await fs.stat(absoluteSourcePath);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot access path ${absoluteSourcePath}. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // 处理输出目录
        const sourceDir = dirname(absoluteSourcePath);
        const targetDir = outputDirectory 
          ? (isAbsolute(outputDirectory) ? outputDirectory : resolve(process.cwd(), outputDirectory))
          : sourceDir;
        
        // 确保输出目录存在
        try {
          await fs.mkdir(targetDir, { recursive: true });
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot create output directory: ${targetDir}. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // 处理输出文件名
        const sourceBase = basename(absoluteSourcePath);
        const targetName = outputFileName || `${sourceBase}.zip`;
        const targetPath = join(targetDir, targetName);

        // 确保不会覆盖已有文件（除非明确指定文件名）
        if (!outputFileName) {
          try {
            await fs.access(targetPath);
            // 文件已存在，自动重命名
            const timestamp = new Date().getTime();
            const newTargetName = `${sourceBase}_${timestamp}.zip`;
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: `Warning: Output file ${targetPath} already exists. Please use a different output filename, e.g.: ${newTargetName}` 
              }]
            };
          } catch {
            // 文件不存在，可以继续
          }
        }

        // 创建ZIP对象
        const zip = new JSZip.default();

        reportProgress({
          progress: 0,
          total: 100,
          message: "Starting ZIP compression..."
        });

        // 处理压缩
        let files: {filePath: string, relativePath: string}[] = [];
        let totalSize = 0;
        
        if (sourceStats.isDirectory()) {
          // 如果是文件夹，递归获取所有文件
          reportProgress({
            progress: 5,
            total: 100,
            message: "Scanning folder..."
          });
          
          files = await getFilesRecursively(absoluteSourcePath, absoluteSourcePath);
          
          if (files.length === 0) {
            return {
              isError: true,
              content: [{ type: "text", text: `Warning: Folder ${absoluteSourcePath} is empty` }]
            };
          }
          
          // 计算总大小
          for (const file of files) {
            const stats = await fs.stat(file.filePath);
            totalSize += stats.size;
          }
          
          reportProgress({
            progress: 10,
            total: 100,
            message: `Found ${files.length} files, starting compression...`
          });
          
          // 添加文件到ZIP
          let processedSize = 0;
          let processedFiles = 0;
          
          for (const file of files) {
            const fileBuffer = await fs.readFile(file.filePath);
            zip.file(file.relativePath, fileBuffer, {
              compression: 'DEFLATE',
              compressionOptions: {
                level: compressionLevel
              }
            });
            
            // 更新进度
            processedFiles++;
            processedSize += fileBuffer.length;
            const fileProgress = Math.round(10 + ((processedSize / totalSize) * 80));
            
            reportProgress({
              progress: fileProgress,
              total: 100,
              message: `ZIP compression... ${processedFiles}/${files.length} files (${fileProgress}%)`
            });
          }
        } else {
          // 如果是单个文件
          const fileBuffer = await fs.readFile(absoluteSourcePath);
          totalSize = fileBuffer.length;
          
          zip.file(sourceBase, fileBuffer, {
            compression: 'DEFLATE',
            compressionOptions: {
              level: compressionLevel
            }
          });
          
          reportProgress({
            progress: 50,
            total: 100,
            message: "Compressing file..."
          });
        }
        
        // 生成ZIP文件
        reportProgress({
          progress: 90,
          total: 100,
          message: "Generating ZIP file..."
        });
        
        const zipBuffer = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: {
            level: compressionLevel
          }
        }, (metadata) => {
          reportProgress({
            progress: 90 + Math.floor(metadata.percent / 10),
            total: 100,
            message: `Generating ZIP file: ${Math.floor(metadata.percent)}%`
          });
        });
        
        // 写入文件
        await fs.writeFile(targetPath, zipBuffer);
        
        // 获取压缩后文件大小
        const compressedStats = await fs.stat(targetPath);
        
        // 计算压缩比
        const compressionRatio = parseFloat((totalSize / compressedStats.size).toFixed(2));
        
        // 报告完成
        reportProgress({
          progress: 100,
          total: 100,
          message: "ZIP compression completed!"
        });

        return {
          content: [
            { 
              type: "text", 
              text: `ZIP compression successful:
Source path: ${absoluteSourcePath} ${sourceStats.isDirectory() ? `(${files.length} files)` : ''}
ZIP file: ${targetPath}
Original size: ${totalSize} bytes
Compressed size: ${compressedStats.size} bytes
Compression ratio: ${compressionRatio}:1
Compression level: ${compressionLevel}
` 
            }
          ]
        };
      } catch (error) {
        console.error('Error during ZIP compression:', error);
        return {
          isError: true,
          content: [{ type: "text", text: `ZIP compression failed: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  };
} 