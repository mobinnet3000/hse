from django.db import migrations, models


def preserve_platform_admin(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(role="platform_admin").update(global_role="platform_admin")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="global_role",
            field=models.CharField(
                choices=[
                    ("platform_admin", "مدیر پلتفرم"),
                    ("standard", "کاربر عادی"),
                ],
                default="standard",
                max_length=32,
            ),
        ),
        migrations.RunPython(preserve_platform_admin, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="user",
            name="role",
        ),
    ]
