import { Server, Socket } from "socket.io";
import { Database } from "./Database.js";
import { Twitch } from "./Twitch.js";

export class Game {
  static instance = null;
  static io = null;
  static adminNS;
  broadcasterId;
  running = false;
  questions = [];
  currentQuestion = 0;
  questionVisible = false;
  selectedAnswer = null;
  solved = false;
  joker = { poll: 3, fiftyFifty: 2 };
  currentPoll;
  pollResult = [];

  constructor() {
    Game.adminNS.fetchSockets().then((sockets) => {
      for (const socket of sockets) {
        this.bindSocket(socket);
      }
    });
    Game.adminNS.on("connection", (socket) => {
      this.bindSocket(socket);
    });
  }

  /**
   * Bind events for a game to the supplied socket
   * @param {Socket} socket Socket to bind to
   */
  bindSocket(socket) {
    socket.on("showQuestion", this.showQuestion.bind(this));
    socket.on("nextQuestion", this.nextQuestion.bind(this));
    socket.on("selectAnswer", this.selectAnswer.bind(this));
    socket.on("solve", this.solve.bind(this));
    socket.on("useJoker", this.useJoker.bind(this));
    socket.on("sendState", this.sendState.bind(this));
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
   * @param {Number} broadcasterId ID of the broadcaster (channel)
   */
  async start(catalogueId, broadcasterId) {
    if (!catalogueId || !broadcasterId) {
      return false;
    }
    this.broadcasterId = broadcasterId;
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
        socket.removeAllListeners("sendState");
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
    let activeQ = this.questions[this.currentQuestion];
    Twitch.getInstance()
      .startPoll(
        this.broadcasterId,
        activeQ.question,
        [
          activeQ.answerOne,
          activeQ.answerTwo,
          activeQ.answerThree,
          activeQ.answerFour,
        ],
        15
      )
      .then((id) => {
        this.currentPoll = id;
      });
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
  async useJoker(name) {
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
    if (name == "poll") {
      let poll = await Twitch.getInstance().getPoll(
        this.broadcasterId,
        this.currentPoll
      );
      if (!poll) {
        return;
      }
      let totalVotes = 0;
      for (let choice of poll.choices) {
        totalVotes += choice.votes;
      }

      for (let choice of poll.choices) {
        this.pollResult.push((choice.votes / totalVotes) * 100);
      }
    }
    this.joker[name]--;
    this.sendState();
  }
}
