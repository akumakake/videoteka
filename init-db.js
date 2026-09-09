const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'anime.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON;');

    // Таблица User с полем role
    db.run(`
        CREATE TABLE IF NOT EXISTS User (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            login TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            registration_date TEXT NOT NULL,
            role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Title (
            title_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            release_year INTEGER,
            rating REAL,
            description TEXT,
            poster_url TEXT,
            trailer_url TEXT,
            type TEXT CHECK (type IN ('anime', 'movie', 'series'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Genre (
            genre_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Title_Genre (
            title_id INTEGER NOT NULL,
            genre_id INTEGER NOT NULL,
            PRIMARY KEY (title_id, genre_id),
            FOREIGN KEY (title_id) REFERENCES Title(title_id) ON DELETE CASCADE,
            FOREIGN KEY (genre_id) REFERENCES Genre(genre_id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Season (
            season_id INTEGER PRIMARY KEY AUTOINCREMENT,
            season_number INTEGER NOT NULL,
            title_id INTEGER NOT NULL,
            FOREIGN KEY (title_id) REFERENCES Title(title_id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Episode (
            episode_id INTEGER PRIMARY KEY AUTOINCREMENT,
            episode_number INTEGER NOT NULL,
            name TEXT,
            duration INTEGER,
            video_url TEXT,
            season_id INTEGER NOT NULL,
            FOREIGN KEY (season_id) REFERENCES Season(season_id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Rating (
            rating_id INTEGER PRIMARY KEY AUTOINCREMENT,
            value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 10),
            date TEXT,
            user_id INTEGER NOT NULL,
            title_id INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
            FOREIGN KEY (title_id) REFERENCES Title(title_id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Review (
            review_id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT,
            date TEXT,
            status TEXT CHECK (status IN ('approved', 'pending', 'rejected')),
            user_id INTEGER NOT NULL,
            title_id INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
            FOREIGN KEY (title_id) REFERENCES Title(title_id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS View (
            view_id INTEGER PRIMARY KEY AUTOINCREMENT,
            view_date TEXT,
            user_id INTEGER NOT NULL,
            episode_id INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
            FOREIGN KEY (episode_id) REFERENCES Episode(episode_id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS WatchLater (
            watchlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
            added_date TEXT,
            user_id INTEGER NOT NULL,
            title_id INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
            FOREIGN KEY (title_id) REFERENCES Title(title_id) ON DELETE CASCADE
        )
    `);

    // ============ ЗАПОЛНЕНИЕ ДАННЫМИ ============

    // Пользователи с ролью
    const users = [
        [1, 'anna_weeb', 'anna@mail.ru', '$2a$10$eCkZ4Qx5Qx5Qx5Qx5Qx5Qu5Qx5Qx5Qx5Qx5Qx5Qx5Qx5Qx5Qx5', '2024-01-10', 'user'],
        [2, 'kenshin92', 'ken92@gmail.com', '$2a$10$eCkZ4Qx5Qx5Qx5Qx5Qx5Qu5Qx5Qx5Qx5Qx5Qx5Qx5Qx5Qx5Qx5', '2024-02-15', 'user'],
        [3, 'shinigami_lover', 'shini@ya.ru', '$2a$10$eCkZ4Qx5Qx5Qx5Qx5Qx5Qu5Qx5Qx5Qx5Qx5Qx5Qx5Qx5Qx5Qx5', '2024-03-20', 'user'],
        [4, 'admin', 'admin@anime.com', '$2a$10$eCkZ4Qx5Qx5Qx5Qx5Qx5Qu5Qx5Qx5Qx5Qx5Qx5Qx5Qx5Qx5Qx5', '2024-01-01', 'admin']
    ];
    users.forEach(u => {
        db.run('INSERT OR IGNORE INTO User (user_id, login, email, password, registration_date, role) VALUES (?, ?, ?, ?, ?, ?)', u);
    });

    // Тайтлы
    const titles = [
        [1, 'Attack on Titan', 2013, 9.0, 'Humans fight giant titans in a post-apocalyptic world', null, null, 'anime'],
        [2, 'Spy x Family', 2022, 8.5, 'A spy forms a fake family for a mission', null, null, 'anime'],
        [3, 'Demon Slayer', 2019, 8.8, 'A boy becomes a demon slayer to save his sister', null, null, 'anime'],
        [4, 'Jujutsu Kaisen', 2020, 8.7, 'A boy joins a secret organization of Jujutsu Sorcerers', null, null, 'anime'],
        [5, 'One Piece', 1999, 9.2, 'Pirates search for the ultimate treasure', null, null, 'anime'],
        [6, 'Your Name', 2016, 8.9, 'A boy and girl swap bodies', null, null, 'movie'],
        [7, 'Fullmetal Alchemist: Brotherhood', 2009, 9.1, 'Two brothers search for the Philosopher\'s Stone', null, null, 'anime'],
        [8, 'Death Note', 2006, 8.6, 'A genius student finds a notebook that kills people', null, null, 'anime'],
        [9, 'Naruto', 2002, 8.3, 'A young ninja dreams of becoming the Hokage', null, null, 'anime'],
        [10, 'My Hero Academia', 2016, 8.5, 'A boy without powers enrolls in a hero academy', null, null, 'anime'],
        [11, 'Tokyo Ghoul', 2014, 8.0, 'A college student becomes a half-ghoul', null, null, 'anime'],
        [12, 'Steins;Gate', 2011, 8.9, 'Scientists discover time travel', null, null, 'anime']
    ];
    titles.forEach(t => {
        db.run('INSERT OR IGNORE INTO Title (title_id, name, release_year, rating, description, poster_url, trailer_url, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', t);
    });

    // Жанры
    const genres = [
        [1, 'Action'], [2, 'Comedy'], [3, 'Drama'], [4, 'Fantasy'],
        [5, 'Romance'], [6, 'Sci-Fi'], [7, 'Thriller'], [8, 'Adventure']
    ];
    genres.forEach(g => {
        db.run('INSERT OR IGNORE INTO Genre (genre_id, name) VALUES (?, ?)', g);
    });

    // Связи тайтлов с жанрами
    const titleGenre = [
        [1, 1], [1, 3], [1, 7], [2, 1], [2, 2], [2, 5],
        [3, 1], [3, 3], [3, 4], [4, 1], [4, 4], [4, 7],
        [5, 1], [5, 3], [5, 8], [6, 3], [6, 5], [6, 6],
        [7, 1], [7, 3], [7, 4], [8, 1], [8, 7], [8, 8],
        [9, 1], [9, 3], [9, 8], [10, 1], [10, 2], [10, 4],
        [11, 1], [11, 3], [11, 7], [12, 3], [12, 6], [12, 8]
    ];
    titleGenre.forEach(tg => {
        db.run('INSERT OR IGNORE INTO Title_Genre (title_id, genre_id) VALUES (?, ?)', tg);
    });

    // Сезоны
    const seasons = [
        [1, 1, 1], [2, 2, 1], [3, 3, 1], [4, 1, 2],
        [5, 1, 3], [6, 1, 4], [7, 1, 5], [8, 2, 5],
        [9, 3, 5], [10, 1, 7], [11, 1, 9], [12, 1, 10]
    ];
    seasons.forEach(s => {
        db.run('INSERT OR IGNORE INTO Season (season_id, season_number, title_id) VALUES (?, ?, ?)', s);
    });

    // Эпизоды
    const episodes = [
        [1, 1, 'To You in 2000 Years', 24, null, 1],
        [2, 2, 'That Day', 24, null, 1],
        [3, 3, 'A Dim Light in the Darkness', 24, null, 1],
        [4, 1, 'Operation Strix', 24, null, 4],
        [5, 2, 'Secure a Wife', 24, null, 4],
        [6, 1, 'Cruelty', 26, null, 5],
        [7, 2, 'Trainer Sakonji Urokodaki', 26, null, 5],
        [8, 1, 'Ryomen Sukuna', 24, null, 6],
        [9, 1, 'Romance Dawn', 24, null, 7],
        [10, 2, 'The Straw Hat Pirates', 24, null, 8],
        [11, 1, 'The Philosopher\'s Stone', 24, null, 10],
        [12, 1, 'Rebirth', 24, null, 11],
        [13, 1, 'The Beginning of the End', 24, null, 12]
    ];
    episodes.forEach(e => {
        db.run('INSERT OR IGNORE INTO Episode (episode_id, episode_number, name, duration, video_url, season_id) VALUES (?, ?, ?, ?, ?, ?)', e);
    });

    // Отзывы
    const reviews = [
        [1, 'Amazing anime! A masterpiece of storytelling', '2024-03-01', 'approved', 1, 1],
        [2, 'Funny and heartwarming, great family show', '2024-03-02', 'pending', 2, 2],
        [3, 'Beautiful animation and emotional story', '2024-03-15', 'approved', 3, 1],
        [4, 'The best anime ever made!', '2024-03-20', 'approved', 1, 5],
        [5, 'Great action and characters', '2024-03-25', 'approved', 2, 3],
        [6, 'Mind-blowing plot!', '2024-04-01', 'approved', 4, 8],
        [7, 'A classic masterpiece', '2024-04-05', 'approved', 1, 7],
        [8, 'Could be better', '2024-04-10', 'approved', 3, 11]
    ];
    reviews.forEach(r => {
        db.run('INSERT OR IGNORE INTO Review (review_id, text, date, status, user_id, title_id) VALUES (?, ?, ?, ?, ?, ?)', r);
    });

    // Рейтинги
    const ratings = [
        [1, 10, '2024-03-01', 1, 1], [2, 8, '2024-03-02', 2, 2],
        [3, 9, '2024-03-20', 3, 1], [4, 10, '2024-03-21', 1, 5],
        [5, 7, '2024-03-22', 2, 3], [6, 9, '2024-04-01', 4, 8],
        [7, 10, '2024-04-05', 1, 7], [8, 6, '2024-04-10', 3, 11]
    ];
    ratings.forEach(r => {
        db.run('INSERT OR IGNORE INTO Rating (rating_id, value, date, user_id, title_id) VALUES (?, ?, ?, ?, ?)', r);
    });

    console.log('✅ База данных создана и заполнена!');
});

db.close();