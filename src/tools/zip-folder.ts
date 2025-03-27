import { createWriteStream, promises as fs } from 'fs';
import { join, basename, dirname, resolve, normalize, isAbsolute } from 'path';
import { z } from 'zod';
import * as tar from 'tar';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import AdmZip from 'adm-zip';
import Seven from 'node-7z';
import { Readable } from 'stream';
import * as tarStream from 'tar-stream';

// Folder compression tool parameter definition
const zipFolderParameters = z.object({
  sourceFolderPath: z.string()
    .min(1, "Folder path cannot be empty")
    .refine(path => {
      try {
        return normalize(path) === path; // Ensure path is normalized to prevent path traversal attacks
      } catch {
        return false;
      }
    }, "Invalid folder path")
    .describe("Path to the folder to compress"),
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
    .describe("Output directory (defaults to source folder's directory)"),
  outputFileName: z.string().optional()
    .refine(name => {
      if (!name) return true;
      return !name.includes('/') && !name.includes('\\'); // Ensure filename doesn't contain path separators
    }, "Filename cannot contain path separators")
    .describe("Output filename (defaults to original folder name + .tar.gz)"),
  compressionLevel: z.number().int().min(1).max(9).default(6)
    .describe("Compression level (1-9), higher values provide better compression but slower speed")
});

// ZIP format compression parameter definition
const zipArchiveParameters = z.object({
  sourcePath: z.string().describe("Path to the file or folder to compress"),
  outputDirectory: z.string().optional().describe("Output directory (defaults to source file's directory)"),
  outputFileName: z.string().optional().describe("Output filename (defaults to original file or folder name + .zip)"),
  compressionLevel: z.number().min(1).max(9).default(6).describe("Compression level (1-9), higher values provide better compression but slower speed"),
});

// 7z format compression parameter definition
const sevenZipParameters = z.object({
  sourcePath: z.string().describe("Path to the file or folder to compress"),
  outputDirectory: z.string().optional().describe("Output directory (defaults to source file's directory)"),
  outputFileName: z.string().optional().describe("Output filename (defaults to original file or folder name + .7z)"),
  compressionLevel: z.number().min(1).max(9).default(6).describe("Compression level (1-9), higher values provide better compression but slower speed"),
});

// Recursively get all files in a folder
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

