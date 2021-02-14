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

/**
 * Get all room names
 */
const getAllRoomNames = async () => {
  const rooms = await Room.find({});
  return rooms;
};

/**
 * Get the number of users in the provided room (if the room exists)
 * @param {string} roomName
 * @returns - num users currently in the room
 */
const getCountOfUsersinRoom = async (roomName) => {
  const room = await findRoomByName(roomName);
  if (room) {
    return room.users.length;
  }
  throw new Error('Invalid room name provided');
};

module.exports = {
  findRoomByName,
  getAllRoomNames,
  getCountOfUsersinRoom,
};
