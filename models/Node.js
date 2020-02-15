const
    mongoose = require('mongoose'),
    { Schema } = mongoose;

const nodeSchema = new Schema({
    address: String,
    // Node data
    nodeVer: Number,
    nodeUserAgent: String,
    versionHex: String,
    // Dates
    lastRecieved: Date,
    lastSuccessfulConnDate: { type: Date, index: true },
    lastFailedConnDate: Date,
    // Last error
    lastFailedConnError: String,
    // Counts
    successfulConnsCount: { type: Number, default: 0, index: true },
    failedConnsCount: { type: Number, default: 0 },
    recievedCount: { type: Number, default: 0, index: true },
});

mongoose.model('node', nodeSchema);
