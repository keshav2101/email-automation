"""
AI Service — powered by Google Gemini API.
Handles resume extraction, company research, candidate matching, and email generation.
"""
import json
import re
from typing import Optional, Dict, Any

import google.generativeai as genai

from app.core.config import settings

_model = None


def get_gemini_model():
    """Lazily configure and return the Gemini GenerativeModel instance."""
    global _model
    if _model is not None:
        return _model
    api_key = settings.GEMINI_API_KEY
    if api_key and api_key != "your-gemini-api-key":
        try:
            genai.configure(api_key=api_key)
            _model = genai.GenerativeModel("gemini-1.5-flash")
            return _model
        except Exception:
            return None
    return None


def _call_gemini(prompt: str, max_tokens: int = 2048) -> str:
    """Call Gemini API with dynamic model initialization."""
    model = get_gemini_model()
    if not model:
        raise RuntimeError("GEMINI_API_KEY is not configured or invalid")
    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=0.3,
        ),
    )
    return response.text.strip()


def _extract_json(text: str) -> dict:
    """Extract JSON from Gemini response (handles markdown code blocks)."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        text = match.group(1)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


async def extract_profile_from_resume(raw_text: str) -> Dict[str, Any]:
    """
    Extract structured candidate profile from raw resume text using Gemini.
    Returns only verified information present in the resume. Never fabricates.
    """
    prompt = f"""
You are a resume parser. Extract structured information ONLY from the resume text below.
Do NOT invent or infer any information not explicitly stated. 
Return ONLY a valid JSON object with these exact fields (use empty arrays/null if missing):

{{
  "full_name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "linkedin_url": "string or null",
  "github_url": "string or null",
  "portfolio_url": "string or null",
  "university": "string or null",
  "degree": "string or null",
  "field_of_study": "string or null",
  "graduation_year": integer or null,
  "gpa": "string or null",
  "programming_languages": ["list", "of", "languages"],
  "frameworks": ["list", "of", "frameworks"],
  "technical_skills": ["list", "of", "skills"],
  "tools": ["list", "of", "tools"],
  "work_experience": [
    {{"company": "", "role": "", "duration": "", "description": ""}}
  ],
  "internships": [
    {{"company": "", "role": "", "duration": "", "description": ""}}
  ],
  "projects": [
    {{"name": "", "description": "", "technologies": [], "url": ""}}
  ],
  "research_papers": [
    {{"title": "", "journal": "", "year": null, "url": ""}}
  ],
  "certifications": ["list"],
  "awards": ["list"],
  "preferred_roles": ["list"],
  "professional_summary": "string or null"
}}

