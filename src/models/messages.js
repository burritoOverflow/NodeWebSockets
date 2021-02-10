const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
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
});

const Message = mongoose.model('Message', MessageSchema);

module.exports = {
  Message,
};
