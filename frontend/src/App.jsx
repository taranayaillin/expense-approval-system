import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, CircleDollarSign, Download, FileText, Plus, ReceiptText, Send, Trash2, UserRound } from 'lucide-react';

const API = 'http://localhost:3000/api';
const categories = ['Travel', 'Meals', 'Office Supplies', 'Software', 'Other'];
const emptyItem = () => ({ expenseDate: '', category: 'Travel', description: '', amount: '', currency: 'USD', note: '' });

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const statusStyles = { Draft: 'bg-stone-100 text-stone-700', Submitted: 'bg-blue-50 text-blue-700', Approved: 'bg-emerald-50 text-emerald-700', Rejected: 'bg-red-50 text-red-700', Paid: 'bg-violet-50 text-violet-700' };

function Status({ value }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[value] || 'bg-stone-100 text-stone-700'}`}>{value}</span>;
}

function Header({ role, setRole, users }) {
  return <header className="border-b border-stone-200 bg-white px-5 py-3 md:px-8">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#183f2b] text-white"><ReceiptText size={19} /></div>
        <div><p className="font-display text-sm font-bold text-stone-900 md:text-base">Expense Desk</p><p className="hidden text-xs text-stone-500 sm:block">Approval workspace</p></div>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 p-1">
        {['Employee', 'Manager', 'Finance'].map(item => <button key={item} onClick={() => setRole(item)} className={`rounded px-2.5 py-1.5 text-xs font-semibold transition md:px-4 ${role === item ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}>{item}</button>)}
      </div>
      <div className="hidden items-center gap-2 text-right sm:flex">
        <div><p className="text-xs font-semibold text-stone-800">{users.find(user => user.role === role)?.name || role}</p><p className="text-[11px] text-stone-500">{role} account</p></div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600"><UserRound size={16} /></div>
      </div>
    </div>
  </header>;
}

function EmptyState({ text }) {
  return <div className="flex min-h-48 flex-col items-center justify-center text-center text-stone-400"><FileText size={30} /><p className="mt-2 text-sm">{text}</p></div>;
}

