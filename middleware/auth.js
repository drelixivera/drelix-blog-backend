const jwt = require('jsonwebtoken'); // for authentication

module.exports = function (req, res, next) {
    // 1. gets the token from the header
    const token = req.header('x-auth-token');

    // 2. checks if no token
    if (!token) {
        return res.status(404).json({ msg: 'No token, authorization denied' });
    }

    // 3. verify token 
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log("=== RAW BACKEND JWT PAYLOAD ===", decoded);

        req.user = decoded.user || decoded;

        next();
    } catch (err) {
        res.status(400).json({ msg: 'Token is not valid' });
    }
};
