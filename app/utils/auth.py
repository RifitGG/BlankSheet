import jwt
import datetime
from functools import wraps
from flask import request, jsonify
from config import Config
import logging
logger = logging.getLogger(__name__)
def generate_token(user_id, username):
    try:
        payload = {
            'user_id': user_id,
            'username': username,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=Config.JWT_EXPIRATION_DELTA),
            'iat': datetime.datetime.utcnow()
        }
        token = jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm='HS256')
        return token
    except Exception as e:
        logger.error(f"Error generating token: {e}")
        return None
def decode_token(token):
    try:
        payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
                logger.info(f"Token from Authorization header: {token[:20]}...")
            except IndexError:
                return jsonify({'success': False, 'message': 'Invalid token format'}), 401
        if not token:
            token = request.cookies.get('token')
            if token:
                logger.info(f"Token from cookie: {token[:20]}...")
            else:
                logger.warning("No token found in headers or cookies")
        if not token:
            return jsonify({'success': False, 'message': 'Token is missing'}), 401
        payload = decode_token(token)
        if not payload:
            logger.warning("Token decode failed")
            return jsonify({'success': False, 'message': 'Token is invalid or expired'}), 401
        request.user_id = payload['user_id']
        request.username = payload['username']
        logger.info(f"Token validated for user_id: {request.user_id}, username: {request.username}")
        return f(*args, **kwargs)
    return decorated
def validate_email(email):
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None
def validate_username(username):
    import re
    pattern = r'^[a-zA-Z0-9_]{3,50}$'
    return re.match(pattern, username) is not None
def validate_password(password):
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    return True, "Valid"
