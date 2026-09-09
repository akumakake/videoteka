const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'anime.db');
const db = new sqlite3.Database(dbPath);

async function createAdmin() {
    const login = 'akumakake';
    const email = 'qdesnick1002@gmail.com';
    const password = '$2b$10$qLVSqfDADPASfIyu9ZObDOeZAhpgN3BxcQElyIAXizaH3X8iHbx.e'; // Можете изменить на любой пароль
    const registrationDate = new Date().toISOString().split('T')[0];
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT OR REPLACE INTO User (login, email, password, registration_date, role) VALUES (?, ?, ?, ?, ?)',
            [login, email, hashedPassword, registrationDate, 'admin'],
            function(err) {
                if (err) {
                    console.error('❌ Ошибка:', err.message);
                } else {
                    console.log('✅ Администратор создан!');
                    console.log('👤 Логин: akumakake');
                    console.log('🔑 Пароль: ' + password);
                }
                db.close();
            }
        );
    } catch (e) {
        console.error('❌ Ошибка:', e.message);
        db.close();
    }
}

createAdmin();