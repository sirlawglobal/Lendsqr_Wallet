export interface ITransaction {
  id: number;
  user_id: string;
  type: 'credit' | 'debit';
  amount: number;
  reference: string;
  description: string;
  created_at: Date;
}
