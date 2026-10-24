/**
 * Database Connection & Lifecycle Management
 */

const mongoose = require('mongoose');
const config = require('./env');

let isConnected = false;

async function connectDatabase(uri = config.mongoUri) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });
    isConnected = true;
    console.log(`[DB] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB runtime error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected. Attempting reconnect...');
      isConnected = false;
    });

    return conn.connection;
  } catch (error) {
    console.error('[DB] MongoDB initial connection failed:', error.message);
    throw error;
  }
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[DB] Disconnected from MongoDB');
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getConnection: () => mongoose.connection,
  isConnected: () => mongoose.connection.readyState === 1
};
