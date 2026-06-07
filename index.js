const net = require('net');
const http = require('http');
const { WebSocketServer } = require('ws');

const userID = '47bf2428-b38d-4c02-8d24-0931ce6ee2c2';

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('OK');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.once('message', (data) => {
    const buf = Buffer.from(data);
    
    // validate uuid
    const uuid = buf.slice(1, 17);
    const hex = uuid.toString('hex');
    const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    
    if (id !== userID) {
      ws.close();
      return;
    }

    const optLen = buf[17];
    const cmd = buf[18 + optLen];
    if (cmd !== 1) { ws.close(); return; }

    const port = buf.readUInt16BE(19 + optLen);
    const addrType = buf[21 + optLen];
    let addr = '';
    let headerEnd = 22 + optLen;

    if (addrType === 1) {
      addr = buf.slice(headerEnd, headerEnd + 4).join('.');
      headerEnd += 4;
    } else if (addrType === 2) {
      const len = buf[headerEnd];
      headerEnd += 1;
      addr = buf.slice(headerEnd, headerEnd + len).toString();
      headerEnd += len;
    } else if (addrType === 3) {
      const parts = [];
      for (let i = 0; i < 8; i++) {
        parts.push(buf.readUInt16BE(headerEnd + i * 2).toString(16));
      }
      addr = parts.join(':');
      headerEnd += 16;
    }

    const payload = buf.slice(headerEnd);
    const socket = net.connect(port, addr, () => {
      socket.write(payload);
    });

    let first = true;
    socket.on('data', (chunk) => {
      if (ws.readyState !== 1) return;
      if (first) {
        const resp = Buffer.concat([Buffer.from([0, 0]), chunk]);
        ws.send(resp);
        first = false;
      } else {
        ws.send(chunk);
      }
    });

    socket.on('close', () => ws.close());
    socket.on('error', () => ws.close());

    ws.on('message', (msg) => socket.write(msg));
    ws.on('close', () => socket.destroy());
    ws.on('error', () => socket.destroy());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Running on port ${PORT}`));
