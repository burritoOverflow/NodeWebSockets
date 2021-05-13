const mongoose = require('mongoose');

// The Message schema is the message contents, the date the message was sent, the ID
// of the sender, and the ID of the room the message was sent in
const MessageSchema = new mongoose.Schema(
  {
    contents: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    sender: {
      // store the sending user's ID
      type: mongoose.Schema.Types.ObjectID,
      required: true,
      ref: 'User',
    },
    room: {
      // store the ObjectID for the room the message was sent to
      type: mongoose.Schema.Types.ObjectID,
      required: true,
      ref: 'Room',
    },
  },
  {
    timestamps: true,
  },
);

const Message = mongoose.model('Message', MessageSchema);

module.exports = {
  Message,
};
