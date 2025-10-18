import sys
import logging
from app.models import init_database
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
def main():
    logger.info("Starting database initialization...")
    try:
        if init_database():
            logger.info("✓ Database initialized successfully!")
            logger.info("You can now run the application with: python run.py")
            return 0
        else:
            logger.error("✗ Database initialization failed")
            logger.error("Please check your database connection settings in .env file")
            return 1
    except Exception as e:
        logger.error(f"✗ Error during initialization: {e}")
        return 1
if __name__ == '__main__':
    sys.exit(main())
