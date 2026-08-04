from app.database.supabase_client import get_supabase
def log_audit(organization_id, actor_user_id, actor_role, action, entity_type=None, entity_id=None, details=None, ip_address=None, user_agent=None):
    try:
        get_supabase().table("audit_logs").insert({
            "organization_id": organization_id, "actor_user_id": actor_user_id, "actor_role": actor_role,
            "action": action, "entity_type": entity_type, "entity_id": entity_id,
            "details": details or {}, "ip_address": ip_address, "user_agent": user_agent,
        }).execute()
    except Exception:
        pass
