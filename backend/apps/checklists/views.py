from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    accessible_organization_ids,
    can_manage_checklists,
    can_view_organization,
)
from apps.core.views_utils import resolve_organization

from .models import Checklist, ChecklistItem
from .serializers import ChecklistItemSerializer, ChecklistSerializer

NOT_FOUND = {"error": {"code": "not_found", "message": "موردی یافت نشد."}}
FORBIDDEN = {
    "error": {"code": "permission_denied", "message": "اجازه انجام این عملیات را ندارید."}
}


class ChecklistListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Checklist.objects.filter(
            organization_id__in=accessible_organization_ids(request.user)
        ).prefetch_related("items")
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
        return Response(ChecklistSerializer(queryset, many=True).data)

    def post(self, request):
        organization_id, error = resolve_organization(request, can_manage_checklists)
        if error:
            return error
        serializer = ChecklistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from apps.organizations.models import Organization

        serializer.save(
            organization=Organization.objects.get(pk=organization_id),
            created_by=request.user,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChecklistDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        checklist = (
            Checklist.objects.prefetch_related("items").filter(pk=pk).first()
        )
        if checklist is None or not can_view_organization(
            request.user, checklist.organization_id
        ):
            return None
        return checklist

    def get(self, request, pk):
        checklist = self.get_object(request, pk)
        if checklist is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(ChecklistSerializer(checklist).data)

    def patch(self, request, pk):
        checklist = self.get_object(request, pk)
        if checklist is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_manage_checklists(request.user, checklist.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        request.data.pop("organization", None)
        serializer = ChecklistSerializer(checklist, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChecklistItemListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_checklist(self, request, pk):
        checklist = Checklist.objects.filter(pk=pk).first()
        if checklist is None or not can_view_organization(
            request.user, checklist.organization_id
        ):
            return None
        return checklist

    def get(self, request, pk):
        checklist = self.get_checklist(request, pk)
        if checklist is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(ChecklistItemSerializer(checklist.items.all(), many=True).data)

    def post(self, request, pk):
        checklist = self.get_checklist(request, pk)
        if checklist is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_manage_checklists(request.user, checklist.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        data = request.data.copy()
        if not data.get("order"):
            next_order = (
                checklist.items.order_by("-order").values_list("order", flat=True).first()
                or 0
            )
            data["order"] = next_order + 1
        serializer = ChecklistItemSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(checklist=checklist)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChecklistItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        item = ChecklistItem.objects.select_related("checklist").filter(pk=pk).first()
        if item is None or not can_view_organization(
            request.user, item.checklist.organization_id
        ):
            return None
        return item

    def patch(self, request, pk):
        item = self.get_object(request, pk)
        if item is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_manage_checklists(request.user, item.checklist.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        request.data.pop("checklist", None)
        serializer = ChecklistItemSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        item = self.get_object(request, pk)
        if item is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_manage_checklists(request.user, item.checklist.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
