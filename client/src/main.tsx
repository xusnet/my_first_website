import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './store/AuthContext'
import { SiteLayout } from './components/SiteLayout'
import { Home } from './pages/public/Home'
import { PostDetailPage } from './pages/public/PostDetail'
import { AboutPage } from './pages/public/About'
import { CategoryListPage, CategoryPage, TagPage } from './pages/public/Categories'
import { Login } from './admin/Login'
import { ChangePassword } from './admin/ChangePassword'
import { AdminLayout } from './admin/AdminLayout'
import { ProtectedRoute } from './admin/ProtectedRoute'
import { Dashboard } from './admin/Dashboard'
import { Users } from './admin/Users'
import { Roles } from './admin/Roles'
import { Permissions } from './admin/Permissions'
import { Posts } from './admin/Posts'
import { PostEditor } from './admin/PostEditor'
import { Categories, Tags } from './admin/CategoriesTags'
import { Settings } from './admin/Settings'
import { AuditLogs } from './admin/AuditLogs'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="post/:slug" element={<PostDetailPage />} />
            <Route path="categories" element={<CategoryListPage />} />
            <Route path="category/:slug" element={<CategoryPage />} />
            <Route path="tag/:slug" element={<TagPage />} />
            <Route path="about" element={<AboutPage />} />
          </Route>

          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="posts" element={<Posts />} />
            <Route path="posts/new" element={<PostEditor />} />
            <Route path="posts/:id/edit" element={<PostEditor />} />
            <Route path="categories" element={<Categories />} />
            <Route path="tags" element={<Tags />} />
            <Route path="users" element={<Users />} />
            <Route path="roles" element={<Roles />} />
            <Route path="permissions" element={<Permissions />} />
            <Route path="audit" element={<AuditLogs />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route
            path="/admin/change-password"
            element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
