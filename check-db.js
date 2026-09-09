const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'anime.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT * FROM User', (err, rows) => {
    if (err) {
        console.error('❌ Ошибка:', err.message);
    } else {
        console.log('✅ Пользователи в базе данных:');
        console.table(rows);
    }
    db.close();
});