function ClaimEditor({ user, claims, refresh, notify }) {
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const drafts = claims.filter(claim => claim.submitted_by === user?.id && claim.status === 'Draft');
  const myClaims = claims.filter(claim => claim.submitted_by === user?.id);
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  function startNew() { setEditing(null); setTitle(''); setItems([emptyItem()]); }
  function edit(claim) {
    setEditing(claim);
    setTitle(claim.title);
    setItems(claim.lineItems.map(item => ({ expenseDate: item.expense_date, category: item.category, description: item.description, amount: item.amount, currency: item.currency, note: item.note || '' })));
  }
  function updateItem(index, field, value) { setItems(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item)); }
  async function save() {
    setSaving(true);
    try {
      const payload = { submittedBy: user.id, userId: user.id, title, currency: 'USD', lineItems: items };
      const saved = editing ? await request(`/claims/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) }) : await request('/claims', { method: 'POST', body: JSON.stringify(payload) });
      notify(editing ? 'Draft updated' : 'Draft created', 'success'); setEditing(saved); setTitle(saved.title); await refresh();
    } catch (error) { notify(error.message, 'error'); } finally { setSaving(false); }
  }
  async function submit(claimId) {
    try { await request(`/claims/${claimId}/submit`, { method: 'POST', body: JSON.stringify({ userId: user.id }) }); notify('Claim submitted', 'success'); startNew(); await refresh(); }
    catch (error) { notify(error.message, 'error'); }
  }

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
    <section className="border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4"><div><h2 className="font-display text-lg font-bold">{editing ? 'Edit draft' : 'New expense claim'}</h2><p className="text-xs text-stone-500">{editing ? `Claim #${editing.id}` : 'Build your claim before submitting'}</p></div><button onClick={startNew} className="flex items-center gap-1.5 border border-stone-300 px-3 py-2 text-xs font-semibold hover:bg-stone-50"><Plus size={15}/> New</button></div>
      <div className="p-5">
        <label className="mb-4 block"><span className="mb-1.5 block text-xs font-semibold text-stone-600">Claim title</span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Client travel, November" className="w-full border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[#26734d]" /></label>
        <div className="overflow-x-auto scrollbar-thin"><div className="min-w-[760px]">
          {items.map((item, index) => <div key={index} className="grid grid-cols-[130px_150px_1fr_100px_170px_32px] gap-2 border-t border-stone-200 py-3 first:border-t-0">
            <input type="date" aria-label="Expense date" value={item.expenseDate} onChange={e => updateItem(index, 'expenseDate', e.target.value)} className="border border-stone-300 px-2 py-2 text-xs" />
            <select aria-label="Category" value={item.category} onChange={e => updateItem(index, 'category', e.target.value)} className="border border-stone-300 px-2 py-2 text-xs">{categories.map(category => <option key={category}>{category}</option>)}</select>
            <input aria-label="Description" value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} placeholder="Description" className="border border-stone-300 px-2 py-2 text-xs" />
            <input type="number" min="0" step="0.01" aria-label="Amount" value={item.amount} onChange={e => updateItem(index, 'amount', e.target.value)} placeholder="0.00" className="border border-stone-300 px-2 py-2 text-xs" />
            <input aria-label="Note" value={item.note} onChange={e => updateItem(index, 'note', e.target.value)} placeholder={item.category === 'Meals' && Number(item.amount) > 50 ? 'Meal note required' : 'Note (optional)'} className="border border-stone-300 px-2 py-2 text-xs" />
            <button aria-label="Remove line item" disabled={items.length === 1} onClick={() => setItems(current => current.filter((_, i) => i !== index))} className="text-stone-400 disabled:opacity-20"><Trash2 size={16}/></button>
          </div>)}
        </div></div>
        <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-4"><button onClick={() => setItems(current => [...current, emptyItem()])} className="flex items-center gap-1.5 text-xs font-semibold text-[#26734d]"><Plus size={15}/> Add line item</button><div className="text-right"><p className="text-xs text-stone-500">Claim total</p><p className="font-display text-xl font-bold">{money(total)}</p></div></div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={save} disabled={saving} className="border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50">Save draft</button>{editing && <button onClick={() => submit(editing.id)} className="flex items-center gap-2 bg-[#183f2b] px-4 py-2 text-sm font-semibold text-white"><Send size={15}/> Submit claim</button>}</div>
      </div>
    </section>

    <aside className="border border-stone-200 bg-white"><div className="border-b border-stone-200 px-4 py-4"><h3 className="font-display text-sm font-bold">Your drafts</h3><p className="text-xs text-stone-500">{drafts.length} ready for review</p></div>
      <div className="max-h-[510px] overflow-y-auto scrollbar-thin">{drafts.length ? drafts.map(claim => <button key={claim.id} onClick={() => edit(claim)} className={`w-full border-b border-stone-100 p-4 text-left hover:bg-stone-50 ${editing?.id === claim.id ? 'bg-[#edf5f1]' : ''}`}><div className="flex justify-between"><span className="text-sm font-semibold">{claim.title}</span><ChevronRight size={16}/></div><p className="mt-1 text-xs text-stone-500">{money(claim.total)} · {claim.lineItems.length} items</p></button>) : <EmptyState text="No drafts" />}</div>
      <div className="border-t border-stone-200 px-4 py-3"><p className="text-xs font-semibold text-stone-500">All claims</p><div className="mt-2 space-y-2">{myClaims.slice(0, 4).map(claim => <div key={claim.id} className="flex items-center justify-between text-xs"><span className="truncate pr-2">#{claim.id} {claim.title}</span><Status value={claim.status}/></div>)}</div>{myClaims.some(claim => claim.status === 'Rejected') && <button onClick={() => { const claim = myClaims.find(item => item.status === 'Rejected'); submit(claim.id); }} className="mt-4 w-full border border-stone-300 py-2 text-xs font-semibold">Resubmit rejected claim</button>}</div>
    </aside>
  </div>;
}

function ClaimQueue({ role, user, claims, refresh, notify }) {
  const [comments, setComments] = useState({});
  const [selected, setSelected] = useState(null);
  const managerQueue = claims.filter(claim => claim.status === 'Submitted' && !claim.approvals.some(item => item.level === 'Manager'));
  const financeQueue = claims.filter(claim => claim.status === 'Submitted' && Number(claim.total) > 1000 && claim.approvals.some(item => item.level === 'Manager' && item.decision === 'Approved') && !claim.approvals.some(item => item.level === 'Finance'));
  const paidQueue = claims.filter(claim => claim.status === 'Approved');
  const queue = role === 'Manager' ? managerQueue : [...financeQueue, ...paidQueue];

  async function decide(claimId, decision) {
    try { await request(`/claims/${claimId}/decision`, { method: 'POST', body: JSON.stringify({ userId: user.id, decision, comment: comments[claimId] || '' }) }); notify(decision === 'Approved' ? 'Claim approved' : 'Claim rejected', 'success'); await refresh(); }
    catch (error) { notify(error.message, 'error'); }
  }
  async function pay(claimId) {
    try { await request(`/claims/${claimId}/pay`, { method: 'POST', body: JSON.stringify({ userId: user.id, comment: comments[claimId] || 'Payment processed' }) }); notify('Claim marked paid', 'success'); await refresh(); }
    catch (error) { notify(error.message, 'error'); }
  }
  async function exportCsv() {
    try {
      const response = await fetch('http://localhost:3000/api/claims/export/csv');
      if (!response.ok) throw new Error('CSV export failed');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'approved-paid-claims.csv';
      link.click();
      URL.revokeObjectURL(url);
      notify('CSV exported', 'success');
    } catch (error) { notify(error.message, 'error'); }
  }
  return <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
    <section className="border border-stone-200 bg-white"><div className="flex items-center justify-between border-b border-stone-200 px-4 py-4"><div><h2 className="font-display text-lg font-bold">{role === 'Manager' ? 'Approval queue' : 'Finance queue'}</h2><p className="text-xs text-stone-500">{queue.length} claims requiring attention</p></div>{role === 'Finance' && <button onClick={exportCsv} className="flex items-center gap-2 border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"><Download size={15}/> Export to CSV</button>}</div>
      {queue.length ? queue.map(claim => <button key={claim.id} onClick={() => setSelected(claim)} className={`w-full border-b border-stone-100 p-4 text-left hover:bg-stone-50 ${selected?.id === claim.id ? 'border-l-4 border-l-[#26734d] bg-[#f3f8f5]' : ''}`}><div className="flex items-center justify-between"><div><span className="text-sm font-semibold">#{claim.id} {claim.title}</span><p className="mt-1 text-xs text-stone-500">Submitted claim · {claim.lineItems.length} items</p></div><span className="font-display text-sm font-bold">{money(claim.total)}</span></div></button>) : <EmptyState text="Queue is clear" />}
    </section>
    <section className="border border-stone-200 bg-white">{selected ? <div>
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4"><div><h3 className="font-display text-lg font-bold">{selected.title}</h3><p className="text-xs text-stone-500">Claim #{selected.id} · Submitted {selected.updated_at}</p></div><Status value={selected.status}/></div>
      <div className="p-5"><div className="divide-y divide-stone-100 border-y border-stone-200">{selected.lineItems.map(item => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-3"><div><p className="text-sm font-semibold">{item.description}</p><p className="text-xs text-stone-500">{item.category} · {item.expense_date}{item.note ? ` · ${item.note}` : ''}</p></div><span className="text-sm font-semibold">{money(item.amount)}</span></div>)}</div><div className="my-5 flex justify-end border-b border-stone-200 pb-4"><div className="text-right"><p className="text-xs text-stone-500">Total</p><p className="font-display text-xl font-bold">{money(selected.total)}</p></div></div>
      {selected.status === 'Approved' ? <button onClick={() => pay(selected.id)} className="flex w-full items-center justify-center gap-2 bg-[#183f2b] py-2.5 text-sm font-semibold text-white"><CircleDollarSign size={17}/> Mark as Paid</button> : <><label className="mb-2 block text-xs font-semibold text-stone-600">Decision comment</label><textarea value={comments[selected.id] || ''} onChange={e => setComments(current => ({ ...current, [selected.id]: e.target.value }))} rows="3" className="w-full resize-none border border-stone-300 p-3 text-sm outline-none focus:border-[#26734d]"/><div className="mt-3 flex gap-2"><button onClick={() => decide(selected.id, 'Rejected')} className="flex-1 border border-red-200 py-2.5 text-sm font-semibold text-red-700">Reject</button><button onClick={() => decide(selected.id, 'Approved')} className="flex flex-1 items-center justify-center gap-2 bg-[#183f2b] py-2.5 text-sm font-semibold text-white"><Check size={16}/> Approve</button></div></>}
      </div>
    </div> : <EmptyState text="Select a claim to review" />}</section>
  </div>;
}

function AuditTrail({ claims, users }) {
  const [selectedId, setSelectedId] = useState(claims[0]?.id || '');
  const claim = claims.find(item => item.id === Number(selectedId)) || claims[0];
  if (!claims.length) return <EmptyState text="No claim activity" />;
  return <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"><aside className="border border-stone-200 bg-white"><div className="border-b border-stone-200 px-4 py-4"><h2 className="font-display text-lg font-bold">Claims</h2></div>{claims.map(item => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex w-full items-center justify-between border-b border-stone-100 p-4 text-left hover:bg-stone-50 ${claim?.id === item.id ? 'bg-[#f3f8f5]' : ''}`}><span className="text-sm font-semibold">#{item.id} {item.title}</span><ChevronRight size={15}/></button>)}</aside>
    <section className="border border-stone-200 bg-white"><div className="border-b border-stone-200 px-5 py-4"><h2 className="font-display text-lg font-bold">Audit trail</h2><p className="text-xs text-stone-500">#{claim.id} {claim.title}</p></div><div className="p-5">{claim.auditTrail?.length ? [...claim.auditTrail].reverse().map((entry, index) => {
      const actor = users.find(user => user.id === entry.user_id);
      return <div key={entry.id} className="relative ml-3 border-l border-stone-200 pb-7 pl-7 last:pb-0"><div className="status-dot absolute -left-[7px] top-1 h-[13px] w-[13px] rounded-full border-2 border-white bg-[#26734d]"/><p className="text-sm font-semibold">{entry.action}</p><p className="mt-0.5 text-xs text-stone-500">{actor?.name || `User ${entry.user_id}`} · {entry.created_at}</p>{entry.previous_status && <p className="mt-2 text-xs text-stone-500">{entry.previous_status} → {entry.new_status}</p>}{entry.comment && <div className="mt-2 border-l-2 border-stone-200 pl-3 text-sm text-stone-600">{entry.comment}</div>}</div>;
    }) : <EmptyState text="No audit entries" />}</div></section></div>;
}

export default function App() {
  const [role, setRole] = useState('Employee');
  const [users, setUsers] = useState([]);
  const [claims, setClaims] = useState([]);
  const [view, setView] = useState('Claims');
  const [toast, setToast] = useState(null);
  const user = users.find(item => item.role === role);
  async function refresh() { setClaims(await request('/claims')); }
  useEffect(() => { Promise.all([request('/users'), request('/claims')]).then(([nextUsers, nextClaims]) => { setUsers(nextUsers); setClaims(nextClaims); }).catch(error => setToast({ text: error.message, type: 'error' })); }, []);
  useEffect(() => { setView('Claims'); }, [role]);
  function notify(text, type) { setToast({ text, type }); setTimeout(() => setToast(null), 3200); }
  const nav = useMemo(() => ['Claims', 'Audit Trail'], []);
  return <div className="min-h-screen bg-[#f3f5f2]"><Header role={role} setRole={setRole} users={users}/><main className="mx-auto max-w-[1440px] px-4 py-5 md:px-8">
    <div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase text-[#26734d]">{role} workspace</p><h1 className="font-display mt-1 text-2xl font-bold text-stone-900">{view === 'Claims' ? (role === 'Employee' ? 'Expense claims' : 'Pending claims') : 'Claim audit trail'}</h1></div><nav className="flex gap-1 border-b border-stone-200">{nav.map(item => <button key={item} onClick={() => setView(item)} className={`border-b-2 px-3 py-2 text-xs font-semibold ${view === item ? 'border-[#26734d] text-[#26734d]' : 'border-transparent text-stone-500'}`}>{item}</button>)}</nav></div>
    {toast && <div className={`mb-4 border px-4 py-3 text-sm ${toast.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{toast.text}</div>}
    {view === 'Audit Trail' ? <AuditTrail claims={claims} users={users}/> : role === 'Employee' ? <ClaimEditor user={user} claims={claims} refresh={refresh} notify={notify}/> : <ClaimQueue role={role} user={user} claims={claims} refresh={refresh} notify={notify}/>}</main></div>;
}
