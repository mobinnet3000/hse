from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.exceptions import ValidationError

from apps.moc.models import ChangeRequest
from apps.moc.serializers import (
    ChangeRequestListSerializer,
    ChangeRequestDetailSerializer,
    ChangeRequestCreateSerializer,
    MOCRiskAssessmentSerializer,
    MOCCloseSerializer,
)
from apps.moc.services import (
    submit_change_request,
    record_risk_assessment_for_moc,
    authorize_change_request,
    close_change_request,
)
from apps.core.access import accessible_organization_ids, is_active_member


class ChangeRequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ChangeRequestCreateSerializer
        return ChangeRequestListSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            qs = ChangeRequest.objects.all()
        else:
            org_ids = accessible_organization_ids(user)
            qs = ChangeRequest.objects.filter(organization_id__in=org_ids)

        org_id = self.request.query_params.get("organization")
        if org_id and org_id.isdigit():
            qs = qs.filter(organization_id=int(org_id))

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        change_type = self.request.query_params.get("change_type")
        if change_type:
            qs = qs.filter(change_type=change_type)

        return qs.select_related("organization", "workplace", "requested_by")

    def perform_create(self, serializer):
        user = self.request.user
        data = serializer.validated_data
        org = data["organization"]
        if not user.is_platform_admin and not is_active_member(user, org.id):
            raise ValidationError("شما دسترسی ایجاد MOC در این سازمان را ندارید.")
        serializer.save(requested_by=user)


class ChangeRequestDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChangeRequestDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            return ChangeRequest.objects.all()
        org_ids = accessible_organization_ids(user)
        return ChangeRequest.objects.filter(organization_id__in=org_ids)


class MOCSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            moc = ChangeRequest.objects.get(pk=pk)
            updated = submit_change_request(moc=moc, user=request.user)
            return Response(ChangeRequestDetailSerializer(updated).data)
        except ChangeRequest.DoesNotExist:
            return Response({"detail": "درخواست تغییر یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as exc:
            return Response({"detail": exc.message if hasattr(exc, "message") else str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class MOCApproveRiskView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            moc = ChangeRequest.objects.get(pk=pk)
            serializer = MOCRiskAssessmentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            risk_reg = None
            risk_reg_id = serializer.validated_data.get("risk_register_id")
            if risk_reg_id:
                from apps.risks.models import RiskRegister
                risk_reg = RiskRegister.objects.filter(id=risk_reg_id).first()

            updated = record_risk_assessment_for_moc(
                moc=moc,
                assessor=request.user,
                risk_notes=serializer.validated_data["risk_notes"],
                risk_register=risk_reg,
                is_approved=serializer.validated_data["is_approved"],
            )
            return Response(ChangeRequestDetailSerializer(updated).data)
        except ChangeRequest.DoesNotExist:
            return Response({"detail": "درخواست تغییر یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as exc:
            return Response({"detail": exc.message if hasattr(exc, "message") else str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class MOCAuthorizeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            moc = ChangeRequest.objects.get(pk=pk)
            updated = authorize_change_request(moc=moc, approver=request.user)
            return Response(ChangeRequestDetailSerializer(updated).data)
        except ChangeRequest.DoesNotExist:
            return Response({"detail": "درخواست تغییر یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as exc:
            return Response({"detail": exc.message if hasattr(exc, "message") else str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class MOCCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            moc = ChangeRequest.objects.get(pk=pk)
            serializer = MOCCloseSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            updated = close_change_request(
                moc=moc,
                user=request.user,
                closure_notes=serializer.validated_data.get("closure_notes", ""),
            )
            return Response(ChangeRequestDetailSerializer(updated).data)
        except ChangeRequest.DoesNotExist:
            return Response({"detail": "درخواست تغییر یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as exc:
            return Response({"detail": exc.message if hasattr(exc, "message") else str(exc)}, status=status.HTTP_400_BAD_REQUEST)
