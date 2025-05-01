import { Router } from 'express';
import passport from 'passport';
import {
  getIndexPage,
  getSitePage,
  postAddSite
} from '../controllers/siteController';
import {
  ensureLoggedIn,
  ensureSiteAccess
} from '../middlewares/authMiddleware';

const router = Router();

// 登录页
router.get('/login', (req, res) => res.render('login'));

// 登录处理
router.post(
  '/login',
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureMessage: true
  }),
  (req, res) => {
    const user = req.user as {
      id: number;
      username: string;
      role: 'admin' | 'user';
      location?: string | null;
    };

    if (user.role === 'admin') {
      res.redirect('/');
    } else {
      res.redirect(`/site/${user.location}`);
    }
  }
);

// 登出
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

// 管理员首页：显示所有站点
router.get('/', ensureLoggedIn, (req, res) => {
  const user = req.user as {
    id: number;
    username: string;
    role: 'admin' | 'user';
    location?: string | null;
  };

  if (user.role === 'admin') {
    return getIndexPage(req, res);
  }
  res.redirect(`/site/${user.location}`);
});

// 普通用户页面：只显示单个站点
router.get(
  '/site/:location',
  ensureLoggedIn,
  ensureSiteAccess,
  getSitePage
);

// 添加站点（仅登录用户）
router.post('/add-site', ensureLoggedIn, postAddSite);

export default router;
