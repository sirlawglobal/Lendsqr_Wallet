import { Request } from 'express';

export interface IAuthenticatedRequest extends Request {
  userId: string;
  userRole: 'user' | 'admin';
}
