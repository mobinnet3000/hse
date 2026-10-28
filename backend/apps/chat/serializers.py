from rest_framework import serializers
from .models import ChatAttachment, ChatConversation, ChatMessage, ChatParticipant


class ChatAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatAttachment
        fields = ["id", "file", "original_filename", "file_size_bytes", "mime_type", "created_at"]


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.get_full_name", read_only=True)
    sender_avatar = serializers.CharField(source="sender.avatar.url", read_only=True, default=None)
    attachments = ChatAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = ChatMessage
        fields = [
            "id",
            "conversation",
            "sender",
            "sender_name",
            "sender_avatar",
            "content",
            "is_system",
            "attachments",
            "created_at",
        ]
        read_only_fields = ["id", "sender", "created_at"]


class ChatParticipantSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ChatParticipant
        fields = ["id", "user", "username", "user_name", "role", "joined_at", "last_read_at", "is_muted"]


class ChatConversationListSerializer(serializers.ModelSerializer):
    participants = ChatParticipantSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatConversation
        fields = [
            "id",
            "organization",
            "title",
            "conversation_type",
            "participants",
            "last_message",
            "unread_count",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_last_message(self, obj):
        last = obj.messages.order_by("-created_at").first()
        if last:
            return {
                "id": last.id,
                "content": last.content[:80],
                "sender_name": last.sender.get_full_name() if last.sender else "سیستم",
                "created_at": last.created_at,
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        part = obj.participants.filter(user=request.user).first()
        if not part:
            return 0
        if not part.last_read_at:
            return obj.messages.count()
        return obj.messages.filter(created_at__gt=part.last_read_at).count()


class ChatConversationCreateSerializer(serializers.ModelSerializer):
    participant_user_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )

    class Meta:
        model = ChatConversation
        fields = [
            "id",
            "title",
            "conversation_type",
            "participant_user_ids",
        ]
