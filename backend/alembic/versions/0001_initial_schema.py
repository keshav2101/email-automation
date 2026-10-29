"""Initial schema migration with all 14 core tables

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-28 05:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('is_verified', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('gmail_connected', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('gmail_access_token', sa.Text(), nullable=True),
        sa.Column('gmail_refresh_token', sa.Text(), nullable=True),
        sa.Column('gmail_email', sa.String(length=255), nullable=True),
        sa.Column('draft_only_mode', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('send_enabled', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('daily_send_limit', sa.Integer(), nullable=True, server_default='50'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. candidate_profiles
    op.create_table(
        'candidate_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('linkedin_url', sa.String(length=500), nullable=True),
        sa.Column('github_url', sa.String(length=500), nullable=True),
        sa.Column('portfolio_url', sa.String(length=500), nullable=True),
        sa.Column('university', sa.String(length=255), nullable=True),
        sa.Column('degree', sa.String(length=255), nullable=True),
        sa.Column('field_of_study', sa.String(length=255), nullable=True),
        sa.Column('graduation_year', sa.Integer(), nullable=True),
        sa.Column('gpa', sa.String(length=20), nullable=True),
        sa.Column('technical_skills', sa.JSON(), nullable=True),
        sa.Column('programming_languages', sa.JSON(), nullable=True),
        sa.Column('frameworks', sa.JSON(), nullable=True),
        sa.Column('tools', sa.JSON(), nullable=True),
        sa.Column('soft_skills', sa.JSON(), nullable=True),
        sa.Column('work_experience', sa.JSON(), nullable=True),
        sa.Column('internships', sa.JSON(), nullable=True),
        sa.Column('projects', sa.JSON(), nullable=True),
        sa.Column('research_papers', sa.JSON(), nullable=True),
        sa.Column('certifications', sa.JSON(), nullable=True),
        sa.Column('awards', sa.JSON(), nullable=True),
        sa.Column('preferred_roles', sa.JSON(), nullable=True),
        sa.Column('preferred_locations', sa.JSON(), nullable=True),
        sa.Column('employment_types', sa.JSON(), nullable=True),
        sa.Column('target_industries', sa.JSON(), nullable=True),
        sa.Column('professional_summary', sa.Text(), nullable=True),
        sa.Column('active_resume_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_candidate_profiles_id'), 'candidate_profiles', ['id'], unique=False)

    # 3. resume_versions
    op.create_table(
        'resume_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('profile_id', sa.Integer(), nullable=True),
        sa.Column('label', sa.String(length=255), nullable=True),
        sa.Column('filename', sa.String(length=500), nullable=True),
        sa.Column('file_path', sa.String(length=1000), nullable=True),
        sa.Column('file_type', sa.String(length=10), nullable=True),
        sa.Column('file_size_kb', sa.Integer(), nullable=True),
        sa.Column('raw_text', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('extraction_status', sa.String(length=50), nullable=True, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['profile_id'], ['candidate_profiles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_resume_versions_id'), 'resume_versions', ['id'], unique=False)

    # 4. companies
    op.create_table(
        'companies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('website', sa.String(length=500), nullable=True),
        sa.Column('industry', sa.String(length=255), nullable=True),
        sa.Column('domain', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('size', sa.String(length=50), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('careers_page', sa.String(length=500), nullable=True),
        sa.Column('linkedin_url', sa.String(length=500), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(length=20), nullable=True, server_default='medium'),
        sa.Column('outreach_status', sa.String(length=50), nullable=True, server_default='not_started'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_companies_id'), 'companies', ['id'], unique=False)

    # 5. hr_contacts
    op.create_table(
        'hr_contacts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('email_verified', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('email_source', sa.String(length=500), nullable=True),
        sa.Column('linkedin_url', sa.String(length=500), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('outreach_status', sa.String(length=50), nullable=True, server_default='not_contacted'),
        sa.Column('last_contacted_at', sa.DateTime(), nullable=True),
        sa.Column('reply_received', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('opted_out', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_hr_contacts_id'), 'hr_contacts', ['id'], unique=False)

    # 6. job_opportunities
    op.create_table(
        'job_opportunities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('requirements', sa.JSON(), nullable=True),
        sa.Column('skills_required', sa.JSON(), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('employment_type', sa.String(length=50), nullable=True),
        sa.Column('is_confirmed', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('posting_date', sa.DateTime(), nullable=True),
        sa.Column('application_type', sa.String(length=50), nullable=True, server_default='speculative'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_job_opportunities_id'), 'job_opportunities', ['id'], unique=False)

    # 7. company_research
    op.create_table(
        'company_research',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('business_summary', sa.Text(), nullable=True),
        sa.Column('key_products', sa.JSON(), nullable=True),
        sa.Column('tech_stack', sa.JSON(), nullable=True),
        sa.Column('recent_news', sa.JSON(), nullable=True),
        sa.Column('hiring_signals', sa.JSON(), nullable=True),
        sa.Column('candidate_match_explanation', sa.Text(), nullable=True),
        sa.Column('matching_skills', sa.JSON(), nullable=True),
        sa.Column('matching_projects', sa.JSON(), nullable=True),
        sa.Column('suggested_role', sa.String(length=255), nullable=True),
        sa.Column('match_confidence', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('source_urls', sa.JSON(), nullable=True),
        sa.Column('researched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), nullable=True, server_default='false'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_company_research_id'), 'company_research', ['id'], unique=False)

    # 8. email_campaigns
    op.create_table(
        'email_campaigns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True, server_default='active'),
        sa.Column('target_role', sa.String(length=255), nullable=True),
        sa.Column('total_targeted', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('emails_sent', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('replies_received', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_campaigns_id'), 'email_campaigns', ['id'], unique=False)

    # 9. email_drafts
    op.create_table(
        'email_drafts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('hr_contact_id', sa.Integer(), nullable=True),
        sa.Column('campaign_id', sa.Integer(), nullable=True),
        sa.Column('job_opportunity_id', sa.Integer(), nullable=True),
        sa.Column('research_id', sa.Integer(), nullable=True),
        sa.Column('resume_version_id', sa.Integer(), nullable=True),
        sa.Column('subject', sa.String(length=500), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('formal_version', sa.Text(), nullable=True),
        sa.Column('concise_version', sa.Text(), nullable=True),
        sa.Column('conversational_version', sa.Text(), nullable=True),
        sa.Column('style', sa.String(length=50), nullable=True, server_default='professional'),
        sa.Column('recipient_email', sa.String(length=255), nullable=True),
        sa.Column('recipient_name', sa.String(length=255), nullable=True),
        sa.Column('target_role', sa.String(length=255), nullable=True),
        sa.Column('matching_skills', sa.JSON(), nullable=True),
        sa.Column('highlighted_project', sa.String(length=255), nullable=True),
        sa.Column('personalization_notes', sa.Text(), nullable=True),
        sa.Column('confidence_score', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('status', sa.String(length=50), nullable=True, server_default='draft'),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('scheduled_for', sa.DateTime(), nullable=True),
        sa.Column('attach_resume', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('gmail_draft_id', sa.String(length=255), nullable=True),
        sa.Column('gmail_message_id', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['campaign_id'], ['email_campaigns.id'], ),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['hr_contact_id'], ['hr_contacts.id'], ),
        sa.ForeignKeyConstraint(['job_opportunity_id'], ['job_opportunities.id'], ),
        sa.ForeignKeyConstraint(['research_id'], ['company_research.id'], ),
        sa.ForeignKeyConstraint(['resume_version_id'], ['resume_versions.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_drafts_id'), 'email_drafts', ['id'], unique=False)

    # 10. email_messages
    op.create_table(
        'email_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('draft_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('gmail_message_id', sa.String(length=255), nullable=True),
        sa.Column('gmail_thread_id', sa.String(length=255), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True, server_default='sent'),
        sa.Column('reply_received', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('reply_at', sa.DateTime(), nullable=True),
        sa.Column('bounced', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('bounce_reason', sa.Text(), nullable=True),
        sa.Column('open_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('last_opened_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['draft_id'], ['email_drafts.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gmail_message_id')
    )
    op.create_index(op.f('ix_email_messages_id'), 'email_messages', ['id'], unique=False)

    # 11. follow_up_tasks
    op.create_table(
        'follow_up_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('original_draft_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('hr_contact_id', sa.Integer(), nullable=True),
        sa.Column('sequence_number', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('subject', sa.String(length=500), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('scheduled_for', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True, server_default='pending'),
        sa.Column('cancel_reason', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['hr_contact_id'], ['hr_contacts.id'], ),
        sa.ForeignKeyConstraint(['original_draft_id'], ['email_drafts.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_follow_up_tasks_id'), 'follow_up_tasks', ['id'], unique=False)

    # 12. email_events
    op.create_table(
        'email_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('message_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=True),
        sa.Column('occurred_at', sa.DateTime(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['message_id'], ['email_messages.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_events_id'), 'email_events', ['id'], unique=False)

    # 13. suppression_list
    op.create_table(
        'suppression_list',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=True, server_default='user_optout'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_suppression_list_id'), 'suppression_list', ['id'], unique=False)

    # 14. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=100), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('suppression_list')
    op.drop_table('email_events')
    op.drop_table('follow_up_tasks')
    op.drop_table('email_messages')
    op.drop_table('email_drafts')
    op.drop_table('email_campaigns')
    op.drop_table('company_research')
    op.drop_table('job_opportunities')
    op.drop_table('hr_contacts')
    op.drop_table('companies')
    op.drop_table('resume_versions')
    op.drop_table('candidate_profiles')
    op.drop_table('users')
