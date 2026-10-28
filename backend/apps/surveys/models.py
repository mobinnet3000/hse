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
