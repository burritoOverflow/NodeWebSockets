const { Room } = require('../models/room');

/**
 * Check if there exists a room by this name
 * @param {*} roomName - the name of the room to find
 * @returns
 */
const findRoomByName = async (roomName) => {
  const room = await Room.findOne({
    name: roomName,
  });
  return room;
};

module.exports = {
  findRoomByName,
};
