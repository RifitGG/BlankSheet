import random
import string
from datetime import datetime
from app.models.database import Database
import logging
logger = logging.getLogger(__name__)
class Board:
    def __init__(self, id=None, board_code=None, name=None, owner_id=None,
                 created_at=None, updated_at=None, is_active=True, max_users=10):
        self.id = id
        self.board_code = board_code
        self.name = name
        self.owner_id = owner_id
        self.created_at = created_at
        self.updated_at = updated_at
        self.is_active = is_active
        self.max_users = max_users
    @staticmethod
    def generate_board_code():
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            if not Board.find_by_code(code):
                return code
    @staticmethod
    def create(name, owner_id, max_users=10):
        db = Database()
        db.connect()
        board_code = Board.generate_board_code()
        query = "INSERT INTO boards (board_code, name, owner_id, max_users) VALUES (%s, %s, %s, %s)"
        cursor = db.execute_query(query, (board_code, name, owner_id, max_users))
        if cursor:
            board_id = cursor.lastrowid
            participant_query = "INSERT INTO board_participants (board_id, user_id, is_online) VALUES (%s, %s, TRUE)"
            db.execute_query(participant_query, (board_id, owner_id))
            stats_query = "UPDATE user_statistics SET boards_created = boards_created + 1 WHERE user_id = %s"
            db.execute_query(stats_query, (owner_id,))
            db.disconnect()
            logger.info(f"Board created: {board_code} by user {owner_id}")
            return board_id, board_code
        db.disconnect()
        return None, None
    @staticmethod
    def find_by_code(board_code):
        db = Database()
        db.connect()
        query = "SELECT * FROM boards WHERE board_code = %s AND is_active = TRUE"
        result = db.fetch_one(query, (board_code,))
        db.disconnect()
        if result:
            return Board(**result)
        return None
    @staticmethod
    def find_by_id(board_id):
        db = Database()
        db.connect()
        query = "SELECT * FROM boards WHERE id = %s AND is_active = TRUE"
        result = db.fetch_one(query, (board_id,))
        db.disconnect()
        if result:
            return Board(**result)
        return None
    @staticmethod
    def get_user_boards(user_id):
        db = Database()
        db.connect()
        query = """
            SELECT 
                b.*, 
                u.username as owner_name,
                COUNT(bp.user_id) as participant_count 
            FROM boards b 
            LEFT JOIN board_participants bp ON b.id = bp.board_id 
            LEFT JOIN users u ON b.owner_id = u.id
            WHERE (b.owner_id = %s OR b.id IN (
                SELECT board_id FROM board_participants WHERE user_id = %s
            )) AND b.is_active = TRUE 
            GROUP BY b.id 
            ORDER BY b.created_at DESC
        """
        results = db.fetch_all(query, (user_id, user_id))
        db.disconnect()
        return results
    @staticmethod
    def join_board(board_code, user_id):
        db = Database()
        db.connect()
        board_query = "SELECT b.*, COUNT(bp.user_id) as current_users FROM boards b LEFT JOIN board_participants bp ON b.id = bp.board_id WHERE b.board_code = %s AND b.is_active = TRUE GROUP BY b.id"
        board = db.fetch_one(board_query, (board_code,))
        if not board:
            db.disconnect()
            return False, "Board not found"
        if board['current_users'] >= board['max_users']:
            db.disconnect()
            return False, "Board is full"
        check_query = "SELECT * FROM board_participants WHERE board_id = %s AND user_id = %s"
        existing = db.fetch_one(check_query, (board['id'], user_id))
        if existing:
            db.disconnect()
            return True, "Already a participant"
        join_query = "INSERT INTO board_participants (board_id, user_id, is_online) VALUES (%s, %s, TRUE)"
        if db.execute_query(join_query, (board['id'], user_id)):
            stats_query = "UPDATE user_statistics SET boards_joined = boards_joined + 1 WHERE user_id = %s"
            db.execute_query(stats_query, (user_id,))
            db.disconnect()
            logger.info(f"User {user_id} joined board {board_code}")
            return True, "Successfully joined"
        db.disconnect()
        return False, "Failed to join board"
    @staticmethod
    def get_participants(board_id):
        db = Database()
        db.connect()
        query = "SELECT u.id, u.username, u.email, bp.is_online, bp.joined_at, bp.last_active FROM board_participants bp JOIN users u ON bp.user_id = u.id WHERE bp.board_id = %s ORDER BY bp.joined_at"
        results = db.fetch_all(query, (board_id,))
        db.disconnect()
        return results
    @staticmethod
    def update_participant_status(board_id, user_id, is_online):
        db = Database()
        db.connect()
        query = "UPDATE board_participants SET is_online = %s, last_active = CURRENT_TIMESTAMP WHERE board_id = %s AND user_id = %s"
        result = db.execute_query(query, (is_online, board_id, user_id))
        db.disconnect()
        return result
    @staticmethod
    def save_action(board_id, user_id, action_type, action_data):
        db = Database()
        db.connect()
        import json
        query = "INSERT INTO board_actions (board_id, user_id, action_type, action_data) VALUES (%s, %s, %s, %s)"
        result = db.execute_query(query, (board_id, user_id, action_type, json.dumps(action_data)))
        db.disconnect()
        return result
    @staticmethod
    def get_actions(board_id, limit=100):
        db = Database()
        db.connect()
        query = "SELECT ba.*, u.username FROM board_actions ba JOIN users u ON ba.user_id = u.id WHERE ba.board_id = %s ORDER BY ba.created_at DESC LIMIT %s"
        results = db.fetch_all(query, (board_id, limit))
        db.disconnect()
        return results
    @staticmethod
    def delete_board(board_code):
        db = Database()
        db.connect()
        query = "UPDATE boards SET is_active = FALSE WHERE board_code = %s"
        result = db.execute_query(query, (board_code,))
        db.disconnect()
        if result:
            logger.info(f"Board deleted: {board_code}")
            return True
        return False
    @staticmethod
    def leave_board_permanently(board_code, user_id):
        db = Database()
        db.connect()
        board_query = "SELECT id FROM boards WHERE board_code = %s"
        board = db.fetch_one(board_query, (board_code,))
        if not board:
            db.disconnect()
            return False
        delete_query = "DELETE FROM board_participants WHERE board_id = %s AND user_id = %s"
        result = db.execute_query(delete_query, (board['id'], user_id))
        db.disconnect()
        if result:
            logger.info(f"User {user_id} left board {board_code}")
            return True
        return False
    def to_dict(self):
        return {
            'id': self.id,
            'board_code': self.board_code,
            'name': self.name,
            'owner_id': self.owner_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_active': self.is_active,
            'max_users': self.max_users
        }
