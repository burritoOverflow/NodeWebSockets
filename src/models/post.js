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
    likes: {
      type: Number,
      default: 0,
    },
    dislikes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// eslint-disable-next-line func-names
PostSchema.methods.toJSON = function () {
  const post = this;
  const postObj = post.toObject();
  // eslint-disable-next-line no-underscore-dangle
  delete postObj.sender;
  delete postObj.channel;
  delete postObj.updatedAt;
  delete postObj.createdAt;
  // eslint-disable-next-line no-underscore-dangle
  delete postObj.__v;
  return postObj;
};

const Post = mongoose.model('Post', PostSchema);

module.exports = {
  Post,
};
