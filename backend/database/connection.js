import mongoose from 'mongoose';
import App from '../models/App.js';
import Event from '../models/Event.js';
import Alert from '../models/Alert.js';
import TrustHistory from '../models/TrustHistory.js';
import Recommendation from '../models/Recommendation.js';
import ActivityHistory from '../models/ActivityHistory.js';

const models = [App, Event, Alert, TrustHistory, Recommendation, ActivityHistory];
let listenersAttached = false;
let disconnectInProgress = false;

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri || !uri.trim()) {
    const error = new Error('MONGODB_URI must be configured before starting the backend');
    error.code = 'MONGODB_URI_REQUIRED';
    throw error;
  }

  if (!listenersAttached) {
    mongoose.connection.on('error', (error) => {
      console.error(`MongoDB connection error: ${error.name}`);
    });
    mongoose.connection.on('disconnected', () => {
      console.error(disconnectInProgress ? 'MongoDB disconnected' : 'MongoDB connection lost');
    });
    listenersAttached = true;
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
  });

  await Promise.all(models.map((model) => model.createIndexes()));
  return mongoose.connection;
}

export async function disconnectDatabase() {
  disconnectInProgress = true;
  try {
    await mongoose.disconnect();
  } finally {
    disconnectInProgress = false;
  }
}

export function databaseHealth() {
  return {
    status: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable',
    connected: mongoose.connection.readyState === 1,
  };
}

export { mongoose };
