import mongoose, { Schema } from "mongoose";

let metricSchema = new Schema({
  weight: {type:Number, required: true},
  units: {type:String, enum: ['kg', 'lb'], required: true},
  date: { type: Date, default: Date.now },
});

let scaleSchema = new Schema({
  location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  ip_address: {type: String, required: true, max: 20},
  metrics: [{ type: metricSchema, required: false }],
}, {
  versionKey: false
});

// Export the model
module.exports = mongoose.model("Scale", scaleSchema);
