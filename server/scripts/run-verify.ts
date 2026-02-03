
import { verifyAndFixDatabase } from "../verify-and-fix-db";
import 'dotenv/config';

verifyAndFixDatabase()
    .then(() => console.log('Verification Complete'))
    .catch(err => console.error('Verification Failed', err));
