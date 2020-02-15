const
    mongoose = require('mongoose'),
    { Schema } = mongoose;

const nodeSchema = new Schema({
    address: { type: String, index: true },
    // Node data
    nodeVer: Number,
    nodeUserAgent: String,
    versionHex: String,
    // Dates
    lastRecieved: Date,
    lastSuccessfulConnDate: Date,
    lastFailedConnDate: Date,
    // Last error
    lastFailedConnError: String,
    // Counts
    successfulConnsCount: { type: Number, default: 0 },
    failedConnsCount: { type: Number, default: 0 },
    recievedCount: { type: Number, default: 0 },
    // Priority 
    priority: { type: Number, default: 1, index: true },
});

mongoose.model('node', nodeSchema);
