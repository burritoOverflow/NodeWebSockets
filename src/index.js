// built-in modules
const path = require('path');
const fs = require('fs');
const http = require('http');

// external user-defined

// external deps
const express = require('express');
const socketIo = require('socket.io');
const Filter = require('bad-words');
const { Users } = require('./utils/Users');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;
const pubDirPath = path.join(__dirname, '..', 'public');

app.use(express.static(pubDirPath));

const allUsers = new Users();

// api route for the current rooms
app.get('/rooms', (req, res) => {
  res.json(allUsers.getAllOccupiedRoomsAndCount());
});

/**
 * Append a given log message to the log file
 * @param {string} logMsg
 */
function appendToLog(logMsg) {
  const dateStr = new Date().toLocaleString();
  // prepend the current date string
  const outputLogMsg = `${dateStr} ${logMsg}`;

  fs.appendFile('websocket.log', outputLogMsg, (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });
}

/**
 *
 * @param {string} message - the message (multiple strings, typically)
 * to determine if the message contains a tweak.
 * @return {*} - object containing the index of the tweak msg (if applicable)
 */
function determineIfMsgContainsTweak(message) {
  const msgTokens = message.split(' ');
  let hasTweakMsg = false;
  let msgTokenIdx = -1;

  msgTokens.forEach((token, idx) => {
    if (token[0] === '/') {
      hasTweakMsg = true;
      msgTokenIdx = idx;
    }
  });

  return {
    hasTweakMsg,
    idx: msgTokenIdx,
  };
}

/**
 * display the number of clients currently connected in the room.
 * Emit this count to all connected clients in the same room
 * @param {string} room - string of the room
 */
function sendConnectedClientCount(room) {
  const usersInRoom = allUsers.getUsersInRoom(room).length;
  io.to(room).emit('clientCount', usersInRoom);
}

// eslint-disable-next-line no-console
server.listen(port, () => console.log(`Server running on port ${port}`));

/**
 * given one of the reserved messages, perform the corresponding action
 * @param {*} messageObj
 * @param {string} room - the room to send the message to
 * @return {boolean}- boolean indicating if the message was a valid tweak
 */
function tweaksMessage(messageObj, room) {
  const { message } = messageObj;
  let validTweakMessage;
  switch (message) {
    case '/bright':
    case '/light':
      io.to(room).emit('tweak', {
        type: 'bright',
      });
      validTweakMessage = 'Bright Mode Activated';
      break;
    case '/dark':
      io.to(room).emit('tweak', {
        type: 'dark',
      });
      validTweakMessage = 'Dark Mode Activated';
      break;
    case '/slidedown':
      io.to(room).emit('tweak', { type: 'slidedown' });
      validTweakMessage = "I'm MELTING";
      break;
    default:
      break;
  }
  return validTweakMessage;
}

/**
 * parse the socket's ip address and port for addition to logs
 * @param {*} socket
 * @return  {string} - template literal ip addr
 */
function getIpAddrPortStr(socket) {
  return `${socket.handshake.address}`;
}

// registered event handlers for sockets
io.on('connection', (socket) => {
  appendToLog(
    `New WebSocket connection from ${getIpAddrPortStr(socket)} ${
      allUsers.users.length
    } clients\n`,
  );

  // listener for a client joining
  // eslint-disable-next-line consistent-return
  socket.on('join', ({ username, room }, callback) => {
    const { error } = allUsers.addUser({ id: socket.id, username, room });

    // in the event the user cannot be added, inform them and halt execution
    if (error) {
      return callback(error);
    }

    // join the room specified
    socket.join(room);

    // broadcast the 'user joined message' to the room if user added
    // successfully
    socket.broadcast
      .to(room)
      .emit('newUserMessage', `User ${username} has joined!`);

    sendConnectedClientCount(room);

    // invoke the user's callback without error on successful join
    callback();
  });

  // on client chat event - emitted when a user sends a message
  // eslint-disable-next-line consistent-return
  socket.on('clientChat', (msgObj, callback) => {
    const filter = new Filter();
    appendToLog(`${JSON.stringify(msgObj)}\n`);

    const { message } = msgObj;
    // determine if the message is inappropriate
    if (filter.isProfane(message)) {
      appendToLog(`Profanity detected: '${message}'`);
      return callback('Watch your language');
    }

    // if not, send the message to the user's room
    const socketUser = allUsers.getUser(socket.id);

    // check if the leading character is a backslash
    const tweakMsgObj = determineIfMsgContainsTweak(message);

    if (tweakMsgObj.hasTweakMsg) {
      // valid tweaks message changes the message to deliver
      const msgTokenIdx = tweakMsgObj.idx;
      const validTweak = tweaksMessage(
        { message: message.split(' ')[msgTokenIdx] },
        socketUser.room,
      );
      if (validTweak) {
        // eslint-disable-next-line no-param-reassign
        msgObj.message = validTweak;
      }
    }

    // add the user's name to the message object
    // eslint-disable-next-line no-param-reassign
    msgObj.username = socketUser.username;

    // emit the message
    io.to(socketUser.room).emit('chatMessage', msgObj);
  });

  // a client has send lat lng from geolocation api
  socket.on('userLocation', (latLngObj, callback) => {
    callback('Location Shared Successfully');
    appendToLog(
      `${getIpAddrPortStr(socket)} Client Coords: ${JSON.stringify(
        latLngObj,
      )}\n`,
    );
  });

  // fires when an individual socket (client) disconnects
  socket.on('disconnect', () => {
    const user = allUsers.removeUserById(socket.id);

    // possibility exists that a user may never have joined a room,
    // but the join event fires initially
    if (user) {
      // show the 'user left' toast on the client
      io.to(user.room).emit('userLeft', `${user.username} has left the chat.`);
      appendToLog(
        `Client removed: ${getIpAddrPortStr(socket)}. ${
          allUsers.getUsersInRoom(user.room).length
        } clients remaining in ${user.room}\n`,
      );
      // update clients UI to reflect disconnect
      sendConnectedClientCount(user.room);
    }
  });
}); // end socket io block
