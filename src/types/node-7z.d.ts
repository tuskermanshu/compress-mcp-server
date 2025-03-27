declare module 'node-7z' {
  import { EventEmitter } from 'events';

  interface ProgressInfo {
    percent?: number;
    file?: string;
    status?: string;
  }

  interface SevenZipOptions {
    $bin?: string;
    $progress?: boolean;
    $defer?: boolean;
    [key: string]: any; // 允许任何其他属性
  }

  interface SevenZipStream extends EventEmitter {
    on(event: 'data', listener: (data: any) => void): this;
    on(event: 'progress', listener: (progress: ProgressInfo) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  namespace Seven {
    function add(archive: string, source: string | string[], options?: SevenZipOptions): SevenZipStream;
    function extract(archive: string, dest: string, options?: SevenZipOptions): SevenZipStream;
    function list(archive: string, options?: SevenZipOptions): SevenZipStream;
    function test(archive: string, options?: SevenZipOptions): SevenZipStream;
    function update(archive: string, source: string | string[], options?: SevenZipOptions): SevenZipStream;
  }

  export = Seven;
} 