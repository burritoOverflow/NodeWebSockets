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
   * Publish the latest update
   */
  setUpdate(updateString) {
    this.client.publish('updates', updateString);
  }

  /**
   * Tidy up when exiting
   */
  closeAndCleanUp() {
    this.client.unsubscribe();
    this.client.quit();
    console.log('Redis client exiting');
  }
}

module.exports = { RedisUtils };
