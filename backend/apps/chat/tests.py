from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Organization
from .models import ChatConversation, ChatMessage, ChatParticipant

User = get_user_model()


class ChatWorkflowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org1 = Organization.objects.create(name="شرکت الف", code="org-chat-1", is_active=True)
        self.org2 = Organization.objects.create(name="شرکت ب", code="org-chat-2", is_active=True)

        self.user1 = User.objects.create_user(username="alice", password="pwd", first_name="آلیس")
        self.user2 = User.objects.create_user(username="bob", password="pwd", first_name="باب")
        self.user_intruder = User.objects.create_user(username="eve", password="pwd", first_name="نفوذی")

        Membership.objects.create(user=self.user1, organization=self.org1, role=Membership.Roles.ACTION_OWNER)
        Membership.objects.create(user=self.user2, organization=self.org1, role=Membership.Roles.ACTION_OWNER)
        Membership.objects.create(user=self.user_intruder, organization=self.org2, role=Membership.Roles.ACTION_OWNER)

        self.client.force_authenticate(user=self.user1)

    def test_create_conversation_and_send_message(self):
        # Alice creates conversation with Bob
        response = self.client.post(
            "/api/v1/chat/conversations/",
            {
                "title": "هماهنگی کار در ارتفاع",
                "conversation_type": "direct",
                "participant_user_ids": [self.user2.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        conv_id = response.data["id"]

        # Alice sends message
        msg_resp = self.client.post(
            f"/api/v1/chat/conversations/{conv_id}/messages/",
            {"content": "سلام باب، مجوز شماره ۴ آماده بررسی است."},
            format="json",
        )
        self.assertEqual(msg_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(msg_resp.data["content"], "سلام باب، مجوز شماره ۴ آماده بررسی است.")

        # Authenticate as Bob and check unread count
        self.client.force_authenticate(user=self.user2)
        unread_resp = self.client.get("/api/v1/chat/unread-count/")
        self.assertEqual(unread_resp.data["unread_count"], 1)

        # Bob reads messages -> unread count becomes 0
        get_msgs = self.client.get(f"/api/v1/chat/conversations/{conv_id}/messages/")
        self.assertEqual(get_msgs.status_code, status.HTTP_200_OK)
        self.assertEqual(len(get_msgs.data), 1)

        unread_after = self.client.get("/api/v1/chat/unread-count/")
        self.assertEqual(unread_after.data["unread_count"], 0)

    def test_non_participant_forbidden(self):
        # Alice creates conversation
        conv = ChatConversation.objects.create(
            organization=self.org1,
            title="جلسه خصوصی HSE",
            created_by=self.user1,
        )
        ChatParticipant.objects.create(conversation=conv, user=self.user1)

        # Eve (from org2) tries to access
        self.client.force_authenticate(user=self.user_intruder)
        resp = self.client.get(f"/api/v1/chat/conversations/{conv.id}/messages/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

        # Bob (same org, but not participant) tries to access
        self.client.force_authenticate(user=self.user2)
        resp2 = self.client.get(f"/api/v1/chat/conversations/{conv.id}/messages/")
        self.assertEqual(resp2.status_code, status.HTTP_404_NOT_FOUND)
