import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function initDB() {
  const db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      xp INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0
    )
  `);

  return db;
}