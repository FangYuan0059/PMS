// src/config/passport.ts
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import type { Database } from 'sqlite';

export function configurePassport(db: Database) {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await db.get('SELECT id, username, role, location FROM users WHERE id = ?', id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  passport.use(new LocalStrategy(
    async (username, password, done) => {
      try {
        const user: any = await db.get('SELECT * FROM users WHERE username = ?', username);
        if (!user) {
          return done(null, false, { message: 'Incorrect username' });
        }
        // ▶️ 用 bcrypt 比对
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return done(null, false, { message: 'Incorrect password' });
        }
        // 删除 password 字段再存入 session
        delete user.password;
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));
}
