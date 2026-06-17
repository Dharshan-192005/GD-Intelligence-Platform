const mongoose = require('mongoose');

let isInMemoryMode = false;
let lastConnectionError = '';

const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/gd_intelligence_platform';
    console.log(`Connecting to MongoDB at: ${connStr}...`);

    await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 3000
    });

    console.log('MongoDB connected successfully.');
    isInMemoryMode = false;
    lastConnectionError = '';
  } catch (error) {
    console.warn('MongoDB connection failed. Database features will run in in-memory demo mode.');
    console.warn(`Reason: ${error.message}`);
    isInMemoryMode = true;
    lastConnectionError = error.message;
  }
};

const checkInMemoryMode = () => isInMemoryMode;

const getDatabaseStatus = () => ({
  mode: isInMemoryMode ? 'in-memory' : 'mongodb',
  isPersistent: !isInMemoryMode,
  lastConnectionError
});

module.exports = { connectDB, checkInMemoryMode, getDatabaseStatus };
