import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function initDB() {
  const db = await open({
    filename: './site-profit.db',
    driver: sqlite3.Database
  });

  await db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    num_machines INTEGER NOT NULL,
    machine_type TEXT NOT NULL,
    power_rate REAL NOT NULL
  );
`);

  return db;
}
