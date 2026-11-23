from django.core.exceptions import ValidationError
from django.db import models


class Survey(models.Model):
    class SurveyType(models.TextChoices):
        SURVEY = "survey", "پرسشنامه عمومی HSE"
        SAFETY_CLIMATE = "safety_climate", "سنجش جو و فرهنگ ایمنی (Safety Climate)"
        EXAM = "exam", "آزمون ارزیابی دانش فنی و صلاحیت"
        TRAINING_QUIZ = "training_quiz", "کوئیز پایان دوره آموزشی"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="surveys",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    survey_type = models.CharField(max_length=30, choices=SurveyType.choices, default=SurveyType.SURVEY)
    is_anonymous = models.BooleanField(
        default=False,
        help_text="در حالت ناشناس، مشخصات فردی پاسخ‌دهنده هرگز ثبت نشده و هویت او کاملاً مستقل و غیرقابل رهگیری است.",
    )
    pass_percentage = models.FloatField(default=70.0, help_text="حد نصاب قبولی در آزمون‌ها (درصد)")
    time_limit_minutes = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.get_survey_type_display()})"


class SurveyQuestion(models.Model):
    class QuestionType(models.TextChoices):
        SINGLE_CHOICE = "single_choice", "تک‌گزینه‌ای (چهارگزینه‌ای)"
        MULTI_CHOICE = "multi_choice", "چندگزینه‌ای"
        BOOLEAN = "boolean", "صحیح / غلط"
        RATING_SCALE = "rating_scale", "مقیاس لیکرت (۱ تا ۵)"
        TEXT = "text", "پاسخ تشریحی کوتاه"
        NUMERIC = "numeric", "پاسخ عددی"

    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="questions")
    question_text = models.TextField()
    question_type = models.CharField(max_length=30, choices=QuestionType.choices, default=QuestionType.SINGLE_CHOICE)
    points = models.FloatField(default=1.0)
    order = models.PositiveIntegerField(default=1)
    is_required = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"Q{self.order}: {self.question_text[:50]}"


class SurveyQuestionOption(models.Model):
    question = models.ForeignKey(SurveyQuestion, on_delete=models.CASCADE, related_name="options")
    option_text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False, help_text="پاسخ صحیح (برای آزمون)")
    score_weight = models.FloatField(default=0.0, help_text="وزن نمره یا امتیاز لیکرت")
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.option_text


class SurveySubmission(models.Model):
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="submissions")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE)
    # CRITICAL SECURITY RULE: If survey.is_anonymous is True, respondent MUST BE NULL
    respondent = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="survey_submissions",
    )
    department = models.CharField(max_length=150, blank=True)
    site_name = models.CharField(max_length=150, blank=True)
    total_score = models.FloatField(default=0.0)
    max_possible_score = models.FloatField(default=0.0)
    percentage_score = models.FloatField(default=0.0)
    passed = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-submitted_at"]

    def clean(self):
        if self.survey.is_anonymous and self.respondent is not None:
            raise ValidationError({"respondent": "در نظرسنجی‌های ناشناس، ثبت هویت پاسخ‌دهنده اکیداً ممنوع است."})


