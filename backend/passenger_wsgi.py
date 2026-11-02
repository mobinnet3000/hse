import os
import sys

# اضافه کردن مسیر پروژه به sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# مشخص کردن تنظیمات جنگو
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# راه‌اندازی WSGI برای Phusion Passenger در سی‌پنل
from config.wsgi import application