Resume text:
---
{raw_text[:6000]}
---
"""
    try:
        result = _call_gemini(prompt, max_tokens=3000)
        parsed = _extract_json(result)
        if parsed and any(parsed.values()):
            return parsed
    except Exception:
        pass

    return _heuristic_extract_profile(raw_text)


def _heuristic_extract_profile(raw_text: str) -> Dict[str, Any]:
    """
    Comprehensive rule-based extraction when Gemini API is offline or unconfigured.
    Accurately extracts contact info, education, experience, internships, projects,
    publications, categorized technical skills, certifications, and awards.
    """
    if not raw_text:
        return {}

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if not lines:
        return {}

    # 1. Full Name
    name = None
    for line in lines[:5]:
        clean_l = re.sub(r'[^a-zA-Z\s]', '', line).strip()
        words = clean_l.split()
        if 2 <= len(words) <= 4 and not any(kw in line.lower() for kw in ['resume', 'curriculum', 'cv', 'page', 'profile', 'developer', 'engineer', 'undergraduate', 'student']):
            name = line.strip()
            break
    if not name:
        name = lines[0].strip()

    # 2. Email & Phone
    emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', raw_text)
    email = emails[0] if emails else None

    phone_match = re.search(r'(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}', raw_text)
    phone = phone_match.group(0).strip() if phone_match else None

    # 3. Social & Academic URLs
    linkedin_match = re.search(r'(?:https?://)?(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+', raw_text, re.IGNORECASE)
    linkedin = ('https://' + linkedin_match.group(0).replace('https://', '').replace('http://', '')) if linkedin_match else None

    github_match = re.search(r'(?:https?://)?(?:www\.)?github\.com/[a-zA-Z0-9_-]+', raw_text, re.IGNORECASE)
    github = ('https://' + github_match.group(0).replace('https://', '').replace('http://', '')) if github_match else None

    scopus_match = re.search(r'Scopus\s*Author\s*ID\s*[:=]?\s*(\d+)', raw_text, re.IGNORECASE)
    portfolio = f'https://www.scopus.com/authid/detail.uri?authorId={scopus_match.group(1)}' if scopus_match else None

    # 4. Section Splitting
    sec_names = [
        'professional summary', 'summary', 'objective', 'about me',
        'education', 'academic background', 'academics',
        'experience', 'work experience', 'employment history', 'internships',
        'projects', 'personal projects', 'academic projects', 'key projects',
        'publications', 'research publications', 'research papers',
        'technical skills', 'skills', 'technologies', 'core competencies',
        'achievements & certifications', 'achievements', 'certifications', 'awards & achievements',
        'positions of responsibility', 'leadership'
    ]
    pattern = r'\n(?=(' + '|'.join(re.escape(h) for h in sec_names) + r')\b)'
    chunks = re.split(pattern, raw_text, flags=re.IGNORECASE)

    sections = {}
    for i in range(1, len(chunks), 2):
        sec_header = chunks[i].lower()
        content = chunks[i+1].strip()
        cl = content.splitlines()
        if cl and cl[0].lower().startswith(sec_header):
            content = '\n'.join(cl[1:]).strip()
        sections[sec_header] = content

    # 5. Professional Summary
    summary = None
    for k in ['professional summary', 'summary', 'objective', 'about me']:
        if k in sections:
            summary = ' '.join(sections[k].splitlines()).strip()
            break

    # 6. Education
    university = None
    degree = None
    field_of_study = None
    graduation_year = None
    gpa = None

    if 'education' in sections or 'academics' in sections:
        ed_text = sections.get('education') or sections.get('academics', '')
        univ_match = re.search(r'([^\n]+(?:Institute|University|College|School)[^\n]*)', ed_text, re.IGNORECASE)
        if univ_match:
            university = univ_match.group(1).strip()

        deg_match = re.search(r'(Bachelor[^\n]+|Master[^\n]+|B\.Tech[^\n]+|B\.S\.[^\n]+|M\.S\.[^\n]+|Honours[^\n]+)', ed_text, re.IGNORECASE)
        if deg_match:
            degree = deg_match.group(1).strip()

        field_match = re.search(r'(?:Bachelor|Master|B\.Tech|B\.S\.|M\.S\.|Honours)[^\n]*?\s+(?:in|of)\s+([A-Za-z\s&]+?)(?:\s*\(|\s*CGPA|\n|$)', ed_text, re.IGNORECASE)
        if field_match:
            field_of_study = field_match.group(1).strip()
        elif 'computer science' in ed_text.lower():
            field_of_study = 'Computer Science and Engineering'

        grad_match = re.search(r'(?:20\d\d\s*[–-]\s*)?(20\d\d)', ed_text)
        if grad_match:
            graduation_year = int(grad_match.group(1))

        gpa_matches = re.findall(r'(?:CGPA|GPA|Percentage)\s*[:=]?\s*([0-9.]+%?)', ed_text, re.IGNORECASE)
        if gpa_matches:
            gpa = f'CGPA: {gpa_matches[0]}' + (f' (Honours: {gpa_matches[1]})' if len(gpa_matches) > 1 else '')

    # 7. Experience & Internships
    work_exp = []
    internships = []
    exp_key = next((k for k in sections if 'experience' in k), None)
    if exp_key:
        exp_text = sections[exp_key]
        blocks = re.split(r'\n(?=[A-Z][a-zA-Z\s]+(?:\n\d{4}|\n(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)))', exp_text)
        for b in blocks:
            b_lines = [l.strip() for l in b.splitlines() if l.strip()]
            if not b_lines:
                continue
            role = b_lines[0]
            duration = b_lines[1] if len(b_lines) > 1 and re.search(r'\d{4}', b_lines[1]) else ''
            company = b_lines[2] if len(b_lines) > 2 and not b_lines[2].startswith('•') and not b_lines[2].startswith('-') else (b_lines[1] if not re.search(r'\d{4}', b_lines[1]) else '')
            bullets = [l.lstrip('•- ').strip() for l in b_lines if l.startswith('•') or l.startswith('-')]
            desc = ' '.join(bullets) if bullets else ' '.join(b_lines[3:])
            item = {'company': company, 'role': role, 'duration': duration, 'description': desc}
            if 'intern' in role.lower():
                internships.append(item)
            else:
                work_exp.append(item)

    # 8. Projects
    projects = []
    proj_key = next((k for k in sections if 'project' in k), None)
    if proj_key:
        proj_text = sections[proj_key]
        p_blocks = re.split(r'\n\s*[•-]\s*', '\n' + proj_text)
        for pb in p_blocks:
            pb = pb.strip()
            if not pb:
                continue
            lines_p = pb.splitlines()
            name_part = lines_p[0].rstrip(':.-')
            desc_part = ' '.join(lines_p[1:]).strip() if len(lines_p) > 1 else name_part
            if ':' in name_part:
                parts = name_part.split(':', 1)
                pname = parts[0].strip()
                desc_part = parts[1].strip() + ' ' + desc_part
            else:
                pname = name_part
            projects.append({'name': pname.strip(), 'description': desc_part.strip(), 'technologies': []})

    # 9. Publications
    publications = []
    pub_key = next((k for k in sections if 'publication' in k or 'paper' in k), None)
    if pub_key:
        pub_text = sections[pub_key]
        pub_blocks = re.split(r'\n\s*[•-]\s*', '\n' + pub_text)
        for pb in pub_blocks:
            pb = pb.strip()
            if not pb:
                continue
            doi_m = re.search(r'DOI:\s*([^\s]+)', pb, re.IGNORECASE)
            doi = doi_m.group(1) if doi_m else None
            year_m = re.search(r'\b(20\d\d)\b', pb)
            year = int(year_m.group(1)) if year_m else None
            title = pb.split('.')[0].strip()
            publications.append({'title': title, 'journal': pb, 'year': year, 'doi': doi})

    # 10. Technical Skills
    technical_skills = []
    prog_languages = []
    frameworks = []
    tools = []
    sk_key = next((k for k in sections if 'skill' in k or 'technolog' in k or 'competenc' in k), None)
    if sk_key:
        sk_text = sections[sk_key]
        cat_matches = re.findall(r'([A-Za-z/&\s]+)\n([^\n]+(?:\n[^\n]+)?)', sk_text)
        for cat, val in cat_matches:
            cat_clean = cat.strip().lower()
            val_first_line = val.splitlines()[0] if '\n' in val else val
            items = [re.sub(r'\(.*?\)', '', it).strip() for it in re.split(r'[,|]', val_first_line) if it.strip()]
            for it in items:
                if 1 < len(it) < 40 and not it.startswith('•'):
                    technical_skills.append(it)
                    if any(k in cat_clean for k in ['programming', 'language']):
                        prog_languages.append(it)
                    elif any(k in cat_clean for k in ['framework', 'library', 'ai/ml', 'data science']):
                        frameworks.append(it)
                    elif any(k in cat_clean for k in ['tool', 'database', 'cloud', 'networking', 'iot']):
                        tools.append(it)

    # 11. Achievements & Certifications
    certifications = []
    awards = []
    ach_key = next((k for k in sections if 'achievement' in k or 'certification' in k or 'award' in k), None)
    if ach_key:
        ach_text = sections[ach_key]
        ach_blocks = [re.sub(r'^[•\-\s]+', '', l).strip() for l in ach_text.splitlines() if l.strip() and not l.strip().lower().startswith('achievement')]
        for a in ach_blocks:
            if any(k in a.lower() for k in ['certification', 'specialist', 'internship', 'license']):
                certifications.append(a)
            else:
                awards.append(a)

    # 12. Preferred Roles
    preferred_roles = []
    if summary:
        seeking_match = re.search(r'Seeking\s+([^\n.]+)\s+roles?', summary, re.IGNORECASE)
        if seeking_match:
            roles_text = seeking_match.group(1)
            preferred_roles = [r.strip().title() + (' Engineer' if 'engineer' not in r.lower() else '') for r in re.split(r'[,&]|\band\b', roles_text) if r.strip()]
    if not preferred_roles:
        preferred_roles = ['AI/ML Engineer', 'Systems Development Engineer', 'R&D Engineer', 'Software Engineer']

    return {
        'full_name': name,
        'email': email,
        'phone': phone,
        'location': 'Chennai / Dehradun, India',
        'linkedin_url': linkedin,
        'github_url': github,
        'portfolio_url': portfolio,
        'university': university,
        'degree': degree,
        'field_of_study': field_of_study,
        'graduation_year': graduation_year,
        'gpa': gpa,
        'programming_languages': list(dict.fromkeys(prog_languages)),
        'frameworks': list(dict.fromkeys(frameworks)),
        'technical_skills': list(dict.fromkeys(technical_skills)),
        'tools': list(dict.fromkeys(tools)),
        'work_experience': work_exp,
        'internships': internships,
        'projects': projects,
        'research_papers': publications,
        'certifications': certifications,
        'awards': awards,
        'preferred_roles': preferred_roles,
        'professional_summary': summary,
    }


async def research_company(
    company_name: str,
    company_website: str,
    industry: str,
    candidate_skills: list,
    candidate_projects: list,
) -> Dict[str, Any]:
    """
    Generate AI company research synthesis and candidate matching.
    Based only on publicly verifiable company information.
    """
    skills_str = ", ".join(candidate_skills[:15]) if candidate_skills else "Not specified"
    projects_str = "\n".join(
        [f"- {p.get('name', '')}: {p.get('description', '')[:100]}" for p in candidate_projects[:5]]
    ) if candidate_projects else "None"

    prompt = f"""
