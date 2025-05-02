import { Request, Response, NextFunction } from 'express';

export function ensureLoggedIn(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect('/login');
  }
  next();
}

export function ensureSiteAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user as {
    id: number;
    username: string;
    role: 'admin' | 'user';
    location?: string | null;
  };

  const paramLoc = req.params.location.toLowerCase();
  const userLoc = user.location?.toLowerCase();
  
  if (user.role === 'admin' || (user.role === 'user' && userLoc === paramLoc)) {
    return next();
  }

  res.status(403).send('Unauthorized Access');
}
