from flask import Blueprint, render_template, send_from_directory
import logging
import os
logger = logging.getLogger(__name__)
main_bp = Blueprint('main', __name__)
@main_bp.route('/')
def index():
    return render_template('index.html')
@main_bp.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')
@main_bp.route('/board/<board_code>')
def board(board_code):
    return render_template('board.html', board_code=board_code)
@main_bp.route('/debug')
def debug_token():
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return send_from_directory(root_dir, 'debug_token.html')
