from django.core.exceptions import ValidationError
from django.db import models


class ChatConversation(models.Model):
    class ConversationType(models.TextChoices):
        DIRECT = "direct", "گفت‌وگوی دونفره مستقیم"
        GROUP = "group", "گروه تیمی / کارگروه تخصصی"
        CHANNEL = "channel", "کانال اطلاع‌رسانی عمومی"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="chat_conversations",
    )
    title = models.CharField(max_length=200, blank=True)
    conversation_type = models.CharField(
        max_length=30, choices=ConversationType.choices, default=ConversationType.DIRECT
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_chat_conversations",
    )
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title or f"گفت‌وگو #{self.id} ({self.get_conversation_type_display()})"


class ChatParticipant(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "مدیر گفت‌وگو"
        MEMBER = "member", "عضو"

    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name="participants",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="chat_participations",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)
    is_muted = models.BooleanField(default=False)

    class Meta:
        unique_together = [("conversation", "user")]
        ordering = ["joined_at"]

    def __str__(self):
        return f"{self.user.get_full_name()} in {self.conversation_id}"


class ChatMessage(models.Model):
    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="chat_messages",
    )
    content = models.TextField()
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
        ]

    def __str__(self):
        return f"Msg {self.id} by {self.sender_id}: {self.content[:30]}"


class ChatAttachment(models.Model):
    message = models.ForeignKey(
        ChatMessage,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to="chat_attachments/%Y/%m/")
    original_filename = models.CharField(max_length=255)
    file_size_bytes = models.BigIntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_filename
