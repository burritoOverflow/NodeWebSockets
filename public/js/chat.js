const socket = io();

const msgInput = document.getElementById("message-text");
const msgBtn = document.getElementById("submit-button");
const receivedMsg = document.getElementById("received-message");

msgBtn.addEventListener("click", () => {
  // make sure a message is present
  const msgStr = msgInput.value.trim();
  if (msgStr == "") {
    return;
  } else {
    sendMessage(msgStr);
  }
});

// receive the client count when the server updates
socket.on("clientCount", (msg) => {
  receivedMsg.innerText = msg;
});

function sendMessage(message) {
  socket.emit("clientChat", message);
  // remove text from the element
  msgInput.value = "";
}
