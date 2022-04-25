import sqlite3 from "sqlite3";
import { open } from "sqlite";

export class Database {
  db = null;

  static async getInstance() {
    if (!this.db) {
      this.db = await open({
        filename: "database.db",
        driver: sqlite3.Database,
      });
    }
    return this.db;
  }
}
