const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-this-in-production';

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

// Подключение к SQLite
const dbPath = path.resolve(__dirname, 'anime.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err.message);
    } else {
        console.log('✅ Подключено к SQLite');
    }
});

// ============ ПРОВЕРКА ПРАВ АДМИНИСТРАТОРА ============

const checkAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        
        db.get(
            'SELECT role FROM User WHERE user_id = ?',
            [user.user_id],
            (err, userData) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                if (!userData || userData.role !== 'admin') {
                    return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора.' });
                }
                req.user = user;
                next();
            }
        );
    });
};

// ============ АУТЕНТИФИКАЦИЯ ============

// Регистрация
app.post('/api/register', async (req, res) => {
    const { login, email, password } = req.body;

    if (!login || !email || !password) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const registrationDate = new Date().toISOString().split('T')[0];

        db.run(
            'INSERT INTO User (login, email, password, registration_date, role) VALUES (?, ?, ?, ?, ?)',
            [login, email, hashedPassword, registrationDate, 'user'],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Пользователь с таким логином или email уже существует' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                res.json({ 
                    message: '✅ Регистрация успешна',
                    user_id: this.lastID
                });
            }
        );
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Вход
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }

    db.get(
        'SELECT * FROM User WHERE login = ?',
        [login],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!user) {
                return res.status(401).json({ error: 'Неверный логин или пароль' });
            }

            try {
                const validPassword = await bcrypt.compare(password, user.password);
                if (!validPassword) {
                    return res.status(401).json({ error: 'Неверный логин или пароль' });
                }

                const token = jwt.sign(
                    { user_id: user.user_id, login: user.login },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                res.json({
                    token,
                    user: {
                        user_id: user.user_id,
                        login: user.login,
                        email: user.email,
                        role: user.role
                    }
                });
            } catch (e) {
                res.status(500).json({ error: 'Ошибка при проверке пароля' });
            }
        }
    );
});

// GET текущий пользователь
app.get('/api/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        
        db.get(
            'SELECT user_id, login, email, registration_date, role FROM User WHERE user_id = ?',
            [user.user_id],
            (err, userData) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                if (!userData) {
                    return res.status(404).json({ error: 'Пользователь не найден' });
                }
                res.json(userData);
            }
        );
    });
});

// ============ ТАЙТЛЫ ============

// GET все тайтлы (с фильтрацией)
app.get('/api/titles', (req, res) => {
    const { minRating, genre, search, sort } = req.query;
    let sql = `
        SELECT 
            t.*,
            GROUP_CONCAT(g.name) as genres
        FROM Title t
        LEFT JOIN Title_Genre tg ON t.title_id = tg.title_id
        LEFT JOIN Genre g ON tg.genre_id = g.genre_id
    `;
    let conditions = [];
    let params = [];

    if (minRating) {
        conditions.push('t.rating >= ?');
        params.push(parseFloat(minRating));
    }

    if (search) {
        conditions.push('t.name LIKE ?');
        params.push(`%${search}%`);
    }

    if (genre) {
        conditions.push('g.genre_id = ?');
        params.push(parseInt(genre));
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY t.title_id';

    if (sort === 'rating') {
        sql += ' ORDER BY t.rating DESC';
    } else if (sort === 'year') {
        sql += ' ORDER BY t.release_year DESC';
    } else {
        sql += ' ORDER BY t.title_id';
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// GET тайтл по ID
app.get('/api/titles/:id', (req, res) => {
    const { id } = req.params;
    db.get(`
        SELECT 
            t.*,
            GROUP_CONCAT(g.name) as genres
        FROM Title t
        LEFT JOIN Title_Genre tg ON t.title_id = tg.title_id
        LEFT JOIN Genre g ON tg.genre_id = g.genre_id
        WHERE t.title_id = ?
        GROUP BY t.title_id
    `, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ error: 'Тайтл не найден' });
        } else {
            res.json(row);
        }
    });
});

