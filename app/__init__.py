from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from config import config
from app.models import init_database, Board
from app.routes import auth_bp, board_bp, main_bp
from app.utils import decode_token
import logging
import os

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = None
socketio = None
active_connections = {}

def create_app():
    global app, socketio
    app = Flask(__name__)
    app.config.from_object(config['development'])
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', logger=True, engineio_logger=True)
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(board_bp, url_prefix='/api/board')
    app.register_blueprint(main_bp)
    upload_folder = app.config['UPLOAD_FOLDER']
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)
    if not init_database():
        logger.warning("Database initialization failed")
    register_socketio_handlers()
    logger.info("Flask app and Socket.IO initialized")
    return app, socketio

def register_socketio_handlers():
    @socketio.on('connect')
    def handle_connect():
        from flask import request
        logger.info(f"Client connected: {request.sid}")
        emit('connected', {'message': 'Connected'})
    
    @socketio.on('disconnect')
    def handle_disconnect():
        from flask import request
        sid = request.sid
        logger.info(f"Client disconnected: {sid}")
        for board_code, users in list(active_connections.items()):
            for user_id, user_sid in list(users.items()):
                if user_sid == sid:
                    board = Board.find_by_code(board_code)
                    if board:
                        Board.update_participant_status(board.id, user_id, False)
                        del active_connections[board_code][user_id]
                        emit('user_left', {'user_id': user_id}, room=board_code)
                    if not active_connections[board_code]:
                        del active_connections[board_code]
    
    @socketio.on('join_board')
    def handle_join_board(data):
        from flask import request
        try:
            board_code = data.get('board_code')
            token = data.get('token')
            logger.info(f"JOIN: {board_code}")
            
            if not board_code or not token:
                emit('error', {'message': 'Missing data'})
                return
            
            payload = decode_token(token)
            if not payload:
                emit('error', {'message': 'Invalid token'})
                return
            
            user_id = payload['user_id']
            username = payload['username']
            board = Board.find_by_code(board_code)
            
            if not board:
                emit('error', {'message': 'Board not found'})
                return
            
            participants = Board.get_participants(board.id)
            if not any(p['id'] == user_id for p in participants):
                emit('error', {'message': 'Not a participant'})
                return
            
            join_room(board_code)
            if board_code not in active_connections:
                active_connections[board_code] = {}
            active_connections[board_code][user_id] = request.sid
            Board.update_participant_status(board.id, user_id, True)
            
            emit('board_joined', {
                'board': board.to_dict(),
                'user_id': user_id,
                'username': username
            })
            
            emit('user_joined', {
                'user_id': user_id,
                'username': username
            }, room=board_code, skip_sid=request.sid)
            
            logger.info(f"User {username} joined {board_code}")
        except Exception as e:
            logger.error(f"JOIN error: {e}")
            emit('error', {'message': 'Failed to join'})
    
    @socketio.on('draw')
    def handle_draw(data):
        from flask import request
        try:
            board_code = data.get('board_code')
            action_data = data.get('data')
            token = data.get('token')
            
            logger.info(f"DRAW from {request.sid} to {board_code}")
            
            if not board_code or not action_data or not token:
                logger.error("DRAW: Missing data")
                return
            
            payload = decode_token(token)
            if not payload:
                logger.error("DRAW: Invalid token")
                return
            
            emit('draw', {
                'user_id': payload['user_id'],
                'username': payload['username'],
                'data': action_data
            }, room=board_code, skip_sid=request.sid)
            
            logger.info(f"DRAW broadcasted to {board_code}")
        except Exception as e:
            logger.error(f"DRAW error: {e}")
    
    @socketio.on('clear')
    def handle_clear(data):
        board_code = data.get('board_code')
        token = data.get('token')
        if not board_code or not token:
            return
        payload = decode_token(token)
        if not payload:
            return
        emit('clear', {
            'user_id': payload['user_id'],
            'username': payload['username']
        }, room=board_code, skip_sid=request.sid)
    
    @socketio.on('add_text')
    def handle_add_text(data):
        board_code = data.get('board_code')
        text_data = data.get('data')
        token = data.get('token')
        if not all([board_code, text_data, token]):
            return
        payload = decode_token(token)
        if not payload:
            return
        emit('add_text', {
            'user_id': payload['user_id'],
            'username': payload['username'],
            'data': text_data
        }, room=board_code, skip_sid=request.sid)
    
    @socketio.on('add_image')
    def handle_add_image(data):
        board_code = data.get('board_code')
        image_data = data.get('data')
        token = data.get('token')
        if not all([board_code, image_data, token]):
            return
        payload = decode_token(token)
        if not payload:
            return
        emit('add_image', {
            'user_id': payload['user_id'],
            'username': payload['username'],
            'data': image_data
        }, room=board_code, skip_sid=request.sid)
    
    @socketio.on('draw_shape')
    def handle_draw_shape(data):
        board_code = data.get('board_code')
        shape_data = data.get('data')
        token = data.get('token')
        if not all([board_code, shape_data, token]):
            return
        payload = decode_token(token)
        if not payload:
            return
        emit('draw_shape', {
            'user_id': payload['user_id'],
            'username': payload['username'],
            'data': shape_data
        }, room=board_code, skip_sid=request.sid)
    
    @socketio.on('move_object')
    def handle_move_object(data):
        board_code = data.get('board_code')
        move_data = data.get('data')
        token = data.get('token')
        if not all([board_code, move_data, token]):
            return
        payload = decode_token(token)
        if not payload:
            return
        emit('move_object', {
            'user_id': payload['user_id'],
            'username': payload['username'],
            'data': move_data
        }, room=board_code, skip_sid=request.sid)
    
    @socketio.on('resize_object')
    def handle_resize_object(data):
        board_code = data.get('board_code')
        resize_data = data.get('data')
        token = data.get('token')
        if not all([board_code, resize_data, token]):
            return
        payload = decode_token(token)
        if not payload:
            return
        emit('resize_object', {
            'user_id': payload['user_id'],
            'username': payload['username'],
            'data': resize_data
        }, room=board_code, skip_sid=request.sid)
    
    @socketio.on('save_snapshot')
    def handle_save_snapshot(data):
        try:
            board_code = data.get('board_code')
            snapshot_data = data.get('data')
            token = data.get('token')
            
            logger.info(f"SAVE snapshot: {board_code}")
            
            if not all([board_code, snapshot_data, token]):
                logger.warning("SAVE: Missing data")
                return {'success': False, 'error': 'Missing data'}
            
            payload = decode_token(token)
            if not payload:
                logger.warning("SAVE: Invalid token")
                return {'success': False, 'error': 'Invalid token'}
            
            board = Board.find_by_code(board_code)
            if board:
                Board.save_action(board.id, payload['user_id'], 'snapshot', snapshot_data)
                logger.info(f"Snapshot saved for {board_code}")
                return {'success': True, 'message': 'Saved'}
            else:
                logger.warning("SAVE: Board not found")
                return {'success': False, 'error': 'Board not found'}
        except Exception as e:
            logger.error(f"SAVE error: {e}")
            return {'success': False, 'error': str(e)}
