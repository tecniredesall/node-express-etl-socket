import mongoose, { Schema } from "mongoose";

let metricSchema = new Schema({
  total: {type:Number, required: true},
  bad: {type:Number, required: true},
  speed: {type:Number, required: true},
  ImpurityRatio: {type:Number, required: true},
  DefectiveRatio: {type:Number, required: true},
  periodProduct: {type:Number, required: true},
  periodProduct: [{type:Number, required: true}],
  date: { type: Date, default: Date.now },
});

let sorterSchema = new Schema({
  location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  ip_address: {type: String, required: true, max: 20},
  process_id: {type: String, required: true, max: 20},
  metrics: [{ type: metricSchema, required: false }],
}, {
  versionKey: false
});

// Export the model
module.exports = mongoose.model("Sorter", sorterSchema);
