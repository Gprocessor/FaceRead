"""Starter field sets per organisation type. "Department" is built in for everyone."""


def _f(key, label, type_="text", required=False, options=None, show=False, report=False, placeholder=""):
    return {"key": key, "label": label, "type": type_, "required": required, "options": options or [],
            "show_in_list": show, "include_in_report": report, "placeholder": placeholder}


GENDER = ["Male", "Female", "Prefer not to say"]

PRESETS = {
    "company": {"name": "Company / Corporate", "description": "Offices and businesses tracking staff attendance.",
        "labels": {"person_singular": "Staff", "person_plural": "Staff", "id_label": "Staff No."},
        "fields": [_f("email", "Work email", "email", show=True), _f("phone", "Phone", "phone"),
                   _f("position", "Job title", show=True, report=True),
                   _f("employment_type", "Employment type", "select", options=["Full-time", "Part-time", "Contract", "Intern"], report=True),
                   _f("hire_date", "Hire date", "date"), _f("line_manager", "Line manager")]},
    "school": {"name": "School (Primary / Secondary)", "description": "Pupils and students attending classes.",
        "labels": {"person_singular": "Student", "person_plural": "Students", "id_label": "Admission No."},
        "fields": [_f("class_name", "Class", required=True, show=True, report=True, placeholder="e.g. JSS 2B"),
                   _f("gender", "Gender", "select", options=GENDER), _f("date_of_birth", "Date of birth", "date"),
                   _f("parent_name", "Parent / Guardian name", required=True),
                   _f("parent_phone", "Parent / Guardian phone", "phone", required=True, show=True),
                   _f("address", "Home address", "textarea")]},
    "university": {"name": "University / Polytechnic", "description": "Higher-education students attending lectures.",
        "labels": {"person_singular": "Student", "person_plural": "Students", "id_label": "Matric No."},
        "fields": [_f("faculty", "Faculty", show=True, report=True), _f("programme", "Programme / Course of study", report=True),
                   _f("level", "Level", "select", options=["100", "200", "300", "400", "500", "600", "Postgraduate"], required=True, show=True, report=True),
                   _f("email", "Student email", "email"), _f("phone", "Phone", "phone"), _f("hall", "Hall of residence")]},
    "training": {"name": "Training Centre / Academy", "description": "Trainees on courses, bootcamps or apprenticeships.",
        "labels": {"person_singular": "Trainee", "person_plural": "Trainees", "id_label": "Trainee ID"},
        "fields": [_f("course", "Course", required=True, show=True, report=True), _f("cohort", "Cohort / Batch", show=True, report=True),
                   _f("email", "Email", "email"), _f("phone", "Phone", "phone"), _f("start_date", "Start date", "date")]},
    "hospital": {"name": "Hospital / Healthcare", "description": "Clinical and support staff on shifts.",
        "labels": {"person_singular": "Staff", "person_plural": "Staff", "id_label": "Staff ID"},
        "fields": [_f("role", "Role", "select", options=["Doctor", "Nurse", "Pharmacist", "Lab scientist", "Admin", "Support"], required=True, show=True, report=True),
                   _f("ward", "Ward / Unit", show=True, report=True),
                   _f("shift", "Shift", "select", options=["Morning", "Afternoon", "Night", "Rotating"], report=True),
                   _f("license_no", "Professional licence no."), _f("phone", "Phone", "phone")]},
    "religious": {"name": "Church / Mosque / Religious", "description": "Members attending services and meetings.",
        "labels": {"person_singular": "Member", "person_plural": "Members", "id_label": "Member No."},
        "fields": [_f("unit", "Unit / Group", show=True, report=True), _f("gender", "Gender", "select", options=GENDER),
                   _f("phone", "Phone", "phone", show=True), _f("date_joined", "Date joined", "date"), _f("address", "Address", "textarea")]},
    "ngo": {"name": "NGO / Non-profit", "description": "Staff, volunteers and programme participants.",
        "labels": {"person_singular": "Member", "person_plural": "Members", "id_label": "Member ID"},
        "fields": [_f("member_type", "Type", "select", options=["Staff", "Volunteer", "Beneficiary"], required=True, show=True, report=True),
                   _f("programme", "Programme", report=True), _f("phone", "Phone", "phone"), _f("email", "Email", "email")]},
    "government": {"name": "Government / Public sector", "description": "Civil servants and public officers.",
        "labels": {"person_singular": "Officer", "person_plural": "Officers", "id_label": "Service No."},
        "fields": [_f("grade_level", "Grade level", show=True, report=True), _f("position", "Designation", show=True, report=True),
                   _f("ministry", "Ministry / Agency"), _f("phone", "Phone", "phone"), _f("hire_date", "Date of first appointment", "date")]},
    "factory": {"name": "Factory / Manufacturing", "description": "Operators and technicians on production lines.",
        "labels": {"person_singular": "Worker", "person_plural": "Workers", "id_label": "Worker ID"},
        "fields": [_f("line", "Production line / Area", show=True, report=True),
                   _f("shift", "Shift", "select", options=["A", "B", "C", "General"], required=True, show=True, report=True),
                   _f("employment_type", "Employment type", "select", options=["Permanent", "Contract", "Casual"], report=True),
                   _f("contractor", "Contractor / Agency"), _f("phone", "Phone", "phone")]},
    "construction": {"name": "Construction / Site", "description": "Workers and subcontractors on project sites.",
        "labels": {"person_singular": "Worker", "person_plural": "Workers", "id_label": "Worker ID"},
        "fields": [_f("site", "Site / Project", required=True, show=True, report=True),
                   _f("trade", "Trade", "select", options=["Labourer", "Mason", "Carpenter", "Electrician", "Plumber", "Welder", "Supervisor"], show=True, report=True),
                   _f("contractor", "Subcontractor"), _f("safety_induction", "Safety induction done", "checkbox", report=True), _f("phone", "Phone", "phone")]},
    "retail": {"name": "Retail / Store", "description": "Store and branch staff.",
        "labels": {"person_singular": "Staff", "person_plural": "Staff", "id_label": "Staff No."},
        "fields": [_f("branch", "Branch / Store", required=True, show=True, report=True), _f("position", "Role", show=True),
                   _f("shift", "Shift", "select", options=["Morning", "Evening", "Full day"], report=True), _f("phone", "Phone", "phone")]},
    "hospitality": {"name": "Hotel / Hospitality", "description": "Hotel, restaurant and catering staff.",
        "labels": {"person_singular": "Staff", "person_plural": "Staff", "id_label": "Staff No."},
        "fields": [_f("position", "Role", show=True, report=True),
                   _f("shift", "Shift", "select", options=["Morning", "Afternoon", "Night"], show=True, report=True), _f("phone", "Phone", "phone")]},
    "gym": {"name": "Gym / Club / Membership", "description": "Members checking in to a facility.",
        "labels": {"person_singular": "Member", "person_plural": "Members", "id_label": "Membership No."},
        "fields": [_f("plan", "Membership plan", "select", options=["Monthly", "Quarterly", "Annual", "Day pass"], show=True, report=True),
                   _f("expiry_date", "Membership expiry", "date", show=True, report=True), _f("phone", "Phone", "phone"),
                   _f("emergency_contact", "Emergency contact phone", "phone")]},
    "event": {"name": "Event / Conference", "description": "Attendees registering for events and sessions.",
        "labels": {"person_singular": "Attendee", "person_plural": "Attendees", "id_label": "Ticket No."},
        "fields": [_f("ticket_type", "Ticket type", "select", options=["Regular", "VIP", "Speaker", "Staff"], show=True, report=True),
                   _f("organisation", "Organisation", report=True), _f("email", "Email", "email", show=True), _f("phone", "Phone", "phone")]},
    "custom": {"name": "Other / Custom", "description": "Start with the basics and add your own fields.",
        "labels": {"person_singular": "Person", "person_plural": "People", "id_label": "ID No."},
        "fields": [_f("email", "Email", "email"), _f("phone", "Phone", "phone")]},
}

DEFAULT_ORG_TYPE = "company"


def get_preset(org_type):
    return PRESETS.get((org_type or "").lower(), PRESETS[DEFAULT_ORG_TYPE])


def list_presets():
    return [{"key": k, "name": v["name"], "description": v["description"], "labels": v["labels"], "fields": v["fields"]}
            for k, v in PRESETS.items()]
