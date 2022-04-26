import { Server } from "socket.io";
import { Database } from "./Database.js";

export class Game {
  static instance = null;
  static io = null;
  static adminNS;
  running = false;
  questions = [];
  currentQuestion = 0;
  questionVisible = false;
  selectedAnswer = null;
  solved = false;
  joker = { poll: 3, fiftyFifty: 2 };

  constructor() {
    Game.adminNS.fetchSockets().then((sockets) => {
      for (const socket of sockets) {
        socket.on("showQuestion", () => {
          this.questionVisible = true;
          this.sendState();
        });

        socket.on("nextQuestion", () => {
          if (this.currentQuestion + 1 >= this.questions.length) {
            this.running = false;
          } else {
            this.currentQuestion++;
            this.selectedAnswer = null;
          }
          this.questionVisible = false;
          this.solved = false;
          this.sendState();
        });

        socket.on("selectAnswer", (index) => {
          if (typeof index != "number") {
            return;
          }
          this.selectedAnswer = index;
          this.sendState();
        });

        socket.on("solve", () => {
          this.solved = true;
          this.sendState();
        });
      }
    });
  }

  /**
   * Returns a (new) instance of game
   * @returns {Game} instance of Game
   */
  static getInstance() {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  /**
   * Sets the io server for Game interactions
   * @param {Server} io
   */
  static setIO(io) {
    Game.io = io;
    Game.adminNS = io.of("/admin");
  }

  /**
   * Start a new game
   * @param {Number} catalogueId ID of the catalogue to use
   */
  async start(catalogueId) {
    let catalogue = await (
      await Database.getInstance()
    ).all("SELECT * FROM questions WHERE catalogue=?;", catalogueId);
    if (!catalogue) {
      return false;
    }
    questions = catalogue;
    this.running = true;
    this.sendState();
    return true;
  }

  /**
   * Stop the currently running game
   */
  stop() {
    Game.adminNS.fetchSockets().then((sockets) => {
      for (const socket of sockets) {
        //TODO: does actually nothing.
        socket.removeAllListeners(
          "showQuestion",
          "nextQuestion",
          "selectAnswer",
          "solve"
        );
      }
    });
    delete Game.instance;
  }

  /**
   * Send the current game state to all sockets
   */
  sendState() {
    Game.adminNS.emit("stateUpdate", this);
    Game.io.emit("stateUpdate", this);
  }
}
