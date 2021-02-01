const path = require("path");
const fs = require("fs");
const http = require("http");

const express = require("express");
const socketIo = require("socket.io");
const Filter = require("bad-words");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;
const pubDirPath = path.join(__dirname, "..", "public");

app.use(express.static(pubDirPath));
const wsClients = [];

/**
 * Append a given log message to the log file
 * @param {*} logMsg
 */
function appendToLog(logMsg) {
  const dateStr = new Date().toLocaleString();
  logMsg = `${dateStr} ${logMsg}`;

  fs.appendFile("websocket.log", logMsg, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

/**
 * given one of the reserved messages, perform the corresponding action
 * @param {*} messageObj
 */
function tweaksMessage(messageObj) {
  const { message } = messageObj;
  switch (message) {
    case "/bright":
      io.emit("tweak", {
        type: "bright",
      });
      break;
    case "/dark":
      io.emit("tweak", {
        type: "dark",
      });
      break;
    default:
      break;
  }
}

/**
 * parse the socket's ip address and port for addition to logs
 * @param {*} socket
 */
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

  // on client chat
  socket.on("clientChat", (msgObj, callback) => {
    const filter = new Filter();
    appendToLog(`${JSON.stringify(msgObj)}\n`);

    const { message } = msgObj;
    if (filter.isProfane(message)) {
      appendToLog(`Profanity detected: '${message}'`);
      return callback("Watch your language");
    }

    // check if the leading character is a backslash
    if (message === "/") {
      tweaksMessage(msgObj);
    }

    io.emit("chatMessage", msgObj);
  });

  // a client has send lat lng from geolocation api
  socket.on("userLocation", (latLngObj, callback) => {
    callback("Location Shared Successfully");
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

/**
 * display the number of clients currently connected.
 * Emit this count to all connected clients
 */
function sendConnectedClientCount() {
  const clientStr = wsClients.length > 1 ? "clients" : "client";
  const areIs = wsClients.length > 1 ? "are" : "is";
  const messageStr = `There ${areIs} currently ${wsClients.length} ${clientStr}`;
  io.emit("clientCount", messageStr);
}

server.listen(port, () => console.log(`Server running on port ${port}`));
