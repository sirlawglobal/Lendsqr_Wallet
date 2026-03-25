export interface IUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}
