from django.db import models


class EnterpriseContextMixin(models.Model):
    """
    اطلاعات زمینه سازمانی مشترک (Assessment Context) طبق مرحله ۱ استاندارد
    مستقر در سطح هسته برای استفاده در تمام ماژول‌ها و جلوگیری از افزونگی داده
    """
    project_name = models.CharField(max_length=200, blank=True, verbose_name="نام پروژه")
    department = models.CharField(max_length=150, blank=True, verbose_name="واحد سازمانی")
    site_location = models.CharField(max_length=200, blank=True, verbose_name="محل اجرای فعالیت")
    area = models.CharField(max_length=150, blank=True, verbose_name="بخش یا ناحیه عملیاتی")
    project_phase = models.CharField(max_length=100, blank=True, verbose_name="فاز پروژه")
    operation_type = models.CharField(max_length=100, blank=True, verbose_name="نوع عملیات")
    client_name = models.CharField(max_length=200, blank=True, verbose_name="نام کارفرما")
    contractor_name = models.CharField(max_length=200, blank=True, verbose_name="نام پیمانکار")
    traceability_chain_id = models.CharField(max_length=64, blank=True, verbose_name="شناسه زنجیره ردیابی")

    class Meta:
        abstract = True
