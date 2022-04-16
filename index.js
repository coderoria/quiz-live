import express from "express";
const app = express();
import http from "http";
const server = http.createServer(app);
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import crypto from "crypto";
const io = new Server(server);

app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());

app.get("/auth", (req, res) => {
  res.sendFile(dirname(fileURLToPath(import.meta.url)) + "/webapp/auth.html");
});

app.post("/auth", (req, res) => {
  if (req.body.token == "auth") {
    res.redirect("/");
  } else {
    res.redirect("?wrong=1");
  }
});

app.use(
  express.static(join(dirname(fileURLToPath(import.meta.url)), "/webapp"))
);

app.use((req, res, next) => {
  if (req.cookies.token == null) {
    res.redirect("/auth");
  }
});

io.on("connection", (socket) => {
  console.log("Socket " + socket.id + " connected!");
});

const db = await open({
  filename: "database.db",
  driver: sqlite3.Database,
});

await db.migrate();

console.log("Migrated database to newest schema");

db.get("SELECT token FROM token;").then((data) => {
  if (data == null) {
    crypto.randomBytes(32, async (err, buff) => {
      console.log(`Generated token: ${buff.toString("base64")}`);
      await db.run("INSERT INTO token VALUES (?);", buff.toString("base64"));
    });
  }
});

server.listen(3000, () => {
  console.log("Listening on *:3000");
});
