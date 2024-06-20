
import fs from 'fs';

import connectDB from '../server/util/db-connection-helper';
import sedeer from './sedeer.util';
if (fs.existsSync(__dirname, '../.env')) require('dotenv').config();
connectDB().then(async () => {
    sedeer();
});

