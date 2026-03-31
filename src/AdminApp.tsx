import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useBooks } from './hooks/useBooks';
import { BookList } from './components/BookList';
import { BookForm } from './components/BookForm';
import { SearchBar } from './components/SearchBar';
import { Header } from './components/Header';
import { AdminBorrowings } from './pages/AdminBorrowings';
import type { Book, BookFormData } from './types/book';

const BooksDashboard = () => {
  const { books, loading, error, searchBooks, page, totalPages, goToPage, addBook, updateBook, deleteBook } =
    useBooks();
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSearch = (searchTerm: string) => {
    searchBooks(searchTerm);
  };

  const handleAddBook = () => {
    setEditingBook(null);
    setShowForm(true);
  };

  const handleEditBook = (book: Book) => {
    setEditingBook(book);
    setShowForm(true);
  };

  const handleDeleteBook = async (book: Book) => {
    if (!window.confirm(`确定要删除《${book.title}》吗？`)) {
      return;
    }

    const success = await deleteBook(book.id);
    if (success) {
      showNotification('success', '图书删除成功！');
    } else {
      showNotification('error', '删除失败，请重试。');
    }
  };

  const handleFormSubmit = async (bookData: BookFormData) => {
    if (editingBook) {
      const result = await updateBook(editingBook.id, bookData);
      if (result) {
        showNotification('success', '图书更新成功！');
        setShowForm(false);
        setEditingBook(null);
      } else {
        showNotification('error', '更新失败，请重试。');
      }
    } else {
      const result = await addBook(bookData);
      if (result) {
        showNotification('success', '图书添加成功！');
        setShowForm(false);
      } else {
        showNotification('error', '添加失败，请重试。');
      }
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingBook(null);
  };

  return (
    <div className="min-h-screen bg-[#060a19] text-cyan-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-10 left-8 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-8 right-10 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
      </div>
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {notification && (
          <div
            className={`mb-6 p-4 rounded-xl border ${
              notification.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-100 border-emerald-300/30'
                : 'bg-rose-500/15 text-rose-100 border-rose-300/30'
            }`}
          >
            {notification.message}
          </div>
        )}

        {error && !loading && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/15 text-rose-100 border border-rose-300/30">
            错误: {error}
          </div>
        )}

        <div className="mb-6 flex gap-2 items-start">
          <div className="flex-1 [&>form]:mb-0">
            <SearchBar onSearch={handleSearch} />
          </div>
          <button
            onClick={handleAddBook}
            className="px-6 py-2.5 rounded-xl font-medium text-white whitespace-nowrap bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 transition-all shadow-[0_12px_30px_-14px_rgba(16,185,129,0.8)]"
          >
            添加图书
          </button>
        </div>

        <BookList
          books={books}
          loading={loading}
          onEdit={handleEditBook}
          onDelete={handleDeleteBook}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={goToPage}
        />

        {showForm && (
          <BookForm
            book={editingBook}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        )}
      </div>
    </div>
  );
};

function AdminApp() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<BooksDashboard />} />
      <Route path="borrowings" element={<AdminBorrowings />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}

export default AdminApp;
