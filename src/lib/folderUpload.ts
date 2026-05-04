/**
 * 資料夾上傳輔助工具
 * - 支援最多 N 層子資料夾（預設 3 層，含使用者選取的根資料夾）
 * - 超過層數限制的檔案會被略過
 * - 重名自動加序號 file.docx -> file (1).docx
 *
 * 注意：webkitRelativePath 形如 "myFolder/sub/file.txt"
 *   segments.length 對應「資料夾深度 + 1（檔名）」
 *   例：3 層 = 根資料夾 / 第二層 / 第三層 / 檔案 → segments.length === 4
 */

export const DEFAULT_MAX_FOLDER_DEPTH = 3;

export interface FolderUploadFile {
  file: File;
  /** 相對於使用者選取根目錄的目錄路徑（陣列），不含檔名 */
  relativePath: string[];
}

export interface FolderUploadResult {
  files: FolderUploadFile[];
  /** 因超過層數限制而被略過的檔案完整相對路徑 */
  rejectedDeepFiles: string[];
}

/**
 * 從 <input webkitdirectory> 取得的 FileList 篩選
 */
export function extractFilesFromInput(
  fileList: FileList | null,
  maxDepth: number = DEFAULT_MAX_FOLDER_DEPTH,
): FolderUploadResult {
  const files: FolderUploadFile[] = [];
  const rejected: string[] = [];
  if (!fileList) return { files, rejectedDeepFiles: rejected };

  for (const f of Array.from(fileList)) {
    const rel: string = (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const segments = rel.split('/').filter(Boolean);
    // segments = [...folders, fileName]；資料夾深度 = segments.length - 1
    // 允許條件：folders.length <= maxDepth
    if (segments.length === 0) continue;
    const folderSegments = segments.slice(0, -1);
    if (folderSegments.length <= maxDepth) {
      files.push({ file: f, relativePath: folderSegments });
    } else {
      rejected.push(rel);
    }
  }
  return { files, rejectedDeepFiles: rejected };
}

/**
 * 處理拖放：使用 DataTransferItemList 解析
 * 最多遞迴 maxDepth 層資料夾
 */
export async function extractFilesFromDrop(
  items: DataTransferItemList,
  maxDepth: number = DEFAULT_MAX_FOLDER_DEPTH,
): Promise<FolderUploadResult> {
  const files: FolderUploadFile[] = [];
  const rejected: string[] = [];

  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry: FileSystemEntry | null =
      (item as unknown as { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.() ?? null;
    if (entry) entries.push(entry);
  }

  // 對每個拖入的頂層 entry 進行遞迴；relativePath 累積該 entry 自身名稱（若是目錄）
  for (const entry of entries) {
    if (entry.isFile) {
      const file = await fileFromEntry(entry as FileSystemFileEntry);
      if (file) files.push({ file, relativePath: [] });
    } else if (entry.isDirectory) {
      await walkDir(entry as FileSystemDirectoryEntry, [entry.name], maxDepth, files, rejected);
    }
  }

  return { files, rejectedDeepFiles: rejected };
}

async function walkDir(
  dir: FileSystemDirectoryEntry,
  pathSoFar: string[],
  maxDepth: number,
  out: FolderUploadFile[],
  rejected: string[],
): Promise<void> {
  const reader = dir.createReader();
  const children = await readAllEntries(reader);
  for (const child of children) {
    if (child.isFile) {
      const file = await fileFromEntry(child as FileSystemFileEntry);
      if (file) out.push({ file, relativePath: [...pathSoFar] });
    } else if (child.isDirectory) {
      // 檢查若進入此子目錄會不會超過 maxDepth
      const newPath = [...pathSoFar, child.name];
      if (newPath.length <= maxDepth) {
        await walkDir(child as FileSystemDirectoryEntry, newPath, maxDepth, out, rejected);
      } else {
        // 收集被略過的整個子樹（只記錄頂部即可）
        rejected.push(`${newPath.join('/')}/...`);
      }
    }
  }
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
    if (i > 9999) return `${base}_${Date.now()}${ext}`;
  }
}

/**
 * 用新名稱重新包裝 File 物件
 */
export function renameFile(file: File, newName: string): File {
  if (file.name === newName) return file;
  return new File([file], newName, { type: file.type, lastModified: file.lastModified });
}

/**
 * 將檔案依 relativePath 分組（同一層資料夾的檔案聚在一起）
 */
export function groupByPath(items: FolderUploadFile[]): Map<string, FolderUploadFile[]> {
  const map = new Map<string, FolderUploadFile[]>();
  for (const it of items) {
    const key = it.relativePath.join('/');
    const arr = map.get(key) ?? [];
    arr.push(it);
    map.set(key, arr);
  }
  return map;
}

// === 向後相容別名 ===
export const extractRootFilesFromInput = extractFilesFromInput;
export const extractRootFilesFromDrop = extractFilesFromDrop;
