const socket = io();

const msgInput = document.getElementById("message-text");
const msgBtn = document.getElementById("submit-button");
const sendLocButton = document.getElementById("share-location-button");
const clientCountMsg = document.getElementById("received-message");
const msgThread = document.getElementById("message-thread");

msgBtn.addEventListener("click", () => {
  // make sure a message is present
  const msgStr = msgInput.value.trim();
  if (msgStr == "") {
    return;
  } else {
    sendMessage(msgStr);
  }
});

sendLocButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    // no geolocation available
    return alert("geolocation is not available");
  }

  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    const latLng = {
      latitude: latitude,
      longitude: longitude,
    };
    socket.emit("userLocation", latLng);
    showUserToast("Location Shared");
  });
});

// allow for enter key in the text input to send a message
msgInput.addEventListener("keypress", (e) => {
  const key = e.key;
  if (key === "Enter") {
    const msgStr = msgInput.value.trim();
    if (msgStr !== "") {
      sendMessage(msgStr);
    }
  }
});

/**
 * append individual messages to the message thread
 * @param {*} message
 */
function addMsgToThread(message) {
  const li = document.createElement("li");
  li.classList.add("message");

  const msgTokens = message.message.split(" ");

  let containsURL = false;
  let urlIdxs = [];

  let anchorElements = [];

  msgTokens.forEach((token, idx) => {
    if (isValidHttpUrl(token)) {
      urlIdxs.push(idx);
      containsURL = true;
    }
  });

  if (containsURL) {
    li.innerText = `${new Date(message.msgSendDate)
      .toLocaleString()
      .replace(",", " at")} `;

    msgTokens.forEach((token, idx) => {
      if (urlIdxs.includes(idx)) {
        const anchorEl = document.createElement("a");
        anchorEl.setAttribute("href", token);
        anchorEl.setAttribute("target", "_blank");
        anchorEl.innerText = token;
        anchorElements.push(anchorEl);

        li.appendChild(anchorEl);
      } else {
        li.innerText += token + " ";
      }
    });
  } else {
    const msgText = `${new Date(message.msgSendDate)
      .toLocaleString()
      .replace(",", " at")} ${message.message}`;
    li.innerText = msgText;
  }

  li.addEventListener("mouseover", (e) => {
    msgThread.style.backgroundColor = "black";
    document.querySelectorAll(".message").forEach((msgEl) => {
      if (msgEl !== li) {
        msgEl.classList.add("blurry-text");
      }
    });
  });

  li.addEventListener("mouseout", (e) => {
    msgThread.style.backgroundColor = "#18181b";
    document.querySelectorAll(".message").forEach((msgEl) => {
      if (msgEl !== li) {
        msgEl.style.opacity = 1.0;
        msgEl.classList.remove("blurry-text");
      }
    });
  });

  msgThread.appendChild(li);
}

/**
 * determine if valid http(s) url
 * @param {*} string
 */
function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * Show the user a toast containing the string argument
 * @param {*} message - the string contents of the toast
 */
function showUserToast(message) {
  const snackbar = document.getElementById("snackbar");
  snackbar.innerText = message;
  snackbar.classList.add("show");
  setTimeout(() => {
    snackbar.classList.remove("show");
  }, 2000);
}

// receive the client count when the server updates
socket.on("clientCount", (message) => {
  clientCountMsg.innerText = message;
});

socket.on("chatMessage", (message) => {
  addMsgToThread(message);
});

socket.on("tweak", (messageObj) => {
  const { type } = messageObj;
  switch (type) {
    case "bright":
      document.body.classList.add("bright");
      document.getElementById("message-thread").classList.add("bright");
      document.getElementById("message-text").classList.add("bright");
      break;
    case "dark":
      document.body.classList.remove("bright");
      document.getElementById("message-thread").classList.remove("bright");
      document.getElementById("message-text").classList.remove("bright");
      break;
    default:
      break;
  }
});

// recvs a broadcast when a connection is detected server-side.
// add this message in a seperate fashion
socket.on("newUserMessage", (message) => {
  showUserToast("A New User Has Joined The Chat");
});

// display the toast when a client leaves
socket.on("userLeft", () => {
  showUserToast("A user has left the chat");
});

/**
 * Emit the message to connected clients
 * @param {*} message - The string contents from the input element
 */
function sendMessage(message) {
  const msgObj = { message: message, msgSendDate: +new Date() };
  socket.emit("clientChat", msgObj);
  // remove text from the element
  msgInput.value = "";
}
