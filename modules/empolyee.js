const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    mobile: {
        type: Number, 
        required: true
    },
    designation: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        required: true
    },
    courses: {
        type: [String], 
        required: true
    },
    image: {
        type: String,
        default: null
    },
    createdAt:{
        type: Date,
        default: Date.now()
    }
});

const Employee = mongoose.model('Employee', EmployeeSchema);
module.exports = Employee;
