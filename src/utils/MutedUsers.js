class MutedUsers {
  mutedMap;

  constructor() {
    // store each room as key, with a set of users as value (those muted in the room)
    this.mutedMap = new Map();
  }

  /**
   * Mute the user in the room provided. If the room is not in the map,
   * add the room and the user, otherwise simply add the user.
   *
   *
   * @param {string} user - the user to be muted
   * @param {string} room - the room the user is in
   */
  addMutedUser(user, room) {
    if (this.mutedMap.has(room)) {
      this.mutedMap.get(room).add(user);
    } else {
      const s = new Set();
      s.add(user);
      // add room as key and set as value
      this.mutedMap.set(room, s);
    }
  }

  /**
   * Remove the muted user, if possible.
   *
   * @param {string} user - the user to be muted
   * @param {string} room - the room the user is in
   * @returns {boolean} - indicating success in removing the user from muted
   */
  removeMutedUser(user, room) {
    let success = false;

    if (this.mutedMap.has(room)) {
      // attempt to delete user from the set
      success = this.mutedMap.get(room).delete(user);
    }
    return success;
  }

  /**
   * Check if the user provided is muted; return true if muted.
   *
   * @param {string} user - determine if the user is muted
   * @param {string} room - the room to check
   * @returns {boolean} - true if muted
   */
  isUserMuted(user, room) {
    let isMuted = false;

    if (!this.mutedMap.has(room)) {
      // room not found, so user is not muted
      return isMuted;
    } else {
      // room found so check if the user is listed.
      if (this.mutedMap.get(room).has(user)) {
        // user in the set
        isMuted = true;
      } else {
        // not in the set
        isMuted = false;
      }
    }

    return isMuted;
  }
}

module.exports = {
  MutedUsers,
};
