import mongoose from 'mongoose';

async function test() {
  try {
    const uri = 'mongodb+srv://anuragsenhere_db_user:H8v2fK8MVWs3M461@cluster0.mongodb.net/codeflex?retryWrites=true&w=majority';
    console.log('Connecting to:', uri);
    await mongoose.connect(uri);
    console.log('Connected successfully!');
    
    // Test creating a Plan
    const { Plan } = require('./src/models/Plan');
    console.log('Plan model loaded');
    
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err);
    process.exit(1);
  }
}

test();
