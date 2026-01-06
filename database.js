import dotenv from "dotenv";
import oracledb from "oracledb";

dotenv.config();

// configure oracle client
oracledb.initOracleClient({
    libDir: 'E:\\Castoline_Project With Oracle-Host\\Castolin-BackEnd-Oracle-Host\\instantclient_21_19',
    configDir: 'E:\\Castoline_Project With Oracle-Host\\Castolin-BackEnd-Oracle-Host\\Wallet_MYFREEDB'
})

oracledb.poolMax = 10;
oracledb.poolMin = 2;
oracledb.poolIncrement = 2;
oracledb.poolTimeout = 600;

async function initialize() {
    try {
        await oracledb.createPool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECT_STRING,
            ssl: {
                ssl: true,
                wallet: {
                    directory: 'E:\\Castoline_Project With Oracle-Host\\Castolin-BackEnd-Oracle-Host\\Wallet_MYFREEDB'
                }
            }
        })

        console.log('connection pool created successfully');
    } catch (error) {
        console.error('Error creating connection pool', error);
        throw error;
    }
}

async function closePool () {
    try {
        await oracledb.getPool().close();
        console.log('connection pool closed successfully');
    } catch (error) {
        console.error('Error closing pool', error);
        throw error;
    }
}

async function executeQuery (query, bindParams = [], options = {}) {
    let connection;

    try {
        connection = await oracledb.getPool().getConnection();
        const result = await connection.execute(query, bindParams, options);
        return result;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
}

export {
    initialize,
    closePool,
    executeQuery
};