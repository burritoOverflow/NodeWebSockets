const socket = io();

const msgInput = document.getElementById("message-text");
const msgBtn = document.getElementById("submit-button");
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

// append individual messages to the list
function addMsgToThread(message) {
  const li = document.createElement("li");
  li.classList.add("message");
  const msgText = `${new Date(message.msgSendDate).toLocaleString()} ${
    message.message
  }`;
  li.innerText = msgText;
  msgThread.appendChild(li);
}

// receive the client count when the server updates
socket.on("clientCount", (message) => {
  clientCountMsg.innerText = message;
});

socket.on("chatMessage", (message) => {
  addMsgToThread(message);
});

// send the message from the input element
function sendMessage(message) {
  const msgObj = { message: message, msgSendDate: +new Date() };
  socket.emit("clientChat", msgObj);
  // remove text from the element
  msgInput.value = "";
}
