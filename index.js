import express from "express";
const app = express();
import http from "http";
const server = http.createServer(app);
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import crypto from "crypto";
import cookie from "cookie";
import { Database } from "./Database.js";
import { Game } from "./Game.js";
const io = new Server(server);
Game.setIO(io);

app.use(bodyParser.json());

app.use(cookieParser());
app.set("view engine", "pug");

app.get("/auth", (req, res) => {
  res.sendFile(
    join(dirname(fileURLToPath(import.meta.url)), "/webapp/auth.html")
  );
});

app.get("/js/:file", (req, res) => {
  res.sendFile(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "/webapp/js/",
      req.params.file
    )
  );
});

app.post("/auth", async (req, res) => {
  let valid = await checkAuth(req.body.token);
  console.log(req.body.token);
  if (!valid) {
    res.sendStatus(403);
    return;
  }
  res.cookie("token", req.body.token, { maxAge: 604800000 });
  res.sendStatus(200);
});

app.use(async (req, res, next) => {
  let valid = await checkAuth(req.cookies.token);
  if (!valid) {
    res.redirect("/auth");
    return;
  }
  console.log(`${req.method} - ${req.url}`);
  next();
});

// Creates a new catalogue
app.post("/catalogue", (req, res) => {
  if (req.body.name == null) {
    res.status(400);
    res.send("catalogue requires name");
    return;
  }
  db.run("INSERT INTO catalogue (name) VALUES (?);", req.body.name)
    .then(() => {
      res.sendStatus(200);
    })
    .catch((e) => {
      res.sendStatus(500);
      console.log(e);
    });
});

// Delete an existing catalogue (and all its questions)
app.delete("/catalogue/:id", async (req, res) => {
  db.run("DELETE FROM catalogue WHERE id=?;", req.params.id).then(() => {
    res.sendStatus(200);
  });
});

// Retrieves an existing catalogue
app.get("/catalogue/:id", async (req, res) => {
  let qData = await db.all(
    "SELECT * FROM questions WHERE catalogue=?;",
    req.params.id
  );
  let cData = await db.get("SELECT * FROM catalogue WHERE id=?", req.params.id);
  res.render("catalogue", { qData: qData, cData: cData });
});

// Updates an existing catalogue
app.post("/catalogue/:id", async (req, res) => {
  console.log(req.body);
  for (let qId in req.body) {
    await db.run(
      `UPDATE questions SET question=?, answerOne=?, answerTwo=?, 
    answerThree=?, answerFour=?, answerIndex=? WHERE id=?`,
      req.body[qId].question,
      req.body[qId].answerOne,
      req.body[qId].answerTwo,
      req.body[qId].answerThree,
      req.body[qId].answerFour,
      req.body[qId].answerIndex,
      qId
    );
  }
  res.sendStatus(200);
});

// Get all existing catalogues
app.get("/catalogue", (req, res) => {
  db.all("SELECT * FROM catalogue;").then((data) => {
    res.send(data);
  });
});

// Add a new question to an existing catalogue
app.post("/question", (req, res) => {
  if (req.body.catalogue == null) {
    res.sendStatus(400);
    return;
  }
  db.run(
    "INSERT INTO questions (catalogue) VALUES(?);",
    req.body.catalogue
  ).then(() => {
    res.sendStatus(200);
  });
});

app.delete("/question/:id", async (req, res) => {
  if (req.params.id == null) {
    res.sendStatus(400);
    return;
  }
  await db.run("DELETE FROM questions WHERE id=?;", req.params.id);
  res.sendStatus(200);
});

// Game overlay
app.get("/overlay", (req, res) => {
  res.render("overlay");
});

// Display start page
app.get("/", (req, res) => {
  db.all("SELECT * FROM catalogue;").then((cData) => {
    console.log(cData);
    res.render("index", {
      cData: cData,
    });
  });
});

io.on("connection", (socket) => {
  console.log("Viewer " + socket.id + " connected!");
});

const adminNS = io.of("/admin");

adminNS.use(async (socket, next) => {
  if (socket.handshake.headers.cookie == null) {
    return;
  }
  let valid = await checkAuth(
    cookie.parse(socket.handshake.headers.cookie).token
  );
  if (!valid) {
    console.log("Invalid auth for " + socket.id);
    return;
  }
  next();
});

adminNS.on("connection", (socket) => {
  console.log(`Admin ${socket.id} connected`);
});

const db = await Database.getInstance();

await db.migrate();
await db.run("PRAGMA foreign_keys = ON;"); // enable foreign key handling

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

async function checkAuth(token) {
  if (token == null) return false;
  let result = await db.get("SELECT token FROM token WHERE token=?;", token);
  return result != null;
}
