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
}
