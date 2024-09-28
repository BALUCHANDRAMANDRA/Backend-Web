const jwt = require('jsonwebtoken');
require('dotenv').config();

const adminOnly = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(403).json({ msg: "No token provided, authorization denied" });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET); 
        req.user = decoded; 

        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: "Access denied: Admins only" });
        }

        next(); 
    } catch (err) {
        res.status(403).json({ msg: "Invalid token" });
    }
};

module.exports = adminOnly;
