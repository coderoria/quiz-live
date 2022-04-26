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
import "dotenv/config";
import { Database } from "./Database.js";
import { Game } from "./Game.js";
import { Twitch } from "./Twitch.js";
const io = new Server(server);
Game.setIO(io);

app.use(bodyParser.json());

app.use(cookieParser(process.env.COOKIE_SECRET));
app.set("view engine", "pug");

app.get("/auth", async (req, res) => {
  if (req.query.code) {
    let token = await Twitch.getInstance().authorize(req.query.code);
    if (!token) {
      res.sendStatus(403);
      return;
    }
    res.cookie("token", token, { signed: true });
    res.redirect("/");
    return;
  }
  res.render("auth", {
    redirect: encodeURI(process.env.HOST + "/auth"),
    scopes: "channel:manage:polls",
    clientId: process.env.TWITCH_CLIENT_ID,
  });
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

app.use(async (req, res, next) => {
  let valid = await checkAuth(req.signedCookies.token);
  let twitchValid = await Twitch.getInstance().checkAuth(
    await Twitch.getInstance().getAccessTokenByToken(req.signedCookies.token)
  );
  if (!(valid && twitchValid)) {
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
    cookie.parse(
      decodeURIComponent(socket.handshake.headers.cookie.split(".")[0]).replace(
        "s:",
        ""
      )
    ).token
  );
  if (!valid) {
    console.log("Invalid auth for " + socket.id);
    return;
  }
  next();
});

adminNS.on("connection", (socket) => {
  console.log(`Admin ${socket.id} connected`);
  socket.on("sendTest", () => {
    Game.getInstance().sendState();
    Game.getInstance().stop();
  });
});

const db = await Database.getInstance();

await db.migrate();
await db.run("PRAGMA foreign_keys = ON;"); // enable foreign key handling

console.log("Migrated database to newest schema");

server.listen(3000, () => {
  console.log("Listening on *:3000");
});

/**
 * Checks if the cookie token is a user authorized
 * @param {String} token
 * @returns {Boolean} Wether or not the cookie token is stored in the DB
 */
async function checkAuth(token) {
  if (token == null) return false;
  let result = await db.get("SELECT token FROM token WHERE token=?;", token);
  return result != null;
}
