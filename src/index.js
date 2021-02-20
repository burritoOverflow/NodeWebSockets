// built-in modules
const path = require('path');
const http = require('http');

// external deps
const express = require('express');
const socketIo = require('socket.io');
const Filter = require('bad-words');
const cookieParser = require('cookie-parser');

// user defined
const { Users } = require('./utils/Users');
const { SidMap } = require('./utils/SidMap');
const verifyUserJWT = require('./utils/verifyJWT');
const { appendToLog } = require('./utils/logging');
require('./db/mongoose');

// models
const {
  addSocketIoIdToUser,
  addMessage,
  addUserToRoom,
  removeUserOnDisconnect,
  addSIDToUserAndJoinRoom,
} = require('./db/updateDb');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;
const pubDirPath = path.join(__dirname, '..', 'public');

app.use(express.static(pubDirPath));
app.use(express.json());
app.use(cookieParser());

// middleware for maintenance; set NODE_ENV to ret 503 if === "maintenance"
app.use(require('./middleware/maintenance'));

// user router
app.use('/api', require('./routes/user'));
app.use('/api', require('./routes/room'));
app.use('/api', require('./routes/messages'));

const allUsers = new Users();
const sioRoomMap = new SidMap();

// without a user logged in, send the user the login page, otherwise, send the choose room page
app.get('/', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (userObj.name) {
      if (process.env.NODE_ENV === 'production') {
        res.cookie('username', userObj.name, { httpOnly: true, secure: true });
      } else {
        res.cookie('username', userObj.name, { httpOnly: true });
      }
      res.cookie('displayname', userObj.name);
      res.sendFile(path.join(__dirname, '..', 'html', 'index.html'));
    } // no name invalid
  } else {
    res.redirect('/login');
  }
});

app.get('/joinroom', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj) {
      // invalid JWT
      res.redirect('/signup');
    }
  } else {
    // send the user to the join a room page
    res.sendFile(path.join(__dirname, '..', 'html', 'index.html'));
  }
});

app.get('/signup', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'signup.html'));
});

// route for chat
app.get('/chat', async (req, res) => {
  if (req.cookies.token) {
    // attempting to navigate to chat without qs params isn't valid
    if (req.query.username === '' || req.query.room === '') {
      res.redirect('/');
    }

    // hmm attempted access with a different username
    if (req.query.username !== req.cookies.displayname) {
      res.status(401).send({
        Error: 'Unauthorized',
      });
    }
    const userObj = await verifyUserJWT(req.cookies.token);
    if (userObj.name) {
      // valid; join chat
      res.sendFile(path.join(__dirname, '..', 'html', 'chat.html'));
    } else {
      // not TODO
      res.redirect('/signup');
    }
  } else {
    // also invalid; not a user
    res.redirect('/signup');
  }
});

// login route
app.get('/login', async (req, res) => {
  if (req.cookies.token) {
    // verify if the user is a valid user
    const user = await verifyUserJWT(req.cookies.token);
    if (!user) {
      // invalid token
      res.sendFile(path.join(__dirname, '..', 'html', 'login.html'));
    } else {
      // valid user, so they can join a room
      res.sendFile(path.join(__dirname, '..', 'html', 'chat.html'));
    }
  } else {
    res.sendFile(path.join(__dirname, '..', 'html', 'login.html'));
  }
});

// api route for the current rooms
app.get('/rooms', (req, res) => {
  res.json(allUsers.getAllOccupiedRoomsAndCount());
});

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

/**
 *
 * @param {string} room - the room to broadcast the user list to
 * @return array of all the usernames in the room
 */
function getAllUsernamesInRoom(room) {
  return (
    allUsers
      .getUsersInRoom(room)
      // eslint-disable-next-line no-sequences
      .reduce(
        // eslint-disable-next-line no-sequences
        (usernames, user) => (usernames.push(user.username), usernames),
        [],
      )
  );
}

/**
 * Send a list of the usernames in the room
 * @param {string} room - the room to send the client list to
 */
function sendUsernamesListForRoom(room) {
  io.to(room).emit('currentRoomUsers', getAllUsernamesInRoom(room));
}

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
  const cookies = socket.handshake.headers.cookie;

  appendToLog(
    `Connection event from ${getIpAddrPortStr(socket)} sid: ${socket.id} ${
      allUsers.users.length
    } clients\n`,
  );

  const tokenCookieValue = cookies.split(';')[0].split('=')[1];
  const usernameCookieValue = cookies.split(';')[1].split('=')[1];

  // add the sid to the user
  // addSocketIoIdToUser(socket, tokenCookieValue, usernameCookieValue);

  // listener for a client joining
  // eslint-disable-next-line consistent-return
  socket.on('join', ({ username, room }, callback) => {
    sioRoomMap.addSidRoomMapping(socket.id, room);

    appendToLog(
      `join event from ${socket.id} in room ${room} with username ${username}\n`,
    );
    const { error } = allUsers.addUser({ id: socket.id, username, room });

    // addUserToRoom(socket.id, room);
    addSIDToUserAndJoinRoom(
      socket,
      tokenCookieValue,
      usernameCookieValue,
      room,
    );

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

    // send data for the count of clients and the number of users in the room
    sendConnectedClientCount(room);
    sendUsernamesListForRoom(room);

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

    // update the db with the message sent
    addMessage(socket, msgObj, socketUser.room);

    // emit the message
    io.to(socketUser.room).emit('chatMessage', msgObj);
  }); // end client chat

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
    let room;
    try {
      room = allUsers.getUser(socket.id).room;
    } catch (error) {
      // disconnect fired without user being added to the users arr
      room = sioRoomMap.getSidRoomMapping(socket.id);
      appendToLog('User not found in user array');
      console.log(error);
    } finally {
      removeUserOnDisconnect(
        socket,
        tokenCookieValue,
        usernameCookieValue,
        room,
      );
    }

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
      sendUsernamesListForRoom(user.room);
    }
  });
}); // end socket io block

// start server
server.listen(port, () => appendToLog(`Server running on port ${port}\n`));