// GET тайтл по ID с подробной информацией
app.get('/api/titles/:id/detail', (req, res) => {
    const { id } = req.params;
    
    db.get(`
        SELECT 
            t.*,
            GROUP_CONCAT(DISTINCT g.name) as genres,
            COUNT(DISTINCT r.review_id) as reviews_count,
            AVG(DISTINCT rt.value) as average_rating
        FROM Title t
        LEFT JOIN Title_Genre tg ON t.title_id = tg.title_id
        LEFT JOIN Genre g ON tg.genre_id = g.genre_id
        LEFT JOIN Review r ON t.title_id = r.title_id AND r.status = 'approved'
        LEFT JOIN Rating rt ON t.title_id = rt.title_id
        WHERE t.title_id = ?
        GROUP BY t.title_id
    `, [id], (err, title) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!title) {
            return res.status(404).json({ error: 'Тайтл не найден' });
        }

        db.all(`
            SELECT 
                s.season_id,
                s.season_number,
                e.episode_id,
                e.episode_number,
                e.name as episode_name,
                e.duration
            FROM Season s
            LEFT JOIN Episode e ON s.season_id = e.season_id
            WHERE s.title_id = ?
            ORDER BY s.season_number, e.episode_number
        `, [id], (err, episodes) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const seasons = {};
            episodes.forEach(ep => {
                if (!seasons[ep.season_id]) {
                    seasons[ep.season_id] = {
                        season_id: ep.season_id,
                        season_number: ep.season_number,
                        episodes: []
                    };
                }
                if (ep.episode_id) {
                    seasons[ep.season_id].episodes.push({
                        episode_id: ep.episode_id,
                        episode_number: ep.episode_number,
                        name: ep.episode_name,
                        duration: ep.duration
                    });
                }
            });

            db.all(`
                SELECT 
                    r.review_id,
                    r.text as review_text,
                    r.date as review_date,
                    r.status,
                    u.login as user_login
                FROM Review r
                JOIN User u ON r.user_id = u.user_id
                WHERE r.title_id = ? AND r.status = 'approved'
                ORDER BY r.date DESC
            `, [id], (err, reviews) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                res.json({
                    ...title,
                    seasons: Object.values(seasons),
                    reviews: reviews
                });
            });
        });
    });
});

// POST создать новый тайтл (только для админа)
app.post('/api/titles', checkAdmin, (req, res) => {
    const { name, release_year, rating, description, genres } = req.body;
    
    db.run(
        'INSERT INTO Title (name, release_year, rating, description) VALUES (?, ?, ?, ?)',
        [name, release_year, rating, description],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const titleId = this.lastID;
            
            if (genres && Array.isArray(genres)) {
                genres.forEach(genreId => {
                    db.run(
                        'INSERT INTO Title_Genre (title_id, genre_id) VALUES (?, ?)',
                        [titleId, genreId]
                    );
                });
            }
            
            res.json({ 
                message: '✅ Тайтл создан', 
                title_id: titleId 
            });
        }
    );
});

// PUT обновить тайтл (только для админа)
app.put('/api/titles/:id', checkAdmin, (req, res) => {
    const { id } = req.params;
    const { name, release_year, rating, description } = req.body;
    
    db.run(
        'UPDATE Title SET name = ?, release_year = ?, rating = ?, description = ? WHERE title_id = ?',
        [name, release_year, rating, description, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Тайтл не найден' });
            }
            res.json({ message: '✅ Тайтл обновлён' });
        }
    );
});

// DELETE удалить тайтл (только для админа)
app.delete('/api/titles/:id', checkAdmin, (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM Title WHERE title_id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Тайтл не найден' });
        }
        res.json({ message: '✅ Тайтл удалён' });
    });
});

// ============ ОТЗЫВЫ ============

