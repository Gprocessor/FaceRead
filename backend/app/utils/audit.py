"""Audit logging to Supabase."""
from app.database.supabase_client import get_supabase


def log_audit(organization_id, actor_user_id, actor_role, action,
              entity_type=None, entity_id=None, details=None, ip_address=None, user_agent=None):
    sb = get_supabase()
    try:
        sb.table("audit_logs").insert({
            "organization_id": organization_id, "actor_user_id": actor_user_id,
            "actor_role": actor_role, "action": action, "entity_type": entity_type,
            "entity_id": entity_id, "details": details or {},
            "ip_address": ip_address, "user_agent": user_agent,
        }).execute()
    except Exception:
        pass  # never fail a request on audit logging
