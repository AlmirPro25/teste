const simpleAuth = (req, res, next) => {
     req.userId = req.headers['x-user-id'] || 'test-user-http';
     if (!req.userId) {
          return res.status(401).json({ error: "Não autorizado" });
     }
     next();
};

module.exports = { simpleAuth };
