const express = require('express');
const { Room } = require('../models/room');
const { Message } = require('../models/messages');
const { User } = require('../models/user');
const verifyUserJWT = require('../utils/verifyJWT');

const router = express.Router();

// return most recent messages from the room provided
// either via a qs param, or default 10
router.get('/messages/:room', async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  const skip = req.query.skip ? parseInt(req.query.skip, 10) : 0;

  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj) {
      // invalid token
      res.status(401).send({ error: 'Unauthorized' });
    }
    // get the id for the room provided
    const roomName = req.params.room;
    const room = await Room.findOne({ name: roomName });

    // eslint-disable-next-line no-underscore-dangle
    const messagesFromRoom = await Message.find({ room: room._id })
      .sort({
        date: -1,
      }) // oldest first
      .limit(limit)
      .skip(skip);

    // simplify the contents; don't need the message's id
    // TODO rewrite this so the query returns them in reverse
    const msgArr = messagesFromRoom.reverse().map((msg) => ({
      contents: msg.contents,
      date: msg.date,
      sender: msg.sender,
    }));

    // collect just the userIDs from the messages
    const userIDArr = [];
    msgArr.forEach((msg) => {
      // eslint-disable-next-line no-underscore-dangle
      userIDArr.push(msg.sender);
    });

    // get an array of users with the ids provided
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
          // format the message in the manner that the client code expects
          // this format is the same as the format for messages emitted during
          // a message event from sio
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
