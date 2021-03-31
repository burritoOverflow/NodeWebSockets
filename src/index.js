// built-in modules
const path = require('path');
const http = require('http');

// external deps
const express = require('express');
const compression = require('compression');

const socketIo = require('socket.io');
const Filter = require('bad-words');
const cookieParser = require('cookie-parser');

// user defined
const { Users } = require('./utils/Users');
const { MutedUsers } = require('./utils/MutedUsers');
const { SidMap } = require('./utils/SidMap');
const verifyUserJWT = require('./utils/verifyJWT');
const { appendToLog } = require('./utils/logging');
require('./db/mongoose');

// models/query helpers
const { User } = require('./models/user');
const { Channel } = require('./models/channel');
const { Room } = require('./models/room');

const {
  addMessage,
  removeUserOnDisconnect,
  addSIDToUserAndJoinRoom,
} = require('./db/updateDb');

const {
  getUsersInRoom,
  checkIfUserAdmin,
  getAdminForChannel,
} = require('./db/queryDb');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;
const pubDirPath = path.join(__dirname, '..', 'public');

app.use(compression({ filter: shouldCompress }));
app.use(express.static(pubDirPath));

app.use(express.json());
app.use(cookieParser());

// middleware for maintenance; set NODE_ENV to ret 503 if === "maintenance"
app.use(require('./middleware/maintenance'));

// user router
app.use('/api', require('./routes/user'));
app.use('/api', require('./routes/room'));
app.use('/api', require('./routes/messages'));
app.use('/api', require('./routes/channel'));

const allUsers = new Users();
const sioRoomMap = new SidMap();

// track the muted users
const mutedUsers = new MutedUsers();

/**
 * Borrowed from the express compression middleware docs.
 * If request header is present, do not compress.
 *
 * @param {*} req - HTTP request
 * @param {*} res - HTTP response
 * @returns
 */
function shouldCompress(req, res) {
  if (req.headers['x-no-compression']) {
    return false;
  }
  // standard filter function
  return compression.filter(req, res);
}

