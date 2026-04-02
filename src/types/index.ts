export type UserRole = '系統管理員' | '管理員' | '使用者' | '外包人員';

// 申請者類型
export type ApplicantType = '公司員工' | '外包人員';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  applicantType?: ApplicantType;
  // 個人資料
  employeeCode?: string; // 代號
  department?: string;   // 組別
  section?: string;      // 課別
  jobTitle?: string;     // 職稱
  phone?: string;
  extension?: string;    // 分機
}

export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  mimeType?: string;
  size?: number;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  content?: string;
  // 結構標記：用於區分系統資料夾（不可刪除/重命名）
  isSystem?: boolean;
  folderLevel?: 'zone' | 'department' | 'section';
  // 磁碟對應路徑（未來移機用）
  diskPath?: string;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

// 資料夾權限等級
export type FolderPermission = '完整權限' | '僅下載' | '無權限';

// 資料夾權限設定
export interface FolderPermissionRule {
  id: string;
  folderId: string;
  userId: string;
  permission: FolderPermission;
}

// 永久區跨組別完整權限設定
export interface PermanentZoneOverride {
  id: string;
  userId: string;
  departments: string[]; // 被授權的組別名稱列表
}

// 稽核日誌
export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: '登入' | '登出' | '上傳' | '下載' | '刪除' | '建立資料夾' | '重新命名' | '編輯' | '權限變更' | '外包申請' | '帳號申請' | '審核帳號' | '預覽' | '列印' | '密碼重置' | '角色變更' | '帳號刪除' | '資料夾權限變更' | '個資存取';
  targetName?: string;
  targetId?: string;
  details?: string;
  ipAddress?: string;
}

// 帳號申請
export type RegistrationStatus = '待審核' | '已核准' | '已拒絕';

export interface UserRegistration {
  id: string;
  applicantType: ApplicantType;
  username: string;
  password: string;
  displayName: string;
  email: string;
  department?: string;
  section?: string;
  jobTitle?: string;
  phone?: string;
  extension?: string;
  status: RegistrationStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
}

// 外包人員申請
export interface ContractorApplication {
  id: string;
  applicantName: string;
  company: string;
  purpose: string;
  startDate: string;
  endDate: string;
  status: '待審核' | '已核准' | '已拒絕';
  createdAt: string;
  createdBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
}
