import { promises as fs } from 'fs';
import { createGunzip } from 'zlib';
import { createReadStream } from 'fs';
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { z } from 'zod';
import { isAbsolute, resolve, normalize } from 'path';

// View compressed file content tool parameter definition
const listZipContentsParameters = z.object({
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
    .describe("Path to the gzip file to view"),
  previewLength: z.number().int().positive().max(10000).default(1000)
    .describe("Number of bytes to preview, defaults to 1000 bytes, maximum 10000 bytes"),
});

// Memory writable stream for temporary processing
class MemoryWritable extends Writable {
  private chunks: Buffer[] = [];
  private totalLength = 0;
  private maxLength: number;

  constructor(maxLength: number) {
    super();
    this.maxLength = maxLength;
  }

  _write(chunk: Buffer, _: string, callback: (error?: Error | null) => void): void {
    if (this.totalLength < this.maxLength) {
      const remainingLength = this.maxLength - this.totalLength;
      if (chunk.length > remainingLength) {
        chunk = chunk.slice(0, remainingLength);
      }
      this.chunks.push(chunk);
      this.totalLength += chunk.length;
    }
    callback();
  }

  getContent(): Buffer {
    return Buffer.concat(this.chunks, this.totalLength);
  }

  getContentAsString(): string {
    return this.getContent().toString('utf-8');
  }
}

// Export list zip contents tool
export function createZipContentsTool() {
  return {
    name: "list-zip-contents",
    description: "Preview the contents of a gzip compressed file. Specify preview length in bytes. Useful for viewing .gz file contents without full decompression.",
    parameters: listZipContentsParameters,
    execute: async (args: z.infer<typeof listZipContentsParameters>, { reportProgress }: { reportProgress: (progress: { progress: number, total: number, message?: string }) => void }) => {
      const { sourceFilePath, previewLength } = args;

      try {
        // Path security check
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

        // Report start of reading
        reportProgress({
          progress: 0,
          total: 100,
          message: `Starting to read compressed file ${absoluteSourcePath}...`
        });

        // Create read and decompression streams
        let source;
        try {
          source = createReadStream(absoluteSourcePath);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Cannot open source file for reading. ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
        
        const gunzip = createGunzip();
        const memoryStream = new MemoryWritable(previewLength);

        // Set up progress reporting
        let processedBytes = 0;
        const totalSize = fileStats.size;

        source.on('data', (chunk) => {
          processedBytes += chunk.length;
          const progress = Math.min(100, Math.round((processedBytes / totalSize) * 100));
          
          reportProgress({
            progress,
            total: 100,
            message: `Reading... ${progress}%`
          });
        });

        // Execute decompression and read to memory
        try {
          await pipeline(source, gunzip, memoryStream);
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error reading compressed file contents: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }

        // Get file content
        const contentPreview = memoryStream.getContentAsString();

        // Extract file type info
        const fileTypeInfo = detectFileType(contentPreview);

        // Report completion
        reportProgress({
          progress: 100,
          total: 100,
          message: "Reading complete!"
        });

        // Format preview content, truncate if too long
        const formattedPreview = contentPreview.length > 500 
          ? `${contentPreview.slice(0, 500)}...(content truncated)`
          : contentPreview;

        return {
          content: [
            { 
              type: "text", 
              text: `File Information:
File path: ${absoluteSourcePath}
File size: ${fileStats.size} bytes
Content type: ${fileTypeInfo.type}
Content preview: 
${formattedPreview}
` 
            }
          ]
        };
      } catch (error) {
        console.error('Error reading compressed file:', error);
        return {
          isError: true,
          content: [{ type: "text", text: `Reading failed: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  };
}

// Simple file type detection
function detectFileType(content: string): { type: string } {
  // Check if XML or HTML
  if (content.trim().startsWith('<?xml') || content.trim().startsWith('<html')) {
    return { type: 'XML/HTML' };
  }
  
  // Check if JSON
  try {
    JSON.parse(content);
    return { type: 'JSON' };
  } catch {
    // Not JSON
  }
  
  // Check if binary
  if (/[\x00-\x08\x0E-\x1F]/.test(content)) {
    return { type: 'Binary file' };
  }
  
  // Default to text
  return { type: 'Text file' };
} 