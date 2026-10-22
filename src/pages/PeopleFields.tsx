import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2, Save, CheckCircle2, RotateCcw, Lock, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { usePeopleSchema, setPeopleSchemaCache } from '@/hooks/usePeopleSchema';
import { savePeopleSchema, getPresets, slugify, FIELD_TYPES, ORG_TYPES, type PeopleField, type PeopleLabels, type PresetSummary } from '@/services/peopleService';

type Draft = PeopleField & { _id: string; _saved: boolean; _optionsText: string };

let seq = 0;
const toDraft = (f: PeopleField, saved: boolean): Draft => ({ ...f, _id: `d${++seq}`, _saved: saved, _optionsText: (f.options || []).join(', ') });
const blankField = (): Draft => toDraft({ key: '', label: '', type: 'text', required: false, options: [], show_in_list: false, include_in_report: false, placeholder: '' }, false);
const control = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function PeopleFields() {
  const { schema, loading, error: loadError } = usePeopleSchema();
  const [orgType, setOrgType] = useState('company');
  const [labels, setLabels] = useState<PeopleLabels>({ person_singular: '', person_plural: '', id_label: '' });
  const [fields, setFields] = useState<Draft[]>([]);
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { getPresets().then(setPresets).catch(() => setPresets([])); }, []);

  useEffect(() => {
    if (!schema || dirty) return;
    setOrgType(schema.org_type);
    setLabels(schema.labels);
    setFields(schema.fields.map((f) => toDraft(f, !schema.is_default)));
  }, [schema, dirty]);

  const touch = () => { setDirty(true); setSaved(false); };

  const update = (id: string, patch: Partial<Draft>) => {
    setFields((prev) => prev.map((f) => {
      if (f._id !== id) return f;
      const next: Draft = { ...f, ...patch };
      if (patch.label !== undefined && !f._saved) next.key = slugify(patch.label);
      return next;
    }));
    touch();
  };

  const move = (i: number, dir: -1 | 1) => {
    setFields((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    touch();
  };

  const remove = (id: string) => {
    const f = fields.find((x) => x._id === id);
    if (f?._saved && !window.confirm(`Remove "${f.label}"?\n\nValues already saved for people are kept, but the field will no longer be shown.`)) return;
    setFields((prev) => prev.filter((x) => x._id !== id));
    touch();
  };

  const applyPreset = (key: string) => {
    const p = presets.find((x) => x.key === key);
    setOrgType(key);
    touch();
    if (!p) return;
    const replace = fields.length === 0 || window.confirm(
      `Load the starter fields for "${p.name}"?\n\nOK replaces your current field list.\nCancel keeps your fields and only changes the type and wording.`);
    setLabels(p.labels);
    if (replace) setFields(p.fields.map((f) => toDraft(f, false)));
  };

  const fieldErrors = useMemo(() => {
    const seen = new Set<string>();
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (!f.label.trim()) errs[f._id] = 'Label is required';
      else if (seen.has(f.key)) errs[f._id] = 'Another field already uses this name';
      else if (f.type === 'select' && !f._optionsText.split(',').some((o) => o.trim())) errs[f._id] = 'Add at least one option';
      seen.add(f.key);
    }
    return errs;
  }, [fields]);

  const handleSave = async () => {
    setError(null);
    if (Object.keys(fieldErrors).length) { setError('Fix the highlighted fields first.'); return; }
    setSaving(true);
    try {
      const payload: PeopleField[] = fields.map((d) => ({
        key: d.key, label: d.label, type: d.type, required: d.required, show_in_list: d.show_in_list,
        include_in_report: d.include_in_report, placeholder: d.placeholder,
        options: d.type === 'select' ? d._optionsText.split(',').map((o) => o.trim()).filter(Boolean) : [],
      }));
      const res = await savePeopleSchema({ org_type: orgType, labels, fields: payload });
      setPeopleSchemaCache(res);
      setFields(res.fields.map((f) => toDraft(f, true)));
      setLabels(res.labels);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !schema) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  const typeOptions = presets.length ? presets.map((p) => ({ key: p.key, name: p.name })) : ORG_TYPES;

  return (
    <div className="max-w-4xl">
      <PageHeader title="People Fields" description="Choose what information you collect for each person in your organisation."
        actions={<>
          {dirty && <Button variant="outline" onClick={() => setDirty(false)}><RotateCcw className="w-4 h-4" />Discard</Button>}
          <Button onClick={handleSave} disabled={saving || !dirty}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save</Button>
        </>} />

      {loadError && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-4"><AlertCircle className="w-4 h-4" />{loadError}</div>}
      {saved && <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg p-3 mb-4"><CheckCircle2 className="w-4 h-4" />Saved. The People form and reports now use these fields.</div>}
      {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-4"><AlertCircle className="w-4 h-4" />{error}</div>}
      {schema?.is_default && !dirty && <div className="text-sm text-muted-foreground bg-muted rounded-lg p-3 mb-4">These are the starter fields for your organisation type. Edit them and click <strong>Save</strong> to make them your own.</div>}

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Organisation type &amp; wording</CardTitle><CardDescription>Pick the closest type to load starter fields, then rename anything.</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2"><Label>Organisation type</Label>
              <select value={orgType} onChange={(e) => applyPreset(e.target.value)} className={control}>
                {typeOptions.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>One person is called</Label><Input value={labels.person_singular} maxLength={40} placeholder="e.g. Student" onChange={(e) => { setLabels({ ...labels, person_singular: e.target.value }); touch(); }} /></div>
            <div className="space-y-1.5"><Label>Several people are called</Label><Input value={labels.person_plural} maxLength={40} placeholder="e.g. Students" onChange={(e) => { setLabels({ ...labels, person_plural: e.target.value }); touch(); }} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>ID number is called</Label><Input value={labels.id_label} maxLength={40} placeholder="e.g. Matric No." onChange={(e) => { setLabels({ ...labels, id_label: e.target.value }); touch(); }} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Built-in fields</CardTitle><CardDescription>Every organisation has these.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {['Full name', labels.id_label || 'ID No.', 'Department', 'Status'].map((n) => <Badge key={n} variant="secondary" className="gap-1"><Lock className="size-3" />{n}</Badge>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Custom fields ({fields.length})</CardTitle><CardDescription>Shown in this order on the Add / Edit form.</CardDescription></div>
            <Button variant="outline" onClick={() => { setFields((p) => [...p, blankField()]); touch(); }} disabled={fields.length >= 40}><Plus className="w-4 h-4" />Add field</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.length === 0 && <p className="text-sm text-muted-foreground">No custom fields yet.</p>}
            {fields.map((f, i) => (
              <div key={f._id} className={`rounded-lg border p-4 space-y-3 ${fieldErrors[f._id] ? 'border-destructive' : 'border-border'}`}>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end">
                  <div className="space-y-1.5"><Label>Label</Label><Input value={f.label} maxLength={60} placeholder="e.g. Class" onChange={(e) => update(f._id, { label: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Type</Label>
                    <select value={f.type} onChange={(e) => update(f._id, { type: e.target.value as PeopleField['type'] })} className={control}>
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} title="Move up"><ArrowUp className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === fields.length - 1} title="Move down"><ArrowDown className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(f._id)} title="Remove"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
                {f.type === 'select' && (
                  <div className="space-y-1.5"><Label>Options (comma separated)</Label><Input value={f._optionsText} placeholder="e.g. JSS 1, JSS 2, JSS 3" onChange={(e) => update(f._id, { _optionsText: e.target.value })} /></div>
                )}
                {['text', 'textarea', 'number', 'email', 'phone'].includes(f.type) && (
                  <div className="space-y-1.5"><Label>Hint text (optional)</Label><Input value={f.placeholder} maxLength={80} onChange={(e) => update(f._id, { placeholder: e.target.value })} /></div>
                )}
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {f.type !== 'checkbox' && <label className="flex items-center gap-2"><input type="checkbox" checked={f.required} onChange={(e) => update(f._id, { required: e.target.checked })} className="w-4 h-4 accent-[var(--primary)]" />Required</label>}
                  <label className="flex items-center gap-2"><input type="checkbox" checked={f.show_in_list} onChange={(e) => update(f._id, { show_in_list: e.target.checked })} className="w-4 h-4 accent-[var(--primary)]" />Show in list</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={f.include_in_report} onChange={(e) => update(f._id, { include_in_report: e.target.checked })} className="w-4 h-4 accent-[var(--primary)]" />Include in reports &amp; CSV</label>
                  <span className="text-xs text-muted-foreground ml-auto self-center">name: <code>{f.key || '\u2014'}</code>{f._saved && ' (fixed)'}</span>
                </div>
                {fieldErrors[f._id] && <p className="text-xs text-destructive">{fieldErrors[f._id]}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
