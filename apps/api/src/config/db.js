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

  // Check if database is disabled or using placeholder Atlas URI
  const isDummyUri = !uri || uri.includes('cluster0.mongodb.net') || uri.includes('TODO');
  if (process.env.DISABLE_DB === 'true' || process.env.NO_DB === 'true' || isDummyUri) {
    console.log('[DB] Operating in Autonomous In-Memory Demo Mode (No external MongoDB required)');
    isConnected = false;
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 0,
      autoIndex: true
    });
    isConnected = true;
    console.log(`[DB] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB runtime error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected. Falling back to in-memory mode.');
      isConnected = false;
    });

    return conn.connection;
  } catch (error) {
    console.warn('[DB] MongoDB initial connection not available:', error.message);
    console.log('[DB] Running seamlessly in Autonomous In-Memory Demo Mode.');
    isConnected = false;
    return mongoose.connection;
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
  isConnected: () => isConnected && mongoose.connection.readyState === 1
};
