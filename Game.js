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
        socket.on("showQuestion", this.showQuestion.bind(this));
        socket.on("nextQuestion", this.nextQuestion.bind(this));
        socket.on("selectAnswer", this.selectAnswer.bind(this));
        socket.on("solve", this.solve.bind(this));
        socket.on("useJoker", this.useJoker.bind(this));
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
    this.questions = catalogue;
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
        socket.removeAllListeners("showQuestion");
        socket.removeAllListeners("nextQuestion");
        socket.removeAllListeners("selectAnswer");
        socket.removeAllListeners("solve");
        socket.removeAllListeners("useJoker");
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

  /**
   * Makes the current question visible
   */
  showQuestion() {
    this.questionVisible = true;
    this.sendState();
  }

  /**
   * Switch to next question in catalogue.
   * If none is left, end the game
   */
  nextQuestion() {
    if (this.currentQuestion + 1 >= this.questions.length) {
      this.running = false;
    } else {
      this.currentQuestion++;
      this.selectedAnswer = null;
    }
    this.questionVisible = false;
    this.solved = false;
    this.sendState();
  }

  /**
   * Select the answer the contestant chose
   * @param {Number} index Answer index from 0-3
   * @returns {void}
   */
  selectAnswer(index) {
    if (typeof index != "number") {
      return;
    }
    this.selectedAnswer = index;
    this.sendState();
  }

  /**
   * Solve the current question
   */
  solve() {
    this.solved = true;
    this.sendState();
  }

  /**
   * Use a joker, if available
   * @param {String} name Name of the joker
   */
  useJoker(name) {
    if (!this.joker[name] || this.joker[name] <= 0) {
      return;
    }
    if (name == "fiftyFifty") {
      let answerOptions = [
        "answerOne",
        "answerTwo",
        "answerThree",
        "answerFour",
      ];
      answerOptions.splice(this.questions[this.currentQuestion].answerIndex);
      for (let i = 0; i < 2; i++) {
        this.questions[this.currentQuestion][
          answerOptions[Math.round(Math.random() * answerOptions.length)]
        ] = "";
      }
    }
    // TODO: poll joker
    this.joker[name]--;
    this.sendState();
  }
}
