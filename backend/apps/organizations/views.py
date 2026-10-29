from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    accessible_organizations,
    can_manage_organization,
    can_view_organization,
)

from .models import Membership, Organization
from .serializers import MembershipSerializer, OrganizationSerializer


class OrganizationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organizations = accessible_organizations(request.user)
        return Response(OrganizationSerializer(organizations, many=True).data)

    def post(self, request):
        if not request.user.is_platform_admin:
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "فقط مدیر پلتفرم می‌تواند سازمان ایجاد کند.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = OrganizationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class OrganizationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        organization = Organization.objects.filter(pk=pk).first()
        if organization is None or not can_view_organization(request.user, organization.pk):
            return None
        return organization

    def get(self, request, pk):
        organization = self.get_object(request, pk)
        if organization is None:
            return Response(
                {"error": {"code": "not_found", "message": "سازمان یافت نشد."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(OrganizationSerializer(organization).data)

    def patch(self, request, pk):
        organization = self.get_object(request, pk)
        if organization is None:
            return Response(
                {"error": {"code": "not_found", "message": "سازمان یافت نشد."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not can_manage_organization(request.user, organization.pk):
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "اجازه تغییر این سازمان را ندارید.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if not request.user.is_platform_admin:
            request.data.pop("is_active", None)
            request.data.pop("code", None)
        serializer = OrganizationSerializer(
            organization, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MembershipListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def _organization_for_manager(self, request, pk):
        organization = Organization.objects.filter(pk=pk).first()
        if organization is None or not can_manage_organization(request.user, organization.pk):
            return None
        return organization

    def get(self, request, pk):
        # Any active member may discover colleagues for operational workflows
        # such as assigning an incoming shift supervisor. Only managers may
        # create or change memberships (see post()).
        organization = Organization.objects.filter(pk=pk).first()
        if organization is None or not can_view_organization(request.user, organization.pk):
            return Response(
                {"error": {"code": "not_found", "message": "سازمان یافت نشد."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        memberships = organization.memberships.filter(is_active=True).select_related("user")
        return Response(MembershipSerializer(memberships, many=True).data)

    def post(self, request, pk):
        organization = self._organization_for_manager(request, pk)
        if organization is None:
            return Response(
                {"error": {"code": "not_found", "message": "سازمان یافت نشد."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = MembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        if Membership.objects.filter(user=user, organization=organization).exists():
            return Response(
                {
                    "error": {
                        "code": "already_member",
                        "message": "این کاربر قبلاً عضو سازمان است.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save(organization=organization)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MembershipDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_membership(self, request, pk):
        membership = Membership.objects.select_related("user", "organization").filter(pk=pk).first()
        if membership is None or not can_manage_organization(
            request.user, membership.organization_id
        ):
            return None
        return membership

    def patch(self, request, pk):
        membership = self.get_membership(request, pk)
        if membership is None:
            return Response(
                {"error": {"code": "not_found", "message": "عضویت یافت نشد."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if membership.user_id == request.user.pk and (
            request.data.get("is_active") is False
            or ("role" in request.data and request.data["role"] != membership.role)
        ):
            return Response(
                {
                    "error": {
                        "code": "self_lockout",
                        "message": "نمی‌توانید نقش یا وضعیت عضویت خود را تغییر دهید.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = MembershipSerializer(membership, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SubscriptionPlanListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import SubscriptionPlan
        from .serializers import SubscriptionPlanSerializer
        plans = SubscriptionPlan.objects.filter(is_active=True)
        return Response(SubscriptionPlanSerializer(plans, many=True).data)


class OrganizationSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from .models import OrganizationSubscription
        from .serializers import OrganizationSubscriptionSerializer
        org = Organization.objects.filter(pk=pk).first()
        if org is None or not can_view_organization(request.user, org.pk):
            return Response({"error": {"code": "not_found", "message": "سازمان یافت نشد."}}, status=status.HTTP_404_NOT_FOUND)
        sub = getattr(org, "subscription", None)
        if not sub:
            return Response({"status": "no_subscription", "organization": org.id})
        return Response(OrganizationSubscriptionSerializer(sub).data)


class ModuleEntitlementListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from .models import ModuleEntitlement
        from .serializers import ModuleEntitlementSerializer
        org = Organization.objects.filter(pk=pk).first()
        if org is None or not can_view_organization(request.user, org.pk):
            return Response({"error": {"code": "not_found", "message": "سازمان یافت نشد."}}, status=status.HTTP_404_NOT_FOUND)
        entitlements = ModuleEntitlement.objects.filter(organization=org)
        return Response(ModuleEntitlementSerializer(entitlements, many=True).data)


class SubscriptionPaymentRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from .models import SubscriptionPaymentRequest, SubscriptionPlan
        from .serializers import SubscriptionPaymentRequestSerializer
        org = Organization.objects.filter(pk=pk).first()
        if org is None or not can_manage_organization(request.user, org.pk):
            return Response({"error": {"code": "not_found", "message": "سازمان یافت نشد یا دسترسی مدیریت ندارید."}}, status=status.HTTP_404_NOT_FOUND)

        plan_id = request.data.get("plan_id")
        plan = SubscriptionPlan.objects.filter(id=plan_id).first()
        if not plan:
            return Response({"error": {"code": "invalid_plan", "message": "پلن اشتراک نامعتبر است."}}, status=status.HTTP_400_BAD_REQUEST)

        amount = request.data.get("amount_irr", plan.price_monthly_irr)
        ref = request.data.get("payment_reference", "")
        if not ref:
            return Response({"error": {"code": "ref_required", "message": "شماره پیگیری فیش واریز الزامی است."}}, status=status.HTTP_400_BAD_REQUEST)

        payment = SubscriptionPaymentRequest.objects.create(
            organization=org,
            plan=plan,
            amount_irr=amount,
            payment_reference=ref,
            submitted_by=request.user,
            notes=request.data.get("notes", ""),
        )
        return Response(SubscriptionPaymentRequestSerializer(payment).data, status=status.HTTP_201_CREATED)

