const express = require("express");
const path = require("path");

const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;
const pubDirPath = path.join(__dirname, "..", "public");

app.use(express.static(pubDirPath));
const wsClients = [];

io.on("connection", (socket) => {
  wsClients.push(socket);
  console.log(`New WebSocket connection ${wsClients.length} clients`);

  sendConnectedClientCount();

  socket.on("clientChat", (message) => {
    console.log(message);
    io.emit("chatMessage", message);
  });

  socket.on("disconnect", () => {
    console.log("Got disconnect event");
    // remove client
    const idx = wsClients.indexOf(socket);
    wsClients.splice(idx, 1);
    console.log(`Client removed ${wsClients.length} clients`);

    // update clients UI to reflect disconnect
    sendConnectedClientCount();
  });
});

function sendConnectedClientCount() {
  const clientStr = wsClients.length > 1 ? "clients" : "client";
  const areIs = wsClients.length > 1 ? "are" : "is";
  const messageStr = `There ${areIs} currently ${wsClients.length} ${clientStr}`;
  io.emit("clientCount", messageStr);
}

server.listen(port, () => console.log(`Server running on port ${port}`));
