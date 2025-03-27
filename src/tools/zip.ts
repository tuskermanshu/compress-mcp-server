import { createReadStream, createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { promises as fs } from 'fs';
import { z } from 'zod';
import { isAbsolute, resolve, normalize, dirname, basename, join, extname } from 'path';

// Compression tool parameter definition
const zipParameters = z.object({
  sourceFilePath: z.string()
    .min(1, "File path cannot be empty")
    .refine(path => {
      try {
        return normalize(path) === path; // Ensure path is normalized to prevent path traversal attacks
      } catch {
        return false;
      }
    }, "Invalid file path")
    .describe("Path to the file to compress"),
  outputDirectory: z.string().optional()
    .transform(dir => dir || '')
    .refine(dir => {
      if (!dir) return true;
      try {
        return normalize(dir) === dir; // Ensure path is normalized to prevent path traversal attacks
      } catch {
        return false;
      }
    }, "Invalid output directory path")
    .describe("Output directory (defaults to source file directory)"),
  outputFileName: z.string().optional()
    .refine(name => {
      if (!name) return true;
      return !name.includes('/') && !name.includes('\\'); // Ensure filename doesn't contain path separators
    }, "Filename cannot contain path separators")
    .describe("Output filename (defaults to original filename + .gz)"),
  compressionLevel: z.number().int().min(1).max(9).default(6)
    .describe("Compression level (1-9), higher values provide better compression but slower speed")
});

// Export compression tool
export function createZipTool() {
  return {
    name: "zip",
    description: "Compress a single file using gzip format. Specify output directory, filename, and compression level. Supports progress reporting.",
    parameters: zipParameters,
    execute: async (args: z.infer<typeof zipParameters>, { reportProgress }: { reportProgress: (progress: { progress: number, total: number, message?: string }) => void }) => {
      const { sourceFilePath, outputDirectory, outputFileName, compressionLevel } = args;

      try {
        // Path normalization
        const absoluteSourcePath = isAbsolute(sourceFilePath) 
          ? sourceFilePath 
          : resolve(process.cwd(), sourceFilePath);

        // Check if source file exists
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
            content: [{ type: "text", text: `Cannot create output directory: ${targetDir}. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // Process output filename
        const sourceBase = basename(absoluteSourcePath);
        const targetName = outputFileName || `${sourceBase}.gz`;
        const targetPath = join(targetDir, targetName);

        // Ensure we don't overwrite existing files (unless filename is explicitly specified)
        if (!outputFileName) {
          try {
            await fs.access(targetPath);
            // File already exists, suggest automatic renaming
            const fileNameWithoutExt = basename(sourceBase, extname(sourceBase));
            const fileExt = extname(sourceBase);
            const timestamp = new Date().getTime();
            const newTargetName = `${fileNameWithoutExt}_${timestamp}${fileExt}.gz`;
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

        // Report compression start
        reportProgress({
          progress: 0,
          total: 100,
          message: "Starting compression..."
        });

        // Create read and compression streams
        let source;
        try {
          source = createReadStream(absoluteSourcePath);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot open source file for reading. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
        
        const gzip = createGzip({ level: compressionLevel });
        
        let destination;
        try {
          destination = createWriteStream(targetPath);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot create output file. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // Set up progress reporting
        let processedBytes = 0;
        const totalSize = fileStats.size;

        source.on('data', (chunk) => {
          processedBytes += chunk.length;
          const progress = Math.min(100, Math.round((processedBytes / totalSize) * 100));
          
          reportProgress({
            progress,
            total: 100,
            message: `Compressing... ${progress}%`
          });
        });

        // Execute compression
        try {
          await pipeline(source, gzip, destination);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error during compression process: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // Get compressed file size
        const compressedStats = await fs.stat(targetPath);
        
        // Calculate compression ratio
        const compressionRatio = parseFloat((fileStats.size / compressedStats.size).toFixed(2));
        
        // Report completion
        reportProgress({
          progress: 100,
          total: 100,
          message: "Compression complete!"
        });

        return {
          content: [
            { 
              type: "text", 
              text: `Compression successful:
Source file: ${absoluteSourcePath} (${fileStats.size} bytes)
Compressed file: ${targetPath} (${compressedStats.size} bytes)
Compression ratio: ${compressionRatio}:1
Compression level: ${compressionLevel}
` 
            }
          ]
        };
      } catch (error) {
        console.error('Error during compression process:', error);
        return {
          isError: true,
          content: [{ type: "text", text: `Compression failed: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  };
} 