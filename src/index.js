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
  const dateStr = new Date().toLocaleString();
  logMsg = `${dateStr} ${logMsg}`;

  fs.appendFile("websocket.log", logMsg, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

// parse the socket's ip address and port for addition to logs
function getIpAddrPortStr(socket) {
  return `${socket.handshake.address}`;
}

io.on("connection", (socket) => {
  wsClients.push(socket);
  appendToLog(
    `New WebSocket connection from ${getIpAddrPortStr(socket)} ${
      wsClients.length
    } clients\n`
  );
  sendConnectedClientCount();

  // broadcast the 'user joined message'
  socket.broadcast.emit("newUserMessage", "A new user has joined");

  socket.on("clientChat", (message) => {
    appendToLog(`${JSON.stringify(message)}\n`);
    io.emit("chatMessage", message);
  });

  // a client has send lat lng from geolocation api
  socket.on("userLocation", (latLngObj) => {
    appendToLog(
      `${getIpAddrPortStr(socket)} Client Coords: ${JSON.stringify(
        latLngObj
      )}\n`
    );
  });

  socket.on("disconnect", () => {
    // remove client
    const idx = wsClients.indexOf(socket);
    wsClients.splice(idx, 1);
    appendToLog(
      `Client removed: ${getIpAddrPortStr(socket)}. ${
        wsClients.length
      } clients remaining\n`
    );
    // update clients UI to reflect disconnect
    sendConnectedClientCount();

    // show the 'user left' toast on the client
    io.emit("userLeft", "A user has left the chat.");
  });
});

// display the number of clients currently connected
function sendConnectedClientCount() {
  const clientStr = wsClients.length > 1 ? "clients" : "client";
  const areIs = wsClients.length > 1 ? "are" : "is";
  const messageStr = `There ${areIs} currently ${wsClients.length} ${clientStr}`;
  io.emit("clientCount", messageStr);
}

server.listen(port, () => console.log(`Server running on port ${port}`));
