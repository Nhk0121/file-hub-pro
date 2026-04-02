// 個資檢測工具
// 掃描文字內容是否包含個人資訊

interface PIIMatch {
  type: string;
  sample: string;
}

const PII_PATTERNS: { type: string; regex: RegExp }[] = [
  { type: '身分證字號', regex: /[A-Z][12]\d{8}/g },
  { type: '手機號碼', regex: /09\d{2}[-]?\d{3}[-]?\d{3}/g },
  { type: '電子郵件', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: '信用卡號', regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g },
  { type: '統一編號', regex: /\b\d{8}\b/g },
  { type: '護照號碼', regex: /\b[A-Z]\d{8,9}\b/g },
  { type: '地址', regex: /[\u4e00-\u9fff]{2,4}(市|縣)[\u4e00-\u9fff]{2,4}(區|鄉|鎮|市)[\u4e00-\u9fff]+/g },
];

export function scanPII(text: string): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const seen = new Set<string>();

  for (const pattern of PII_PATTERNS) {
    const found = text.match(pattern.regex);
    if (found) {
      const key = pattern.type;
      if (!seen.has(key)) {
        seen.add(key);
        const sample = found[0].length > 8
          ? found[0].slice(0, 4) + '****' + found[0].slice(-2)
          : '****';
        matches.push({ type: pattern.type, sample });
      }
    }
  }

  return matches;
}

// 檢查檔案副檔名是否為執行檔
const EXECUTABLE_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.ps1', '.vbs', '.js',
  '.wsf', '.scr', '.pif', '.hta', '.cpl', '.inf', '.reg',
  '.sh', '.bash', '.bin', '.app', '.dmg',
];

export function isExecutableFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return EXECUTABLE_EXTENSIONS.some(ext => lower.endsWith(ext));
}
