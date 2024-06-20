import { connect } from 'mongoose';

const connectDB = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    };
    // This mongoose version does not support parameter in URI, so the parameter stuff is removed (?param=value)
    await connect(process.env.DB_STRING.split('?')[0], options);
    console.info('MongoDB Connected...');
  } catch (err) {
    console.error(err.message);
    // Exit process with failure
    process.exit(1);
  }
};

export default connectDB;