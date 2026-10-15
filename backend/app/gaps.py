"""
The gap engine: compares what each person's job role requires with their
assessed proficiency, and rolls the gaps up to departments and the institution.

For every skill in a person's role profile:

- current level   = the latest manager rating for that skill, or the latest
                    self rating when the manager hasn't rated it yet
- gap             = required level - current level (never below 0)
- DIF score       = mean of the role's difficulty, importance and frequency (1-5)
- priority score  = gap x DIF score (0-20); 8+ is high, 4+ medium, above 0 low

A gap score (0-100) summarises a set of skills: the DIF-weighted shortfall as a
share of the DIF-weighted required levels. 0 means everyone meets every
requirement; 100 means nothing required is in place. Skills nobody has rated
yet are left out of scores and reported as not assessed.
"""

from collections import defaultdict

from django.contrib.auth import get_user_model

from .models import EmployeeSkillRating, JobRoleSkill, OrgUnit

HIGH_PRIORITY = 8
MEDIUM_PRIORITY = 4


def priority_label(priority_score):
    if priority_score is None:
        return 'not_assessed'
    if priority_score >= HIGH_PRIORITY:
        return 'high'
    if priority_score >= MEDIUM_PRIORITY:
        return 'medium'
    return 'low' if priority_score > 0 else 'none'


def gap_score(assessed):
    """DIF-weighted shortfall of ``assessed`` skill rows, as a percentage."""
    required = sum(row['dif_score'] * row['required_level'] for row in assessed)
    if not required:
        return None
    shortfall = sum(row['dif_score'] * row['gap'] for row in assessed)
    return round(100 * shortfall / required, 1)


def _ref(obj, label='name'):
    return {'id': obj.pk, label: getattr(obj, label)} if obj else None


