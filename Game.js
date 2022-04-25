import { Database } from "./Database.js";

export class Game {
  instance = null;
  static io = null;

  static getInstance() {
    if (!instance) {
      this.instance = new Game();
    }
    return this.instance;
  }

  static setIO(io) {
    Game.io = io;
  }

  start(catalogueId) {
    Database.getInstance().then((db) => {
      db.all("SELECT * FROM questions WHERE catalogue=?;", catalogueId).then(
        (result) => {}
      );
    });
  }

  sendState() {
    io.emit("stateUpdate", this);
  }
}
