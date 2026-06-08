import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  Package, 
  Image as ImageIcon,
  Tag,
  Hash,
  DollarSign,
  CheckCircle2,
  XCircle,
  Upload,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, ProductStatus } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import Modal from './ui/Modal';

interface ProductsProps {
  products: Product[];
  onRefresh: () => void;
}

const CATEGORIES = [
  "3D Printing Parts",
  "VMC Machining Parts",
  "3D Machine",
  "VMC Machine",
  "Filament Shop"
];

export default function Products({ products, onRefresh }: ProductsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    stock: 0,
    category: '',
    image_url: '',
    description: '',
    status: 'available' as ProductStatus
  });

  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<{ [productId: string]: number }>({});

  const resetForm = () => {
    setFormData({
      name: '',
      price: 0,
      stock: 0,
      category: '',
      image_url: '',
      description: '',
      status: 'available'
    });
    setEditingProduct(null);
    setUploadingFiles([]);
    setExistingImages([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadingFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      image_url: product.image_url || '',
      description: product.description || '',
      status: product.status
    });

    // Parse existing images
    if (product.image_url) {
      try {
        if (product.image_url.startsWith('[') && product.image_url.endsWith(']')) {
          setExistingImages(JSON.parse(product.image_url));
        } else {
          setExistingImages([product.image_url]);
        }
      } catch (e) {
        setExistingImages([product.image_url]);
      }
    }
    
    setIsModalOpen(true);
  };

  const removeExistingImage = (url: string) => {
    setExistingImages(prev => prev.filter(u => u !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let uploadedUrls: string[] = [];

      // Handle file uploads if any
      if (uploadingFiles.length > 0) {
        const uploadToast = toast.loading('Syncing assets to cloud storage...');
        
        for (const file of uploadingFiles) {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(7)}_${Date.now()}.${fileExt}`;
            const filePath = `products/${fileName}`;

            // Try 'product-images' bucket first, fallback to 'custom-orders' or 'product images' if it fails
            let bucket = 'product-images';
            const { error: firstTryError } = await supabase.storage.from(bucket).upload(filePath, file);
            
            if (firstTryError) {
              bucket = 'product images';
              const { error: secondTryError } = await supabase.storage.from(bucket).upload(filePath, file);
              
              if (secondTryError) {
                bucket = 'custom-orders';
                const { error: thirdTryError } = await supabase.storage.from(bucket).upload(filePath, file);
                if (thirdTryError) throw thirdTryError;
              }
            }

            const { data: { publicUrl } } = supabase.storage
              .from(bucket)
              .getPublicUrl(filePath);
            
            uploadedUrls.push(publicUrl);
          } catch (uploadError: any) {
            console.error('File upload failed:', uploadError);
            toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
          }
        }

        toast.dismiss(uploadToast);
      }

      // Consolidate final images
      let allImages = [...existingImages, ...uploadedUrls];
      
      // If user manually entered a URL that isn't in the list
      if (formData.image_url && !formData.image_url.startsWith('[') && !allImages.includes(formData.image_url)) {
        // Only add if it's actually a URL
        if (formData.image_url.includes('://')) {
          allImages.push(formData.image_url);
        }
      }

      // Remove duplicates
      allImages = [...new Set(allImages)];

      let finalImageUrl = '';
      if (allImages.length === 1) {
        finalImageUrl = allImages[0];
      } else if (allImages.length > 1) {
        finalImageUrl = JSON.stringify(allImages.filter(Boolean));
      }

      const payload = {
        ...formData,
        image_url: finalImageUrl,
        status: formData.stock <= 0 ? 'sold_out' : formData.status
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Product updated successfully');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([payload]);
        if (error) throw error;
        toast.success('Product added successfully');
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

  const getDisplayImage = (imageUrl?: string, productId?: string) => {
    if (!imageUrl) return null;
    try {
      // Handle Supabase public URL logic specifically if needed, but standard URL should work
      if (imageUrl.startsWith('[') && imageUrl.endsWith(']')) {
        const urls = JSON.parse(imageUrl);
        const index = productId ? (activeImageIndex[productId] || 0) : 0;
        return urls[index] || urls[0];
      }
      return imageUrl;
    } catch (e) {
      return imageUrl;
    }
  };

  const getImagesCount = (imageUrl?: string) => {
    if (!imageUrl) return 0;
    try {
      if (imageUrl.startsWith('[') && imageUrl.endsWith(']')) {
        return JSON.parse(imageUrl).length;
      }
      return 1;
    } catch (e) {
      return 1;
    }
  };

  const cycleImage = (productId: string, imageUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const count = getImagesCount(imageUrl);
    if (count <= 1) return;
    
    setActiveImageIndex(prev => ({
      ...prev,
      [productId]: ((prev[productId] || 0) + 1) % count
    }));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Removed window.confirm due to iframe restrictions
    setLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Delete error details:', error);
        throw error;
      }
      
      toast.success('Product deleted successfully');
      onRefresh();
    } catch (err: any) {
      console.error('Delete operation failed:', err);
      toast.error(`Delete failed: ${err.message || 'Check your Supabase policies'}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded-2xl focus:border-premium-gold outline-none shadow-sm transition-all text-sm"
            />
          </div>
          
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-premium-gold text-white font-bold rounded-2xl hover:bg-premium-gold-light transition-all shadow-lg shadow-premium-gold/20"
          >
            <Plus className="w-5 h-5" />
            Add New Product
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-dark-card p-1.5 border border-apple-gray-200 dark:border-dark-border rounded-2xl shadow-sm overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth">
          <button 
            onClick={() => setCategoryFilter('all')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all",
              categoryFilter === 'all' ? "bg-premium-gold text-white shadow-lg shadow-premium-gold/20" : "text-neutral-500 hover:bg-apple-gray-100 dark:hover:bg-dark-bg"
            )}
          >
            All Products
          </button>
          {CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all",
                categoryFilter === cat ? "bg-premium-gold text-white shadow-lg shadow-premium-gold/20" : "text-neutral-500 hover:bg-apple-gray-100 dark:hover:bg-dark-bg"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white dark:bg-dark-card rounded-3xl border border-apple-gray-200 dark:border-dark-border overflow-hidden shadow-sm group hover:shadow-xl transition-all duration-300">
            <div className="h-48 bg-apple-gray-100 dark:bg-dark-bg relative overflow-hidden">
              {product.image_url ? (
                <div 
                  className="w-full h-full cursor-pointer relative group"
                  onClick={(e) => cycleImage(product.id, product.image_url, e)}
                >
                  <img 
                    src={getDisplayImage(product.image_url, product.id) || ''} 
                    alt={product.name} 
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('placeholder')) {
                        target.src = `https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80`;
                      }
                    }}
                  />
                  {getImagesCount(product.image_url) > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {Array.from({ length: getImagesCount(product.image_url) }).map((_, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "w-1.5 h-1.5 rounded-full border border-white/50",
                            (activeImageIndex[product.id] || 0) === i ? "bg-white scale-110" : "bg-white/40"
                          )}
                        />
                      ))}
                    </div>
                  )}
                  {getImagesCount(product.image_url) > 1 && (
                    <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
                        <X className="w-3 h-3 rotate-180" /> {/* Left-ish arrow placeholder */}
                      </div>
                      <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
                        <Plus className="w-3 h-3 rotate-45" /> {/* Right-ish arrow placeholder */}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-apple-gray-300" />
                </div>
              )}
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={() => handleEdit(product)}
                  className="p-2 bg-white/90 backdrop-blur-md text-neutral-900 rounded-xl hover:bg-white transition-colors shadow-sm"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => handleDelete(product.id, e)}
                  className="p-2 bg-rose-500/90 backdrop-blur-md text-white rounded-xl hover:bg-rose-500 transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className={cn(
                "absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                product.status === 'available' ? "bg-emerald-500/90 text-white" : "bg-rose-500/90 text-white"
              )}>
                {product.status.replace('_', ' ')}
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] text-neutral-400 font-black uppercase tracking-widest">{product.category}</p>
                <h4 className="text-lg font-bold truncate mt-0.5">{product.name}</h4>
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Current Stock</p>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xl font-black",
                      product.stock <= 5 ? "text-rose-500" : "text-neutral-900 dark:text-neutral-100"
                    )}>
                      {product.stock}
                    </span>
                    {product.stock <= 5 && <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500 mb-1">Price</p>
                  <p className="text-xl font-black text-premium-gold">${product.price.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProduct ? 'Edit Product' : 'Add Product'}
      >
        <div className="max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Product Name</label>
                <input 
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all"
                  placeholder="Ex: iPhone 15 Pro Max"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Price ($)</label>
                <input 
                  required
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Stock Inventory</label>
                <input 
                  required
                  type="number"
                  value={formData.stock}
                  onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Category</label>
                <select 
                  required
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all"
                >
                  <option value="">Select Category</option>
                  <option value="3D Printing Parts">3D Printing Parts</option>
                  <option value="VMC Machining Parts">VMC Machining Parts</option>
                  <option value="3D Machine">3D Machine</option>
                  <option value="VMC Machine">VMC Machine</option>
                  <option value="Filament Shop">Filament Shop</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Initial Status</label>
                <select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as ProductStatus })}
                  className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all"
                >
                  <option value="available">Available</option>
                  <option value="sold_out">Sold Out</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Product Images</label>
                
                <div className="space-y-4">
                  {/* Current Images Preview */}
                  {(existingImages.length > 0 || uploadingFiles.length > 0) && (
                    <div className="grid grid-cols-4 gap-2">
                      {existingImages.map((url, idx) => (
                        <div key={`exist-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-apple-gray-200 dark:border-dark-border bg-neutral-100 dark:bg-dark-bg group">
                          <img 
                            src={url} 
                            alt="existing" 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Broken+Link';
                            }}
                          />
                          <button 
                            type="button"
                            onClick={() => removeExistingImage(url)}
                            className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {uploadingFiles.map((file, idx) => (
                        <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-premium-gold/30 bg-neutral-100 dark:bg-dark-bg group">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt="preview" 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-premium-gold/10 pointer-events-none" />
                          <button 
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="absolute bottom-1 right-1">
                            <div className="w-2 h-2 bg-premium-gold rounded-full animate-pulse shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* File Upload Area */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-apple-gray-200 dark:border-dark-border rounded-3xl cursor-pointer hover:bg-apple-gray-50 dark:hover:bg-dark-bg transition-all group"
                  >
                    <div className="w-12 h-12 bg-premium-gold/10 text-premium-gold rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400">Click to upload images</p>
                    <p className="text-[10px] text-neutral-400 mt-1 uppercase tracking-widest">Support multiple files</p>
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      multiple
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Uploading Files Preview */}
                  {uploadingFiles.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {uploadingFiles.map((file, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-apple-gray-200 dark:border-dark-border bg-neutral-100 dark:bg-dark-bg group">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt="preview" 
                            className="w-full h-full object-cover" 
                          />
                          <button 
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Existing Image URL (Manual Override) */}
                  <div>
                    <label className="block text-[9px] text-neutral-400 uppercase tracking-tighter mb-1">Manual Image URL (Optional)</label>
                    <input 
                      type="url"
                      value={formData.image_url}
                      onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full px-4 py-2 text-xs bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-xl focus:bg-white focus:border-premium-gold outline-none transition-all"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Description</label>
                <textarea 
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all resize-none"
                  placeholder="Product details..."
                />
              </div>
            </div>

            <button 
              disabled={loading}
              className="w-full py-4 mt-6 bg-premium-gold text-white font-bold rounded-2xl hover:bg-premium-gold-light disabled:opacity-50 shadow-xl shadow-premium-gold/20 transition-all active:scale-[0.98]"
            >
              {loading ? 'Processing...' : editingProduct ? 'Update Product' : 'Create Product'}
            </button>
          </form>
        </div>
      </Modal>
    </div>
  );
}
