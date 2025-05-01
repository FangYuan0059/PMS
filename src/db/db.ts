import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

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

//init datas
await db.run(
    `INSERT OR IGNORE INTO users (username, password, role, location)
     VALUES ('admin', 'admin123', 'admin', NULL),
            ('user-1', 'user123', 'user', 'york')`
  );
  


  return db;
}
