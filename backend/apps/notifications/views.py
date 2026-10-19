from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Notification
from .serializers import NotificationSerializer

class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user)
        if request.query_params.get("unread") in {"1", "true", "True"}:
            notifications = notifications.filter(is_read=False)
        return Response(NotificationSerializer(notifications, many=True).data)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notification = Notification.objects.filter(pk=pk, user=request.user).first()
        if not notification:
            return Response({"error": {"code": "not_found", "message": "اعلان یافت نشد."}}, status=status.HTTP_404_NOT_FOUND)
        notification.is_read = True
        notification.save()
        return Response(NotificationSerializer(notification).data)

class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"status": "ok"})
