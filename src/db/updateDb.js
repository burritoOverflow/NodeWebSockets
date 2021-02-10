/* eslint-disable no-console */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */

const { User } = require('../models/user');
const { Message } = require('../models/messages');
const { appendToLog } = require('../utils/logging');

/**
 * Add a socket io id to the corresponding user
 * @param {*} socket - the socketio socket pertaining to the user that sent the message
 * @param {*} tokenCookieValue - the user's JWT, obtained from the user's cookies
 * @param {*} usernameCookieValue - the username, obtained from the user's cookies
 */
function addSocketIoIdToUser(socket, tokenCookieValue, usernameCookieValue) {
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
          appendToLog(
            `Connect: User ${savedUser._id} with sid ${socket.id} added and saved\n`,
          );
        }
      });
    },
  );
}

/**
 * Used on disconnect--remove the socket id from the corresponding user, as the sid is ephemeral
 * @param {*} socket - the socket corresponding to the sender
 * @param {*} tokenCookieValue - JWT from the user's cookie
 * @param {*} usernameCookieValue - username from the user's cookie
 */
function removeSocketIoIdFromUser(
  socket,
  tokenCookieValue,
  usernameCookieValue,
) {
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
          appendToLog(
            `Disconnect: Updated sid ${socket.id} removed from User ${savedUser._id}\n`,
          );
        }
      });
    },
  );
}

/**
 * Add a message to the db with the user's id (sender)
 * @param {*} socket - the socket pertaining the messages' sender
 * @param {*} msgObj - the message object (contains the date and message string)
 */
function addMessage(socket, msgObj) {
  const { message } = msgObj;
  // get the user that sent the message
  User.findOne(
    {
      // find the user by the sender's socketio id
      'socketIOIDs.sid': socket.id,
    },
    (err, _user) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return;
      }
      // with the user retrieved update the message with the user's
      // id
      const _message = new Message({
        contents: message,
        sender: _user._id,
        date: new Date(msgObj.msgSendDate),
      });
      _message.save().then((savedMessage) => {
        if (savedMessage === _message) {
          appendToLog(`Message ${savedMessage._id} Saved\n`);
        }
      });
    },
  );
}

module.exports = {
  addSocketIoIdToUser,
  addMessage,
  removeSocketIoIdFromUser,
};
