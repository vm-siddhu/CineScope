const jwt = require('jsonwebtoken');

/**
 * Auth middleware — verifies the Bearer token.
 * Returns 401 (not 500) for missing, expired, or invalid tokens.
 */
const auth = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'No authentication token, access denied' });
        }

        // jwt.verify throws JsonWebTokenError / TokenExpiredError on bad tokens.
        // Catching those here and returning 401 instead of leaking a 500.
        let verified;
        try {
            verified = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            return res.status(401).json({ message: 'Token invalid or expired, access denied' });
        }

        req.user = verified.id;
        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = auth;
