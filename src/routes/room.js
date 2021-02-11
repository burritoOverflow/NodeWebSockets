const express = require('express');
const { Room } = require('../models/room');
const verifyUserJWT = require('../utils/verifyJWT');
const { findRoomByName, getAllRoomNames } = require('../db/queryDb');

const router = express.Router();

// Used for room creation only.
// Do this defensively and check that the room that's
// being created doesn't already exist
router.post('/room', async (req, res) => {
  // determine if the user is validated, as only users
  // can create rooms
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj) {
      // token invalid
      res.status(401).send({ error: 'Unauthorized' });
    }
    // valid, so check if the room exists
    const existingRoom = await findRoomByName(req.body.name);
    // abandon if room exists
    if (existingRoom) {
      res.status(401).send({
        error: `Cannot create. Room ${req.body.name} Exists`,
      });
    }

    // otherwise create
    const room = new Room(req.body);
    await room.save();
    res.status(201).send({
      result: `${req.body.name} created`,
    });
  } else {
    // no token provided
    res.status(401).send({ error: 'Unauthorized' });
  }
});

// accessible globally
router.get('/room', async (req, res) => {
  const rooms = await getAllRoomNames();
  res.send(rooms);
});

module.exports = router;