// without a user logged in, send the user the login page, otherwise, send the choose room page
app.get('/', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (userObj.name) {
      if (process.env.NODE_ENV === 'production') {
        res.cookie('username', userObj.name, {
          httpOnly: true,
          secure: true,
          sameSite: true,
        });
      } else {
        // for ease during development (cannot set secure w/o HTTPS)
        res.cookie('username', userObj.name, {
          httpOnly: true,
          sameSite: true,
        });
      }
      // not http cookie, for ease of use to get username
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
    if (!userObj.name) {
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
      return res.status(401).send({
        Error: 'Unauthorized',
      });
    }
    const userObj = await verifyUserJWT(req.cookies.token);
    if (userObj.name) {
      // valid; can join chat
      // first, check the qs params
      const { username, room } = req.query;

      if (username !== req.cookies.username) {
        appendToLog(
          `/chat : ${username} qs param with ${req.cookies.username}`,
        );
        return res.status(401).send({ error: 'Usernames not matching' });
      }

      // validate the room
      // eslint-disable-next-line no-underscore-dangle
      const _room = await Room.findOne({ name: room });
      if (!_room) {
        return res.status(401).send({ error: 'Invalid room requested' });
      }

      res.sendFile(path.join(__dirname, '..', 'html', 'chat.html'));
    } else {
      // not a valid user
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
    const userObj = await verifyUserJWT(req.cookies.token);

    if (!userObj.name) {
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

// channel page
app.get('/channel', async (req, res) => {
  // check that that room requested is a valid channel
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      // not an authorized user
      res.redirect('/login');
    }

    const { channelname } = req.query;
    if (!channelname) {
      res.status(404).send({ error: 'Missing Channel Name' });
    }

    const channel = await Channel.findOne({ name: channelname });
    if (!channel) {
      return res.status(404).send({ error: `No channel ${channelname}` });
    }

    // valid user; let's determine if they're the room's admin
    const user = await User.findOne({ 'tokens.token': req.cookies.token });
    const channelAdmin = await getAdminForChannel(channel.name);

    // eslint-disable-next-line no-underscore-dangle
    if (channelAdmin?._id.equals(user._id)) {
      if (process.env.NODE_ENV === 'production') {
        res.cookie('admin', 'true', {
          httpOnly: true,
          secure: true,
          sameSite: true,
        });
      } else {
        res.cookie('admin', 'true', {
          httpOnly: true,
          sameSite: true,
        });
      } // end cookie check for admin true
    } // set cookie only on admin

    res.sendFile(path.join(__dirname, '..', 'html', 'channel.html'));
  } else {
    res.redirect('/login');
  }
});

app.use((req, res) => {
  res.status(404).send('404: Page not Found');
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
 *
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
 * Mute the user (if a valid user is provided)
 *
 * @param {string} userReqMute - the username of the user requesting the mute
 * @param {string} message - mute user message
 * @param {string} room - the room the users are in
 * @returns {boolean} - true if the user has been muted
 */
async function muteUser(userReqMute, message, room) {
  let userNowMuted = false;

  // check first that the user attempting to mute is admin
  const validMuteReq = await checkIfUserAdmin(room, userReqMute);
  if (!validMuteReq) {
    // done here if invaluid
    return userNowMuted;
  }

  // check first that it's a valid message
  const msgTokens = message.split(' ');

  // get all the usernames; we need to check we're attempting to mute a valid user
  const usernames = await getUsersInRoom(room);
  const providedUsername = msgTokens[1].trim();

  const isValidMute =
    msgTokens[0].trim() === '/mute' || usernames.includes(providedUsername);

  if (isValidMute) {
    // if the username is already in the set, nothing changes
    mutedUsers.addMutedUser(providedUsername, room);
    userNowMuted = true;
  }

  return userNowMuted;
}

/**
 * Unmute the user (if a valid user is provided and user attempting is admin for the room)
 *
 * @param {string} userReqMute - the username of the user requesting the mute
 * @param {string} message - mute user message
 * @param {string} room - the room the users are in
 * @returns {boolean} - true if the user is now unmuted
 */
async function unmuteUser(userReqMute, message, room) {
  let userNowUnmuted = false;

  // check if admin making request
  const validUnMuteRequest = await checkIfUserAdmin(room, userReqMute);
  if (!validUnMuteRequest) {
    return userNowUnmuted;
  }

  // get all the usernames; we need to check we're attempting to mute a valid user
  const msgTokens = message.split(' ');
  let usernames = await getUsersInRoom(room);
  const providedUsername = msgTokens[1].trim();
  const firstToken = msgTokens[0].trim();

  let isValidUnmute =
    firstToken === '/mute' || usernames.includes(providedUsername);

  // edge case; change usernames to lowercase
  usernames = usernames.map((username) => username.toLowerCase());

  // check one more time, with the usernames in lowercase
  isValidUnmute = usernames.includes(providedUsername);

  if (isValidUnmute) {
    // remove the muted user from the st
    mutedUsers.removeMutedUser(providedUsername, room);
    userNowUnmuted = true;
  }

  return userNowUnmuted;
}

/**
 *
 * @param {*} room - the current room
 * @return - arr of the complete user objects in room, including sids
 */
function getAllUsersInRoom(room) {
  return allUsers.getUsersInRoom(room);
}

/**
 * Send a list of the usernames in the room
 *
 * @param {string} room - the room to send the client list to
 */
function sendUsernamesListForRoom(room) {
  io.to(room).emit('currentRoomUsers', getAllUsersInRoom(room));
}

/**
 * given one of the reserved messages, perform the corresponding action
 * @param {*} messageObj
 * @param {string} room - the room to send the message to
 * @return {string}- the valid tweak message
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
 *
 * @param {*} socket
 * @return  {string} - template literal ip addr
 */
function getIpAddrPortStr(socket) {
  return `${socket.handshake.address}`;
}

/**
 * Add username and room to the socket
 */
io.use((socket, next) => {
  const { username } = socket.handshake.auth;
  const { room } = socket.handshake.auth;
  if (!username || !room) {
    appendToLog('Username or Room missing from socket');
    return next(new Error('Missing Username or Room'));
  }
  // eslint-disable-next-line no-param-reassign
  socket.username = username;
  // eslint-disable-next-line no-param-reassign
  socket.room = room;
  next();
});

// registered event handlers for sockets
io.on('connection', (socket) => {
  const cookies = socket.handshake.headers.cookie;

  appendToLog(
    `Connection event from ${getIpAddrPortStr(socket)} sid: ${socket.id} 
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

    // add user to room on room join event
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
  socket.on('clientChat', async (msgObj, callback) => {
    const filter = new Filter();
    appendToLog(`${JSON.stringify(msgObj)}\n`);

    const { message } = msgObj;

    // determine if the message is inappropriate
    if (filter.isProfane(message)) {
      appendToLog(`Profanity detected: '${message}'`);
      return callback('Watch your language');
    }

    if (mutedUsers.isUserMuted(socket.username.toLowerCase(), socket.room)) {
      // if muted, user is informed of their message
      return callback('Sorry, you are muted');
    }

    // if not, send the message to the user's room
    const socketUser = allUsers.getUser(socket.id);

    // check if the leading character is a backslash
    const tweakMsgObj = determineIfMsgContainsTweak(message);

    let expireMsg = false;

    if (tweakMsgObj.hasTweakMsg) {
      // valid tweaks message changes the message to deliver
      const msgTokenIdx = tweakMsgObj.idx;
      const validTweak = tweaksMessage(
        { message: message.split(' ')[msgTokenIdx] },
        socketUser.room,
      );

      // let's determine if it's an 'expiring' message
      const firstToken = message.split(' ')[0];

      if (firstToken === '/expire' || firstToken === '/explode') {
        expireMsg = true;
      } else if (firstToken === '/mute') {
        // perform the mute operation if valid
        const { room, username } = socket;
        const isMutedNow = await muteUser(username, message, room);

        // mute success
        if (isMutedNow) {
          const mutedUser = message.split(' ')[1].trim();
          msgObj.message = `Admin ${username} has muted ${mutedUser}`;
        }
      } else if (firstToken === '/unmute') {
        const { room, username } = socket;
        const isUnmutedNow = await unmuteUser(username, message, room);

        // valid unmute
        if (isUnmutedNow) {
          const unmutedUser = message.split(' ')[1].trim();
          msgObj.message = `Admin ${username} has unmuted ${unmutedUser}`;
        }
      } else if (validTweak) {
        // eslint-disable-next-line no-param-reassign
        msgObj.message = validTweak;
      }
    }

    // add the user's name to the message object
    // eslint-disable-next-line no-param-reassign
    msgObj.username = socketUser.username;

    // update the db with the message sent
    if (expireMsg) {
      // 45 seconds to start with
      msgObj.expireDuration = 45000;

      // reassign the message to omit the notifier
      msgObj.message = msgObj.message
        .split(' ')
        .slice(1, msgObj.message.length)
        .join(' ');
    } else {
      // do not store expiring messages; they should not be seen after expiration date
      addMessage(socket, msgObj, socketUser.room);
    }

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

  // private chat
  socket.on('private message', ({ content, to }) => {
    socket.to(to).emit('private message', {
      content,
      from: socket.id,
      fromName: socket.username,
    });
  });

  // fires when an individual socket (client) disconnects
  socket.on('disconnect', () => {
    let room;
    try {
      room = socket.room;
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
      // update clients' UI to reflect disconnect
      sendConnectedClientCount(user.room);
      sendUsernamesListForRoom(user.room);
    }
  });
}); // end socket io block

// start server
server.listen(port, () => appendToLog(`Server running on port ${port}\n`));
