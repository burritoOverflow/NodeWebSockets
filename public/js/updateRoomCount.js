/* eslint-disable no-console */
/**
 * Fetch data from the 'rooms' route and
 * display it on the main page: {count} in {room}
 */

let roomNameInput;
let submitRoomName;
let createRoomButton;

/**
 * Populate the select element with options for each room name
 *
 * @param {*} roomNamesArr - array of room names
 */
function addOptionsToRoomSelect(roomNamesArr) {
  const roomSelect = document.getElementById('room-select');
  roomNamesArr.forEach((roomName) => {
    // create an option
    const option = document.createElement('option');
    option.value = roomName;
    option.innerText = roomName;
    roomSelect.appendChild(option);
  });
}

/**
 * Get the list of the currently created rooms
 */
function fetchRoomList() {
  fetch('/api/room')
    .then((response) => {
      if (!response.ok) {
        throw Error(response.statusText);
      }
      // Read the response as json.
      return response.json();
    })
    .then((jsonResp) => {
      // empty object (no rooms occupied), nothing to do
      if (
        Object.keys(jsonResp).length === 0 &&
        jsonResp.constructor === Object
      ) {
        return;
      }

      const roomCountDiv = document.getElementById('room-count');
      roomCountDiv.innerText = 'Room Status:';

      const roomNamesArr = [];

      // use the api data to display the number of users in each room
      jsonResp.forEach((roomObj) => {
        const p = document.createElement('p');
        const { name, numUsers } = roomObj;
        roomNamesArr.push(name);

        p.innerText = `${numUsers} users in ${name}`;
        p.classList.add('room-counter');
        // set the data attr to the room name; we'll use this for a convienience feat
        p.dataset.roomname = name;

        p.onclick = () => {
          // we'll populate the option value on click on each of these
          document.getElementById('room-select').value = p.dataset.roomname;
        };

        // and add each element
        roomCountDiv.appendChild(p);
      });

      // we just need the room names to display
      addOptionsToRoomSelect(roomNamesArr);
    })
    .catch((error) => {
      console.error('Error fetching data', error);
    });
}

/**
 * POST the created room name, creating a new room
 *
 * @param {string} roomName  - the name of the room to create, populated by the input element
 */
async function addNewRoom(roomName) {
  const roomObj = { name: roomName };

  const roomRes = await fetch('/api/room', {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(roomObj),
  });

  // check response
  return roomRes.json();
}

window.onload = async function initRooms() {
  const usernameinput = document.getElementById('username-input');
  usernameinput.style.color = 'black';
  usernameinput.style.fontWeight = 'bold';
  usernameinput.style.textAlign = 'center';
  const cookieArr = document.cookie.split('=');
  const displayname = cookieArr[cookieArr.indexOf('displayname') + 1];
  if (displayname) {
    usernameinput.value = displayname;
  } else {
    usernameinput.getElementById('username-input').removeAttribute('readonly');
  }

  // set user selected accent style if present
  const colorChoice = localStorage.getItem('colorChoice');
  if (colorChoice) {
    document.documentElement.style.setProperty('--primaryColor', colorChoice);
  }

  roomNameInput = document.getElementById('room-name-input');
  submitRoomName = document.getElementById('submit-room-name');
  createRoomButton = document.getElementById('create-room-button');

  createRoomButton.onclick = (event) => {
    event.preventDefault();
    document.getElementById('create-room-div').classList.toggle('hidden');
  };

  submitRoomName.onclick = async () => {
    // check that the input is populated with only a single token
    const inputString = roomNameInput.value.trim().toLowerCase();

    if (!inputString || inputString === '') {
      return;
    }
    if (inputString.split(' ') > 1) {
      // error; several tokens
      return;
    }
    // otherwise, POST the data that's been submitted; all roomnames are lowercase only
    const newRoomResponse = await addNewRoom(inputString);

    // handle response
    if (newRoomResponse.result) {
      // room created; display a message; fetch new data
      roomNameInput.value = '';

      // update the rooms to reflect the latest addition
      fetchRoomList();
    }
  };

  fetchRoomList();
};
