export type Priority = 'Low' | 'Medium' | 'High';
export type Status = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
export type Category = 'Work' | 'Personal' | 'Health' | 'Education' | 'Other';

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface ScheduleItem {
  id: string;
  title: string;
  description: string;
  date: string; // ISO string
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  priority: Priority;
  category: Category;
  status: Status;
  subtasks: SubTask[];
  notes: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
}
