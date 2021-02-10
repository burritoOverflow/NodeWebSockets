const mongoose = require('mongoose');

// get the connection string for mdb from the config file
require('dotenv').config();

const mongoURL = process.env.MLAB_URL;

mongoose
  .connect(mongoURL, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
  .catch((error) => console.error(error));
