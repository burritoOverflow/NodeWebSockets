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
 *  Send the user selected file to the API
 *
 * @param {*} file the file the user is uploading
 */
function uploadFile(file) {
  const data = new FormData();
  data.append('upload', file);

  fetch('/api/messages/file', {
    method: 'POST',
    body: data,
  })
    .then((response) => response.json()) // response is JSON, so convert
    .then(
      (resJSON) => {
        const userMessage = `shared ${resJSON.originalName} : ${resJSON.url}`;
        sendMessage(userMessage);
        // clear the selection from the input
        fileInput.value = '';
      }, // Handle the success response object
    )
    .catch(
      (error) => console.log(error), // Handle the error response object
    );
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

export {
  parseQSParams,
  isValidHttpUrl,
  isElementHoveredOrFocused,
  uploadFile,
  displayNotification,
};
