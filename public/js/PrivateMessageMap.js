/* eslint-disable no-underscore-dangle */
class PrivateMessageMap {
  constructor() {
    // store the Pms with key as user corresponsing to the
    // conversation and the value as an array containing each PM
    this._pmMap = new Map();
  }

  addPM(username, privateMessage) {
    this._pmMap.set(
      username,
      (this._pmMap.get(username) || []).concat(privateMessage),
    );
  }

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
}

export default PrivateMessageMap;
