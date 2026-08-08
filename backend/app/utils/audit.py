from app.database.supabase_client import get_supabase
def log_audit(org, actor, role, action, entity_type=None, entity_id=None, details=None, ip=None, ua=None):
    try: get_supabase().table("audit_logs").insert({"organization_id":org,"actor_user_id":actor,"actor_role":role,"action":action,"entity_type":entity_type,"entity_id":entity_id,"details":details or {},"ip_address":ip,"user_agent":ua}).execute()
    except Exception: pass
