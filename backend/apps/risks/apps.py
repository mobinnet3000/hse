from django.apps import AppConfig


class RisksConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.risks"

    def ready(self):
        import apps.risks.listeners  # noqa: F401
