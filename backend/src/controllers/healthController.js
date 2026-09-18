function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'PathWise backend',
  });
}

module.exports = {
  getHealth,
};
