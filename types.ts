export type Role = 'admin' | 'manager' | 'planner' | 'operator';

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string; // Optional since we're removing the requirement to provide it
  role: Role;
  password?: string; // In a real app, never store plain text. Used here for simulation.
  // Fix: Added missing avatar property used by the AvatarModal component
  avatar?: string;
}

export type Category = 'Healthcare' | 'Toothpaste' | 'Rocksalt' | 'Cosmetic';

export type ProcessType = 'Mixing' | 'Encapsulation' | 'Filling' | 'Sorting' | 'Packing';

export type UnitType = 'KG' | 'PCS' | 'CARTON' | 'BTL' | 'BOX' | 'PAX' | 'TUBE';

export type ProductionStatus = 'In Progress' | 'Completed';

export type OffDayType = 'Public Holiday' | 'Rest Day' | 'Off Day';

export interface ProductionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  category: Category;
  process: ProcessType;
  productName: string;
  planQuantity: number;
  actualQuantity: number;
  unit: UnitType;
  batchNo?: string;
  manpower?: number;
  remark?: string; // Legacy field
  planRemark?: string;
  actualRemark?: string;
  status: ProductionStatus;
  lastUpdatedBy: string;
  updatedAt: string;
}

export interface OffDay {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  type: OffDayType;
  createdBy: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
}

export interface DashboardStats {
  totalPlan: number;
  totalActual: number;
  avgEfficiency: number;
  totalManpower: number;
}