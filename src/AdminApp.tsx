import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BookList } from './components/BookList';
import { BookForm } from './components/BookForm';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { useBooks } from './hooks/useBooks';
import { useUserThemePreference } from './hooks/useUserThemePreference';
import { useLanguage } from './contexts/LanguageContext';
import { AdminBorrowings } from './pages/AdminBorrowings';
import type { Book, BookFormData } from './types/book';

const BooksDashboard = () => {
  const { language } = useLanguage();
  const textMap = {
    zh: {
      confirmDelete: '确定要删除《{title}》吗？',
      deleteSuccess: '图书删除成功！',
      deleteFail: '删除失败，请重试。',
      updateSuccess: '图书更新成功！',
      updateFail: '更新失败，请重试。',
      addSuccess: '图书添加成功！',
      addFail: '添加失败，请重试。',
      error: '错误',
      addBook: '添加图书',
    },
    en: {
      confirmDelete: 'Delete "{title}"?',
      deleteSuccess: 'Book deleted successfully!',
      deleteFail: 'Delete failed, please retry.',
      updateSuccess: 'Book updated successfully!',
      updateFail: 'Update failed, please retry.',
      addSuccess: 'Book added successfully!',
      addFail: 'Add failed, please retry.',
      error: 'Error',
      addBook: 'Add Book',
    },
    ja: {
      confirmDelete: '「{title}」を削除しますか？',
      deleteSuccess: '図書を削除しました！',
      deleteFail: '削除に失敗しました。再試行してください。',
      updateSuccess: '図書を更新しました！',
      updateFail: '更新に失敗しました。再試行してください。',
      addSuccess: '図書を追加しました！',
      addFail: '追加に失敗しました。再試行してください。',
      error: 'エラー',
      addBook: '図書を追加',
    },
  } as const;
  const t = textMap[language];
  const { isLightTheme } = useUserThemePreference();
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
    if (!window.confirm(t.confirmDelete.replace('{title}', book.title))) {
      return;
    }

    const success = await deleteBook(book.id);
    if (success) {
      showNotification('success', t.deleteSuccess);
    } else {
      showNotification('error', t.deleteFail);
    }
  };

  const handleFormSubmit = async (bookData: BookFormData) => {
    if (editingBook) {
      const result = await updateBook(editingBook.id, bookData);
      if (result) {
        showNotification('success', t.updateSuccess);
        setShowForm(false);
        setEditingBook(null);
      } else {
        showNotification('error', t.updateFail);
      }
    } else {
      const result = await addBook(bookData);
      if (result) {
        showNotification('success', t.addSuccess);
        setShowForm(false);
      } else {
        showNotification('error', t.addFail);
      }
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingBook(null);
  };

  return (
    <div
      className={`admin-theme min-h-screen transition-colors ${isLightTheme ? 'bg-[#f7f3e8] text-gray-900' : 'bg-[#060a19] text-cyan-50'}`}
      data-theme={isLightTheme ? 'light' : 'dark'}
    >
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className={`absolute top-10 left-8 h-72 w-72 rounded-full blur-3xl ${isLightTheme ? 'bg-amber-300/35' : 'bg-cyan-500/10'}`}
        />
        <div
          className={`absolute bottom-8 right-10 h-80 w-80 rounded-full blur-3xl ${isLightTheme ? 'bg-orange-200/35' : 'bg-violet-500/10'}`}
        />
      </div>
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {notification && (
          <div
            className={`mb-6 p-4 rounded-xl border ${
              notification.type === 'success'
                ? isLightTheme
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-emerald-500/15 text-emerald-100 border-emerald-300/30'
                : isLightTheme
                  ? 'bg-rose-50 text-rose-900 border-rose-200'
                  : 'bg-rose-500/15 text-rose-100 border-rose-300/30'
            }`}
          >
            {notification.message}
          </div>
        )}

        {error && !loading && (
          <div
            className={
              isLightTheme
                ? 'mb-6 p-4 rounded-xl bg-rose-50 text-rose-900 border border-rose-200'
                : 'mb-6 p-4 rounded-xl bg-rose-500/15 text-rose-100 border border-rose-300/30'
            }
          >
            {t.error}: {error}
          </div>
        )}

        <div className="mb-6 flex gap-2 items-start">
          <div className="flex-1 [&>form]:mb-0">
            <SearchBar onSearch={handleSearch} />
          </div>
          <button
            type="button"
            onClick={handleAddBook}
            className={
              isLightTheme
                ? 'px-6 py-2.5 rounded-xl font-medium text-white whitespace-nowrap bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md shadow-emerald-600/25'
                : 'px-6 py-2.5 rounded-xl font-medium text-white whitespace-nowrap bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 transition-all shadow-[0_12px_30px_-14px_rgba(16,185,129,0.8)]'
            }
          >
            {t.addBook}
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
