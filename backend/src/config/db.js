import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/upimesh';
    const conn = await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    process.exit(1);
  }
};
