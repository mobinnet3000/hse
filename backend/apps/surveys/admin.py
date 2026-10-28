from django.contrib import admin
from .models import Survey, SurveyAnswer, SurveyQuestion, SurveyQuestionOption, SurveySubmission


class SurveyQuestionOptionInline(admin.TabularInline):
    model = SurveyQuestionOption
    extra = 0


@admin.register(SurveyQuestion)
class SurveyQuestionAdmin(admin.ModelAdmin):
    list_display = ["question_text", "survey", "question_type", "points", "order"]
    list_filter = ["survey", "question_type"]
    inlines = [SurveyQuestionOptionInline]


class SurveyQuestionInline(admin.StackedInline):
    model = SurveyQuestion
    extra = 0


@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ["title", "organization", "survey_type", "is_anonymous", "pass_percentage", "is_active"]
    list_filter = ["survey_type", "is_anonymous", "is_active", "organization"]
    search_fields = ["title", "description"]
    inlines = [SurveyQuestionInline]


@admin.register(SurveySubmission)
class SurveySubmissionAdmin(admin.ModelAdmin):
    list_display = ["survey", "organization", "respondent", "percentage_score", "passed", "submitted_at"]
    list_filter = ["survey", "passed", "submitted_at"]
