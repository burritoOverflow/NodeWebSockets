const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
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
      type: mongoose.Schema.Types.ObjectID,
      required: true,
      ref: 'User',
    },
    channel: {
      // store the ObjectID for the room the message was sent to
      type: mongoose.Schema.Types.ObjectID,
      required: true,
      ref: 'Channel',
    },
  },
  {
    timestamps: true,
  },
);

const Post = mongoose.model('Post', PostSchema);

module.exports = {
  Post,
};
