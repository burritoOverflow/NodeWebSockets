class SidMap {
  #sidRoomMap;

  constructor() {
    this.#sidRoomMap = new Map();
  }

  /**
   * Add a kv pair to the map
   * @param {*} sid socketio id
   * @param {*} room - the room name
   */
  addSidRoomMapping(sid, room) {
    this.#sidRoomMap.set(sid, room);
  }

  /**
   * get the room corresponding to the socket io id
   * @param {*} sid socket io id
   */
  getSidRoomMapping(sid) {
    return this.#sidRoomMap.get(sid);
  }
}

module.exports = {
  SidMap,
};