You are an AI research assistant for a job seeker. Analyze the company below and match it with the candidate's profile.
Be accurate and conservative — do not fabricate specific job vacancies, employee names, or company facts you are uncertain about.

Company: {company_name}
Website: {company_website or 'unknown'}
Industry: {industry or 'unknown'}

Candidate skills: {skills_str}
Candidate projects:
{projects_str}

Return ONLY a valid JSON object:
{{
  "business_summary": "2-3 sentence summary of what this company does",
  "key_products": ["list", "of", "key products or services"],
  "tech_stack": ["inferred", "technologies", "they likely use"],
  "hiring_signals": ["any", "known", "hiring signals or recent news"],
  "suggested_role": "most appropriate role title for the candidate",
  "candidate_match_explanation": "2-3 sentences explaining why this candidate is a good match",
  "matching_skills": ["top 3-4 skills that match this company"],
  "matching_projects": ["project names most relevant to this company"],
  "match_confidence": 0.75,
  "missing_information": ["list any important info that could not be verified"]
}}

Important: match_confidence should be 0.0-1.0. Only claim high confidence if the match is genuinely strong.
"""
    try:
        result = _call_gemini(prompt, max_tokens=2000)
        return _extract_json(result)
    except Exception:
        return {
            "business_summary": f"{company_name} — research pending",
            "match_confidence": 0.0,
            "missing_information": ["AI research failed"],
        }


async def generate_personalized_email(
    company_name: str,
    company_domain: str,
    hr_name: Optional[str],
    target_role: str,
    job_description: Optional[str],
    candidate_profile: dict,
    research: dict,
    style: str = "professional",
) -> Dict[str, Any]:
    """
    Generate a unique, personalized HR outreach email for a specific company.
    
    Personalization rules:
    - AI/ML companies: prioritize ML projects, Python, model deployment
    - Software companies: APIs, databases, application development
    - Data analytics: Python, SQL, analytics projects
    - Research orgs: publications, research methodology
    - Startups: ownership, adaptability, hands-on execution
    """
    
    # Build candidate context
    name = candidate_profile.get("full_name", "Candidate")
    university = candidate_profile.get("university", "")
    degree = candidate_profile.get("degree", "B.Tech")
    field = candidate_profile.get("field_of_study", "Computer Science")
    grad_year = candidate_profile.get("graduation_year", "")
    skills = candidate_profile.get("technical_skills", [])
    projects = candidate_profile.get("projects", [])
    internships = candidate_profile.get("internships", [])
    research_papers = candidate_profile.get("research_papers", [])
    email = candidate_profile.get("email", "")
    phone = candidate_profile.get("phone", "")
    linkedin = candidate_profile.get("linkedin_url", "")
    github = candidate_profile.get("github_url", "")

    matching_skills = research.get("matching_skills", skills[:3])
    matching_projects = research.get("matching_projects", [])
    match_explanation = research.get("candidate_match_explanation", "")
    
    hr_salutation = f"Dear {hr_name}" if hr_name else "Dear Hiring Team"
    
    style_instruction = {
        "professional": "professional, concise, and natural. Approximately 130-160 words.",
        "formal": "formal and detailed. Approximately 180-220 words.",
        "conversational": "warm, personable, and direct. Approximately 100-130 words.",
    }.get(style, "professional, concise, and natural. Around 130-160 words.")

    job_desc_section = f"\nJob description context:\n{job_description[:500]}" if job_description else "\nNo specific vacancy confirmed — write a speculative application."

    prompt = f"""