// GET все отзывы
app.get('/api/reviews', (req, res) => {
    db.all(`
        SELECT 
            r.review_id,
            r.text as review_text,
            r.date as review_date,
            r.status,
            r.user_id,
            r.title_id,
            t.name AS title_name,
            u.login AS user_login
        FROM Review r
        JOIN Title t ON r.title_id = t.title_id
        JOIN User u ON r.user_id = u.user_id
        ORDER BY r.review_id
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// GET отзыв по ID
app.get('/api/reviews/:id', (req, res) => {
    const { id } = req.params;
    db.get(`
        SELECT 
            r.review_id,
            r.text as review_text,
            r.date as review_date,
            r.status,
            r.user_id,
            r.title_id,
            t.name AS title_name,
            u.login AS user_login
        FROM Review r
        JOIN Title t ON r.title_id = t.title_id
        JOIN User u ON r.user_id = u.user_id
        WHERE r.review_id = ?
    `, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ error: 'Отзыв не найден' });
        } else {
            res.json(row);
        }
    });
});

// POST создать отзыв (только для админа)
app.post('/api/reviews', checkAdmin, (req, res) => {
    const { review_text, review_date, status, user_id, title_id } = req.body;
    db.run(
        'INSERT INTO Review (text, date, status, user_id, title_id) VALUES (?, ?, ?, ?, ?)',
        [review_text, review_date, status, user_id, title_id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ 
                    message: '✅ Отзыв создан', 
                    review_id: this.lastID 
                });
            }
        }
    );
});

// PUT обновить отзыв (только для админа)
app.put('/api/reviews/:id', checkAdmin, (req, res) => {
    const { id } = req.params;
    const { review_text, review_date, status, user_id, title_id } = req.body;
    db.run(
        'UPDATE Review SET text = ?, date = ?, status = ?, user_id = ?, title_id = ? WHERE review_id = ?',
        [review_text, review_date, status, user_id, title_id, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'Отзыв не найден' });
            } else {
                res.json({ message: '✅ Отзыв обновлён' });
            }
        }
    );
});

// DELETE удалить отзыв (только для админа)
app.delete('/api/reviews/:id', checkAdmin, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM Review WHERE review_id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Отзыв не найден' });
        } else {
            res.json({ message: '✅ Отзыв удалён' });
        }
    });
});

// ============ СЕЗОНЫ И ЭПИЗОДЫ ============

// POST создать сезон (только для админа)
app.post('/api/seasons', checkAdmin, (req, res) => {
    const { season_number, title_id } = req.body;
    
    db.run(
        'INSERT INTO Season (season_number, title_id) VALUES (?, ?)',
        [season_number, title_id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                message: '✅ Сезон создан', 
                season_id: this.lastID 
            });
        }
    );
});

// POST создать эпизод (только для админа)
app.post('/api/episodes', checkAdmin, (req, res) => {
    const { episode_number, name, duration, season_id } = req.body;
    
    db.run(
        'INSERT INTO Episode (episode_number, name, duration, season_id) VALUES (?, ?, ?, ?)',
        [episode_number, name, duration, season_id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                message: '✅ Эпизод создан', 
                episode_id: this.lastID 
            });
        }
    );
});

// ============ ЖАНРЫ ============

// GET все жанры
app.get('/api/genres', (req, res) => {
    db.all('SELECT * FROM Genre ORDER BY name', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// ============ ПОЛЬЗОВАТЕЛИ ============

// GET пользователи
app.get('/api/users', (req, res) => {
    const { minReviews } = req.query;
    let sql = `
        SELECT 
            u.user_id,
            u.login,
            u.email,
            u.registration_date,
            u.role,
            COUNT(r.review_id) as review_count
        FROM User u
        LEFT JOIN Review r ON u.user_id = r.user_id
    `;
    let params = [];
    
    if (minReviews !== undefined && !isNaN(parseInt(minReviews))) {
        sql += ' GROUP BY u.user_id HAVING review_count >= ?';
        params.push(parseInt(minReviews));
    } else {
        sql += ' GROUP BY u.user_id';
    }
    
    sql += ' ORDER BY review_count DESC';
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// ============ СТАТИСТИКА ============

// GET общая статистика
app.get('/api/stats', (req, res) => {
    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM Title) as total_titles,
            (SELECT COUNT(*) FROM User) as total_users,
            (SELECT COUNT(*) FROM Review WHERE status = 'approved') as total_reviews,
            (SELECT COUNT(*) FROM Episode) as total_episodes,
            (SELECT AVG(rating) FROM Title) as average_rating
    `, (err, stats) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(stats);
        }
    });
});

// ============ СТАРТ СЕРВЕРА ============

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});