from flask import Blueprint, request, jsonify
from app.models import Board, User
from app.utils import token_required
import logging
logger = logging.getLogger(__name__)
board_bp = Blueprint('board', __name__)
@board_bp.route('/create', methods=['POST'])
@token_required
def create_board():
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'success': False, 'message': 'Board name is required'}), 400
        user_id = request.user_id
        logger.info(f"Creating board '{name}' for user_id: {user_id}, username: {request.username}")
        board_id, board_code = Board.create(name, user_id)
        if board_id:
            return jsonify({
                'success': True,
                'message': 'Board created successfully',
                'board': {
                    'id': board_id,
                    'code': board_code,
                    'name': name
                }
            }), 201
        return jsonify({'success': False, 'message': 'Failed to create board'}), 500
    except Exception as e:
        logger.error(f"Create board error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@board_bp.route('/join', methods=['POST'])
@token_required
def join_board():
    try:
        data = request.get_json()
        board_code = data.get('code', '').strip().upper()
        if not board_code:
            return jsonify({'success': False, 'message': 'Board code is required'}), 400
        user_id = request.user_id
        success, message = Board.join_board(board_code, user_id)
        if success:
            board = Board.find_by_code(board_code)
            return jsonify({
                'success': True,
                'message': message,
                'board': board.to_dict() if board else None
            }), 200
        return jsonify({'success': False, 'message': message}), 400
    except Exception as e:
        logger.error(f"Join board error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@board_bp.route('/my-boards', methods=['GET'])
@token_required
def get_my_boards():
    try:
        user_id = request.user_id
        boards = Board.get_user_boards(user_id)
        logger.info(f"Fetched {len(boards)} boards for user {user_id}")
        if boards and len(boards) > 0:
            logger.info(f"First board data: {boards[0]}")
        return jsonify({
            'success': True,
            'boards': boards
        }), 200
    except Exception as e:
        logger.error(f"Get boards error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@board_bp.route('/<board_code>', methods=['GET'])
@token_required
def get_board(board_code):
    try:
        board = Board.find_by_code(board_code)
        if not board:
            return jsonify({'success': False, 'message': 'Board not found'}), 404
        participants = Board.get_participants(board.id)
        user_id = request.user_id
        is_participant = any(p['id'] == user_id for p in participants)
        if not is_participant:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        board_data = board.to_dict()
        board_data['participants'] = participants
        return jsonify({
            'success': True,
            'board': board_data
        }), 200
    except Exception as e:
        logger.error(f"Get board error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@board_bp.route('/<board_code>/actions', methods=['GET'])
@token_required
def get_board_actions(board_code):
    try:
        board = Board.find_by_code(board_code)
        if not board:
            return jsonify({'success': False, 'message': 'Board not found'}), 404
        limit = request.args.get('limit', 1000, type=int)
        actions = Board.get_actions(board.id, limit)
        return jsonify({
            'success': True,
            'actions': actions
        }), 200
    except Exception as e:
        logger.error(f"Get actions error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@board_bp.route('/statistics', methods=['GET'])
@token_required
def get_statistics():
    try:
        user_id = request.user_id
        stats = User.get_statistics(user_id)
        logger.info(f"Statistics for user {user_id}: {stats}")
        return jsonify({
            'success': True,
            'statistics': stats
        }), 200
    except Exception as e:
        logger.error(f"Get statistics error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@board_bp.route('/<board_code>/delete', methods=['DELETE'])
@token_required
def delete_board(board_code):
    try:
        board = Board.find_by_code(board_code)
        if not board:
            return jsonify({'success': False, 'message': 'Board not found'}), 404
        user_id = request.user_id
        if board.owner_id != user_id:
            return jsonify({'success': False, 'message': 'Only owner can delete board'}), 403
        success = Board.delete_board(board_code)
        if success:
            return jsonify({
                'success': True,
                'message': 'Board deleted successfully'
            }), 200
        return jsonify({'success': False, 'message': 'Failed to delete board'}), 500
    except Exception as e:
        logger.error(f"Delete board error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@board_bp.route('/<board_code>/leave', methods=['DELETE'])
@token_required
def leave_board(board_code):
    try:
        board = Board.find_by_code(board_code)
        if not board:
            return jsonify({'success': False, 'message': 'Board not found'}), 404
        user_id = request.user_id
        if board.owner_id == user_id:
            return jsonify({'success': False, 'message': 'Owner cannot leave board. Delete it instead.'}), 403
        success = Board.leave_board_permanently(board_code, user_id)
        if success:
            return jsonify({
                'success': True,
                'message': 'Successfully left the board'
            }), 200
        return jsonify({'success': False, 'message': 'Failed to leave board'}), 500
    except Exception as e:
        logger.error(f"Leave board error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@board_bp.route('/<board_code>/state', methods=['GET'])
@token_required
def get_board_state(board_code):
    try:
        board = Board.find_by_code(board_code)
        if not board:
            return jsonify({'success': False, 'message': 'Board not found'}), 404
        from app.models.database import Database
        import json
        db = Database()
        db.connect()
        query = "SELECT action_data FROM board_actions WHERE board_id = %s AND action_type = 'snapshot' ORDER BY created_at DESC LIMIT 1"
        result = db.fetch_one(query, (board.id,))
        db.disconnect()
        if result and result.get('action_data'):
            try:
                state_data = json.loads(result['action_data']) if isinstance(result['action_data'], str) else result['action_data']
                return jsonify({
                    'success': True,
                    'state': state_data
                }), 200
            except json.JSONDecodeError:
                logger.warning(f"Failed to decode snapshot data for board {board_code}")
        return jsonify({'success': True, 'state': None}), 200
    except Exception as e:
        logger.error(f"Get board state error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
