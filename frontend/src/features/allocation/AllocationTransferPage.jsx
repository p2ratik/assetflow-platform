import React, { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { listAllocations, createTransferRequest, listTransferRequests, getUsers } from '../../api/allocation';
import { getAssets } from '../../api/assets';
import './AllocationTransferPage.css';

export default function AllocationTransferPage() {
  const { user } = useAuth();
  const canMutate = ['admin', 'asset_manager'].includes(user?.role);
  
  const [activeSidebarItem, setActiveSidebarItem] = useState('Allocation & Transfer');
  
  const [allocations, setAllocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [users, setUsers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [asset, setAsset] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, tRes] = await Promise.all([
        listAllocations(),
        canMutate ? listTransferRequests() : Promise.resolve({ data: [] }),
      ]);
      setAllocations(aRes.data);
      setTransfers(tRes.data);
    } catch (err) {
      toast.error('Failed to load allocation data');
      console.error('Allocation load error:', err);
    } finally {
      setLoading(false);
    }
  }, [canMutate]);

  useEffect(() => {
    getUsers()
      .then(r => { setUsers(r.data); })
      .catch(err => console.error(err));
    getAssets({ per_page: 500 })
      .then(r => { setAssets(r.data.items || []); })
      .catch(err => console.error(err));
    loadAllocations();
  }, [loadAllocations]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!asset) { toast.error('Please select an asset'); return; }
    if (!targetUser) { toast.error('Please select a target recipient'); return; }
    
    setSubmitting(true);
    try {
      await createTransferRequest({ 
        asset_id: parseInt(asset), 
        target_holder_id: parseInt(targetUser), 
        notes: reason || undefined 
      });
      toast.success('Transfer request submitted');
      setAsset('');
      setTargetUser('');
      setReason('');
      loadAllocations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit transfer');
    } finally {
      setSubmitting(false);
    }
  }

  const sidebarItems = [
    { name: 'Overview', icon: 'dashboard' },
    { name: 'Asset Inventory', icon: 'inventory_2' },
    { name: 'Allocation & Transfer', icon: 'swap_horiz' },
    { name: 'Audit Logs', icon: 'history' },
    { name: 'System Config', icon: 'settings' },
  ];

  // We will combine allocations and transfers to show in the history table
  const historyItems = [...allocations, ...transfers].sort((a, b) => {
    const dateA = a.allocated_at || a.created_at;
    const dateB = b.allocated_at || b.created_at;
    return new Date(dateB) - new Date(dateA);
  }).slice(0, 15);

  const allocatedAssets = assets.filter(a => a.status === 'Allocated');

  return (
    <div className="bg-background text-on-surface flex flex-col min-h-screen selection:bg-primary/20 selection:text-primary">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1e1f30', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 },
      }} />
      
      {/* Top Navigation */}
      <header className="w-full top-0 sticky border-b border-white/5 bg-background/80 backdrop-blur-xl z-50">
        <nav className="flex justify-between items-center h-20 px-margin max-w-container-max mx-auto">
          <div className="flex items-center gap-12">
            <span className="text-xl font-bold text-primary tracking-tighter">ENGINEERING</span>
            <div className="hidden md:flex gap-8 items-center">
              <a className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors duration-300" href="#">Dashboard</a>
              <a className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors duration-300" href="#">Projects</a>
              <a className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors duration-300" href="#">Documentation</a>
              <a className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors duration-300" href="#">Inquiry</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-5 py-2 rounded-full text-sm font-medium text-on-surface hover:text-primary transition-colors duration-200">
              {user ? user.name : 'Log In'}
            </button>
            <button className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]">Get Started</button>
          </div>
        </nav>
      </header>
      
      <div className="flex flex-1 max-w-container-max mx-auto w-full px-margin py-12 gap-12">
        {/* Sidebar Navigation */}
        <aside className="w-64 flex-shrink-0 hidden md:flex flex-col gap-1.5">
          {sidebarItems.map((item) => (
            <div
              key={item.name}
              onClick={() => setActiveSidebarItem(item.name)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer group ${
                activeSidebarItem === item.name
                  ? 'bg-white/10 text-white border border-white/10 font-semibold'
                  : 'text-on-surface-variant hover:bg-white/5 hover:text-white font-medium border border-transparent'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" data-icon={item.icon}>{item.icon}</span>
              <span className="text-sm">{item.name}</span>
            </div>
          ))}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col gap-10">
          {/* Page Title */}
          <div className="flex flex-col gap-2">
            <h1 className="serif-header text-5xl text-primary font-medium tracking-tight">Allocation &amp; Transfer</h1>
            <p className="text-base text-on-surface-variant/80">Manage the movement and lifecycle of critical engineering hardware with precision.</p>
          </div>

          {/* Transfer Request Form Card */}
          <section className="glass-panel rounded-[2rem] overflow-hidden">
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="serif-header text-2xl text-primary font-medium">Transfer Request</h2>
              <span className="text-[10px] font-label-mono uppercase text-on-surface-variant/40 tracking-[0.2em]">New Entry Protocol</span>
            </div>
            <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Asset Field */}
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-label-mono text-on-surface-variant/60 uppercase tracking-widest px-1">Asset Identity</label>
                <div className="relative group">
                  <select 
                    value={asset} 
                    onChange={e => setAsset(e.target.value)}
                    className="glass-input w-full rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10 transition-all appearance-none"
                  >
                    <option value="" className="bg-surface-container">Select allocated asset...</option>
                    {allocatedAssets.map(a => (
                      <option key={a.id} value={a.id} className="bg-surface-container">{a.tag} — {a.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 pointer-events-none" data-icon="expand_more">expand_more</span>
                </div>
              </div>
              
              {/* To Field */}
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-label-mono text-on-surface-variant/60 uppercase tracking-widest px-1">Target Recipient</label>
                <div className="relative group">
                  <select 
                    value={targetUser} 
                    onChange={e => setTargetUser(e.target.value)}
                    className="glass-input w-full rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10 transition-all appearance-none"
                  >
                    <option value="" className="bg-surface-container">Search employee...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id} className="bg-surface-container">{u.name} ({u.role})</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 pointer-events-none" data-icon="expand_more">expand_more</span>
                </div>
              </div>
              
              {/* Reason Field */}
              <div className="flex flex-col gap-3 md:col-span-2">
                <label className="text-[10px] font-label-mono text-on-surface-variant/60 uppercase tracking-widest px-1">Transfer Rationale</label>
                <textarea 
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  className="glass-input w-full rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10 transition-all placeholder:text-on-surface-variant/30 resize-none min-h-[120px]" 
                  placeholder="Provide a detailed rationale for this asset transfer..." 
                />
              </div>
              
              {/* Submit Action */}
              <div className="md:col-span-2 flex justify-end gap-6 pt-4">
                <button type="button" onClick={() => { setAsset(''); setTargetUser(''); setReason(''); }} className="px-8 py-3.5 rounded-full border border-white/10 text-sm font-medium text-on-surface-variant hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                <button type="submit" disabled={submitting} className="px-10 py-3.5 rounded-full bg-white text-black text-sm font-bold hover:bg-white/90 hover:scale-[1.02] transition-all active:scale-95 shadow-[0_10px_30px_rgba(255,255,255,0.15)] disabled:opacity-50">Initiate Transfer</button>
              </div>
            </form>
          </section>

          {/* Allocation History Table */}
          <section className="glass-panel rounded-[2rem] overflow-hidden">
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="serif-header text-2xl text-primary font-medium">Allocation History</h2>
              <div className="flex gap-3">
                <button className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 hover:bg-white/10 transition-all">
                  <span className="material-symbols-outlined text-[18px]" data-icon="filter_list">filter_list</span>
                </button>
                <button className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 hover:bg-white/10 transition-all">
                  <span className="material-symbols-outlined text-[18px]" data-icon="download">download</span>
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white/[0.02]">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-label-mono text-on-surface-variant/40 uppercase tracking-widest border-b border-white/5">Date</th>
                    <th className="px-8 py-5 text-[10px] font-label-mono text-on-surface-variant/40 uppercase tracking-widest border-b border-white/5">Asset Reference</th>
                    <th className="px-8 py-5 text-[10px] font-label-mono text-on-surface-variant/40 uppercase tracking-widest border-b border-white/5">Origin</th>
                    <th className="px-8 py-5 text-[10px] font-label-mono text-on-surface-variant/40 uppercase tracking-widest border-b border-white/5">Destination</th>
                    <th className="px-8 py-5 text-[10px] font-label-mono text-on-surface-variant/40 uppercase tracking-widest border-b border-white/5">Status</th>
                    <th className="px-8 py-5 border-b border-white/5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr><td colSpan="6" className="text-center py-8 text-on-surface-variant">Loading records...</td></tr>
                  ) : historyItems.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-8 text-on-surface-variant">No allocation history found.</td></tr>
                  ) : historyItems.map((item) => {
                    const isTransfer = item.target_holder_name !== undefined;
                    const date = item.allocated_at || item.created_at;
                    return (
                      <tr key={isTransfer ? `t-${item.id}` : `a-${item.id}`} className="hover:bg-white/[0.03] transition-colors group cursor-pointer">
                        <td className="px-8 py-6 text-sm font-label-mono text-on-surface-variant">
                          {date ? new Date(date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold text-white">{item.asset_name}</span>
                            <span className="text-[10px] text-on-surface-variant/50 font-label-mono">{item.asset_tag}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-sm text-on-surface-variant">
                          {isTransfer ? item.current_holder_name : 'Inventory Core'}
                        </td>
                        <td className="px-8 py-6 text-sm text-on-surface-variant">
                          {isTransfer ? item.target_holder_name : item.employee_name}
                        </td>
                        <td className="px-8 py-6">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${
                            item.status === 'active' || item.status === 'approved' ? 'bg-emerald-400/10 border-emerald-400/20' : 
                            item.status === 'requested' ? 'bg-yellow-400/10 border-yellow-400/20' : 
                            'bg-white/5 border-white/10'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.status === 'active' || item.status === 'approved' ? 'bg-emerald-400' : 
                              item.status === 'requested' ? 'bg-yellow-400 animate-pulse' : 
                              'bg-on-surface-variant/40'
                            }`}></span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              item.status === 'active' || item.status === 'approved' ? 'text-emerald-400' : 
                              item.status === 'requested' ? 'text-yellow-400' : 
                              'text-on-surface-variant/60'
                            }`}>{item.status}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/10 rounded-lg">
                            <span className="material-symbols-outlined text-[20px]" data-icon="more_horiz">more_horiz</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="p-6 flex justify-center bg-white/[0.01]">
              <button className="text-sm font-medium text-on-surface-variant hover:text-white transition-all flex items-center gap-3 py-2 px-6 rounded-full hover:bg-white/5">
                View Complete Audit History
                <span className="material-symbols-outlined text-[18px]" data-icon="arrow_forward">arrow_forward</span>
              </button>
            </div>
          </section>
        </main>
      </div>
      
      {/* Footer */}
      <footer className="w-full py-16 mt-20 border-t border-white/5 bg-background">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin max-w-container-max mx-auto gap-8">
          <span className="text-xl font-bold text-primary tracking-tighter">ENGINEERING</span>
          <span className="text-sm text-on-surface-variant/50">© 2024 Engineering Systems Corp. Standard of Excellence.</span>
          <div className="flex gap-10">
            <a className="text-sm text-on-surface-variant hover:text-white transition-colors" href="#">Privacy</a>
            <a className="text-sm text-on-surface-variant hover:text-white transition-colors" href="#">Terms</a>
            <a className="text-sm text-on-surface-variant hover:text-white transition-colors" href="#">Security</a>
            <a className="text-sm text-on-surface-variant hover:text-white transition-colors" href="#">System Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
