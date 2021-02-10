// built-in modules
const path = require('path');
const fs = require('fs');
const http = require('http');

// external deps
const express = require('express');
const socketIo = require('socket.io');
const Filter = require('bad-words');
const cookieParser = require('cookie-parser');

// user defined
const { Users } = require('./utils/Users');
const verifyUserJWT = require('./utils/verifyJWT');
require('./db/mongoose');

// models
const { User } = require('./models/user');
const { Message } = require('./models/messages');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;
const pubDirPath = path.join(__dirname, '..', 'public');

app.use(express.static(pubDirPath));
app.use(express.json());
app.use(cookieParser());

// user router
app.use('/api', require('./routes/user'));

const allUsers = new Users();

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
    // TODO redirect to login
    res.redirect('/signup');
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
    res.redirect('/signup');
  }
});

app.get('/signup', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'signup.html'));
});

// route for chat
app.get('/chat', async (req, res) => {
  if (req.cookies.token) {
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
  const cookies = socket.handshake.headers.cookie;

  appendToLog(
    `New WebSocket connection from ${getIpAddrPortStr(socket)} ${
      allUsers.users.length
    } clients\n`,
  );

  const tokenCookieValue = cookies.split(';')[0].split('=')[1];
  const usernameCookieValue = cookies.split(';')[1].split('=')[1];

  User.findOne(
    {
      'tokens.token': tokenCookieValue,
      name: usernameCookieValue,
    },
    (err, user) => {
      if (err) {
        console.error(err);
      }
      const { socketIOIDs } = user;
      socketIOIDs.push({ sid: socket.id });
      user.save().then((savedUser) => {
        if (savedUser === user) {
          console.log('Connect: User saved');
        }
      });
    },
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

    User.findOne(
      {
        'socketIOIDs.sid': socket.id,
      },
      (err, _user) => {
        if (err) {
          console.error(err);
          return;
        }
        // eslint-disable-next-line no-underscore-dangle
        const _message = new Message({
          contents: message,
          // eslint-disable-next-line no-underscore-dangle
          sender: _user._id,
        });
        _message.save().then((savedMessage) => {
          if (savedMessage === _message) {
            console.log('Message Saved');
          }
        });
      },
    );

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
    const user = allUsers.removeUserById(socket.id);

    // remove the disconnected socket's id from
    // the user's document
    User.findOne(
      {
        'tokens.token': tokenCookieValue,
        name: usernameCookieValue,
      },
      (err, _user) => {
        if (err) {
          console.error(err);
        }
        const { socketIOIDs } = _user;
        // socketIOIDs.push({ sid: socket.id });
        // remove the existing socket from the user's sids
        const filteredSIDs = socketIOIDs.filter(
          (_socket) => _socket.sid !== socket.id,
        );
        _user.socketIOIDs = filteredSIDs;
        _user.save().then((savedUser) => {
          if (savedUser === _user) {
            console.log('Disconnect: User saved');
          }
        });
      },
    );

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
