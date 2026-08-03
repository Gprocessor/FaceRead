import { useEffect, useState } from 'react';
import { Users, Plus, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { getAdminEmployees, createAdminEmployee } from '@/services/attendanceService';

interface EmployeeRow {
  id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  department: string | null;
  status: string;
  face_enrolled: boolean;
}

interface Department {
  id: string;
  name: string;
}

export function Employees() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    employee_code: '',
    full_name: '',
    email: '',
    phone: '',
    position: '',
    department_id: '',
    hire_date: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [emps, depts] = await Promise.all([
        getAdminEmployees(),
        supabase.from('departments').select('id, name').order('name'),
      ]);
      setEmployees(emps);
      setDepartments(depts.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createAdminEmployee({
        employee_code: form.employee_code,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || undefined,
        position: form.position || undefined,
        department_id: form.department_id || undefined,
        hire_date: form.hire_date || undefined,
      });
      setForm({
        employee_code: '',
        full_name: '',
        email: '',
        phone: '',
        position: '',
        department_id: '',
        hire_date: '',
      });
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add employee');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = employees.filter(
    (e) =>
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Employees</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage employee records and face enrollment status.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Employee Code *
              </label>
              <input
                value={form.employee_code}
                onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Full Name *
              </label>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Position</label>
              <input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Department</label>
              <select
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="">— Select —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Hire Date</label>
              <input
                type="date"
                value={form.hire_date}
                onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium text-sm hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="text-sm text-rose-400 bg-rose-500/10 rounded-lg p-3">{error}</div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code…"
          className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-500">
            <Users className="w-10 h-10 mb-3" />
            <p className="text-sm">No employees found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Dept</th>
                <th className="text-left px-4 py-3 font-medium">Face</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                    {e.employee_code}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{e.full_name}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                    {e.department ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.face_enrolled
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {e.face_enrolled ? 'Enrolled' : 'Not Enrolled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
