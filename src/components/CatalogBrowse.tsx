import React, { useState, useEffect } from 'react';
import { api } from '../api/client.ts';
import { Book, Category, Author, Publisher } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { BookCardSkeleton } from './common/LoadingSkeleton.tsx';
import { EmptyState } from './common/EmptyState.tsx';
import { ErrorState } from './common/ErrorState.tsx';
import { BookDetailModal } from './BookDetailModal.tsx';
import {
  Search,
  BookOpen,
  Plus,
  BookmarkPlus,
  CopyPlus,
  ChevronLeft,
  ChevronRight,
  X,
  Edit3,
  User,
  FolderPlus,
  Trash2,
  Image,
} from 'lucide-react';

interface CatalogBrowseProps {
  onSelectBook?: (bookId: number) => void;
  openAuthModal: () => void;
  initialQuery?: string;
  initialCategoryId?: string;
  initialBookId?: number | null;
}

export const CatalogBrowse: React.FC<CatalogBrowseProps> = ({
  openAuthModal,
  initialQuery = '',
  initialCategoryId = '',
  initialBookId = null,
}) => {
  const { user } = useAuth();
  const toast = useToast();

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategoryId);
  const [authorSearch, setAuthorSearch] = useState<string>('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected book for details modal
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Category Management state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState({ name: '', description: '' });
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

  // Edit Book state
  const [showEditBookModal, setShowEditBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editBookErrors, setEditBookErrors] = useState<Record<string, string>>({});
  const [editBookForm, setEditBookForm] = useState({
    title: '',
    isbn: '',
    subtitle: '',
    publisherName: '',
    categoryId: '',
    authorInput: '',
    language: 'Tiếng Việt',
    publicationYear: 2024,
    pageCount: 300,
    description: '',
    coverImageUrl: '',
  });

  useEffect(() => {
    if (initialQuery !== undefined) setSearchQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (initialCategoryId !== undefined) setSelectedCategory(initialCategoryId);
  }, [initialCategoryId]);

  useEffect(() => {
    if (initialBookId) {
      handleOpenBookDetail(initialBookId);
    }
  }, [initialBookId]);

  // Form Modals
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showAddCopyModal, setShowAddCopyModal] = useState(false);
  const [copyBookTarget, setCopyBookTarget] = useState<Book | null>(null);

  // Form states & submission
  const [isSubmittingBook, setIsSubmittingBook] = useState(false);
  const [isSubmittingCopy, setIsSubmittingCopy] = useState(false);
  const [bookErrors, setBookErrors] = useState<Record<string, string>>({});
  const [copyErrors, setCopyErrors] = useState<Record<string, string>>({});

  const [bookForm, setBookForm] = useState({
    title: '',
    isbn: '',
    subtitle: '',
    publisherName: '',
    categoryId: '',
    authorInput: '',
    language: 'Tiếng Việt',
    publicationYear: 2024,
    pageCount: 300,
    description: '',
    coverImageUrl: '',
    initialCopies: 1,
  });

  const [copyCodeInput, setCopyCodeInput] = useState('');
  const [shelfLocationInput, setShelfLocationInput] = useState('');

  const isStaff = user?.role === 'ADMIN' || user?.role === 'LIBRARIAN';

  const fetchFilters = async () => {
    try {
      const [catData, authData, pubData] = await Promise.all([
        api.getCategories(),
        api.getAuthors(),
        api.getPublishers(),
      ]);
      setCategories(catData || []);
      setAuthors(authData || []);
      setPublishers(pubData || []);
    } catch {
      // Non-fatal
    }
  };

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        page,
        size: 8,
      };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (selectedCategory) params.categoryId = selectedCategory;
      if (authorSearch.trim()) params.authorName = authorSearch.trim();
      if (availableOnly) params.availableOnly = 'true';

      const res = await api.getBooks(params);
      setBooks(res.content || []);
      setTotalPages(res.totalPages || 1);
      setTotalElements(res.totalElements || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Không thể tải danh mục sách.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [searchQuery, selectedCategory, authorSearch, availableOnly, page]);

  const handleOpenBookDetail = async (bookId: number) => {
    try {
      const b = await api.getBook(bookId);
      setSelectedBook(b);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải thông tin chi tiết sách.');
    }
  };

  const handlePlaceReservation = async (bookId: number) => {
    if (!user) {
      openAuthModal();
      return;
    }
    try {
      const res = await api.createReservation(bookId);
      toast.success(
        `Đã vị trí giữ sách thành công! Vị trí hàng đợi: #${res.queuePosition}.`,
        'Đặt Giữ Sách Thành Công'
      );
      if (selectedBook) {
        handleOpenBookDetail(bookId);
      }
      fetchBooks();
    } catch (err: any) {
      toast.error(err.message || 'Không thể đặt giữ sách.');
    }
  };

  const validateBookForm = () => {
    const errs: Record<string, string> = {};
    if (!bookForm.title.trim()) {
      errs.title = 'Vui lòng nhập tựa sách';
    }
    const cleanIsbn = bookForm.isbn.replace(/[-\s]/g, '');
    if (!cleanIsbn) {
      errs.isbn = 'Vui lòng nhập ISBN';
    }
    if (!bookForm.categoryId) {
      errs.categoryId = 'Vui lòng chọn thể loại';
    }
    if (!bookForm.publisherName.trim()) {
      errs.publisherName = 'Vui lòng nhập tên nhà xuất bản';
    }
    if (!bookForm.authorInput.trim()) {
      errs.authorInput = 'Vui lòng nhập tên tác giả';
    }
    setBookErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBookForm()) return;

    setIsSubmittingBook(true);
    try {
      const payload = {
        title: bookForm.title.trim(),
        isbn: bookForm.isbn.trim(),
        subtitle: bookForm.subtitle.trim() || undefined,
        publisherName: bookForm.publisherName.trim(),
        categoryId: parseInt(bookForm.categoryId, 10),
        authors: bookForm.authorInput.trim(),
        language: bookForm.language || 'Tiếng Việt',
        publicationYear: Number(bookForm.publicationYear),
        pageCount: Number(bookForm.pageCount) || undefined,
        description: bookForm.description.trim() || undefined,
        coverImageUrl: bookForm.coverImageUrl.trim() || undefined,
        initialCopies: Math.max(1, Number(bookForm.initialCopies) || 1),
      };

      await api.createBook(payload);
      toast.success(`Đã thêm sách "${bookForm.title}" vào danh mục thành công!`, 'Thành Công');
      setShowAddBookModal(false);
      setBookForm({
        title: '',
        isbn: '',
        subtitle: '',
        publisherName: '',
        categoryId: '',
        authorInput: '',
        language: 'Tiếng Việt',
        publicationYear: 2024,
        pageCount: 300,
        description: '',
        coverImageUrl: '',
        initialCopies: 1,
      });
      setBookErrors({});
      fetchBooks();
      fetchFilters();
    } catch (err: any) {
      toast.error(err.message || 'Thêm sách thất bại.');
    } finally {
      setIsSubmittingBook(false);
    }
  };

  // Category Management Handlers
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;
    setIsSubmittingCategory(true);
    try {
      await api.createCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
      });
      toast.success(`Đã thêm thể loại "${categoryForm.name}"!`, 'Thành Công');
      setCategoryForm({ name: '', description: '' });
      fetchFilters();
    } catch (err: any) {
      toast.error(err.message || 'Thêm thể loại thất bại.');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCategoryForm.name.trim()) return;
    setIsSubmittingCategory(true);
    try {
      await api.updateCategory(editingCategory.id, {
        name: editCategoryForm.name.trim(),
        description: editCategoryForm.description.trim() || undefined,
      });
      toast.success(`Đã cập nhật thể loại "${editCategoryForm.name}"!`, 'Thành Công');
      setEditingCategory(null);
      setEditCategoryForm({ name: '', description: '' });
      fetchFilters();
      fetchBooks();
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật thể loại thất bại.');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa thể loại này?')) return;
    try {
      await api.deleteCategory(catId);
      toast.success('Đã xóa thể loại thành công.');
      fetchFilters();
      fetchBooks();
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa thể loại.');
    }
  };

  const validateCopyForm = () => {
    const errs: Record<string, string> = {};
    if (!copyCodeInput.trim()) {
      errs.copyCode = 'Vui lòng nhập mã bản sao';
    }
    setCopyErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copyBookTarget) return;
    if (!validateCopyForm()) return;

    setIsSubmittingCopy(true);
    try {
      await api.addBookCopy(copyBookTarget.id, {
        copyCode: copyCodeInput.trim().toUpperCase(),
        shelfLocation: shelfLocationInput.trim() || undefined,
      });
      toast.success(`Đã thêm bản sao vật lý ${copyCodeInput.trim().toUpperCase()}!`, 'Thành Công');
      setShowAddCopyModal(false);
      setCopyCodeInput('');
      setShelfLocationInput('');
      setCopyErrors({});
      if (selectedBook) {
        handleOpenBookDetail(selectedBook.id);
      }
      fetchBooks();
    } catch (err: any) {
      toast.error(err.message || 'Thêm bản sao thất bại.');
    } finally {
      setIsSubmittingCopy(false);
    }
  };

  const handleDeleteBook = async (bookId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa đầu sách này khỏi danh mục? Action này không thể hoàn tác.')) {
      return;
    }
    try {
      await api.deleteBook(bookId);
      toast.success('Đã xóa đầu sách khỏi danh mục.', 'Đã xóa');
      setSelectedBook(null);
      fetchBooks();
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa đầu sách.');
    }
  };

  const handleUpdateCopyStatus = async (copyId: number, status: string) => {
    try {
      await api.updateCopyStatus(copyId, status);
      toast.success(`Đã cập nhật trạng thái bản sao thành ${status}.`);
      if (selectedBook) {
        handleOpenBookDetail(selectedBook.id);
      }
      fetchBooks();
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật trạng thái thất bại.');
    }
  };

  const handleOpenEditBook = (b: Book) => {
    setEditingBook(b);
    const resolvedCategoryId = b.categoryId || b.category?.id;

    setEditBookForm({
      title: b.title || '',
      isbn: b.isbn || '',
      subtitle: b.subtitle || '',
      publisherName: b.publisher?.name || '',
      categoryId: resolvedCategoryId ? String(resolvedCategoryId) : '',
      authorInput: b.authors ? b.authors.map((a) => a.name).join(', ') : '',
      language: b.language || 'Tiếng Việt',
      publicationYear: b.publicationYear || 2024,
      pageCount: b.pageCount || 300,
      description: b.description || '',
      coverImageUrl: b.coverImageUrl || '',
    });
    setEditBookErrors({});
    setShowEditBookModal(true);
  };

  const validateEditBookForm = () => {
    const errs: Record<string, string> = {};
    if (!editBookForm.title.trim()) {
      errs.title = 'Tựa sách không được để trống';
    }
    if (!editBookForm.isbn.trim()) {
      errs.isbn = 'Mã ISBN không được để trống';
    }
    if (!editBookForm.authorInput.trim()) {
      errs.authorInput = 'Vui lòng nhập tên tác giả';
    }
    setEditBookErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleUpdateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;
    if (!validateEditBookForm()) return;

    setIsSubmittingEdit(true);
    try {
      const payload: any = {
        title: editBookForm.title.trim(),
        isbn: editBookForm.isbn.trim(),
        subtitle: editBookForm.subtitle.trim() || undefined,
        publisherName: editBookForm.publisherName.trim() || undefined,
        categoryId: editBookForm.categoryId ? parseInt(editBookForm.categoryId, 10) : undefined,
        authors: editBookForm.authorInput.trim(),
        language: editBookForm.language || 'Tiếng Việt',
        publicationYear: Number(editBookForm.publicationYear) || undefined,
        pageCount: Number(editBookForm.pageCount) || undefined,
        description: editBookForm.description.trim() || undefined,
        coverImageUrl: editBookForm.coverImageUrl.trim() || undefined,
      };

      await api.updateBook(editingBook.id, payload);
      toast.success(`Đã cập nhật thông tin sách "${editBookForm.title}"!`, 'Thành Công');
      setShowEditBookModal(false);
      setEditingBook(null);
      if (selectedBook && selectedBook.id === editingBook.id) {
        handleOpenBookDetail(editingBook.id);
      }
      fetchBooks();
      fetchFilters();
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật ấn bản thất bại.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setAuthorSearch('');
    setAvailableOnly(false);
    setPage(0);
  };

  const hasActiveFilters = Boolean(
    searchQuery || selectedCategory || authorSearch || availableOnly
  );

  return (
    <div className="space-y-6">
      {/* Header & Filter Card */}
      <div className="ui-card p-6 space-y-5 border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <BookOpen className="w-4 h-4" />
              <span>Tra Cứu Danh Mục Thư Viện</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Kho Tài Liệu & Sách Học Thuật
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Hiển thị {totalElements} ấn bản đã biên mục sẵn sàng cho mượn và nghiên cứu.
            </p>
          </div>
          {isStaff && (
            <div className="flex items-center gap-2 self-start flex-wrap">
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="btn-secondary rounded-xl flex items-center gap-1.5 py-2 px-3.5 text-xs font-semibold cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-indigo-400" />
                <span>Quản lý Thể loại</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setBookErrors({});
                  setShowAddBookModal(true);
                }}
                className="btn-primary rounded-xl flex items-center gap-1.5 py-2 px-3.5 text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm sách mới</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tựa sách, tác giả, ISBN..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="ui-input pl-9 text-xs bg-slate-900/90 border-slate-700/80 text-white rounded-lg"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(0);
              }}
              className="ui-input text-xs cursor-pointer bg-slate-900/90 border-slate-700/80 text-white rounded-lg"
            >
              <option value="" className="bg-slate-900">Tất cả Thể loại</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Author Input Filter */}
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Lọc theo tác giả..."
              value={authorSearch}
              onChange={(e) => {
                setAuthorSearch(e.target.value);
                setPage(0);
              }}
              className="ui-input pl-9 pr-7 text-xs bg-slate-900/90 border-slate-700/80 text-white rounded-lg"
            />
            {authorSearch && (
              <button
                type="button"
                onClick={() => {
                  setAuthorSearch('');
                  setPage(0);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Availability Checkbox & Reset */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg">
            <label className="text-xs text-slate-200 font-medium flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => {
                  setAvailableOnly(e.target.checked);
                  setPage(0);
                }}
                className="rounded text-indigo-500 border-slate-700 cursor-pointer focus:ring-0"
              />
              <span>Chỉ hiện sách có sẵn</span>
            </label>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
              >
                Đặt lại
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Catalog Book Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <BookCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Không thể tải danh mục"
          message={error}
          onRetry={fetchBooks}
        />
      ) : books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Không tìm thấy sách phù hợp"
          description={
            hasActiveFilters
              ? 'Không có kết quả nào khớp với bộ lọc đã chọn. Thử thay đổi từ khóa hoặc đặt lại bộ lọc.'
              : 'Thư viện hiện chưa có ấn bản nào trong danh mục.'
          }
          actionLabel={hasActiveFilters ? 'Đặt lại bộ lọc' : undefined}
          onAction={hasActiveFilters ? resetFilters : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {books.map((b) => {
            const avail = b.availableCopies ?? 0;
            const total = b.totalCopies ?? 0;
            const hasCopies = avail > 0;
            return (
              <div
                key={b.id}
                className="ui-card ui-card-hover overflow-hidden flex flex-col justify-between group border border-white/10"
              >
                {/* Book Cover */}
                <div className="h-48 w-full bg-slate-950/60 relative overflow-hidden flex items-center justify-center border-b border-white/10 p-3">
                  {b.coverImageUrl ? (
                    <img
                      src={b.coverImageUrl}
                      alt={b.title}
                      className="h-full max-w-[85%] object-cover rounded shadow-md group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                      <BookOpen className="w-10 h-10 mb-2 stroke-1 text-slate-500" />
                      <span className="text-xs text-slate-300 font-medium line-clamp-2">
                        {b.title}
                      </span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-slate-900/60">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono">ISBN: {b.isbn}</span>
                      <span className="text-indigo-300">{b.category?.name || 'Tổng quát'}</span>
                    </div>

                    <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors">
                      {b.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-1">
                      {b.authors?.map((a) => a.name).join(', ') || 'Chưa rõ tác giả'}
                    </p>

                    <div className="pt-2 flex items-center justify-between">
                      <span className={`badge ${hasCopies ? 'badge-green' : 'badge-red'}`}>
                        {hasCopies ? `Có sẵn ${avail}/${total}` : 'Đã mượn hết'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenBookDetail(b.id)}
                      className="btn-secondary flex-1 py-1.5 text-xs rounded-lg"
                    >
                      Chi tiết & Mượn
                    </button>

                    {avail === 0 && (
                      <button
                        type="button"
                        onClick={() => handlePlaceReservation(b.id)}
                        className="btn-primary py-1.5 px-3 text-xs rounded-lg"
                        title="Đặt trước"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isStaff && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditBook(b)}
                          className="btn-secondary py-1.5 px-2 text-xs rounded-lg"
                          title="Sửa sách"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCopyBookTarget(b);
                            setCopyErrors({});
                            setShowAddCopyModal(true);
                          }}
                          className="btn-secondary py-1.5 px-2 text-xs rounded-lg"
                          title="Thêm bản sao"
                        >
                          <CopyPlus className="w-3.5 h-3.5 text-indigo-400" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between ui-card p-4 text-xs text-slate-400 border border-white/10">
          <div>
            Trang <strong className="text-white">{page + 1}</strong> / <strong className="text-white">{totalPages}</strong> ({totalElements} ấn bản)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary py-1 px-3 text-xs disabled:opacity-40 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary py-1 px-3 text-xs disabled:opacity-40 rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      <BookDetailModal
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        onPlaceReservation={handlePlaceReservation}
        onUpdateCopyStatus={handleUpdateCopyStatus}
        onOpenAddCopy={(book) => {
          setCopyBookTarget(book);
          setCopyErrors({});
          setShowAddCopyModal(true);
        }}
        onOpenEditBook={handleOpenEditBook}
        onDeleteBook={handleDeleteBook}
        openAuthModal={openAuthModal}
      />

      {/* Modal Category Management */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#0d1322] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Quản Lý Thể Loại Sách</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Create Category Form */}
            <form onSubmit={handleCreateCategory} className="p-3 bg-slate-900/80 rounded-xl border border-white/10 space-y-2">
              <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Thêm Thể Loại Mới</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Tên thể loại * (VD: Khoa Học Máy Tính)"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="ui-input text-xs"
                />
                <input
                  type="text"
                  placeholder="Mô tả ngắn"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="ui-input text-xs"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingCategory || !categoryForm.name.trim()}
                  className="btn-primary py-1 px-3 text-xs rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingCategory ? 'Đang tạo...' : '+ Thêm thể loại'}
                </button>
              </div>
            </form>

            {/* Category List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Danh Sách Thể Loại Hiện Có ({categories.length})</h4>
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-slate-900/50 text-xs">
                  {editingCategory?.id === c.id ? (
                    <form onSubmit={handleUpdateCategory} className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={editCategoryForm.name}
                        onChange={(e) => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })}
                        className="ui-input text-xs py-1 flex-1"
                      />
                      <input
                        type="text"
                        value={editCategoryForm.description}
                        onChange={(e) => setEditCategoryForm({ ...editCategoryForm, description: e.target.value })}
                        className="ui-input text-xs py-1 flex-1"
                      />
                      <button type="submit" className="text-indigo-400 font-bold px-2 cursor-pointer">Lưu</button>
                      <button type="button" onClick={() => setEditingCategory(null)} className="text-slate-400 cursor-pointer">Hủy</button>
                    </form>
                  ) : (
                    <>
                      <div>
                        <div className="font-semibold text-white">{c.name}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{c.description || 'Chưa có mô tả'}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(c);
                            setEditCategoryForm({ name: c.name, description: c.description || '' });
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-400 rounded cursor-pointer"
                          title="Sửa thể loại"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(c.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                          title="Xóa thể loại"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Book */}
      {showAddBookModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#0d1322] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">Biên mục Sách Mới</h3>
              <button
                type="button"
                onClick={() => setShowAddBookModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tựa sách *</label>
                <input
                  type="text"
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  placeholder="Nhập tựa sách..."
                  className="ui-input"
                />
                {bookErrors.title && <p className="text-xs text-rose-400 mt-1">{bookErrors.title}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phụ đề</label>
                <input
                  type="text"
                  value={bookForm.subtitle}
                  onChange={(e) => setBookForm({ ...bookForm, subtitle: e.target.value })}
                  placeholder="Nhập phụ đề sách (nếu có)..."
                  className="ui-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ISBN *</label>
                  <input
                    type="text"
                    value={bookForm.isbn}
                    onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                    placeholder="978-..."
                    className="ui-input font-mono"
                  />
                  {bookErrors.isbn && <p className="text-xs text-rose-400 mt-1">{bookErrors.isbn}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Năm xuất bản</label>
                  <input
                    type="number"
                    value={bookForm.publicationYear}
                    onChange={(e) => setBookForm({ ...bookForm, publicationYear: parseInt(e.target.value, 10) || 2024 })}
                    className="ui-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tác giả *</label>
                <input
                  type="text"
                  value={bookForm.authorInput}
                  onChange={(e) => setBookForm({ ...bookForm, authorInput: e.target.value })}
                  placeholder="Nhập tên tác giả (phân cách bằng dấu phẩy)..."
                  className="ui-input"
                />
                {bookErrors.authorInput && <p className="text-xs text-rose-400 mt-1">{bookErrors.authorInput}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Thể loại * (Tự chọn)</label>
                  <select
                    value={bookForm.categoryId}
                    onChange={(e) => setBookForm({ ...bookForm, categoryId: e.target.value })}
                    className="ui-input cursor-pointer bg-slate-900 text-white"
                  >
                    <option value="">-- Chọn thể loại --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {bookErrors.categoryId && <p className="text-xs text-rose-400 mt-1">{bookErrors.categoryId}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nhà xuất bản * (Ghi tên)</label>
                  <input
                    type="text"
                    value={bookForm.publisherName}
                    onChange={(e) => setBookForm({ ...bookForm, publisherName: e.target.value })}
                    placeholder="VD: NXB Trẻ, O'Reilly..."
                    className="ui-input"
                  />
                  {bookErrors.publisherName && <p className="text-xs text-rose-400 mt-1">{bookErrors.publisherName}</p>}
                </div>
              </div>

              {/* Cover Image & Live Preview */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Đường dẫn Ảnh Bìa (URL)</span>
                </label>
                <input
                  type="url"
                  value={bookForm.coverImageUrl}
                  onChange={(e) => setBookForm({ ...bookForm, coverImageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="ui-input text-xs"
                />
                {bookForm.coverImageUrl.trim() && (
                  <div className="mt-2 p-2 bg-slate-950/80 rounded-lg border border-white/10 flex items-center gap-3">
                    <img
                      src={bookForm.coverImageUrl}
                      alt="Preview"
                      className="h-16 w-12 object-cover rounded shadow border border-white/20 shrink-0"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <span className="text-[11px] text-slate-400 line-clamp-1">Xem trước ảnh bìa sách</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Số sách ban đầu *</label>
                  <input
                    type="number"
                    min={1}
                    value={bookForm.initialCopies}
                    onChange={(e) => setBookForm({ ...bookForm, initialCopies: parseInt(e.target.value, 10) || 1 })}
                    className="ui-input font-semibold text-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Số trang</label>
                  <input
                    type="number"
                    value={bookForm.pageCount}
                    onChange={(e) => setBookForm({ ...bookForm, pageCount: parseInt(e.target.value, 10) || 300 })}
                    className="ui-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ngôn ngữ</label>
                  <input
                    type="text"
                    value={bookForm.language}
                    onChange={(e) => setBookForm({ ...bookForm, language: e.target.value })}
                    className="ui-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mô tả / Tóm tắt</label>
                <textarea
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  rows={3}
                  className="ui-input"
                  placeholder="Nội dung tóm tắt ấn bản..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddBookModal(false)}
                  className="btn-secondary rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBook}
                  className="btn-primary rounded-lg cursor-pointer"
                >
                  {isSubmittingBook ? 'Đang lưu...' : 'Lưu đầu sách'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Book (Full Edit) */}
      {showEditBookModal && editingBook && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#0d1322] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">Chỉnh Sửa Tất Cả Thông Tin Sách</h3>
              <button
                type="button"
                onClick={() => setShowEditBookModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateBook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tựa sách *</label>
                <input
                  type="text"
                  value={editBookForm.title}
                  onChange={(e) => setEditBookForm({ ...editBookForm, title: e.target.value })}
                  className="ui-input"
                />
                {editBookErrors.title && <p className="text-xs text-rose-400 mt-1">{editBookErrors.title}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phụ đề</label>
                <input
                  type="text"
                  value={editBookForm.subtitle}
                  onChange={(e) => setEditBookForm({ ...editBookForm, subtitle: e.target.value })}
                  className="ui-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ISBN *</label>
                  <input
                    type="text"
                    value={editBookForm.isbn}
                    onChange={(e) => setEditBookForm({ ...editBookForm, isbn: e.target.value })}
                    className="ui-input font-mono"
                  />
                  {editBookErrors.isbn && <p className="text-xs text-rose-400 mt-1">{editBookErrors.isbn}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Năm xuất bản</label>
                  <input
                    type="number"
                    value={editBookForm.publicationYear}
                    onChange={(e) => setEditBookForm({ ...editBookForm, publicationYear: parseInt(e.target.value, 10) || 2024 })}
                    className="ui-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tác giả *</label>
                <input
                  type="text"
                  value={editBookForm.authorInput}
                  onChange={(e) => setEditBookForm({ ...editBookForm, authorInput: e.target.value })}
                  className="ui-input"
                />
                {editBookErrors.authorInput && <p className="text-xs text-rose-400 mt-1">{editBookErrors.authorInput}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Thể loại (Tự chọn)</label>
                  <select
                    value={editBookForm.categoryId}
                    onChange={(e) => setEditBookForm({ ...editBookForm, categoryId: e.target.value })}
                    className="ui-input cursor-pointer bg-slate-900 text-white"
                  >
                    <option value="">-- Chọn thể loại --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nhà xuất bản (Ghi tên)</label>
                  <input
                    type="text"
                    value={editBookForm.publisherName}
                    onChange={(e) => setEditBookForm({ ...editBookForm, publisherName: e.target.value })}
                    placeholder="VD: NXB Trẻ..."
                    className="ui-input"
                  />
                </div>
              </div>

              {/* Cover Image & Live Preview */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Đường dẫn Ảnh Bìa (URL)</span>
                </label>
                <input
                  type="url"
                  value={editBookForm.coverImageUrl}
                  onChange={(e) => setEditBookForm({ ...editBookForm, coverImageUrl: e.target.value })}
                  className="ui-input text-xs"
                />
                {editBookForm.coverImageUrl.trim() && (
                  <div className="mt-2 p-2 bg-slate-950/80 rounded-lg border border-white/10 flex items-center gap-3">
                    <img
                      src={editBookForm.coverImageUrl}
                      alt="Preview"
                      className="h-16 w-12 object-cover rounded shadow border border-white/20 shrink-0"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <span className="text-[11px] text-slate-400 line-clamp-1">Xem trước ảnh bìa sách</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Số trang</label>
                  <input
                    type="number"
                    value={editBookForm.pageCount}
                    onChange={(e) => setEditBookForm({ ...editBookForm, pageCount: parseInt(e.target.value, 10) || 300 })}
                    className="ui-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ngôn ngữ</label>
                  <input
                    type="text"
                    value={editBookForm.language}
                    onChange={(e) => setEditBookForm({ ...editBookForm, language: e.target.value })}
                    className="ui-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mô tả / Tóm tắt</label>
                <textarea
                  value={editBookForm.description}
                  onChange={(e) => setEditBookForm({ ...editBookForm, description: e.target.value })}
                  rows={3}
                  className="ui-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEditBookModal(false)}
                  className="btn-secondary rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="btn-primary rounded-lg cursor-pointer"
                >
                  {isSubmittingEdit ? 'Đang cập nhật...' : 'Cập nhật sách'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Copy */}
      {showAddCopyModal && copyBookTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d1322] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Thêm Bản Sao Vật Lý</h3>
                <p className="text-xs text-indigo-400">{copyBookTarget.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCopyModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCopy} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mã bản sao / Mã vạch *</label>
                <input
                  type="text"
                  value={copyCodeInput}
                  onChange={(e) => setCopyCodeInput(e.target.value)}
                  placeholder="VD: CPY-1002"
                  className="ui-input font-mono uppercase"
                />
                {copyErrors.copyCode && <p className="text-xs text-rose-400 mt-1">{copyErrors.copyCode}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Vị trí giá sách</label>
                <input
                  type="text"
                  value={shelfLocationInput}
                  onChange={(e) => setShelfLocationInput(e.target.value)}
                  placeholder="VD: Giá A1 - Tầng 2"
                  className="ui-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddCopyModal(false)}
                  className="btn-secondary rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCopy}
                  className="btn-primary rounded-lg"
                >
                  {isSubmittingCopy ? 'Đang thêm...' : 'Thêm bản sao'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

