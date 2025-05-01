import { Router } from 'express';
import passport from 'passport';
import { getIndexPage, postAddSite } from '../controllers/siteController';
import { ensureLoggedIn, ensureSiteAccess } from '../middlewares/authMiddleware';

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

// 根页面：根据身份跳转
router.get('/', ensureLoggedIn, (req, res) => {
  const user = req.user as {
    id: number;
    username: string;
    role: 'admin' | 'user';
    location?: string | null;
  };

  if (user.role === 'admin') return getIndexPage(req, res);
  res.redirect(`/site/${user.location}`);
});

// location 页面（带权限控制）
router.get('/site/:location', ensureLoggedIn, ensureSiteAccess, getIndexPage);

// 添加站点（受限）
router.post('/add-site', ensureLoggedIn, postAddSite);

export default router;
