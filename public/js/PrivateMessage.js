/* eslint-disable no-underscore-dangle */
class PrivateMessage {
  constructor(to, date, contents) {
    this._to = to;
    this._date = date;
    this._contents = contents;
  }

  get to() {
    return this._to;
  }

  set to(to) {
    this._to = to;
  }

  get date() {
    return this._date;
  }

  set date(date) {
    this._date = date;
  }

  get contents() {
    return this._contents;
  }

  set contents(contents) {
    this._contents = contents;
  }

  toJSON() {
    const { to, date, contents } = this;
    return { to, date, contents };
  }
}

export default PrivateMessage;
