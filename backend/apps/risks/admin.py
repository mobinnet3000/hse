from django.contrib import admin

from .models import Hazard, RiskAssessment

admin.site.register(Hazard)
admin.site.register(RiskAssessment)
