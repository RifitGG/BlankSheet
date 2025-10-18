import mysql.connector
from mysql.connector import Error
from config import Config
import logging
logger = logging.getLogger(__name__)
class Database:
    def __init__(self):
        self.config = {
            'host': Config.DB_HOST,
            'user': Config.DB_USER,
            'password': Config.DB_PASSWORD,
            'database': Config.DB_NAME,
            'port': Config.DB_PORT,
            'autocommit': False
        }
        self.connection = None
        self.cursor = None
    def connect(self):
        try:
            self.connection = mysql.connector.connect(**self.config)
            self.cursor = self.connection.cursor(dictionary=True)
            logger.info("Database connection established")
            return True
        except Error as e:
            logger.error(f"Error connecting to database: {e}")
            return False
    def disconnect(self):
        if self.cursor:
            self.cursor.close()
        if self.connection and self.connection.is_connected():
            self.connection.close()
            logger.info("Database connection closed")
    def execute_query(self, query, params=None):
        try:
            if not self.connection or not self.connection.is_connected():
                self.connect()
            self.cursor.execute(query, params or ())
            self.connection.commit()
            return self.cursor
        except Error as e:
            logger.error(f"Error executing query: {e}")
            self.connection.rollback()
            return False
    def fetch_one(self, query, params=None):
        try:
            if not self.connection or not self.connection.is_connected():
                self.connect()
            self.cursor.execute(query, params or ())
            return self.cursor.fetchone()
        except Error as e:
            logger.error(f"Error fetching data: {e}")
            return None
    def fetch_all(self, query, params=None):
        try:
            if not self.connection or not self.connection.is_connected():
                self.connect()
            self.cursor.execute(query, params or ())
            return self.cursor.fetchall()
        except Error as e:
            logger.error(f"Error fetching data: {e}")
            return []
    def get_last_id(self):
        return self.cursor.lastrowid
def init_database():
    db = Database()
    if not db.connect():
        logger.error("Failed to connect to database")
        return False
    try:
        db.execute_query("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE,
                INDEX idx_username (username),
                INDEX idx_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        db.execute_query("""
            CREATE TABLE IF NOT EXISTS boards (
                id INT AUTO_INCREMENT PRIMARY KEY,
                board_code VARCHAR(10) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                owner_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                max_users INT DEFAULT 10,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_board_code (board_code),
                INDEX idx_owner (owner_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        db.execute_query("""
            CREATE TABLE IF NOT EXISTS board_participants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                board_id INT NOT NULL,
                user_id INT NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                is_online BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_board_user (board_id, user_id),
                INDEX idx_board (board_id),
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        db.execute_query("""
            CREATE TABLE IF NOT EXISTS board_actions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                board_id INT NOT NULL,
                user_id INT NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                action_data JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_board (board_id),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        db.execute_query("""
            CREATE TABLE IF NOT EXISTS user_statistics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNIQUE NOT NULL,
                boards_created INT DEFAULT 0,
                boards_joined INT DEFAULT 0,
                total_drawing_time INT DEFAULT 0,
                last_activity TIMESTAMP NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        logger.info("Database schema initialized successfully")
        db.disconnect()
        return True
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        db.disconnect()
        return False
