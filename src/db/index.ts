import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";

const dbPath = path.join(app.getPath("userData"), "remy.db");
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite);
