/**
 * @file connectionsContext.js
 * @description Manages multiple Mongoose connections for multi-tenant systems.
 */

import mongoose from "mongoose";

/**
 * Handles creation, caching, and lifecycle of Mongoose connections.
 * Useful for multi-tenancy where each tenant may have its own database.
 */
class ConnectionsContext {
    constructor() {
        /** @type {Map<string, mongoose.Connection>} */
        this.connections = new Map();

        /** Base MongoDB connection string (without DB name). */
        this.baseConnectionString =
            process.env.MONGODB_URI || "mongodb+srv://<username>:<password>@<cluster-url>";

        /** Default database name. */
        this.mainDbName = process.env.MAIN_DB_NAME || "defaultDb";

        /** Mongoose connection options. */
        this.connectionOptions = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
        };
    }

    /**
     * Gets or creates a connection for the given tenant.
     * @param {string|null} tenantId - Tenant identifier; if null, main DB is used.
     * @returns {Promise<mongoose.Connection>}
     */
    async getConnection(tenantId = null) {
        const connectionKey = tenantId || "main";

        // Return existing, ready connection
        if (this.connections.has(connectionKey)) {
            const connection = this.connections.get(connectionKey);
            if (connection.readyState === 1) return connection;
            this.connections.delete(connectionKey); // Remove stale connection
        }

        try {
            const dbName = tenantId ? `${this.mainDbName}_${tenantId}` : this.mainDbName;
            const connectionString = `${this.baseConnectionString}/${dbName}`;

            const connection = await mongoose.createConnection(connectionString, this.connectionOptions);
            this.setupConnectionListeners(connection, connectionKey);
            this.connections.set(connectionKey, connection);

            console.log(`✅ Connected to database: ${dbName}`);
            return connection;
        } catch (error) {
            console.error(`❌ Failed to connect for ${connectionKey}:`, error);
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    /**
     * Sets up lifecycle event listeners for a Mongoose connection.
     * @param {mongoose.Connection} connection
     * @param {string} connectionKey
     */
    setupConnectionListeners(connection, connectionKey) {
        connection.on("connected", () =>
            console.log(`🔗 Database connected: ${connectionKey}`)
        );

        connection.on("error", (error) => {
            console.error(`❌ Database error for ${connectionKey}:`, error);
            this.connections.delete(connectionKey);
        });

        connection.on("disconnected", () => {
            console.log(`🔌 Database disconnected: ${connectionKey}`);
            this.connections.delete(connectionKey);
        });

        connection.on("reconnected", () =>
            console.log(`🔄 Database reconnected: ${connectionKey}`)
        );
    }

    /**
     * Returns all active (connected) connections.
     * @returns {Map<string, mongoose.Connection>}
     */
    getActiveConnections() {
        const active = new Map();
        for (const [key, connection] of this.connections) {
            if (connection.readyState === 1) active.set(key, connection);
        }
        return active;
    }

    /**
     * Closes a specific connection.
     * @param {string|null} tenantId
     */
    async closeConnection(tenantId = null) {
        const connectionKey = tenantId || "main";
        if (!this.connections.has(connectionKey)) return;

        const connection = this.connections.get(connectionKey);
        try {
            await connection.close();
            console.log(`🔒 Closed connection: ${connectionKey}`);
        } catch (error) {
            console.error(`Error closing connection ${connectionKey}:`, error);
        } finally {
            this.connections.delete(connectionKey);
        }
    }

    /**
     * Closes all active connections.
     */
    async closeAllConnections() {
        const promises = [];
        for (const [key, connection] of this.connections) {
            promises.push(
                connection.close()
                    .then(() => console.log(`🔒 Closed connection: ${key}`))
                    .catch((error) =>
                        console.error(`Error closing connection ${key}:`, error)
                    )
            );
        }
        await Promise.all(promises);
        this.connections.clear();
        console.log("🔒 All database connections closed");
    }

    /**
     * Checks the health of all connections.
     * @returns {Promise<object>}
     */
    async healthCheck() {
        const health = {};
        for (const [key, connection] of this.connections) {
            try {
                await connection.db.admin().ping();
                health[key] = {
                    status: "healthy",
                    readyState: connection.readyState,
                    host: connection.host,
                    port: connection.port,
                    dbName: connection.name,
                };
            } catch (error) {
                health[key] = {
                    status: "unhealthy",
                    error: error.message,
                    readyState: connection.readyState,
                };
            }
        }
        return health;
    }

    /**
     * Gets connection info.
     * @param {string|null} tenantId
     * @returns {object|null}
     */
    getConnectionInfo(tenantId = null) {
        const connectionKey = tenantId || "main";
        const connection = this.connections.get(connectionKey);
        if (!connection) return null;

        return {
            key: connectionKey,
            readyState: connection.readyState,
            host: connection.host,
            port: connection.port,
            dbName: connection.name,
            collections: Object.keys(connection.models || {}),
        };
    }
}

// Singleton instance
const connectionsContext = new ConnectionsContext();

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("🛑 SIGINT received. Closing all DB connections...");
    await connectionsContext.closeAllConnections();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("🛑 SIGTERM received. Closing all DB connections...");
    await connectionsContext.closeAllConnections();
    process.exit(0);
});

export default connectionsContext;
