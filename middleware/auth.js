const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
        req.user = decoded; // { userId: '...', email: '...' }
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = { requireAuth };
