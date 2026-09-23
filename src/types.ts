export type LinkType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Link { uid: number; type: LinkType; lag: number }
export interface Assignment { res: number; units: number }
export interface Split { at: number; gap: number }

export interface Task {
  uid: number;
  name: string;
  level: number;
  duration: number;
  milestone: boolean;
  percent: number;
  notes: string;
  preds: Link[];
  assignments: Assignment[];
  constraint: string;
  constraintDate: string;
  deadline: string;
  type: string;
  effortDriven: boolean;
  fixedCost: number;
  actualStart: string;
  actualFinish: string;
  splits: Split[];
  levelDelay: number;
  priority: number;
  custom: Record<string, string | number>;
}

export interface Resource {
  uid: number;
  name: string;
  initials: string;
  role: string;
  type: string;
  kind: 'Work' | 'Material' | 'Cost';
  materialLabel: string;
  maxUnits: number;
  rate: number;
  costPerUse: number;
  rates: { from: string; rate: number }[];
  workDays: number[];
  vacations: string[];
  reportsTo: number | null;
}

export interface CustomField { id: string; name: string; type: 'text' | 'number' }

export interface Project {
  version: number;
  name: string;
  organization: string;
  manager: string;
  status: string;
  issueDate: string;
  start: string;
  statusDate: string;
  budget: number;
  currency: string;
  hoursPerDay: number;
  holidays: string[];
  customFields: CustomField[];
  baseline: { savedAt: string; tasks: Record<number, any> } | null;
  nextUid: number;
  tasks: Task[];
  resources: Resource[];
}

/* Computed schedule rows and results come from the JavaScript engine (core.js). */
export type Row = any;
export type Schedule = any;

export type ViewName = 'gantt' | 'network' | 'wbs' | 'resources' | 'org' | 'workload' | 'budget' | 'reports';
