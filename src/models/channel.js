const mongoose = require('mongoose');

// Schema for the channels. Name, the ID of the admin, and the IDs of all posts in the channel.
const ChannelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      minLength: 5,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectID,
      ref: 'User',
    },
    posts: [
      {
        type: mongoose.Schema.Types.ObjectID,
        ref: 'Posts',
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Channel = mongoose.model('Channel', ChannelSchema);

module.exports = {
  Channel,
};