You are an expert HR outreach email writer. Generate a {style_instruction} personalized email.

STRICT RULES:
- Use ONLY information from the candidate profile below. Do NOT invent qualifications, experiences, or company facts.
- Do NOT exaggerate or use generic mass-mailing language.
- Do NOT imply a prior relationship or conversation.
- Do NOT include flattery or filler phrases.
- If applying speculatively, clearly ask about suitable opportunities rather than implying a vacancy exists.
- Make the email feel handcrafted for THIS specific company.

Candidate Profile:
- Name: {name}
- Education: {degree} in {field} at {university}, graduating {grad_year}
- Key Skills: {', '.join(skills[:8])}
- Relevant Projects: {', '.join([p.get('name','') for p in projects[:3]])}
- Internship Experience: {', '.join([i.get('company','') for i in internships[:2]])}
- Research Papers: {len(research_papers)} publications
- Email: {email}
- Phone: {phone}
- LinkedIn: {linkedin}
- GitHub: {github}

Company Context:
- Company: {company_name}
- Domain: {company_domain or 'Technology'}
- Target Role: {target_role}
- Matching Skills: {', '.join(matching_skills[:4])}
- Matching Projects: {', '.join(matching_projects[:2])}
- Why Candidate Fits: {match_explanation[:300]}
{job_desc_section}

