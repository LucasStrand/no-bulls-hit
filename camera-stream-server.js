import { WebSocketServer } from 'ws';
import https from 'https'; // Use https module
import fs from 'fs'; // Keep fs module
import path from 'path'; // For resolving paths potentially

const PORT = 8081;

// Find mkcert files (assuming they are in the project root)
const host = 'localhost'; // Used to find the files
const keyFileName = fs.readdirSync('.').find(file => file.includes(host) && file.endsWith('-key.pem'));
const certFileName = fs.readdirSync('.').find(file => file.includes(host) && !file.includes('-key') && file.endsWith('.pem'));

if (!keyFileName || !certFileName) {
  throw new Error('MKCert certificate files (localhost*.pem, localhost*-key.pem) not found in project root. Generate them with mkcert.');
}

console.log(`Loading certs: KEY=${keyFileName}, CERT=${certFileName}`);

// Create HTTPS server using the certificates
const server = https.createServer({
  key: fs.readFileSync(keyFileName),
  cert: fs.readFileSync(certFileName)
}, (req, res) => {
  // Log ALL basic HTTPS requests
  console.log(`HTTPS Request received: ${req.method} ${req.url} from ${req.socket.remoteAddress}`); 
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Secure WebSocket server is running. Connect via WSS protocol.');
});

// Add error logging for the HTTPS server itself
server.on('error', (err) => {
  console.error('HTTPS Server Error:', err);
});

// Attach WebSocket server to the HTTPS server
const wss = new WebSocketServer({ server });

let cameraSocket = null;
let clientSockets = new Set();

console.log(`HTTPS/Secure WebSocket server starting on port ${PORT}`);

// Remove the separate 'upgrade' listener, https server handles it implicitly with WebSocketServer attached

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  // Log added HERE, right at the start of a successful WS connection
  console.log(`WebSocket Connection Established with ${clientIp}`); 

  // Wait for identification message
  ws.once('message', (message) => {
    console.log(`Handshake message received from ${clientIp}`); // Log successful handshake start
    let parsedMessage;
    try {
      // Ensure message is treated as Buffer then converted to string
      const messageString = Buffer.isBuffer(message) ? message.toString() : message;
      parsedMessage = JSON.parse(messageString);
    } catch (e) {
      console.error(`Invalid handshake JSON from ${clientIp}: ${messageString}`);
      ws.close(1008, "Invalid handshake format"); // 1008 = Policy Violation
      return;
    }

    if (parsedMessage && parsedMessage.type === 'camera-init') {
      // This is the camera
      if (cameraSocket !== null && cameraSocket !== ws) {
        console.log('Another camera tried to connect. Closing previous.');
        cameraSocket.close(1000, "New camera connected"); // 1000 = Normal Closure
      }
      console.log(`Camera stream source identified and connected: ${clientIp}`);
      cameraSocket = ws;

      // Setup camera-specific listeners
      ws.on('message', (frameMessage) => {
        // Broadcast frame data ONLY if it's the designated camera
        if (ws === cameraSocket) {
           // Log received frame size (optional, can be verbose)
           console.log(`Received frame from camera (${clientIp}), size: ${frameMessage.length}`);
           clientSockets.forEach(client => {
             if (client.readyState === 1 /* WebSocket.OPEN */) {
               client.send(frameMessage); // Forward the raw frame message
             }
           });
        }
      });

      ws.on('close', () => {
        if (ws === cameraSocket) {
           console.log(`Camera stream source disconnected: ${clientIp}`);
           cameraSocket = null;
        }
      });

      ws.on('error', (error) => {
        if (ws === cameraSocket) {
           console.error(`Camera socket error (${clientIp}):`, error);
           cameraSocket = null;
        }
      });

    } else if (parsedMessage && parsedMessage.type === 'client-init') {
      // This is a React client
      console.log(`React client identified and connected: ${clientIp}`);
      clientSockets.add(ws);

      // Setup client-specific listeners
      ws.on('close', () => {
        console.log(`React client disconnected: ${clientIp}`);
        clientSockets.delete(ws);
      });

      ws.on('error', (error) => {
        console.error(`React client socket error (${clientIp}):`, error);
        clientSockets.delete(ws);
      });
      
      // We don't expect further messages *from* the client in this setup
      // but you could add listeners here if needed.

    } else {
      // Unknown client type
      console.log(`Unknown client type from ${clientIp}. Closing connection.`);
      ws.close(1008, "Unknown client type");
    }
  }); // End of ws.once('message') for handshake

  // Add a general error handler for the initial connection phase
  ws.on('error', (error) => {
      // Handle errors before handshake completes
      if (ws !== cameraSocket && !clientSockets.has(ws)) {
           console.error(`Initial connection error (${clientIp}):`, error);
      }
  });
});

wss.on('error', (error) => {
  console.error('WebSocket Server Instance Error:', error);
});

// Start the HTTPS server listening
server.listen(PORT, () => {
  console.log(`Secure Server listening on port ${PORT}`);
}); 