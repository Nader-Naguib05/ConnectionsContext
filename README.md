# ConnectionsContext

A lightweight MongoDB multi-tenancy connection manager built with Mongoose.  
It allows you to connect to multiple databases within the same MongoDB cluster, keep them alive, and manage them efficiently using a `Map`-based connection store.

---

## Features

- **Multi-Tenant Ready**: Supports multiple databases within the same cluster.
- **Connection Pooling**: Avoids repeated connections with efficient reuse.
- **Automatic Cleanup**: Removes unhealthy or disconnected connections from the pool.
- **Graceful Shutdown**: Closes all connections on `SIGINT` / `SIGTERM`.
- **Health Checks**: Easily verify connection health and details.

---

## Installation

```bash
npm install mongoose
```

You should also configure your environment variables for MongoDB:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>
MAIN_DB_NAME=chapel
```

### getConnection(portId = null)
Returns a connection for the main database or a tenant-specific database. Creates a new one if it doesn’t exist or is not connected.

### getActiveConnections()
Returns a Map of all active (connected) databases.

### closeConnection(portId = null)
Closes a specific connection by its key (main or portId).

### closeAllConnections()
Closes all active connections and clears the pool.

### healthCheck()
Pings all databases and returns an object with their health status.

### getConnectionInfo(portId = null)
Returns detailed info about a specific connection.

## License
MIT License. Free to use and modify.
