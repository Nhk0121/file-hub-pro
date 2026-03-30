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

// 各組別下的課別
export const DEPARTMENT_SECTIONS: Record<string, string[]> = {
  '00.處長室': [],
  '01.維護組': [],
  '02.設計組': ['規劃課', '設計課', '資訊課', '查核課'],
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

// 主區域
export const ZONES = ['時效區', '永久區'] as const;
export type ZoneName = typeof ZONES[number];

// 取得指定組別的課別列表
export function getSectionsForDepartment(dept: string): string[] {
  return DEPARTMENT_SECTIONS[dept] ?? [];
}

// 取得所有有課別的組別
export function getDepartmentsWithSections(): string[] {
  return Object.entries(DEPARTMENT_SECTIONS)
    .filter(([, sections]) => sections.length > 0)
    .map(([dept]) => dept);
}

// 產生磁碟路徑（未來移機用）
export function buildDiskPath(zone: string, department?: string, section?: string): string {
  let path = `D:\\DMS\\${zone}`;
  if (department) path += `\\${department}`;
  if (section) path += `\\${section}`;
  return path;
}
