const redis = require('redis');

class RedisUtils {
  constructor(host, port, password) {
    this.host = host;
    this.port = port;
    this.password = password;
    // client is set on invoking the connect function
    this.client = null;
  }

  /**
   * Connect to redis
   */
  connectToRedis() {
    this.client = redis.createClient({
      host: this.host,
      port: this.port,
      password: this.password,
    });

    this.client.on('error', (err) => {
      console.log(`Error ${err}`);
    });

    this.client.on('connect', () => {
      console.log('Connected');
    });
  }

  subscribeForUpdates() {
    this.client.subscribe('updates');
  }

  /**
   * Publish the latest update.
   */
  setUpdate(updateString) {
    this.client.publish('updates', updateString);
  }

  /**
   * Set the key to the value
   *
   * @param {string} key
   * @param {string} value
   * @returns - reply from the redis client
   */
  setValue(key, value) {
    return this.client.set(key, value, (err, reply) => {
      if (err) return err;
      return reply.toString();
    });
  }

  /**
   * Return the value from the key
   *
   * @param {string} key - get the value from this key
   */
  getValue(key) {
    this.client.get(key, (err, reply) => {
      if (err) return err;
      return reply.toString();
    });
  }

  /**
   * Tidy up when exiting.
   */
  closeAndCleanUp() {
    this.client.unsubscribe();
    this.client.quit();
    console.log('Redis client exiting');
  }
}

module.exports = { RedisUtils };
