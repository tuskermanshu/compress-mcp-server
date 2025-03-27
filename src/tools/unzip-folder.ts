import { promises as fs } from 'fs';
import { join, basename, dirname, isAbsolute, resolve, normalize, extname } from 'path';
import * as tar from 'tar';
import { z } from 'zod';

// Folder decompression tool parameter definition
const unzipFolderParameters = z.object({
  sourceArchivePath: z.string()
    .min(1, "Archive file path cannot be empty")
    .refine(path => {
      try {
        return normalize(path) === path;
      } catch {
        return false;
      }
    }, "Invalid archive file path")
    .describe("Path to the tar.gz file to extract"),
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
    .describe("Output directory (defaults to source archive's directory)"),
  stripComponents: z.number().int().min(0).default(0)
    .describe("Number of directory levels to strip during extraction (default is 0, keeping original directory structure)")
});

// Export folder extraction tool
export function createUnzipFolderTool() {
  return {
    name: "unzip-folder",
    description: "Extract tar.gz format compressed folders. Specify output directory and directory level stripping options. Supports progress reporting.",
    parameters: unzipFolderParameters,
    execute: async (args: z.infer<typeof unzipFolderParameters>, { reportProgress }: { reportProgress: (progress: { progress: number, total: number, message?: string }) => void }) => {
      const { sourceArchivePath, outputDirectory, stripComponents } = args;

      try {
        // Path normalization
        const absoluteSourcePath = isAbsolute(sourceArchivePath) 
          ? sourceArchivePath 
          : resolve(process.cwd(), sourceArchivePath);

        // Check if source archive exists
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

        // Check file extension
        const fileExt = extname(absoluteSourcePath).toLowerCase();
        if (fileExt !== '.gz' && !absoluteSourcePath.toLowerCase().endsWith('.tar.gz')) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: ${absoluteSourcePath} is not a tar.gz file` }]
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

        // Report starting extraction
        reportProgress({
          progress: 0,
          total: 100,
          message: `Starting extraction of ${absoluteSourcePath}...`
        });

        // Extract the tar.gz file
        try {
          await tar.extract({
            file: absoluteSourcePath,
            cwd: targetDir,
            strip: stripComponents
          });
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error during extraction: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // Report completion
        reportProgress({
          progress: 100,
          total: 100,
          message: "Extraction completed!"
        });

        return {
          content: [
            { 
              type: "text", 
              text: `Extraction successful:
Source archive: ${absoluteSourcePath}
Extracted to: ${targetDir}
Strip components: ${stripComponents}
` 
            }
          ]
        };
      } catch (error) {
        console.error('Error during folder extraction:', error);
        return {
          isError: true,
          content: [{ type: "text", text: `Extraction failed: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  };
} 