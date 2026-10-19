from django.db import models


class Workplace(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="workplaces"
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="children",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=50)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"], name="unique_workplace_code_per_org"
            )
        ]
        ordering = ["organization__name", "name"]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.parent and self.parent.organization_id != self.organization_id:
            raise ValidationError({"parent": "محل کار والد باید متعلق به همان سازمان باشد."})

    def __str__(self):
        return self.name
