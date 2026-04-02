// 組別與課別對應表
// 課別僅屬於特定組別，不會跨組出現
export const DEPARTMENTS = [
  '00.處長室',
  '01.維護組',
  '02.設計組',
  '03.業務組',
  '04.電費組',
  '05.調度組',
  '06.總務組',
  '07.會計組',
  '08.人資組',
  '09.政風組',
  '10.工務段',
  '11.工安組',
  '12.電控組',
  '13.電力工會',
  '14.福利會',
  '15.檔案下載',
] as const;

export type DepartmentName = typeof DEPARTMENTS[number];

// 預設課別（首次使用時的初始值）
const DEFAULT_SECTIONS: Record<string, string[]> = {
  '00.處長室': [],
  '01.維護組': [],
  '02.設計組': ['00.經理室', '01.規劃課', '02.設計課', '03.查核課', '04.資訊課'],
  '03.業務組': [],
  '04.電費組': ['收費課', '處理課', '表務課'],
  '05.調度組': [],
  '06.總務組': [],
  '07.會計組': [],
  '08.人資組': [],
  '09.政風組': [],
  '10.工務段': [],
  '11.工安組': [],
  '12.電控組': [],
  '13.電力工會': [],
  '14.福利會': [],
  '15.檔案下載': [],
};

// 動態讀取課別（支援管理員新增/刪除）
function loadSections(): Record<string, string[]> {
  const saved = localStorage.getItem('dms_department_sections');
  if (saved) return JSON.parse(saved);
  localStorage.setItem('dms_department_sections', JSON.stringify(DEFAULT_SECTIONS));
  return { ...DEFAULT_SECTIONS };
}

// 取得目前的課別設定（每次呼叫都從 localStorage 讀取最新）
export function getDepartmentSections(): Record<string, string[]> {
  return loadSections();
}

// 舊的靜態變數保留為相容用途（但建議用 getDepartmentSections()）
export const DEPARTMENT_SECTIONS: Record<string, string[]> = loadSections();

// 新增課別
export function addSection(department: string, section: string): Record<string, string[]> {
  const sections = loadSections();
  if (!sections[department]) sections[department] = [];
  if (!sections[department].includes(section)) {
    sections[department].push(section);
    localStorage.setItem('dms_department_sections', JSON.stringify(sections));
  }
  return sections;
}

// 刪除課別
export function removeSection(department: string, section: string): Record<string, string[]> {
  const sections = loadSections();
  if (sections[department]) {
    sections[department] = sections[department].filter(s => s !== section);
    localStorage.setItem('dms_department_sections', JSON.stringify(sections));
  }
  return sections;
}

// 職稱選項
export const JOB_TITLES = [
  '00.處長',
  '01.電務副處長',
  '02.業務副處長',
  '03.經理',
  '04.課長(主任)',
  '05.主管',
  '06.主辦',
  '07.經辦(員工)',
] as const;

export type JobTitle = typeof JOB_TITLES[number];

// 主區域
export const ZONES = ['時效區', '永久區'] as const;
export type ZoneName = typeof ZONES[number];

// 取得指定組別的課別列表
export function getSectionsForDepartment(dept: string): string[] {
  const sections = loadSections();
  return sections[dept] ?? [];
}

// 取得所有有課別的組別
export function getDepartmentsWithSections(): string[] {
  const sections = loadSections();
  return Object.entries(sections)
    .filter(([, secs]) => secs.length > 0)
    .map(([dept]) => dept);
}

// 產生磁碟路徑（未來移機用）
export function buildDiskPath(zone: string, department?: string, section?: string): string {
  let path = `D:\\DMS\\${zone}`;
  if (department) path += `\\${department}`;
  if (section) path += `\\${section}`;
  return path;
}
