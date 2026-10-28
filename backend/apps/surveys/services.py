from typing import Any, Dict, List
from django.db import transaction
from .models import Survey, SurveyAnswer, SurveyQuestion, SurveyQuestionOption, SurveySubmission


@transaction.atomic
def process_survey_submission(
    survey: Survey,
    answers_payload: List[Dict[str, Any]],
    user=None,
    department: str = "",
    site_name: str = "",
) -> SurveySubmission:
    """Processes survey answers, calculates automatic scoring, and ensures anonymity rules."""
    # Enforce Anonymity Rule
    respondent = None if survey.is_anonymous else user

    submission = SurveySubmission.objects.create(
        survey=survey,
        organization=survey.organization,
        respondent=respondent,
        department=department,
        site_name=site_name,
    )

    total_score = 0.0
    max_possible = 0.0

    questions_by_id = {q.id: q for q in survey.questions.prefetch_related("options").all()}

    for item in answers_payload:
        q_id = item.get("question_id")
        q = questions_by_id.get(q_id)
        if not q:
            continue

        max_possible += q.points
        selected_option_ids = item.get("selected_option_ids", [])
        text_ans = item.get("text_answer", "")
        num_ans = item.get("numeric_answer")

        score = 0.0
        selected_opts = [opt for opt in q.options.all() if opt.id in selected_option_ids]

        if q.question_type in [SurveyQuestion.QuestionType.SINGLE_CHOICE, SurveyQuestion.QuestionType.BOOLEAN]:
            if selected_opts and selected_opts[0].is_correct:
                score = q.points
            elif selected_opts and q.question_type == SurveyQuestion.QuestionType.RATING_SCALE:
                score = selected_opts[0].score_weight
        elif q.question_type == SurveyQuestion.QuestionType.MULTI_CHOICE:
            correct_opts = {opt.id for opt in q.options.all() if opt.is_correct}
            user_opts = set(selected_option_ids)
            if correct_opts and correct_opts == user_opts:
                score = q.points

        total_score += score

        ans_obj = SurveyAnswer.objects.create(
            submission=submission,
            question=q,
            text_answer=text_ans,
            numeric_answer=num_ans,
            score_awarded=score,
        )
        if selected_opts:
            ans_obj.selected_options.set(selected_opts)

    pct = round((total_score / max_possible * 100.0), 2) if max_possible > 0 else 100.0
    passed = pct >= survey.pass_percentage if survey.survey_type in [Survey.SurveyType.EXAM, Survey.SurveyType.TRAINING_QUIZ] else True

    submission.total_score = round(total_score, 2)
    submission.max_possible_score = round(max_possible, 2)
    submission.percentage_score = pct
    submission.passed = passed
    submission.save()

    return submission


def compute_survey_analytics(survey: Survey) -> Dict[str, Any]:
    """Generates detailed response statistics and question-level distributions."""
    submissions = survey.submissions.all()
    count = submissions.count()
    if count == 0:
        return {
            "total_submissions": 0,
            "average_percentage_score": 0.0,
            "pass_count": 0,
            "fail_count": 0,
            "question_analytics": [],
        }

    total_pct = sum(s.percentage_score for s in submissions)
    avg_pct = round(total_pct / count, 2)
    passed_count = submissions.filter(passed=True).count()
    failed_count = count - passed_count

    q_analytics = []
    for q in survey.questions.all():
        answers = SurveyAnswer.objects.filter(question=q)
        ans_count = answers.count()

        opt_distribution = []
        for opt in q.options.all():
            selected_times = opt.surveyanswer_set.count()
            pct_selected = round((selected_times / ans_count * 100.0), 1) if ans_count > 0 else 0.0
            opt_distribution.append({
                "option_id": opt.id,
                "option_text": opt.option_text,
                "is_correct": opt.is_correct,
                "count": selected_times,
                "percentage": pct_selected,
            })

        q_analytics.append({
            "question_id": q.id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "total_responses": ans_count,
            "options": opt_distribution,
        })

    return {
        "survey_id": survey.id,
        "title": survey.title,
        "survey_type": survey.survey_type,
        "is_anonymous": survey.is_anonymous,
        "total_submissions": count,
        "average_percentage_score": avg_pct,
        "pass_count": passed_count,
        "fail_count": failed_count,
        "pass_rate_pct": round((passed_count / count * 100.0), 1),
        "question_analytics": q_analytics,
    }
