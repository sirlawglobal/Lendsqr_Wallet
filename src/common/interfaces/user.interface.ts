export interface IUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: 'user' | 'admin';
  status: 'active' | 'restricted' | 'deactivated' | 'pending';
  created_at: Date;
  updated_at: Date;
}