class SurveyAnswer(models.Model):
    submission = models.ForeignKey(SurveySubmission, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(SurveyQuestion, on_delete=models.CASCADE)
    selected_options = models.ManyToManyField(SurveyQuestionOption, blank=True)
    text_answer = models.TextField(blank=True)
    numeric_answer = models.FloatField(null=True, blank=True)
    score_awarded = models.FloatField(default=0.0)

    def __str__(self):
        return f"Answer to {self.question_id}"


from apps.core.mixins import EnterpriseContextMixin
from apps.core.traceability import TraceabilityChain, TraceabilityNode

class BehaviorObservation(EnterpriseContextMixin, models.Model):
    """
    ماژول فرهنگ ایمنی: سیستم پایش و مربی‌گری رفتار ایمن (BBS - Behavior-Based Safety)
    ثبت رفتارهای ایمن، رفتارهای پرخطر، گفت‌وگوی انگیزشی و مربی‌گری در میدان
    """
    class ObservationType(models.TextChoices):
        SAFE = "safe", "رفتار ایمن و تحسین‌شده"
        AT_RISK = "at_risk", "رفتار پرخطر / ناایمن"

    class Category(models.TextChoices):
        PPE = "ppe", "کاربرد صحیح تجهیزات حفاظت فردی"
        BODY_POSITION = "body_position", "ارگونومی، خط آتش و موقعیت بدنی"
        TOOLS = "tools", "استفاده صحیح از ابزار و ماشین‌آلات"
        PROCEDURES = "procedures", "پیروی از دستورالعمل‌ها و مجوز کار (PTW)"
        HOUSEKEEPING = "housekeeping", "نظم، انضباط و ۵S کارگاهی"
        COMMUNICATION = "communication", "ارتباطات گروهی و هشیاری موقعیتی"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="behavior_observations",
        verbose_name="سازمان",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="behavior_observations",
        verbose_name="محل مشاهده",
    )
    observer = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="observations_logged",
        verbose_name="مشاهده‌گر / مربی",
    )
    observation_date = models.DateField(verbose_name="تاریخ مشاهده")
    observation_type = models.CharField(
        max_length=32,
        choices=ObservationType.choices,
        default=ObservationType.SAFE,
        verbose_name="نوع رفتار",
    )
    category = models.CharField(
        max_length=32,
        choices=Category.choices,
        default=Category.PPE,
        verbose_name="دسته رفتاری",
    )
    description = models.TextField(verbose_name="شرح رفتار مشاهده‌شده")
    immediate_coaching = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="بازخورد آنی و گفت‌وگوی مربی‌گری ارائه شده",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-observation_date", "-created_at"]
        verbose_name = "مشاهده رفتاری ایمنی (BBS)"
        verbose_name_plural = "مشاهدات رفتاری ایمنی (BBS)"

    def __str__(self):
        return f"[{self.get_observation_type_display()}] {self.get_category_display()} ({self.observation_date})"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if not self.traceability_chain_id:
            tracking_code = f"TRC-BBS-{self.pk:04d}"
            chain, _ = TraceabilityChain.objects.get_or_create(
                organization=self.organization,
                tracking_code=tracking_code,
                defaults={
                    "title": f"پایش رفتار ایمن BBS: {self.get_category_display()}",
                    "origin_module": "safety_culture",
                    "origin_object_id": str(self.pk),
                },
            )
            self.traceability_chain_id = tracking_code
            TraceabilityNode.objects.create(
                chain=chain,
                from_module="organizations",
                from_id=str(self.organization_id),
                to_module="safety_culture",
                to_id=str(self.pk),
                relation_type="direct",
                description=f"ثبت مشاهده رفتار ({self.get_observation_type_display()} - {self.get_category_display()})",
            )
            super().save(update_fields=["traceability_chain_id"])


class SafetyCultureScore(models.Model):
    """
    شاخص دوره‌ای فرهنگ ایمنی سازمان (Safety Culture Index)
    تجمیع مشارکت در نظرسنجی، نرخ رفتارهای ایمن، گزارش‌دهی ناهنجاری و آموزش‌ها
    """
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="culture_scores",
        verbose_name="سازمان",
    )
    period = models.CharField(max_length=32, verbose_name="دوره سنجش (فصلی/سالانه)")
    overall_score = models.DecimalField(max_digits=5, decimal_places=2, default=75.0, verbose_name="شاخص کل فرهنگ ایمنی (از ۱۰۰)")
    participation_rate = models.DecimalField(max_digits=5, decimal_places=2, default=80.0, verbose_name="درصد مشارکت کارکنان")
    safe_behavior_ratio = models.DecimalField(max_digits=5, decimal_places=2, default=85.0, verbose_name="نسبت رفتارهای ایمن به کل")
    strengths = models.TextField(blank=True, verbose_name="نقاط قوت فرهنگ ایمنی")
    improvement_plan = models.TextField(blank=True, verbose_name="برنامه بهبود و ارتقای فرهنگ")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "شاخص فرهنگ ایمنی"
        verbose_name_plural = "سنجش‌های فرهنگ ایمنی"

    def __str__(self):
        return f"فرهنگ ایمنی {self.period}: {self.overall_score}%"
