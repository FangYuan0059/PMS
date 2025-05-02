import { Request, Response } from 'express';
import bcrypt from 'bcrypt';

export const postChangePassword = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db;
  const user = req.user as { id: number; username: string };

  const { currentPassword, newPassword, confirmPassword } = req.body;
  // 1) 新密码两次输入必须一致
  if (newPassword !== confirmPassword) {
    return res.redirect(`${req.header('Referer') || '/'}?error=password_mismatch`);
  }

  // 2) 验证当前密码
  const rawRow = await db.get(
    'SELECT password FROM users WHERE id = ?', user.id
  );

  const row = rawRow as { password: string } | undefined;
  
  if (!row) {
    return res.redirect(`${req.header('Referer') || '/'}?error=user_not_found`);
  }
  const match = await bcrypt.compare(currentPassword, row.password);
  if (!match) {
    return res.redirect(`${req.header('Referer') || '/'}?error=incorrect_current`);
  }

  // 3) 哈希新密码并更新
  const hash = await bcrypt.hash(newPassword, 10);
  await db.run('UPDATE users SET password = ? WHERE id = ?', hash, user.id);

  return res.redirect(`${req.header('Referer') || '/'}?success=password_changed`);
};
