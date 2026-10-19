from django.contrib import admin

from .models import Inspection, InspectionResponse

admin.site.register(Inspection)
admin.site.register(InspectionResponse)
