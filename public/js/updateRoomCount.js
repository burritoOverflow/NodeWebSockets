/* eslint-disable no-console */
/**
 */

let roomNameInput;
let submitRoomName;
let createRoomButton;
let createChannelButton;
let createMode = 'room';

// true when initially set to hidden
let elementsHidden = false;

class RoomChannelCount {
  constructor() {
    this.roomCount = new Array();
    this.channelCount = new Array();
    this.usersChannels = new Array();
  }

  /**
   * Get the list of the currently created rooms
   * and display the contents
   */
  fetchRoomList() {
    const _this = this;

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

        // collect the room names for displaying as the dropdown options
        const roomNamesArr = new Array();

        // set the state to empty when fetching new values
        _this.roomCount = new Array();

        // use the api data to display the number of users in each room
        jsonResp.forEach((roomObj) => {
          _this.roomCount.push(roomObj);

          // create the room elements
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
        _this.addOptionsToRoomSelect();
      })
      .catch((error) => {
        console.error('Error fetching data', error);
      });
  }

  /**
   * Populate the select element with options for each room name
   *
   * @param {*} roomNamesArr - array of room names
   */
  addOptionsToRoomSelect() {
    const roomNamesArr = this.roomCount.map((room) => room.name);
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
   * Fetch list of all channels; set the state to reflect
   * the list of channels
   */
  async fetchChannelList() {
    const chanRes = await fetch('/api/channel');
    const channelList = await chanRes.json();
    this.channelCount = channelList.channels;
    this.updateChannelList();
  }

  /**
   * Update the UI with the list of the channels
   * Each element contains the URL for visiting the channel
   */
  updateChannelList() {
    const channelCountDiv = document.getElementById('channel-count');
    channelCountDiv.innerText = 'View a channel:';
    for (let i = 0; i < this.channelCount.length; i += 1) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      const chanName = this.channelCount[i].name;
      a.href = `/channel?channelname=${chanName}`;
      a.innerText = `Visit ${chanName}`;
      p.appendChild(a);
      p.classList.add('channel-counter');
      p.dataset.channelname = chanName;
      channelCountDiv.appendChild(p);
    }
  }
}

/**
 * POST the created room name, creating a new room
 *
 * @param {string} roomName  - the name of the room to create, populated by the input element
 */
async function addNewRoom(roomName) {
  const roomObj = { name: roomName };
  const roomRoute = '/api/room';
  const roomRes = await fetch(roomRoute, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(roomObj),
  });
  // check response
  return roomRes.json();
}

/**
 * Create a new channel by posting the channel name ot the create channel route
 *
 * @param {string} chanName - the user's channel
 * @returns
 */
async function addNewChannel(chanName) {
  const res = await fetch('/api/channel', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: chanName }),
  });
  return res.json();
}

/**
 * Toggle the elements in the UI to hidden
 */
function toggleElementsHidden() {
  const nameInput = document.getElementById('room-name-input');
  nameInput.placeholder = `Enter ${
    createMode.charAt(0).toUpperCase() + createMode.slice(1)
  } name`;
  document.getElementById('create-room-div').classList.toggle('hidden');
  const roomCount = document.getElementById('room-count');
  const channelCount = document.getElementById('channel-count');
  roomCount.classList.toggle('hidden');
  channelCount.classList.toggle('hidden');
}

/**
 * Get all channels that the user is admin of
 *
 * @param {string} username - the username for the current user
 * @returns - array of strings--channels names
 */
async function getListOfChannelsAdmin(username) {
  const adminapiURL = `/api/channel/getchannels/${username}`;
  const channelList = await fetch(adminapiURL);
  const jsonContents = await channelList.json();
  return jsonContents;
}

window.onload = async function initRooms() {
  // set the application state
  const rcCount = new RoomChannelCount();

  const usernameinput = document.getElementById('username-input');
  usernameinput.style.color = 'black';
  usernameinput.style.fontWeight = 'bold';
  usernameinput.style.textAlign = 'center';
  const cookieArr = document.cookie.split('=');
  const displayname = cookieArr[cookieArr.indexOf('displayname') + 1];

  // set the display name in the input; prevent changes
  if (displayname) {
    usernameinput.value = displayname;
    rcCount.usersChannels = await getListOfChannelsAdmin(displayname);
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
  createChannelButton = document.getElementById('create-channel-button');

  createRoomButton.onclick = (event) => {
    event.preventDefault();
    if (createMode === 'room') {
      toggleElementsHidden();
      elementsHidden = !elementsHidden;
      return;
    }

    createMode = 'room';
    roomNameInput.placeholder = `Enter ${
      createMode.charAt(0).toUpperCase() + createMode.slice(1)
    } name`;

    if (!elementsHidden) {
      toggleElementsHidden();
      elementsHidden = !elementsHidden;
    }

    const titleHeading = document.querySelectorAll('.title-heading')[0];
    // with the create room element shown, make the logo text green
    if (titleHeading.style.color === 'green') {
      titleHeading.style.color = '#9147ff';
    } else {
      titleHeading.style.color = 'green';
    }
  };

  createChannelButton.onclick = (event) => {
    event.preventDefault();
    if (createMode === 'channel') {
      toggleElementsHidden();
      elementsHidden = !elementsHidden;

      return;
    }

    createMode = 'channel';
    roomNameInput.placeholder = `Enter ${
      createMode.charAt(0).toUpperCase() + createMode.slice(1)
    } name`;

    if (!elementsHidden) {
      toggleElementsHidden();
      elementsHidden = !elementsHidden;
    }
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

    if (createMode === 'room') {
      // otherwise, POST the data that's been submitted; all roomnames are lowercase only
      const newRoomResponse = await addNewRoom(inputString);

      // handle response
      if (newRoomResponse.result) {
        // room created; display a message; fetch new data
        roomNameInput.value = '';
        // update the rooms to reflect the latest addition
        rcCount.fetchRoomList();
      }
    }

    if (createMode === 'channel') {
      // create new channel
      const newChannelResJson = await addNewChannel(inputString);
      if (newChannelResJson.result) {
        roomNameInput.value = '';
      }
      console.log(newChannelResJson);

      // get the updated data after creation
      rcCount.fetchChannelList();
    }
  };

  // initial fetch
  rcCount.fetchRoomList();
  rcCount.fetchChannelList();
  console.log(rcCount);

  // set the keypress binding for the secret filtering
  document.addEventListener('keypress', (event) => {
    const keyName = event.key;
    // filter admin for channels
    if (keyName === 'a') {
      // collect all elements for the channels
      const channelElements = document.getElementsByClassName(
        'channel-counter',
      );

      const uChans = new Array(...rcCount.usersChannels.usersChannels);
      for (let i = 0; i < channelElements.length; i++) {
        // hide this element
        if (!uChans.includes(channelElements[i].dataset.channelname)) {
          // if not a user's owned channel, hide the element
          channelElements[i].classList.toggle('no-display');
        } else {
          // elements not to hide--the user's channels
          if (channelElements[i].childNodes[0].innerText.includes('Visit')) {
            // elements are being actively hidden
            channelElements[i].childNodes[0].innerText =
              channelElements[i].dataset.channelname;
          } else {
            channelElements[
              i
            ].childNodes[0].innerText = `Visit ${channelElements[i].dataset.channelname}`;
          }
        }
      }
    }
  });
};
