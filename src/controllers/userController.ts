// src/controllers/userController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';

export const postAddUser = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db;
  const { username, password, location } = req.body;

  // 简单校验
  if (!username || !password || !location) {
    return res.redirect(`${req.header('Referer') || '/'}?error=missing_fields`);
  }

  // 哈希密码
  const hash = await bcrypt.hash(password, 10);

  // 插入普通用户
  await db.run(
    `INSERT INTO users (username, password, role, location)
     VALUES (?, ?, 'user', ?)`,
    username,
    hash,
    location
  );

  res.redirect(`${req.header('Referer') || '/'}?success=user_added`);
};
