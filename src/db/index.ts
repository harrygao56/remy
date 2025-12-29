import { drizzle } from "drizzle-orm/libsql";
import { app } from "electron";
import path from "path";

const dbPath = path.join(app.getPath("userData"), "remy.db");
export const db = drizzle(`file:${dbPath}`);
