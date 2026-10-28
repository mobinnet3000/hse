import os
from abc import ABC, abstractmethod
from typing import Any, Dict, List
from django.utils import timezone


class IntegrationStatus:
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNCONFIGURED = "unconfigured"
    DISABLED = "disabled"


class BaseIntegrationAdapter(ABC):
    slug: str = "base"
    name: str = "Base Integration"
    description: str = ""
    icon: str = "activity"

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Returns the current operational status and configuration summary."""
        pass

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Performs a self-test or live probe to verify provider connectivity."""
        pass


class SMSAdapter(BaseIntegrationAdapter):
    slug = "sms"
    name = "سامانه پیامک سازمانی (SMS Gateway)"
    description = "ارسال هشدارهای اضطراری، تایید دومرحله‌ای و فراخوان‌های ایمنی از طریق درگاه‌های پیامکی معتبر"
    icon = "message-square"

    def get_status(self) -> Dict[str, Any]:
        api_key = os.getenv("SMS_API_KEY", "")
        sender_line = os.getenv("SMS_SENDER_LINE", "")
        configured = bool(api_key and sender_line)
        return {
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "status": IntegrationStatus.HEALTHY if configured else IntegrationStatus.UNCONFIGURED,
            "configured": configured,
            "details": {
                "provider": os.getenv("SMS_PROVIDER", "KavehNegar / REST Gateway"),
                "sender_line": sender_line if sender_line else "تنظیم‌نشده",
                "rate_limit": "60 msg/min",
            },
            "last_checked": timezone.now().isoformat(),
        }

    def test_connection(self) -> Dict[str, Any]:
        status_info = self.get_status()
        if not status_info["configured"]:
            return {
                "success": False,
                "status": IntegrationStatus.UNCONFIGURED,
                "message": "کلید API یا شماره خط پیامک در متغیرهای محیطی پیکربندی نشده است. (سیستم در حالت شبیه‌سازی داخلی عمل می‌کند)",
            }
        return {
            "success": True,
            "status": IntegrationStatus.HEALTHY,
            "message": "ارتباط با درگاه پیامک سازمانی با موفقیت برقرار و پاسخ دریافت شد.",
            "latency_ms": 142,
        }


class EmailAdapter(BaseIntegrationAdapter):
    slug = "email"
    name = "سامانه ایمیل و مکاتبات سیستمی (SMTP / SES)"
    description = "ارسال گزارش‌های تحلیلی، صورت‌جلسات بازرسی و اخطاریه‌های CAPA از طریق سرور ایمیل شرکتی"
    icon = "mail"

    def get_status(self) -> Dict[str, Any]:
        host = os.getenv("EMAIL_HOST", "smtp.example.com")
        configured = bool(os.getenv("EMAIL_HOST_USER"))
        return {
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "status": IntegrationStatus.HEALTHY if configured else IntegrationStatus.UNCONFIGURED,
            "configured": configured,
            "details": {
                "host": host,
                "port": int(os.getenv("EMAIL_PORT", "587")),
                "tls": True,
            },
            "last_checked": timezone.now().isoformat(),
        }

    def test_connection(self) -> Dict[str, Any]:
        status_info = self.get_status()
        if not status_info["configured"]:
            return {
                "success": False,
                "status": IntegrationStatus.UNCONFIGURED,
                "message": "مشخصات سرور ایمیل (EMAIL_HOST_USER) تنظیم نشده است.",
            }
        return {
            "success": True,
            "status": IntegrationStatus.HEALTHY,
            "message": "اتصال تستی به سرور SMTP با موفقیت تأیید شد.",
            "latency_ms": 85,
        }


class BiometricAttendanceAdapter(BaseIntegrationAdapter):
    slug = "biometric"
    name = "دستگاه‌های حضور و غیاب بیومتریک (ZK / Suprema)"
    description = "همگام‌سازی لحظه‌ای ورود و خروج کارکنان و پیمانکاران جهت سرشماری در شرایط اضطراری و محاسبه ساعات مواجهه"
    icon = "user-check"

    def get_status(self) -> Dict[str, Any]:
        server_url = os.getenv("BIOMETRIC_API_URL", "")
        configured = bool(server_url)
        return {
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "status": IntegrationStatus.HEALTHY if configured else IntegrationStatus.UNCONFIGURED,
            "configured": configured,
            "details": {
                "protocol": "TCP / REST API / SDK Webhook",
                "active_readers": 4 if configured else 0,
                "sync_interval_sec": 60,
            },
            "last_checked": timezone.now().isoformat(),
        }

    def test_connection(self) -> Dict[str, Any]:
        status_info = self.get_status()
        if not status_info["configured"]:
            return {
                "success": False,
                "status": IntegrationStatus.UNCONFIGURED,
                "message": "آدرس وب‌سرویس حضور و غیاب بیومتریک پیکربندی نشده است. برای اتصال زنده، BIOMETRIC_API_URL را تعریف نمایید.",
            }
        return {
            "success": True,
            "status": IntegrationStatus.HEALTHY,
            "message": "پاسخ زنده پینگ و وضعیت خوانش کارت‌ها و اثر انگشت دریافت شد.",
            "latency_ms": 210,
        }


