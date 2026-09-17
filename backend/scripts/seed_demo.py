"""Populate development/demo environments with realistic, legitimate examples.

Sample content follows the product specification §44: statistical analysis of
survey data, agricultural dashboards, sampling consultation, questionnaire
development, dataset cleaning, manuscript formatting, visualization and
methodology consultation. Nothing here normalizes academic misconduct.
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import security  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app import models  # noqa: F401, E402
from app.models import (  # noqa: E402
    ClientProfile, Conversation, ConversationParticipant, Deliverable,
    DeliverableVersion, Document, FeedCategory, FeedComment, FeedPost,
    FeedReaction, Invoice, InvoiceItem, Message, ModerationAction, ModerationCase,
    Opportunity, OpportunityInterest, OpportunityInvitation, Organization,
    OrganizationMember, Payment, PaymentTransaction, PortfolioItem, Publication,
    PlatformSetting, Payout, Project, ProjectAssignment, ProjectMilestone,
    ProjectStatusHistory, QCComment, QCReview, Qualification, Quote, QuoteItem,
    Report, ResearchField, ResearchRequest, ResearcherProfile, Review, Role,
    Service, User, UserRoleLink,
)
from app.models_enums import *  # noqa: E402, F403
from app.models_enums import (  # noqa: E402
    AssignmentStatus, DeliverableStatus, DocumentKind, FundsStatus,
    InterestStatus, InvitationStatus, InvoiceStatus, MilestoneStatus,
    OpportunityStatus, OpportunityVisibility, PaymentMethod, PaymentStatus,
    PayoutStatus, PostStatus, ProjectStatus, QCDecision, ReactionType,
    ReportKind, ReportStatus, RequestStatus, RiskLevel, UserRole, UserStatus,
    VerificationStatus, VersionStatus,
)
from app.services.ids import next_number  # noqa: E402

DEMO_PASSWORD = "wulweth-demo"
now = datetime.now(timezone.utc)


def days(n: int) -> datetime:
    return now + timedelta(days=n)


def days_ago(n: int) -> datetime:
    return now - timedelta(days=n)


def main(reset: bool = False) -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        if reset:
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(table.delete())
            db.commit()
            print("[seed] existing data cleared")
        seed_taxonomy(db)
        seed_roles(db)
        users = seed_users(db)
        seed_settings(db)
        seed_projects(db, users)
        seed_opportunities(db, users)
        seed_feed(db, users)
        seed_reports(db, users)
        db.commit()
        print("[seed] demo data ready — sign in with any listed email / password: " + DEMO_PASSWORD)
    finally:
        db.close()


# ---------------------------------------------------------------------------

TAXONOMY = {
    "Health Sciences": ["Medicine", "Nursing", "Public Health", "Epidemiology", "Pharmacy", "Biomedical Sciences", "Clinical Research"],
    "Social Sciences": ["Sociology", "Psychology", "Political Science", "Development Studies", "Anthropology"],
    "Education": ["Educational Research", "Curriculum Studies", "Educational Psychology", "Assessment", "Inclusive Education", "Teaching and Learning"],
    "Business and Economics": ["Economics", "Finance", "Accounting", "Marketing", "Management", "Entrepreneurship", "Business Analytics"],
    "Agriculture": ["Agricultural Sciences", "Agribusiness", "Soil Science", "Crop Science", "Animal Science", "Agricultural Economics"],
    "STEM": ["Biology", "Chemistry", "Physics", "Environmental Science", "Engineering", "Mathematics", "Computer Science"],
    "Data Science and Statistics": ["Statistics", "Data Science", "Machine Learning", "Data Analytics", "Data Management", "Data Visualization", "Statistical Programming"],
    "Research Methodology": ["Quantitative", "Qualitative", "Mixed Methods", "Experimental Research", "Survey Research", "Sampling", "Research Design"],
    "Publishing": ["Manuscript Editing", "Proofreading", "Journal Formatting", "Publication Preparation", "Research Communication"],
}

SERVICES = {
    "Research Design": [
        ("Research design consultation", "Structured guidance on study architecture, questions and feasibility."),
        ("Methodology development", "Rigorous methodology sections built for your context and discipline."),
        ("Study design", "Experimental, quasi-experimental, observational and evaluation designs."),
        ("Sampling design", "Probability and non-probability sampling frames with justification."),
        ("Sample size and power analysis", "Power calculations for means, proportions, models and equivalence tests."),
        ("Questionnaire development", "Valid, reliable instruments with cognitive pre-testing plans."),
        ("Survey design", "End-to-end survey programmes: modes, routing, pre-testing, fieldwork protocols."),
        ("Quantitative research design", "Designs grounded in measurement, causal inference and modelling."),
        ("Qualitative research design", "Interview, focus group, ethnographic and case study designs."),
        ("Mixed-methods research design", "Integration logic, sequencing and joint displays for MM studies."),
    ],
    "Statistical Analysis": [
        ("Descriptive statistics", "Clear summaries, distributions and cross-tabulations."),
        ("Inferential statistics", "Hypothesis testing with assumptions checked and reported honestly."),
        ("Regression analysis", "Linear, logistic, multinomial, ordered and multilevel models."),
        ("Correlation analysis", "Association analysis with interpretation guidance."),
        ("ANOVA", "One-way, factorial, repeated-measures and mixed models."),
        ("Chi-square analysis", "Categorical association and goodness-of-fit testing."),
        ("Non-parametric analysis", "Mann-Whitney, Kruskal-Wallis, Wilcoxon, Spearman and more."),
        ("Survival analysis", "Kaplan-Meier, Cox proportional hazards and time-to-event modelling."),
        ("Epidemiological analysis", "Prevalence, incidence, risk ratios and outbreak analytics."),
        ("Multivariate analysis", "PCA, factor analysis, cluster analysis and MANOVA."),
        ("Statistical modelling", "Model building, validation and transparent reporting."),
    ],
    "Data Services": [
        ("Data cleaning", "Systematic error detection, deduplication and repair with audit logs."),
        ("Data validation", "Range, logic and consistency checks documented for replication."),
        ("Data management", "Data dictionaries, storage plans and documentation."),
        ("Statistical programming", "Reproducible R, Python, Stata and SPSS syntax."),
        ("Data visualization", "Publication-quality figures that communicate findings accurately."),
        ("Dashboard development", "Interactive indicators for research, programmes and operations."),
        ("Data transformation", "Reshaping, recoding and harmonising datasets."),
        ("Database design", "Normalised schemas for research data capture."),
        ("Research data preparation", "Analysis-ready datasets with full provenance."),
    ],
    "Literature and Evidence": [
        ("Literature searching", "Comprehensive, documented searches across databases."),
        ("Literature review support", "Structured synthesis and thematic organisation."),
        ("Evidence mapping", "Evidence and gap maps for research prioritisation."),
        ("Systematic review support", "Protocol-driven screening, extraction and synthesis (PRISMA)."),
        ("Scoping review support", "Scoping reviews following JBI/PRISMA-ScR guidance."),
        ("Citation analysis", "Bibliometric and co-citation analysis."),
        ("Reference management", "Clean, accurate bibliographies in any major style."),
        ("Evidence synthesis", "Narrative and quantitative synthesis, including meta-analysis support."),
    ],
    "Research Consulting": [
        ("Research consultation", "Focused sessions to unblock any stage of your research."),
        ("Methodology consultation", "Expert review of methods before and during fieldwork."),
        ("Statistical consultation", "Analysis planning, interpretation and reviewer-response support."),
        ("Data consultation", "Data strategy, governance and tooling advice."),
        ("Research planning", "Realistic timelines, milestones and resource planning."),
        ("Research reporting", "Technical reports written for decision-makers."),
        ("Research presentation support", "Conference talks, posters and research briefs."),
    ],
    "Publishing Support": [
        ("Manuscript editing", "Substantive editing for clarity, structure and argument."),
        ("Proofreading", "Careful error correction before submission or printing."),
        ("Journal formatting", "Formatting to target-journal guidelines and reference styles."),
        ("Publication preparation", "Cover letters, abstracts, highlights and submission packages."),
        ("Reference formatting", "Accurate styling: APA, Vancouver, Harvard, Chicago and more."),
        ("Research communication", "Plain-language summaries, press notes and policy briefs."),
        ("Manuscript structure review", "Structural assessment with actionable recommendations."),
        ("Journal submission preparation", "Checklists, declarations and portal-ready files."),
    ],
}

FEED_CATEGORIES = [
    ("Research Updates", "Share progress, findings and research news."),
    ("Publications", "Announce articles, reports and books."),
    ("Conferences", "Calls for papers, events and conference insights."),
    ("Methodology", "Discussion of research methods and study design."),
    ("Data Science Insights", "Statistics, data management and visualization."),
    ("Publishing", "Journals, peer review and publishing practices."),
    ("Announcements", "Platform and community announcements."),
]


def seed_taxonomy(db) -> None:
    if db.query(ResearchField).count():
        return
    for group, fields in TAXONOMY.items():
        for name in fields:
            db.add(ResearchField(group=group, name=name, slug=name.lower().replace(" ", "-").replace("/", "-")))
    for category, services in SERVICES.items():
        for name, description in services:
            db.add(Service(category=category, name=name, slug=name.lower().replace(" ", "-").replace("/", "-"),
                           description=description,
                           deliverables_examples=["Method note", "Analysis output", "Summary document"][:2]))
    for name, description in FEED_CATEGORIES:
        db.add(FeedCategory(name=name, slug=name.lower().replace(" ", "-"), description=description))
    db.commit()
    print(f"[seed] taxonomy: {db.query(ResearchField).count()} fields, {db.query(Service).count()} services")


def seed_roles(db) -> None:
    if db.query(Role).count():
        return
    role_descriptions = {
        UserRole.CLIENT.value: "Requests and sponsors research services",
        UserRole.RESEARCHER.value: "Conducts research work as a Wulweth professional",
        UserRole.RESEARCH_CONSULTANT.value: "Advises on research design and methods",
        UserRole.DATA_SPECIALIST.value: "Provides statistical analysis and data services",
        UserRole.EDITOR.value: "Provides editing, proofreading and publishing support",
        UserRole.ORGANIZATION.value: "Organization account representing a company or institution",
        UserRole.MANAGER.value: "Coordinates projects, matching, quotes and review",
        UserRole.QC_REVIEWER.value: "Performs quality control on deliverables",
        UserRole.FINANCE.value: "Confirms payments and processes payouts",
        UserRole.ADMIN.value: "Administers the platform",
        UserRole.SUPER_ADMIN.value: "Full platform administration",
    }
    for code, description in role_descriptions.items():
        db.add(Role(id=code, name=code.replace("_", " ").title(), description=description))
    db.commit()


def seed_settings(db) -> None:
    if db.get(PlatformSetting, "fees"):
        return
    db.add(PlatformSetting(key="fees", value={
        "default_percent": 15.0,
        "per_service": {},
        "note": "Percentage deducted from the professional payout once a project completes.",
    }, updated_at=now))
    db.commit()


def user(db, email, name, role, title=None, country="Botswana", city=None, verified_days_ago=30, status=UserStatus.ACTIVE.value):
    u = db.query(User).filter(User.email == email).first()
    if u:
        return u
    u = User(email=email, password_hash=security.hash_password(DEMO_PASSWORD), full_name=name,
             role=role.value if isinstance(role, UserRole) else role, professional_title=title,
             country=country, city=city, status=status,
             email_verified_at=days_ago(verified_days_ago) if verified_days_ago is not None else None,
             notification_prefs={})
    db.add(u)
    db.flush()
    db.add(UserRoleLink(user_id=u.id, role_id=u.role))
    return u


def profile(db, u, **kw):
    p = ResearcherProfile(user_id=u.id, professional_title=kw.pop("professional_title", None), **kw)
    db.add(p)
    db.flush()
    return p


def seed_users(db) -> dict:
    if db.query(User).count() > 3:
        db.commit()
        return {u.email: u for u in db.query(User).all()}

    admin = user(db, "admin@wulweth.example", "Dr. Naledi Mokgethwa", UserRole.SUPER_ADMIN,
                 "Platform Director", city="Gaborone")
    manager = user(db, "manager@wulweth.example", "Tumelo Kgosi", UserRole.MANAGER,
                   "Research Programmes Manager", city="Gaborone")
    qc = user(db, "qc@wulweth.example", "Prof. Amina Yusuf", UserRole.QC_REVIEWER,
              "Senior Quality Reviewer", country="Kenya", city="Nairobi")
    finance = user(db, "finance@wulweth.example", "Kabelo Sithole", UserRole.FINANCE,
                   "Finance Lead", city="Gaborone")

    # ---------------- professionals -------------------------------------
    lerato = user(db, "lerato@wulweth.example", "Dr. Lerato Moeng", UserRole.RESEARCHER,
                  "Public Health Researcher", city="Gaborone")
    samuel = user(db, "samuel@wulweth.example", "Dr. Samuel Owusu", UserRole.RESEARCH_CONSULTANT,
                  "Research Methods Consultant", country="Ghana", city="Accra")
    naledi_p = user(db, "naledi.stats@wulweth.example", "Naledi Phiri", UserRole.DATA_SPECIALIST,
                    "Statistical Analyst", city="Gaborone")
    grace = user(db, "grace@wulweth.example", "Grace Adeyemi", UserRole.EDITOR,
                 "Academic Editor & Publishing Specialist", country="Nigeria", city="Lagos")
    kefilwe = user(db, "kefilwe@wulweth.example", "Dr. Kefilwe Raditsebe", UserRole.RESEARCHER,
                   "Agricultural Economist", city="Palapye")
    tshepo = user(db, "tshepo@wulweth.example", "Tshepo Baloyi", UserRole.DATA_SPECIALIST,
                  "Data Engineer & Dashboard Developer", city="Francistown")

    fields = {f.name: f for f in db.query(ResearchField).all()}
    services = {s.name: s for s in db.query(Service).all()}

    def field_ids(*names):
        return [fields[n].id for n in names if n in fields]

    profile(db, lerato, professional_title="Public Health Researcher",
            bio="Public health researcher with nine years of experience in community health surveys, "
                "epidemiological analysis and health systems evaluation. I support study teams with "
                "analysis planning, survey data analysis and clear reporting for policy audiences.",
            disciplines=["Health Sciences", "Research Methodology"],
            research_field_ids=field_ids("Public Health", "Epidemiology", "Quantitative", "Survey Research"),
            expertise=["Community health surveys", "Health systems research", "Epidemiological analysis", "Survey data analysis", "Research reporting"],
            methodologies=["Quantitative", "Mixed Methods", "Survey Research"],
            statistical_methods=["Regression analysis", "Survival analysis", "Chi-square analysis", "Multilevel modelling"],
            software=["Stata", "R", "SPSS"], industries=["Healthcare", "NGO", "Government"],
            languages=["English", "Setswana"], years_experience=9,
            availability="PART_TIME", location="Gaborone, Botswana",
            verification=VerificationStatus.VERIFIED.value, profile_status=ProfileStatus.PUBLISHED.value,
            services_offer_slugs=[services[n].slug for n in ["Descriptive statistics", "Inferential statistics", "Regression analysis", "Epidemiological analysis", "Survey design"] if n in services])
    db.flush()

    profile(db, samuel, professional_title="Research Methods Consultant",
            bio="Methods consultant supporting postgraduate researchers, NGOs and university teams with "
                "study design, sampling strategy and mixed-methods integration. My focus is defensible, "
                "feasible designs and honest interpretation.",
            disciplines=["Research Methodology", "Social Sciences", "Education"],
            research_field_ids=field_ids("Research Design", "Mixed Methods", "Qualitative", "Sampling"),
            expertise=["Study design", "Sampling strategy", "Qualitative interviews", "Focus groups", "Instrument validation"],
            methodologies=["Mixed Methods", "Qualitative", "Survey Research", "Experimental Research"],
            statistical_methods=["Sample size and power analysis", "Thematic analysis support"],
            software=["NVivo", "MAXQDA", "R"], industries=["Education", "Development", "University"],
            languages=["English"], years_experience=12, availability="CONTRACT",
            location="Accra, Ghana", verification=VerificationStatus.VERIFIED.value,
            profile_status=ProfileStatus.PUBLISHED.value)

    profile(db, naledi_p, professional_title="Statistical Analyst",
            bio="Statistical analyst specialising in reproducible analysis pipelines for survey and "
                "clinical data. I document every step so your team can defend and replicate results.",
            disciplines=["Data Science and Statistics", "Health Sciences"],
            research_field_ids=field_ids("Statistics", "Data Analytics", "Statistical Programming"),
            expertise=["Reproducible analysis", "Survey weighting", "Regression modelling", "Data cleaning", "Statistical reporting"],
            methodologies=["Quantitative", "Survey Research"],
            statistical_methods=["Regression analysis", "ANOVA", "Non-parametric analysis", "Survival analysis"],
            software=["R", "Python", "Stata", "SPSS"], industries=["Healthcare", "Research", "Finance"],
            languages=["English"], years_experience=6, availability="FULL_TIME",
            location="Gaborone, Botswana", verification=VerificationStatus.VERIFIED.value,
            profile_status=ProfileStatus.PUBLISHED.value)

    profile(db, grace, professional_title="Academic Editor & Publishing Specialist",
            bio="Editor and publishing specialist with a background in life sciences. I help researchers "
                "prepare manuscripts for submission: substantive editing, journal formatting and complete "
                "submission packages prepared to journal guidelines.",
            disciplines=["Publishing", "Health Sciences"],
            research_field_ids=field_ids("Manuscript Editing", "Proofreading", "Journal Formatting", "Publication Preparation"),
            expertise=["Substantive editing", "Journal formatting", "Cover letters", "Submission checklists", "Reference styling"],
            methodologies=["Editorial workflows"],
            statistical_methods=[], software=["EndNote", "Zotero", "Adobe Acrobat"],
            industries=["Publishing", "University"], languages=["English"],
            years_experience=8, availability="PART_TIME", location="Lagos, Nigeria",
            verification=VerificationStatus.VERIFIED.value, profile_status=ProfileStatus.PUBLISHED.value)

    profile(db, kefilwe, professional_title="Agricultural Economist",
            bio="Agricultural economist working on market analysis, farm-level survey data and value "
                "chain studies across Southern Africa.",
            disciplines=["Agriculture", "Business and Economics"],
            research_field_ids=field_ids("Agricultural Economics", "Agribusiness", "Economics"),
            expertise=["Value chain analysis", "Farm survey analysis", "Market studies"],
            methodologies=["Quantitative", "Survey Research"],
            statistical_methods=["Regression analysis", "Descriptive statistics"],
            software=["Stata", "Excel"], industries=["Agriculture", "Development"],
            languages=["English", "Setswana"], years_experience=5, availability="PART_TIME",
            location="Palapye, Botswana", verification=VerificationStatus.PENDING.value,
            profile_status=ProfileStatus.PUBLISHED.value)

    profile(db, tshepo, professional_title="Data Engineer & Dashboard Developer",
            bio="I build research data pipelines and indicator dashboards that teams actually use — "
                "from raw data capture to live visual reporting.",
            disciplines=["Data Science and Statistics", "STEM"],
            research_field_ids=field_ids("Data Visualization", "Data Management", "Data Science"),
            expertise=["Dashboard development", "ETL pipelines", "Indicator design", "Data quality monitoring"],
            methodologies=["Data engineering"],
            statistical_methods=["Descriptive statistics"],
            software=["Python", "PostgreSQL", "Power BI", "Excel"], industries=["NGO", "Government", "Agriculture"],
            languages=["English"], years_experience=7, availability="FULL_TIME",
            location="Francistown, Botswana", verification=VerificationStatus.VERIFIED.value,
            profile_status=ProfileStatus.PUBLISHED.value)

    # attach a verified qualification to each professional with profile row
    for u in (lerato, samuel, naledi_p, grace, kefilwe, tshepo):
        p = db.query(ResearcherProfile).filter(ResearcherProfile.user_id == u.id).first()
        degree = {"Dr. Lerato Moeng": ("PhD Epidemiology", "University of Botswana", 2018),
                  "Dr. Samuel Owusu": ("PhD Research Methods", "University of Ghana", 2012),
                  "Naledi Phiri": ("MSc Statistics", "University of Cape Town", 2019),
                  "Grace Adeyemi": ("MA English Language Editing", "University of Ibadan", 2015),
                  "Dr. Kefilwe Raditsebe": ("PhD Agricultural Economics", "University of Pretoria", 2020),
                  "Tshepo Baloyi": ("BSc Computer Science", "Botswana International University of Science & Technology", 2016)}[u.full_name]
        db.add(Qualification(profile_id=p.id, degree=degree[0], institution=degree[1],
                             year=degree[2], verification=VerificationStatus.VERIFIED.value if u is not kefilwe else VerificationStatus.PENDING.value))

    pub = Publication(profile_id=db.query(ResearcherProfile).filter(ResearcherProfile.user_id == lerato.id).first().id,
                      title="Antenatal care utilisation and birth outcomes in semi-urban Botswana: a cross-sectional analysis",
                      journal="Botswana Journal of Health Sciences", year=2023, pub_type="Journal Article",
                      description="Analysis of 1,200 household survey responses on care utilisation.")
    db.add(pub)
    db.add(Publication(profile_id=db.query(ResearcherProfile).filter(ResearcherProfile.user_id == naledi_p.id).first().id,
                       title="A reproducible R workflow for complex survey analysis in small research teams",
                       journal="African Journal of Data Science", year=2024, pub_type="Journal Article"))

    db.add(PortfolioItem(profile_id=db.query(ResearcherProfile).filter(ResearcherProfile.user_id == tshepo.id).first().id,
                         title="Water point functionality indicator dashboard",
                         description="Interactive dashboard tracking rural water point functionality for a district council, "
                                     "with monthly indicator refresh and exportable summaries.",
                         discipline="Environmental Science", methods=["Indicator design", "Data pipelines"], year=2024))
    db.add(PortfolioItem(profile_id=db.query(ResearcherProfile).filter(ResearcherProfile.user_id == grace.id).first().id,
                         title="Journal submission package — immunisation coverage study",
                         description="Substantive edit and complete submission package prepared for a public health journal.",
                         discipline="Public Health", methods=["Substantive editing", "Journal formatting"], year=2024))

    # ---------------- clients & organization -----------------------------
    mpho = user(db, "client@wulweth.example", "Dr. Mpho Setlhare", UserRole.CLIENT,
                "Senior Lecturer, Public Health", city="Gaborone")
    db.add(ClientProfile(user_id=mpho.id, display_name="Dr. Mpho Setlhare"))

    ipeleng = user(db, "org.admin@kdi.example", "Ipeleng Dube", UserRole.ORGANIZATION,
                   "Programme Director", city="Maun")
    org = Organization(name="Kalahari Development Institute", org_type="NGO",
                       industry="International Development", website="https://kdi.example.org",
                       description="Independent development research institute working on rural livelihoods, "
                                   "water access and food security programmes across Botswana.",
                       country="Botswana", city="Maun", created_by=ipeleng.id,
                       verification=VerificationStatus.VERIFIED.value)
    db.add(org)
    db.flush()
    db.add(OrganizationMember(organization_id=org.id, user_id=ipeleng.id, member_role=OrgMemberRole.OWNER.value, status="ACTIVE"))
    keabetswe = user(db, "keabetswe@kdi.example", "Keabetswe Mmusi", UserRole.CLIENT, "M&E Officer", city="Maun")
    db.add(OrganizationMember(organization_id=org.id, user_id=keabetswe.id, member_role=OrgMemberRole.MEMBER.value, status="ACTIVE"))
    db.add(ClientProfile(user_id=keabetswe.id, organization_id=org.id, display_name="Keabetswe Mmusi (KDI)"))
    db.add(ClientProfile(user_id=ipeleng.id, organization_id=org.id, display_name="Ipeleng Dube (KDI)"))

    db.commit()
    print(f"[seed] users: {db.query(User).count()}")
    return {"admin": admin, "manager": manager, "qc": qc, "finance": finance,
            "lerato": lerato, "samuel": samuel, "naledi": naledi_p, "grace": grace,
            "kefilwe": kefilwe, "tshepo": tshepo, "client": mpho, "org_admin": ipeleng,
            "org_member": keabetswe, "org": org}


def _service(db, name):
    return db.query(Service).filter(Service.name == name).first()


def _field(db, name):
    return db.query(ResearchField).filter(ResearchField.name == name).first()


def _mk_request(db, client, title, discipline, field_name, service_name, status, description,
                objective=None, budget=(1500, 2500), deadline_days=45, risk=None, submitted_days_ago=None,
                currency="USD", data_availability="HAVE_DATA", org_id=None):
    r = ResearchRequest(tracking_id=next_number(db, "request", "WUL") if status != RequestStatus.DRAFT.value else None,
                        client_id=client.id, organization_id=org_id, title=title, discipline=discipline,
                        research_field_id=_field(db, field_name).id if field_name and _field(db, field_name) else None,
                        service_id=_service(db, service_name).id if service_name and _service(db, service_name) else None,
                        objective=objective or f"Deliver {service_name} that meets academic and practical standards.",
                        description=description, methodology=None,
                        data_availability=data_availability, expected_deliverables="Analysis outputs with documented methods and a summary report.",
                        deadline=days(deadline_days), budget_min=budget[0], budget_max=budget[1], currency=currency,
                        status=status.value, risk_level=risk,
                        submitted_at=days_ago(submitted_days_ago) if submitted_days_ago else None)
    db.add(r)
    db.flush()
    return r


def seed_projects(db, users) -> None:
    if db.query(Project).count():
        return
    manager, qc, finance = users["manager"], users["qc"], users["finance"]
    client, org_admin, org = users["client"], users["org_admin"], users["org"]
    lerato, naledi, tshepo, grace, samuel = users["lerato"], users["naledi"], users["tshepo"], users["grace"], users["samuel"]

    def history(project, to_status, when, by=None, note=None, trigger=None, from_status=None):
        db.add(ProjectStatusHistory(project_id=project.id, from_status=from_status, to_status=to_status,
                                    changed_by=by.id if by else None, note=note, system_trigger=trigger, created_at=when))

    def convo_for(project, participants):
        c = Conversation(project_id=project.id, subject=f"Project {project.tracking_id} — {project.title[:120]}")
        db.add(c)
        db.flush()
        for u in participants:
            db.add(ConversationParticipant(conversation_id=c.id, user_id=u.id, last_read_at=now))
        return c

    # =============== 1. completed project: survey data analysis ===========
    r1 = _mk_request(db, client, "Statistical analysis of community health survey data", "Health Sciences",
                     "Public Health", "Regression analysis", RequestStatus.CONVERTED,
                     "We completed a community health survey (n≈1,150 households) and need a rigorous statistical "
                     "analysis: descriptive summaries, association testing and a logistic regression on care-seeking "
                     "behaviour. All data were collected with ethical approval; the analysis will inform a district "
                     "health report.",
                     objective="Understand predictors of facility-based care seeking", budget=(1800, 2600),
                     submitted_days_ago=70)
    p1 = Project(tracking_id=next_number(db, "project", "WUL"), request_id=r1.id, client_id=client.id,
                 service_id=r1.service_id, title=r1.title, description=r1.description, deadline=days(-10),
                 currency="USD", quoted_amount=2200, fee_percent=15, fee_amount=330, funds_status=FundsStatus.RELEASED.value,
                 status=ProjectStatus.PAYMENT_RELEASED.value, started_at=days_ago(55), completed_at=days_ago(12),
                 assigned_professional_id=naledi.id, created_at=days_ago(68))
    db.add(p1)
    db.flush()
    r1.project_id = p1.id
    for st, when, by, note in [
        (ProjectStatus.UNDER_REVIEW.value, days_ago(68), manager, "Project opened from research request"),
        (ProjectStatus.QUOTE_PREPARED.value, days_ago(66), manager, "Quote prepared"),
        (ProjectStatus.AWAITING_CLIENT_APPROVAL.value, days_ago(65), manager, "Quote sent for approval"),
        (ProjectStatus.PAYMENT_PENDING.value, days_ago(64), client, "Quote approved by client"),
        (ProjectStatus.PAYMENT_CONFIRMED.value, days_ago(60), finance, "Payment received"),
        (ProjectStatus.PROFESSIONAL_ASSIGNED.value, days_ago(58), manager, f"Assigned to {naledi.full_name}"),
        (ProjectStatus.IN_PROGRESS.value, days_ago(57), naledi, "Assignment accepted"),
        (ProjectStatus.SUBMITTED.value, days_ago(35), naledi, "Version 1 submitted"),
        (ProjectStatus.QUALITY_REVIEW.value, days_ago(34), qc, None),
        (ProjectStatus.REVISION_REQUIRED.value, days_ago(33), qc, "Reporting template alignment requested"),
        (ProjectStatus.SUBMITTED.value, days_ago(25), naledi, "Version 2 submitted"),
        (ProjectStatus.QUALITY_REVIEW.value, days_ago(24), qc, None),
        (ProjectStatus.APPROVED.value, days_ago(22), qc, "All deliverables approved"),
        (ProjectStatus.COMPLETED.value, days_ago(20), finance, "Payout prepared"),
        (ProjectStatus.PAYMENT_RELEASED.value, days_ago(18), finance, "Payout completed"),
    ]:
        history(p1, st, when, by, note)

    q1 = Quote(quote_number=next_number(db, "quote", "QT"), project_id=p1.id, request_id=r1.id, client_id=client.id,
               prepared_by=manager.id, currency="USD", tax_percent=0, valid_until=days_ago(30),
               status=QuoteStatus.APPROVED.value, sent_at=days_ago(65), viewed_at=days_ago(64), decided_at=days_ago(64),
               created_at=days_ago(66), notes="Fixed-fee analysis package including one revision round.")
    db.add(q1)
    db.flush()
    db.add(QuoteItem(quote_id=q1.id, description="Statistical analysis — descriptive summaries and cross-tabulations",
                     quantity=1, unit_price=700, line_total=700, position=0))
    db.add(QuoteItem(quote_id=q1.id, description="Logistic regression on care-seeking behaviour with assumption checks",
                     quantity=1, unit_price=1100, line_total=1100, position=1))
    db.add(QuoteItem(quote_id=q1.id, description="Reproducible R syntax and results workbook", quantity=1, unit_price=400, line_total=400, position=2))
    q1.subtotal, q1.tax_amount, q1.total = 2200, 0, 2200

    inv1 = Invoice(invoice_number=next_number(db, "invoice", "INV"), quote_id=q1.id, project_id=p1.id,
                   client_id=client.id, issued_by=manager.id, currency="USD", subtotal=2200, tax_percent=0,
                   tax_amount=0, total=2200, amount_paid=2200, status=InvoiceStatus.PAID.value,
                   due_date=days_ago(46), issued_at=days_ago(64), paid_at=days_ago(60), created_at=days_ago(64))
    db.add(inv1)
    db.flush()
    db.add(InvoiceItem(invoice_id=inv1.id, description="Statistical analysis package (per approved quote)", quantity=1, unit_price=2200, line_total=2200, position=0))

    pay1 = Payment(reference=next_number(db, "payment", "PAY"), invoice_id=inv1.id, project_id=p1.id,
                   client_id=client.id, amount=2200, currency="USD", method=PaymentMethod.BANK_TRANSFER.value,
                   provider="manual", provider_ref="TRF-9023341", status=PaymentStatus.CONFIRMED.value,
                   confirmed_by=finance.id, confirmed_at=days_ago(60), created_at=days_ago(61))
    db.add(pay1)
    db.flush()
    db.add(PaymentTransaction(project_id=p1.id, payment_id=pay1.id, entry_type="CHARGE", amount=2200,
                              currency="USD", status="RECORDED", provider="manual", provider_ref="TRF-9023341",
                              description=f"Client payment for invoice {inv1.invoice_number}", actor_id=finance.id, created_at=days_ago(60)))

    d1 = Deliverable(project_id=p1.id, title="Analysis report and outputs", status=DeliverableStatus.APPROVED.value,
                     created_by=manager.id, current_version_number=2, created_at=days_ago(56))
    db.add(d1)
    db.flush()
    doc1a = Document(owner_id=naledi.id, kind=DocumentKind.DELIVERABLE.value, project_id=p1.id,
                     filename="health-survey-analysis-v1.pdf", content_type="application/pdf",
                     size_bytes=482113, storage_key="seed/not-stored.bin", scan_status="CLEAN", created_at=days_ago(35))
    doc1b = Document(owner_id=naledi.id, kind=DocumentKind.DELIVERABLE.value, project_id=p1.id,
                     filename="health-survey-analysis-v2.pdf", content_type="application/pdf",
                     size_bytes=517902, storage_key="seed/not-stored.bin", scan_status="CLEAN", created_at=days_ago(25))
    db.add_all([doc1a, doc1b])
    db.flush()
    v1 = DeliverableVersion(deliverable_id=d1.id, version_number=1, document_id=doc1a.id, uploaded_by=naledi.id,
                            notes="Full analysis draft with descriptive tables and regression output.",
                            status=VersionStatus.REVISION_REQUIRED.value, submitted_at=days_ago(35), copyright_confirmed=True)
    v2 = DeliverableVersion(deliverable_id=d1.id, version_number=2, document_id=doc1b.id, uploaded_by=naledi.id,
                            notes="Revision per QC notes: reporting template applied, tables renumbered, limitations expanded.",
                            status=VersionStatus.APPROVED.value, submitted_at=days_ago(25), copyright_confirmed=True)
    db.add_all([v1, v2])
    db.flush()
    db.add(QCReview(deliverable_version_id=v1.id, reviewer_id=qc.id, decision=QCDecision.REVISION_REQUIRED.value,
                    summary="Strong analysis overall. Requested revisions: align tables with the district reporting "
                            "template, renumber exhibits, and expand the limitations section on sampling frame coverage.",
                    checklist={"assumptions_documented": True, "reproducible_syntax": True, "reporting_template": False},
                    created_at=days_ago(33)))
    db.add(QCComment(version_id=v1.id, author_id=qc.id, body="Table 4 would read better ordered by odds ratio. "
                                                          "Please also cite the weighting approach used.", created_at=days_ago(33)))
    db.add(QCReview(deliverable_version_id=v2.id, reviewer_id=qc.id, decision=QCDecision.APPROVED.value,
                    summary="All requested revisions applied. Assumptions documented, syntax reproducible, "
                            "reporting template followed. Approved.",
                    checklist={"assumptions_documented": True, "reproducible_syntax": True, "reporting_template": True},
                    created_at=days_ago(22)))

    po1 = Payout(payout_number=next_number(db, "payout", "PO"), professional_id=naledi.id, project_id=p1.id,
                 gross_amount=2200, fee_amount=330, processing_fee=0, net_amount=1870, currency="USD",
                 status=PayoutStatus.COMPLETED.value, method="BANK_TRANSFER", destination="**** 4471",
                 transaction_ref="PAYOUT-77120", requested_at=days_ago(20), approved_by=finance.id,
                 approved_at=days_ago(19), completed_at=days_ago(18))
    db.add(po1)
    db.flush()
    db.add(PaymentTransaction(project_id=p1.id, payout_id=po1.id, entry_type="PAYOUT", amount=1870, currency="USD",
                              status="RECORDED", description="Professional payout", actor_id=finance.id, created_at=days_ago(18)))
    db.add(PaymentTransaction(project_id=p1.id, payout_id=po1.id, entry_type="FEE", amount=330, currency="USD",
                              status="RECORDED", description="Wulweth service fee", actor_id=finance.id, created_at=days_ago(18)))

    db.add(Review(project_id=p1.id, author_id=client.id, subject_user_id=naledi.id, professionalism=5,
                  communication=5, quality=5, timeliness=4, expertise=5,
                  comment="Clear documentation and a defensible analysis. The QC process gave us real confidence.",
                  created_at=days_ago(17)))

    c1 = convo_for(p1, [client, naledi, manager])
    db.add(Message(conversation_id=c1.id, sender_id=manager.id, body="Welcome to the project workspace. Naledi has been assigned for the statistical analysis; timelines and deliverables are in the overview.", created_at=days_ago(57)))
    db.add(Message(conversation_id=c1.id, sender_id=naledi.id, body="Thank you. I have reviewed the dataset — 1,147 complete responses after cleaning. I will share the descriptive tables by Friday.", created_at=days_ago(55)))
    db.add(Message(conversation_id=c1.id, sender_id=client.id, body="Wonderful. The district team is particularly interested in the care-seeking regression.", created_at=days_ago(54)))
    db.add(Message(conversation_id=c1.id, sender_id=naledi.id, body="Version 2 has been uploaded with the reporting template applied.", created_at=days_ago(25)))

    # =============== 2. in progress: dashboard for NGO ====================
    r2 = _mk_request(db, org_admin, "Agricultural indicator dashboard for district programme", "Agriculture",
                     "Agribusiness", "Dashboard development", RequestStatus.CONVERTED,
                     "Our field teams collect monthly crop and market price indicators across three districts. "
                     "We need a dashboard that visualises these indicators for programme managers, with monthly "
                     "refresh and exportable summaries. We own all data.",
                     budget=(2500, 4000), deadline_days=30, org_id=org.id, submitted_days_ago=40, data_availability="HAVE_DATA")
    p2 = Project(tracking_id=next_number(db, "project", "WUL"), request_id=r2.id, client_id=org_admin.id,
                 organization_id=org.id, service_id=r2.service_id, title=r2.title, description=r2.description,
                 deadline=days(25), currency="USD", quoted_amount=3400, fee_percent=15, fee_amount=510,
                 funds_status=FundsStatus.PENDING_RELEASE.value, status=ProjectStatus.SUBMITTED.value,
                 started_at=days_ago(28), assigned_professional_id=tshepo.id, created_at=days_ago(38))
    db.add(p2)
    db.flush()
    r2.project_id = p2.id
    for st, when, by, note in [
        (ProjectStatus.UNDER_REVIEW.value, days_ago(38), manager, "Project opened"),
        (ProjectStatus.QUOTE_PREPARED.value, days_ago(37), manager, None),
        (ProjectStatus.AWAITING_CLIENT_APPROVAL.value, days_ago(36), manager, None),
        (ProjectStatus.PAYMENT_PENDING.value, days_ago(35), org_admin, "Quote approved"),
        (ProjectStatus.PAYMENT_CONFIRMED.value, days_ago(32), finance, "Payment received"),
        (ProjectStatus.PROFESSIONAL_ASSIGNED.value, days_ago(30), manager, f"Assigned to {tshepo.full_name}"),
        (ProjectStatus.IN_PROGRESS.value, days_ago(29), tshepo, "Assignment accepted"),
        (ProjectStatus.SUBMITTED.value, days_ago(3), tshepo, "Version 1 submitted"),
    ]:
        history(p2, st, when, by, note)

    d2 = Deliverable(project_id=p2.id, title="Indicator dashboard (v1)", status=DeliverableStatus.SUBMITTED.value,
                     created_by=manager.id, current_version_number=1, created_at=days_ago(27))
    db.add(d2)
    db.flush()
    doc2 = Document(owner_id=tshepo.id, kind=DocumentKind.DELIVERABLE.value, project_id=p2.id,
                    filename="kdi-dashboard-handover-v1.pdf", content_type="application/pdf",
                    size_bytes=912044, storage_key="seed/not-stored.bin", scan_status="CLEAN", created_at=days_ago(3))
    db.add(doc2)
    db.flush()
    v2b = DeliverableVersion(deliverable_id=d2.id, version_number=1, document_id=doc2.id, uploaded_by=tshepo.id,
                             notes="Dashboard handover pack: indicator definitions, refresh workflow and sample views.",
                             status=VersionStatus.SUBMITTED.value, submitted_at=days_ago(3), copyright_confirmed=True)
    db.add(v2b)
    db.add(ProjectMilestone(project_id=p2.id, title="Indicator framework agreed", status=MilestoneStatus.DONE.value, position=0))
    db.add(ProjectMilestone(project_id=p2.id, title="Data pipeline and storage", status=MilestoneStatus.DONE.value, position=1))
    db.add(ProjectMilestone(project_id=p2.id, title="Dashboard build and handover", status=MilestoneStatus.IN_PROGRESS.value, position=2))
    q2 = Quote(quote_number=next_number(db, "quote", "QT"), project_id=p2.id, request_id=r2.id, client_id=org_admin.id,
               prepared_by=manager.id, currency="USD", tax_percent=0, valid_until=days(5),
               status=QuoteStatus.APPROVED.value, sent_at=days_ago(36), viewed_at=days_ago(35), decided_at=days_ago(35),
               created_at=days_ago(37))
    db.add(q2)
    db.flush()
    db.add(QuoteItem(quote_id=q2.id, description="Dashboard development — 12 indicators across 3 districts", quantity=1, unit_price=2800, line_total=2800, position=0))
    db.add(QuoteItem(quote_id=q2.id, description="Data pipeline and monthly refresh workflow", quantity=1, unit_price=600, line_total=600, position=1))
    q2.subtotal, q2.tax_amount, q2.total = 3400, 0, 3400
    inv2 = Invoice(invoice_number=next_number(db, "invoice", "INV"), quote_id=q2.id, project_id=p2.id,
                   client_id=org_admin.id, issued_by=manager.id, currency="USD", subtotal=3400, total=3400,
                   amount_paid=3400, status=InvoiceStatus.PAID.value, due_date=days(-18), issued_at=days_ago(35),
                   paid_at=days_ago(32), created_at=days_ago(35))
    db.add(inv2)
    db.flush()
    db.add(InvoiceItem(invoice_id=inv2.id, description="Dashboard development (per approved quote)", quantity=1, unit_price=3400, line_total=3400, position=0))
    pay2 = Payment(reference=next_number(db, "payment", "PAY"), invoice_id=inv2.id, project_id=p2.id,
                   client_id=org_admin.id, amount=3400, currency="USD", method=PaymentMethod.BANK_TRANSFER.value,
                   provider="manual", provider_ref="TRF-9045512", status=PaymentStatus.CONFIRMED.value,
                   confirmed_by=finance.id, confirmed_at=days_ago(32), created_at=days_ago(33))
    db.add(pay2)
    c2 = convo_for(p2, [org_admin, tshepo, manager])
    db.add(Message(conversation_id=c2.id, sender_id=manager.id, body="Tshepo will lead the dashboard build. Kick-off notes are in the project overview.", created_at=days_ago(29)))
    db.add(Message(conversation_id=c2.id, sender_id=tshepo.id, body="Received the October–December indicator files. One question: should market prices be normalised per kg or per unit?", created_at=days_ago(20)))
    db.add(Message(conversation_id=c2.id, sender_id=org_admin.id, body="Per kg, please — that matches how the field teams report.", created_at=days_ago(19)))

    # =============== 3. awaiting client approval: sampling consultation ===
    r3 = _mk_request(db, client, "Sampling design consultation for household survey", "Research Methodology",
                     "Sampling", "Sampling design", RequestStatus.CONVERTED,
                     "We are planning a household survey on water access and need help designing a defensible "
                     "sampling strategy: sampling frame, stratification, cluster selection and sample size "
                     "justification for a district-level estimate.",
                     budget=(800, 1400), deadline_days=40, submitted_days_ago=12)
    p3 = Project(tracking_id=next_number(db, "project", "WUL"), request_id=r3.id, client_id=client.id,
                 service_id=r3.service_id, title=r3.title, description=r3.description, deadline=days(40),
                 currency="USD", quoted_amount=1150, funds_status=FundsStatus.NONE.value,
                 status=ProjectStatus.AWAITING_CLIENT_APPROVAL.value, created_at=days_ago(11))
    db.add(p3)
    db.flush()
    r3.project_id = p3.id
    history(p3, ProjectStatus.UNDER_REVIEW.value, days_ago(11), manager, "Project opened")
    history(p3, ProjectStatus.QUOTE_PREPARED.value, days_ago(9), manager, None)
    history(p3, ProjectStatus.AWAITING_CLIENT_APPROVAL.value, days_ago(8), manager, "Quote sent for approval")
    q3 = Quote(quote_number=next_number(db, "quote", "QT"), project_id=p3.id, request_id=r3.id, client_id=client.id,
               prepared_by=manager.id, currency="USD", tax_percent=0, valid_until=days(22),
               status=QuoteStatus.SENT.value, sent_at=days_ago(8), created_at=days_ago(9),
               notes="Includes two consultation sessions and a written sampling plan.")
    db.add(q3)
    db.flush()
    db.add(QuoteItem(quote_id=q3.id, description="Sampling design consultation (two sessions)", quantity=2, unit_price=350, line_total=700, position=0))
    db.add(QuoteItem(quote_id=q3.id, description="Written sampling plan with power justification", quantity=1, unit_price=450, line_total=450, position=1))
    q3.subtotal, q3.tax_amount, q3.total = 1150, 0, 1150

    # =============== 4. payment confirmed: questionnaire development ======
    r4 = _mk_request(db, org_admin, "Questionnaire development for education access study", "Education",
                     "Educational Research", "Questionnaire development", RequestStatus.CONVERTED,
                     "We are studying barriers to school access in remote communities. We need a validated "
                     "questionnaire covering household education spending, travel time and attitudes, with "
                     "translation notes for fieldworkers.",
                     budget=(1200, 2000), deadline_days=50, org_id=org.id, submitted_days_ago=20)
    p4 = Project(tracking_id=next_number(db, "project", "WUL"), request_id=r4.id, client_id=org_admin.id,
                 organization_id=org.id, service_id=r4.service_id, title=r4.title, description=r4.description,
                 deadline=days(50), currency="USD", quoted_amount=1650, fee_percent=15, fee_amount=247.5,
                 funds_status=FundsStatus.PENDING_RELEASE.value, status=ProjectStatus.PAYMENT_CONFIRMED.value,
                 created_at=days_ago(19))
    db.add(p4)
    db.flush()
    r4.project_id = p4.id
    for st, when, by in [(ProjectStatus.UNDER_REVIEW.value, days_ago(19), manager),
                         (ProjectStatus.QUOTE_PREPARED.value, days_ago(17), manager),
                         (ProjectStatus.AWAITING_CLIENT_APPROVAL.value, days_ago(16), manager),
                         (ProjectStatus.PAYMENT_PENDING.value, days_ago(15), org_admin),
                         (ProjectStatus.PAYMENT_CONFIRMED.value, days_ago(10), finance)]:
        history(p4, st, when, by, note=None)
    q4 = Quote(quote_number=next_number(db, "quote", "QT"), project_id=p4.id, request_id=r4.id, client_id=org_admin.id,
               prepared_by=manager.id, currency="USD", status=QuoteStatus.APPROVED.value, sent_at=days_ago(16),
               viewed_at=days_ago(15), decided_at=days_ago(15), created_at=days_ago(17), tax_percent=0)
    db.add(q4)
    db.flush()
    db.add(QuoteItem(quote_id=q4.id, description="Questionnaire development — household education module", quantity=1, unit_price=1250, line_total=1250, position=0))
    db.add(QuoteItem(quote_id=q4.id, description="Fieldworker guidance notes and pre-test plan", quantity=1, unit_price=400, line_total=400, position=1))
    q4.subtotal, q4.tax_amount, q4.total = 1650, 0, 1650
    inv4 = Invoice(invoice_number=next_number(db, "invoice", "INV"), quote_id=q4.id, project_id=p4.id,
                   client_id=org_admin.id, issued_by=manager.id, currency="USD", subtotal=1650, total=1650,
                   amount_paid=1650, status=InvoiceStatus.PAID.value, due_date=days(-1), issued_at=days_ago(15),
                   paid_at=days_ago(10), created_at=days_ago(15))
    db.add(inv4)
    db.flush()
    db.add(InvoiceItem(invoice_id=inv4.id, description="Questionnaire development (per approved quote)", quantity=1, unit_price=1650, line_total=1650, position=0))
    pay4 = Payment(reference=next_number(db, "payment", "PAY"), invoice_id=inv4.id, project_id=p4.id,
                   client_id=org_admin.id, amount=1650, currency="USD", method=PaymentMethod.CARD.value,
                   provider="manual", provider_ref="CARD-55123", status=PaymentStatus.CONFIRMED.value,
                   confirmed_by=finance.id, confirmed_at=days_ago(10), created_at=days_ago(11))
    db.add(pay4)

    # =============== 5. revision loop: dataset cleaning ===================
    r5 = _mk_request(db, client, "Research dataset cleaning and validation", "Data Science and Statistics",
                     "Data Management", "Data cleaning", RequestStatus.CONVERTED,
                     "A longitudinal education dataset (4 waves, ~900 records each) needs systematic cleaning: "
                     "duplicate resolution, range checks and a documented audit trail. The cleaned dataset will "
                     "support a published analysis.",
                     budget=(900, 1500), deadline_days=35, submitted_days_ago=30)
    p5 = Project(tracking_id=next_number(db, "project", "WUL"), request_id=r5.id, client_id=client.id,
                 service_id=r5.service_id, title=r5.title, description=r5.description, deadline=days(20),
                 currency="USD", quoted_amount=1200, fee_percent=15, fee_amount=180,
                 funds_status=FundsStatus.PENDING_RELEASE.value, status=ProjectStatus.REVISION_REQUIRED.value,
                 started_at=days_ago(22), assigned_professional_id=lerato.id, created_at=days_ago(29))
    db.add(p5)
    db.flush()
    r5.project_id = p5.id
    for st, when, by, note in [
        (ProjectStatus.UNDER_REVIEW.value, days_ago(29), manager, None),
        (ProjectStatus.QUOTE_PREPARED.value, days_ago(27), manager, None),
        (ProjectStatus.AWAITING_CLIENT_APPROVAL.value, days_ago(26), manager, None),
        (ProjectStatus.PAYMENT_PENDING.value, days_ago(25), client, None),
        (ProjectStatus.PAYMENT_CONFIRMED.value, days_ago(24), finance, None),
        (ProjectStatus.PROFESSIONAL_ASSIGNED.value, days_ago(23), manager, f"Assigned to {lerato.full_name}"),
        (ProjectStatus.IN_PROGRESS.value, days_ago(22), lerato, None),
        (ProjectStatus.SUBMITTED.value, days_ago(6), lerato, "Version 1 submitted"),
        (ProjectStatus.QUALITY_REVIEW.value, days_ago(5), qc, None),
        (ProjectStatus.REVISION_REQUIRED.value, days_ago(4), qc, "Audit trail completeness"),
    ]:
        history(p5, st, when, by, note)
    d5 = Deliverable(project_id=p5.id, title="Cleaned dataset and audit log", status=DeliverableStatus.IN_REVISION.value,
                     created_by=manager.id, current_version_number=1, created_at=days_ago(23))
    db.add(d5)
    db.flush()
    doc5 = Document(owner_id=lerato.id, kind=DocumentKind.DELIVERABLE.value, project_id=p5.id,
                    filename="education-dataset-cleaning-log-v1.pdf", content_type="application/pdf",
                    size_bytes=388412, storage_key="seed/not-stored.bin", scan_status="CLEAN", created_at=days_ago(6))
    db.add(doc5)
    db.flush()
    v5 = DeliverableVersion(deliverable_id=d5.id, version_number=1, document_id=doc5.id, uploaded_by=lerato.id,
                            notes="Cleaning log covering duplicates, range checks and recoding decisions.",
                            status=VersionStatus.REVISION_REQUIRED.value, submitted_at=days_ago(6), copyright_confirmed=True)
    db.add(v5)
    db.flush()
    db.add(QCReview(deliverable_version_id=v5.id, reviewer_id=qc.id, decision=QCDecision.REVISION_REQUIRED.value,
                    summary="Solid work overall. The audit trail should list every excluded record with its reason "
                            "code, and the wave-3 merge rule needs documenting.",
                    checklist={"audit_trail_complete": False, "range_checks": True, "deduplication": True},
                    created_at=days_ago(4)))
    db.add(QCComment(version_id=v5.id, author_id=qc.id, body="Please add the merge rule for wave 3 (section 2.3) — a reviewer will ask.", created_at=days_ago(4)))
    inv5 = Invoice(invoice_number=next_number(db, "invoice", "INV"), project_id=p5.id, client_id=client.id,
                   issued_by=manager.id, currency="USD", subtotal=1200, total=1200, amount_paid=1200,
                   status=InvoiceStatus.PAID.value, due_date=days(-8), issued_at=days_ago(25), paid_at=days_ago(24),
                   created_at=days_ago(25))
    db.add(inv5)
    db.flush()
    db.add(InvoiceItem(invoice_id=inv5.id, description="Dataset cleaning and validation", quantity=1, unit_price=1200, line_total=1200, position=0))
    pay5 = Payment(reference=next_number(db, "payment", "PAY"), invoice_id=inv5.id, project_id=p5.id,
                   client_id=client.id, amount=1200, currency="USD", method=PaymentMethod.BANK_TRANSFER.value,
                   provider="manual", provider_ref="TRF-9038810", status=PaymentStatus.CONFIRMED.value,
                   confirmed_by=finance.id, confirmed_at=days_ago(24), created_at=days_ago(24))
    db.add(pay5)

    # =============== 6. submitted request (under review) ==================
    _mk_request(db, client, "Manuscript formatting for journal submission", "Publishing",
                "Journal Formatting", "Journal formatting", RequestStatus.SUBMITTED,
                "Our accepted-in-principle manuscript needs reformatting to the journal's guidelines: reference "
                "style conversion, figure placement and the declarations section. The manuscript is our own work "
                "and the journal permits professional editing services.",
                budget=(300, 600), deadline_days=21, submitted_days_ago=2)

    # =============== 7. draft request =====================================
    _mk_request(db, org_admin, "Evidence map on rural water access interventions", "Social Sciences",
                "Development Studies", "Evidence mapping", RequestStatus.DRAFT,
                "Draft request — we are considering an evidence map of rural water access interventions "
                "in Southern Africa to guide our 2027 programme strategy.",
                budget=(2000, 3200), deadline_days=90, org_id=org.id)

    # =============== pending payment invoice (client2 view) ===============
    r8 = _mk_request(db, client, "Research methodology consultation for thesis proposal", "Research Methodology",
                     "Research Design", "Methodology consultation", RequestStatus.CONVERTED,
                     "Two consultation sessions to strengthen the design chapter of my proposal: alignment of "
                     "questions, design and analysis plan. This is consultation on my own research design.",
                     budget=(400, 700), deadline_days=30, submitted_days_ago=8)
    p8 = Project(tracking_id=next_number(db, "project", "WUL"), request_id=r8.id, client_id=client.id,
                 service_id=r8.service_id, title=r8.title, description=r8.description, deadline=days(30),
                 currency="USD", quoted_amount=560, status=ProjectStatus.AWAITING_CLIENT_APPROVAL.value,
                 created_at=days_ago(7))
    db.add(p8)
    db.flush()
    r8.project_id = p8.id
    history(p8, ProjectStatus.UNDER_REVIEW.value, days_ago(7), manager, None)
    history(p8, ProjectStatus.QUOTE_PREPARED.value, days_ago(6), manager, None)
    history(p8, ProjectStatus.AWAITING_CLIENT_APPROVAL.value, days_ago(5), manager, "Quote sent")
    q8 = Quote(quote_number=next_number(db, "quote", "QT"), project_id=p8.id, request_id=r8.id, client_id=client.id,
               prepared_by=manager.id, currency="USD", status=QuoteStatus.SENT.value, sent_at=days_ago(5),
               created_at=days_ago(6), valid_until=days(25))
    db.add(q8)
    db.flush()
    db.add(QuoteItem(quote_id=q8.id, description="Methodology consultation sessions (2 × 90 min)", quantity=2, unit_price=280, line_total=560, position=0))
    q8.subtotal, q8.tax_amount, q8.total = 560, 0, 560

    db.commit()
    print(f"[seed] projects: {db.query(Project).count()}, quotes: {db.query(Quote).count()}, invoices: {db.query(Invoice).count()}")


def seed_opportunities(db, users) -> None:
    if db.query(Opportunity).count():
        return
    manager, client = users["manager"], users["client"]
    kefilwe = users["kefilwe"]
    samuel = users["samuel"]

    o1 = Opportunity(title="Statistical reviewer — demographic and health survey programme",
                     description="Wulweth is identifying experienced statisticians to support analysis review for a "
                                 "demographic and health survey programme starting next quarter. Work involves "
                                 "reviewing analysis plans, verifying syntax reproducibility and advising on "
                                 "weighting. Engagements are coordinated by Wulweth managers.",
                     created_by=manager.id, discipline="Data Science and Statistics",
                     research_field_id=_field(db, "Statistics").id,
                     service_id=_service(db, "Statistical modelling").id,
                     required_expertise=["Survey statistics", "Reproducible analysis", "Complex survey weighting"],
                     methodology="Quantitative", visibility=OpportunityVisibility.PUBLIC.value,
                     status=OpportunityStatus.OPEN.value, deadline=days(30), expected_timeline="6–8 weeks",
                     location="Remote")
    o2 = Opportunity(title="Qualitative research specialist — community water governance study",
                     description="A research partner is seeking a qualitative specialist for interview-based fieldwork "
                                 "support on community water governance. The scope covers interview guides, "
                                 "transcription review and thematic analysis support with full documentation.",
                     created_by=client.id, discipline="Social Sciences",
                     research_field_id=_field(db, "Sociology").id,
                     service_id=_service(db, "Qualitative research design").id,
                     required_expertise=["Qualitative interviews", "Thematic analysis", "Water governance"],
                     methodology="Qualitative", visibility=OpportunityVisibility.PUBLIC.value,
                     status=OpportunityStatus.OPEN.value, deadline=days(45), expected_timeline="4 months",
                     location="Botswana (field sites in Kweneng)")
    o3 = Opportunity(title="Invitation only — agricultural value chain analysis panel",
                     description="A curated panel for agricultural economists with value-chain modelling experience. "
                                 "Engagements are assigned directly by Wulweth managers from this panel.",
                     created_by=manager.id, discipline="Agriculture",
                     research_field_id=_field(db, "Agricultural Economics").id,
                     required_expertise=["Value chain analysis", "Trade data analysis"],
                     visibility=OpportunityVisibility.INVITATION_ONLY.value,
                     status=OpportunityStatus.OPEN.value, deadline=days(60), expected_timeline="Ongoing panel")
    db.add_all([o1, o2, o3])
    db.flush()
    db.add(OpportunityInterest(opportunity_id=o1.id, professional_id=kefilwe.id,
                               message="I regularly work with household survey data and would welcome this review work.",
                               status=InterestStatus.EXPRESSED.value))
    db.add(OpportunityInvitation(opportunity_id=o3.id, professional_id=kefilwe.id, invited_by=manager.id,
                                 message="We would like to include you in the value chain analysis panel.",
                                 status=InvitationStatus.PENDING.value))
    db.commit()
    print(f"[seed] opportunities: {db.query(Opportunity).count()}")


def seed_feed(db, users) -> None:
    if db.query(FeedPost).count():
        return
    naledi, grace, samuel, manager = users["naledi"], users["grace"], users["samuel"], users["manager"]
    client = users["client"]
    cats = {c.slug: c for c in db.query(FeedCategory).all()}

    p1 = FeedPost(author_id=naledi.id, category_id=cats["data-science-insights"].id,
                  title="Reproducibility habits that survive reviewer questions",
                  body="Three habits have saved my teams countless hours: (1) one script per analysis step, "
                       "numbered in execution order; (2) a data dictionary updated alongside every variable "
                       "change; (3) a final 'reproduce everything from raw files' test before any submission. "
                       "None of this is glamorous, but when a reviewer asks how a number was produced, the "
                       "answer takes minutes instead of days. What habits would you add?",
                  status=PostStatus.PUBLISHED.value, published_at=days_ago(6), created_at=days_ago(6))
    p2 = FeedPost(author_id=grace.id, category_id=cats["publishing"].id,
                  title="What journal editors actually notice first",
                  body="After years of preparing submissions: editors read your abstract, figures and limitations "
                       "section before anything else. A precise abstract with quantified results, clean figures "
                       "with complete captions, and an honest limitations section signal professionalism long "
                       "before a reviewer reaches your methods. Format to the journal's guide — deviations are "
                       "noticed immediately.",
                  status=PostStatus.PUBLISHED.value, published_at=days_ago(4), created_at=days_ago(4))
    p3 = FeedPost(author_id=samuel.id, category_id=cats["methodology"].id,
                  title="When is a mixed-methods design actually mixed?",
                  body="A genuinely mixed design integrates qual and quant data at a defined point — design, "
                       "analysis or interpretation — with a stated rationale. Running a survey and a few "
                       "interviews in parallel and stapling the results together is not integration. If you are "
                       "planning a mixed-methods study, sketch the joint display first: it forces the "
                       "integration logic early, where it is cheap to fix.",
                  status=PostStatus.PUBLISHED.value, published_at=days_ago(2), created_at=days_ago(2))
    p4 = FeedPost(author_id=client.id, category_id=cats["research-updates"].id,
                  title="District health report published — with full methods appendix",
                  body="Our district care-seeking analysis is now in the public domain, including a methods "
                       "appendix with the full model specification. Thanks to the Wulweth professional who "
                       "handled the statistical analysis with impeccable documentation.",
                  status=PostStatus.PUBLISHED.value, published_at=days_ago(1), created_at=days_ago(1))
    p5 = FeedPost(author_id=manager.id, category_id=cats["announcements"].id,
                  title="Wulweth quality-control workflow, explained",
                  body="Every deliverable on Wulweth passes through versioned quality control: Version 1 is "
                       "reviewed by a dedicated quality reviewer, revisions are requested in writing, and only "
                       "approved versions reach the client as final. This is why our clients trust the platform "
                       "for work that will face scrutiny — ethical review, editors, or district officials.",
                  status=PostStatus.PUBLISHED.value, published_at=days_ago(8), created_at=days_ago(8))
    # A borderline post caught by automated screening — held for admin review.
    p6 = FeedPost(author_id=samuel.id, category_id=cats["methodology"].id,
                  title="Support options for students under thesis pressure",
                  body="Supervisors are stretched thin and students feel it. Institutions offer legitimate "
                       "support: writing centres, methods clinics and statistical consulting. What are the best "
                       "models you have seen for structured thesis support programmes?",
                  status=PostStatus.PENDING_REVIEW.value, risk_level=RiskLevel.POTENTIAL.value, created_at=days_ago(1))
    db.add_all([p1, p2, p3, p4, p5, p6])
    db.flush()
    db.add(FeedComment(post_id=p1.id, author_id=client.id, body="The 'reproduce everything from raw' test is underrated — it caught a merge bug in our data two days before submission.", created_at=days_ago(5)))
    db.add(FeedComment(post_id=p2.id, author_id=naledi.id, body="Figure quality is so often the weak point. Clean captions alone lift a manuscript.", created_at=days_ago(3)))
    db.add(FeedReaction(post_id=p1.id, user_id=client.id, reaction=ReactionType.INSIGHTFUL.value))
    db.add(FeedReaction(post_id=p1.id, user_id=grace.id, reaction=ReactionType.HELPFUL.value))
    db.add(FeedReaction(post_id=p3.id, user_id=naledi.id, reaction=ReactionType.INSIGHTFUL.value))
    db.add(FeedReaction(post_id=p5.id, user_id=naledi.id, reaction=ReactionType.HELPFUL.value))

    # Moderation case for the held post
    case = ModerationCase(case_number=next_number(db, "moderation", "MOD"),
                          content_type=ContentType.FEED_POST.value, content_id=p6.id, author_id=samuel.id,
                          risk_level=RiskLevel.POTENTIAL.value,
                          triggered_rules=["thesis writing support"],
                          excerpt=p6.body[:400], status=ModerationStatus.PENDING_REVIEW.value, created_at=days_ago(1))
    db.add(case)
    db.flush()
    db.add(ModerationAction(case_id=case.id, action="AUTO_FLAGGED",
                            notes="Automated screening matched: thesis writing support", created_at=days_ago(1)))
    db.commit()
    print(f"[seed] feed posts: {db.query(FeedPost).count()}")


def seed_reports(db, users) -> None:
    if db.query(Report).count():
        return
    client = users["client"]
    db.add(Report(reference=next_number(db, "report", "RPT"), kind=ReportKind.COPYRIGHT.value,
                  reporter_id=client.id, content_type="FEED_POST",
                  details="A reproduced figure in a feed post may come from a copyrighted source. Flagging for "
                          "review of its licensing status.",
                  status=ReportStatus.OPEN.value, created_at=days_ago(1)))
    db.commit()
    print("[seed] reports ready")


if __name__ == "__main__":
    main(reset="--reset" in sys.argv)
