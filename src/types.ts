export interface UserProfile {
  uid: string;
  firstName: string;
  lastName?: string;
  email: string;
  photoURL?: string;
  currency: string;
}

export interface Transaction {
  id?: string;
  uid: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
  month: string;
}

export interface Goal {
  id?: string;
  uid: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  month: string;
  category: string;
}

export interface Reminder {
  id?: string;
  uid: string;
  title: string;
  amount: number;
  dueDate: string;
  isPaid: boolean;
}

export interface Notification {
  id?: string;
  uid: string;
  title: string;
  message: string;
  type: 'reminder' | 'goal' | 'system';
  createdAt: string;
  isRead: boolean;
  relatedId?: string;
}

export interface Asset {
  id?: string;
  uid: string;
  ticker: string;
  quantity: number;
  averagePrice?: number;
  type: 'Ação' | 'FII' | 'Renda Fixa' | 'Cripto' | 'Outros';
}

export interface Dividend {
  id?: string;
  uid: string;
  ticker: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  quantity: number;
  valuePerShare: number;
  total: number;
}
