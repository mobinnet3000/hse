from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/organizations/", include("apps.organizations.urls")),
    path("api/v1/workplaces/", include("apps.workplaces.urls")),
    path("api/v1/risks/", include("apps.risks.urls")),
    path("api/v1/checklists/", include("apps.checklists.urls")),
    path("api/v1/inspections/", include("apps.inspections.urls")),
    path("api/v1/non-conformities/", include("apps.findings.urls")),
    path("api/v1/corrective-actions/", include("apps.capa.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/dashboard/", include("apps.dashboard.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
    path("api/v1/audit-logs/", include("apps.auditlog.urls")),
    path("api/v1/knowledge-base/", include("apps.knowledge_base.urls")),
    path("api/v1/ai/", include("apps.ai_assistant.urls")),
    path("api/v1/incidents/", include("apps.incidents.urls")),
    path("api/v1/permits/", include("apps.permits.urls")),
    path("api/v1/assets/", include("apps.assets.urls")),
    path("api/v1/workforce/", include("apps.workforce.urls")),
    path("api/v1/environment/", include("apps.environment.urls")),
    path("api/v1/scaffolds/", include("apps.scaffolds.urls")),
    path("api/v1/documents/", include("apps.documents.urls")),
    path("api/v1/", include("apps.core.urls")),
]

handler404 = "apps.core.views.not_found"
handler500 = "apps.core.views.server_error"



