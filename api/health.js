module.exports = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Direct Vercel Serverless health check OK",
    timestamp: new Date().toISOString()
  });
};
