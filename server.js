const { startServer } = require('./dist/server/next-utils');

// Start the server with WebSocket support
startServer()
  .then(() => {
    console.log('Server started successfully with WebSocket support');
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  }); 