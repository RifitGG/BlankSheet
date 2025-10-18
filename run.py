from app import create_app
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
if __name__ == '__main__':
    logger.info("Starting Whiteboard application...")
    try:
        app, socketio = create_app()
        socketio.run(
            app,
            host=app.config['HOST'],
            port=app.config['PORT'],
            debug=app.config['DEBUG']
        )
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise
