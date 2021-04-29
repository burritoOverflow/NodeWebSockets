/* eslint-disable no-console */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */
const { appendToLog } = require('../utils/logging');
const { Message } = require('../models/messages');
const { RedisUtils } = require('./RedisUtils');
const { Room } = require('../models/room');
const { User } = require('../models/user');

/**
 * Add a socket io id to the corresponding user. Used when a user joins a room.
 *
 * @param {*} socket - the socketio socket pertaining to the user that sent the message
 * @param {*} tokenCookieValue - the user's JWT, obtained from the user's cookies
 * @param {*} usernameCookieValue - the username, obtained from the user's cookies
 */
async function addSocketIoIdToUser(
  socket,
  tokenCookieValue,
  usernameCookieValue,
) {
  const user = await User.findOne({
    'tokens.token': tokenCookieValue,
    name: usernameCookieValue,
  });

  if (!user) {
    appendToLog(
      `addSocketIoIdToUser: User not found with token ${tokenCookieValue} and username ${usernameCookieValue}\n`,
    );
  }

  const { socketIOIDs } = user;
  if (socketIOIDs.includes(socket.id)) {
    appendToLog(
      `addSocketIoIdToUser: duplicate sid ${socket.id} provided for user ${user._id}\n`,
    );
  }

  // add the latest sid
  socketIOIDs.push({ sid: socket.id });
  const savedUser = await user.save();

  if (savedUser === user) {
    appendToLog(
      `addSocketIoIdToUser: User ${savedUser._id} with sid ${socket.id} added and saved\n`,
    );
    return true;
  }
  return false;
}

/**
 * Used on disconnect--remove the socket id from the corresponding user, as the sid is ephemeral
 *
 * @param {*} socket - the socket corresponding to the sender
 * @param {*} tokenCookieValue - JWT from the user's cookie
 * @param {*} usernameCookieValue - username from the user's cookie
 */
async function removeSocketIoIdFromUser(
  socket,
  tokenCookieValue,
  usernameCookieValue,
) {
  // remove the disconnected socket's id from
  // the user's document
  const user = await User.findOne({
    'tokens.token': tokenCookieValue,
    name: usernameCookieValue,
  });

  if (!user) {
    appendToLog(
      `removeSocketIoIdFromUser:  User not found with token ${tokenCookieValue} and username ${usernameCookieValue}`,
    );
    return false;
  }

  // remove the existing socket from the user's sids
  const { socketIOIDs } = user;
  const filteredSIDs = socketIOIDs.filter(
    (_socket) => _socket.sid !== socket.id,
  );
  user.socketIOIDs = filteredSIDs;
  const savedUser = await user.save();

  if (savedUser === user) {
    appendToLog(
      `removeSocketIoIdFromUser: Disconnect: Updated sid ${socket.id} removed from User ${savedUser._id}\n`,
    );
    return true;
  }
  return false;
}

/**
 * Add a message to the db with the user's id (sender)
 *
 * @param {*} socket - the socket pertaining the messages' sender
 * @param {*} msgObj - the message object (contains the date and message string)
 * @param {string} roomName - the name of the room the message was sent to
 */
async function addMessage(socket, msgObj, roomName) {
  const { message } = msgObj;
  // get the user that sent the message
  const _user = await User.findOne({
    // find the user by the sender's socketio id
    'socketIOIDs.sid': socket.id,
  });

  if (!_user) {
    appendToLog(`addMessage: User not found for sid ${socket.id}\n`);
  }

  // room names must be globally unique, so get the room's ID from the room name
  const room = await Room.findOne({ name: roomName });

  if (!room) {
    // room not found for the name provided
    appendToLog(`addMessage: Room not found for room name: ${roomName}`);
  }

  // with the user retrieved update the message with the user's
  // id
  const _message = new Message({
    contents: message,
    sender: _user._id,
    date: new Date(msgObj.msgSendDate),
    room: room._id,
  });

  const savedMessage = await _message.save();
  appendToLog(
    `Message ${savedMessage._id} '${savedMessage.contents} in room ${room._id}' Saved\n\n`,
  );
}

/**
 * Append the user's id to the room's users
 *
 * @param {*} sid - the socketio id
 * @param {*} roomName - the name of the room
 * @returns - boolean indicating success
 */