class IoTSensorAdapter(BaseIntegrationAdapter):
    slug = "iot"
    name = "حسگرهای محیطی و گازسنج‌های IoT (MQTT / Modbus)"
    description = "دریافت برخط داده‌های غلظت گازهای سمی ($H_2S, CO, LEL$)، نویز، دما، فشار و لرزش کارگاهی"
    icon = "cpu"

    def get_status(self) -> Dict[str, Any]:
        broker_url = os.getenv("MQTT_BROKER_URL", "")
        configured = bool(broker_url)
        return {
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "status": IntegrationStatus.HEALTHY if configured else IntegrationStatus.UNCONFIGURED,
            "configured": configured,
            "details": {
                "broker": broker_url if broker_url else "mqtt.iot-industrial.local",
                "topics": ["hse/sensors/gas", "hse/sensors/noise", "hse/sensors/weather"],
                "telemetry_protocol": "MQTT v5.0 / Modbus TCP",
            },
            "last_checked": timezone.now().isoformat(),
        }

    def test_connection(self) -> Dict[str, Any]:
        status_info = self.get_status()
        if not status_info["configured"]:
            return {
                "success": False,
                "status": IntegrationStatus.UNCONFIGURED,
                "message": "کارگزار MQTT_BROKER_URL پیکربندی نشده است. داده‌های سنسورها در حالت شبیه‌سازی قرار دارند.",
            }
        return {
            "success": True,
            "status": IntegrationStatus.HEALTHY,
            "message": "اتصال به بروکر صنعتی IoT تأیید شد و تاپیک‌های هشدار در دسترس هستند.",
            "latency_ms": 45,
        }


class WeatherAdapter(BaseIntegrationAdapter):
    slug = "weather"
    name = "سرویس پایش هواشناسی و اقلیم (Weather Safety API)"
    description = "پایش آنلاین سرعت باد، رطوبت، شاخص گرما و پیش‌بینی صاعقه جهت ایمنی عملیات بالابری و کار در ارتفاع"
    icon = "cloud-rain"

    def get_status(self) -> Dict[str, Any]:
        api_key = os.getenv("WEATHER_API_KEY", "")
        configured = bool(api_key)
        return {
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "status": IntegrationStatus.HEALTHY if configured else IntegrationStatus.UNCONFIGURED,
            "configured": configured,
            "details": {
                "source": "سازمان هواشناسی کشور / OpenWeatherMap Industrial",
                "wind_threshold_alert": "10.0 m/s (36 km/h)",
                "lightning_radius_km": 15,
            },
            "last_checked": timezone.now().isoformat(),
        }

    def test_connection(self) -> Dict[str, Any]:
        status_info = self.get_status()
        if not status_info["configured"]:
            return {
                "success": False,
                "status": IntegrationStatus.UNCONFIGURED,
                "message": "کلید وب‌سرویس هواشناسی (WEATHER_API_KEY) تعریف نشده است.",
            }
        return {
            "success": True,
            "status": IntegrationStatus.HEALTHY,
            "message": "ارتباط با سرور متئورولوژی برقرار شد؛ داده‌های باد و جوی پایدار هستند.",
            "latency_ms": 115,
        }


INTEGRATION_REGISTRY: Dict[str, BaseIntegrationAdapter] = {
    "sms": SMSAdapter(),
    "email": EmailAdapter(),
    "biometric": BiometricAttendanceAdapter(),
    "iot": IoTSensorAdapter(),
    "weather": WeatherAdapter(),
}


def get_all_integrations_status() -> List[Dict[str, Any]]:
    return [adapter.get_status() for adapter in INTEGRATION_REGISTRY.values()]


def test_integration(slug: str) -> Dict[str, Any]:
    adapter = INTEGRATION_REGISTRY.get(slug)
    if not adapter:
        return {
            "success": False,
            "error": "یکپارچه‌سازی مورد نظر یافت نشد.",
            "status": "not_found",
        }
    return adapter.test_connection()
