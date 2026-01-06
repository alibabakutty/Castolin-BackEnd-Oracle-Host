import * as db from './database.js';

async function main () {
    try {
        await db.initialize();
        const result = await db.executeQuery('SELECT * FROM customer', []);
        console.log('Query results', result.rows);

        await db.closePool();
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

main();