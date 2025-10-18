import os
from dotenv import load_dotenv
load_dotenv()
class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_NAME = os.getenv('DB_NAME', 'whiteboard_db')
    DB_PORT = int(os.getenv('DB_PORT', 3306))
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5000))
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'app/static/uploads')
    ALLOWED_EXTENSIONS = set(os.getenv('ALLOWED_EXTENSIONS', 'png,jpg,jpeg,gif').split(','))
    SESSION_TIMEOUT = int(os.getenv('SESSION_TIMEOUT', 3600))
    MAX_USERS_PER_BOARD = int(os.getenv('MAX_USERS_PER_BOARD', 10))
    JWT_EXPIRATION_DELTA = 86400  
class DevelopmentConfig(Config):
    DEBUG = True
    FLASK_ENV = 'development'
class ProductionConfig(Config):
    DEBUG = False
    FLASK_ENV = 'production'
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