class GapEngine:
    """Loads one tenant's role profiles, staff and ratings once, then answers gap questions from memory."""

    def __init__(self, tenant):
        self.tenant = tenant
        self.units = {unit.pk: unit for unit in OrgUnit.objects.filter(tenant=tenant).order_by('name')}
        self.children = defaultdict(list)
        for unit in self.units.values():
            self.children[unit.parent_id].append(unit)

        self.profiles = defaultdict(list)
        for role_skill in JobRoleSkill.objects.filter(tenant=tenant).select_related('skill').order_by('skill__name'):
            self.profiles[role_skill.job_role_id].append(role_skill)

        self.people = list(
            get_user_model().objects.filter(tenant=tenant, is_active=True)
            .select_related('job_role__org_unit').order_by('username')
        )

        # Later surveys overwrite earlier ones, leaving the latest rating per person and skill.
        self.ratings = {}
        for rating in EmployeeSkillRating.objects.filter(tenant=tenant).order_by('survey_date'):
            self.ratings[(rating.user_id, rating.skill_id)] = rating

    # People

    def skill_gaps(self, user):
        rows = []
        for role_skill in self.profiles.get(user.job_role_id, []) if user.job_role_id else []:
            difficulty, importance, frequency = role_skill.dif
            dif_score = round((difficulty + importance + frequency) / 3, 2)
            rating = self.ratings.get((user.pk, role_skill.skill_id))
            if rating is None:
                current, source = None, None
            elif rating.manager_rating is not None:
                current, source = rating.manager_rating, 'manager'
            else:
                current, source = rating.self_rating, 'self'
            gap = None if current is None else max(role_skill.required_level - current, 0)
            priority_score = None if gap is None else round(gap * dif_score, 2)
            rows.append({
                'skill': {'id': role_skill.skill_id, 'name': role_skill.skill.name, 'type': role_skill.skill.type},
                'required_level': role_skill.required_level,
                'current_level': current,
                'rating_source': source,
                'self_rating': rating.self_rating if rating else None,
                'manager_rating': rating.manager_rating if rating else None,
                'survey_date': rating.survey_date if rating else None,
                'gap': gap,
                'dif': {'difficulty': difficulty, 'importance': importance, 'frequency': frequency},
                'dif_score': dif_score,
                'priority_score': priority_score,
                'priority': priority_label(priority_score),
            })
        rows.sort(key=lambda row: (row['priority_score'] is None, -(row['priority_score'] or 0), row['skill']['name']))
        return rows

    def person_summary(self, user, rows=None):
        rows = self.skill_gaps(user) if rows is None else rows
        assessed = [row for row in rows if row['gap'] is not None]
        role = user.job_role
        return {
            'user': {'id': user.pk, 'username': user.username, 'staff_number': user.staff_ref, 'name': user.get_full_name()},
            'job_role': _ref(role, 'title'),
            'org_unit': _ref(role.org_unit if role else None),
            'gap_score': gap_score(assessed),
            'skills_required': len(rows),
            'skills_assessed': len(assessed),
            'skills_with_gap': sum(1 for row in assessed if row['gap'] > 0),
            'high_priority_gaps': sum(1 for row in assessed if row['priority'] == 'high'),
        }

    def person(self, user):
        rows = self.skill_gaps(user)
        return {**self.person_summary(user, rows), 'skills': rows}

    # Departments and the institution

    def subtree(self, unit):
        """``unit`` and every unit below it, safe against parent cycles."""
        seen, stack = set(), [unit]
        while stack:
            current = stack.pop()
            if current.pk in seen:
                continue
            seen.add(current.pk)
            stack.extend(self.children.get(current.pk, []))
        return seen

    def people_in(self, unit_ids):
        return [user for user in self.people if user.job_role and user.job_role.org_unit_id in unit_ids]

    def summarise(self, people):
        """Gap figures for a group of people: overall, per skill, and per person."""
        all_rows, summaries = [], []
        per_skill = {}
        for user in people:
            rows = self.skill_gaps(user)
            summaries.append(self.person_summary(user, rows))
            all_rows.extend(rows)
            for row in rows:
                skill = per_skill.setdefault(row['skill']['id'], {
                    'skill': row['skill'], 'staff_requiring': 0, 'staff_assessed': 0, 'staff_with_gap': 0,
                    'high_priority': 0, '_gaps': [], 'priority_total': 0,
                })
                skill['staff_requiring'] += 1
                if row['gap'] is None:
                    continue
                skill['staff_assessed'] += 1
                skill['_gaps'].append(row['gap'])
                skill['priority_total'] += row['priority_score']
                if row['gap'] > 0:
                    skill['staff_with_gap'] += 1
                if row['priority'] == 'high':
                    skill['high_priority'] += 1

        skills = []
        for skill in per_skill.values():
            gaps = skill.pop('_gaps')
            skill['average_gap'] = round(sum(gaps) / len(gaps), 2) if gaps else None
            skill['priority_total'] = round(skill['priority_total'], 2)
            skills.append(skill)
        # The training needs list: the skills where closing the gap matters most, across the group.
        skills.sort(key=lambda s: (-s['priority_total'], -s['staff_with_gap'], s['skill']['name']))
        summaries.sort(key=lambda p: (p['gap_score'] is None, -(p['gap_score'] or 0), p['user']['username']))

        assessed = [row for row in all_rows if row['gap'] is not None]
        return {
            'staff': len(people),
            'staff_assessed': sum(1 for p in summaries if p['skills_assessed']),
            'staff_with_gaps': sum(1 for p in summaries if p['skills_with_gap']),
            'assessment_coverage': round(100 * len(assessed) / len(all_rows), 1) if all_rows else None,
            'gap_score': gap_score(assessed),
            'skills': skills,
            'people': summaries,
        }

    def unit_overview(self, unit):
        """One line per unit for breakdown tables, rolling up everything below it."""
        group = self.summarise(self.people_in(self.subtree(unit)))
        return {
            'org_unit': _ref(unit),
            **{key: group[key] for key in ('staff', 'staff_assessed', 'staff_with_gaps', 'assessment_coverage', 'gap_score')},
        }

    def department(self, unit):
        return {
            'org_unit': _ref(unit),
            'parent': _ref(self.units.get(unit.parent_id)),
            **self.summarise(self.people_in(self.subtree(unit))),
            'units': [self.unit_overview(child) for child in self.children.get(unit.pk, []) if child.pk != unit.pk],
        }

    def institution(self):
        roots = [unit for unit in self.units.values() if unit.parent_id is None or unit.parent_id not in self.units]
        reached = set().union(*(self.subtree(unit) for unit in roots))
        # A unit whose parent chain loops back on itself has no root; list it at the top rather than lose it.
        for unit in self.units.values():
            if unit.pk not in reached:
                roots.append(unit)
                reached |= self.subtree(unit)
        return {
            'tenant': {'id': self.tenant.pk, 'name': self.tenant.name},
            **self.summarise(self.people),
            'staff_without_role': sum(1 for user in self.people if not user.job_role_id),
            'units': [self.unit_overview(unit) for unit in roots],
        }
