function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden', message: 'Administrator access is required.' });
  next();
}
module.exports = adminMiddleware;