// Export folder compression tool
export function createZipFolderTool() {
  return {
    name: "zip-folder",
    description: "Compress folders to tar.gz format. Specify output directory, filename, and compression level. Supports progress reporting.",
    parameters: zipFolderParameters,
    execute: async (args: z.infer<typeof zipFolderParameters>, { reportProgress }: { reportProgress: (progress: { progress: number, total: number, message?: string }) => void }) => {
      const { sourceFolderPath, outputDirectory, outputFileName, compressionLevel } = args;

      try {
        // Path normalization
        const absoluteSourcePath = isAbsolute(sourceFolderPath) 
          ? sourceFolderPath 
          : resolve(process.cwd(), sourceFolderPath);

        // Check if source folder exists
        let dirStats;
        try {
          dirStats = await fs.stat(absoluteSourcePath);
          if (!dirStats.isDirectory()) {
            return {
              isError: true,
              content: [{ type: "text", text: `Error: ${absoluteSourcePath} is not a folder` }]
            };
          }
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot access folder ${absoluteSourcePath}. ${error instanceof Error ? error.message : String(error)}` }]
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
        const targetName = outputFileName || `${sourceBase}.tar.gz`;
        const targetPath = join(targetDir, targetName);

        // Ensure we don't overwrite existing files (unless filename is explicitly specified)
        if (!outputFileName) {
          try {
            await fs.access(targetPath);
            // File already exists, suggest automatic renaming
            const timestamp = new Date().getTime();
            const newTargetName = `${sourceBase}_${timestamp}.tar.gz`;
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

        // Get all files list
        reportProgress({
          progress: 0,
          total: 100,
          message: "Scanning folder..."
        });

        let allFiles: {filePath: string, relativePath: string}[];
        try {
          allFiles = await getFilesRecursively(absoluteSourcePath, absoluteSourcePath);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error scanning folder: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        if (allFiles.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `Warning: Folder ${absoluteSourcePath} is empty` }]
          };
        }

        reportProgress({
          progress: 10,
          total: 100,
          message: `Found ${allFiles.length} files, starting compression...`
        });

        // Create tar pack stream
        const pack = tarStream.pack();
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

        // Connect pipeline: tar pack stream -> gzip compression stream -> file output stream
        const pipelinePromise = pipeline(pack, gzip, destination);

        // Add files to tar stream
        let totalSize = 0;
        let processedSize = 0;
        let processedFiles = 0;

        // First calculate total size
        for (const file of allFiles) {
          try {
            const stats = await fs.stat(file.filePath);
            totalSize += stats.size;
          } catch (error) {
            console.warn(`Cannot get file size for ${file.filePath}: ${error}`);
          }
        }

        // Add all files to tar stream
        for (const file of allFiles) {
          try {
            const fileBuffer = await fs.readFile(file.filePath);
            
            // Add to pack
            pack.entry(
              { name: file.relativePath },
              fileBuffer
            );
            
            // Update progress
            processedFiles++;
            processedSize += fileBuffer.length;
            const fileProgress = Math.round(10 + ((processedSize / totalSize) * 80));
            
            reportProgress({
              progress: fileProgress,
              total: 100,
              message: `Compressing... Processed ${processedFiles}/${allFiles.length} files (${fileProgress}%)`
            });
          } catch (error) {
            console.warn(`Error processing file ${file.filePath}: ${error}`);
          }
        }

        // Finalize the pack
        pack.finalize();

        // Wait for compression to complete
        try {
          await pipelinePromise;
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error during compression process: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // Get compressed file size
        const compressedStats = await fs.stat(targetPath);
        
        // Calculate compression ratio
        const compressionRatio = parseFloat((totalSize / compressedStats.size).toFixed(2));
        
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
Source folder: ${absoluteSourcePath}
Compressed file: ${targetPath}
File count: ${allFiles.length}
Original size: ${totalSize} bytes
Compressed size: ${compressedStats.size} bytes
Compression ratio: ${compressionRatio}:1
Compression level: ${compressionLevel}
` 
            }
          ]
        };
      } catch (error) {
        console.error('Error during folder compression:', error);
        return {
          isError: true,
          content: [{ type: "text", text: `Compression failed: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  };
}

export function createZipArchiveTool() {
  return {
    name: "zip-archive",
    description: "Use ZIP format to compress a file or folder",
    parameters: zipArchiveParameters,
    execute: async (args: z.infer<typeof zipArchiveParameters>, { reportProgress }: { reportProgress: (progress: { progress: number, total: number, message?: string }) => void }) => {
      const { sourcePath, outputDirectory, outputFileName, compressionLevel } = args;

      try {
        // Check if source path exists
        const stats = await fs.stat(sourcePath);
        
        // Determine output directory and filename
        const outputDir = outputDirectory || dirname(sourcePath);
        const baseOutputFileName = outputFileName || `${basename(sourcePath)}.zip`;
        const outputPath = join(outputDir, baseOutputFileName);

        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });

        // Report compression start
        reportProgress({
          progress: 0,
          total: 100,
          message: `Starting ZIP compression ${sourcePath}...`
        });

        // Create ZIP instance
        const zip = new AdmZip();
        
        // Add different content based on file type
        if (stats.isDirectory()) {
          // Read all files and subdirectories in the directory
          const files = await getAllFiles(sourcePath);
          
          let processedFiles = 0;
          const totalFiles = files.length;
          
          // Add files to ZIP
          for (const filePath of files) {
            // Relative path, keeping directory structure
            const relativePath = filePath.replace(sourcePath, '');
            zip.addLocalFile(filePath, dirname(relativePath));
            
            // Update progress
            processedFiles++;
            reportProgress({
              progress: Math.round((processedFiles / totalFiles) * 90), // Reserve 10% for final write operation
              total: 100,
              message: `Adding file: ${basename(filePath)}`
            });
          }
        } else {
          // Single file directly add
          zip.addLocalFile(sourcePath);
          reportProgress({
            progress: 50,
            total: 100,
            message: `Adding file: ${basename(sourcePath)}`
          });
        }
        
        // Set compression level (Note: Some versions of AdmZip may not support setting compression level)
        try {
          if (compressionLevel !== undefined) {
            zip.getEntries().forEach(entry => {
              // Use any type assertion because adm-zip type definition may be incomplete
              (entry.header as any).method = 8;
              (entry.header as any).level = compressionLevel;
            });
          }
        } catch (err) {
          console.warn('Cannot set ZIP compression level:', err);
        }
        
        // Write ZIP file
        reportProgress({
          progress: 90,
          total: 100,
          message: `Writing ZIP file...`
        });
        
        zip.writeZip(outputPath);
        
        // Report completion
        reportProgress({
          progress: 100,
          total: 100,
          message: "ZIP compression completed!"
        });

        return `File/folder successfully ZIP compressed to: ${outputPath}`;
      } catch (error) {
        console.error('Error during ZIP compression:', error);
        return `ZIP compression failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  };
}

export function create7zArchiveTool() {
  return {
    name: "7z-archive",
    description: "Use 7z format to compress a file or folder",
    parameters: sevenZipParameters,
    execute: async (args: z.infer<typeof sevenZipParameters>, { reportProgress }: { reportProgress: (progress: { progress: number, total: number, message?: string }) => void }) => {
      const { sourcePath, outputDirectory, outputFileName, compressionLevel } = args;

      try {
        // Check if source path exists
        await fs.stat(sourcePath);
        
        // Determine output directory and filename
        const outputDir = outputDirectory || dirname(sourcePath);
        let baseOutputFileName = outputFileName;
        
        if (!baseOutputFileName) {
          baseOutputFileName = `${basename(sourcePath)}.7z`;
        } else if (!baseOutputFileName.endsWith('.7z')) {
          baseOutputFileName += '.7z';
        }
        
        const outputPath = join(outputDir, baseOutputFileName);

        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });

        // Report compression start
        reportProgress({
          progress: 0,
          total: 100,
          message: `Starting 7z compression ${sourcePath}...`
        });

        // Set 7zip compression options
        const compressionOptions: any = {
          $bin: '7z', // Ensure 7z command is available
          $progress: true, // Enable progress
          $defer: false // Sync execution
        };
        
        // Add compression level
        if (compressionLevel) {
          compressionOptions.mx = compressionLevel;
        }
        
        // Create 7z compression stream
        const stream = Seven.add(outputPath, sourcePath, compressionOptions);
        
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
          stream.on('end', () => resolve());
          stream.on('error', (err: Error) => reject(err));
        });
        
        // Report completion
        reportProgress({
          progress: 100,
          total: 100,
          message: "7z compression completed!"
        });

        return `File/folder successfully 7z compressed to: ${outputPath}`;
      } catch (error) {
        console.error('Error during 7z compression:', error);
        return `7z compression failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  };
}

// Helper function: Recursively get all files in a directory
async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
} 