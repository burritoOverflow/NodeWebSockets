const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
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
});

const Room = mongoose.model('Room', RoomSchema);

module.exports = {
  Room,
};
