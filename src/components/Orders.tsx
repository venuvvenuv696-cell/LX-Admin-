import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit2, 
  Trash2, 
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, OrderStatus, Product } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import Modal from './ui/Modal';

interface OrdersProps {
  orders: Order[];
  products: Product[];
  onRefresh: () => void;
  onViewDetails: (order: Order) => void;
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-500/10 dark:text-neutral-500 dark:border-neutral-500/20',
  processing: 'bg-premium-gold/10 text-premium-gold border-premium-gold/20',
  shipping: 'bg-premium-gold text-white border-premium-gold',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500 dark:border-emerald-500/20',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-500 dark:border-rose-500/20',
};

const ORDER_STATUSES: OrderStatus[] = ['pending', 'processing', 'shipping', 'delivered', 'cancelled'];

export default function Orders({ orders, products, onRefresh, onViewDetails }: OrdersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, OrderStatus>>({});

  React.useEffect(() => {
    setOptimisticStatuses({});
  }, [orders]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Form State
  const [formData, setFormData] = useState({
    customer_name: '',
    email: '',
    phone: '',
    city: '',
    address: '',
    product_id: '',
    quantity: 1,
    status: 'processing' as OrderStatus
  });

  const resetForm = () => {
    setFormData({
      customer_name: '',
      email: '',
      phone: '',
      city: '',
      address: '',
      product_id: '',
      quantity: 1,
      status: 'processing'
    });
    setEditingOrder(null);
  };

  const currentProduct = products.find(p => p.id === formData.product_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id) {
        toast.error('Please select a product');
        return;
    }

    setLoading(true);
    try {
      const product = products.find(p => p.id === formData.product_id);
      
      // Front-end Stock Validation
      if (product) {
        if (product.stock <= 0 || product.status === 'sold_out') {
          toast.error(`"${product.name}" is currently out of stock.`);
          setLoading(false);
          return;
        }
        if (product.stock < formData.quantity) {
          toast.error(`Insufficient stock. Only ${product.stock} units available.`);
          setLoading(false);
          return;
        }
      }

      const total_price = (product?.price || 0) * formData.quantity;

      const payload = {
        ...formData,
        product_variant: product?.name || '',
        total_price
      };

      if (editingOrder) {
        const { error } = await supabase
          .from('orders')
          .update(payload)
          .eq('id', editingOrder.id);
        if (error) throw error;
        toast.success('Order updated');
      } else {
        // Create order - Stock is atomially decremented by a database trigger in Supabase
        const { error: orderError } = await supabase
          .from('orders')
          .insert([payload]);
        
        if (orderError) throw orderError;
        
        toast.success('Order placed successfully');
      }
      setIsModalOpen(false);
      resetForm();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Removed window.confirm due to iframe restrictions
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Order deleted');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOrder(order);
    setFormData({
      customer_name: order.customer_name,
      email: order.email,
      phone: order.phone,
      city: order.city,
      address: order.address,
      product_id: order.product_id || '',
      quantity: order.quantity,
      status: order.status
    });
    setIsModalOpen(true);
  };

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setOptimisticStatuses(prev => ({ ...prev, [orderId]: newStatus }));
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      
      if (error) throw error;
      toast.success(`Order status updated to ${newStatus}`);
      // Call onRefresh with true for silent update if available
      if (typeof onRefresh === 'function') {
        (onRefresh as any)(true);
      }
    } catch (err: any) {
      setOptimisticStatuses(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
      toast.error(`Update failed: ${err.message}`);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Search by name, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded-2xl focus:border-premium-gold outline-none shadow-sm transition-all text-sm"
            />
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-dark-card px-3 py-1.5 border border-apple-gray-200 dark:border-dark-border rounded-2xl shadow-sm overflow-x-auto no-scrollbar whitespace-nowrap">
            <Filter className="w-4 h-4 text-neutral-400 shrink-0" />
            <button 
              onClick={() => setStatusFilter('all')}
              className={cn("px-3 py-1 text-xs font-bold rounded-lg transition-all", statusFilter === 'all' ? "bg-neutral-950 dark:bg-premium-gold text-white" : "text-neutral-500 hover:bg-apple-gray-100 dark:hover:bg-dark-border")}
            >
              All
            </button>
            {ORDER_STATUSES.map(status => (
              <button 
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-lg transition-all capitalize", 
                  statusFilter === status ? "bg-premium-gold text-white" : "text-neutral-500 hover:bg-apple-gray-100 dark:hover:bg-dark-border"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-premium-gold text-white font-bold rounded-2xl hover:bg-premium-gold-light transition-all shadow-lg shadow-premium-gold/20"
        >
          <Plus className="w-5 h-5" />
          Create Order
        </button>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-3xl border border-apple-gray-200 dark:border-dark-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-apple-gray-50 dark:bg-dark-bg border-b border-apple-gray-100 dark:border-dark-border text-neutral-500 font-medium">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Qty</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apple-gray-100 dark:divide-dark-border">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-400 italic">No orders found.</td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="hover:bg-apple-gray-50 dark:hover:bg-dark-bg transition-colors cursor-pointer group"
                    onClick={() => onViewDetails(order)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold">{order.customer_name}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">ID: {order.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{order.product_variant}</td>
                    <td className="px-6 py-4 font-semibold">{order.quantity}</td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="relative flex items-center group/status">
                        <select 
                          value={optimisticStatuses[order.id] || order.status}
                          onChange={(e) => handleStatusUpdate(order.id, e.target.value as OrderStatus)}
                          className={cn(
                            "appearance-none cursor-pointer pl-3 pr-8 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border outline-none transition-all hover:scale-105 active:scale-95 focus:ring-4 focus:ring-premium-gold/10 bg-white dark:bg-dark-bg min-w-[110px] text-center shadow-sm",
                            STATUS_COLORS[optimisticStatuses[order.id] || order.status] || STATUS_COLORS.pending
                          )}
                        >
                          {ORDER_STATUSES.map(s => (
                            <option key={s} value={s} className="bg-white text-black capitalize font-medium py-2">
                              {s}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover/status:opacity-100 transition-opacity">
                          <ChevronRight className="w-3 h-3 text-current rotate-90" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                       {order.city}
                    </td>
                    <td className="px-6 py-4 text-neutral-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                         <button 
                            onClick={(e) => handleEdit(order, e)}
                            className="p-2 hover:bg-apple-gray-100 dark:hover:bg-dark-border rounded-xl text-neutral-500 hover:text-premium-gold transition-all active:scale-90"
                            title="Edit Order"
                         >
                           <Edit2 className="w-4 h-4" />
                         </button>
                         <button 
                            onClick={(e) => handleDelete(order.id, e)}
                            className="p-2 hover:bg-rose-50 text-neutral-400 hover:text-rose-500 rounded-xl transition-all active:scale-90"
                            title="Delete Order"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-apple-gray-50 dark:bg-dark-bg flex items-center justify-between border-t border-apple-gray-100 dark:border-dark-border">
            <span className="text-xs text-neutral-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length}
            </span>
            <div className="flex items-center gap-4">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-2 border border-apple-gray-300 dark:border-dark-border rounded-xl disabled:opacity-30 hover:bg-white dark:hover:bg-dark-card transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold">{currentPage}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-2 border border-apple-gray-300 dark:border-dark-border rounded-xl disabled:opacity-30 hover:bg-white dark:hover:bg-dark-card transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingOrder ? 'Edit Order' : 'Create New Order'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Customer Name</label>
              <input 
                required
                type="text"
                value={formData.customer_name}
                onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Email</label>
              <input 
                required
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Phone</label>
              <input 
                required
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">City</label>
              <input 
                required
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all shadow-inner"
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Full Shipping Address</label>
              <textarea 
                required
                rows={2}
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all resize-none shadow-inner"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Select Product</label>
              <select 
                required
                value={formData.product_id}
                onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all"
              >
                <option value="">Choose a product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id} disabled={p.status === 'sold_out'}>
                    {p.name} - ${p.price} ({p.stock} in stock)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Quantity</label>
              <input 
                required
                type="number"
                min="1"
                max={editingOrder ? undefined : currentProduct?.stock}
                value={formData.quantity}
                onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Status</label>
              <select 
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as OrderStatus })}
                className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all"
              >
                {ORDER_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <button 
            disabled={loading}
            className="w-full py-4 bg-premium-gold text-white font-bold rounded-2xl hover:bg-premium-gold-light disabled:opacity-50 shadow-xl shadow-premium-gold/20 transition-all active:scale-[0.98]"
          >
            {loading ? 'Processing...' : editingOrder ? 'Update Order' : 'Create Order'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
