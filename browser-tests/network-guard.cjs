// Test server only: all outbound TCP connections must stay on loopback.
const net = require("node:net");
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = args[0];
  const options = typeof first === "object" && first !== null ? first : { port: first, host: args[1] };
  if (options.path || !["127.0.0.1", "::1"].includes(options.host)) {
    process.stderr.write("BROWSER_TEST_EXTERNAL_CONNECTION_BLOCKED\n");
    throw new Error(`Browser test refused outbound connection to ${String(options.host ?? options.path)}`);
  }
  return connect.apply(this, args);
};
