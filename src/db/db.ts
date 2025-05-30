import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';

export async function initDB() {
  const db = await open({
    filename: './site-profit.db',
    driver: sqlite3.Database
  });

  //sites
  await db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    num_machines INTEGER NOT NULL,
    machine_type TEXT NOT NULL,
    power_rate REAL NOT NULL
  );
`);
// users
await db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL, -- 'admin' or 'user'
  location TEXT -- 对于管理员用户可为空
);
`);

//site metrics
await db.exec(`
CREATE TABLE IF NOT EXISTS site_metrics (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id           INTEGER NOT NULL,
  timestamp         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  kas_price         REAL    NOT NULL,
  hourly_kas        REAL    NOT NULL,
  revenue           REAL    NOT NULL,
  cost              REAL    NOT NULL,
  profit            REAL    NOT NULL,
  unit_profit       REAL    NOT NULL,
  network_hashrate  REAL    NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
`);

//init datas
const adminPwdHash = await bcrypt.hash('123', 10);

await db.run(
    `INSERT OR IGNORE INTO users (username, password, role, location)
     VALUES ('admin', ?, 'admin', NULL),
            ('vincent', ?, 'user', 'york'),
            ('jeff', ?, 'user', 'austin'),
            ('dan', ?, 'user', 'iowa'),
            ('fang', ?,'admin', NULL)`,
            adminPwdHash,
            adminPwdHash,
            adminPwdHash,
            adminPwdHash,
            adminPwdHash
  );
  
  return db;
}