async function addUserToRoom(sid, roomName) {
  const room = await Room.findOne({ name: roomName });

  // get the id of the user that corresponds to the provided socketio id
  const user = await User.findOne({
    'socketIOIDs.sid': sid,
  });

  if (!user) {
    appendToLog(`addUserToRoom: User not found with sid ${sid}\n\n`);
    return false;
  }

  if (!room) {
    appendToLog(`addUserToRoom: room with name ${roomName} not found\n`);
    return false;
  }

  // in the event a disconnect wasn't recorded properly, the user may already
  // be associated with the room
  let exit = false;
  room.users.forEach((userDocument) => {
    if (userDocument._id === user._id) {
      console.log(userDocument._id, user._id);
      exit = true;
    }
  });
  if (exit) {
    // already in room
    return false;
  }

  // append the user's id to the room's users
  room.users.push(user._id);
  await room.save();
  appendToLog(
    `addUserToRoom: Added sid ${sid} to user with id ${user._id} to room ${room._id}\n`,
  );
  return true;
}

/**
 * Remove the user from the room when the socket is disconnected
 *
 * @param {*} sid - the socketio id corresponding to the user that is leaving
 * @param {*} roomName - the name of the room
 */
async function removeUserFromRoom(sid, roomName) {
  // find the corresponding user and room
  const user = await User.findOne({
    'socketIOIDs.sid': sid,
  });

  if (!user) {
    appendToLog(`removeUserFromRoom: user with sid ${sid} not found\n`);
    return false;
  }

  const room = await Room.findOne({ name: roomName });

  if (!room) {
    appendToLog(`removeUserFromRoom: room with name ${roomName} not found\n`);
    return false;
  }

  const { users } = room;

  // find the user with the corresponding user id
  const filteredUsers = users.filter((u) => !u._id.equals(user._id));

  room.users = filteredUsers;
  await room.save();

  if (filteredUsers.length === room.users.length - 1) {
    appendToLog(
      `removeUserFromRoom: User with id ${user._id} and sid ${sid} removed from room ${roomName} ${room.users.length} users remaining\n`,
    );
    return true;
  }
  appendToLog(
    `removeUserFromRoom: User with id ${user._id} and sid ${sid} removal failed from room ${roomName} ${room.users.length} users remaining\n`,
  );
  return false;
}

/**
 * Used to remove the socketio id from a user when the user disconnects
 *
 * @param {*} socket - the socket pertaining the messages' sender
 * @param {*} tokenCookieValue - the user's JWT, obtained from the user's cookies
 * @param {*} usernameCookieValue - the username, obtained from the user's cookies
 * @param {*} room - the room name
 */
async function removeUserOnDisconnect(
  socket,
  tokenCookieValue,
  usernameCookieValue,
  room,
) {
  const userRemoveRoomSuccess = await removeUserFromRoom(socket.id, room);
  const removeSidUserSuccess = await removeSocketIoIdFromUser(
    socket,
    tokenCookieValue,
    usernameCookieValue,
  );
  if (userRemoveRoomSuccess && removeSidUserSuccess) {
    appendToLog('removeUserOnDisconnect: removed successfully\n');
  }
}

async function addSIDToUserAndJoinRoom(
  socket,
  tokenCookieValue,
  usernameCookieValue,
  room,
) {
  const addSIDUserSuccess = await addSocketIoIdToUser(
    socket,
    tokenCookieValue,
    usernameCookieValue,
  );
  const addUserRoomSuccess = await addUserToRoom(socket.id, room);
  if (addSIDUserSuccess && addUserRoomSuccess) {
    appendToLog('addSIDToUserAndJoinRoom: sid and user added to room\n');
  }
}

/**
 *Increment the count in the room
 *
 * @param {string} roomName  - the name of the room to decrement the counter for
 */
function incrementRoomCounter(roomName) {
  const redisCache = new RedisUtils(
    process.env.REDIS_HOSTNAME,
    process.env.REDIS_PORT,
    process.env.REDIS_PASSWORD,
  );
  redisCache.connectToRedis();

  redisCache.client.incr(roomName, (err, counter) => {
    if (err) {
      return err;
    }
    redisCache.closeAndCleanUp();
    console.log(`Increment ${counter}`);
    return counter;
  });
}

/**
 *Decrement the counter for the provided room
 *
 * @param {string} roomName  - the name of the room to decrement the counter for
 */
function decrementRoomCounter(roomName) {
  const redisCache = new RedisUtils(
    process.env.REDIS_HOSTNAME,
    process.env.REDIS_PORT,
    process.env.REDIS_PASSWORD,
  );
  redisCache.connectToRedis();

  redisCache.client.decr(roomName, (err, counter) => {
    if (err) return err;

    redisCache.closeAndCleanUp();
    console.log(`Decrement ${counter}`);
    return counter;
  });
}

module.exports = {
  addMessage,
  addSIDToUserAndJoinRoom,
  addSocketIoIdToUser,
  addUserToRoom,
  decrementRoomCounter,
  incrementRoomCounter,
  removeSocketIoIdFromUser,
  removeUserFromRoom,
  removeUserOnDisconnect,
};
