export interface ITransaction {
  id: number;
  user_id: number;
  type: 'credit' | 'debit';
  amount: number;
  reference: string;
  description: string;
  created_at: Date;
}
