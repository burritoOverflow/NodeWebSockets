const express = require('express');
const { Message } = require('../models/messages');
const { User } = require('../models/user');
const verifyUserJWT = require('../utils/verifyJWT');
const { findRoomByName } = require('../db/queryDb');

const router = express.Router();

// return most recent 10 messages from the room provided
router.get('/messages/:room', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj) {
      // invalid token
      res.status(401).send({ error: 'Unauthorized' });
    }
    // get the id for the room provided
    const roomName = req.params.room;
    const room = await findRoomByName(roomName);

    // eslint-disable-next-line no-underscore-dangle
    const messagesFromRoom = await Message.find({ room: room._id })
      .sort({ date: 1 }) // oldest first
      .limit(10);

    // simplify the contents; don't need the message's id
    const msgArr = messagesFromRoom.map((msg) => ({
      contents: msg.contents,
      date: msg.date,
      sender: msg.sender,
    }));

    // collect just the userIDs
    const userIDArr = [];
    room.users.forEach((user) => {
      // make sure no duplicates exist
      // eslint-disable-next-line no-underscore-dangle
      userIDArr.push(user._id);
    });

    const userList = await User.find().in('_id', userIDArr);

    // given the result of the query, convert the IDs in the message array into usernames
    const userIDSenderObj = userList.map((u) => ({
      // eslint-disable-next-line no-underscore-dangle
      _id: u._id,
      name: u.name,
    }));

    const retList = [];

    // now convert the sender (User's ID) to the user's name
    msgArr.forEach((msgObj) => {
      userIDSenderObj.forEach((senderObj) => {
        // eslint-disable-next-line no-underscore-dangle
        if (msgObj.sender.equals(senderObj._id)) {
          const msg = {
            contents: msgObj.contents,
            date: msgObj.date,
            sender: senderObj.name,
          };
          retList.push(msg);
        }
      });
    });

    return res.status(200).send(retList);
  }
  // no token provided
  res.status(401).send({ error: 'Unauthorized' });
  // need the user names from the users that sent the messages
});

module.exports = router;
