import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useBooks } from './hooks/useBooks';
import { BookList } from './components/BookList';
import { BookForm } from './components/BookForm';
import { SearchBar } from './components/SearchBar';
import { Header } from './components/Header';
import { Login } from './components/Login';
import { Register } from './components/Register';
import type { Book, BookFormData } from './types/book';

const BooksDashboard = () => {
  const { books, loading, error, searchBooks, loadMore, hasMore, addBook, updateBook, deleteBook } = useBooks();
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
    <div className="min-h-screen bg-gray-100">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {notification && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              notification.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}
          >
            {notification.message}
          </div>
        )}

        {error && !loading && (
          <div className="mb-6 p-4 rounded-lg bg-red-100 text-red-800 border border-red-200">
            错误: {error}
          </div>
        )}

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} />
          </div>
          <button
            onClick={handleAddBook}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            添加图书
          </button>
        </div>

        <BookList
          books={books}
          loading={loading}
          onEdit={handleEditBook}
          onDelete={handleDeleteBook}
          onLoadMore={loadMore}
          hasMore={hasMore}
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

function App() {
  const { user, loading: authLoading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">加载中...</p>
      </div>
    );
  }

  if (!user) {
    if (authMode === 'login') {
      return <Login onToggleMode={() => setAuthMode('register')} />;
    }
    return <Register onToggleMode={() => setAuthMode('login')} />;
  }

  return <BooksDashboard />;
}

export default App;
