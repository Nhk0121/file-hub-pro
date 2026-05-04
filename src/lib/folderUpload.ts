/**
 * 資料夾上傳輔助工具
 * - 檢查是否含子資料夾（拒絕）
 * - 重名自動加序號 file.docx -> file (1).docx
 */

export interface FolderUploadResult {
  files: File[];
  rejectedSubfolderFiles: string[]; // 因含子資料夾而被拒絕的檔案清單
}

/**
 * 從 <input webkitdirectory> 取得的 FileList 篩選：只保留根層檔案
 * webkitRelativePath 形如 "myFolder/sub/file.txt"
 * 根層條件：path 切割後 segments.length === 2（即 myFolder/file.txt）
 */
export function extractRootFilesFromInput(fileList: FileList | null): FolderUploadResult {
  const files: File[] = [];
  const rejected: string[] = [];
  if (!fileList) return { files, rejectedSubfolderFiles: rejected };

  for (const f of Array.from(fileList)) {
    // @ts-expect-error webkitRelativePath 為非標準但廣泛支援
    const rel: string = f.webkitRelativePath || '';
    const segments = rel.split('/').filter(Boolean);
    if (segments.length <= 2) {
      files.push(f);
    } else {
      rejected.push(rel);
    }
  }
  return { files, rejectedSubfolderFiles: rejected };
}

/**
 * 處理拖放：使用 DataTransferItemList 解析
 * 只取根層檔案，子資料夾整批拒絕
 */
export async function extractRootFilesFromDrop(
  items: DataTransferItemList,
): Promise<FolderUploadResult> {
  const files: File[] = [];
  const rejected: string[] = [];

  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // @ts-expect-error 非標準但廣泛支援
    const entry: FileSystemEntry | null = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await fileFromEntry(entry as FileSystemFileEntry);
      if (file) files.push(file);
    } else if (entry.isDirectory) {
      // 讀取此目錄第一層
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      const children = await readAllEntries(dirReader);
      for (const child of children) {
        if (child.isFile) {
          const file = await fileFromEntry(child as FileSystemFileEntry);
          if (file) files.push(file);
        } else if (child.isDirectory) {
          rejected.push(`${entry.name}/${child.name}/...`);
        }
      }
    }
  }

  return { files, rejectedSubfolderFiles: rejected };
}

function fileFromEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null),
    );
  });
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(all);
          } else {
            all.push(...entries);
            readBatch();
          }
        },
        reject,
      );
    };
    readBatch();
  });
}

/**
 * 重名自動加序號：file.docx -> file (1).docx -> file (2).docx
 * existingNames 應為當前資料夾下既有檔案 + 已分配本批次新名稱的集合
 */
export function generateUniqueName(originalName: string, existingNames: Set<string>): string {
  if (!existingNames.has(originalName)) return originalName;

  const dotIdx = originalName.lastIndexOf('.');
  const base = dotIdx > 0 ? originalName.slice(0, dotIdx) : originalName;
  const ext = dotIdx > 0 ? originalName.slice(dotIdx) : '';

  let i = 1;
  while (true) {
    const candidate = `${base} (${i})${ext}`;
    if (!existingNames.has(candidate)) return candidate;
    i++;
    if (i > 9999) return `${base}_${Date.now()}${ext}`; // 安全閥
  }
}

/**
 * 用新名稱重新包裝 File 物件
 */
export function renameFile(file: File, newName: string): File {
  if (file.name === newName) return file;
  return new File([file], newName, { type: file.type, lastModified: file.lastModified });
}
