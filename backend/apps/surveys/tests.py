from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Organization
from .models import Survey, SurveyQuestion, SurveyQuestionOption, SurveySubmission
from .services import compute_survey_analytics, process_survey_submission

User = get_user_model()


class SurveyWorkflowTestCase(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="شرکت پتروشیمی نمونه", is_active=True)
        self.user = User.objects.create_user(username="survey_respondent", password="pwd")
        Membership.objects.create(user=self.user, organization=self.org, role=Membership.Roles.ACTION_OWNER)

        # 1. Exam Survey (Identifiable)
        self.exam = Survey.objects.create(
            organization=self.org,
            title="آزمون ورود به فضای بسته",
            survey_type=Survey.SurveyType.EXAM,
            is_anonymous=False,
            pass_percentage=70.0,
        )
        self.q1 = SurveyQuestion.objects.create(
            survey=self.exam,
            question_text="حداقل میزان اکسیژن ایمن چند درصد است؟",
            question_type=SurveyQuestion.QuestionType.SINGLE_CHOICE,
            points=10.0,
            order=1,
        )
        self.opt1_wrong = SurveyQuestionOption.objects.create(
            question=self.q1, option_text="۱۵٪", is_correct=False
        )
        self.opt1_correct = SurveyQuestionOption.objects.create(
            question=self.q1, option_text="۱۹.۵٪", is_correct=True
        )

        self.q2 = SurveyQuestion.objects.create(
            survey=self.exam,
            question_text="گازسنجی پیش از ورود الزامی است؟",
            question_type=SurveyQuestion.QuestionType.BOOLEAN,
            points=10.0,
            order=2,
        )
        self.opt2_correct = SurveyQuestionOption.objects.create(
            question=self.q2, option_text="بله", is_correct=True
        )

        # 2. Safety Climate Survey (Strictly Anonymous)
        self.climate = Survey.objects.create(
            organization=self.org,
            title="سنجش جو ایمنی سالانه",
            survey_type=Survey.SurveyType.SAFETY_CLIMATE,
            is_anonymous=True,
        )
        self.q_clim = SurveyQuestion.objects.create(
            survey=self.climate,
            question_text="مدیریت ارشد به گزارش‌های شبه‌حادثه اهمیت می‌دهد؟",
            question_type=SurveyQuestion.QuestionType.RATING_SCALE,
            points=5.0,
            order=1,
        )
        self.opt_clim1 = SurveyQuestionOption.objects.create(
            question=self.q_clim, option_text="کاملاً موافقم", score_weight=5.0
        )

    def test_exam_scoring_pass(self):
        # Answer both correctly -> 20/20 = 100% -> Pass
        sub = process_survey_submission(
            survey=self.exam,
            answers_payload=[
                {"question_id": self.q1.id, "selected_option_ids": [self.opt1_correct.id]},
                {"question_id": self.q2.id, "selected_option_ids": [self.opt2_correct.id]},
            ],
            user=self.user,
        )
        self.assertEqual(sub.total_score, 20.0)
        self.assertEqual(sub.percentage_score, 100.0)
        self.assertTrue(sub.passed)
        self.assertEqual(sub.respondent, self.user)

    def test_exam_scoring_fail(self):
        # Answer q1 wrong, q2 correct -> 10/20 = 50% -> Fail (< 70%)
        sub = process_survey_submission(
            survey=self.exam,
            answers_payload=[
                {"question_id": self.q1.id, "selected_option_ids": [self.opt1_wrong.id]},
                {"question_id": self.q2.id, "selected_option_ids": [self.opt2_correct.id]},
            ],
            user=self.user,
        )
        self.assertEqual(sub.total_score, 10.0)
        self.assertEqual(sub.percentage_score, 50.0)
        self.assertFalse(sub.passed)

    def test_anonymous_survey_protection(self):
        # Pass user into submission, but survey is anonymous -> respondent MUST be None
        sub = process_survey_submission(
            survey=self.climate,
            answers_payload=[
                {"question_id": self.q_clim.id, "selected_option_ids": [self.opt_clim1.id]},
            ],
            user=self.user,
            department="تعمیرات",
        )
        self.assertIsNone(sub.respondent)
        self.assertEqual(sub.department, "تعمیرات")

    def test_analytics_computation(self):
        process_survey_submission(
            survey=self.exam,
            answers_payload=[
                {"question_id": self.q1.id, "selected_option_ids": [self.opt1_correct.id]},
                {"question_id": self.q2.id, "selected_option_ids": [self.opt2_correct.id]},
            ],
            user=self.user,
        )
        analytics = compute_survey_analytics(self.exam)
        self.assertEqual(analytics["total_submissions"], 1)
        self.assertEqual(analytics["pass_count"], 1)
        self.assertEqual(len(analytics["question_analytics"]), 2)


class SurveyAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="شرکت الف", is_active=True)
        self.user = User.objects.create_user(username="tester", password="pwd")
        Membership.objects.create(user=self.user, organization=self.org, role=Membership.Roles.ACTION_OWNER)
        self.client.force_authenticate(user=self.user)

        self.survey = Survey.objects.create(
            organization=self.org,
            title="نظرسنجی ایمنی",
            survey_type=Survey.SurveyType.SURVEY,
        )

    def test_survey_list_api(self):
        response = self.client.get("/api/v1/surveys/surveys/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
