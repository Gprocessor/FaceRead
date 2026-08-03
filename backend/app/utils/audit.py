"""
Audit logging — writes audit trail entries to Supabase.
"""
from app.database.supabase_client import get_supabase


def log_audit(
    organization_id: str | None,
    actor_user_id: str | None,
    actor_role: str | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Write an audit log entry."""
    sb = get_supabase()
    sb.table("audit_logs").insert(
        {
            "organization_id": organization_id,
            "actor_user_id": actor_user_id,
            "actor_role": actor_role,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
        }
    ).execute()
