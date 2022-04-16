import express from "express";
const app = express();
import sqlite3 from "sqlite3";
import { open } from "sqlite";

app.get("/", (req, res) => {
  res.send("Not the text!");
});

const db = await open({
  filename: "database.db",
  driver: sqlite3.Database,
});

await db.migrate();

console.log("Migrated database to newest schema");

app.listen(3000);
