from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import TenantRequiredPermission
from apps.organizations.models import Membership
from .models import Survey, SurveySubmission
from .serializers import (
    SurveyDetailSerializer,
    SurveyListSerializer,
    SurveySubmissionSerializer,
    SurveySubmitSerializer,
)
from .services import compute_survey_analytics, process_survey_submission


def _get_user_organization(user):
    membership = Membership.objects.filter(user=user, is_active=True).first()
    return membership.organization if membership else None


class SurveyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_serializer_class(self):
        if self.action in ["retrieve", "create", "update", "partial_update"]:
            return SurveyDetailSerializer
        return SurveyListSerializer

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        queryset = Survey.objects.filter(organization_id__in=org_ids)

        survey_type = self.request.query_params.get("survey_type")
        if survey_type:
            queryset = queryset.filter(survey_type=survey_type)

        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        return queryset

    def perform_create(self, serializer):
        org = _get_user_organization(self.request.user)
        serializer.save(organization=org)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        survey = self.get_object()
        serializer = SurveySubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        submission = process_survey_submission(
            survey=survey,
            answers_payload=data["answers"],
            user=request.user,
            department=data.get("department", ""),
            site_name=data.get("site_name", ""),
        )
        return Response(SurveySubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def analytics(self, request, pk=None):
        survey = self.get_object()
        stats = compute_survey_analytics(survey)
        return Response(stats)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        total = qs.count()
        exams = qs.filter(survey_type=Survey.SurveyType.EXAM).count()
        climate = qs.filter(survey_type=Survey.SurveyType.SAFETY_CLIMATE).count()
        anonymous = qs.filter(is_anonymous=True).count()
        total_submissions = SurveySubmission.objects.filter(survey__in=qs).count()

        return Response({
            "total_surveys": total,
            "exams_count": exams,
            "safety_climate_count": climate,
            "anonymous_surveys_count": anonymous,
            "total_submissions": total_submissions,
        })


class SurveySubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SurveySubmissionSerializer
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        queryset = SurveySubmission.objects.filter(organization_id__in=org_ids).select_related(
            "survey", "respondent"
        )
        survey_id = self.request.query_params.get("survey")
        if survey_id:
            queryset = queryset.filter(survey_id=survey_id)
        return queryset

from rest_framework.views import APIView
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import BehaviorObservation, SafetyCultureScore
from .serializers import BehaviorObservationSerializer, SafetyCultureScoreSerializer
from apps.core.events import EventBus, Events
from apps.core.access import accessible_organization_ids


class BehaviorObservationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_ids = accessible_organization_ids(request.user)
        queryset = BehaviorObservation.objects.filter(organization_id__in=org_ids)
        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            queryset = queryset.filter(organization_id=int(org_param))
        serializer = BehaviorObservationSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        org_ids = accessible_organization_ids(request.user)
        org_id = request.data.get("organization")
        if not org_id or int(org_id) not in org_ids:
            if len(org_ids) == 1:
                org_id = list(org_ids)[0]
            else:
                return Response({"error": "شناسه سازمان معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = BehaviorObservationSerializer(data=request.data)
        if serializer.is_valid():
            obs = serializer.save(organization_id=org_id, observer=request.user)
            EventBus.publish(Events.SAFETY_BEHAVIOR_LOGGED, {
                "observation_id": obs.id,
                "type": obs.observation_type,
                "category": obs.category,
                "coaching": bool(obs.immediate_coaching),
            }, user_id=request.user.id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SafetyCultureScoreListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_ids = accessible_organization_ids(request.user)
        queryset = SafetyCultureScore.objects.filter(organization_id__in=org_ids)
        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            queryset = queryset.filter(organization_id=int(org_param))
        serializer = SafetyCultureScoreSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        org_ids = accessible_organization_ids(request.user)
        org_id = request.data.get("organization")
        if not org_id or int(org_id) not in org_ids:
            if len(org_ids) == 1:
                org_id = list(org_ids)[0]
            else:
                return Response({"error": "شناسه سازمان معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = SafetyCultureScoreSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(organization_id=org_id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
