from rest_framework import serializers
from .models import Survey, SurveyAnswer, SurveyQuestion, SurveyQuestionOption, SurveySubmission


class SurveyQuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyQuestionOption
        fields = ["id", "option_text", "is_correct", "score_weight", "order"]


class SurveyQuestionSerializer(serializers.ModelSerializer):
    options = SurveyQuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = SurveyQuestion
        fields = [
            "id",
            "survey",
            "question_text",
            "question_type",
            "points",
            "order",
            "is_required",
            "options",
        ]


class SurveyListSerializer(serializers.ModelSerializer):
    questions_count = serializers.IntegerField(source="questions.count", read_only=True)
    submissions_count = serializers.IntegerField(source="submissions.count", read_only=True)

    class Meta:
        model = Survey
        fields = [
            "id",
            "organization",
            "title",
            "description",
            "survey_type",
            "is_anonymous",
            "pass_percentage",
            "time_limit_minutes",
            "is_active",
            "questions_count",
            "submissions_count",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SurveyDetailSerializer(serializers.ModelSerializer):
    questions = SurveyQuestionSerializer(many=True, read_only=True)
    submissions_count = serializers.IntegerField(source="submissions.count", read_only=True)

    class Meta:
        model = Survey
        fields = [
            "id",
            "organization",
            "title",
            "description",
            "survey_type",
            "is_anonymous",
            "pass_percentage",
            "time_limit_minutes",
            "is_active",
            "questions",
            "submissions_count",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SurveyAnswerPayloadSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    selected_option_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    text_answer = serializers.CharField(required=False, allow_blank=True, default="")
    numeric_answer = serializers.FloatField(required=False, allow_null=True)


class SurveySubmitSerializer(serializers.Serializer):
    answers = SurveyAnswerPayloadSerializer(many=True)
    department = serializers.CharField(required=False, allow_blank=True, default="")
    site_name = serializers.CharField(required=False, allow_blank=True, default="")


class SurveySubmissionSerializer(serializers.ModelSerializer):
    respondent_name = serializers.SerializerMethodField()
    survey_title = serializers.CharField(source="survey.title", read_only=True)

    class Meta:
        model = SurveySubmission
        fields = [
            "id",
            "survey",
            "survey_title",
            "organization",
            "respondent",
            "respondent_name",
            "department",
            "site_name",
            "total_score",
            "max_possible_score",
            "percentage_score",
            "passed",
            "submitted_at",
        ]
        read_only_fields = ["id", "submitted_at"]

    def get_respondent_name(self, obj):
        if obj.survey.is_anonymous or not obj.respondent:
            return "پاسخ‌دهنده ناشناس"
        return obj.respondent.get_full_name() or obj.respondent.username
