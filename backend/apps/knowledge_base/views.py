from django.db.models import Q
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auditlog.services import log_event
from apps.core.access import (
    accessible_organization_ids,
    membership_role,
)
from apps.organizations.models import Membership
from .models import KnowledgeSource
from .serializers import KnowledgeSourceSerializer


class KnowledgeSourceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = KnowledgeSourceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            qs = KnowledgeSource.objects.all()
        else:
            org_ids = accessible_organization_ids(user)
            qs = KnowledgeSource.objects.filter(
                Q(organization__isnull=True) | Q(organization_id__in=org_ids)
            )

        # Filters
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        org_filter = self.request.query_params.get("organization")
        if org_filter:
            if org_filter.lower() == "global":
                qs = qs.filter(organization__isnull=True)
            elif org_filter.isdigit():
                qs = qs.filter(organization_id=int(org_filter))

        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(code__icontains=search)
                | Q(tags__icontains=search)
                | Q(summary__icontains=search)
            )

        return qs.select_related("organization", "created_by").order_by("category", "code")

    def perform_create(self, serializer):
        user = self.request.user
        org = serializer.validated_data.get("organization")

        if org is None:
            if not user.is_platform_admin:
                raise PermissionDenied("ثبت آیین‌نامه یا استاندارد سراسری نیازمند دسترسی مدیر ارشد سامانه است.")
        else:
            if not user.is_platform_admin:
                role = membership_role(user, org.id)
                if role not in {Membership.Roles.ORG_ADMIN, Membership.Roles.HSE_MANAGER}:
                    raise PermissionDenied("شما مجوز ثبت دستورالعمل در این سازمان را ندارید.")

        instance = serializer.save(created_by=user)
        log_event(
            organization=org,
            actor=user,
            action="knowledge_source.created",
            entity_type="KnowledgeSource",
            entity_id=instance.id,
            details={"code": instance.code, "title": instance.title, "category": instance.category},
        )


class KnowledgeSourceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = KnowledgeSourceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            return KnowledgeSource.objects.all().select_related("organization", "created_by")
        org_ids = accessible_organization_ids(user)
        return KnowledgeSource.objects.filter(
            Q(organization__isnull=True) | Q(organization_id__in=org_ids)
        ).select_related("organization", "created_by")

    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()

        if instance.organization is None:
            if not user.is_platform_admin:
                raise PermissionDenied("ویرایش منابع سراسری فقط توسط مدیر ارشد سامانه امکان‌پذیر است.")
        else:
            if not user.is_platform_admin:
                role = membership_role(user, instance.organization_id)
                if role not in {Membership.Roles.ORG_ADMIN, Membership.Roles.HSE_MANAGER}:
                    raise PermissionDenied("مجوز ویرایش این منبع را ندارید.")

        updated = serializer.save()
        log_event(
            organization=updated.organization,
            actor=user,
            action="knowledge_source.updated",
            entity_type="KnowledgeSource",
            entity_id=updated.id,
            details={"code": updated.code, "title": updated.title},
        )

    def perform_destroy(self, instance):
        user = self.request.user
        if instance.organization is None:
            if not user.is_platform_admin:
                raise PermissionDenied("حذف منابع سراسری فقط توسط مدیر ارشد سامانه امکان‌پذیر است.")
        else:
            if not user.is_platform_admin:
                role = membership_role(user, instance.organization_id)
                if role not in {Membership.Roles.ORG_ADMIN, Membership.Roles.HSE_MANAGER}:
                    raise PermissionDenied("مجوز حذف این منبع را ندارید.")

        org = instance.organization
        code = instance.code
        title = instance.title
        instance_id = instance.id
        instance.delete()

        log_event(
            organization=org,
            actor=user,
            action="knowledge_source.deleted",
            entity_type="KnowledgeSource",
            entity_id=instance_id,
            details={"code": code, "title": title},
        )


class KnowledgeMetaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "categories": [
                {"value": k, "label": v} for k, v in KnowledgeSource.Category.choices
            ],
            "statuses": [
                {"value": k, "label": v} for k, v in KnowledgeSource.Status.choices
            ],
        })
