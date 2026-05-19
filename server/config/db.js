const mongoose = require('mongoose');

let isInMemoryMode = false;

const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/gd_intelligence_platform';
    console.log(`Connecting to MongoDB at: ${connStr}...`);
    
    // Set short timeout to quickly fall back if database is not running
    await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 3000, 
    });
    
    console.log('✅ MongoDB connected successfully.');
    isInMemoryMode = false;
  } catch (error) {
    console.warn('⚠️ MongoDB connection failed. Database features will run in in-memory demo mode.');
    console.warn(`Reason: ${error.message}`);
    isInMemoryMode = true;
  }
};

const checkInMemoryMode = () => isInMemoryMode;

module.exports = { connectDB, checkInMemoryMode };
