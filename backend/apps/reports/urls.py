from django.urls import path
from .views import ReportExportView

urlpatterns = [
    path("export/<str:report_type>/", ReportExportView.as_view(), name="report-export"),
]
