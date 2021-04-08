/* eslint-disable no-underscore-dangle */
class PrivateMessageMap {
  constructor() {
    // store the Pms with key as user corresponsing to the
    // conversation and the value as an array containing each PM
    this._pmMap = new Map();
  }

  /**
   * Store a message in the map
   *
   * @param {string} username - the user associated with the private message
   * @param {*} privateMessage - the message contents
   */
  addPM(username, privateMessage) {
    // set if exists, otherwise create new array and add the message
    // used on initial addition
    this._pmMap.set(
      username,
      (this._pmMap.get(username) || []).concat(privateMessage),
    );
  }

  /**
   * Get the messages exchanged with the user
   *
   * @param {string} username - the username to get the messages with
   * @returns - arr of messages exchanged with the user
   */
  getPMsWithUser(username) {
    return this._pmMap.get(username);
  }

  toJSON() {
    const retObj = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const [username, pmArray] of this._pmMap.entries()) {
      const tempArr = [];
      pmArray.forEach((privMsg) => {
        tempArr.push(privMsg.toJSON());
      });
      retObj[username] = tempArr;
    }
    return retObj;
  }

  /**
   * Set localstorage for the PMs
   *
   * @param {string} lsKeyname the name used to store in private messages
   */
  setLocalStorage(lsKeyname) {
    // convert the internal map to JSON first
    const jsonMap = Object.fromEntries(this._pmMap);

    // now stringify this to store in localstorage
    const mapStr = JSON.stringify(jsonMap);

    // set the serialized data in localstorage
    localStorage.setItem(lsKeyname, mapStr);
  }

  /**
   *Parse localstorage contents into the pm map, when applicable
   *
   * @param {string} lsKeyname - the name for localstorage
   * @returns boolean indicating success in parsing the contents
   */
  parseFromlocalStorage(lsKeyname) {
    const lsPMs = localStorage.getItem(lsKeyname);
    if (!lsPMs) {
      return false;
    }

    // otherwise, parse the contents and store as the map
    const jsonPMs = JSON.parse(lsPMs);
    this._pmMap = new Map(Object.entries(jsonPMs));
    return true;
  }
}

export default PrivateMessageMap;
