import 'express';

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      role: 'admin' | 'user';
      location?: string | null;
    }
  }
}
