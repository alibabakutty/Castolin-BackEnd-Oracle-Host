import oracledb from 'oracledb';

try {
    oracledb.initOracleClient({ libDir: 'E:\\Castoline_Project With Oracle-Host\\Castolin-BackEnd-Oracle-Host\\instantclient_21_19' });
    console.log('Oracle Client initialized!');
} catch (err) {
    console.error('Oracle Client init error:', err);
}
