const mongoose = require('mongoose');

// get the connection string for mdb from the config file
require('dotenv').config();

const mongoURL = process.env.MLAB_URL;

// set the original connection to MDB during application start
mongoose
  .connect(
    mongoURL,
    {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    },
    console.log(`Connected to MongoDB ${new Date()}`),
  )
  .catch((error) => console.error(error));
