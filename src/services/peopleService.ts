import { apiRequest } from './apiClient';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'email' | 'phone' | 'select' | 'checkbox';
export interface PeopleField { key: string; label: string; type: FieldType; required: boolean; options: string[]; show_in_list: boolean; include_in_report: boolean; placeholder: string; }
export interface PeopleLabels { person_singular: string; person_plural: string; id_label: string; }
export interface PeopleSchema { org_type: string; labels: PeopleLabels; fields: PeopleField[]; is_default: boolean; }
export interface PresetSummary { key: string; name: string; description: string; labels: PeopleLabels; fields: PeopleField[]; }

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short text' }, { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' }, { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' },
  { value: 'select', label: 'Dropdown' }, { value: 'checkbox', label: 'Yes / No' },
];

export const ORG_TYPES: { key: string; name: string }[] = [
  { key: 'company', name: 'Company / Corporate' }, { key: 'school', name: 'School (Primary / Secondary)' },
  { key: 'university', name: 'University / Polytechnic' }, { key: 'training', name: 'Training Centre / Academy' },
  { key: 'hospital', name: 'Hospital / Healthcare' }, { key: 'religious', name: 'Church / Mosque / Religious' },
  { key: 'ngo', name: 'NGO / Non-profit' }, { key: 'government', name: 'Government / Public sector' },
  { key: 'factory', name: 'Factory / Manufacturing' }, { key: 'construction', name: 'Construction / Site' },
  { key: 'retail', name: 'Retail / Store' }, { key: 'hospitality', name: 'Hotel / Hospitality' },
  { key: 'gym', name: 'Gym / Club / Membership' }, { key: 'event', name: 'Event / Conference' },
  { key: 'custom', name: 'Other / Custom' },
];

export const DEFAULT_LABELS: PeopleLabels = { person_singular: 'Person', person_plural: 'People', id_label: 'ID No.' };

export async function getPeopleSchema(): Promise<PeopleSchema> { return apiRequest('/api/org/people-schema'); }
export async function savePeopleSchema(s: { org_type: string; labels: PeopleLabels; fields: PeopleField[] }): Promise<PeopleSchema> {
  return apiRequest('/api/org/people-schema', { method: 'PUT', body: JSON.stringify(s) });
}
export async function getPresets(): Promise<PresetSummary[]> { return apiRequest('/api/people/presets'); }

export function slugify(label: string): string {
  let s = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s || !/^[a-z]/.test(s)) s = 'f_' + s;
  return s.slice(0, 40);
}

export function formatFieldValue(field: { type: string }, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (field.type === 'checkbox') return value === true || value === 'true' ? 'Yes' : 'No';
  if (field.type === 'date') {
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return String(value);
}
