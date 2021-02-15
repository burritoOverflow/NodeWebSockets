// quick simple middleware for determining if the server is under maintenance, useful little feature
const maintenanceCheck = (req, res, next) => {
  // maintenance mode
  if (process.env.NODE_ENV === 'maintenance') {
    res.status(503).send('Under maintenance');
  } else {
    next();
  }
};

module.exports = maintenanceCheck;