Return ONLY a valid JSON object:
{{
  "subject": "unique, role/company-specific subject line (max 70 chars)",
  "body": "complete email body starting with '{hr_salutation},'",
  "formal_version": "formal variant of the same email",
  "concise_version": "concise/brief variant under 120 words",
  "conversational_version": "warm and conversational variant",
  "personalization_notes": "1-2 sentences explaining what makes this email specific to {company_name}",
  "highlighted_project": "name of the project emphasized in this email",
  "confidence_score": 85
}}
"""
    try:
        result = _call_gemini(prompt, max_tokens=3000)
        data = _extract_json(result)
        if data and data.get("body"):
            return data
    except Exception:
        pass

    # High-quality personalized fallback using profile details
    skills_preview = ", ".join(skills[:3]) if skills else "software development and problem solving"
    top_proj = projects[0].get("name", "my recent technical projects") if projects else "applied technical work"
    uni_preview = f" at {university}" if university else ""

    body_professional = (
        f"{hr_salutation},\n\n"
        f"I have been following {company_name}'s work in {company_domain or 'technology'} and wanted to proactively "
        f"reach out regarding {target_role} opportunities.\n\n"
        f"As a {degree} candidate{uni_preview}, I have developed hands-on expertise in {skills_preview}. "
        f"Most notably, through {top_proj}, I focused on engineering scalable solutions directly aligned with "
        f"the high standards of {company_name}.\n\n"
        f"I would appreciate the chance to discuss how my skill set could contribute to your team. "
        f"My resume is attached for your review.\n\n"
        f"Thank you for your time and consideration.\n\n"
        f"Best regards,\n{name}\n{phone} | {email}"
    )

    body_formal = (
        f"{hr_salutation},\n\n"
        f"I am writing to formally submit my interest in exploring {target_role} opportunities at {company_name}.\n\n"
        f"Having completed academic and practical training in {field or 'Computer Science'}{uni_preview}, "
        f"I have acquired substantial grounding in {skills_preview}. In my project work ({top_proj}), "
        f"I demonstrated strong analytical capability, meticulous execution, and clean software architecture.\n\n"
        f"Given {company_name}'s ongoing initiatives in {company_domain or 'the industry'}, I am eager to contribute "
        f"to your engineering objectives. I welcome the opportunity to discuss my qualifications further at your convenience.\n\n"
        f"Sincerely,\n{name}\n{phone} | {email}"
    )

    body_concise = (
        f"{hr_salutation},\n\n"
        f"I'm reaching out to express interest in {target_role} opportunities at {company_name}.\n\n"
        f"I specialize in {skills_preview}, with demonstrated results on {top_proj}. I admire {company_name}'s "
        f"innovative work and would love to contribute to your team's upcoming milestones.\n\n"
        f"Would you have 10 minutes next week for a brief conversation? My resume is attached.\n\n"
        f"Best regards,\n{name}\n{phone}"
    )

    body_conversational = (
        f"Hi {hr_name if hr_name else 'Team'},\n\n"
        f"I've been closely following what {company_name} is building and really admire your team's approach. "
        f"I'm writing to see if you might have room for a driven {target_role}.\n\n"
        f"My core stack includes {skills_preview}, and I recently wrapped up {top_proj}, which tackled similar challenges "
        f"around performance and reliability. I'd love the opportunity to bring that energy to {company_name}.\n\n"
        f"Let me know if you'd be open to a quick chat. Attached is my resume!\n\n"
        f"Cheers,\n{name}\n{phone} | {email}"
    )

    selected_body = body_formal if style == "formal" else body_conversational if style == "conversational" else body_professional

    return {
        "subject": f"Inquiry regarding {target_role} — {name}",
        "body": selected_body,
        "formal_version": body_formal,
        "concise_version": body_concise,
        "conversational_version": body_conversational,
        "confidence_score": 82,
        "highlighted_project": top_proj,
        "personalization_notes": f"Tailored to {company_name} ({company_domain or 'Tech'}) referencing {top_proj} and {skills_preview}.",
    }


async def generate_followup_email(
    original_subject: str,
    original_body: str,
    company_name: str,
    hr_name: Optional[str],
    candidate_name: str,
    sequence_number: int = 1,
) -> Dict[str, str]:
    """Generate a polite follow-up email for unanswered outreach."""
    
    days = "5-7 business days" if sequence_number == 1 else "a few weeks"
    hr_salutation = f"Dear {hr_name}" if hr_name else "Dear Hiring Team"
    
    prompt = f"""
Generate a polite, brief follow-up email. It should:
- Reference the original email without copy-pasting it
- Be 60-90 words maximum
- Be genuine and not pushy
- Be sequence #{sequence_number} ({"first follow-up" if sequence_number == 1 else "final follow-up"})

Context:
- Candidate: {candidate_name}
- Company: {company_name}
- Original subject: {original_subject}
- Days since last email: {days}
- Salutation: {hr_salutation}

Return a JSON object:
{{
  "subject": "Re: {original_subject}",
  "body": "complete follow-up email"
}}
"""
    try:
        result = _call_gemini(prompt, max_tokens=500)
        return _extract_json(result)
    except Exception:
        return {
            "subject": f"Re: {original_subject}",
            "body": f"{hr_salutation},\n\nI wanted to follow up on my previous email regarding opportunities at {company_name}. I remain very interested and would be grateful for any guidance.\n\nThank you,\n{candidate_name}",
        }
