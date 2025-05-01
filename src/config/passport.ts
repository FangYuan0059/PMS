import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { User } from '../models/User';

export function configurePassport(db: any) {
  passport.use(new LocalStrategy(
    async (username, password, done) => {
      const user: User = await db.get('SELECT * FROM users WHERE username = ?', username);
      if (!user) return done(null, false, { message: 'Incorrect username' });
      if (user.password !== password) return done(null, false, { message: 'Incorrect password' });
      return done(null, user);
    }
  ));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    const user: User = await db.get('SELECT * FROM users WHERE id = ?', id);
    done(null, user);
  });
}
