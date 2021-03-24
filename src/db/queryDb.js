const { Room } = require('../models/room');
const { User } = require('../models/user');
const { Channel } = require('../models/channel');

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

/**
 * Get a list of users in the provided room
 *
 * @param {*} roomName - the name of the room
 * @returns - a list of usernames in the room
 */
const getUsersInRoom = async (roomName) => {
  const room = await findRoomByName(roomName);
  if (room) {
    // collect the userIDs from the room
    // eslint-disable-next-line no-underscore-dangle
    const userIDs = room.users.map((user) => user._id);

    // get the usernames
    const userList = await User.find().in('_id', userIDs);

    // we just need the names here
    const usernames = userList.map((user) => user.name);
    return usernames;
  }
  throw new Error('Invalid room name provided');
};

/**
 * Check if the provided username is the admin for the room
 *
 * @param {string} roomName
 * @param {string} username
 * @returns
 */
async function checkIfUserAdmin(roomName, username) {
  // need the user's ObjectID to verify if the rooom's admin is that user
  const room = await Room.findOne({ name: roomName });
  if (!room) {
    return false;
  }

  const user = await User.findOne({ name: username });
  if (!user) {
    return false;
  }

  // eslint-disable-next-line no-underscore-dangle
  const userId = user._id;

  // see if the room even has an admin
  if (room.admin) {
    // MDB OIDS must use equals; ops dont work
    if (room.admin.equals(userId)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the admin  for the channel.
 * @param {string} channelName - the name of the channel
 */
async function getAdminForChannel(channelName) {
  const channel = await Channel.find({ name: channelName });
  // channel doesn't exist
  if (!channel) {
    return;
  }

  const adminId = channel.admin;
  const user = await User.findById(adminId);
  if (!user) {
    return;
  }

  return user;
}

module.exports = {
  checkIfUserAdmin,
  findRoomByName,
  getAllRoomNames,
  getCountOfUsersinRoom,
  getUsersInRoom,
  getAdminForChannel,
};
