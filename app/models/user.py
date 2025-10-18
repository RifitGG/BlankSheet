import bcrypt
from datetime import datetime
from app.models.database import Database
import logging
logger = logging.getLogger(__name__)
class User:
    def __init__(self, id=None, username=None, email=None, password_hash=None, 
                 created_at=None, last_login=None, is_active=True):
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.created_at = created_at
        self.last_login = last_login
        self.is_active = is_active
    @staticmethod
    def hash_password(password):
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    @staticmethod
    def verify_password(password, password_hash):
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    @staticmethod
    def create(username, email, password):
        db = Database()
        db.connect()
        password_hash = User.hash_password(password)
        query = "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)"
        if db.execute_query(query, (username, email, password_hash)):
            user_id = db.get_last_id()
            stats_query = "INSERT INTO user_statistics (user_id) VALUES (%s)"
            db.execute_query(stats_query, (user_id,))
            db.disconnect()
            logger.info(f"User created: {username}")
            return user_id
        db.disconnect()
        return None
    @staticmethod
    def find_by_username(username):
        db = Database()
        db.connect()
        query = "SELECT * FROM users WHERE username = %s AND is_active = TRUE"
        result = db.fetch_one(query, (username,))
        db.disconnect()
        if result:
            return User(**result)
        return None
    @staticmethod
    def find_by_email(email):
        db = Database()
        db.connect()
        query = "SELECT * FROM users WHERE email = %s AND is_active = TRUE"
        result = db.fetch_one(query, (email,))
        db.disconnect()
        if result:
            return User(**result)
        return None
    @staticmethod
    def find_by_id(user_id):
        db = Database()
        db.connect()
        query = "SELECT * FROM users WHERE id = %s AND is_active = TRUE"
        result = db.fetch_one(query, (user_id,))
        db.disconnect()
        if result:
            return User(**result)
        return None
    @staticmethod
    def update_last_login(user_id):
        db = Database()
        db.connect()
        query = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = %s"
        result = db.execute_query(query, (user_id,))
        db.disconnect()
        return result
    @staticmethod
    def get_statistics(user_id):
        db = Database()
        db.connect()
        query = """
            SELECT 
                us.*,
                (SELECT COUNT(*) FROM boards WHERE owner_id = %s AND is_active = TRUE) as boards_created,
                (SELECT COUNT(*) FROM boards WHERE owner_id = %s AND is_active = TRUE) as owned_boards,
                (SELECT COUNT(DISTINCT bp.board_id) 
                 FROM board_participants bp 
                 JOIN boards b ON bp.board_id = b.id 
                 WHERE bp.user_id = %s AND b.owner_id != %s AND b.is_active = TRUE) as boards_joined,
                (SELECT COUNT(DISTINCT bp.board_id) 
                 FROM board_participants bp 
                 JOIN boards b ON bp.board_id = b.id 
                 WHERE bp.user_id = %s AND b.is_active = TRUE) as participated_boards,
                (SELECT MAX(last_active) FROM board_participants WHERE user_id = %s) as last_activity
            FROM user_statistics us 
            WHERE us.user_id = %s
        """
        result = db.fetch_one(query, (user_id, user_id, user_id, user_id, user_id, user_id, user_id))
        db.disconnect()
        return result or {}
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'is_active': self.is_active
        }
