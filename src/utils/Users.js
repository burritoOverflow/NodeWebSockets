class Users {
  users;

  constructor() {
    this.users = [];
  }

  /**
   *
   * @param {Object.<number, string, string>} userObj - contains the socketio id, the
   * user's display name, and the room the user is associated with. All usernames are
   * case sensitive
   * @returns the created new user object, or an object containing an error
   */
  addUser({ id, username, room }) {
    // tidy up the username, replace query string + w/ underscores
    username = username.trim().toLowerCase().replace("+", "_");
    room = room.trim().toLowerCase();

    // validate the attempted user data
    if (!username || !room) {
      return {
        error: "Username and room are required.",
      };
    }

    // determine if there is an existing user (same username and same room)
    let userExists = false;
    this.users.forEach((user) => {
      if (user.room === room && user.username === username) {
        userExists = true;
      }
    });

    // validate username
    if (userExists) {
      return {
        error: `Username ${username} is in use in ${room}`,
      };
    }

    // Store the valid user
    const user = { id, username, room };
    this.users.push(user);

    return user;
  } // end addUser

  /**
   * Remoive the user with the provided id
   * @param {number} id
   */
  removeUserById(id) {
    const idxOfUser = this.users.findIndex((user) => user.id === id);

    // user not found
    if (idxOfUser !== -1) {
      // remove and return the single user object
      return this.users.splice(idxOfUser, 1)[0];
    }
  }

  /**
   * returns the user with the provided id or undefined, if the user does't exist
   * @param {number} userObj - the user's id
   */
  getUser(id) {
    let userToFind = undefined;
    this.users.forEach((user) => {
      if (user.id === id) {
        userToFind = user;
      }
    });
    return userToFind;
  }

  /**
   * Given the name of a room, return the room's users, or an empty array (if no users are in the room)
   * @param {string} room
   */
  getUsersInRoom(room) {
    const usersInRoom = [];
    this.users.forEach((user) => {
      if (user.room === room) {
        usersInRoom.push(user);
      }
    });
    return usersInRoom;
  }

  /**
   * Create and return an object that contains each currently active room and
   * the number of participants in the room
   */
  getAllOccupiedRoomsAndCount() {
    const roomsObj = {};
    if (this.users.length > 0) {
      this.users.forEach((user) => {
        const roomName = user.room;
        if (!roomsObj[roomName]) {
          roomsObj[roomName] = 1;
        } else {
          roomsObj[roomName]++;
        }
      });
    }
    return roomsObj;
  }
}

module.exports = {
  Users,
};
