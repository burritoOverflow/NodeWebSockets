const fs = require('fs');

/**
 * Append a given log message to the log file
 * @param {string} logMsg
 */
function appendToLog(logMsg) {
  const dateStr = new Date().toLocaleString();
  // prepend the current date string
  const outputLogMsg = `${dateStr} ${logMsg}`;

  fs.appendFile('websocket.log', outputLogMsg, (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });
}

module.exports = { appendToLog };
