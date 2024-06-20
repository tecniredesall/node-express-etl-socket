import mongoose, { Schema } from "mongoose";

let connectionSchema = new Schema({
  ip_address: {type:String, required: true},
  status: {
    type: String,
    enum: ['Online', 'Offline'],
    default: 'Online',
    required: true
  },
  device_type: {
    type: String,
    default: 'scale'
  }
});

let locationSchema = new Schema({
  name: { type: String, required: true, unique: true },
  port: { type: Number, required: true, unique: true },
  registered: { type: Date, default: Date.now },
  iotConnected: [{ type: connectionSchema, required: false }],
  removed: { type: Date, default: null }
}, {
    versionKey: false
});

// Export the model
module.exports = mongoose.model("Location", locationSchema);
