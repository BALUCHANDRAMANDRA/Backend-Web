const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    type: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, default: 'pending' },
    feedbackMessage: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });


const Request = mongoose.model('Request', requestSchema);
module.exports = Request;
