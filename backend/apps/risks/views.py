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


# ==========================================
# Phase 11: BowTie, Barrier, & HCMS Views
# ==========================================

from .models import (
    Barrier,
    BarrierAssessment,
    BowTieConsequence,
    BowTieDiagram,
    BowTieThreat,
    HCMSControlMatrix,
    RiskAssessmentTemplate,
)
from .risk import calculate_hcms_residual
from .serializers import (
    BarrierAssessmentSerializer,
    BarrierSerializer,
    BowTieConsequenceSerializer,
    BowTieDiagramSerializer,
    BowTieThreatSerializer,
    HCMSControlMatrixSerializer,
    RiskAssessmentTemplateSerializer,
)


class BowTieListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = BowTieDiagram.objects.filter(
            organization_id__in=accessible_organization_ids(request.user)
        ).select_related("organization", "hazard", "owner").prefetch_related(
            "threats", "consequences", "barriers", "barriers__assessments"
        )

        organization_id = request.query_params.get("organization")
        if organization_id:
            try:
                organization_id = int(organization_id)
            except ValueError:
                return Response(
                    {"error": {"code": "invalid_parameter", "message": "شناسه سازمان نامعتبر است."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not can_view_organization(request.user, organization_id):
                return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
            queryset = queryset.filter(organization_id=organization_id)

        hazard_id = request.query_params.get("hazard")
        if hazard_id:
            queryset = queryset.filter(hazard_id=hazard_id)

        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        return Response(BowTieDiagramSerializer(queryset, many=True).data)

    def post(self, request):
        organization_id, error = resolve_organization(request, edit=True)
        if error:
            return error

        hazard_id = request.data.get("hazard")
        hazard = Hazard.objects.filter(pk=hazard_id, organization_id=organization_id).first()
        if hazard is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)

        serializer = BowTieDiagramSerializer(
            data=request.data, context={"organization_id": organization_id}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(
            organization=hazard.organization,
            hazard=hazard,
            created_by=request.user,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BowTieDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        diagram = (
            BowTieDiagram.objects.select_related("organization", "hazard", "owner")
            .prefetch_related("threats", "consequences", "barriers", "barriers__assessments")
            .filter(pk=pk)
            .first()
        )
        if diagram is None or not can_view_organization(request.user, diagram.organization_id):
            return None
        return diagram

    def get(self, request, pk):
        diagram = self.get_object(request, pk)
        if diagram is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(BowTieDiagramSerializer(diagram).data)

    def patch(self, request, pk):
        diagram = self.get_object(request, pk)
        if diagram is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_risks(request.user, diagram.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        request.data.pop("organization", None)
        request.data.pop("hazard", None)
        serializer = BowTieDiagramSerializer(
            diagram,
            data=request.data,
            partial=True,
            context={"organization": diagram.organization},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        diagram = self.get_object(request, pk)
        if diagram is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_risks(request.user, diagram.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        diagram.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BowTieThreatCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, diagram_id):
        diagram = BowTieDiagram.objects.filter(pk=diagram_id).first()
        if diagram is None or not can_view_organization(request.user, diagram.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_risks(request.user, diagram.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        serializer = BowTieThreatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(diagram=diagram)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BowTieConsequenceCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, diagram_id):
        diagram = BowTieDiagram.objects.filter(pk=diagram_id).first()
        if diagram is None or not can_view_organization(request.user, diagram.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_risks(request.user, diagram.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        serializer = BowTieConsequenceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(diagram=diagram)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BarrierListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Barrier.objects.filter(
            diagram__organization_id__in=accessible_organization_ids(request.user)
        ).select_related("diagram", "threat", "consequence", "owner", "related_asset").prefetch_related("assessments")

        diagram_id = request.query_params.get("diagram")
        if diagram_id:
            queryset = queryset.filter(diagram_id=diagram_id)
        barrier_type = request.query_params.get("barrier_type")
        if barrier_type:
            queryset = queryset.filter(barrier_type=barrier_type)
        is_critical = request.query_params.get("is_critical")
        if is_critical is not None:
            queryset = queryset.filter(is_critical=is_critical.lower() in ("true", "1"))
        effectiveness = request.query_params.get("effectiveness")
        if effectiveness:
            queryset = queryset.filter(current_effectiveness=effectiveness)

        return Response(BarrierSerializer(queryset, many=True).data)

    def post(self, request):
        diagram_id = request.data.get("diagram")
        diagram = BowTieDiagram.objects.filter(pk=diagram_id).first()
        if diagram is None or not can_view_organization(request.user, diagram.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_risks(request.user, diagram.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        serializer = BarrierSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(diagram=diagram)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BarrierDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        barrier = Barrier.objects.select_related("diagram", "threat", "consequence", "owner", "related_asset").prefetch_related("assessments").filter(pk=pk).first()
        if barrier is None or not can_view_organization(request.user, barrier.diagram.organization_id):
            return None
        return barrier

    def get(self, request, pk):
        barrier = self.get_object(request, pk)
        if barrier is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(BarrierSerializer(barrier).data)

    def patch(self, request, pk):
        barrier = self.get_object(request, pk)
        if barrier is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_risks(request.user, barrier.diagram.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        serializer = BarrierSerializer(barrier, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class BarrierAssessmentCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        barrier = Barrier.objects.select_related("diagram", "diagram__hazard").filter(pk=pk).first()
        if barrier is None or not can_view_organization(request.user, barrier.diagram.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_risks(request.user, barrier.diagram.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        serializer = BarrierAssessmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assessment = serializer.save(barrier=barrier, assessed_by=request.user)

        # Update barrier effectiveness and status
        barrier.current_effectiveness = assessment.effectiveness
        if assessment.effectiveness == Barrier.Effectiveness.INEFFECTIVE:
            barrier.status = Barrier.Status.IMPAIRED
            # If critical barrier failed, flag hazard for reassessment
            if barrier.is_critical:
                hazard = barrier.diagram.hazard
                hazard.reassessment_needed = True
                hazard.reassessment_reason = f"نقص در مانع کنترلی بحرانی: {barrier.name}"
                hazard.save(update_fields=["reassessment_needed", "reassessment_reason", "updated_at"])
        elif assessment.effectiveness in (Barrier.Effectiveness.EFFECTIVE, Barrier.Effectiveness.PARTIALLY_EFFECTIVE):
            if barrier.status == Barrier.Status.IMPAIRED:
                barrier.status = Barrier.Status.OPERATIONAL

        barrier.save(update_fields=["current_effectiveness", "status", "updated_at"])
        return Response(BarrierAssessmentSerializer(assessment).data, status=status.HTTP_201_CREATED)


class HCMSControlMatrixListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = HCMSControlMatrix.objects.filter(
            organization_id__in=accessible_organization_ids(request.user)
        ).select_related("organization", "hazard", "barrier", "responsible_owner")

        organization_id = request.query_params.get("organization")
        if organization_id:
            try:
                organization_id = int(organization_id)
            except ValueError:
                return Response(
                    {"error": {"code": "invalid_parameter", "message": "شناسه سازمان نامعتبر است."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not can_view_organization(request.user, organization_id):
                return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
            queryset = queryset.filter(organization_id=organization_id)

        hazard_id = request.query_params.get("hazard")
        if hazard_id:
            queryset = queryset.filter(hazard_id=hazard_id)

        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(implementation_status=status_param)

        hierarchy = request.query_params.get("hierarchy")
        if hierarchy:
            queryset = queryset.filter(hierarchy_of_control=hierarchy)

        return Response(HCMSControlMatrixSerializer(queryset, many=True).data)

    def post(self, request):
        organization_id, error = resolve_organization(request, edit=True)
        if error:
            return error

        hazard_id = request.data.get("hazard")
        hazard = Hazard.objects.filter(pk=hazard_id, organization_id=organization_id).first()
        if hazard is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)

        serializer = HCMSControlMatrixSerializer(
            data=request.data, context={"organization_id": organization_id}
        )
        serializer.is_valid(raise_exception=True)

        res_calc = calculate_hcms_residual(
            serializer.validated_data.get("residual_likelihood", 2),
            serializer.validated_data.get("residual_severity", 3),
        )

        serializer.save(
            organization=hazard.organization,
            hazard=hazard,
            residual_score=res_calc["residual_score"],
            residual_level=res_calc["residual_level"],
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class HCMSControlMatrixDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        item = HCMSControlMatrix.objects.select_related("organization", "hazard", "barrier", "responsible_owner").filter(pk=pk).first()
        if item is None or not can_view_organization(request.user, item.organization_id):
            return None
        return item

    def get(self, request, pk):
        item = self.get_object(request, pk)
        if item is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(HCMSControlMatrixSerializer(item).data)

    def patch(self, request, pk):
        item = self.get_object(request, pk)
        if item is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_risks(request.user, item.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        request.data.pop("organization", None)
        request.data.pop("hazard", None)
        serializer = HCMSControlMatrixSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        l = serializer.validated_data.get("residual_likelihood", item.residual_likelihood)
        s = serializer.validated_data.get("residual_severity", item.residual_severity)
        res_calc = calculate_hcms_residual(l, s)

        serializer.save(
            residual_score=res_calc["residual_score"],
            residual_level=res_calc["residual_level"],
        )
        return Response(serializer.data)


class RiskTemplateListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = RiskAssessmentTemplate.objects.all()
        category = request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)
        return Response(RiskAssessmentTemplateSerializer(queryset, many=True).data)


class RiskDashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization_id, error = resolve_organization(request, edit=False)
        if error:
            return error

        total_hazards = Hazard.objects.filter(organization_id=organization_id).count()
        reassessment_needed = Hazard.objects.filter(organization_id=organization_id, reassessment_needed=True).count()
        total_bowties = BowTieDiagram.objects.filter(organization_id=organization_id).count()
        barriers_qs = Barrier.objects.filter(diagram__organization_id=organization_id)
        total_barriers = barriers_qs.count()
        critical_barriers = barriers_qs.filter(is_critical=True).count()
        failed_critical_barriers = barriers_qs.filter(
            is_critical=True, current_effectiveness=Barrier.Effectiveness.INEFFECTIVE
        ).count()
        hcms_qs = HCMSControlMatrix.objects.filter(organization_id=organization_id)
        total_controls = hcms_qs.count()
        pending_review_controls = hcms_qs.filter(implementation_status=HCMSControlMatrix.Status.PLANNED).count()

        return Response({
            "total_hazards": total_hazards,
            "reassessment_needed_count": reassessment_needed,
            "total_bowties": total_bowties,
            "total_barriers": total_barriers,
            "critical_barriers": critical_barriers,
            "failed_critical_barriers": failed_critical_barriers,
            "total_controls": total_controls,
            "pending_review_controls": pending_review_controls,
        })

