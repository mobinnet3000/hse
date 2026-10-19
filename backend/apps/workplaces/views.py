from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    accessible_organization_ids,
    can_manage_organization,
    can_view_organization,
)

from .models import Workplace
from .serializers import WorkplaceSerializer

NOT_FOUND = {"error": {"code": "not_found", "message": "محل کار یافت نشد."}}


class WorkplaceListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization_id = request.query_params.get("organization")
        queryset = Workplace.objects.filter(
            organization_id__in=accessible_organization_ids(request.user)
        ).select_related("organization")
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
        return Response(WorkplaceSerializer(queryset, many=True).data)

    def post(self, request):
        serializer = WorkplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization_id = serializer.validated_data["organization"].pk
        if not can_manage_organization(request.user, organization_id):
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "اجازه ایجاد محل کار در این سازمان را ندارید.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WorkplaceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        workplace = Workplace.objects.filter(pk=pk).first()
        if workplace is None or not can_view_organization(
            request.user, workplace.organization_id
        ):
            return None
        return workplace

    def get(self, request, pk):
        workplace = self.get_object(request, pk)
        if workplace is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(WorkplaceSerializer(workplace).data)

    def patch(self, request, pk):
        workplace = self.get_object(request, pk)
        if workplace is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_manage_organization(request.user, workplace.organization_id):
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "اجازه تغییر این محل کار را ندارید.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        request.data.pop("organization", None)
        serializer = WorkplaceSerializer(workplace, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
