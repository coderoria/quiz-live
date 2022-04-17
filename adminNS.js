export class adminNS {
  adminIO;

  constructor(io) {
    this.adminIO = io.of("/admin");

    this.adminIO.on("connection", (socket) => {
      console.log(`Admin ${socket.id} connected`);
    });
  }
}
