const dns = require("dns");
const mongoose = require("mongoose");

module.exports = async function connectDB() {
  // Local fix: some machines run a local DNS stub (127.0.0.1) that refuses the SRV lookups
  // used by mongodb+srv:// URIs (error: querySrv ECONNREFUSED). Use public DNS in development.
  if (process.env.NODE_ENV !== "production") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected");
};
