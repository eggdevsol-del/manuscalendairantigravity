require('dotenv/config');
const mysql = require('mysql2/promise');

(async () => {
    const c = await mysql.createConnection(process.env.DATABASE_URL);
    
    await c.query(
        `UPDATE artistSettings 
         SET stripeConnectAccountId = NULL, 
             stripeConnectOnboardingComplete = 0, 
             stripeConnectPayoutsEnabled = 0, 
             stripeConnectDetailsSubmitted = 0, 
             stripe_connect_account_type = 'standard' 
         WHERE userId = 'user_20f4920d892ae5508efed607a5870ce2'`
    );
    
    console.log('Reset done');
    
    const [rows] = await c.query(
        'SELECT userId, stripeConnectAccountId, stripe_connect_account_type FROM artistSettings WHERE userId = ?',
        ['user_20f4920d892ae5508efed607a5870ce2']
    );
    console.log(JSON.stringify(rows, null, 2));
    
    await c.end();
})();
