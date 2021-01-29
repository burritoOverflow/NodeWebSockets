const express = require("express");
const path = require("path");

const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;
const pubDirPath = path.join(__dirname, "..", "public");

app.use(express.static(pubDirPath));
const wsClients = [];

function appendToLog(logMsg) {
  fs.appendFile("websocket.log", logMsg, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

io.on("connection", (socket) => {
  wsClients.push(socket);
  appendToLog(`New WebSocket connection ${wsClients.length} clients\n`);
  sendConnectedClientCount();
  socket.on("clientChat", (message) => {
    appendToLog(`${JSON.stringify(message)}\n`);
    io.emit("chatMessage", message);
  });

  socket.on("disconnect", () => {
    // remove client
    const idx = wsClients.indexOf(socket);
    wsClients.splice(idx, 1);
    appendToLog(`Client removed. ${wsClients.length} clients remaining\n`);
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
