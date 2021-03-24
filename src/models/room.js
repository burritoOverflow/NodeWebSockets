/* eslint-disable no-underscore-dangle */
const mongoose = require('mongoose');

/**
 * Rooms must be unique, at least three characters, are trimmed
 * and are converted to lowercase.
 * When users are present, their userIDs are stored in the
 * users array.
 *
 * The Admin is the room's creator
 */
const RoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      minLength: 3,
    },
    users: [
      {
        userIDs: {
          type: mongoose.Schema.Types.ObjectID,
          ref: 'User',
        },
      },
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectID,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Expose only the number of users in the room and the name.
 * @returns [{"name":<string>,"numUsers":<number>}]
 */
// eslint-disable-next-line func-names
RoomSchema.methods.toJSON = function () {
  const room = this;
  const roomObj = room.toObject();
  delete roomObj._id;
  roomObj.numUsers = roomObj.users.length;
  delete roomObj.users;
  delete roomObj.__v;
  return roomObj;
};

const Room = mongoose.model('Room', RoomSchema);

module.exports = {
  Room,
};
