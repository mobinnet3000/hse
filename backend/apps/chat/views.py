from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import TenantRequiredPermission
from apps.organizations.models import Membership
from .models import ChatAttachment, ChatConversation, ChatMessage, ChatParticipant
from .serializers import (
    ChatConversationCreateSerializer,
    ChatConversationListSerializer,
    ChatMessageSerializer,
)

User = get_user_model()


def _get_user_organization(user):
    membership = Membership.objects.filter(user=user, is_active=True).first()
    return membership.organization if membership else None


class ChatConversationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_serializer_class(self):
        if self.action == "create":
            return ChatConversationCreateSerializer
        return ChatConversationListSerializer

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        # User must belong to organization AND be a participant in the conversation
        return ChatConversation.objects.filter(
            organization_id__in=org_ids,
            participants__user=user,
            is_active=True,
        ).distinct()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = ChatConversationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        org = _get_user_organization(request.user)
        if not org:
            raise PermissionDenied("سازمان فعال برای کاربر یافت نشد.")

        conv = ChatConversation.objects.create(
            organization=org,
            title=data.get("title", ""),
            conversation_type=data.get("conversation_type", ChatConversation.ConversationType.DIRECT),
            created_by=request.user,
        )

        # Add creator as admin participant
        ChatParticipant.objects.create(
            conversation=conv,
            user=request.user,
            role=ChatParticipant.Role.ADMIN,
            last_read_at=timezone.now(),
        )

        # Add other requested participants who belong to the same organization
        other_user_ids = data.get("participant_user_ids", [])
        if other_user_ids:
            valid_org_users = Membership.objects.filter(
                organization=org,
                user_id__in=other_user_ids,
                is_active=True,
            ).values_list("user_id", flat=True)

            for uid in valid_org_users:
                if uid != request.user.id:
                    ChatParticipant.objects.create(
                        conversation=conv,
                        user_id=uid,
                        role=ChatParticipant.Role.MEMBER,
                    )

        # Return full representation
        full_serializer = ChatConversationListSerializer(conv, context={"request": request})
        return Response(full_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        conv = self.get_object()

        # Check membership
        part = conv.participants.filter(user=request.user).first()
        if not part:
            raise PermissionDenied("شما عضو این گفت‌وگو نیستید.")

        if request.method == "GET":
            qs = conv.messages.all().select_related("sender").prefetch_related("attachments")
            since = request.query_params.get("since")
            if since:
                qs = qs.filter(created_at__gt=since)

            # Auto mark read on message fetch
            part.last_read_at = timezone.now()
            part.save(update_fields=["last_read_at"])

            serializer = ChatMessageSerializer(qs, many=True)
            return Response(serializer.data)

        # POST: Send a message
        content = request.data.get("content", "").strip()
        if not content and not request.FILES.getlist("attachments"):
            return Response({"error": "متن پیام یا فایل پیوست الزامی است."}, status=status.HTTP_400_BAD_REQUEST)

        msg = ChatMessage.objects.create(
            conversation=conv,
            sender=request.user,
            content=content,
        )

        # Handle file attachments
        for f in request.FILES.getlist("attachments"):
            ChatAttachment.objects.create(
                message=msg,
                file=f,
                original_filename=f.name,
                file_size_bytes=f.size,
                mime_type=f.content_type or "",
            )

        # Update sender last_read_at
        part.last_read_at = timezone.now()
        part.save(update_fields=["last_read_at"])

        # Touch conversation updated_at
        conv.updated_at = timezone.now()
        conv.save(update_fields=["updated_at"])

        return Response(ChatMessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        conv = self.get_object()
        part = conv.participants.filter(user=request.user).first()
        if part:
            part.last_read_at = timezone.now()
            part.save(update_fields=["last_read_at"])
        return Response({"status": "ok", "last_read_at": part.last_read_at if part else None})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        user = request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        participations = ChatParticipant.objects.filter(
            user=user,
            conversation__organization_id__in=org_ids,
            conversation__is_active=True,
        ).select_related("conversation")

        total_unread = 0
        for p in participations:
            if not p.last_read_at:
                total_unread += p.conversation.messages.count()
            else:
                total_unread += p.conversation.messages.filter(created_at__gt=p.last_read_at).count()

        return Response({"unread_count": total_unread})
