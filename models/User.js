const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true // with this, No two users can have the same username
    },
    email: {
        type: String,
        required: true,
        unique: true // this key value pair shows that no two user can have the same email.
    },
    password: {
        type: String,
        required: true // password must be provided
    }
}, { timestamps: true }); // This automatically adds 'createdAt' and 'updatedAt' 

module.exports = mongoose.model('User', UserSchema);