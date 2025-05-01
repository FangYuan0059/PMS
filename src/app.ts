import express from 'express';
import session from 'express-session';
import passport from 'passport';
import path from 'path';
import { initDB } from './db/db';
import siteRouter from './routes/site';
import { configurePassport } from './config/passport';

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

initDB().then(db => {
  app.locals.db = db;

  app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
  }));

  configurePassport(db);
  app.use(passport.initialize());
  app.use(passport.session());

  app.use('/', siteRouter);

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
});
