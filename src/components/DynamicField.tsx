import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PeopleField } from '@/services/peopleService';

const control = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function DynamicField({ field, value, onChange }: { field: PeopleField; value: unknown; onChange: (v: unknown) => void }) {
  const id = `fld_${field.key}`;
  const str = value === null || value === undefined ? '' : String(value);
  const label = <Label htmlFor={id}>{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>;

  if (field.type === 'checkbox') {
    return (
      <label htmlFor={id} className="flex items-center gap-3 text-sm h-full pt-6">
        <input id={id} type="checkbox" checked={value === true || value === 'true'} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded border-input accent-[var(--primary)]" />
        {field.label}
      </label>
    );
  }
  if (field.type === 'select') {
    return (
      <div className="space-y-1.5">{label}
        <select id={id} value={str} required={field.required} onChange={(e) => onChange(e.target.value)} className={control}>
          <option value="">&mdash; Select &mdash;</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
          {str && !field.options.includes(str) && <option value={str}>{str} (old value)</option>}
        </select>
      </div>
    );
  }
  if (field.type === 'textarea') {
    return (
      <div className="space-y-1.5 md:col-span-2">{label}
        <textarea id={id} value={str} required={field.required} placeholder={field.placeholder} maxLength={500} rows={3} onChange={(e) => onChange(e.target.value)}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
      </div>
    );
  }
  const inputType = field.type === 'phone' ? 'tel' : field.type;
  return (
    <div className="space-y-1.5">{label}
      <Input id={id} type={inputType} value={str} required={field.required} placeholder={field.placeholder}
        maxLength={field.type === 'number' ? undefined : 500} step={field.type === 'number' ? 'any' : undefined}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
