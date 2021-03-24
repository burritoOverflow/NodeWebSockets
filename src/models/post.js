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

// eslint-disable-next-line func-names
PostSchema.methods.toJSON = function () {
  const post = this;
  const postObj = post.toObject();
  // eslint-disable-next-line no-underscore-dangle
  delete postObj._id;
  delete postObj.sender;
  delete postObj.channel;
  delete postObj.updatedAt;
  delete postObj.createdAt;
  return postObj;
};

const Post = mongoose.model('Post', PostSchema);

module.exports = {
  Post,
};
