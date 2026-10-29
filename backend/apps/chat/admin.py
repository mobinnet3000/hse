from django.contrib import admin
from .models import ChatAttachment, ChatConversation, ChatMessage, ChatParticipant


class ChatParticipantInline(admin.TabularInline):
    model = ChatParticipant
    extra = 0


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    fields = ["sender", "content", "created_at"]
    readonly_fields = ["created_at"]


@admin.register(ChatConversation)
class ChatConversationAdmin(admin.ModelAdmin):
    list_display = ["title", "organization", "conversation_type", "created_by", "created_at", "is_active"]
    list_filter = ["conversation_type", "organization", "is_active"]
    search_fields = ["title"]
    inlines = [ChatParticipantInline, ChatMessageInline]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ["id", "conversation", "sender", "content", "created_at"]
    list_filter = ["conversation__organization", "created_at"]
    search_fields = ["content"]
