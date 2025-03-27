import { promises as fs } from 'fs';
import * as Seven from 'node-7z';
import { join, dirname, basename, resolve, isAbsolute, normalize } from 'path';
import { z } from 'zod';

// 7z compression tool parameter definition
const sevenZipParameters = z.object({
  sourcePath: z.string()
    .min(1, "File path cannot be empty")
    .refine(path => {
      try {
        return normalize(path) === path;
      } catch {
        return false;
      }
    }, "Invalid file path")
    .describe("Path to the file or folder to compress"),
  outputDirectory: z.string().optional()
    .transform(dir => dir || '')
    .refine(dir => {
      if (!dir) return true;
      try {
        return normalize(dir) === dir;
      } catch {
        return false;
      }
    }, "Invalid output directory path")
    .describe("Output directory (defaults to source file's directory)"),
  outputFileName: z.string().optional()
    .refine(name => {
      if (!name) return true;
      return !name.includes('/') && !name.includes('\\');
    }, "Filename cannot contain path separators")
    .describe("Output filename (defaults to original file or folder name + .7z)"),
  compressionLevel: z.number().int().min(1).max(9).default(6)
    .describe("Compression level (1-9), higher values provide better compression but slower speed")
});

// Export 7z compression tool
export function create7zArchiveTool() {
  return {
    name: "7z-archive",
    description: "Use 7z format to compress files or folders. Specify output directory, filename, and compression level. Supports progress reporting. Requires 7-Zip to be installed on the system.",
    parameters: sevenZipParameters,
    execute: async (args: z.infer<typeof sevenZipParameters>, { reportProgress }: { reportProgress: (progress: { progress: number, total: number, message?: string }) => void }) => {
      const { sourcePath, outputDirectory, outputFileName, compressionLevel } = args;

      try {
        // Path normalization
        const absoluteSourcePath = isAbsolute(sourcePath) 
          ? sourcePath 
          : resolve(process.cwd(), sourcePath);

        // Check if source path exists
        let stats;
        try {
          stats = await fs.stat(absoluteSourcePath);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot access ${absoluteSourcePath}. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // Process output directory
        const sourceDir = dirname(absoluteSourcePath);
        const targetDir = outputDirectory 
          ? (isAbsolute(outputDirectory) ? outputDirectory : resolve(process.cwd(), outputDirectory))
          : sourceDir;
        
        // Ensure output directory exists
        try {
          await fs.mkdir(targetDir, { recursive: true });
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot create output directory: ${targetDir}. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // Process output filename
        const sourceBase = basename(absoluteSourcePath);
        const targetName = outputFileName || `${sourceBase}.7z`;
        const targetPath = join(targetDir, targetName);

        // Ensure we don't overwrite existing files (unless filename is explicitly specified)
        if (!outputFileName) {
          try {
            await fs.access(targetPath);
            // File already exists, suggest automatic renaming
            const timestamp = new Date().getTime();
            const newTargetName = `${sourceBase}_${timestamp}.7z`;
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: `Warning: Output file ${targetPath} already exists. Please use a different filename, for example: ${newTargetName}` 
              }]
            };
          } catch {
            // File doesn't exist, proceed
          }
        }

        // Report starting compression
        reportProgress({
          progress: 0,
          total: 100,
          message: `Starting 7z compression of ${absoluteSourcePath}...`
        });

        // Set compression options
        const compressionOptions: any = {
          $bin: '7z',  // Ensure 7z command is available
          $progress: true,  // Enable progress reporting
          $defer: false  // Synchronous execution
        };
        
        // Add compression level if specified
        if (compressionLevel) {
          compressionOptions.mx = compressionLevel;
        }

        // Create 7z compression process
        const stream = Seven.add(targetPath, absoluteSourcePath, compressionOptions);
        
        // Listen for progress events
        stream.on('progress', (progress: { percent?: number }) => {
          if (progress && progress.percent !== undefined) {
            reportProgress({
              progress: progress.percent,
              total: 100,
              message: `7z compression progress: ${progress.percent}%`
            });
          }
        });
        
        // Wait for compression to complete
        await new Promise<void>((resolve, reject) => {
          stream.on('end', function() {
            resolve();
          });
          stream.on('error', function(err: Error) {
            reject(err);
          });
        });
        
        // Get compressed file size
        const compressedStats = await fs.stat(targetPath);
        
        // Report completion
        reportProgress({
          progress: 100,
          total: 100,
          message: "7z compression completed!"
        });

        return {
          content: [
            { 
              type: "text", 
              text: `7z compression successful:
Source: ${absoluteSourcePath}
Compressed file: ${targetPath}
Compressed size: ${compressedStats.size} bytes
Compression level: ${compressionLevel}
` 
            }
          ]
        };
      } catch (error) {
        console.error('Error during 7z compression:', error);
        return {
          isError: true,
          content: [{ type: "text", text: `7z compression failed: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  };
} 