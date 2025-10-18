from flask import Blueprint, request, jsonify, make_response
from app.models import User
from app.utils import generate_token, validate_email, validate_username, validate_password
import logging
logger = logging.getLogger(__name__)
auth_bp = Blueprint('auth', __name__)
@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        if not username or not email or not password:
            return jsonify({'success': False, 'message': 'All fields are required'}), 400
        if not validate_username(username):
            return jsonify({'success': False, 'message': 'Invalid username format (3-50 alphanumeric characters)'}), 400
        if not validate_email(email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'success': False, 'message': message}), 400
        if User.find_by_username(username):
            return jsonify({'success': False, 'message': 'Username already exists'}), 409
        if User.find_by_email(email):
            return jsonify({'success': False, 'message': 'Email already exists'}), 409
        user_id = User.create(username, email, password)
        if user_id:
            token = generate_token(user_id, username)
            response = make_response(jsonify({
                'success': True,
                'message': 'Registration successful',
                'token': token,
                'user': {
                    'id': user_id,
                    'username': username,
                    'email': email
                }
            }))
            response.set_cookie('token', token, httponly=False, max_age=86400, samesite='Lax')
            logger.info(f"User registered: {username}")
            return response, 201
        return jsonify({'success': False, 'message': 'Registration failed'}), 500
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')
        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password are required'}), 400
        user = User.find_by_username(username)
        if not user:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
        if not User.verify_password(password, user.password_hash):
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
        User.update_last_login(user.id)
        token = generate_token(user.id, user.username)
        if not token:
            logger.error(f"Failed to generate token for user: {username}")
            return jsonify({'success': False, 'message': 'Token generation failed'}), 500
        response = make_response(jsonify({
            'success': True,
            'message': 'Login successful',
            'token': token,
            'user': user.to_dict()
        }))
        response.set_cookie('token', token, httponly=False, max_age=86400, samesite='Lax')
        logger.info(f"User logged in: {username}, user_id: {user.id}, token set in cookie")
        return response, 200
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@auth_bp.route('/logout', methods=['POST'])
def logout():
    try:
        response = make_response(jsonify({
            'success': True,
            'message': 'Logout successful'
        }))
        response.set_cookie('token', '', expires=0)
        return response, 200
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
@auth_bp.route('/verify', methods=['GET'])
def verify():
    try:
        token = request.cookies.get('token')
        if not token:
            return jsonify({'success': False, 'message': 'No token provided'}), 401
        from app.utils import decode_token
        payload = decode_token(token)
        if not payload:
            return jsonify({'success': False, 'message': 'Invalid or expired token'}), 401
        user = User.find_by_id(payload['user_id'])
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        return jsonify({
            'success': True,
            'user': user.to_dict()
        }), 200
    except Exception as e:
        logger.error(f"Verify error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
