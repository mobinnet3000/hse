from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    accessible_organization_ids,
    can_approve_risks,
    can_edit_risks,
    can_view_organization,
)

from .models import Hazard, RiskAssessment
from .risk import evaluate_risk
from .serializers import HazardSerializer, RiskAssessmentSerializer

NOT_FOUND = {"error": {"code": "not_found", "message": "موردی یافت نشد."}}
FORBIDDEN = {
    "error": {"code": "permission_denied", "message": "اجازه انجام این عملیات را ندارید."}
}


def resolve_organization(request, *, edit=False):
    organization_id = request.query_params.get("organization") or request.data.get(
        "organization"
    )
    if organization_id is None:
        ids = list(accessible_organization_ids(request.user))
        if len(ids) != 1:
            return None, Response(
                {
                    "error": {
                        "code": "organization_required",
                        "message": "شناسه سازمان لازم است.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        organization_id = ids[0]
    try:
        organization_id = int(organization_id)
    except (TypeError, ValueError):
        return None, Response(
            {
                "error": {
                    "code": "invalid_parameter",
                    "message": "شناسه سازمان نامعتبر است.",
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    allowed = can_edit_risks(request.user, organization_id) if edit else can_view_organization(
        request.user, organization_id
    )
    if not allowed:
        return None, Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
    return organization_id, None


class HazardListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Hazard.objects.filter(
            organization_id__in=accessible_organization_ids(request.user)
        ).select_related("organization", "workplace")

        organization_id = request.query_params.get("organization")
        if organization_id:
            try:
                organization_id = int(organization_id)
            except ValueError:
                return Response(
                    {
                        "error": {
                            "code": "invalid_parameter",
                            "message": "شناسه سازمان نامعتبر است.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not can_view_organization(request.user, organization_id):
                return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
            queryset = queryset.filter(organization_id=organization_id)

        workplace_id = request.query_params.get("workplace")
        if workplace_id:
            queryset = queryset.filter(workplace_id=workplace_id)
        category = request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)
        hazard_status = request.query_params.get("status")
        if hazard_status:
            queryset = queryset.filter(status=hazard_status)

        return Response(HazardSerializer(queryset, many=True).data)

    def post(self, request):
        organization_id, error = resolve_organization(request, edit=True)
        if error:
            return error
        serializer = HazardSerializer(
            data=request.data, context={"organization_id": organization_id}
        )
        serializer.is_valid(raise_exception=True)
        from apps.organizations.models import Organization

        serializer.save(
            organization=Organization.objects.get(pk=organization_id),
            created_by=request.user,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class HazardDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        hazard = Hazard.objects.select_related("organization", "workplace").filter(pk=pk).first()
        if hazard is None or not can_view_organization(request.user, hazard.organization_id):
            return None
        return hazard

    def get(self, request, pk):
        hazard = self.get_object(request, pk)
        if hazard is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(HazardSerializer(hazard).data)

    def patch(self, request, pk):
        hazard = self.get_object(request, pk)
        if hazard is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_risks(request.user, hazard.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        request.data.pop("organization", None)
        serializer = HazardSerializer(
            hazard,
            data=request.data,
            partial=True,
            context={"organization": hazard.organization},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AssessmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = RiskAssessment.objects.filter(
            organization_id__in=accessible_organization_ids(request.user)
        ).select_related("hazard", "organization")

        organization_id = request.query_params.get("organization")
        if organization_id:
            try:
                organization_id = int(organization_id)
            except ValueError:
                return Response(
                    {
                        "error": {
                            "code": "invalid_parameter",
                            "message": "شناسه سازمان نامعتبر است.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not can_view_organization(request.user, organization_id):
                return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
            queryset = queryset.filter(organization_id=organization_id)

        hazard_id = request.query_params.get("hazard")
        if hazard_id:
            queryset = queryset.filter(hazard_id=hazard_id)
        level = request.query_params.get("level")
        if level:
            queryset = queryset.filter(level=level)

        return Response(RiskAssessmentSerializer(queryset, many=True).data)

    def post(self, request):
        organization_id, error = resolve_organization(request, edit=True)
        if error:
            return error
        hazard_id = request.data.get("hazard")
        hazard = Hazard.objects.filter(pk=hazard_id, organization_id=organization_id).first()
        if hazard is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        serializer = RiskAssessmentSerializer(
            data=request.data, context={"organization_id": organization_id}
        )
        serializer.is_valid(raise_exception=True)
        score, level, _ = evaluate_risk(
            serializer.validated_data["likelihood"], serializer.validated_data["severity"]
        )
        serializer.save(
            organization=hazard.organization,
            hazard=hazard,
            score=score,
            level=level,
            assessed_at=timezone.now(),
            assessed_by=request.user,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AssessmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        assessment = (
            RiskAssessment.objects.select_related("hazard", "organization").filter(pk=pk).first()
        )
        if assessment is None or not can_view_organization(
            request.user, assessment.organization_id
        ):
            return None
        return assessment

    def get(self, request, pk):
        assessment = self.get_object(request, pk)
        if assessment is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(RiskAssessmentSerializer(assessment).data)

    def patch(self, request, pk):
        assessment = self.get_object(request, pk)
        if assessment is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_risks(request.user, assessment.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get("status")
        if new_status in {
            RiskAssessment.Status.APPROVED,
            RiskAssessment.Status.REJECTED,
        } and not can_approve_risks(request.user, assessment.organization_id):
            return Response(
                {
                    "error": {
                        "code": "approval_denied",
                        "message": "تأیید یا رد ارزیابی مجاز نیست.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        request.data.pop("organization", None)
        serializer = RiskAssessmentSerializer(
            assessment,
            data=request.data,
            partial=True,
            context={"organization": assessment.organization},
        )
        serializer.is_valid(raise_exception=True)
        likelihood = serializer.validated_data.get("likelihood", assessment.likelihood)
        severity = serializer.validated_data.get("severity", assessment.severity)
        score, level, _ = evaluate_risk(likelihood, severity)
        recalculated = (
            "likelihood" in serializer.validated_data
            or "severity" in serializer.validated_data
        )
        serializer.save(
            score=score,
            level=level,
            assessed_at=timezone.now() if recalculated else assessment.assessed_at,
            assessed_by=request.user if recalculated else assessment.assessed_by,
        )
        return Response(serializer.data)
