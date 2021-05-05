/* eslint-disable no-underscore-dangle */
const express = require('express');
const { Room } = require('../models/room');
const { User } = require('../models/user');
const verifyUserJWT = require('../utils/verifyJWT');
const { findRoomByName, getAllRoomNames } = require('../db/queryDb');
const { RedisUtils } = require('../db/RedisUtils');

const router = express.Router();

// Used for room creation only.
// Do this defensively and check that the room that's
// being created doesn't already exist
router.post('/room', async (req, res) => {
  // determine if the user is validated, as only users
  // can create rooms
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);

    if (!userObj.name) {
      // token invalid
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // we need the user's id
    const { _id } = await User.findOne({ name: userObj.name });
    // with valid user, add them as the room's admin
    const roomAdmin = _id;
    // construct the new room object
    const newRoomObj = { name: req.body.name, admin: roomAdmin };
    // valid, so check if the room exists
    const existingRoom = await findRoomByName(req.body.name);

    // abandon if room exists
    if (existingRoom) {
      return res.status(400).send({
        error: `Cannot create. Room ${req.body.name} Exists`,
      });
    }

    // otherwise create the new room
    try {
      const room = new Room(newRoomObj);
      await room.save();

      // With the room saved, publish the update to redis
      const pubClient = new RedisUtils(
        process.env.REDIS_HOSTNAME,
        process.env.REDIS_PORT,
        process.env.REDIS_PASSWORD,
      );

      const updateStr = `New Room created: ${req.body.name}`;
      pubClient.connectToRedis();
      pubClient.setUpdate(updateStr);
      pubClient.closeAndCleanUp();
    } catch (error) {
      // validation error
      return res.status(400).send(error);
    }

    return res.status(201).send({
      result: `${req.body.name} created`,
    });
  }
  // no token provided
  return res.status(401).send({ error: 'Unauthorized' });
});

// accessible globally
// return a list of all current room names
router.get('/room', async (req, res) => {
  const rooms = await getAllRoomNames();
  res.set('Cache-Control', 'no-store');
  res.send(rooms);
});

// get usernames of users in the room provided via the parameter
router.get('/room/usernames/:room', async (req, res) => {
  // only validated users can access this route
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);

    // verify the token provided
    if (!userObj.name) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // valid token
    const roomName = req.params.room;
    const room = await Room.findOne({ name: roomName });

    if (!room) {
      // parameter provided for the room is not a valid room name
      return res.status(400).send(`Room ${roomName} not found`);
    }
    // room found
    const userIDArr = [];
    room.users.forEach((user) => {
      // eslint-disable-next-line no-underscore-dangle
      userIDArr.push(user._id);
    });
    const userList = await User.find().in('_id', userIDArr);
    // transform the query result to just return the usernames
    const userNameArr = userList.map((u) => u.name);
    return res.status(200).send({ UserList: userNameArr });
  }
  // no token provided
  return res.status(401).send({ error: 'Unauthorized' });
});

// get the admin for the room (if exists)
router.get('/room/admin/:room', async (req, res) => {
  // request must come from an authenticated user
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);

    // verify the token provided
    if (!userObj.name) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // query for the room passed as a qs parameter
    const roomName = req.params.room;
    const room = await Room.findOne({ name: roomName });

    // invalid room provided
    if (!room) {
      return res.status(404).send({ error: `No room ${roomName} exists` });
    }

    // with a valid room, now we need to check if there's an admin for the room
    if (room.admin) {
      // get the username associated with the room
      const adminUser = await User.findById(room.admin);

      // return the admin user's name
      return res.status(200).send({
        admin: adminUser.name,
      });
    }
    // no admin for the room
    return res.status(404).send({ admin: 'none' });
  }
});

module.exports = router;
