/**
 * Parse the query string parameters for the room and the user name
 * Return an object containing those
 * @return {Object} - object containing username and room
 */
function parseQSParams() {
  const queryStr = window.location.search;
  const qsParameters = queryStr.split('&');
  return {
    username: qsParameters[0].split('=')[1],
    room: qsParameters[1].split('=')[1],
  };
}

/**
 * determine if valid http(s) url
 *
 * @param {*} string
 * @return {boolean} - true if the string provided is a valid url
 */
function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

/**
 *
 * @param {*} element - html element
 * @return - true if the element is either hover or focused
 */
function isElementHoveredOrFocused(element) {
  const isHover = element.parentElement.querySelector(':hover') === element;
  const isFocus = element.parentElement.querySelector(':focus') === element;
  return isHover || isFocus;
}

/**
 * @param {*} message - the message to show in the notification
 */
function displayNotification(message) {
  if (!('Notification' in window)) {
    // we'll just fail gracefully
    return;
  }

  if (Notification.permission === 'granted') {
    const notification = new Notification(message);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        const notification = new Notification(message);
      }
    });
  }
}

/**
 * Determine if the provided string argument is an integer
 *
 * @param {*} str - the string argument to determine if integer
 * @returns
 */
function determineIfInteger(str) {
  return (
    !isNaN(str) && parseInt(Number(str)) == str && !isNaN(parseInt(str, 10))
  );
}

/**
 * Determine if the message provided is a string
 *
 * @param {*} msgStr - the string argument
 */
function determineIfDelayedMessage(msgStr) {
  const strTokens = msgStr.split(' ');
  const firstToken = strTokens[0];

  if (firstToken[0] === '/') {
    // determine if prefaced with any of the possible verbs
    const wordSet = new Set();
    wordSet.add('delay');
    wordSet.add('timer');
    wordSet.add('schedule');
    wordSet.add('sleep');

    // remove the leading slash
    const verbToken = firstToken.slice(1);

    if (wordSet.has(verbToken)) {
      // get the second token, determine if valid integer
      const secondToken = strTokens[1];
      const isInt = determineIfInteger(secondToken);

      if (isInt) {
        // it's a valid integer, so we just now need to make sure there's
        // at least a single non empty token that follows
        const thirdToken = strTokens[2];

        if (thirdToken) {
          return true;
        }
        // no third token
        return false;
      }
      // second token is not an integer
      return false;
    } // invalid word after slash
    return false;
  } // no slash in first token
  return false;
}

export {
  determineIfInteger,
  parseQSParams,
  isValidHttpUrl,
  isElementHoveredOrFocused,
  displayNotification,
  determineIfDelayedMessage,
};
